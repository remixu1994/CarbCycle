const REQUIRED_ENV_VARS = ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT'] as const

type RequiredEnvKey = (typeof REQUIRED_ENV_VARS)[number]

type AzureMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type AzureChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | AzureMessageContentPart[]
}

type AzureChatCompletionChoice = {
  message?: {
    content?: string
  }
}

type AzureChatResponse = {
  choices?: AzureChatCompletionChoice[]
}

type AzureStreamChoice = {
  delta?: {
    content?: string | Array<{ type?: string; text?: string }>
  }
}

type AzureStreamChunk = {
  choices?: AzureStreamChoice[]
}

const getEnv = (key: RequiredEnvKey) => process.env[key]?.trim() ?? ''

const azureConfig = {
  endpoint: getEnv('AZURE_OPENAI_ENDPOINT'),
  apiKey: getEnv('AZURE_OPENAI_API_KEY'),
  deployment: getEnv('AZURE_OPENAI_DEPLOYMENT'),
  apiVersion: process.env.AZURE_OPENAI_API_VERSION?.trim() ?? '2024-02-15-preview',
}

export const isAzureConfigured = REQUIRED_ENV_VARS.every((key) => getEnv(key))

const buildUrl = () => {
  const base = azureConfig.endpoint.replace(/\/$/, '')
  const url = new URL(`/openai/deployments/${azureConfig.deployment}/chat/completions`, base)
  url.searchParams.set('api-version', azureConfig.apiVersion)
  return url.toString()
}

const DEFAULT_SYSTEM_PROMPT =
  'You are FitTrack, a carb cycling nutrition assistant. Answer concisely and keep outputs actionable for training.'

const sanitizeMessages = (messages: AzureChatMessage[]) => {
  const normalized = messages.map(normalizeAzureMessage).filter(hasAzureContent)

  if (!normalized.some((message) => message.role === 'system')) {
    normalized.unshift({ role: 'system', content: DEFAULT_SYSTEM_PROMPT })
  }

  return normalized
}

const normalizeAzureMessage = (message: AzureChatMessage): AzureChatMessage => {
  if (typeof message.content === 'string') {
    return { role: message.role, content: message.content?.trim() ?? '' }
  }

  const content = message.content
    .map((part) => {
      if (part.type === 'text') {
        const text = part.text?.trim()
        if (!text) return null
        return { type: 'text', text }
      }
      if (part.type === 'image_url') {
        const url = part.image_url?.url?.trim()
        if (!url) return null
        return { type: 'image_url', image_url: { url } }
      }
      return null
    })
    .filter((part): part is AzureMessageContentPart => Boolean(part))

  return { role: message.role, content }
}

const hasAzureContent = (message: AzureChatMessage) => {
  if (typeof message.content === 'string') {
    return message.content.length > 0
  }
  return message.content.length > 0
}

export const runAzureChatCompletion = async (messages: AzureChatMessage[]): Promise<string | null> => {
  if (!isAzureConfigured) {
    console.warn('[azure-openai] Missing configuration, skipping call.')
    return null
  }

  const payload = {
    messages: sanitizeMessages(messages),
    temperature: 0.3,
    top_p: 0.95,
    max_tokens: 1500,
  }

  const response = await fetch(buildUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': azureConfig.apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`[azure-openai] Request failed (${response.status}): ${errorBody}`)
  }

  const data = (await response.json()) as AzureChatResponse
  const text = data.choices?.[0]?.message?.content?.trim()
  return text && text.length > 0 ? text : null
}

export const streamAzureChatCompletion = async (
  messages: AzureChatMessage[],
  onToken?: (token: string) => void,
): Promise<string> => {
  if (!isAzureConfigured) {
    console.warn('[azure-openai] Missing configuration, skipping stream call.')
    return ''
  }

  const payload = {
    messages: sanitizeMessages(messages),
    temperature: 0.3,
    top_p: 0.95,
    max_tokens: 1500,
    stream: true,
  }

  const response = await fetch(buildUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': azureConfig.apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok || !response.body) {
    const errorBody = await response.text()
    throw new Error(`[azure-openai] Stream request failed (${response.status}): ${errorBody}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let aggregated = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line === ':') continue
      if (line === 'data: [DONE]') {
        return aggregated
      }
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data) continue
      try {
        const chunk = JSON.parse(data) as AzureStreamChunk
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue

        if (Array.isArray(delta.content)) {
          for (const piece of delta.content) {
            const text = typeof piece?.text === 'string' ? piece.text : ''
            if (text) {
              aggregated += text
              onToken?.(text)
            }
          }
          continue
        }

        if (typeof delta.content === 'string' && delta.content.length > 0) {
          aggregated += delta.content
          onToken?.(delta.content)
        }
      } catch (error) {
        console.error('[azure-openai] Failed to parse stream chunk', error, data)
      }
    }
  }

  return aggregated
}

export type { AzureChatMessage, AzureMessageContentPart }
