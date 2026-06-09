export function parseNum(val) {
  if (!val && val !== 0) return 0
  return parseFloat(String(val).replace(/[AED$,%\s]/g, '').replace(/,/g, '')) || 0
}

// Exact match first, then partial — avoids 'cost' matching 'cost / conv.' or 'conversions' matching 'conv. rate'
export function findCol(row, ...names) {
  const keys = Object.keys(row)
  for (const name of names) {
    // 1. Exact match
    const exact = keys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim())
    if (exact) return exact
  }
  for (const name of names) {
    // 2. Starts with match (e.g. 'impr.' matches 'Impr.' but not 'Impr. (Abs. Top) %')
    const startsWith = keys.find(k => k.toLowerCase().trim().startsWith(name.toLowerCase().trim()))
    if (startsWith) return startsWith
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

  // Find column names once from first row to avoid partial match drift across rows
  const sampleRow = rows[0]
  const keys = Object.keys(sampleRow)

  // Exact/starts-with column finders for Google Ads export columns
  const colCost        = keys.find(k => k.toLowerCase().trim() === 'cost') || keys.find(k => /^cost$/i.test(k.trim()))
  const colClicks      = keys.find(k => k.toLowerCase().trim() === 'clicks')
  const colImpr        = keys.find(k => k.toLowerCase().trim() === 'impr.')  || keys.find(k => /^impr\.?$/i.test(k.trim()))
  const colConversions = keys.find(k => k.toLowerCase().trim() === 'conversions')
  const colConvValue   = keys.find(k => /^conv\.\s*value$/i.test(k.trim())) || keys.find(k => /^all conv\.\s*value$/i.test(k.trim())) || keys.find(k => k.toLowerCase().includes('conv. value') && !k.toLowerCase().includes('cost'))
  const colConvRate    = keys.find(k => k.toLowerCase().trim() === 'conv. rate')
  const colCampaign    = keys.find(k => k.toLowerCase().trim() === 'campaign')

  const t = rows.reduce((acc, row) => ({
    spend:       acc.spend       + (colCost        ? parseNum(row[colCost])        : 0),
    clicks:      acc.clicks      + (colClicks      ? parseNum(row[colClicks])      : 0),
    impressions: acc.impressions + (colImpr        ? parseNum(row[colImpr])        : 0),
    conversions: acc.conversions + (colConversions ? parseNum(row[colConversions]) : 0),
    revenue:     acc.revenue     + (colConvValue   ? parseNum(row[colConvValue])   : 0),
  }), { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 })

  const roas = t.spend > 0 && t.revenue > 0 ? t.revenue / t.spend : 0
  const ctr = t.impressions ? t.clicks / t.impressions * 100 : 0
  const cpc = t.clicks ? t.spend / t.clicks : 0
  const cpm = t.impressions ? t.spend / t.impressions * 1000 : 0
  const cpa = t.conversions ? t.spend / t.conversions : 0
  const convRate = t.clicks ? t.conversions / t.clicks * 100 : 0

  const campaigns = rows.slice(0, 8).map(row => {
    const rowSpend = colCost ? parseNum(row[colCost]) : 0
    const rowConvValue = colConvValue ? parseNum(row[colConvValue]) : 0
    const rowRoas = rowSpend > 0 && rowConvValue > 0 ? rowConvValue / rowSpend : 0
    return {
      name: (colCampaign ? row[colCampaign] : 'Campaign').toString().slice(0, 24),
      roas: parseFloat(rowRoas.toFixed(2)),
      spend: rowSpend,
    }
  }).filter(c => c.name && c.name.toLowerCase() !== 'campaign')

  return { totals: t, ctr, cpc, cpm, cpa, roas, convRate, campaigns }
}

export function parseMetaAds(rows) {
  if (!rows.length) return null

  const sampleRow = rows[0]
  const keys = Object.keys(sampleRow)

  const colSpend       = keys.find(k => k.toLowerCase().trim() === 'amount spent') || keys.find(k => k.toLowerCase().trim() === 'spend')
  const colClicks      = keys.find(k => k.toLowerCase().trim() === 'clicks (all)') || keys.find(k => k.toLowerCase().trim() === 'clicks')
  const colImpr        = keys.find(k => k.toLowerCase().trim() === 'impressions')
  const colResults     = keys.find(k => k.toLowerCase().trim() === 'results') || keys.find(k => k.toLowerCase().trim() === 'conversions')
  const colConvValue   = keys.find(k => k.toLowerCase().includes('purchase roas') || k.toLowerCase() === 'roas' || k.toLowerCase() === 'conversion value')
  const colFrequency   = keys.find(k => k.toLowerCase().trim() === 'frequency')
  const colCampaign    = keys.find(k => k.toLowerCase().trim() === 'campaign name') || keys.find(k => k.toLowerCase().trim() === 'campaign')

  const t = rows.reduce((acc, row) => ({
    spend:       acc.spend       + (colSpend     ? parseNum(row[colSpend])     : 0),
    clicks:      acc.clicks      + (colClicks    ? parseNum(row[colClicks])    : 0),
    impressions: acc.impressions + (colImpr      ? parseNum(row[colImpr])      : 0),
    conversions: acc.conversions + (colResults   ? parseNum(row[colResults])   : 0),
    revenue:     acc.revenue     + (colConvValue ? parseNum(row[colConvValue]) : 0),
    frequency:   acc.frequency   + (colFrequency ? parseNum(row[colFrequency]) : 0),
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
    name: (colCampaign ? row[colCampaign] : 'Campaign').toString().slice(0, 24),
    roas: parseFloat((colConvValue ? parseNum(row[colConvValue]) : 0).toFixed(2)),
    spend: colSpend ? parseNum(row[colSpend]) : 0,
  })).filter(c => c.name && c.name.toLowerCase() !== 'campaign name')

  return { totals: t, ctr, cpc, cpm, cpa, roas, convRate, campaigns, frequency }
}

export function autoDetectPlatform(headers) {
  const h = headers.join(' ').toLowerCase()
  if (h.includes('amount spent') || h.includes('frequency') || h.includes('reach')) return 'meta'
  return 'google'
}
