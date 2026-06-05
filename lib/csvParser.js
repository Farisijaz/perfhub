export function parseNum(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(/[$,%\s]/g, '').replace(/,/g, '')) || 0
}

export function findCol(row, ...names) {
  const keys = Object.keys(row)
  for (const name of names) {
    const exact = keys.find(k => k.toLowerCase().trim() === name.toLowerCase())
    if (exact) return exact
    const partial = keys.find(k => k.toLowerCase().includes(name.toLowerCase()))
    if (partial) return partial
  }
  return null
}

export function extractRealRows(rawText) {
  const lines = rawText.split('\n').filter(l => l.trim())
  const known = ['campaign', 'clicks', 'impr', 'cost', 'ctr', 'conversions', 'impressions', 'amount spent']
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase()
    if (known.filter(h => lower.includes(h)).length >= 2) {
      return lines.slice(i).join('\n')
    }
  }
  return rawText
}

export function parseGoogleAds(rows) {
  if (!rows.length) return null
  const t = rows.reduce((acc, row) => ({
    spend:       acc.spend       + parseNum(row[findCol(row, 'cost', 'spend')]),
    clicks:      acc.clicks      + parseNum(row[findCol(row, 'clicks')]),
    impressions: acc.impressions + parseNum(row[findCol(row, 'impr.', 'impressions', 'impr')]),
    conversions: acc.conversions + parseNum(row[findCol(row, 'conversions')]),
    revenue:     acc.revenue     + parseNum(row[findCol(row, 'conv. value', 'conversion value', 'all conv. value')]),
  }), { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 })

  // Calculate ROAS from total conv value / total spend (not average of per-row ROAS)
  let roas = 0
  if (t.spend > 0 && t.revenue > 0) {
    roas = t.revenue / t.spend
  }

  const ctr = t.impressions ? t.clicks / t.impressions * 100 : 0
  const cpc = t.clicks ? t.spend / t.clicks : 0
  const cpm = t.impressions ? t.spend / t.impressions * 1000 : 0
  const cpa = t.conversions ? t.spend / t.conversions : 0
  const convRate = t.clicks ? t.conversions / t.clicks * 100 : 0

  const campaigns = rows.slice(0, 8).map(row => {
    const rowSpend = parseNum(row[findCol(row, 'cost', 'spend')])
    const rowConvValue = parseNum(row[findCol(row, 'conv. value', 'conversion value', 'all conv. value')])
    const rowRoasCol = findCol(row, 'conv. value / cost')
    const rowRoas = rowRoasCol ? parseNum(row[rowRoasCol]) : (rowSpend > 0 && rowConvValue > 0 ? rowConvValue / rowSpend : 0)
    return {
      name: (row[findCol(row, 'campaign')] || 'Campaign').toString().slice(0, 24),
      roas: parseFloat(rowRoas.toFixed(2)),
      spend: rowSpend,
    }
  }).filter(c => c.name && c.name.toLowerCase() !== 'campaign')

  return { totals: t, ctr, cpc, cpm, cpa, roas, convRate, campaigns }
}

export function parseMetaAds(rows) {
  if (!rows.length) return null
  const t = rows.reduce((acc, row) => ({
    spend:       acc.spend       + parseNum(row[findCol(row, 'amount spent', 'spend')]),
    clicks:      acc.clicks      + parseNum(row[findCol(row, 'clicks (all)', 'clicks')]),
    impressions: acc.impressions + parseNum(row[findCol(row, 'impressions')]),
    conversions: acc.conversions + parseNum(row[findCol(row, 'results', 'conversions')]),
    revenue:     acc.revenue     + parseNum(row[findCol(row, 'purchase roas', 'roas', 'conversion value')]),
    frequency:   acc.frequency   + parseNum(row[findCol(row, 'frequency')]),
  }), { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0, frequency: 0 })

  if (t.revenue > 0 && t.revenue < 200) t.revenue = t.revenue * t.spend

  const ctr = t.impressions ? t.clicks / t.impressions * 100 : 0
  const cpc = t.clicks ? t.spend / t.clicks : 0
  const cpm = t.impressions ? t.spend / t.impressions * 1000 : 0
  const cpa = t.conversions ? t.spend / t.conversions : 0
  const roas = t.spend ? t.revenue / t.spend : 0
  const convRate = t.clicks ? t.conversions / t.clicks * 100 : 0
  const frequency = rows.length ? t.frequency / rows.length : 0

  const campaigns = rows.slice(0, 8).map(row => ({
    name: (row[findCol(row, 'campaign name', 'campaign')] || 'Campaign').toString().slice(0, 24),
    roas: parseFloat((parseNum(row[findCol(row, 'purchase roas', 'roas')]) || 0).toFixed(2)),
    spend: parseNum(row[findCol(row, 'amount spent', 'spend')]),
  })).filter(c => c.name && c.name.toLowerCase() !== 'campaign name')

  return { totals: t, ctr, cpc, cpm, cpa, roas, convRate, campaigns, frequency }
}

export function autoDetectPlatform(headers) {
  const h = headers.join(' ').toLowerCase()
  if (h.includes('amount spent') || h.includes('frequency') || h.includes('reach')) return 'meta'
  return 'google'
}
