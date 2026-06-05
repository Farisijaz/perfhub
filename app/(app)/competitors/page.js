'use client'
import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Plus, Play, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

function CompetitorPageInner() {
  const params = useSearchParams()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(params.get('client') || '')
  const [competitors, setCompetitors] = useState([{ name: '', url: '' }])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [expanded, setExpanded] = useState(null)
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
        // Load saved results into view
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

  const threatBadge = { High: 'badge-red', Medium: 'badge-amber', Low: 'badge-green' }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="text-lg font-semibold text-gray-900">Competitor intel</h1><p className="text-sm text-gray-400 mt-0.5">Agent 2 — automated competitor analysis across paid and organic channels</p></div>
        <button className="btn-primary" onClick={run} disabled={running || !clientId}><Play size={13}/>{running ? 'Analysing...' : 'Run analysis'}</button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
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

      {status && <div className="card p-3 mb-4 text-xs text-gray-500">{status}</div>}

      {results.length > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-sm font-medium text-gray-900">Analysis results</p>
          {results.map((r, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === i ? null : i)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-600">{r.competitor.name.slice(0,2).toUpperCase()}</div>
                  <div><p className="text-sm font-medium text-gray-900">{r.competitor.name}</p><p className="text-xs text-gray-400">{r.competitor.url || 'No URL'}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  {r.analysis?.threat_level && <span className={threatBadge[r.analysis.threat_level] || 'badge-gray'}>{r.analysis.threat_level} threat</span>}
                  {expanded === i ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                </div>
              </div>
              {expanded === i && r.analysis && (
                <div className="border-t border-gray-50 p-4 space-y-4">
                  <p className="text-sm text-gray-700 leading-relaxed">{r.analysis.overview}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Organic social</p>
                      {[['Followers', r.analysis.organic_social?.estimated_followers],['Posting freq.', r.analysis.organic_social?.posting_frequency],['Engagement', r.analysis.organic_social?.engagement_rate],['Platforms', (r.analysis.organic_social?.platforms||[]).join(', ')]].filter(([,v])=>v).map(([l,v]) => (
                        <div key={l} className="flex justify-between text-xs mb-1"><span className="text-gray-400">{l}</span><span className="text-gray-700 font-medium">{v}</span></div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Paid advertising</p>
                      {[['Running ads', r.analysis.paid_advertising?.is_running_ads ? 'Yes' : 'No'],['Platforms', (r.analysis.paid_advertising?.estimated_platforms||[]).join(', ')],['Est. spend', r.analysis.paid_advertising?.estimated_monthly_spend]].filter(([,v])=>v).map(([l,v]) => (
                        <div key={l} className="flex justify-between text-xs mb-1"><span className="text-gray-400">{l}</span><span className="text-gray-700 font-medium">{v}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[['Strengths', r.analysis.strengths, 'text-green-700 bg-green-50'],['Weaknesses', r.analysis.weaknesses, 'text-red-700 bg-red-50'],['Opportunities for you', r.analysis.opportunities_for_client, 'text-blue-700 bg-blue-50']].map(([label, items, cls]) => (
                      <div key={label}><p className="text-xs font-medium text-gray-500 mb-2">{label}</p><div className="space-y-1">{(items||[]).map((item,j) => <div key={j} className={`text-xs px-2 py-1 rounded ${cls}`}>{item}</div>)}</div></div>
                    ))}
                  </div>
                  {r.analysis.paid_advertising?.ad_angles?.length > 0 && (
                    <div><p className="text-xs font-medium text-gray-500 mb-2">Their ad angles</p><div className="flex flex-wrap gap-2">{r.analysis.paid_advertising.ad_angles.map((a,j) => <span key={j} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600">{a}</span>)}</div></div>
                  )}
                  <p className="text-xs text-gray-500 italic border-t border-gray-50 pt-3">{r.analysis.threat_reason}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pastAnalyses.length > 0 && results.length === 0 && (
        <div><p className="text-sm font-medium text-gray-900 mb-3">Past analyses — click to reload</p>
          <div className="space-y-2">
            {pastAnalyses.map(a => (
              <div key={a.id} className="card px-4 py-3 flex items-center justify-between cursor-pointer hover:border-gray-200" onClick={() => setResults(prev => [...prev, { competitor: { name: a.competitor_name, url: a.competitor_url }, analysis: a.analysis_json }])}>
                <div><p className="text-sm text-gray-700">{a.competitor_name}</p><p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div>
                {a.competitor_url && <a href={a.competitor_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-600" onClick={e=>e.stopPropagation()}><ExternalLink size={14}/></a>}
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
