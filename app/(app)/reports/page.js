'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Zap } from 'lucide-react'
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

  const roasData = audits.slice(0,8).reverse()
    .map(a => ({
      date: new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}),
      roas: a.raw_data_json?.roas ? parseFloat(a.raw_data_json.roas.toFixed(2)) : null,
      cpa: a.raw_data_json?.cpa ? parseFloat(a.raw_data_json.cpa.toFixed(2)) : null
    })).filter(d => d.roas !== null)

  const platformSplit = [
    { name: 'Google Ads', value: audits.filter(a=>a.platform==='google').length, color: '#e8c97e' },
    { name: 'Meta Ads',   value: audits.filter(a=>a.platform==='meta').length,   color: '#60a5fa' }
  ].filter(p=>p.value>0)

  const latestMetrics = audits[0]?.metrics_json || []

  const sBg = {
    good: 'bg-status-green-bg/30 border-status-green/20',
    bad:  'bg-status-red-bg/30 border-status-red/20',
    warn: 'bg-status-amber-bg/30 border-status-amber/20'
  }
  const sIcon = s => s==='good'
    ? <TrendingUp size={12} className="text-status-green"/>
    : s==='bad'
    ? <TrendingDown size={12} className="text-status-red"/>
    : <Minus size={12} className="text-status-amber"/>

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{background:'#0d1120',border:'1px solid #1e2a48',borderRadius:8,padding:'8px 12px'}}>
          <p style={{fontSize:11,color:'#8090c0',marginBottom:4}}>{label}</p>
          <p style={{fontSize:13,fontWeight:600,color:'#e8c97e'}}>{payload[0].value}{payload[0].name === 'roas' ? 'x' : ' AED'}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Reporting Dashboard</h1>
          <p className="text-sm text-text-secondary mt-0.5">Agent 5 — live performance overview and AI insights per client</p>
        </div>
        <div className="flex gap-2">
          {clientId && (
            <button className="btn-secondary" onClick={() => load(clientId)} title="Reload latest data from database">
              <RefreshCw size={13}/> Refresh data
            </button>
          )}
          <button
            className="btn-primary"
            onClick={generateInsight}
            disabled={loadingInsight || !clientId}
            title="Generate a fresh AI weekly briefing based on all client data"
          >
            <Zap size={13}/>{loadingInsight ? 'Generating...' : 'AI Insight'}
          </button>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Client</label>
        <select className="select max-w-xs" value={clientId} onChange={e => { setClientId(e.target.value); if(e.target.value) load(e.target.value) }}>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!clientId && (
        <div className="card p-16 text-center">
          <p className="text-sm font-semibold text-text-primary mb-1">Select a client to view their dashboard</p>
          <p className="text-xs text-text-secondary">Performance data, trends and AI insights will appear here</p>
        </div>
      )}

      {clientId && loading && (
        <div className="flex justify-center py-12">
          <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div>
        </div>
      )}

      {clientId && !loading && (
        <>
          {/* AI Insight */}
          {(insight || loadingInsight) && (
            <div className="card p-5 mb-5" style={{borderLeft:'3px solid #e8c97e'}}>
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">AI Weekly Insight</p>
              {loadingInsight && !insight && (
                <div className="flex gap-1.5 py-2">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div>
              )}
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{insight}</p>
            </div>
          )}

          {!insight && !loadingInsight && (
            <div className="card p-5 mb-5" style={{borderLeft:'3px solid #1e2a48'}}>
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">AI Weekly Insight</p>
              <p className="text-sm text-text-secondary mb-3">Get an executive-level briefing on this client — account health, strategic progress, and top priorities for this week.</p>
              <button className="btn-primary" onClick={generateInsight} disabled={loadingInsight}>
                <Zap size={13}/> Generate insight
              </button>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              ['Audits Run',    audits.length,       `${audits.filter(a=>a.platform==='google').length} Google · ${audits.filter(a=>a.platform==='meta').length} Meta`],
              ['Strategies',    strategies.length,   strategies[0]?.title?.slice(0,30) || 'None yet'],
              ['Competitors',   competitors.length,  'tracked'],
              ['Last Audit',    audits[0] ? new Date(audits[0].created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—', audits[0]?.platform || ''],
            ].map(([l,v,s]) => (
              <div key={l} className="card p-4">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{l}</p>
                <p className="text-2xl font-bold text-text-primary">{v}</p>
                <p className="text-xs text-text-secondary mt-1 truncate">{s}</p>
              </div>
            ))}
          </div>

          {/* Latest metrics */}
          {latestMetrics.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-bold text-text-primary mb-3">Latest Audit Metrics</p>
              <div className="grid grid-cols-3 gap-3">
                {latestMetrics.map(m => (
                  <div key={m.label} className={`card p-4 ${sBg[m.status]||''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{m.label}</p>
                      {sIcon(m.status)}
                    </div>
                    <p className="text-2xl font-bold text-text-primary">{m.value}</p>
                    <p className="text-xs text-text-secondary mt-1">{m.bench}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          {roasData.length > 1 && (
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="card p-5">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">ROAS Trend</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={roasData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false}/>
                    <XAxis dataKey="date" tick={{fontSize:10,fill:'#8090c0'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'#8090c0'}} tickFormatter={v=>v+'x'} axisLine={false} tickLine={false}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Line type="monotone" dataKey="roas" stroke="#e8c97e" strokeWidth={2} dot={{r:3,fill:'#e8c97e'}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">CPA Trend (AED)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={roasData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false}/>
                    <XAxis dataKey="date" tick={{fontSize:10,fill:'#8090c0'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'#8090c0'}} tickFormatter={v=>'AED '+v} axisLine={false} tickLine={false}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Line type="monotone" dataKey="cpa" stroke="#60a5fa" strokeWidth={2} dot={{r:3,fill:'#60a5fa'}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {platformSplit.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="card p-5">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Platform Split</p>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={platformSplit} cx="50%" cy="50%" outerRadius={60} dataKey="value"
                      label={({name,value})=>`${name}: ${value}`}
                      labelLine={{stroke:'#2e3858'}}
                      style={{fontSize:11,fill:'#8090c0'}}>
                      {platformSplit.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:'#0d1120',border:'1px solid #1e2a48',borderRadius:8}}
                      labelStyle={{color:'#8090c0'}} itemStyle={{color:'#e8eaf6'}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Competitors Tracked</p>
                <div className="space-y-2 mt-1">
                  {competitors.slice(0,5).map(c => (
                    <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-surface-border last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-surface-tertiary flex items-center justify-center text-[10px] font-bold text-brand-gold">
                          {c.competitor_name.slice(0,2).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium text-text-primary">{c.competitor_name}</p>
                      </div>
                      <p className="text-xs text-text-secondary">{new Date(c.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p>
                    </div>
                  ))}
                  {competitors.length === 0 && <p className="text-sm text-text-secondary py-4 text-center">No competitors analysed yet</p>}
                </div>
              </div>
            </div>
          )}

          {/* Audit history */}
          {audits.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Audit History</p>
              <div className="space-y-0">
                {audits.slice(0,8).map(a => (
                  <div key={a.id} className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={a.platform==='google'?'badge-gray':'badge-gold'}>{a.platform==='google'?'Google':'Meta'}</span>
                      <p className="text-sm text-text-primary">{a.date_range}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {a.raw_data_json?.roas && <span className="text-xs font-semibold text-text-primary">ROAS {parseFloat(a.raw_data_json.roas).toFixed(1)}x</span>}
                      {a.raw_data_json?.cpa && <span className="text-xs font-semibold text-text-primary">CPA AED {parseFloat(a.raw_data_json.cpa).toFixed(0)}</span>}
                      <p className="text-xs text-text-secondary">{new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {audits.length === 0 && strategies.length === 0 && (
            <div className="card p-16 text-center">
              <p className="text-sm font-semibold text-text-primary mb-1">No data yet for this client</p>
              <p className="text-xs text-text-secondary">Run an audit or build a strategy to start seeing data here</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
