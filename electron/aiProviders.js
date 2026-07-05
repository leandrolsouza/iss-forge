/**
 * AI Provider Definitions (CommonJS) — used by Electron main process.
 *
 * Mirror of src/services/aiProviders.js but in CommonJS format
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

/**
 * Build request body based on provider format
 */
function buildRequestBody({ format, systemPrompt, userPrompt, model, temperature, maxTokens, stream }) {
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
 * Parse a non-streaming response based on format
 */
function parseResponse(data, format) {
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
 * Parse a streaming SSE line based on format.
 * For Anthropic, events come as "event: <type>\ndata: <json>"
 * For OpenAI, events come as "data: <json>" or "data: [DONE]"
 */
function parseStreamChunk(line, format) {
  if (!line || line === '[DONE]') {
    return { content: null, done: true };
  }

  try {
    const parsed = JSON.parse(line);

    if (format === 'anthropic') {
      if (parsed.type === 'content_block_delta') {
        return { content: parsed.delta?.text || null, done: false };
      }
      if (parsed.type === 'message_stop') {
        return { content: null, done: true };
      }
      return { content: null, done: false };
    }

    if (format === 'bedrock') {
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

module.exports = {
  AI_PROVIDERS,
  getProvider,
  getEffectiveEndpoint,
  buildHeaders,
  buildRequestBody,
  parseResponse,
  parseStreamChunk,
};
