const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const semver = require('semver');

function validateVersion(tag, pkg, lock) {
  const version = tag?.replace(/^v/, '');
  if (!tag?.startsWith('v') || semver.valid(version) !== version) {
    throw new Error(`Invalid release tag: ${tag}`);
  }
  if (
    version !== pkg.version ||
    version !== lock?.version ||
    version !== lock?.packages?.['']?.version
  ) {
    throw new Error(
      'Tag, package.json and package-lock.json versions must match: ' +
        `tag=${tag}, package.json=${pkg.version}, package-lock.json=${lock?.version}, ` +
        `package-lock.json packages[""]=${lock?.packages?.['']?.version}. ` +
        'Use npm version to update both package files together.',
    );
  }
  return { version, channel: String(semver.prerelease(version)?.[0] || 'latest') };
}

function manifestName(platform, _channel) {
  const suffix = { windows: '', macos: '-mac', linux: '-linux' }[platform];
  if (suffix === undefined) throw new Error(`Unknown platform: ${platform}`);
  // electron-builder's GitHub provider writes latest*.yml even for prereleases.
  // GitHubProvider selects the prerelease tag and falls back to this manifest.
  return `latest${suffix}.yml`;
}

function assetName(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/.test(name)) {
    throw new Error(`Unsafe release asset name: ${name}`);
  }
  return name;
}

function validateAssets(directory, platform, version, channel) {
  const metadata = manifestName(platform, channel);
  const info = yaml.load(fs.readFileSync(path.join(directory, metadata), 'utf8'));
  if (info.version !== version || !Array.isArray(info.files) || !info.files.length) {
    throw new Error(`Invalid update manifest: ${metadata}`);
  }
  const names = new Set([metadata]);
  for (const file of info.files) {
    const name = assetName(file.url);
    const data = fs.readFileSync(path.join(directory, name));
    if (!data.length || data.length !== file.size) throw new Error(`Invalid size: ${name}`);
    if (createHash('sha512').update(data).digest('base64') !== file.sha512) {
      throw new Error(`Invalid SHA-512: ${name}`);
    }
    names.add(name);
    if (platform === 'windows' || platform === 'macos') {
      const blockmap = `${name}.blockmap`;
      if (!fs.statSync(path.join(directory, blockmap)).size)
        throw new Error(`Empty blockmap: ${blockmap}`);
      names.add(blockmap);
    }
  }
  const required = { windows: ['.exe'], macos: ['.zip', '.dmg'], linux: ['.AppImage', '.deb'] };
  for (const extension of required[platform]) {
    if (![...names].some((name) => name.endsWith(extension))) {
      throw new Error(`Missing ${platform} ${extension} artifact`);
    }
  }
  if (info.path !== info.files[0].url || info.sha512 !== info.files[0].sha512) {
    throw new Error(`Inconsistent legacy fields: ${metadata}`);
  }
  return [...names].sort();
}

function gh(args, json = false) {
  const result = spawnSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `gh exited with ${result.status}`);
  return json ? JSON.parse(result.stdout) : result.stdout;
}

function publish(directory, tag, version, channel, run = gh) {
  // Validate all platforms before creating or modifying a release.
  const names = ['windows', 'macos', 'linux'].flatMap((platform) =>
    validateAssets(directory, platform, version, channel),
  );
  const repo = process.env.GH_REPO;
  if (!repo) throw new Error('GH_REPO is required');
  const releases = run(
    ['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`],
    true,
  ).flat();
  const existing = releases.find((release) => release.tag_name === tag);
  if (existing && !existing.draft)
    throw new Error(`Release ${tag} is already published; use a new version`);
  if (!existing) {
    run([
      'release',
      'create',
      tag,
      '--verify-tag',
      '--draft',
      '--title',
      tag,
      '--generate-notes',
      ...(semver.prerelease(version) ? ['--prerelease'] : []),
    ]);
  }
  // Each path is an argument, never shell-expanded. gh streams large binaries.
  run(['release', 'upload', tag, ...names.map((name) => path.join(directory, name)), '--clobber']);
  const uploaded = run(['release', 'view', tag, '--json', 'assets'], true).assets;
  for (const name of names) {
    const asset = uploaded.find((item) => item.name === name);
    if (!asset || asset.size !== fs.statSync(path.join(directory, name)).size) {
      throw new Error(`Missing or incomplete uploaded asset: ${name}`);
    }
  }
  run([
    'release',
    'edit',
    tag,
    '--draft=false',
    ...(semver.prerelease(version) ? [] : ['--latest']),
  ]);
}

if (require.main === module) {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    const [command, platform] = process.argv.slice(2);
    const tag =
      command === 'validate-package'
        ? `v${pkg.version}`
        : process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME;
    const { version, channel } = validateVersion(tag, pkg, lock);
    if (command === 'stage') {
      const names = validateAssets('release', platform, version, channel);
      fs.mkdirSync('release-assets', { recursive: true });
      for (const name of names)
        fs.copyFileSync(path.join('release', name), path.join('release-assets', name));
      console.log(`Validated ${platform}: ${names.join(', ')}`);
    } else if (command === 'publish') {
      publish('release-assets', tag, version, channel);
    } else if (!['validate-version', 'validate-package'].includes(command)) {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateVersion, validateAssets, publish, manifestName, gh };
