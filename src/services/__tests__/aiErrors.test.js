import { describe, it, expect } from 'vitest';
import {
  aiError,
  aiErrorKey,
  aiErrorDetail,
  fetchErrorToAi,
  responseErrorToAi,
  parseResponse,
} from '../aiProviders';
import { parseLLMResponse } from '../aiService';
import * as electronAi from '../../../electron/aiProviders.mjs';
import en from '../../i18n/en';
import ptBR from '../../i18n/pt-BR';

describe('AI errors', () => {
  it('map every code to a message in both languages', () => {
    for (const code of [
      'connection',
      'timeout',
      'api',
      'invalidResponse',
      'parse',
      'empty',
      'noRom',
      'other',
    ]) {
      const key = aiErrorKey(aiError(code));
      expect(en[key], key).toBeTypeOf('string');
      expect(ptBR[key], key).toBeTypeOf('string');
    }
    expect(aiErrorKey(aiError('other'))).toBe('aiErrorGeneric');
  });

  it('classify fetch failures (browser and Node) and HTTP errors', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ECONNREFUSED' },
    });
    const browser = new TypeError('Failed to fetch');
    for (const toAi of [fetchErrorToAi, electronAi.fetchErrorToAi]) {
      expect(toAi(timeout, 'http://x').code).toBe('timeout');
      expect(toAi(refused, 'http://x')).toEqual({
        code: 'connection',
        detail: 'ECONNREFUSED (http://x)',
      });
      expect(toAi(new Error('boom'), 'http://x')).toEqual({ code: 'generic', detail: 'boom' });
    }
    expect(fetchErrorToAi(browser, 'http://x').code).toBe('connection');
    const response = { status: 401, statusText: 'Unauthorized', text: async () => 'bad key' };
    expect(await responseErrorToAi(response)).toEqual({ code: 'api', detail: 'HTTP 401: bad key' });
    expect(await electronAi.responseErrorToAi(response)).toEqual({
      code: 'api',
      detail: 'HTTP 401: bad key',
    });
  });

  it('come from the response parsers as codes, with the technical text apart', () => {
    expect(parseResponse({}, 'openai').error.code).toBe('invalidResponse');
    expect(electronAi.parseResponse({}, 'anthropic').error.code).toBe('invalidResponse');
    expect(parseLLMResponse('').error).toEqual({ code: 'empty', detail: '' });
    const bad = parseLLMResponse('{ "name": ');
    expect(bad.error.code).toBe('parse');
    expect(aiErrorKey(bad.error)).toBe('aiErrorParse');
    expect(aiErrorDetail(bad.error)).not.toBe('');
  });

  it('still read plain messages', () => {
    expect(aiErrorKey('Connection refused at http://x')).toBe('aiErrorConnection');
    expect(aiErrorKey('API error 500: oops')).toBe('aiErrorApi');
    expect(aiErrorDetail('API error 500: oops')).toBe('API error 500: oops');
  });
});
