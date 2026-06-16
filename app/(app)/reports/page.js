'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { Download, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function ReportsPage() {
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [client, setClient] = useState(null)
  const [audits, setAudits] = useState([])
  const [strategies, setStrategies] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [marketAudits, setMarketAudits] = useState([])
  const [creatives, setCreatives] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  async function load(cid) {
    setLoading(true)
    const supabase = createBrowserClient()
    const [
      { data: cl },
      { data: a },
      { data: s },
      { data: c },
      { data: m },
      { data: cr },
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', cid).single(),
      supabase.from('audits').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(5),
      supabase.from('strategies').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(3),
      supabase.from('competitor_analyses').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(10),
      supabase.from('market_audits').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(1),
      supabase.from('client_creatives').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(1),
    ])
    setClient(cl)
    setAudits(a || [])
    setStrategies(s || [])
    setCompetitors(c || [])
    setMarketAudits(m || [])
    setCreatives(cr || [])
    setLoading(false)
  }

  function exportPDF() {
    const latestAudit = audits[0]
    const latestStrategy = strategies[0]?.strategy_json
    const latestMarket = marketAudits[0]
    const latestCreative = creatives[0]?.creative_json
    const metrics = latestAudit?.metrics_json || []
    const recos = latestAudit?.recommendations_json || []

    const sIcon = s => s === 'good' ? '↑' : s === 'bad' ? '↓' : '→'
    const sColor = s => s === 'good' ? '#16a34a' : s === 'bad' ? '#dc2626' : '#d97706'

    const metricsHtml = metrics.length ? `
      <div class="section">
        <h2>Performance Metrics</h2>
        <div class="metrics-grid">
          ${metrics.map(m => `
            <div class="metric-card" style="border-left: 3px solid ${sColor(m.status)}">
              <div class="metric-label">${m.label.toUpperCase()}</div>
              <div class="metric-value">${m.value}</div>
              <div class="metric-bench">${sIcon(m.status)} ${m.bench}</div>
            </div>`).join('')}
        </div>
      </div>` : ''

    const auditHtml = latestAudit?.summary ? `
      <div class="section">
        <h2>Account Audit — ${latestAudit.platform === 'google' ? 'Google Ads' : 'Meta Ads'}</h2>
        <p class="body-text">${latestAudit.summary}</p>
        ${recos.length ? `
          <h3>Prioritised Recommendations</h3>
          ${recos.map((r, i) => `
            <div class="reco">
              <div class="reco-num">${i + 1}</div>
              <div>
                <div class="reco-title">${r.title}</div>
                <div class="reco-desc">${r.desc}</div>
                <span class="badge" style="background:${r.impact === 'High' ? '#dcfce7' : '#fef9c3'};color:${r.impact === 'High' ? '#166534' : '#854d0e'}">${r.impact} impact</span>
              </div>
            </div>`).join('')}` : ''}
      </div>` : ''

    const marketHtml = latestMarket?.summary ? `
      <div class="section">
        <h2>Market Intelligence — ${latestMarket.market}</h2>
        <p class="body-text">${latestMarket.summary}</p>
        ${latestMarket.benchmark_json ? `
          <h3>Industry Benchmarks</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:12px">
            ${latestMarket.benchmark_json.google ? `
              <div>
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Google Ads</div>
                ${Object.entries(latestMarket.benchmark_json.google).map(([k, v]) => `
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:12px">
                    <span style="color:#6b7280">${k.replace(/_/g,' ').replace(/\b(cpc|cpm|ctr|cpa|roas|cpl|cac)\b/gi, m => m.toUpperCase()).replace(/\b\w/g, c => c.toUpperCase())}</span>
                    <span style="font-weight:600;color:#111827">${v}</span>
                  </div>`).join('')}
              </div>` : ''}
            ${latestMarket.benchmark_json.meta ? `
              <div>
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Meta Ads</div>
                ${Object.entries(latestMarket.benchmark_json.meta).map(([k, v]) => `
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:12px">
                    <span style="color:#6b7280">${k.replace(/_/g,' ').replace(/\b(cpc|cpm|ctr|cpa|roas|cpl|cac)\b/gi, m => m.toUpperCase()).replace(/\b\w/g, c => c.toUpperCase())}</span>
                    <span style="font-weight:600;color:#111827">${v}</span>
                  </div>`).join('')}
              </div>` : ''}
          </div>` : ''}
      </div>` : ''

    const competitorHtml = competitors.length ? `
      <div class="section">
        <h2>Competitor Intelligence</h2>
        ${competitors.slice(0, 3).map(c => {
          const a = c.analysis_json
          if (!a) return ''
          return `
            <div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;overflow:hidden">
              <div style="padding:12px 16px;background:#f9fafb;display:flex;justify-content:space-between;align-items:center">
                <div style="font-size:14px;font-weight:600;color:#111827">${c.competitor_name}</div>
                <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:${a.threat_level==='High'?'#fef2f2':'#fffbeb'};color:${a.threat_level==='High'?'#dc2626':'#92400e'}">${a.threat_level || 'Medium'} threat</span>
              </div>
              <div style="padding:12px 16px">
                <p style="font-size:12px;color:#374151;margin:0 0 8px">${a.overview || ''}</p>
                ${a.paid_advertising?.estimated_monthly_spend ? `<p style="font-size:12px;margin:0 0 4px"><strong>Est. Monthly Spend:</strong> ${a.paid_advertising.estimated_monthly_spend}</p>` : ''}
                ${(a.paid_advertising?.estimated_platforms||[]).length ? `<p style="font-size:12px;margin:0 0 4px"><strong>Platforms:</strong> ${a.paid_advertising.estimated_platforms.join(', ')}</p>` : ''}
                ${a.opportunities_for_client?.length ? `<p style="font-size:12px;color:#16a34a;margin:8px 0 0"><strong>Your opportunity:</strong> ${a.opportunities_for_client[0]}</p>` : ''}
              </div>
            </div>`
        }).join('')}
      </div>` : ''

    const strategyHtml = latestStrategy ? `
      <div class="section">
        <h2>Strategy & Media Plan</h2>
        ${latestStrategy.executive_summary ? `<p class="body-text">${latestStrategy.executive_summary}</p>` : ''}
        ${latestStrategy.expected_kpis ? `
          <h3>Expected KPIs</h3>
          <div class="metrics-grid">
            ${[['ROAS', latestStrategy.expected_kpis.expected_roas], ['CPA', latestStrategy.expected_kpis.expected_cpa], ['Monthly Conversions', latestStrategy.expected_kpis.monthly_conversions], ['Monthly Clicks', latestStrategy.expected_kpis.monthly_clicks], ['Impressions/mo', latestStrategy.expected_kpis.monthly_impressions], ['CPL', latestStrategy.expected_kpis.expected_cpl]].filter(([, v]) => v && v !== 'N/A').map(([l, v]) => `
              <div class="metric-card" style="border-left:3px solid #1a1a2e">
                <div class="metric-label">${l.toUpperCase()}</div>
                <div class="metric-value" style="font-size:18px">${v}</div>
              </div>`).join('')}
          </div>` : ''}
        ${latestStrategy.channel_strategy?.length ? `
          <h3>Channel Allocation</h3>
          ${latestStrategy.channel_strategy.map(ch => `
            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:14px;font-weight:600;color:#111827">${ch.channel}</span>
                <span style="font-size:14px;font-weight:700;color:#1a1a2e">AED ${(ch.monthly_budget||0).toLocaleString()}/mo · ${ch.budget_percentage}%</span>
              </div>
              <p style="font-size:12px;color:#6b7280;margin:0">${ch.rationale}</p>
            </div>`).join('')}` : ''}
        ${latestStrategy.quick_wins?.length ? `
          <h3>Launch Quick Wins</h3>
          ${latestStrategy.quick_wins.map(w => `
            <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6">
              ${w.timeline ? `<span style="font-size:10px;font-weight:700;background:#1a1a2e;color:#e8c97e;padding:3px 8px;border-radius:4px;white-space:nowrap;height:fit-content;margin-top:2px">${w.timeline}</span>` : ''}
              <div>
                <div style="font-size:13px;font-weight:500;color:#111827">${w.action}</div>
                ${w.expected_impact ? `<div style="font-size:11px;color:#16a34a;margin-top:2px">→ ${w.expected_impact}</div>` : ''}
              </div>
            </div>`).join('')}` : ''}
      </div>` : ''

    const creativeHtml = latestCreative?.ads?.length ? `
      <div class="section">
        <h2>Ad Creative Variants</h2>
        ${latestCreative.ads.slice(0, 2).map(ad => `
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
            <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px">${ad.variant} — ${ad.angle}</div>
            ${ad.headlines?.length ? `
              <div style="margin-top:10px">
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Headlines</div>
                ${ad.headlines.slice(0, 5).map(h => `<div style="font-size:12px;color:#374151;padding:4px 0;border-bottom:1px solid #f9fafb">${h}</div>`).join('')}
              </div>` : ''}
            ${ad.descriptions?.length ? `
              <div style="margin-top:10px">
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Descriptions</div>
                ${ad.descriptions.slice(0, 3).map(d => `<div style="font-size:12px;color:#374151;padding:4px 0;border-bottom:1px solid #f9fafb">${d}</div>`).join('')}
              </div>` : ''}
          </div>`).join('')}
        ${latestCreative.ab_test_recommendation ? `<p style="font-size:12px;color:#374151;background:#f0f9ff;border-left:3px solid #0ea5e9;padding:10px 14px;border-radius:4px"><strong>A/B Test Recommendation:</strong> ${latestCreative.ab_test_recommendation}</p>` : ''}
      </div>` : ''

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Performance Report — ${client?.name || 'Client'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; padding: 0; }
    .cover { background: #1a1a2e; color: white; padding: 48px; min-height: 160px; display: flex; justify-content: space-between; align-items: flex-start; }
    .cover-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .cover-sub { font-size: 14px; color: #8090c0; }
    .brand { font-size: 13px; font-weight: 700; color: #e8c97e; background: rgba(232,201,126,0.15); padding: 6px 16px; border-radius: 6px; border: 1px solid rgba(232,201,126,0.3); }
    .content { padding: 40px 48px; max-width: 900px; margin: 0 auto; }
    .section { margin-bottom: 40px; padding-bottom: 32px; border-bottom: 1px solid #f3f4f6; }
    .section:last-child { border-bottom: none; }
    h2 { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #f3f4f6; }
    h3 { font-size: 14px; font-weight: 600; color: #374151; margin: 20px 0 10px; }
    .body-text { font-size: 13px; color: #374151; line-height: 1.7; white-space: pre-wrap; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
    .metric-card { padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .metric-label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
    .metric-value { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 4px; }
    .metric-bench { font-size: 11px; color: #9ca3af; }
    .reco { display: flex; gap: 12px; padding: 14px; border: 1px solid #f0f0f0; border-radius: 8px; margin-bottom: 8px; }
    .reco-num { width: 24px; height: 24px; border-radius: 50%; background: #1a1a2e; color: #e8c97e; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .reco-title { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 4px; }
    .reco-desc { font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 6px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
    .footer { background: #f9fafb; padding: 24px 48px; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-top: 40px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="cover">
    <div>
      <div class="cover-title">${client?.name || 'Client'}</div>
      <div class="cover-sub">Performance Marketing Report</div>
      <div class="cover-sub" style="margin-top:6px">${client?.industry || ''} · Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
    <div class="brand">PerfHub</div>
  </div>
  <div class="content">
    <div class="section" style="margin-top:8px">
      <h2>Client Overview</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${[['Industry', client?.industry], ['Monthly Budget', client?.monthly_budget ? `AED ${Number(client.monthly_budget).toLocaleString()}` : '—'], ['Website', client?.website || '—'], ['Audits Run', audits.length], ['Competitors Tracked', competitors.length], ['Strategies Built', strategies.length]].map(([l, v]) => `
          <div style="padding:14px;border:1px solid #e5e7eb;border-radius:8px">
            <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${l}</div>
            <div style="font-size:14px;font-weight:600;color:#111827">${v || '—'}</div>
          </div>`).join('')}
      </div>
    </div>
    ${metricsHtml}
    ${auditHtml}
    ${marketHtml}
    ${competitorHtml}
    ${strategyHtml}
    ${creativeHtml}
  </div>
  <div class="footer">
    <span>Generated by PerfHub · ${new Date().toLocaleDateString('en-GB')}</span>
    <span>Confidential — prepared for ${client?.name || 'client'}</span>
  </div>
</body>
</html>`)
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  const latestStrategy = strategies[0]?.strategy_json
  const latestAudit = audits[0]
  const latestMarket = marketAudits[0]
  const metrics = latestAudit?.metrics_json || []
  const sIcon = s => s === 'good' ? <TrendingUp size={12} className="text-status-green"/> : s === 'bad' ? <TrendingDown size={12} className="text-status-red"/> : <Minus size={12} className="text-status-amber"/>
  const sBg = { good: 'bg-status-green-bg/30 border-status-green/20', bad: 'bg-status-red-bg/30 border-status-red/20', warn: 'bg-status-amber-bg/30 border-status-amber/20' }

  const hasData = audits.length > 0 || strategies.length > 0 || marketAudits.length > 0

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Client Report</h1>
          <p className="text-sm text-text-secondary mt-0.5">Agent 5 — consolidated client-facing report with PDF export</p>
        </div>
        <div className="flex gap-2">
          {clientId && <button className="btn-secondary" onClick={() => load(clientId)}><RefreshCw size={13}/> Refresh</button>}
          {hasData && <button className="btn-primary" onClick={exportPDF}><Download size={13}/> Download PDF</button>}
        </div>
      </div>

      <div className="card p-4 mb-6">
        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Client</label>
        <select className="select max-w-xs" value={clientId} onChange={e => { setClientId(e.target.value); if (e.target.value) load(e.target.value) }}>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!clientId && (
        <div className="card p-16 text-center">
          <p className="text-sm font-semibold text-text-primary mb-2">Select a client to build their report</p>
          <p className="text-xs text-text-secondary">All completed steps — audit, competitors, strategy, creative — will be pulled together into one downloadable PDF</p>
        </div>
      )}

      {clientId && loading && (
        <div className="flex justify-center py-16">
          <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div>
        </div>
      )}

      {clientId && !loading && hasData && (
        <div className="space-y-4">

          {/* Client overview */}
          <div className="card p-5">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Client Overview</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Industry', client?.industry],
                ['Monthly Budget', client?.monthly_budget ? `AED ${Number(client.monthly_budget).toLocaleString()}` : '—'],
                ['Website', client?.website || '—'],
                ['Audits Run', audits.length],
                ['Competitors Tracked', competitors.length],
                ['Strategies Built', strategies.length],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg p-3" style={{background:'#111827',border:'1px solid #1e2a48'}}>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{l}</p>
                  <p className="text-sm font-bold text-text-primary">{v || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Latest metrics */}
          {metrics.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Latest Audit Metrics — {latestAudit.platform === 'google' ? 'Google Ads' : 'Meta Ads'}</p>
              <div className="grid grid-cols-3 gap-3">
                {metrics.map(m => (
                  <div key={m.label} className={`card p-4 ${sBg[m.status] || ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">{m.label}</p>
                      {sIcon(m.status)}
                    </div>
                    <p className="text-2xl font-bold text-text-primary">{m.value}</p>
                    <p className="text-xs text-text-secondary mt-1">{m.bench}</p>
                  </div>
                ))}
              </div>
              {latestAudit.summary && (
                <div className="mt-4 pt-4 border-t border-surface-border">
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">AI Analysis</p>
                  <p className="text-sm text-text-primary leading-relaxed">{latestAudit.summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Market intel */}
          {latestMarket && (
            <div className="card p-5">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Market Intelligence</p>
              <p className="text-sm text-brand-gold font-semibold mb-3">{latestMarket.market}</p>
              {latestMarket.summary && <p className="text-sm text-text-primary leading-relaxed mb-4">{latestMarket.summary?.slice(0, 400)}...</p>}
              {latestMarket.benchmark_json && (
                <div className="grid grid-cols-2 gap-4">
                  {['google','meta'].map(platform => latestMarket.benchmark_json[platform] && (
                    <div key={platform}>
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">{platform === 'google' ? 'Google Ads' : 'Meta Ads'}</p>
                      {Object.entries(latestMarket.benchmark_json[platform]).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-1.5 border-b border-surface-border last:border-0">
                          <span className="text-xs text-text-secondary">{k.replace(/_/g,' ').replace(/\b(cpc|cpm|ctr|cpa|roas|cpl|cac)\b/gi, m => m.toUpperCase()).replace(/\b\w/g, c => c.toUpperCase())}</span>
                          <span className="text-xs font-bold text-text-primary">{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Competitors */}
          {competitors.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Competitor Intelligence</p>
              <div className="space-y-3">
                {competitors.slice(0, 3).map(c => {
                  const a = c.analysis_json
                  if (!a) return null
                  return (
                    <div key={c.id} className="rounded-lg overflow-hidden" style={{border:'1px solid #1e2a48'}}>
                      <div className="flex items-center justify-between px-4 py-3" style={{background:'#111827'}}>
                        <p className="text-sm font-bold text-text-primary">{c.competitor_name}</p>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${a.threat_level==='High'?'bg-status-red-bg text-status-red':'bg-status-amber-bg text-status-amber'}`}>{a.threat_level || 'Medium'} threat</span>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm text-text-primary mb-2">{a.overview}</p>
                        {a.opportunities_for_client?.[0] && <p className="text-xs text-status-green">→ {a.opportunities_for_client[0]}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Strategy KPIs */}
          {latestStrategy?.expected_kpis && (
            <div className="card p-5">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Strategy & Expected KPIs</p>
              {latestStrategy.executive_summary && <p className="text-sm text-text-primary leading-relaxed mb-4">{latestStrategy.executive_summary}</p>}
              <div className="grid grid-cols-3 gap-3">
                {[['ROAS', latestStrategy.expected_kpis.expected_roas],['CPA', latestStrategy.expected_kpis.expected_cpa],['Monthly Conversions', latestStrategy.expected_kpis.monthly_conversions],['Monthly Clicks', latestStrategy.expected_kpis.monthly_clicks],['Impressions/mo', latestStrategy.expected_kpis.monthly_impressions],['CPL', latestStrategy.expected_kpis.expected_cpl]].filter(([,v])=>v&&v!=='N/A').map(([l,v]) => (
                  <div key={l} className="rounded-lg p-4" style={{background:'#111827',border:'1px solid #1e2a48'}}>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{l}</p>
                    <p className="text-2xl font-bold text-brand-gold">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF CTA */}
          <div className="next-bar">
            <div>
              <p className="text-sm font-bold text-text-primary">Ready to export</p>
              <p className="text-xs text-text-secondary mt-0.5">Download a full PDF report to share with your client</p>
            </div>
            <button className="btn-primary" onClick={exportPDF}><Download size={14}/> Download PDF Report</button>
          </div>
        </div>
      )}

      {clientId && !loading && !hasData && (
        <div className="card p-16 text-center">
          <p className="text-sm font-semibold text-text-primary mb-1">No data yet for this client</p>
          <p className="text-xs text-text-secondary">Complete the audit, competitor, and strategy steps first</p>
        </div>
      )}
    </div>
  )
}
