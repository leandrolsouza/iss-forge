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
      { id: 'gpt-5.5', name: 'GPT-5.5' },
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5.2', name: 'GPT-5.2' },
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
    ],
    defaultModel: 'gpt-4o-mini',
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
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
      { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-0', name: 'Claude Opus 4' },
    ],
    defaultModel: 'claude-sonnet-4-6',
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
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.0-flash', name: 'Gemini 3 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
    defaultModel: 'gemini-2.5-flash',
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
      { id: 'grok-4.3', name: 'Grok 4.3 (Latest)' },
      { id: 'grok-4', name: 'Grok 4' },
      { id: 'grok-420-reasoning', name: 'Grok 420 Reasoning' },
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-3-mini', name: 'Grok 3 Mini' },
    ],
    defaultModel: 'grok-3-mini',
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

/**
 * Build request body for a given provider format
 * @param {object} options
 * @param {string} options.format - 'openai' or 'anthropic'
 * @param {string} options.systemPrompt
 * @param {string} options.userPrompt
 * @param {string} options.model
 * @param {number} options.temperature
 * @param {number} options.maxTokens
 * @param {boolean} options.stream
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
}) {
  if (format === 'anthropic') {
    return {
      model: model || 'claude-sonnet-4-6',
      max_tokens: maxTokens || 4096,
      temperature: temperature || 0.7,
      stream: stream || false,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };
  }

  if (format === 'bedrock') {
    return {
      system: [{ text: systemPrompt }],
      messages: [
        { role: 'user', content: [{ text: userPrompt }] },
      ],
      inferenceConfig: {
        temperature: temperature || 0.7,
        maxTokens: maxTokens || 4096,
      },
    };
  }

  // OpenAI-compatible format (default)
  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: temperature || 0.7,
    max_tokens: maxTokens || 4096,
    stream: stream || false,
  };

  if (model) {
    body.model = model;
  }

  return body;
}

/**
 * Parse a non-streaming response based on provider format
 * @param {object} data - Parsed JSON response
 * @param {string} format - 'openai' or 'anthropic'
 * @returns {{ content: string|null, usage: object|null, error: string|null }}
 */
export function parseResponse(data, format) {
  if (format === 'anthropic') {
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      return { content: null, usage: null, error: 'Invalid response format from Claude' };
    }
    const textBlock = data.content.find((b) => b.type === 'text');
    if (!textBlock) {
      return { content: null, usage: null, error: 'No text content in Claude response' };
    }
    return {
      content: textBlock.text,
      usage: data.usage || null,
      error: null,
    };
  }

  if (format === 'bedrock') {
    // Bedrock Converse response: { output: { message: { content: [{text: "..."}] } }, usage: {...} }
    const message = data.output?.message;
    if (!message || !message.content || message.content.length === 0) {
      return { content: null, usage: null, error: 'Invalid response format from Bedrock' };
    }
    const textBlock = message.content.find((b) => b.text);
    if (!textBlock) {
      return { content: null, usage: null, error: 'No text content in Bedrock response' };
    }
    return {
      content: textBlock.text,
      usage: data.usage || null,
      error: null,
    };
  }

  // OpenAI format
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    return { content: null, usage: null, error: 'Invalid response format from LLM' };
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage || null,
    error: null,
  };
}

/**
 * Parse a streaming chunk based on provider format
 * @param {string} line - A single SSE data line (without the "data: " prefix)
 * @param {string} format - 'openai' or 'anthropic'
 * @returns {{ content: string|null, done: boolean }}
 */
export function parseStreamChunk(line, format) {
  if (!line || line === '[DONE]') {
    return { content: null, done: true };
  }

  try {
    const parsed = JSON.parse(line);

    if (format === 'anthropic') {
      // Anthropic streaming events
      if (parsed.type === 'content_block_delta') {
        return { content: parsed.delta?.text || null, done: false };
      }
      if (parsed.type === 'message_stop') {
        return { content: null, done: true };
      }
      return { content: null, done: false };
    }

    if (format === 'bedrock') {
      // Bedrock ConverseStream events
      if (parsed.contentBlockDelta) {
        return { content: parsed.contentBlockDelta.delta?.text || null, done: false };
      }
      if (parsed.messageStop) {
        return { content: null, done: true };
      }
      return { content: null, done: false };
    }

    // OpenAI format
    const content = parsed.choices?.[0]?.delta?.content;
    const finishReason = parsed.choices?.[0]?.finish_reason;
    return { content: content || null, done: finishReason === 'stop' };
  } catch (_e) {
    return { content: null, done: false };
  }
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
