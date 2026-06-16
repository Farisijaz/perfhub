// This runs SERVER-SIDE ONLY via Next.js API routes
// The ANTHROPIC_API_KEY never reaches the browser

// Model selection by task type:
// Opus 4.5  → only where quality is critical and can't be compromised (strategy, market audit)
// Sonnet 4.6 → default for structured JSON tasks (competitor, creative, tracking)
// Haiku 4.5 → fast cheap tasks (insights, simple lookups)

const MODELS = {
  premium:  'claude-opus-4-5',    // market audit (merged), strategy
  standard: 'claude-sonnet-4-6',  // competitor intel, audit
  fast:     'claude-haiku-4-5-20251001',   // insight, tracking setup
}

export async function callClaude({ systemPrompt, userPrompt, model = MODELS.standard, maxTokens = 3000 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Anthropic API error ${res.status}`)
  }

  const data = await res.json()
  return data.content?.find(b => b.type === 'text')?.text || ''
}

// Web search enabled version
export async function callClaudeWithSearch({ systemPrompt, userPrompt, model = MODELS.standard, maxTokens = 4000 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Anthropic API error ${res.status}`)
  }

  const data = await res.json()
  const textBlocks = data.content?.filter(b => b.type === 'text')?.map(b => b.text)
  if (!textBlocks || textBlocks.length === 0) return ''
  return textBlocks[textBlocks.length - 1] || ''
}

export function safeJSON(text) {
  if (!text) return null
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
  try { return JSON.parse(clean) } catch {}
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)) } catch {}
  }
  const aStart = clean.indexOf('[')
  const aEnd = clean.lastIndexOf(']')
  if (aStart !== -1 && aEnd !== -1 && aEnd > aStart) {
    try { return JSON.parse(clean.slice(aStart, aEnd + 1)) } catch {}
  }
  try {
    let fixed = clean
    const openBraces = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length
    fixed = fixed.replace(/,\s*$/, '')
    for (let i = 0; i < openBrackets; i++) fixed += ']'
    for (let i = 0; i < openBraces; i++) fixed += '}'
    return JSON.parse(fixed)
  } catch {}
  return null
}

export { MODELS }
