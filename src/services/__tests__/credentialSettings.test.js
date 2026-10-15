import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { createCredentialSettings } from '../../../electron/credentials.mjs';

function fixture({ available = true, backend, legacy } = {}) {
  const store = {
    store: {
      aiProvider: 'openai-compatible',
      aiEndpoint: 'http://localhost:1234/v1/chat/completions',
      aiModel: 'test',
      ...(legacy ? { aiApiKey: legacy } : {}),
    },
    get(key) {
      return this.store[key];
    },
    set(key, value) {
      this.store[key] = value;
    },
    delete(key) {
      delete this.store[key];
    },
  };
  // A storage double tests the boundary; real encryption belongs to the OS API.
  const safeStorage = {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => backend,
    encryptString: (text) => Buffer.from(text.split('').reverse().join('')),
    decryptString: (buffer) => buffer.toString().split('').reverse().join(''),
  };
  return { store, access: createCredentialSettings(store, safeStorage) };
}

describe('credential settings', () => {
  it('migrates a legacy key without returning it or keeping it in plaintext', () => {
    const { store, access } = fixture({ legacy: 'private-key' });
    access.migrate();
    expect(store.get('aiApiKey')).toBeUndefined();
    expect(JSON.stringify(store.store)).not.toContain('private-key');
    expect(access.publicSettings()).toMatchObject({
      aiApiKey: '',
      aiHasApiKey: true,
      aiKeyStorage: 'encrypted',
    });
    expect(access.publicSettings()).not.toHaveProperty('aiCredentials');
    expect(access.publicAiSettings().apiKey).toBe('');
    expect(access.resolveAiSettings().apiKey).toBe('private-key');
  });

  it('keeps a saved key in the main process when the renderer sends an empty key', () => {
    const { access } = fixture();
    access.update({ aiApiKey: 'secret' });
    expect(access.resolveAiSettings({ apiKey: '', model: 'other-model' }).apiKey).toBe('secret');
    expect(access.resolveAiSettings({ apiKey: 'new-key' }).apiKey).toBe('new-key');
  });

  it('does not send a saved key to a different provider or endpoint', () => {
    const { access } = fixture();
    access.update({ aiApiKey: 'secret' });
    expect(
      access.resolveAiSettings({ endpoint: 'https://other.example/v1/chat/completions' }).apiKey,
    ).toBe('');
    expect(access.resolveAiSettings({ provider: 'claude' }).apiKey).toBe('');
    access.update({ aiEndpoint: 'https://other.example/v1/chat/completions' });
    expect(access.publicSettings().aiHasApiKey).toBe(false);
  });

  it.each([{ available: false }, { backend: 'basic_text' }])(
    'never falls back to plaintext when secure storage is unavailable (%j)',
    (options) => {
      const { store, access } = fixture({ ...options, legacy: 'secret' });
      access.migrate();
      expect(JSON.stringify(store.store)).not.toContain('secret');
      expect(access.resolveAiSettings().apiKey).toBe('secret');
      expect(access.publicSettings().aiKeyStorage).toBe('session');
      expect(
        createCredentialSettings(store, { isEncryptionAvailable: () => false }).publicSettings()
          .aiHasApiKey,
      ).toBe(false);
    },
  );

  it('clears only the current destination key', () => {
    const { access } = fixture();
    access.update({ aiApiKey: 'secret' });
    access.update({ aiApiKey: '' });
    expect(access.resolveAiSettings().apiKey).toBe('');
    expect(access.publicSettings().aiHasApiKey).toBe(false);
  });
});
