'use client'
import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { StepTracker, NextBar, ThinkingBar } from '@/components/StepComponents'
import { Play, Download, ChevronDown, ChevronUp, Info, AlertTriangle } from 'lucide-react'

const CHANNELS = ['Google Search','Google Display','Google Shopping','YouTube','Meta (Facebook/Instagram)','TikTok','LinkedIn','Snapchat','SEO','Email Marketing']
const GOALS = ['increase conversions','increase ROAS','reduce CPA','grow brand awareness','increase leads','drive app installs','increase e-commerce revenue']

function StrategyPageInner() {
  const params = useSearchParams()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(params.get('client') || '')
  const [goal, setGoal] = useState('increase conversions')
  const [budget, setBudget] = useState('')
  const [duration, setDuration] = useState('3 months')
  const [channels, setChannels] = useState(['Google Search','Meta (Facebook/Instagram)'])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({})
  const [strategy, setStrategy] = useState(null)
  const [expanded, setExpanded] = useState('channels')
  const [pastStrategies, setPastStrategies] = useState([])
  const [dataSources, setDataSources] = useState([])
  const [latestRoas, setLatestRoas] = useState(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  useEffect(() => {
    if (!clientId) { setProgress({}); return }
    const supabase = createBrowserClient()
    Promise.all([
      supabase.from('audits').select('id').eq('client_id', clientId).limit(1),
      supabase.from('market_audits').select('id').eq('client_id', clientId).limit(1),
      supabase.from('competitor_analyses').select('id').eq('client_id', clientId).limit(1),
      supabase.from('strategies').select('id').eq('client_id', clientId).limit(1),
      supabase.from('client_creatives').select('id').eq('client_id', clientId).limit(1),
    ]).then(([audit, market, comp, strat, creative]) => {
      setProgress({
        audit: (audit.data?.length > 0) || (market.data?.length > 0),
        competitor: comp.data?.length > 0,
        strategy: strat.data?.length > 0,
        creative: creative.data?.length > 0,
        reports: strat.data?.length > 0,
      })
    })
  }, [clientId])

  useEffect(() => {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    if (client?.monthly_budget) setBudget(String(client.monthly_budget))
    const supabase = createBrowserClient()
    Promise.all([
      supabase.from('strategies').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
      supabase.from('audits').select('id,platform,created_at,raw_data_json').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
      supabase.from('competitor_analyses').select('id').eq('client_id', clientId).limit(1),
    ]).then(([{ data: s }, { data: a }, { data: c }]) => {
      setPastStrategies(s || [])
      const sources = ['Industry benchmarks (UAE/GCC market)']
      if (a?.length) {
        sources.push('Your past audit data')
        setLatestRoas(a[0]?.raw_data_json?.roas ?? null)
      }
      if (c?.length) sources.push('Competitor analysis')
      setDataSources(sources)
    })
  }, [clientId, clients])

  async function exportPPT() {
    const client = clients.find(c => c.id === clientId)
    if (!strategy || !client) return
    const win = window.open('', '_blank')

    const channelSlides = (strategy.channel_strategy || []).map(ch => {
      const budgetSplitHtml = ch.budget_split?.length ? `
        <div style="margin-top:16px">
          <div class="label">Budget split by campaign type</div>
          <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12px">
            <tr style="background:#f9fafb"><th style="text-align:left;padding:6px 8px;color:#6b7280">Campaign type</th><th style="text-align:right;padding:6px 8px;color:#6b7280">Budget</th><th style="text-align:right;padding:6px 8px;color:#6b7280">%</th></tr>
            ${ch.budget_split.map(b => `<tr style="border-top:1px solid #f0f0f0"><td style="padding:6px 8px">${b.campaign_type}</td><td style="text-align:right;padding:6px 8px;font-weight:500">AED ${(b.budget_aed||0).toLocaleString()}</td><td style="text-align:right;padding:6px 8px;color:#6b7280">${b.percentage}%</td></tr>`).join('')}
          </table>
        </div>` : ''
      return `
      <div class="slide">
        <div class="slide-header"><span class="slide-num">Channel Strategy</span><span class="brand">PerfHub</span></div>
        <h2>${ch.channel}</h2>
        <div style="display:flex;gap:24px;margin-top:16px">
          <div style="flex:1">
            <div class="label">Role</div><div class="value">${ch.role}</div>
            <div class="label" style="margin-top:12px">Monthly Budget</div><div class="value">AED ${(ch.monthly_budget||0).toLocaleString()} (${ch.budget_percentage}%)</div>
            <div class="label" style="margin-top:12px">Bid Strategy</div><div style="font-size:13px;color:#374151;margin-top:4px">${ch.bid_strategy||'—'}</div>
          </div>
          <div style="flex:2">
            <div class="label">Rationale</div><p style="font-size:13px;color:#374151;line-height:1.6">${ch.rationale}</p>
            ${budgetSplitHtml}
          </div>
        </div>
      </div>`
    }).join('')

    const keywordSlide = strategy.keyword_strategy ? `
    <div class="slide">
      <div class="slide-header"><span class="slide-num">Keyword Strategy</span><span class="brand">PerfHub</span></div>
      <h2>Keywords & Negatives</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px">
        <div>
          <h3>Branded keywords (${strategy.keyword_strategy.branded_keywords?.length||0})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${(strategy.keyword_strategy.branded_keywords||[]).map(k=>`<span class="chip">${k}</span>`).join('')}</div>
          <h3 style="margin-top:16px">Non-brand keywords (${strategy.keyword_strategy.non_brand_keywords?.length||0})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${(strategy.keyword_strategy.non_brand_keywords||[]).map(k=>`<span class="chip">${k}</span>`).join('')}</div>
        </div>
        <div>
          <h3>Account-level negatives</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${(strategy.keyword_strategy.account_level_negatives||[]).map(k=>`<span class="chip" style="background:#fef2f2;color:#991b1b">${k}</span>`).join('')}</div>
          <h3 style="margin-top:16px">Campaign-level negatives</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${(strategy.keyword_strategy.campaign_level_negatives||[]).map(k=>`<span class="chip" style="background:#fef2f2;color:#991b1b">${k}</span>`).join('')}</div>
        </div>
      </div>
    </div>` : ''

    const quickWinsSlide = strategy.quick_wins?.length ? `
    <div class="slide">
      <div class="slide-header"><span class="slide-num">Quick Wins</span><span class="brand">PerfHub</span></div>
      <h2>Immediate Actions & Timeline</h2>
      <div style="margin-top:16px">
        ${strategy.quick_wins.map(w => {
          const action = typeof w === 'object' ? w.action : w
          const timeline = typeof w === 'object' ? w.timeline : null
          const impact = typeof w === 'object' ? w.expected_impact : null
          return `<div style="display:flex;gap:12px;padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:8px;align-items:flex-start">
            ${timeline ? `<span style="background:#1a1a2e;color:#e8c97e;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap">${timeline}</span>` : '<span style="color:#16a34a;font-weight:700;font-size:16px">✓</span>'}
            <div><p style="font-size:13px;color:#374151;margin:0">${action}</p>${impact ? `<p style="font-size:11px;color:#6b7280;margin:4px 0 0">${impact}</p>` : ''}</div>
          </div>`
        }).join('')}
      </div>
    </div>` : ''

    win.document.write(`<!DOCTYPE html><html><head><title>Strategy — ${client.name}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5}
      .slide{width:960px;min-height:540px;background:white;margin:0 auto 20px;padding:48px;page-break-after:always;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
      .slide-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #f0f0f0}
      .slide-num{font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}
      .brand{background:#1a1a2e;color:#e8c97e;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600}
      h1{font-size:32px;font-weight:700;color:#111827}
      h2{font-size:22px;font-weight:600;color:#111827}
      h3{font-size:14px;font-weight:600;color:#111827;margin-bottom:8px}
      .label{font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
      .value{font-size:20px;font-weight:600;color:#111827}
      .chip{background:#f3f4f6;color:#374151;padding:3px 10px;border-radius:20px;font-size:11px}
      .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}
      .kpi{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px}
      .alert{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-top:16px;color:#991b1b;font-size:13px}
      @media print{body{background:white}.slide{box-shadow:none;margin:0;border-radius:0;width:100%;min-height:auto}}
    </style></head><body>

    <div class="slide">
      <div class="slide-header"><span class="slide-num">Strategy Overview</span><span class="brand">PerfHub</span></div>
      <h1>${client.name}</h1>
      <p style="font-size:16px;color:#6b7280;margin-top:8px">${goal} · ${duration} · AED ${Number(budget||0).toLocaleString()}/month</p>
      ${strategy.tracking_alert ? `<div class="alert">⚠️ ${strategy.tracking_alert}</div>` : ''}
      ${strategy.executive_summary ? `<p style="font-size:14px;color:#374151;line-height:1.7;margin-top:24px;padding:20px;background:#f9fafb;border-radius:8px;border-left:4px solid #1a1a2e">${strategy.executive_summary}</p>` : ''}
      <div style="margin-top:20px;font-size:11px;color:#9ca3af">Based on: ${dataSources.join(' · ')}</div>
    </div>

    ${strategy.expected_kpis ? `
    <div class="slide">
      <div class="slide-header"><span class="slide-num">Expected KPIs</span><span class="brand">PerfHub</span></div>
      <h2>Projected Performance</h2>
      <div class="kpi-grid">
        ${[['Expected ROAS',strategy.expected_kpis.expected_roas],['Expected CPA',strategy.expected_kpis.expected_cpa],['Monthly Conversions',strategy.expected_kpis.monthly_conversions],['Monthly Impressions',strategy.expected_kpis.monthly_impressions],['Monthly Clicks',strategy.expected_kpis.monthly_clicks],['Expected CPL',strategy.expected_kpis.expected_cpl]].filter(([,v])=>v).map(([l,v])=>`<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div></div>`).join('')}
      </div>
    </div>` : ''}

    ${channelSlides}
    ${keywordSlide}

    ${strategy.target_audience ? `
    <div class="slide">
      <div class="slide-header"><span class="slide-num">Target Audience</span><span class="brand">PerfHub</span></div>
      <h2>Who We're Targeting</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:20px">
        ${strategy.target_audience.primary ? `<div><h3>Primary Audience</h3><p style="font-size:13px;color:#374151;line-height:1.6">${strategy.target_audience.primary}</p></div>` : ''}
        ${strategy.target_audience.secondary ? `<div><h3>Secondary Audience</h3><p style="font-size:13px;color:#374151;line-height:1.6">${strategy.target_audience.secondary}</p></div>` : ''}
      </div>
      ${strategy.target_audience.interests?.length ? `<div style="margin-top:20px"><h3>Key Interests</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${strategy.target_audience.interests.map(t=>`<span class="chip">${t}</span>`).join('')}</div></div>` : ''}
    </div>` : ''}

    ${quickWinsSlide}

    <div class="slide">
      <div class="slide-header"><span class="slide-num">Next Steps</span><span class="brand">PerfHub</span></div>
      <h2>Ready to Execute</h2>
      <p style="font-size:14px;color:#6b7280;margin-top:12px">This strategy was generated by PerfHub based on ${dataSources.join(', ')}.</p>
      <p style="font-size:13px;color:#9ca3af;margin-top:8px">Generated ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p>
    </div>

    <script>window.onload=()=>window.print()</script>
    </body></html>`)
    win.document.close()
  }

  async function run() {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    setRunning(true); setStrategy(null)
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'strategy', payload: { clientName: client.name, industry: client.industry, goal, budget: budget || client.monthly_budget || 10000, duration, channels, currentRoas: latestRoas } })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setStrategy(data.strategy)
      const supabase = createBrowserClient()
      await supabase.from('strategies').insert([{ client_id: clientId, title: `${goal} — ${duration}`, strategy_json: data.strategy, summary: data.strategy.executive_summary }])
      const { data: past } = await supabase.from('strategies').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5)
      setPastStrategies(past || [])
    } catch (e) { alert('Error: ' + e.message) }
    setProgress(prev => ({ ...prev, strategy: true }))
    setRunning(false)
  }

  const Section = ({ id, title, children }) => (
    <div className="card overflow-hidden mb-3">
      <button className="w-full flex items-center justify-between p-4 text-left" onClick={() => setExpanded(expanded === id ? null : id)}>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {expanded === id ? <ChevronUp size={15} className="text-gray-400"/> : <ChevronDown size={15} className="text-gray-400"/>}
      </button>
      {expanded === id && <div className="border-t border-gray-50 p-4">{children}</div>}
    </div>
  )

  const roleColor = { awareness: 'badge-gray', consideration: 'badge-amber', conversion: 'badge-green', retention: 'badge-green' }

  return (
    <div>
      <StepTracker current="strategy" progress={progress} clientId={clientId}/>
      <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Strategy & media plan</h1>
          <p className="text-sm text-gray-400 mt-0.5">Agent 3 — AI-generated strategy, channel plan, budget split and KPIs</p>
        </div>
        <div className="flex gap-2">
          {strategy && <button className="btn-secondary" onClick={exportPPT}><Download size={13}/> Export PPT</button>}
          <button className="btn-primary" onClick={run} disabled={running || !clientId}><Play size={13}/>{running ? 'Building...' : 'Build strategy'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div><label className="block text-xs text-gray-500 mb-1.5">Client</label>
          <select className="select" value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Primary goal</label>
          <select className="select" value={goal} onChange={e => setGoal(e.target.value)}>{GOALS.map(g => <option key={g}>{g}</option>)}</select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Monthly budget (AED)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">AED</span>
            <input className="input pl-10" type="number" placeholder="10000" value={budget} onChange={e => setBudget(e.target.value)}/>
          </div>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Duration</label>
          <select className="select" value={duration} onChange={e => setDuration(e.target.value)}>
            {['1 month','3 months','6 months','12 months'].map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {dataSources.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
          <Info size={13} className="text-blue-500 shrink-0"/>
          <p className="text-xs text-blue-700">Strategy will be based on: <strong>{dataSources.join(' · ')}</strong></p>
        </div>
      )}

      <div className="card p-4 mb-6">
        <p className="text-xs font-medium text-gray-500 mb-3">Channels to include</p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map(ch => <button key={ch} onClick={() => setChannels(prev => prev.includes(ch) ? prev.filter(c=>c!==ch) : [...prev, ch])} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${channels.includes(ch) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>{ch}</button>)}
        </div>
      </div>

      {running && <ThinkingBar message="Searching web for current market data and building your strategy..."/>}

      {strategy && (
        <>
          {strategy.tracking_alert && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl mb-4">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-medium text-red-700 mb-0.5">Tracking issue detected</p>
                <p className="text-xs text-red-600">{strategy.tracking_alert}</p>
              </div>
            </div>
          )}

          <div className="card p-4 mb-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Executive summary</p>
              {dataSources.length > 0 && <span className="text-[10px] text-gray-400">Based on: {dataSources.join(' · ')}</span>}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{strategy.executive_summary}</p>
            {strategy.market_opportunity && <p className="text-sm text-gray-500 leading-relaxed mt-2">{strategy.market_opportunity}</p>}
          </div>

          {strategy.expected_kpis && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[['Expected ROAS', strategy.expected_kpis.expected_roas],['Expected CPA', strategy.expected_kpis.expected_cpa],['Monthly conversions', strategy.expected_kpis.monthly_conversions],['Monthly impressions', strategy.expected_kpis.monthly_impressions],['Monthly clicks', strategy.expected_kpis.monthly_clicks],['Expected CPL', strategy.expected_kpis.expected_cpl]].filter(([,v])=>v).map(([l,v]) => (
                <div key={l} className="card p-3"><p className="text-xs text-gray-400 mb-1">{l}</p><p className="text-lg font-medium text-gray-900">{v}</p></div>
              ))}
            </div>
          )}

          <Section id="channels" title="Channel strategy & budget split">
            <div className="space-y-4">
              {(strategy.channel_strategy||[]).map((ch, i) => (
                <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{ch.channel}</p>
                      <span className={roleColor[ch.role]||'badge-gray'}>{ch.role}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">AED {(ch.monthly_budget||0).toLocaleString()}/mo</p>
                      <p className="text-xs text-gray-400">{ch.budget_percentage}% of budget</p>
                    </div>
                  </div>
                  <div className="p-3">
                    {ch.bid_strategy && <p className="text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg mb-2 font-medium">Bid strategy: {ch.bid_strategy}</p>}
                    <p className="text-xs text-gray-500 mb-3">{ch.rationale}</p>
                    {ch.budget_split?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Budget split by campaign type</p>
                        <div className="space-y-1.5">
                          {ch.budget_split.map((b, j) => (
                            <div key={j} className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gray-900 rounded-full" style={{width: `${b.percentage}%`}}/>
                              </div>
                              <span className="text-xs text-gray-600 w-40 shrink-0">{b.campaign_type}</span>
                              <span className="text-xs font-medium text-gray-900 w-24 text-right shrink-0">AED {(b.budget_aed||0).toLocaleString()}</span>
                              <span className="text-xs text-gray-400 w-8 text-right shrink-0">{b.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {ch.benchmarks && <div className="flex gap-3 flex-wrap mt-3">{Object.entries(ch.benchmarks).map(([k,v]) => <span key={k} className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{k.toUpperCase()}: {v}</span>)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {strategy.keyword_strategy && (
            <Section id="keywords" title="Keyword strategy">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Branded keywords ({strategy.keyword_strategy.branded_keywords?.length||0})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(strategy.keyword_strategy.branded_keywords||[]).map((k,i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{k}</span>)}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Non-brand keywords ({strategy.keyword_strategy.non_brand_keywords?.length||0})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(strategy.keyword_strategy.non_brand_keywords||[]).map((k,i) => <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">{k}</span>)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Account-level negatives ({strategy.keyword_strategy.account_level_negatives?.length||0})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(strategy.keyword_strategy.account_level_negatives||[]).map((k,i) => <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">-{k}</span>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Campaign-level negatives ({strategy.keyword_strategy.campaign_level_negatives?.length||0})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(strategy.keyword_strategy.campaign_level_negatives||[]).map((k,i) => <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">-{k}</span>)}
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          <Section id="audience" title="Target audience">
            {strategy.target_audience && (
              <div className="space-y-3">
                {[['Primary', strategy.target_audience.primary],['Secondary', strategy.target_audience.secondary],['Demographics', strategy.target_audience.demographics]].filter(([,v])=>v).map(([l,v]) => <div key={l}><p className="text-xs text-gray-400 mb-1">{l}</p><p className="text-sm text-gray-700">{v}</p></div>)}
                {strategy.target_audience.interests?.length > 0 && <div><p className="text-xs text-gray-400 mb-2">Interests</p><div className="flex flex-wrap gap-2">{strategy.target_audience.interests.map((t,i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{t}</span>)}</div></div>}
              </div>
            )}
          </Section>

          <Section id="mediaplan" title="Media plan timeline">
            <div className="space-y-3">
              {Object.entries(strategy.media_plan||{}).map(([month, desc]) => (
                <div key={month} className="flex gap-3"><div className="w-16 shrink-0 text-xs font-medium text-gray-500 capitalize pt-0.5">{month.replace('month','Month ')}</div><p className="text-sm text-gray-700">{desc}</p></div>
              ))}
            </div>
          </Section>

          <Section id="creative" title="Creative direction">
            {strategy.creative_direction && (
              <div className="space-y-3">
                <div><p className="text-xs text-gray-400 mb-1">Tone</p><p className="text-sm text-gray-700">{strategy.creative_direction.tone}</p></div>
                {strategy.creative_direction.messaging_pillars?.length > 0 && <div><p className="text-xs text-gray-400 mb-2">Messaging pillars</p><div className="space-y-1">{strategy.creative_direction.messaging_pillars.map((p,i) => <div key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-gray-300">—</span>{p}</div>)}</div></div>}
                {strategy.creative_direction.formats?.length > 0 && <div><p className="text-xs text-gray-400 mb-2">Ad formats</p><div className="flex flex-wrap gap-2">{strategy.creative_direction.formats.map((f,i) => <span key={i} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-1 rounded">{f}</span>)}</div></div>}
              </div>
            )}
          </Section>

          {strategy.quick_wins?.length > 0 && (
            <Section id="quickwins" title="Quick wins & timeline">
              <div className="space-y-2">
                {strategy.quick_wins.map((w,i) => {
                  const action = typeof w === 'object' ? w.action : w
                  const timeline = typeof w === 'object' ? w.timeline : null
                  const impact = typeof w === 'object' ? w.expected_impact : null
                  return (
                    <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      {timeline && <span className="text-[10px] font-medium bg-gray-900 text-white px-2 py-1 rounded shrink-0 h-fit">{timeline}</span>}
                      <div>
                        <p className="text-sm text-gray-700">{action}</p>
                        {impact && <p className="text-xs text-green-600 mt-1">→ {impact}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}
        </>
      )}

      {pastStrategies.length > 0 && (
        <div className="mt-6"><p className="text-sm font-medium text-gray-900 mb-3">Past strategies</p>
          <div className="space-y-2">
            {pastStrategies.map(s => (
              <div key={s.id} className="card px-4 py-3 flex items-center justify-between">
                <div><p className="text-sm text-gray-700">{s.title}</p><p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div>
                <button className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1" onClick={() => s.strategy_json && setStrategy(s.strategy_json)}>View</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {!running && strategy && (
        <NextBar current="strategy" clientId={clientId} label="Strategy complete — ready to generate ad creative"/>
      )}
      </div>
    </div>
  )
}

export default function StrategyPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading...</div>}>
      <StrategyPageInner />
    </Suspense>
  )
}
