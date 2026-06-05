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
      max_tokens: 2000,
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
  try {
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    return JSON.parse(clean)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) { try { return JSON.parse(m[0]) } catch {} }
    return null
  }
}
