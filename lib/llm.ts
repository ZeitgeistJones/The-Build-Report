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
  /**
   * Gemini-only retry: if the first reply fails this check, retry without thinking
   * and with a higher token cap. Does not call Anthropic.
   */
  usable?: (text: string) => boolean
}

export type GenerateTextResult = {
  text: string
  provider: LlmProvider
}

/** Google retired 2.5-flash for new API keys; 3.6-flash is the current flash default. */
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'
const RETIRED_GEMINI_MODELS = ['gemini-2.5-flash', 'models/gemini-2.5-flash']
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

function isGeminiQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('"code":429') ||
    message.includes('exceeded your current quota') ||
    message.includes('GenerateRequestsPerDayPerProjectPerModel') ||
    message.includes('free_tier_requests')
  )
}

/** Primary + optional backup keys. Dedupe so the same value isn't tried twice. */
function geminiApiKeys(): string[] {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ]
  const seen = new Set<string>()
  const keys: string[] = []
  for (const value of raw) {
    const key = value?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

function geminiApiKey(): string | undefined {
  return geminiApiKeys()[0]
}

function anthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined
}

/** True when either Anthropic (primary) or Gemini (fallback) is configured. */
export function hasLlmApiKey(): boolean {
  return Boolean(anthropicApiKey() || geminiApiKey())
}

function geminiModel(): string {
  const requested = process.env.GEMINI_MODEL?.trim()
  if (!requested) return DEFAULT_GEMINI_MODEL
  const bare = requested.replace(/^models\//, '')
  if (RETIRED_GEMINI_MODELS.includes(requested) || RETIRED_GEMINI_MODELS.includes(bare)) {
    console.warn(
      `[gemini] ${requested} is retired for new API keys; using ${DEFAULT_GEMINI_MODEL}`,
    )
    return DEFAULT_GEMINI_MODEL
  }
  return requested
}

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL
}

type GeminiPart = { text?: string; thought?: boolean }

function thinkingConfigFor(model: string, mode: 'auto' | 'off'): Record<string, unknown> | undefined {
  if (mode === 'off') return undefined
  // 2.x uses thinkingBudget; 3.x uses thinkingLevel. Wrong field → API 400.
  if (model.includes('2.5') || model.includes('2.0') || model.includes('1.5')) {
    return { thinkingBudget: 0 }
  }
  if (model.includes('3')) {
    return { thinkingLevel: ThinkingLevel.MINIMAL }
  }
  return undefined
}

function extractGeminiText(response: {
  text?: string
  candidates?: Array<{
    finishReason?: string
    content?: { parts?: GeminiPart[] }
  }>
}): { text: string; finishReason?: string } {
  const finishReason = response.candidates?.[0]?.finishReason
  let direct = ''
  try {
    direct = (response.text ?? '').trim()
  } catch {
    direct = ''
  }
  if (direct) return { text: direct, finishReason }
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .filter(p => typeof p.text === 'string' && p.thought !== true)
    .map(p => p.text as string)
    .join('')
    .trim()
  return { text, finishReason }
}

async function generateWithGeminiOnce(
  opts: GenerateTextOptions,
  apiKey: string,
  thinking: 'auto' | 'off',
  maxTokens?: number,
): Promise<string> {
  const model = geminiModel()
  const thinkingConfig = thinkingConfigFor(model, thinking)
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: opts.prompt,
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      ...(maxTokens != null ? { maxOutputTokens: maxTokens } : {}),
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  })

  const { text, finishReason } = extractGeminiText(response)
  if (!text) {
    throw new Error(
      finishReason
        ? `Gemini returned empty text (finishReason=${finishReason})`
        : 'Gemini returned empty text',
    )
  }
  return text
}

async function generateWithGeminiKey(
  opts: GenerateTextOptions,
  apiKey: string,
  keyIndex: number,
): Promise<string> {
  const label = opts.label ?? 'gemini'
  const keyLabel = keyIndex === 0 ? 'primary' : `backup#${keyIndex}`
  const firstMax = opts.maxTokens
  const retryMax = Math.min(Math.max(opts.maxTokens ?? 2048, 8192), 16384)
  const accept = (text: string) => !opts.usable || opts.usable(text)

  try {
    const text = await generateWithGeminiOnce(opts, apiKey, 'auto', firstMax)
    if (accept(text)) return text
    console.warn(`[${label}] Gemini (${keyLabel}) output unusable; retrying without thinking`)
  } catch (err) {
    if (isGeminiQuotaError(err)) throw err
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('"code":404') || message.includes('NOT_FOUND') || message.includes('no longer available')) {
      throw err
    }
    console.warn(`[${label}] Gemini (${keyLabel}) first attempt failed; retrying without thinking:`, err)
  }
  return generateWithGeminiOnce(opts, apiKey, 'off', retryMax)
}

async function generateWithGemini(opts: GenerateTextOptions): Promise<string> {
  const label = opts.label ?? 'gemini'
  const keys = geminiApiKeys()
  if (!keys.length) throw new Error('GEMINI_API_KEY is not set')

  let lastErr: unknown
  for (let i = 0; i < keys.length; i++) {
    try {
      return await generateWithGeminiKey(opts, keys[i], i)
    } catch (err) {
      lastErr = err
      if (isGeminiQuotaError(err) && i < keys.length - 1) {
        console.warn(`[${label}] Gemini key ${i === 0 ? 'primary' : `backup#${i}`} quota exhausted; trying next key`)
        continue
      }
      throw err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
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

/** True when Gemini is configured (used for Gemini-only surfaces). */
export function hasGeminiApiKey(): boolean {
  return geminiApiKeys().length > 0
}

/**
 * Generate text with Gemini only — never Anthropic.
 * Used for CLAWD homepage Yesterday's Build + The Needle.
 * Rotates GEMINI_API_KEY → GEMINI_API_KEY_2 on quota errors.
 */
export async function generateTextGeminiOnly(opts: GenerateTextOptions): Promise<GenerateTextResult> {
  const label = opts.label ?? 'llm-gemini'
  if (!hasGeminiApiKey()) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  try {
    const text = await generateWithGemini(opts)
    return { text, provider: 'gemini' }
  } catch (err) {
    console.error(`[${label}] Gemini-only generation failed:`, err)
    throw err
  }
}

/**
 * Gemini first, Anthropic Haiku fallback — for high-volume cheap surfaces
 * (Yesterday's Builds / secondary digests).
 */
export async function generateTextGeminiFirst(opts: GenerateTextOptions): Promise<GenerateTextResult> {
  const label = opts.label ?? 'llm'
  const anthropicKey = anthropicApiKey()

  if (!anthropicKey && !hasGeminiApiKey()) {
    throw new Error('No LLM API key configured (ANTHROPIC_API_KEY or GEMINI_API_KEY)')
  }

  if (hasGeminiApiKey()) {
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

/**
 * Generate text with Anthropic Haiku as primary and Gemini as fallback.
 * Falls back when Anthropic is unset or the Anthropic call fails.
 * Gemini itself rotates GEMINI_API_KEY → GEMINI_API_KEY_2 on quota errors.
 */
export async function generateText(opts: GenerateTextOptions): Promise<GenerateTextResult> {
  const label = opts.label ?? 'llm'
  const anthropicKey = anthropicApiKey()

  if (!anthropicKey && !hasGeminiApiKey()) {
    throw new Error('No LLM API key configured (ANTHROPIC_API_KEY or GEMINI_API_KEY)')
  }

  if (anthropicKey) {
    try {
      const text = await generateWithAnthropic(opts)
      return { text, provider: 'anthropic' }
    } catch (err) {
      if (!hasGeminiApiKey()) throw err
      console.warn(`[${label}] Anthropic failed; falling back to Gemini:`, err)
    }
  }

  const text = await generateWithGemini(opts)
  return { text, provider: 'gemini' }
}
