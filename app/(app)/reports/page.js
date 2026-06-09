'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function ReportsPage() {
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [audits, setAudits] = useState([])
  const [strategies, setStrategies] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [insight, setInsight] = useState('')
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  async function load(cid) {
    setLoading(true)
    const supabase = createBrowserClient()
    const [{ data: a }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('audits').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(20),
      supabase.from('strategies').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(5),
      supabase.from('competitor_analyses').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(10),
    ])
    setAudits(a || []); setStrategies(s || []); setCompetitors(c || [])
    setLoading(false)
  }

  async function generateInsight() {
    const client = clients.find(c => c.id === clientId)
    setLoadingInsight(true); setInsight('')
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'insight', payload: { clientName: client.name, industry: client.industry, auditCount: audits.length, latestMetrics: audits[0]?.metrics_json, strategyCount: strategies.length, competitorNames: competitors.slice(0,3).map(c=>c.competitor_name).join(', ') } })
      })
      const data = await res.json()
      if (data.success) setInsight(data.insight)
    } catch (e) { setInsight('Error: ' + e.message) }
    setLoadingInsight(false)
  }

  const roasData = audits.slice(0,8).reverse().map(a => ({ date: new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}), roas: a.raw_data_json?.roas ? parseFloat(a.raw_data_json.roas.toFixed(2)) : null, cpa: a.raw_data_json?.cpa ? parseFloat(a.raw_data_json.cpa.toFixed(2)) : null })).filter(d => d.roas !== null)
  const platformSplit = [{ name: 'Google Ads', value: audits.filter(a=>a.platform==='google').length, color: '#1a1a2e' },{ name: 'Meta Ads', value: audits.filter(a=>a.platform==='meta').length, color: '#e8c97e' }].filter(p=>p.value>0)
  const latestMetrics = audits[0]?.metrics_json || []
  const sBg = { good: 'bg-green-50', bad: 'bg-red-50', warn: 'bg-amber-50' }
  const sIcon = s => s==='good' ? <TrendingUp size={12} className="text-green-600"/> : s==='bad' ? <TrendingDown size={12} className="text-red-600"/> : <Minus size={12} className="text-amber-600"/>

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="text-lg font-semibold text-gray-900">Reporting dashboard</h1><p className="text-sm text-gray-400 mt-0.5">Agent 5 — live performance overview and AI insights per client</p></div>
        <div className="flex gap-2">
          {clientId && <button className="btn-secondary" onClick={() => load(clientId)}><RefreshCw size={13}/> Refresh</button>}
          <button className="btn-primary" onClick={generateInsight} disabled={loadingInsight || !clientId}><TrendingUp size={13}/>{loadingInsight ? 'Generating...' : 'AI insight'}</button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs text-gray-500 mb-1.5">Client</label>
        <select className="select max-w-xs" value={clientId} onChange={e => { setClientId(e.target.value); if(e.target.value) load(e.target.value) }}>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!clientId && <div className="card p-12 text-center"><p className="text-sm text-gray-400">Select a client to view their dashboard</p></div>}

      {clientId && loading && <div className="flex justify-center py-12"><div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div></div>}

      {clientId && !loading && (
        <>
          {(insight || loadingInsight) && (
            <div className="card p-5 mb-4 bg-gray-50">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3">AI weekly insight</p>
              {loadingInsight && !insight && <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div>}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight}</p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              ['Audits run', audits.length, `${audits.filter(a=>a.platform==='google').length} Google · ${audits.filter(a=>a.platform==='meta').length} Meta`],
              ['Strategies', strategies.length, strategies[0]?.title?.slice(0,30)||'None yet'],
              ['Competitors', competitors.length, 'tracked'],
              ['Last audit', audits[0] ? new Date(audits[0].created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—', audits[0]?.platform||'']
            ].map(([l,v,s]) => (
              <div key={l} className="card p-4"><p className="text-xs text-gray-400 mb-1">{l}</p><p className="text-2xl font-medium text-gray-900">{v}</p><p className="text-xs text-gray-400 mt-1 truncate">{s}</p></div>
            ))}
          </div>

          {latestMetrics.length > 0 && (
            <div className="mb-4"><p className="text-sm font-medium text-gray-900 mb-3">Latest audit metrics</p>
              <div className="grid grid-cols-3 gap-3">
                {latestMetrics.map(m => <div key={m.label} className={`card p-3 ${sBg[m.status]||''}`}><div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">{m.label}</p>{sIcon(m.status)}</div><p className="text-xl font-medium text-gray-900">{m.value}</p><p className="text-xs text-gray-400 mt-0.5">{m.bench}</p></div>)}
              </div>
            </div>
          )}

          {roasData.length > 1 && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="card p-4"><p className="text-xs font-medium text-gray-500 mb-3">ROAS trend</p>
                <ResponsiveContainer width="100%" height={180}><LineChart data={roasData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="date" tick={{fontSize:10,fill:'#9ca3af'}}/><YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickFormatter={v=>v+'x'}/><Tooltip formatter={v=>[v+'x','ROAS']}/><Line type="monotone" dataKey="roas" stroke="#1a1a2e" strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer>
              </div>
              <div className="card p-4"><p className="text-xs font-medium text-gray-500 mb-3">CPA trend (AED)</p>
                <ResponsiveContainer width="100%" height={180}><LineChart data={roasData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="date" tick={{fontSize:10,fill:'#9ca3af'}}/><YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickFormatter={v=>'AED '+v}/><Tooltip formatter={v=>['AED '+v,'CPA']}/><Line type="monotone" dataKey="cpa" stroke="#e8c97e" strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer>
              </div>
            </div>
          )}

          {platformSplit.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="card p-4"><p className="text-xs font-medium text-gray-500 mb-3">Platform split</p>
                <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={platformSplit} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({name,value})=>`${name}: ${value}`} fontSize={11}>{platformSplit.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
              </div>
              <div className="card p-4"><p className="text-xs font-medium text-gray-500 mb-3">Competitors tracked</p>
                <div className="space-y-2 mt-2">
                  {competitors.slice(0,5).map(c => <div key={c.id} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">{c.competitor_name.slice(0,2).toUpperCase()}</div><p className="text-sm text-gray-700">{c.competitor_name}</p></div><p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p></div>)}
                  {competitors.length === 0 && <p className="text-sm text-gray-400">No competitors analysed yet</p>}
                </div>
              </div>
            </div>
          )}

          {audits.length > 0 && (
            <div className="card p-4"><p className="text-xs font-medium text-gray-500 mb-3">Audit history</p>
              <div className="space-y-2">
                {audits.slice(0,8).map(a => <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><div className="flex items-center gap-3"><span className={a.platform==='google'?'badge-gray':'badge-amber'}>{a.platform==='google'?'Google':'Meta'}</span><p className="text-sm text-gray-600">{a.date_range}</p></div><div className="flex items-center gap-4">{a.raw_data_json?.roas&&<span className="text-xs text-gray-500">ROAS {parseFloat(a.raw_data_json.roas).toFixed(1)}x</span>}{a.raw_data_json?.cpa&&<span className="text-xs text-gray-500">CPA AED {parseFloat(a.raw_data_json.cpa).toFixed(0)}</span>}<p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div></div>)}
              </div>
            </div>
          )}

          {audits.length === 0 && strategies.length === 0 && <div className="card p-12 text-center"><p className="text-sm text-gray-500 mb-1">No data yet for this client</p><p className="text-xs text-gray-400">Run an audit or build a strategy to start seeing data here</p></div>}
        </>
      )}
    </div>
  )
}
