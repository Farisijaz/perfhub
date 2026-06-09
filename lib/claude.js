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
    // Remove trailing comma if present
    fixed = fixed.replace(/,\s*$/, '')
    // Close open arrays first, then objects
    for (let i = 0; i < openBrackets; i++) fixed += ']'
    for (let i = 0; i < openBraces; i++) fixed += '}'
    return JSON.parse(fixed)
  } catch {}

  return null
}
