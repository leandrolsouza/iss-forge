/**
 * AI Provider Definitions (ESM) — used by Electron main process.
 *
 * Mirror of src/services/aiProviders.js but as ESM
 * for use in the Electron main process.
 */

const AI_PROVIDERS = {
  openai: {
    id: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    authType: 'bearer',
    format: 'openai',
  },
  claude: {
    id: 'claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    authType: 'x-api-key',
    format: 'anthropic',
  },
  gemini: {
    id: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    authType: 'bearer',
    format: 'openai',
  },
  grok: {
    id: 'grok',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    authType: 'bearer',
    format: 'openai',
  },
  bedrock: {
    id: 'bedrock',
    endpoint: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    authType: 'bearer',
    format: 'bedrock',
    defaultModel: 'amazon.nova-lite-v1:0',
  },
  'openai-compatible': {
    id: 'openai-compatible',
    endpoint: 'http://localhost:1234/v1/chat/completions',
    authType: 'bearer',
    format: 'openai',
  },
};

/**
 * Get provider config by ID
 */
function getProvider(providerId) {
  return AI_PROVIDERS[providerId] || AI_PROVIDERS['openai-compatible'];
}

/**
 * Get effective endpoint — uses custom endpoint for openai-compatible, otherwise provider's default
 */
function getEffectiveEndpoint(provider, customEndpoint, model, stream) {
  if (provider.id === 'bedrock') {
    const baseUrl =
      customEndpoint && customEndpoint.includes('bedrock-runtime')
        ? customEndpoint
        : provider.endpoint;
    const modelId = model || provider.defaultModel || 'amazon.nova-lite-v1:0';
    const action = stream ? 'converse-stream' : 'converse';
    return `${baseUrl}/model/${modelId}/${action}`;
  }
  if (provider.id === 'openai-compatible' && customEndpoint) {
    return customEndpoint;
  }
  return provider.endpoint;
}

/**
 * Build request headers based on provider auth type
 */
function buildHeaders(provider, apiKey) {
  const headers = { 'Content-Type': 'application/json' };

  if (provider.authType === 'bearer' && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider.authType === 'x-api-key' && apiKey) {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }

  return headers;
}

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 8192;

/** Temperature to send: 0 is a valid value, only null/undefined/NaN fall back */
function effectiveTemperature(temperature) {
  return Number.isFinite(temperature) ? temperature : DEFAULT_TEMPERATURE;
}

/**
 * Build request body based on provider format.
 * `schema` ({ name, description, schema }) asks for structured output: json_schema
 * response_format (OpenAI format), a forced tool (Anthropic, Bedrock Converse).
 */
function buildRequestBody({
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
function isTruncatedStop(stopReason) {
  return stopReason === 'length' || stopReason === 'max_tokens';
}

/**
 * AI errors are { code, detail }: the renderer translates `code`
 * (connection, timeout, api, invalidResponse, parse, empty, generic) and shows
 * `detail` (technical text, not translated) under "Technical details".
 */
function aiError(code, detail = '') {
  return { code, detail: String(detail || '') };
}

/** Error of a fetch() that threw (timeout, refused connection...) */
function fetchErrorToAi(err, endpoint) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return aiError('timeout', `${err.message} (${endpoint})`);
  }
  const code = err?.code || err?.cause?.code;
  if (
    ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'].includes(code) ||
    err?.message === 'fetch failed'
  ) {
    return aiError('connection', `${code || err.message} (${endpoint})`);
  }
  return aiError('generic', err?.message || String(err));
}

/** Error of an HTTP response that is not ok */
async function responseErrorToAi(response) {
  const errorText = await response.text().catch(() => '');
  return aiError('api', `HTTP ${response.status}: ${errorText || response.statusText}`);
}

/**
 * Parse a non-streaming response based on format.
 * A forced tool call (structured output) comes back as its JSON input, as text.
 */
function parseResponse(data, format) {
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
 * Parse a streaming SSE line based on format.
 * For Anthropic, events come as "event: <type>\ndata: <json>"
 * For OpenAI, events come as "data: <json>" or "data: [DONE]"
 *
 * Returns { content, done, stopReason, error }. A chunk can carry content AND be the
 * last one (OpenAI-compatible servers often send the last token with finish_reason):
 * callers must use `content` before stopping on `done`.
 * Structured output streams as JSON text: Anthropic `input_json_delta`, Bedrock
 * `toolUse.input`.
 */
function parseStreamChunk(line, format) {
  const none = { content: null, done: false, stopReason: null, error: null };
  if (!line || line === '[DONE]') {
    return { ...none, done: true };
  }

  try {
    const parsed = JSON.parse(line);

    if (format === 'anthropic') {
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
 */
async function readSseStream(body, format, onContent) {
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
    // Keep last incomplete line in buffer
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
 * Read a Bedrock ConverseStream body (AWS Event Stream binary protocol).
 * Each message: [4B total_len][4B header_len][4B prelude_crc][headers][payload][4B crc].
 * Payloads are flat: {delta:{text}} / {delta:{toolUse:{input}}} / {stopReason} /
 * {message} for exceptions. Resolves { stopReason, error }.
 */
async function readBedrockEventStream(body, onContent) {
  const reader = body.getReader();
  let eventBuffer = Buffer.alloc(0);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    eventBuffer = Buffer.concat([eventBuffer, Buffer.from(value)]);

    while (eventBuffer.length >= 12) {
      const totalLength = eventBuffer.readUInt32BE(0);
      if (totalLength < 16 || totalLength > 1048576) {
        eventBuffer = eventBuffer.subarray(1);
        continue;
      }
      if (eventBuffer.length < totalLength) break;

      const frame = eventBuffer.subarray(0, totalLength);
      eventBuffer = eventBuffer.subarray(totalLength);

      const headerLength = frame.readUInt32BE(4);
      const payloadStart = 12 + headerLength;
      const payloadEnd = totalLength - 4;
      if (payloadStart >= payloadEnd) continue;

      let jsonStr = frame.subarray(payloadStart, payloadEnd).toString('utf-8');
      // Trim any trailing null bytes or garbage
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace >= 0) jsonStr = jsonStr.substring(0, lastBrace + 1);

      let evt;
      try {
        evt = JSON.parse(jsonStr);
      } catch (_e) {
        continue;
      }
      const text = evt.delta?.text ?? evt.delta?.toolUse?.input;
      if (text) {
        onContent(text);
      } else if (evt.stopReason || evt.messageStop) {
        reader.cancel().catch(() => {});
        return { stopReason: evt.stopReason || evt.messageStop?.stopReason || null, error: null };
      } else if (typeof evt.message === 'string' && !evt.role) {
        // exception frame (throttling, validation, model errors...)
        reader.cancel().catch(() => {});
        return { stopReason: null, error: aiError('api', `Bedrock: ${evt.message}`) };
      }
    }
  }
  return { stopReason: null, error: null };
}

export {
  AI_PROVIDERS,
  DEFAULT_MAX_TOKENS,
  aiError,
  fetchErrorToAi,
  responseErrorToAi,
  getProvider,
  getEffectiveEndpoint,
  buildHeaders,
  buildRequestBody,
  isTruncatedStop,
  parseResponse,
  parseStreamChunk,
  readSseStream,
  readBedrockEventStream,
};
