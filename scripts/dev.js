/**
 * Development script - starts Vite then launches Electron
 * Works reliably on Windows
 */
const { spawn } = require('child_process');
const http = require('http');

const VITE_PORT = 5173;
const MAX_RETRIES = 30;

// Start Vite
console.log('[dev] Starting Vite dev server...');
const vite = spawn('npx', ['vite'], {
  cwd: process.cwd(),
  shell: true,
  stdio: 'pipe',
});

vite.stdout.on('data', (data) => {
  process.stdout.write(`[vite] ${data}`);
});

vite.stderr.on('data', (data) => {
  process.stderr.write(`[vite] ${data}`);
});

// Wait for Vite to be ready, then start Electron
function checkServer(retries = 0) {
  if (retries >= MAX_RETRIES) {
    console.error('[dev] Vite server did not start in time. Aborting.');
    process.exit(1);
  }

  const req = http.get(`http://localhost:${VITE_PORT}`, (res) => {
    console.log(`[dev] Vite is ready on port ${VITE_PORT}!`);
    startElectron();
  });

  req.on('error', () => {
    setTimeout(() => checkServer(retries + 1), 1000);
  });

  req.end();
}

function startElectron() {
  console.log('[dev] Starting Electron...');
  const electron = spawn('npx', ['electron', '.'], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });

  electron.on('close', (code) => {
    console.log(`[dev] Electron exited with code ${code}`);
    vite.kill();
    process.exit(code);
  });
}

// Handle cleanup
process.on('SIGINT', () => {
  vite.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  vite.kill();
  process.exit();
});

// Start checking for Vite
setTimeout(() => checkServer(), 1500);
