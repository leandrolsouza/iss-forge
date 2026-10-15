import { createHash } from 'node:crypto';
import { getProvider, getEffectiveEndpoint } from './aiProviders.mjs';

const PRIVATE_KEYS = new Set(['aiApiKey', 'aiCredentials']);

/** Secrets are scoped to the provider AND destination; changing an endpoint cannot leak a saved key. */
function scope(config) {
  const provider = getProvider(config.provider);
  const endpoint = getEffectiveEndpoint(provider, config.endpoint, config.model);
  const destination = provider.format === 'bedrock' ? new URL(endpoint).origin : endpoint;
  return createHash('sha256').update(`${provider.id}\n${destination}`).digest('hex');
}

export function createCredentialSettings(store, safeStorage) {
  const volatileKeys = new Map();
  const config = () => ({
    provider: store.get('aiProvider'),
    endpoint: store.get('aiEndpoint'),
    model: store.get('aiModel'),
    temperature: store.get('aiTemperature'),
    maxTokens: store.get('aiMaxTokens'),
  });
  const encryptionAvailable = () =>
    safeStorage.isEncryptionAvailable() &&
    safeStorage.getSelectedStorageBackend?.() !== 'basic_text';

  function saveKey(key) {
    const id = scope(config());
    const vault = { ...(store.get('aiCredentials') || {}) };
    if (!key) {
      delete vault[id];
      store.set('aiCredentials', vault);
      volatileKeys.delete(id);
    } else if (encryptionAvailable()) {
      vault[id] = safeStorage.encryptString(key).toString('base64');
      store.set('aiCredentials', vault);
      volatileKeys.delete(id);
    } else {
      // No plaintext fallback (Linux without a keyring). It works for this session.
      delete vault[id];
      store.set('aiCredentials', vault);
      volatileKeys.set(id, key);
    }
    store.delete('aiApiKey');
  }

  function publicSettings() {
    const id = scope(config());
    const encrypted = !!store.get('aiCredentials')?.[id];
    const session = volatileKeys.has(id);
    return {
      ...Object.fromEntries(Object.entries(store.store).filter(([key]) => !PRIVATE_KEYS.has(key))),
      aiApiKey: '',
      aiHasApiKey: encrypted || session,
      aiKeyStorage: session ? 'session' : encrypted ? 'encrypted' : 'none',
    };
  }

  return {
    publicSettings,
    migrate() {
      const legacy = store.get('aiApiKey');
      if (legacy) saveKey(legacy);
      else store.delete('aiApiKey');
    },
    update(settings) {
      // The caller validates allowed keys and values before any mutation.
      for (const [key, value] of Object.entries(settings)) {
        if (!PRIVATE_KEYS.has(key)) store.set(key, value);
      }
      if (Object.hasOwn(settings, 'aiApiKey')) saveKey(settings.aiApiKey);
      return publicSettings();
    },
    publicAiSettings() {
      return { ...config(), apiKey: '', hasApiKey: publicSettings().aiHasApiKey };
    },
    resolveAiSettings(overrides = {}) {
      const effective = { ...config(), ...overrides };
      if (overrides.apiKey) return effective;
      const id = scope(effective);
      const encrypted = store.get('aiCredentials')?.[id];
      effective.apiKey = volatileKeys.get(id) || '';
      if (encrypted) {
        if (!encryptionAvailable()) throw new Error('aiCredentialUnavailable');
        effective.apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      }
      return effective;
    },
  };
}
