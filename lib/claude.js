// This runs SERVER-SIDE ONLY via Next.js API routes
// The ANTHROPIC_API_KEY never reaches the browser

export async function callClaude({ systemPrompt, userPrompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
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

// Web search enabled version — Claude searches the web before responding
// Used for market audit, competitor intel, strategy, and account audit agents
export async function callClaudeWithSearch({ systemPrompt, userPrompt, maxTokens = 8000 }) {
  // Web search adds latency - use reduced tokens to stay within Vercel timeout
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        }
      ],
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Anthropic API error ${res.status}`)
  }

  const data = await res.json()

  // Web search responses can have tool_use, tool_result, and text blocks
  // We need to find the LAST text block which contains the final JSON response
  const textBlocks = data.content
    ?.filter(b => b.type === 'text')
    ?.map(b => b.text)

  if (!textBlocks || textBlocks.length === 0) return ''
  
  // Return the last text block - it's the final response after web search
  return textBlocks[textBlocks.length - 1] || ''
}

export function safeJSON(text) {
  if (!text) return null

  // 1. Strip markdown code fences
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

  // 2. Try direct parse
  try { return JSON.parse(clean) } catch {}

  // 3. Extract first { ... } block (handles extra text before/after)
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)) } catch {}
  }

  // 4. Extract first [ ... ] block (for array responses)
  const aStart = clean.indexOf('[')
  const aEnd = clean.lastIndexOf(']')
  if (aStart !== -1 && aEnd !== -1 && aEnd > aStart) {
    try { return JSON.parse(clean.slice(aStart, aEnd + 1)) } catch {}
  }

  // 5. Try to fix truncated JSON by closing open structures
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
