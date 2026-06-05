'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Play, Download, ChevronDown, ChevronUp } from 'lucide-react'

const CHANNELS = ['Google Search','Google Display','Google Shopping','YouTube','Meta (Facebook/Instagram)','TikTok','LinkedIn','Snapchat','SEO','Email Marketing']
const GOALS = ['increase conversions','increase ROAS','reduce CPA','grow brand awareness','increase leads','drive app installs','increase e-commerce revenue']

export default function StrategyPage() {
  const params = useSearchParams()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(params.get('client') || '')
  const [goal, setGoal] = useState('increase conversions')
  const [budget, setBudget] = useState('')
  const [duration, setDuration] = useState('3 months')
  const [channels, setChannels] = useState(['Google Search','Meta (Facebook/Instagram)'])
  const [running, setRunning] = useState(false)
  const [strategy, setStrategy] = useState(null)
  const [expanded, setExpanded] = useState('channels')
  const [pastStrategies, setPastStrategies] = useState([])

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  useEffect(() => {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    if (client?.monthly_budget) setBudget(String(client.monthly_budget))
    const supabase = createBrowserClient()
    supabase.from('strategies').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5).then(({ data }) => setPastStrategies(data || []))
  }, [clientId, clients])

  async function run() {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    setRunning(true); setStrategy(null)
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'strategy', payload: { clientName: client.name, industry: client.industry, goal, budget: budget || client.monthly_budget || 10000, duration, channels } })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setStrategy(data.strategy)
      const supabase = createBrowserClient()
      await supabase.from('strategies').insert([{ client_id: clientId, title: `${goal} — ${duration}`, strategy_json: data.strategy, summary: data.strategy.executive_summary }])
      const { data: past } = await supabase.from('strategies').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5)
      setPastStrategies(past || [])
    } catch (e) { alert('Error: ' + e.message) }
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
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="text-lg font-semibold text-gray-900">Strategy & media plan</h1><p className="text-sm text-gray-400 mt-0.5">Agent 3 — AI-generated strategy, channel plan, budget split and KPIs</p></div>
        <button className="btn-primary" onClick={run} disabled={running || !clientId}><Play size={13}/>{running ? 'Building...' : 'Build strategy'}</button>
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
        <div><label className="block text-xs text-gray-500 mb-1.5">Monthly budget (USD)</label>
          <input className="input" type="number" placeholder="10000" value={budget} onChange={e => setBudget(e.target.value)}/>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Duration</label>
          <select className="select" value={duration} onChange={e => setDuration(e.target.value)}>
            {['1 month','3 months','6 months','12 months'].map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <p className="text-xs font-medium text-gray-500 mb-3">Channels to include</p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map(ch => <button key={ch} onClick={() => setChannels(prev => prev.includes(ch) ? prev.filter(c=>c!==ch) : [...prev, ch])} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${channels.includes(ch) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>{ch}</button>)}
        </div>
      </div>

      {running && <div className="card p-4 mb-4"><div className="flex gap-1.5 items-center"><div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div><span className="text-xs text-gray-400 ml-2">Building strategy...</span></div></div>}

      {strategy && (
        <>
          <div className="card p-4 mb-4 bg-gray-50">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Executive summary</p>
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
            <div className="space-y-3">
              {(strategy.channel_strategy||[]).map((ch, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-900">{ch.channel}</p><span className={roleColor[ch.role]||'badge-gray'}>{ch.role}</span></div>
                    <div className="text-right"><p className="text-sm font-medium text-gray-900">${(ch.monthly_budget||0).toLocaleString()}/mo</p><p className="text-xs text-gray-400">{ch.budget_percentage}% of budget</p></div>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{ch.rationale}</p>
                  {ch.benchmarks && <div className="flex gap-3 flex-wrap">{Object.entries(ch.benchmarks).map(([k,v]) => <span key={k} className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{k.toUpperCase()}: {v}</span>)}</div>}
                </div>
              ))}
            </div>
          </Section>

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
            <Section id="quickwins" title="Quick wins">
              <div className="space-y-2">{strategy.quick_wins.map((w,i) => <div key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-green-500 mt-0.5">✓</span>{w}</div>)}</div>
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
    </div>
  )
}