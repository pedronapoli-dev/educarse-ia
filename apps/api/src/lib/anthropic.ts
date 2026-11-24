import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
export const MODEL = 'claude-sonnet-4-6'

export const generateFromPdf = async (
  systemPrompt: string,
  userPrompt: string,
  pdfBase64: string,
  maxTokens = 8192
): Promise<string> => {
  // Document block for native PDF parsing — SDK 0.24.x doesn't type this, cast via unknown.
  const documentBlock = {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
  } as unknown as Anthropic.Messages.TextBlockParam

  const message = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: [documentBlock, { type: 'text', text: userPrompt }] }],
    },
    { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } }
  )
  logUsage('generateFromPdf', message.usage)
  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Resposta inesperada da API')
  return stripCodeFences(block.text)
}

export const parseJsonResponse = <T>(response: string, label: string): T => {
  try { return JSON.parse(response) as T }
  catch { throw new Error(`Falha ao parsear ${label} da IA. Tente novamente.`) }
}

export const generate = async (
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096
): Promise<string> => {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  logUsage('generate', message.usage)
  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Resposta inesperada da API')
  return stripCodeFences(block.text)
}

// Agentic loop with tool_use support.
// Each tool call re-sends the full conversation — use sparingly.
// maxIterations caps the number of round-trips to control cost.
export const generateWithTools = async (
  systemPrompt: string,
  userPrompt: string,
  tools: Anthropic.Tool[],
  toolExecutor: (name: string, input: unknown) => Promise<unknown>,
  maxTokens: number,
  maxIterations = 4
): Promise<string> => {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ]

  for (let i = 0; i < maxIterations; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools,
      messages,
    })
    logUsage(`generateWithTools:iter${i + 1}`, response.usage)

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('Resposta inesperada da API')
      return stripCodeFences(textBlock.text)
    }

    if (response.stop_reason !== 'tool_use') break

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    const results = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const output = await toolExecutor(block.name, block.input)
        return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(output) }
      })
    )

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: results })
  }

  throw new Error('generateWithTools: limite de iterações atingido sem resposta final')
}

const logUsage = (label: string, usage: Anthropic.Usage): void => {
  const cost = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000
  console.info(`[AI] ${label} — in: ${usage.input_tokens} | out: ${usage.output_tokens} | ~$${cost.toFixed(5)}`)

  // Fire-and-forget: persiste no banco para o dashboard de auditoria.
  // Falhas são silenciosas — nunca bloqueiam a resposta ao usuário.
  supabase.from('token_usage_log').insert({
    operation:     label,
    model:         MODEL,
    input_tokens:  usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd:      cost,
  }).then(
    ({ error }) => { if (error) console.warn('[AI] logUsage DB error:', error.message) },
    (err: unknown) => { console.warn('[AI] logUsage insert failed:', err) },
  )
}

const stripCodeFences = (text: string): string => {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  if (stripped !== text.trim() && looksLikeJSON(stripped)) return stripped

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) return fenceMatch[1].trim()

  const objStart = text.indexOf('{')
  const arrStart = text.indexOf('[')

  if (objStart === -1 && arrStart === -1) return text.trim()

  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    const lastBracket = text.lastIndexOf(']')
    if (lastBracket > arrStart) return text.slice(arrStart, lastBracket + 1)
  }

  if (objStart !== -1) {
    const lastBrace = text.lastIndexOf('}')
    if (lastBrace > objStart) return text.slice(objStart, lastBrace + 1)
  }

  return text.trim()
}

const looksLikeJSON = (text: string): boolean => {
  const t = text.trimStart()
  return t.startsWith('{') || t.startsWith('[')
}
