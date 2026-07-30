import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'

export type LlmProvider = 'gemini' | 'anthropic'

export type GenerateTextOptions = {
  prompt: string
  system?: string
  maxTokens?: number
  temperature?: number
  /** Log label for provider fallback messages. */
  label?: string
}

export type GenerateTextResult = {
  text: string
  provider: LlmProvider
}

/** Prefer a Gemini model with spare free-tier quota; 3.6-flash is often RPD-capped first. */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

function geminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined
  )
}

function anthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined
}

/** True when either Anthropic (primary) or Gemini (fallback) is configured. */
export function hasLlmApiKey(): boolean {
  return Boolean(anthropicApiKey() || geminiApiKey())
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
}

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL
}

async function generateWithGemini(opts: GenerateTextOptions): Promise<string> {
  const apiKey = geminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const model = geminiModel()
  // 2.5 uses thinkingBudget; 3.x uses thinkingLevel. Wrong field → API 400 and a dead fallback.
  const thinkingConfig = model.includes('2.5')
    ? { thinkingBudget: 0 }
    : { thinkingLevel: ThinkingLevel.MINIMAL }

  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: opts.prompt,
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      ...(opts.maxTokens != null ? { maxOutputTokens: opts.maxTokens } : {}),
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      thinkingConfig,
    },
  })

  const text = (response.text ?? '').trim()
  if (!text) {
    const finish = response.candidates?.[0]?.finishReason
    throw new Error(
      finish ? `Gemini returned empty text (finishReason=${finish})` : 'Gemini returned empty text',
    )
  }
  return text
}

async function generateWithAnthropic(opts: GenerateTextOptions): Promise<string> {
  const apiKey = anthropicApiKey()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: anthropicModel(),
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.system ? { system: opts.system } : {}),
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    messages: [{ role: 'user', content: opts.prompt }],
  })

  const text = message.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
  if (!text) throw new Error('Anthropic returned empty text')
  return text
}

/**
 * Generate text with Anthropic Haiku as primary and Gemini as fallback.
 * Falls back when Anthropic is unset or the Anthropic call fails.
 */
export async function generateText(opts: GenerateTextOptions): Promise<GenerateTextResult> {
  const label = opts.label ?? 'llm'
  const anthropicKey = anthropicApiKey()
  const geminiKey = geminiApiKey()

  if (!anthropicKey && !geminiKey) {
    throw new Error('No LLM API key configured (ANTHROPIC_API_KEY or GEMINI_API_KEY)')
  }

  if (anthropicKey) {
    try {
      const text = await generateWithAnthropic(opts)
      return { text, provider: 'anthropic' }
    } catch (err) {
      if (!geminiKey) throw err
      console.warn(`[${label}] Anthropic failed; falling back to Gemini:`, err)
    }
  }

  const text = await generateWithGemini(opts)
  return { text, provider: 'gemini' }
}
