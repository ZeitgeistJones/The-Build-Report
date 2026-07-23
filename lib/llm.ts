import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'

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

/** True when either Gemini (primary) or Anthropic (fallback) is configured. */
export function hasLlmApiKey(): boolean {
  return Boolean(geminiApiKey() || anthropicApiKey())
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

  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: geminiModel(),
    contents: opts.prompt,
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      ...(opts.maxTokens != null ? { maxOutputTokens: opts.maxTokens } : {}),
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    },
  })

  const text = (response.text ?? '').trim()
  if (!text) throw new Error('Gemini returned empty text')
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
 * Generate text with Gemini as primary and Anthropic as fallback.
 * Falls back when Gemini is unset or the Gemini call fails.
 */
export async function generateText(opts: GenerateTextOptions): Promise<GenerateTextResult> {
  const label = opts.label ?? 'llm'
  const geminiKey = geminiApiKey()
  const anthropicKey = anthropicApiKey()

  if (!geminiKey && !anthropicKey) {
    throw new Error('No LLM API key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)')
  }

  if (geminiKey) {
    try {
      const text = await generateWithGemini(opts)
      return { text, provider: 'gemini' }
    } catch (err) {
      if (!anthropicKey) throw err
      console.warn(`[${label}] Gemini failed; falling back to Anthropic:`, err)
    }
  }

  const text = await generateWithAnthropic(opts)
  return { text, provider: 'anthropic' }
}
