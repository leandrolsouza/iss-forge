/**
 * One streamed LLM completion as a promise, in Electron (main process does the
 * request, see 'ai:generate-stream') or in the browser (dev mode).
 *
 * streamCompletion({ systemPrompt, userPrompt, settings, schema, onChunk, signal })
 *   → Promise<{ text, truncated, stopReason }>
 * Rejects with an AI error { code, detail } (code 'cancelled' when `signal` aborts).
 */
import * as electronBridge from './electronBridge';
import {
  DEFAULT_MAX_TOKENS,
  aiError,
  buildHeaders,
  buildRequestBody,
  fetchErrorToAi,
  getEffectiveEndpoint,
  getProvider,
  isTruncatedStop,
  parseResponse,
  readSseStream,
  responseErrorToAi,
} from './aiProviders';

let nextRequestId = 0;

export function streamCompletion(options) {
  return electronBridge.isElectron() ? streamElectron(options) : streamWeb(options);
}

function streamElectron({ systemPrompt, userPrompt, settings, schema, onChunk, signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(aiError('cancelled'));
      return;
    }
    const requestId = `ai-${Date.now()}-${++nextRequestId}`;
    let text = '';
    let settled = false;
    const removers = [];

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      removers.forEach((remove) => remove?.());
      signal?.removeEventListener('abort', onAbort);
      fn(value);
    };
    function onAbort() {
      electronBridge.aiCancelStream(requestId);
      settle(reject, aiError('cancelled'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    removers.push(
      electronBridge.onAiStreamChunk((chunk, id) => {
        if (id !== requestId || settled) return;
        text += chunk;
        onChunk?.(chunk);
      }),
      electronBridge.onAiStreamDone((info) => {
        if (info?.requestId !== requestId) return;
        settle(resolve, {
          text,
          truncated: Boolean(info.truncated),
          stopReason: info.stopReason ?? null,
        });
      }),
      electronBridge.onAiStreamError((error, id) => {
        if (id !== requestId) return;
        settle(reject, error || aiError('generic'));
      }),
    );

    electronBridge
      .aiGenerateStream({ prompt: userPrompt, systemPrompt, settings, schema, requestId })
      .catch((err) => settle(reject, aiError('generic', err?.message || String(err))));
  });
}

async function streamWeb({ systemPrompt, userPrompt, settings, schema, onChunk, signal }) {
  const provider = getProvider(settings.provider);
  // Bedrock streams in a binary AWS protocol: in the browser, ask for the whole answer
  const stream = provider.format !== 'bedrock';
  const endpoint = getEffectiveEndpoint(provider, settings.endpoint, settings.model, stream);
  const headers = buildHeaders(provider, settings.apiKey);
  if (provider.format === 'anthropic') {
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  const body = buildRequestBody({
    format: provider.format,
    systemPrompt,
    userPrompt,
    model: settings.model,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens || DEFAULT_MAX_TOKENS,
    stream,
    schema: schema || null,
  });

  const fail = (err) => {
    if (signal?.aborted) return aiError('cancelled');
    return err?.code ? err : fetchErrorToAi(err, endpoint);
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw fail(err);
  }
  if (!response.ok) throw await responseErrorToAi(response);

  try {
    if (!stream) {
      const result = parseResponse(await response.json(), provider.format);
      if (result.error) throw result.error;
      const text = result.content || '';
      if (text) onChunk?.(text);
      return { text, truncated: isTruncatedStop(result.stopReason), stopReason: result.stopReason };
    }
    let text = '';
    const { stopReason, error } = await readSseStream(response.body, provider.format, (chunk) => {
      text += chunk;
      onChunk?.(chunk);
    });
    if (error) throw error;
    return { text, truncated: isTruncatedStop(stopReason), stopReason };
  } catch (err) {
    throw fail(err);
  }
}
