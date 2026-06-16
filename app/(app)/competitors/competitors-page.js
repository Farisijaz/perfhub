'use client'
import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Play, Trash2, ExternalLink, ArrowRight } from 'lucide-react'

function CompetitorPageInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(params.get('client') || '')
  const [competitors, setCompetitors] = useState([{ name: '', url: '' }])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [pastAnalyses, setPastAnalyses] = useState([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  useEffect(() => {
    if (!clientId) return
    const supabase = createBrowserClient()

    // Load past competitor analyses
    supabase.from('competitor_analyses').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => {
        setPastAnalyses(data || [])
        if (data && data.length > 0) {
          const loaded = data.map(a => ({ competitor: { name: a.competitor_name, url: a.competitor_url }, analysis: a.analysis_json, saved: true }))
          setResults(loaded)
        }
      })

    // Pre-populate competitor names/URLs from most recent market audit
    supabase.from('market_audits').select('competitors').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data?.[0]?.competitors?.length) {
          const filled = data[0].competitors.filter(c => c.name)
          if (filled.length) {
            const mapped = filled.map(c => ({ name: c.name, url: c.website || '' }))
            setCompetitors(mapped)
          }
        }
      })
  }, [clientId])

  async function run() {
    const valid = competitors.filter(c => c.name.trim())
    if (!valid.length || !clientId) return
    const client = clients.find(c => c.id === clientId)
    setRunning(true); setResults([]); setStatus('')
    for (const comp of valid) {
      setStatus(`Analysing ${comp.name}...`)
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
  }

  const threatColors = {
    High:   { badge: 'bg-status-red-bg text-status-red',     dot: 'bg-status-red'   },
    Medium: { badge: 'bg-status-amber-bg text-status-amber', dot: 'bg-status-amber' },
    Low:    { badge: 'bg-status-green-bg text-status-green', dot: 'bg-status-green' },
  }

  const initials = name => name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()

  const avatarColors = [
    { bg: 'bg-surface-tertiary', text: 'text-brand-gold' },
    { bg: 'bg-status-blue-bg',   text: 'text-status-blue' },
    { bg: 'bg-status-green-bg',  text: 'text-status-green' },
    { bg: 'bg-status-amber-bg',  text: 'text-status-amber' },
    { bg: 'bg-status-red-bg',    text: 'text-status-red' },
  ]

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Competitor Intel</h1>
          <p className="text-sm text-text-secondary mt-0.5">Agent 2 — automated competitor analysis across paid and organic channels</p>
        </div>
        <button className="btn-primary" onClick={run} disabled={running || !clientId}><Play size={13}/>{running ? 'Analysing...' : 'Run analysis'}</button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Client</label>
          <select className="select" value={clientId} onChange={e => { setClientId(e.target.value); setResults([]) }}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text-primary">Competitors to analyse</p>
          <button className="btn-secondary text-xs py-1" onClick={() => setCompetitors([...competitors, { name: '', url: '' }])}><Plus size={12}/> Add</button>
        </div>
        <div className="space-y-2">
          {competitors.map((c, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 items-center">
              <input className="input" placeholder="Company name *" value={c.name} onChange={e => { const u = [...competitors]; u[i].name = e.target.value; setCompetitors(u) }}/>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Website URL" value={c.url} onChange={e => { const u = [...competitors]; u[i].url = e.target.value; setCompetitors(u) }}/>
                {competitors.length > 1 && <button onClick={() => setCompetitors(competitors.filter((_,idx) => idx !== i))} className="text-text-muted hover:text-status-red"><Trash2 size={14}/></button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {status && (
        <div className="card p-3 mb-4 text-sm text-text-secondary flex items-center gap-2">
          <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div>
          {status}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-text-primary">Analysis Results</p>
          {results.map((r, i) => {
            const a = r.analysis
            const threat = a?.threat_level || 'Medium'
            const tc = threatColors[threat] || threatColors.Medium
            const av = avatarColors[i % avatarColors.length]

            return (
              <div key={i} className="card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${av.bg} ${av.text} flex items-center justify-center text-sm font-bold`}>
                      {initials(r.competitor.name)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">{r.competitor.name}</p>
                      {r.competitor.url && (
                        <a href={r.competitor.url.startsWith('http') ? r.competitor.url : 'https://'+r.competitor.url} target="_blank" rel="noreferrer" className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1">
                          {r.competitor.url.replace(/https?:\/\//,'')} <ExternalLink size={10}/>
                        </a>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${tc.badge}`}>{threat} threat</span>
                </div>

                {a && (
                  <>
                    {/* Overview */}
                    <div className="px-5 py-4 border-b border-surface-border">
                      <p className="text-sm text-text-primary leading-relaxed">{a.overview}</p>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 border-b border-surface-border">
                      <div className="px-5 py-4 border-r border-surface-border">
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Organic Social</p>
                        {[
                          ['Followers', a.organic_social?.estimated_followers],
                          ['Posting Freq.', a.organic_social?.posting_frequency],
                          ['Engagement', a.organic_social?.engagement_rate],
                          ['Platforms', (a.organic_social?.platforms||[]).join(', ')],
                        ].filter(([,v])=>v).map(([l,v]) => (
                          <div key={l} className="flex justify-between text-xs mb-2">
                            <span className="text-text-secondary">{l}</span>
                            <span className="text-text-primary font-semibold text-right ml-2">{v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="px-5 py-4 border-r border-surface-border">
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Paid Advertising</p>
                        {[
                          ['Running Ads', a.paid_advertising?.is_running_ads ? 'Yes' : 'No'],
                          ['Platforms', (a.paid_advertising?.estimated_platforms||[]).join(', ')],
                          ['Est. Spend', a.paid_advertising?.estimated_monthly_spend],
                        ].filter(([,v])=>v).map(([l,v]) => (
                          <div key={l} className="flex justify-between text-xs mb-2">
                            <span className="text-text-secondary">{l}</span>
                            <span className="text-text-primary font-semibold text-right ml-2">{v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="px-5 py-4">
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Ad Angles</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(a.paid_advertising?.ad_angles||[]).map((angle,j) => (
                            <span key={j} className="text-xs bg-status-blue-bg text-status-blue px-2.5 py-1 rounded-lg">{angle}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Strengths / Weaknesses / Opportunities */}
                    <div className="grid grid-cols-3 border-b border-surface-border">
                      <div className="px-5 py-4 border-r border-surface-border">
                        <p className="text-xs font-bold text-status-green uppercase tracking-wider mb-3">Strengths</p>
                        <div className="space-y-2">
                          {(a.strengths||[]).map((s,j) => (
                            <div key={j} className="text-xs px-3 py-2 rounded-lg leading-snug text-status-green" style={{background:'#14301a',border:'1px solid rgba(34,197,94,0.15)'}}>{s}</div>
                          ))}
                        </div>
                      </div>
                      <div className="px-5 py-4 border-r border-surface-border">
                        <p className="text-xs font-bold text-status-red uppercase tracking-wider mb-3">Weaknesses</p>
                        <div className="space-y-2">
                          {(a.weaknesses||[]).map((w,j) => (
                            <div key={j} className="text-xs px-3 py-2 rounded-lg leading-snug text-status-red" style={{background:'#2a0f0f',border:'1px solid rgba(239,68,68,0.15)'}}>{w}</div>
                          ))}
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        <p className="text-xs font-bold text-status-blue uppercase tracking-wider mb-3">Your Opportunity</p>
                        <div className="space-y-2">
                          {(a.opportunities_for_client||[]).map((o,j) => (
                            <div key={j} className="text-xs px-3 py-2 rounded-lg leading-snug text-status-blue" style={{background:'#0f1e35',border:'1px solid rgba(96,165,250,0.15)'}}>{o}</div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="px-5 py-4" style={{background:'#0d1120'}}>
                      <p className="text-sm text-text-secondary italic leading-relaxed">{a.threat_reason}</p>
                    </div>
                  </>
                )}

                {r.error && <div className="px-5 py-3 text-xs text-status-red bg-status-red-bg/30">{r.error}</div>}
              </div>
            )
          })}

          {/* Next step CTA */}
          {!running && results.length > 0 && clientId && (
            <div className="next-bar">
              <div>
                <p className="text-sm font-semibold text-text-primary">Competitor analysis complete</p>
                <p className="text-xs text-text-secondary mt-0.5">Next: build your media plan and launch strategy</p>
              </div>
              <button
                className="btn-primary"
                onClick={() => router.push(`/strategy?client=${clientId}`)}
              >
                Build Strategy <ArrowRight size={14}/>
              </button>
            </div>
          )}
        </div>
      )}

      {pastAnalyses.length > 0 && results.length === 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-text-primary mb-3">Past Analyses — click to reload</p>
          <div className="space-y-2">
            {pastAnalyses.map(a => (
              <div key={a.id} className="card px-4 py-3 flex items-center justify-between cursor-pointer hover:border-surface-border-light"
                onClick={() => setResults(prev => [...prev, { competitor: { name: a.competitor_name, url: a.competitor_url }, analysis: a.analysis_json }])}>
                <div>
                  <p className="text-sm text-text-primary">{a.competitor_name}</p>
                  <p className="text-xs text-text-secondary">{new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
                </div>
                {a.competitor_url && (
                  <a href={a.competitor_url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text-primary" onClick={e=>e.stopPropagation()}><ExternalLink size={14}/></a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CompetitorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading...</div>}>
      <CompetitorPageInner />
    </Suspense>
  )
}
