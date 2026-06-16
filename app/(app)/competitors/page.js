'use client'
import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Plus, Play, Trash2, ExternalLink, Download } from 'lucide-react'
import { StepTracker, NextBar, ThinkingBar, LockedState } from '@/components/StepComponents'

function CompetitorPageInner() {
  const params = useSearchParams()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(params.get('client') || '')
  const [competitors, setCompetitors] = useState([{ name: '', url: '' }])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [pastAnalyses, setPastAnalyses] = useState([])
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState({})
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  useEffect(() => {
    if (!clientId) { setProgress({}); setIsLocked(false); return }
    const supabase = createBrowserClient()

    // Load competitors from previous audit
    supabase.from('market_audits').select('competitors').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data?.[0]?.competitors?.length) {
          const pre = data[0].competitors.filter(c => c.name).map(c => ({ name: c.name, url: c.website || '' }))
          if (pre.length) setCompetitors(pre)
        }
      })

    // Load past analyses
    supabase.from('competitor_analyses').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => {
        setPastAnalyses(data || [])
        if (data && data.length > 0) {
          const loaded = data.map(a => ({ competitor: { name: a.competitor_name, url: a.competitor_url }, analysis: a.analysis_json, saved: true }))
          setResults(loaded)
        }
      })

    // Check progress
    Promise.all([
      supabase.from('audits').select('id').eq('client_id', clientId).limit(1),
      supabase.from('market_audits').select('id').eq('client_id', clientId).limit(1),
      supabase.from('competitor_analyses').select('id').eq('client_id', clientId).limit(1),
      supabase.from('strategies').select('id').eq('client_id', clientId).limit(1),
      supabase.from('client_creatives').select('id').eq('client_id', clientId).limit(1),
    ]).then(([audit, market, comp, strat, creative]) => {
      const auditDone = (audit.data?.length > 0) || (market.data?.length > 0)
      setProgress({
        audit: auditDone,
        competitor: comp.data?.length > 0,
        strategy: strat.data?.length > 0,
        creative: creative.data?.length > 0,
        reports: strat.data?.length > 0,
      })
      setIsLocked(!auditDone)
    })
  }, [clientId])

  async function run() {
    const valid = competitors.filter(c => c.name.trim())
    if (!valid.length || !clientId) return
    const client = clients.find(c => c.id === clientId)
    setRunning(true); setResults([]); setStatus('')
    for (const comp of valid) {
      setStatus(`Searching web and analysing ${comp.name}...`)
      try {
        const res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'competitor', payload: { clientName: client.name, industry: client.industry, competitorName: comp.name, competitorUrl: comp.url } })
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        setResults(prev => [...prev, { competitor: comp, analysis: data.analysis }])
        const supabase = createBrowserClient()
        await supabase.from('competitor_analyses').insert([{ client_id: clientId, competitor_name: comp.name, competitor_url: comp.url, analysis_json: data.analysis, summary: data.analysis.overview }])
      } catch (e) {
        setResults(prev => [...prev, { competitor: comp, error: e.message }])
      }
    }
    setStatus('')
    setRunning(false)
    const supabase = createBrowserClient()
    const { data } = await supabase.from('competitor_analyses').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10)
    setPastAnalyses(data || [])
    setProgress(prev => ({ ...prev, competitor: true }))
  }

  function exportPDF() {
    const client = clients.find(c => c.id === clientId)
    const win = window.open('', '_blank')
    const threatBg = { High: '#fef2f2', Medium: '#fffbeb', Low: '#f0fdf4' }
    const threatColor = { High: '#991b1b', Medium: '#92400e', Low: '#166534' }
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    win.document.write(`<!DOCTYPE html><html><head><title>Competitor Intel — ${client?.name}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;padding:40px 60px;background:white}h1{font-size:24px;font-weight:700;margin:0}h2{font-size:14px;font-weight:600;margin:24px 0 12px}p{font-size:13px;color:#374151;line-height:1.6}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #f0f0f0">
      <div><h1>${client?.name || 'Client'} — Competitor Intel</h1><p style="color:#9ca3af;margin:4px 0 0">Agent 2 · ${results.length} competitors analysed · ${now}</p></div>
      <div style="background:#1a1a2e;color:#e8c97e;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600">PerfHub</div>
    </div>
    ${results.map(r => {
      const a = r.analysis
      const threat = a?.threat_level || 'Medium'
      return `
        <div style="border:1px solid #e5e7eb;border-radius:10px;margin-bottom:20px;overflow:hidden">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f9fafb;border-bottom:1px solid #f0f0f0">
            <div><div style="font-size:15px;font-weight:600;color:#111827">${r.competitor.name}</div>${r.competitor.url?`<div style="font-size:11px;color:#9ca3af">${r.competitor.url.replace(/https?:\/\//,'')}</div>`:''}</div>
            <span style="font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;background:${threatBg[threat]};color:${threatColor[threat]}">${threat} threat</span>
          </div>
          ${a?.overview?`<div style="padding:12px 16px;border-bottom:1px solid #f0f0f0"><p style="font-size:13px;color:#374151;line-height:1.6">${a.overview}</p></div>`:''}
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #f0f0f0">
            <div style="padding:12px 16px;border-right:1px solid #f0f0f0"><div style="font-size:10px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Strengths</div>${(a?.strengths||[]).map(s=>`<div style="font-size:11px;background:#f0fdf4;color:#166534;padding:4px 8px;border-radius:5px;margin-bottom:4px">${s}</div>`).join('')}</div>
            <div style="padding:12px 16px;border-right:1px solid #f0f0f0"><div style="font-size:10px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Weaknesses</div>${(a?.weaknesses||[]).map(w=>`<div style="font-size:11px;background:#fef2f2;color:#991b1b;padding:4px 8px;border-radius:5px;margin-bottom:4px">${w}</div>`).join('')}</div>
            <div style="padding:12px 16px"><div style="font-size:10px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Your opportunity</div>${(a?.opportunities_for_client||[]).map(o=>`<div style="font-size:11px;background:#eff6ff;color:#1d4ed8;padding:4px 8px;border-radius:5px;margin-bottom:4px">${o}</div>`).join('')}</div>
          </div>
          ${a?.threat_reason?`<div style="padding:10px 16px;background:#f9fafb"><p style="font-size:11px;color:#6b7280;font-style:italic">${a.threat_reason}</p></div>`:''}
        </div>`
    }).join('')}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ca3af;text-align:center">PerfHub · Competitor Intelligence Report · ${now}</div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  const threatBadge = { High: 'badge-red', Medium: 'badge-amber', Low: 'badge-green' }
  const initials = name => name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
  const avatarColors = [
    ['#1a2a3a','#60a5fa'],
    ['#1a2a1a','#22c55e'],
    ['#2a1a2a','#c084fc'],
    ['#2a1f00','#f59e0b'],
    ['#2a0f0f','#ef4444'],
  ]

  return (
    <div>
      <StepTracker current="competitor" progress={progress} clientId={clientId}/>

      <div className="page-header">
        <div>
          <h1 className="page-title">Competitor intel</h1>
          <p className="page-sub">Agent 2 — live web research across paid and organic channels</p>
        </div>
        <div className="flex gap-2">
          {results.length > 0 && (
            <button className="btn-secondary" onClick={exportPDF}><Download size={13}/> Export PDF</button>
          )}
          <button className="btn-primary" onClick={run} disabled={running || !clientId || isLocked}>
            <Play size={13}/>{running ? 'Analysing...' : 'Run analysis'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLocked && clientId && <LockedState message="Complete the Account audit or Market audit first, then run competitor intelligence."/>}

        {(!isLocked || !clientId) && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Client</label>
                <select className="select" value={clientId} onChange={e => { setClientId(e.target.value); setResults([]) }}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="card p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-text-primary">Competitors to analyse</p>
                <button className="btn-secondary text-xs py-1" onClick={() => setCompetitors([...competitors, { name: '', url: '' }])}>
                  <Plus size={12}/> Add
                </button>
              </div>
              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 items-center">
                    <input
                      className="input"
                      placeholder="Company name"
                      value={c.name}
                      onChange={e => { const u = [...competitors]; u[i].name = e.target.value; setCompetitors(u) }}
                    />
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder="Website URL"
                        value={c.url}
                        onChange={e => { const u = [...competitors]; u[i].url = e.target.value; setCompetitors(u) }}
                      />
                      {competitors.length > 1 && (
                        <button onClick={() => setCompetitors(competitors.filter((_,idx) => idx !== i))} className="text-text-dim hover:text-status-red transition-colors">
                          <Trash2 size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {running && status && <ThinkingBar message={status}/>}

            {results.length > 0 && (
              <div className="space-y-4">
                <p className="section-label">Analysis results</p>
                {results.map((r, i) => {
                  const a = r.analysis
                  const threat = a?.threat_level || 'Medium'
                  const [avBg, avText] = avatarColors[i % avatarColors.length]

                  return (
                    <div key={i} className="card overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid #1a2035'}}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0"
                            style={{background:avBg, color:avText}}>
                            {initials(r.competitor.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{r.competitor.name}</p>
                            {r.competitor.url && (
                              <a href={r.competitor.url.startsWith('http') ? r.competitor.url : 'https://'+r.competitor.url}
                                target="_blank" rel="noreferrer"
                                className="text-xs text-text-dim hover:text-text-muted flex items-center gap-1">
                                {r.competitor.url.replace(/https?:\/\//,'')} <ExternalLink size={10}/>
                              </a>
                            )}
                          </div>
                        </div>
                        <span className={threatBadge[threat] || 'badge-gray'}>{threat} threat</span>
                      </div>

                      {a && (
                        <>
                          <div className="px-4 py-3" style={{borderBottom:'1px solid #1a2035'}}>
                            <p className="text-sm text-text-secondary leading-relaxed">{a.overview}</p>
                          </div>

                          <div className="grid grid-cols-3" style={{borderBottom:'1px solid #1a2035'}}>
                            <div className="px-4 py-3" style={{borderRight:'1px solid #1a2035'}}>
                              <p className="section-label">Organic social</p>
                              {[
                                ['Followers', a.organic_social?.estimated_followers],
                                ['Posting freq.', a.organic_social?.posting_frequency],
                                ['Engagement', a.organic_social?.engagement_rate],
                                ['Platforms', (a.organic_social?.platforms||[]).join(', ')],
                              ].filter(([,v])=>v).map(([l,v]) => (
                                <div key={l} className="flex justify-between text-xs mb-1.5">
                                  <span className="text-text-dim">{l}</span>
                                  <span className="text-text-secondary font-medium text-right ml-2">{v}</span>
                                </div>
                              ))}
                            </div>
                            <div className="px-4 py-3" style={{borderRight:'1px solid #1a2035'}}>
                              <p className="section-label">Paid advertising</p>
                              {[
                                ['Running ads', a.paid_advertising?.is_running_ads ? 'Yes' : 'No'],
                                ['Platforms', (a.paid_advertising?.estimated_platforms||[]).join(', ')],
                                ['Est. spend', a.paid_advertising?.estimated_monthly_spend],
                              ].filter(([,v])=>v).map(([l,v]) => (
                                <div key={l} className="flex justify-between text-xs mb-1.5">
                                  <span className="text-text-dim">{l}</span>
                                  <span className="text-text-secondary font-medium text-right ml-2">{v}</span>
                                </div>
                              ))}
                            </div>
                            <div className="px-4 py-3">
                              <p className="section-label">Ad angles</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(a.paid_advertising?.ad_angles||[]).map((angle,j) => (
                                  <span key={j} className="badge-gray">{angle}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3" style={{borderBottom:'1px solid #1a2035'}}>
                            <div className="px-4 py-3" style={{borderRight:'1px solid #1a2035'}}>
                              <p className="section-label" style={{color:'#22c55e'}}>Strengths</p>
                              <div className="space-y-1.5">
                                {(a.strengths||[]).map((s,j) => (
                                  <div key={j} className="text-xs px-2.5 py-1.5 rounded-lg leading-snug" style={{background:'#14301a',color:'#86efac'}}>{s}</div>
                                ))}
                              </div>
                            </div>
                            <div className="px-4 py-3" style={{borderRight:'1px solid #1a2035'}}>
                              <p className="section-label" style={{color:'#ef4444'}}>Weaknesses</p>
                              <div className="space-y-1.5">
                                {(a.weaknesses||[]).map((w,j) => (
                                  <div key={j} className="text-xs px-2.5 py-1.5 rounded-lg leading-snug" style={{background:'#2a0f0f',color:'#fca5a5'}}>{w}</div>
                                ))}
                              </div>
                            </div>
                            <div className="px-4 py-3">
                              <p className="section-label" style={{color:'#60a5fa'}}>Your opportunity</p>
                              <div className="space-y-1.5">
                                {(a.opportunities_for_client||[]).map((o,j) => (
                                  <div key={j} className="text-xs px-2.5 py-1.5 rounded-lg leading-snug" style={{background:'#0f1e35',color:'#93c5fd'}}>{o}</div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="px-4 py-3" style={{background:'#0d1120'}}>
                            <p className="text-xs text-text-dim italic">{a.threat_reason}</p>
                          </div>
                        </>
                      )}

                      {r.error && (
                        <div className="px-4 py-3 text-xs text-status-red" style={{background:'#2a0f0f'}}>{r.error}</div>
                      )}
                    </div>
                  )
                })}

                {!running && results.length > 0 && (
                  <NextBar current="competitor" clientId={clientId} label="Competitor analysis complete"/>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CompetitorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-dim">Loading...</div>}>
      <CompetitorPageInner />
    </Suspense>
  )
}
