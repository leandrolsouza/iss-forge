/**
 * AI Provider Definitions
 *
 * Each provider has its own endpoint, authentication style, request format,
 * and a curated list of popular models.
 *
 * NOTE: Provider display names are handled via i18n keys in the UI layer.
 * The `name` field here is for internal/debug reference only.
 */

export const AI_PROVIDERS = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    authType: 'bearer', // Authorization: Bearer <key>
    format: 'openai', // Standard OpenAI chat completions format
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-6-astra', name: 'GPT-6 Astra' },
      { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' },
      { id: 'gpt-6-sol', name: 'GPT-6 Sol' },
      { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
    ],
    defaultModel: 'gpt-6-luna',
    requiresApiKey: true,
    endpointEditable: false,
  },
  claude: {
    id: 'claude',
    name: 'Claude (Anthropic)',
    endpoint: 'https://api.anthropic.com/v1/messages',
    authType: 'x-api-key', // x-api-key header
    format: 'anthropic', // Anthropic Messages API format
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-fable-5-1', name: 'Claude Fable 5.1' },
      { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' },
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
      { id: 'claude-opus-5', name: 'Claude Opus 5' },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
      { id: 'claude-fable-5', name: 'Claude Fable 5' },
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    ],
    defaultModel: 'claude-sonnet-5-5',
    requiresApiKey: true,
    endpointEditable: false,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini (Google)',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    authType: 'bearer', // Uses OpenAI-compatible endpoint with Bearer token
    format: 'openai', // Google's OpenAI-compatible layer
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
      { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
    defaultModel: 'gemini-3.6-flash',
    requiresApiKey: true,
    endpointEditable: false,
  },
  grok: {
    id: 'grok',
    name: 'Grok (xAI)',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    authType: 'bearer',
    format: 'openai', // xAI uses OpenAI-compatible format
    apiKeyUrl: 'https://console.x.ai/team/default/api-keys',
    models: [
      { id: 'grok-4.7', name: 'Grok 4.7' },
      { id: 'grok-4.6', name: 'Grok 4.6' },
      { id: 'grok-4.3', name: 'Grok 4.3' },
      { id: 'grok-4', name: 'Grok 4' },
    ],
    defaultModel: 'grok-4.7',
    requiresApiKey: true,
    endpointEditable: false,
  },
  bedrock: {
    id: 'bedrock',
    name: 'AWS Bedrock',
    endpoint: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    authType: 'bearer', // Bedrock API key uses Bearer token
    format: 'bedrock', // Native Converse API format
    apiKeyUrl: 'https://console.aws.amazon.com/bedrock/home#/api-keys',
    regions: [
      'us-east-1',
      'us-west-2',
      'eu-west-1',
      'eu-central-1',
      'ap-southeast-1',
      'ap-northeast-1',
    ],
    defaultRegion: 'us-east-1',
    models: [
      { id: 'us.anthropic.claude-haiku-5-5', name: 'Claude Haiku 5.5' },
      { id: 'us.anthropic.claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
      { id: 'us.anthropic.claude-opus-5-5', name: 'Claude Opus 5.5' },
      { id: 'us.anthropic.claude-fable-5-1', name: 'Claude Fable 5.1' },
      { id: 'us.anthropic.claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'us.anthropic.claude-sonnet-4-5-v2', name: 'Claude Sonnet 4.5 v2' },
      { id: 'us.anthropic.claude-haiku-4-5-v1', name: 'Claude Haiku 4.5' },
      { id: 'amazon.nova-pro-v1:0', name: 'Amazon Nova Pro' },
      { id: 'amazon.nova-lite-v1:0', name: 'Amazon Nova Lite' },
      { id: 'amazon.nova-micro-v1:0', name: 'Amazon Nova Micro' },
      { id: 'us.meta.llama3-3-70b-instruct-v1:0', name: 'Meta Llama 3.3 70B' },
    ],
    defaultModel: 'amazon.nova-lite-v1:0',
    requiresApiKey: true,
    endpointEditable: false,
  },
  'openai-compatible': {
    id: 'openai-compatible',
    name: 'OpenAI-Compatible (Local/Custom)',
    endpoint: 'http://localhost:1234/v1/chat/completions',
    authType: 'bearer',
    format: 'openai',
    apiKeyUrl: null,
    models: [],
    defaultModel: '',
    requiresApiKey: false,
    endpointEditable: true,
  },
};

/**
 * Get provider config by ID
 * @param {string} providerId
 * @returns {object|null}
 */
export function getProvider(providerId) {
  return AI_PROVIDERS[providerId] || AI_PROVIDERS['openai-compatible'];
}

/**
 * Get the list of provider IDs in display order
 * @returns {string[]}
 */
export function getProviderIds() {
  return ['openai', 'claude', 'gemini', 'grok', 'bedrock', 'openai-compatible'];
}

/**
 * The model to use with `provider`: `currentModel` when the provider lists it (or, for
 * a provider with a free-text model field, when it was typed for that same provider),
 * else the provider's default ('' = the model loaded in the local server).
 * Avoids sending a model of another provider (e.g. a GPT model to Claude).
 * @param {object} provider - from AI_PROVIDERS
 * @param {string} currentModel
 * @param {string} [modelProviderId] - provider the current model was chosen for
 */
export function modelForProvider(provider, currentModel, modelProviderId = provider.id) {
  const models = provider.models || [];
  if (currentModel && models.some((m) => m.id === currentModel)) return currentModel;
  if (!models.length && modelProviderId === provider.id) return currentModel || '';
  return provider.defaultModel || '';
}

/**
 * Build request headers for a given provider
 * @param {object} provider - Provider config from AI_PROVIDERS
 * @param {string} apiKey - User's API key
 * @returns {object} Headers object
 */
export function buildHeaders(provider, apiKey) {
  const headers = { 'Content-Type': 'application/json' };

  if (provider.authType === 'bearer' && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider.authType === 'x-api-key' && apiKey) {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }

  return headers;
}

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 8192;

/** Temperature to send: 0 is a valid value, only null/undefined/NaN fall back */
function effectiveTemperature(temperature) {
  return Number.isFinite(temperature) ? temperature : DEFAULT_TEMPERATURE;
}

/**
 * Build request body for a given provider format
 * @param {object} options
 * @param {string} options.format - 'openai', 'anthropic' or 'bedrock'
 * @param {string} options.systemPrompt
 * @param {string} options.userPrompt
 * @param {string} options.model
 * @param {number} options.temperature
 * @param {number} options.maxTokens
 * @param {boolean} options.stream
 * @param {{name: string, description: string, schema: object}|null} [options.schema] -
 *   structured output: json_schema response_format (OpenAI format), a forced tool
 *   (Anthropic, Bedrock Converse)
 * @returns {object} Request body
 */
export function buildRequestBody({
  format,
  systemPrompt,
  userPrompt,
  model,
  temperature,
  maxTokens,
  stream,
  schema,
}) {
  if (format === 'anthropic') {
    return {
      model: model || 'claude-sonnet-5-5',
      max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
      temperature: effectiveTemperature(temperature),
      stream: stream || false,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      ...(schema
        ? {
            tools: [
              { name: schema.name, description: schema.description, input_schema: schema.schema },
            ],
            tool_choice: { type: 'tool', name: schema.name },
          }
        : {}),
    };
  }

  if (format === 'bedrock') {
    return {
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: userPrompt }] }],
      inferenceConfig: {
        temperature: effectiveTemperature(temperature),
        maxTokens: maxTokens || DEFAULT_MAX_TOKENS,
      },
      ...(schema
        ? {
            toolConfig: {
              tools: [
                {
                  toolSpec: {
                    name: schema.name,
                    description: schema.description,
                    inputSchema: { json: schema.schema },
                  },
                },
              ],
              toolChoice: { tool: { name: schema.name } },
            },
          }
        : {}),
    };
  }

  // OpenAI-compatible format (default)
  // GPT-6 and OpenAI reasoning models (o3, o4+) only accept temperature=1 (the API default).
  // Omit temperature for those models to avoid invalid_request_error.
  const isReasoningModel = model && (model.startsWith('gpt-6') || /^o\d/.test(model));
  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...(isReasoningModel || !Number.isFinite(temperature) ? {} : { temperature }),
    max_completion_tokens: maxTokens || DEFAULT_MAX_TOKENS,
    stream: stream || false,
    ...(schema
      ? {
          response_format: {
            type: 'json_schema',
            json_schema: { name: schema.name, strict: true, schema: schema.schema },
          },
        }
      : {}),
  };

  if (model) {
    body.model = model;
  }

  return body;
}

/** True when the model stopped because it ran out of output tokens */
export function isTruncatedStop(stopReason) {
  return stopReason === 'length' || stopReason === 'max_tokens';
}

/**
 * AI errors are { code, detail }: `code` is translated by aiErrorKey
 * (connection, timeout, api, invalidResponse, parse, empty, generic) and `detail`
 * is the technical text shown under "Technical details". Same shape as electron/aiProviders.mjs.
 */
export function aiError(code, detail = '') {
  return { code, detail: String(detail || '') };
}

/** Error of a fetch() that threw (timeout, refused connection...) */
export function fetchErrorToAi(err, endpoint) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return aiError('timeout', `${err.message} (${endpoint})`);
  }
  const code = err?.code || err?.cause?.code;
  // Browsers throw a TypeError ("Failed to fetch") for refused connections and CORS
  if (
    ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'].includes(code) ||
    err?.message === 'fetch failed' ||
    err?.name === 'TypeError'
  ) {
    return aiError('connection', `${code || err.message} (${endpoint})`);
  }
  return aiError('generic', err?.message || String(err));
}

/** Error of an HTTP response that is not ok */
export async function responseErrorToAi(response) {
  const errorText = await response.text().catch(() => '');
  return aiError('api', `HTTP ${response.status}: ${errorText || response.statusText}`);
}

const AI_ERROR_KEYS = {
  connection: 'aiErrorConnection',
  timeout: 'aiErrorTimeout',
  api: 'aiErrorApi',
  invalidResponse: 'aiErrorInvalidResponse',
  parse: 'aiErrorParse',
  empty: 'aiErrorEmpty',
  truncated: 'aiErrorTruncated',
  noRom: 'aiNoRom',
};

/** i18n key of an AI error ({ code } or, from older builds, a plain message) */
export function aiErrorKey(error) {
  if (error && typeof error === 'object') return AI_ERROR_KEYS[error.code] || 'aiErrorGeneric';
  const s = String(error || '');
  if (/Connection refused|fetch failed|Failed to fetch/i.test(s)) return 'aiErrorConnection';
  if (/timed out/i.test(s)) return 'aiErrorTimeout';
  if (/JSON parse/i.test(s)) return 'aiErrorParse';
  if (/API error/i.test(s)) return 'aiErrorApi';
  return 'aiErrorGeneric';
}

/** Technical text of an AI error (not translated) */
export function aiErrorDetail(error) {
  if (error && typeof error === 'object') return error.detail || error.code || '';
  return String(error || '');
}

/**
 * Parse a non-streaming response based on provider format.
 * A forced tool call (structured output) comes back as its JSON input, as text.
 * @param {object} data - Parsed JSON response
 * @param {string} format - 'openai', 'anthropic' or 'bedrock'
 * @returns {{ content: string|null, usage: object|null, stopReason?: string|null, error: {code: string, detail: string}|null }}
 */
export function parseResponse(data, format) {
  if (format === 'anthropic') {
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      return {
        content: null,
        usage: null,
        error: aiError('invalidResponse', 'Claude: no content'),
      };
    }
    const toolBlock = data.content.find((b) => b.type === 'tool_use');
    const textBlock = data.content.find((b) => b.type === 'text');
    if (!toolBlock && !textBlock) {
      return {
        content: null,
        usage: null,
        error: aiError('invalidResponse', 'Claude: no text block'),
      };
    }
    return {
      content: toolBlock ? JSON.stringify(toolBlock.input) : textBlock.text,
      usage: data.usage || null,
      stopReason: data.stop_reason || null,
      error: null,
    };
  }

  if (format === 'bedrock') {
    // Bedrock Converse response: { output: { message: { content: [{text: "..."}] } }, usage: {...} }
    const message = data.output?.message;
    if (!message || !message.content || message.content.length === 0) {
      return {
        content: null,
        usage: null,
        error: aiError('invalidResponse', 'Bedrock: no content'),
      };
    }
    const toolBlock = message.content.find((b) => b.toolUse);
    const textBlock = message.content.find((b) => b.text);
    if (!toolBlock && !textBlock) {
      return {
        content: null,
        usage: null,
        error: aiError('invalidResponse', 'Bedrock: no text block'),
      };
    }
    return {
      content: toolBlock ? JSON.stringify(toolBlock.toolUse.input) : textBlock.text,
      usage: data.usage || null,
      stopReason: data.stopReason || null,
      error: null,
    };
  }

  // OpenAI format
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    return {
      content: null,
      usage: null,
      error: aiError('invalidResponse', 'no choices[0].message'),
    };
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage || null,
    stopReason: data.choices[0].finish_reason || null,
    error: null,
  };
}

/**
 * Parse a streaming chunk based on provider format.
 * A chunk can carry content AND be the last one (OpenAI-compatible servers often send
 * the last token with finish_reason): use `content` before stopping on `done`.
 * Structured output streams as JSON text: Anthropic `input_json_delta`, Bedrock
 * `toolUse.input`.
 * @param {string} line - A single SSE data line (without the "data: " prefix)
 * @param {string} format - 'openai', 'anthropic' or 'bedrock'
 * @returns {{ content: string|null, done: boolean, stopReason: string|null, error: object|null }}
 */
export function parseStreamChunk(line, format) {
  const none = { content: null, done: false, stopReason: null, error: null };
  if (!line || line === '[DONE]') {
    return { ...none, done: true };
  }

  try {
    const parsed = JSON.parse(line);

    if (format === 'anthropic') {
      // Anthropic streaming events
      if (parsed.type === 'content_block_delta') {
        const delta = parsed.delta || {};
        return { ...none, content: delta.text ?? delta.partial_json ?? null };
      }
      if (parsed.type === 'message_delta') {
        return { ...none, stopReason: parsed.delta?.stop_reason || null };
      }
      if (parsed.type === 'message_stop') {
        return { ...none, done: true };
      }
      if (parsed.type === 'error') {
        return {
          ...none,
          done: true,
          error: aiError('api', parsed.error?.message || JSON.stringify(parsed.error || parsed)),
        };
      }
      return none;
    }

    if (format === 'bedrock') {
      // Bedrock ConverseStream events
      if (parsed.contentBlockDelta) {
        const delta = parsed.contentBlockDelta.delta || {};
        return { ...none, content: delta.text ?? delta.toolUse?.input ?? null };
      }
      if (parsed.messageStop) {
        return { ...none, done: true, stopReason: parsed.messageStop.stopReason || null };
      }
      return none;
    }

    // OpenAI format
    if (parsed.error) {
      return {
        ...none,
        done: true,
        error: aiError('api', parsed.error.message || JSON.stringify(parsed.error)),
      };
    }
    const content = parsed.choices?.[0]?.delta?.content;
    const finishReason = parsed.choices?.[0]?.finish_reason || null;
    return {
      ...none,
      content: content || null,
      done: finishReason != null,
      stopReason: finishReason,
    };
  } catch (_e) {
    return none;
  }
}

/**
 * Read a Server-Sent Events body (OpenAI / Anthropic streaming).
 * Calls onContent(text) for every piece of text; resolves { stopReason, error }.
 * Same as readSseStream in electron/aiProviders.mjs.
 */
export async function readSseStream(body, format, onContent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let stopReason = null;
  let error = null;

  // true when the stream is over
  const handleLine = (line) => {
    const trimmed = line.trim();
    // "event:" lines (Anthropic) and comments carry nothing we need
    if (!trimmed.startsWith('data:')) return false;
    const chunk = parseStreamChunk(trimmed.slice(5).trim(), format);
    if (chunk.content) onContent(chunk.content);
    if (chunk.stopReason) stopReason = chunk.stopReason;
    if (chunk.error) error = chunk.error;
    return chunk.done;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (handleLine(line)) {
        reader.cancel().catch(() => {});
        return { stopReason, error };
      }
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
  return { stopReason, error };
}

/**
 * Get the effective endpoint URL for a provider
 * @param {object} provider - Provider config
 * @param {string} customEndpoint - User-provided custom endpoint
 * @param {string} [model] - Model ID (needed for Bedrock URL construction)
 * @returns {string}
 */
export function getEffectiveEndpoint(provider, customEndpoint, model, stream) {
  if (provider.id === 'bedrock') {
    // Bedrock Converse API: https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/converse
    const baseUrl =
      customEndpoint && customEndpoint.includes('bedrock-runtime')
        ? customEndpoint
        : provider.endpoint;
    const modelId = model || 'amazon.nova-lite-v1:0';
    const action = stream ? 'converse-stream' : 'converse';
    return `${baseUrl}/model/${modelId}/${action}`;
  }
  if (provider.endpointEditable && customEndpoint) {
    return customEndpoint;
  }
  return provider.endpoint;
}

/**
 * Build Bedrock base URL from a region string
 * @param {string} region - e.g. 'us-east-1'
 * @returns {string}
 */
export function buildBedrockEndpoint(region) {
  return `https://bedrock-runtime.${region}.amazonaws.com`;
}
