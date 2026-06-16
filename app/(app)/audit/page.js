'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { extractRealRows, parseGoogleAds, parseMetaAds, autoDetectPlatform } from '@/lib/csvParser'
import { Upload, Play, FileText, X, TrendingUp, TrendingDown, Minus, Download, Globe, BarChart2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { StepTracker, NextBar, ThinkingBar } from '@/components/StepComponents'
import { useRouter } from 'next/navigation'

const MARKETS = [
  'UAE',
  'Saudi Arabia',
  'GCC (Kuwait, Qatar, Bahrain, Oman)',
  'Egypt',
  'Pakistan',
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Global / Other',
]

// Normalize metric key labels to proper capitalization
function formatMetricKey(key) {
  const map = {
    avg_cpc: 'Avg CPC', avg_cpm: 'Avg CPM', avg_ctr: 'Avg CTR', avg_cpa: 'Avg CPA',
    avg_roas: 'Avg ROAS', avg_conv_rate: 'Avg Conv. Rate', avg_engagement_rate: 'Avg Engagement Rate',
    cpc: 'CPC', cpm: 'CPM', ctr: 'CTR', cpa: 'CPA', roas: 'ROAS', cpl: 'CPL', cac: 'CAC',
  }
  const lower = key.toLowerCase().replace(/\s+/g, '_')
  if (map[lower]) return map[lower]
  // Fallback: capitalize known acronyms in the string
  return key.replace(/_/g, ' ')
    .replace(/\b(cpc|cpm|ctr|cpa|roas|cpl|cac)\b/gi, m => m.toUpperCase())
    .replace(/\b\w/g, c => c.toUpperCase())
}

function AuditPageInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(params.get('client') || '')
  const [auditMode, setAuditMode] = useState('account')

  // Account audit state
  const [platform, setPlatform] = useState('google')
  const [dateRange, setDateRange] = useState('Last 30 days')
  const [files, setFiles] = useState([])
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState('')
  const [metrics, setMetrics] = useState([])
  const [recos, setRecos] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [pastAudits, setPastAudits] = useState([])
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Market audit state
  const [market, setMarket] = useState('UAE')
  const [competitors, setCompetitors] = useState([
    { name: '', website: '' },
    { name: '', website: '' },
    { name: '', website: '' },
  ])
  const [marketRunning, setMarketRunning] = useState(false)
  const [marketResult, setMarketResult] = useState(null)
  const [marketStrategy, setMarketStrategy] = useState(null)
  const [pastMarketAudits, setPastMarketAudits] = useState([])
  const [expandedCompetitor, setExpandedCompetitor] = useState(null)
  const [strategyRunning, setStrategyRunning] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  useEffect(() => {
    if (!clientId) return
    const supabase = createBrowserClient()
    supabase.from('audits').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5).then(({ data }) => setPastAudits(data || []))
    supabase.from('market_audits').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(3).then(({ data }) => {
      setPastMarketAudits(data || [])
      if (data?.[0]) {
        setMarketResult(data[0])
        if (data[0].strategy_json) setMarketStrategy(data[0].strategy_json)
        // Pre-populate competitors from last market audit
        if (data[0].competitors?.length) {
          const filled = data[0].competitors.filter(c => c.name)
          const padded = [...filled]
          while (padded.length < 3) padded.push({ name: '', website: '' })
          setCompetitors(padded.slice(0, 3))
        }
      }
    })
  }, [clientId])

  function addFiles(newFiles) {
    const valid = newFiles.filter(f => /\.csv$/i.test(f.name))
    setFiles(prev => [...prev, ...valid.filter(f => !prev.find(p => p.name === f.name))])
    setError('')
  }

  function updateCompetitor(index, field, value) {
    setCompetitors(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  async function runMarketAudit() {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    const filledCompetitors = competitors.filter(c => c.name.trim())
    if (!filledCompetitors.length) { setError('Add at least one competitor'); return }

    setMarketRunning(true)
    setMarketResult(null)
    setMarketStrategy(null)
    setError('')

    try {
      const auditRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'market_audit',
          payload: {
            clientName: client.name,
            industry: client.industry,
            website: client.website,
            market,
            competitors: filledCompetitors,
            budget: client.monthly_budget,
          }
        })
      })
      const auditData = await auditRes.json()
      if (!auditData.success) throw new Error(auditData.error)

      // Strategy is now returned in the same call — no second API call needed
      setMarketResult({ ...auditData, market, competitors: filledCompetitors })
      if (auditData.strategy) setMarketStrategy(auditData.strategy)

      const supabase = createBrowserClient()
      const { data: saved } = await supabase.from('market_audits').insert([{
        client_id: clientId,
        market,
        competitors: filledCompetitors,
        benchmark_json: auditData.benchmarks,
        competitor_intel_json: auditData.competitor_intel,
        opportunities_json: auditData.opportunities,
        summary: auditData.summary,
        strategy_json: auditData.strategy || null,
      }]).select().single()

      if (saved) {
        setMarketResult(prev => ({ ...prev, id: saved.id, created_at: saved.created_at }))
        const { data: past } = await supabase.from('market_audits').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(3)
        setPastMarketAudits(past || [])
      }
    } catch (e) {
      setError('Error: ' + e.message)
    }

    setMarketRunning(false)
    setStrategyRunning(false)
  }

  async function exportMarketPDF() {
    const client = clients.find(c => c.id === clientId)
    const mr = marketResult
    const ms = marketStrategy
    const win = window.open('', '_blank')

    const benchmarksHtml = mr?.benchmarks ? `
      <h2>Industry Benchmarks · ${mr.market}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
        ${mr.benchmarks.google ? `
        <div>
          <h3 style="font-size:13px;font-weight:600;margin:0 0 10px">Google Ads</h3>
          ${Object.entries(mr.benchmarks.google).map(([k,v]) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0">
              <span style="font-size:12px;color:#6b7280">${formatMetricKey(k)}</span>
              <span style="font-size:12px;font-weight:600;color:#111827">${v}</span>
            </div>`).join('')}
        </div>` : ''}
        ${mr.benchmarks.meta ? `
        <div>
          <h3 style="font-size:13px;font-weight:600;margin:0 0 10px">Meta Ads</h3>
          ${Object.entries(mr.benchmarks.meta).map(([k,v]) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0">
              <span style="font-size:12px;color:#6b7280">${formatMetricKey(k)}</span>
              <span style="font-size:12px;font-weight:600;color:#111827">${v}</span>
            </div>`).join('')}
        </div>` : ''}
      </div>
      ${mr.benchmarks.platform_notes ? `<p style="font-size:12px;color:#9ca3af;font-style:italic">${mr.benchmarks.platform_notes}</p>` : ''}
    ` : ''

    const competitorHtml = mr?.competitor_intel?.length ? `
      <h2>Competitor Ad Intelligence</h2>
      ${mr.competitor_intel.map(comp => `
        <div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between">
            <strong style="font-size:13px">${comp.name}</strong>
            <span style="font-size:11px;background:${comp.ad_presence==='Strong'?'#fef2f2':'#fffbeb'};color:${comp.ad_presence==='Strong'?'#dc2626':'#92400e'};padding:2px 8px;border-radius:20px">${comp.ad_presence} presence</span>
          </div>
          <div style="padding:12px 16px">
            ${comp.estimated_spend ? `<p style="font-size:12px;margin:0 0 6px"><strong>Est. Monthly Spend:</strong> ${comp.estimated_spend}</p>` : ''}
            ${comp.platforms?.length ? `<p style="font-size:12px;margin:0 0 6px"><strong>Active Platforms:</strong> ${comp.platforms.join(', ')}</p>` : ''}
            ${comp.gap ? `<p style="font-size:12px;color:#16a34a;margin:8px 0 0"><strong>Your Opportunity:</strong> ${comp.gap}</p>` : ''}
          </div>
        </div>`).join('')}
    ` : ''

    const strategyHtml = ms ? `
      <h2>Launch Strategy</h2>
      ${ms.executive_summary ? `<p style="font-size:13px;color:#374151;line-height:1.6;margin-bottom:20px">${ms.executive_summary}</p>` : ''}
      ${ms.expected_kpis ? `
        <h3>Expected KPIs</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
          ${[['ROAS', ms.expected_kpis.expected_roas],['CPA', ms.expected_kpis.expected_cpa],['Monthly Conversions', ms.expected_kpis.monthly_conversions],['Impressions/mo', ms.expected_kpis.monthly_impressions],['Clicks/mo', ms.expected_kpis.monthly_clicks]].filter(([,v])=>v).map(([l,v]) => `
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px">
              <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${l}</div>
              <div style="font-size:16px;font-weight:600;color:#111827">${v}</div>
            </div>`).join('')}
        </div>` : ''}
      ${ms.channel_strategy?.length ? `
        <h3>Channel Strategy</h3>
        ${ms.channel_strategy.map(ch => `
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <strong style="font-size:13px">${ch.channel}</strong>
              <span style="font-size:12px;font-weight:600">AED ${(ch.monthly_budget||0).toLocaleString()}/mo · ${ch.budget_percentage}%</span>
            </div>
            <p style="font-size:12px;color:#6b7280;margin:0">${ch.rationale}</p>
          </div>`).join('')}` : ''}
    ` : ''

    win.document.write(`<!DOCTYPE html><html><head><title>Market Audit – ${client?.name||''}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;padding:40px;max-width:900px;margin:0 auto}h1{font-size:22px;font-weight:700;margin:0}h2{font-size:15px;font-weight:600;margin:28px 0 12px;padding-bottom:6px;border-bottom:1px solid #f0f0f0}h3{font-size:13px;font-weight:600;margin:16px 0 8px}p{font-size:13px;color:#374151;line-height:1.6}</style></head>
    <body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #f0f0f0">
      <div><h1>${client?.name||'Client'} — Market Audit</h1><p style="color:#9ca3af;margin:4px 0 0">${mr?.market} · ${client?.industry} · Generated ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p></div>
      <div style="background:#1a1a2e;color:#e8c97e;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600">PerfHub</div>
    </div>
    ${mr?.summary ? `<h2>Market Overview</h2><p style="white-space:pre-wrap">${mr.summary}</p>` : ''}
    ${benchmarksHtml}
    ${competitorHtml}
    ${strategyHtml}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ca3af;text-align:center">Generated by PerfHub · ${new Date().toLocaleDateString('en-GB')}</div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  async function exportPDF() {
    const client = clients.find(c => c.id === clientId)
    const win = window.open('', '_blank')
    const metricsHtml = metrics.map(m => `
      <div style="background:${m.status==='good'?'#f0fdf4':m.status==='bad'?'#fef2f2':'#fffbeb'};border:1px solid ${m.status==='good'?'#bbf7d0':m.status==='bad'?'#fecaca':'#fde68a'};border-radius:8px;padding:16px;flex:1;min-width:160px">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${m.label}</div>
        <div style="font-size:22px;font-weight:600;color:#111827">${m.value}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px">${m.bench}</div>
      </div>`).join('')
    const recosHtml = recos.map((r,i) => `
      <div style="display:flex;gap:12px;padding:14px;border:1px solid #f0f0f0;border-radius:8px;margin-bottom:8px">
        <div style="width:24px;height:24px;border-radius:50%;background:#1a1a2e;color:#e8c97e;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:4px">${r.title}</div>
          <div style="font-size:12px;color:#6b7280;line-height:1.5">${r.desc}</div>
          <span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${r.impact==='High'?'#f0fdf4':'#fffbeb'};color:${r.impact==='High'?'#166534':'#92400e'}">${r.impact} impact</span>
        </div>
      </div>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><title>Audit Report – ${client?.name||''}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;padding:40px;max-width:900px;margin:0 auto}h1{font-size:24px;font-weight:700;margin:0}h2{font-size:16px;font-weight:600;margin:24px 0 12px}p{font-size:13px;color:#374151;line-height:1.6}.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500}</style></head>
    <body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #f0f0f0">
      <div><h1>${client?.name||'Client'} — Account Audit</h1><p style="color:#9ca3af;margin:4px 0 0">${platform==='google'?'Google Ads':'Meta Ads'} · ${dateRange} · Generated ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p></div>
      <div style="background:#1a1a2e;color:#e8c97e;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600">PerfHub</div>
    </div>
    ${summary ? `<h2>Analysis</h2><p style="white-space:pre-wrap">${summary}</p>` : ''}
    ${metrics.length ? `<h2>Key Metrics</h2><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">${metricsHtml}</div>` : ''}
    ${recos.length ? `<h2>Prioritised Recommendations</h2>${recosHtml}` : ''}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ca3af;text-align:center">Generated by PerfHub · ${new Date().toLocaleDateString('en-GB')}</div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  async function run() {
    if (!clientId) return
    setRunning(true); setSummary(''); setMetrics([]); setRecos([]); setCampaigns([]); setError('')
    const client = clients.find(c => c.id === clientId)
    let parsedMetrics = null
    if (files.length) {
      try {
        const Papa = (await import('papaparse')).default
        let allRows = []
        let detected = 'google'
        for (const file of files) {
          const text = await file.text()
          const cleaned = extractRealRows(text)
          const { data: rows } = Papa.parse(cleaned, { header: true, skipEmptyLines: true })
          if (rows.length) {
            detected = autoDetectPlatform(Object.keys(rows[0]))
            allRows = [...allRows, ...rows]
          }
        }
        if (!allRows.length) { setError('CSV appears empty'); setRunning(false); return }
        setPlatform(detected)
        parsedMetrics = detected === 'meta' ? parseMetaAds(allRows) : parseGoogleAds(allRows)
        if (!parsedMetrics || parsedMetrics.totals.spend === 0) {
          setError('Could not read spend from CSV. Make sure your export includes a Cost or Amount spent column.')
        } else {
          setCampaigns(parsedMetrics.campaigns || [])
          buildMetricCards(parsedMetrics, client)
        }
      } catch (e) { setError('File error: ' + e.message); setRunning(false); return }
    }
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'audit', payload: { clientName: client.name, industry: client.industry, platform, dateRange, metrics: parsedMetrics } })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setSummary(data.summary)
      setRecos(data.recommendations || [])
      const supabase = createBrowserClient()
      await supabase.from('audits').insert([{ client_id: clientId, platform, date_range: dateRange, summary: data.summary, metrics_json: metrics, recommendations_json: data.recommendations, raw_data_json: parsedMetrics ? { totals: parsedMetrics.totals, ctr: parsedMetrics.ctr, cpc: parsedMetrics.cpc, cpm: parsedMetrics.cpm, cpa: parsedMetrics.cpa, roas: parsedMetrics.roas } : null }])
      const { data: past } = await supabase.from('audits').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5)
      setPastAudits(past || [])
    } catch (e) { setSummary('Error: ' + e.message) }
    setRunning(false)
  }

  function buildMetricCards(d, client) {
    const industry = client?.industry || ''
    const benchmarks = {
      'F&B / Restaurant':    { roas: 3.5, cpa: 35,  cpc: 1.2, cpm: 8  },
      'E-commerce':          { roas: 4.0, cpa: 200, cpc: 1.5, cpm: 10 },
      'Real Estate':         { roas: 2.5, cpa: 800, cpc: 3.5, cpm: 15 },
      'Fashion':             { roas: 4.2, cpa: 180, cpc: 1.3, cpm: 9  },
      'Beauty & Wellness':   { roas: 4.0, cpa: 150, cpc: 1.4, cpm: 9  },
      'Healthcare':          { roas: 2.5, cpa: 120, cpc: 2.5, cpm: 12 },
      'Education':           { roas: 2.0, cpa: 150, cpc: 2.0, cpm: 10 },
      'Automotive':          { roas: 2.0, cpa: 600, cpc: 4.0, cpm: 18 },
      'Finance':             { roas: 2.0, cpa: 200, cpc: 5.0, cpm: 20 },
      'Retail':              { roas: 3.5, cpa: 120, cpc: 1.5, cpm: 9  },
      'Travel & Hospitality':{ roas: 3.0, cpa: 250, cpc: 2.5, cpm: 12 },
      'Technology':          { roas: 2.5, cpa: 180, cpc: 3.0, cpm: 14 },
    }
    const b = benchmarks[industry] || { roas: 3.5, cpa: 150, cpc: 2.0, cpm: 10 }
    const s = (v, good, ok) => v <= good ? 'good' : v <= ok ? 'warn' : 'bad'
    const si = (v, good, ok) => v >= good ? 'good' : v >= ok ? 'warn' : 'bad'
    const spend = Math.round(d.totals.spend * 100) / 100
    const convs = Math.round(d.totals.conversions * 100) / 100
    setMetrics([
      { label: 'ROAS', value: d.roas.toFixed(2) + 'x', bench: 'Benchmark ' + b.roas + 'x', status: si(d.roas, b.roas, b.roas * 0.8) },
      { label: 'CPA', value: 'AED ' + d.cpa.toFixed(2), bench: 'Target AED ' + b.cpa, status: s(d.cpa, b.cpa, b.cpa * 1.3) },
      { label: platform === 'google' ? 'CPC' : 'CPM', value: 'AED ' + (platform === 'google' ? d.cpc : d.cpm).toFixed(2), bench: 'Avg AED ' + (platform === 'google' ? b.cpc : b.cpm), status: s(platform === 'google' ? d.cpc : d.cpm, platform === 'google' ? b.cpc : b.cpm, (platform === 'google' ? b.cpc : b.cpm) * 1.3) },
      { label: 'CTR', value: d.ctr.toFixed(2) + '%', bench: 'Industry avg 3.1%', status: si(d.ctr, 3, 1.5) },
      { label: 'Conv. Rate', value: d.convRate.toFixed(2) + '%', bench: 'Industry avg 3.7%', status: si(d.convRate, 3.5, 2) },
      { label: 'Spend', value: 'AED ' + spend.toLocaleString(undefined, { maximumFractionDigits: 0 }), bench: Math.round(convs) + ' conversions', status: 'warn' },
    ])
  }

  const sBg = { good: 'bg-status-green-bg/30', bad: 'bg-status-red-bg/30', warn: 'bg-status-amber-bg/30' }
  const sBorder = { good: 'border-status-green/20', bad: 'border-status-red/20', warn: 'border-status-amber/20' }
  const sIcon = s => s === 'good' ? <TrendingUp size={12} className="text-status-green"/> : s === 'bad' ? <TrendingDown size={12} className="text-status-red"/> : <Minus size={12} className="text-status-amber"/>

  const mr = marketResult

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{background:'#0d1120',border:'1px solid #1e2a48',borderRadius:8,padding:'8px 12px'}}>
          <p style={{fontSize:11,color:'#8090c0',marginBottom:4}}>{label}</p>
          <p style={{fontSize:14,fontWeight:600,color:'#e8c97e'}}>{parseFloat(payload[0].value).toFixed(2)}x ROAS</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Audit</h1>
          <p className="text-sm text-text-secondary mt-0.5">Agent 1 — account performance audit or market intelligence for new clients</p>
        </div>
        <div className="flex gap-2">
          {auditMode === 'account' && (summary || metrics.length > 0) && (
            <button className="btn-secondary" onClick={exportPDF}><Download size={13}/> Export PDF</button>
          )}
          {auditMode === 'account' && (
            <button className="btn-primary" onClick={run} disabled={running || !clientId}><Play size={13}/>{running ? 'Analysing...' : 'Run audit'}</button>
          )}
          {auditMode === 'market' && (
            <button className="btn-primary" onClick={runMarketAudit} disabled={marketRunning || !clientId}>
              <Globe size={13}/>{marketRunning ? 'Researching market & building strategy...' : 'Run market audit'}
            </button>
          )}
          {auditMode === 'market' && mr && !marketRunning && (
            <button className="btn-secondary" onClick={exportMarketPDF}><Download size={13}/> Export PDF</button>
          )}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-surface-tertiary rounded-xl mb-6 w-fit">
        <button
          onClick={() => setAuditMode('account')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${auditMode === 'account' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
        >
          <BarChart2 size={14}/> Account audit
        </button>
        <button
          onClick={() => setAuditMode('market')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${auditMode === 'market' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
        >
          <Globe size={14}/> Market audit
          <span className="text-[10px] bg-brand-gold/20 text-brand-gold px-1.5 py-0.5 rounded-full font-semibold">New to paid ads</span>
        </button>
      </div>

      {/* Client selector */}
      <div className="card p-4 mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Client</label>
        <select className="select max-w-xs" value={clientId} onChange={e => setClientId(e.target.value)}>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* ── ACCOUNT AUDIT MODE ── */}
      {auditMode === 'account' && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Platform</label>
              <div className="flex gap-2">
                {['google','meta'].map(p => <button key={p} onClick={() => setPlatform(p)} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${platform===p ? 'bg-surface-tertiary text-brand-gold border-brand-gold/40' : 'bg-surface-primary text-text-muted border-surface-border-light'}`}>{p==='google'?'Google Ads':'Meta Ads'}</button>)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Date range</label>
              <select className="select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
                {['Last 30 days','Last 60 days','Last 90 days','This year'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className={`card border-dashed p-8 text-center cursor-pointer mb-2 ${dragOver ? 'border-brand-gold/40 bg-surface-secondary' : 'hover:border-surface-border-light'}`}
            onClick={() => document.getElementById('audit-input').click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)) }}>
            <Upload size={22} className="text-text-muted mx-auto mb-2"/>
            <p className="text-sm font-medium text-text-primary mb-1">Drop your {platform==='google'?'Google Ads':'Meta Ads'} CSV export here</p>
            <p className="text-xs text-text-secondary">{platform==='google'?'Google Ads → Reports → Campaigns → Download':'Meta Ads Manager → Campaigns → Export'}</p>
            <input id="audit-input" type="file" accept=".csv" className="hidden" onChange={e => addFiles(Array.from(e.target.files))}/>
          </div>

          {error && <div className="text-xs text-status-red bg-status-red-bg/30 border border-status-red/20 rounded-lg px-3 py-2 mb-3">{error}</div>}

          {files.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {files.map(f => <div key={f.name} className="flex items-center gap-2 text-xs bg-surface-secondary border border-surface-border-light rounded-lg px-3 py-1.5 text-text-secondary"><FileText size={12} className="text-text-muted"/>{f.name}<button onClick={() => setFiles(files.filter(x => x.name !== f.name))} className="text-text-muted hover:text-status-red"><X size={12}/></button></div>)}
            </div>
          )}

          {metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {metrics.map(m => (
                <div key={m.label} className={`card p-4 ${sBg[m.status]||''} ${sBorder[m.status]||''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{m.label}</p>
                    {sIcon(m.status)}
                  </div>
                  <p className="text-2xl font-bold text-text-primary">{m.value}</p>
                  <p className="text-xs text-text-secondary mt-1">{m.bench}</p>
                </div>
              ))}
            </div>
          )}

          {campaigns.filter(c => c.roas > 0).length > 0 && (
            <div className="card p-5 mb-4">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">ROAS by Campaign</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={campaigns.filter(c => c.roas > 0)} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:11,fill:'#8090c0'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fill:'#8090c0'}} tickFormatter={v=>v+'x'} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="roas" radius={[4,4,0,0]}>
                    {campaigns.filter(c => c.roas > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#e8c97e" fillOpacity={0.85}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(summary || running) && (
            <div className="card p-5 mb-4">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">AI Analysis</p>
              {running && !summary && <ThinkingBar message="Searching web for live benchmarks and analysing account performance..."/>}
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{summary}</p>
            </div>
          )}

          {recos.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-text-primary mb-3">Prioritised Recommendations</p>
              <div className="space-y-2">
                {recos.map((r,i) => (
                  <div key={i} className="card p-4 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-tertiary text-brand-gold text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{i+1}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text-primary mb-1">{r.title}</p>
                      <p className="text-xs text-text-secondary leading-relaxed">{r.desc}</p>
                      <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.impact==='High'?'bg-status-green-bg/40 text-status-green':'bg-status-amber-bg/40 text-status-amber'}`}>{r.impact} impact</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(summary || recos.length > 0) && !running && clientId && (
            <div className="next-bar mt-6">
              <div>
                <p className="text-sm font-semibold text-text-primary">Audit complete</p>
                <p className="text-xs text-text-secondary mt-0.5">Next: analyse your competitors' paid & organic presence</p>
              </div>
              <button
                className="btn-primary"
                onClick={() => router.push(`/competitors?client=${clientId}`)}
              >
                Competitor Intel <ArrowRight size={14}/>
              </button>
            </div>
          )}

          {pastAudits.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-text-primary mb-3">Past audits</p>
              <div className="space-y-2">
                {pastAudits.map(a => <div key={a.id} className="card px-4 py-3 flex items-center justify-between"><div><p className="text-sm text-text-primary">{a.platform==='google'?'Google Ads':'Meta Ads'} · {a.date_range}</p><p className="text-xs text-text-secondary">{new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div><button className="text-xs text-text-secondary hover:text-text-primary border border-surface-border-light rounded px-2 py-1" onClick={()=>{if(a.summary)setSummary(a.summary);if(a.metrics_json)setMetrics(a.metrics_json);if(a.recommendations_json)setRecos(a.recommendations_json)}}>View</button></div>)}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MARKET AUDIT MODE ── */}
      {auditMode === 'market' && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Target Market</label>
              <select className="select" value={market} onChange={e => setMarket(e.target.value)}>
                {MARKETS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Competitors (up to 3)</label>
            <div className="space-y-3">
              {competitors.map((c, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <input
                    className="input"
                    placeholder={`Competitor ${i + 1} name`}
                    value={c.name}
                    onChange={e => updateCompetitor(i, 'name', e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Website (e.g. competitor.com)"
                    value={c.website}
                    onChange={e => updateCompetitor(i, 'website', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <div className="text-xs text-status-red bg-status-red-bg/30 border border-status-red/20 rounded-lg px-3 py-2 mb-4">{error}</div>}

          {marketRunning && <ThinkingBar message="Searching web for market benchmarks, competitor data, and building launch strategy..."/>}

          {mr && !marketRunning && (
            <div className="space-y-4">

              {/* Header */}
              <div className="card p-4" style={{background:'#0f1e35',borderColor:'#1e3a5f'}}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-status-blue">Market Audit — {mr.market}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{clients.find(c=>c.id===clientId)?.industry} · {mr.competitors?.filter(c=>c.name).length} competitors analysed</p>
                  </div>
                  {mr.created_at && <p className="text-xs text-text-secondary">{new Date(mr.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>}
                </div>
              </div>

              {/* Summary */}
              {mr.summary && (
                <div className="card p-5">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Market Overview</p>
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{mr.summary}</p>
                </div>
              )}

              {/* Benchmarks */}
              {mr.benchmarks && (
                <div className="card p-5">
                  <p className="text-sm font-bold text-text-primary mb-1">Industry Benchmarks</p>
                  <p className="text-xs text-text-secondary mb-4">{mr.market} market · {clients.find(c=>c.id===clientId)?.industry}</p>
                  <div className="grid grid-cols-2 gap-6">
                    {mr.benchmarks.google && (
                      <div>
                        <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 pb-2 border-b border-surface-border">Google Ads</p>
                        <div className="space-y-2">
                          {Object.entries(mr.benchmarks.google).map(([k,v]) => (
                            <div key={k} className="flex justify-between items-center py-1.5 border-b border-surface-border last:border-0">
                              <span className="text-sm text-text-secondary">{formatMetricKey(k)}</span>
                              <span className="text-sm font-bold text-text-primary">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {mr.benchmarks.meta && (
                      <div>
                        <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 pb-2 border-b border-surface-border">Meta Ads</p>
                        <div className="space-y-2">
                          {Object.entries(mr.benchmarks.meta).map(([k,v]) => (
                            <div key={k} className="flex justify-between items-center py-1.5 border-b border-surface-border last:border-0">
                              <span className="text-sm text-text-secondary">{formatMetricKey(k)}</span>
                              <span className="text-sm font-bold text-text-primary">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {mr.benchmarks.platform_notes && (
                    <div className="mt-4 pt-4 border-t border-surface-border">
                      <p className="text-sm text-text-secondary leading-relaxed">{mr.benchmarks.platform_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Competitor intel */}
              {mr.competitor_intel?.length > 0 && (
                <div className="card p-5">
                  <p className="text-sm font-bold text-text-primary mb-4">Competitor Ad Intelligence</p>
                  <div className="space-y-2">
                    {mr.competitor_intel.map((comp, i) => (
                      <div key={i} className="rounded-lg overflow-hidden" style={{border:'1px solid #1e2a48'}}>
                        <button
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-secondary transition-colors"
                          onClick={() => setExpandedCompetitor(expandedCompetitor === i ? null : i)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-surface-tertiary flex items-center justify-center text-xs font-bold text-brand-gold">
                              {comp.name?.slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{comp.name}</p>
                              {comp.website && <p className="text-xs text-text-secondary">{comp.website.replace(/https?:\/\//,'')}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${comp.ad_presence === 'Strong' ? 'bg-status-red-bg text-status-red' : comp.ad_presence === 'Moderate' ? 'bg-status-amber-bg text-status-amber' : 'bg-status-green-bg text-status-green'}`}>
                              {comp.ad_presence} presence
                            </span>
                            {expandedCompetitor === i ? <ChevronUp size={14} className="text-text-secondary"/> : <ChevronDown size={14} className="text-text-secondary"/>}
                          </div>
                        </button>
                        {expandedCompetitor === i && (
                          <div className="border-t p-4 space-y-4" style={{borderColor:'#1e2a48',background:'#0d1120'}}>
                            {comp.estimated_spend && (
                              <div>
                                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Est. Monthly Spend</p>
                                <p className="text-sm font-semibold text-text-primary">{comp.estimated_spend}</p>
                              </div>
                            )}
                            {comp.platforms?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Active Platforms</p>
                                <div className="flex gap-1.5 flex-wrap">
                                  {comp.platforms.map((p,j)=><span key={j} className="text-xs bg-surface-secondary text-text-primary px-2.5 py-1 rounded-lg border border-surface-border-light">{p}</span>)}
                                </div>
                              </div>
                            )}
                            {comp.ad_angles?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Ad Angles</p>
                                <div className="flex gap-1.5 flex-wrap">
                                  {comp.ad_angles.map((a,j)=><span key={j} className="text-xs bg-status-blue-bg text-status-blue px-2.5 py-1 rounded-lg">{a}</span>)}
                                </div>
                              </div>
                            )}
                            {comp.likely_keywords?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Likely Keywords</p>
                                <div className="flex gap-1.5 flex-wrap">
                                  {comp.likely_keywords.map((k,j)=><span key={j} className="text-xs bg-surface-secondary border border-surface-border-light text-text-primary px-2.5 py-1 rounded-lg font-mono">{k}</span>)}
                                </div>
                              </div>
                            )}
                            {comp.gap && (
                              <div className="rounded-lg p-3" style={{background:'#14301a',border:'1px solid rgba(34,197,94,0.2)'}}>
                                <p className="text-xs font-bold text-status-green uppercase tracking-wider mb-1">Your Opportunity</p>
                                <p className="text-sm text-status-green leading-relaxed">{comp.gap}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Opportunities */}
              {mr.opportunities?.length > 0 && (
                <div className="card p-5">
                  <p className="text-sm font-bold text-text-primary mb-4">Market Opportunities</p>
                  <div className="space-y-3">
                    {mr.opportunities.map((o, i) => (
                      <div key={i} className="flex gap-3 p-4 rounded-lg" style={{background:'#111827',border:'1px solid #1e2a48'}}>
                        <div className="w-6 h-6 rounded-full bg-surface-tertiary text-brand-gold text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary mb-1">{o.title}</p>
                          <p className="text-sm text-text-secondary leading-relaxed">{o.detail}</p>
                          {o.action && <p className="text-sm text-status-blue mt-1.5 font-medium">→ {o.action}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}



              {marketStrategy && (
                <div className="card p-5" style={{borderLeft:'3px solid #e8c97e'}}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-base font-bold text-text-primary">Launch Strategy</p>
                    <span className="text-xs bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full border border-brand-gold/20 font-medium">Auto-generated from market audit</span>
                  </div>

                  {marketStrategy.executive_summary && (
                    <p className="text-sm text-text-primary leading-relaxed mb-5">{marketStrategy.executive_summary}</p>
                  )}

                  {marketStrategy.expected_kpis && (
                    <div className="mb-5">
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Expected KPIs</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          ['ROAS', marketStrategy.expected_kpis.expected_roas],
                          ['CPA', marketStrategy.expected_kpis.expected_cpa],
                          ['Monthly Conversions', marketStrategy.expected_kpis.monthly_conversions],
                          ['Impressions/mo', marketStrategy.expected_kpis.monthly_impressions],
                          ['Clicks/mo', marketStrategy.expected_kpis.monthly_clicks],
                        ].filter(([,v])=>v).map(([l,v]) => (
                          <div key={l} className="rounded-lg p-3" style={{background:'#111827',border:'1px solid #1e2a48'}}>
                            <p className="text-xs text-text-secondary mb-1.5 font-medium">{l}</p>
                            <p className="text-base font-bold text-text-primary">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {marketStrategy.channel_strategy?.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Channel Strategy</p>
                      <div className="space-y-3">
                        {marketStrategy.channel_strategy.map((ch, i) => (
                          <div key={i} className="rounded-lg p-4" style={{background:'#111827',border:'1px solid #1e2a48'}}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-text-primary">{ch.channel}</span>
                              <span className="text-sm font-bold text-brand-gold">AED {(ch.monthly_budget||0).toLocaleString()}/mo · {ch.budget_percentage}%</span>
                            </div>
                            <p className="text-sm text-text-secondary leading-relaxed">{ch.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {marketStrategy.quick_wins?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Launch Quick Wins</p>
                      <div className="space-y-2">
                        {marketStrategy.quick_wins.map((w, i) => (
                          <div key={i} className="flex gap-3 items-start p-3 rounded-lg" style={{background:'#111827',border:'1px solid #1e2a48'}}>
                            {w.timeline && <span className="text-[10px] bg-brand-gold/20 text-brand-gold px-2 py-1 rounded font-bold shrink-0 mt-0.5">{w.timeline}</span>}
                            <div>
                              <p className="text-sm text-text-primary font-medium">{typeof w === 'object' ? w.action : w}</p>
                              {w.expected_impact && <p className="text-xs text-status-green mt-1">→ {w.expected_impact}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next Step CTA */}
                  <div className="next-bar mt-6">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Market audit & strategy complete</p>
                      <p className="text-xs text-text-secondary mt-0.5">Next: deep-dive competitor analysis across paid & organic</p>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => router.push(`/competitors?client=${clientId}`)}
                    >
                      Competitor Intel <ArrowRight size={14}/>
                    </button>
                  </div>
                </div>
              )}

              {/* Past market audits */}
              {pastMarketAudits.length > 1 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-text-primary mb-2">Past Market Audits</p>
                  <div className="space-y-2">
                    {pastMarketAudits.slice(1).map(a => (
                      <div key={a.id} className="card px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-text-primary">{a.market} · {a.competitors?.filter(c=>c.name).length} competitors</p>
                          <p className="text-xs text-text-secondary">{new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
                        </div>
                        <button className="text-xs text-text-secondary hover:text-text-primary border border-surface-border-light rounded px-2 py-1" onClick={() => {
                          setMarketResult(a)
                          if (a.strategy_json) setMarketStrategy(a.strategy_json)
                        }}>View</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading...</div>}>
      <AuditPageInner />
    </Suspense>
  )
}
