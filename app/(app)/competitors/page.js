'use client'
import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Plus, Play, Trash2, ExternalLink } from 'lucide-react'

function CompetitorPageInner() {
  const params = useSearchParams()
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
    supabase.from('competitor_analyses').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => {
        setPastAnalyses(data || [])
        if (data && data.length > 0) {
          const loaded = data.map(a => ({ competitor: { name: a.competitor_name, url: a.competitor_url }, analysis: a.analysis_json, saved: true }))
          setResults(loaded)
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

  const threatColor = {
    High:   { badge: 'bg-red-50 text-red-700',    dot: 'bg-red-500'   },
    Medium: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    Low:    { badge: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  }

  const initials = name => name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()

  const avatarColors = [
    ['bg-red-50','text-red-700'],
    ['bg-teal-50','text-teal-700'],
    ['bg-blue-50','text-blue-700'],
    ['bg-purple-50','text-purple-700'],
    ['bg-orange-50','text-orange-700'],
  ]

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Competitor intel</h1>
          <p className="text-sm text-gray-400 mt-0.5">Agent 2 — automated competitor analysis across paid and organic channels</p>
        </div>
        <button className="btn-primary" onClick={run} disabled={running || !clientId}><Play size={13}/>{running ? 'Analysing...' : 'Run analysis'}</button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div><label className="block text-xs text-gray-500 mb-1.5">Client</label>
          <select className="select" value={clientId} onChange={e => { setClientId(e.target.value); setResults([]) }}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900">Competitors to analyse</p>
          <button className="btn-secondary text-xs py-1" onClick={() => setCompetitors([...competitors, { name: '', url: '' }])}><Plus size={12}/> Add</button>
        </div>
        <div className="space-y-2">
          {competitors.map((c, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 items-center">
              <input className="input" placeholder="Company name *" value={c.name} onChange={e => { const u = [...competitors]; u[i].name = e.target.value; setCompetitors(u) }}/>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Website URL" value={c.url} onChange={e => { const u = [...competitors]; u[i].url = e.target.value; setCompetitors(u) }}/>
                {competitors.length > 1 && <button onClick={() => setCompetitors(competitors.filter((_,idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {status && <div className="card p-3 mb-4 text-xs text-gray-500 flex items-center gap-2"><div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div>{status}</div>}

      {results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">Analysis results</p>
          {results.map((r, i) => {
            const a = r.analysis
            const threat = a?.threat_level || 'Medium'
            const tc = threatColor[threat] || threatColor.Medium
            const [avBg, avText] = avatarColors[i % avatarColors.length]

            return (
              <div key={i} className="card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${avBg} ${avText} flex items-center justify-center text-xs font-semibold`}>
                      {initials(r.competitor.name)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{r.competitor.name}</p>
                      {r.competitor.url && (
                        <a href={r.competitor.url.startsWith('http') ? r.competitor.url : 'https://'+r.competitor.url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                          {r.competitor.url.replace(/https?:\/\//,'')} <ExternalLink size={10}/>
                        </a>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${tc.badge}`}>{threat} threat</span>
                </div>

                {a && (
                  <>
                    {/* Overview */}
                    <div className="px-4 py-3 border-b border-gray-50">
                      <p className="text-sm text-gray-600 leading-relaxed">{a.overview}</p>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 border-b border-gray-50">
                      <div className="px-4 py-3 border-r border-gray-50">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Organic social</p>
                        {[
                          ['Followers', a.organic_social?.estimated_followers],
                          ['Posting freq.', a.organic_social?.posting_frequency],
                          ['Engagement', a.organic_social?.engagement_rate],
                          ['Platforms', (a.organic_social?.platforms||[]).join(', ')],
                        ].filter(([,v])=>v).map(([l,v]) => (
                          <div key={l} className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400">{l}</span>
                            <span className="text-gray-700 font-medium text-right ml-2">{v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-3 border-r border-gray-50">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Paid advertising</p>
                        {[
                          ['Running ads', a.paid_advertising?.is_running_ads ? 'Yes' : 'No'],
                          ['Platforms', (a.paid_advertising?.estimated_platforms||[]).join(', ')],
                          ['Est. spend', a.paid_advertising?.estimated_monthly_spend],
                        ].filter(([,v])=>v).map(([l,v]) => (
                          <div key={l} className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400">{l}</span>
                            <span className="text-gray-700 font-medium text-right ml-2">{v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Ad angles</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(a.paid_advertising?.ad_angles||[]).map((angle,j) => (
                            <span key={j} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{angle}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Strengths / Weaknesses / Opportunities */}
                    <div className="grid grid-cols-3 border-b border-gray-50">
                      <div className="px-4 py-3 border-r border-gray-50">
                        <p className="text-[10px] font-medium text-green-700 uppercase tracking-wider mb-2">Strengths</p>
                        <div className="space-y-1.5">
                          {(a.strengths||[]).map((s,j) => (
                            <div key={j} className="text-xs bg-green-50 text-green-800 px-2.5 py-1.5 rounded-lg leading-snug">{s}</div>
                          ))}
                        </div>
                      </div>
                      <div className="px-4 py-3 border-r border-gray-50">
                        <p className="text-[10px] font-medium text-red-700 uppercase tracking-wider mb-2">Weaknesses</p>
                        <div className="space-y-1.5">
                          {(a.weaknesses||[]).map((w,j) => (
                            <div key={j} className="text-xs bg-red-50 text-red-800 px-2.5 py-1.5 rounded-lg leading-snug">{w}</div>
                          ))}
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wider mb-2">Your opportunity</p>
                        <div className="space-y-1.5">
                          {(a.opportunities_for_client||[]).map((o,j) => (
                            <div key={j} className="text-xs bg-blue-50 text-blue-800 px-2.5 py-1.5 rounded-lg leading-snug">{o}</div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="px-4 py-3 bg-gray-50">
                      <p className="text-xs text-gray-500 italic">{a.threat_reason}</p>
                    </div>
                  </>
                )}

                {r.error && <div className="px-4 py-3 text-xs text-red-600 bg-red-50">{r.error}</div>}
              </div>
            )
          })}
        </div>
      )}

      {pastAnalyses.length > 0 && results.length === 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Past analyses — click to reload</p>
          <div className="space-y-2">
            {pastAnalyses.map(a => (
              <div key={a.id} className="card px-4 py-3 flex items-center justify-between cursor-pointer hover:border-gray-200"
                onClick={() => setResults(prev => [...prev, { competitor: { name: a.competitor_name, url: a.competitor_url }, analysis: a.analysis_json }])}>
                <div>
                  <p className="text-sm text-gray-700">{a.competitor_name}</p>
                  <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
                </div>
                {a.competitor_url && (
                  <a href={a.competitor_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-600" onClick={e=>e.stopPropagation()}><ExternalLink size={14}/></a>
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
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading...</div>}>
      <CompetitorPageInner />
    </Suspense>
  )
}
