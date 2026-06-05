'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { extractRealRows, parseGoogleAds, parseMetaAds, autoDetectPlatform } from '@/lib/csvParser'
import { Upload, Play, FileText, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function AuditPageInner() {
  const params = useSearchParams()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(params.get('client') || '')
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

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
  }, [])

  useEffect(() => {
    if (!clientId) return
    const supabase = createBrowserClient()
    supabase.from('audits').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5).then(({ data }) => setPastAudits(data || []))
  }, [clientId])

  function addFiles(newFiles) {
    const valid = newFiles.filter(f => /\.csv$/i.test(f.name))
    setFiles(prev => [...prev, ...valid.filter(f => !prev.find(p => p.name === f.name))])
    setError('')
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
    const benchmarks = { 'F&B / Restaurant': { roas: 3.5, cpa: 25, cpc: 1.2, cpm: 8 }, 'E-commerce': { roas: 4.0, cpa: 30, cpc: 1.5, cpm: 10 }, 'Real Estate': { roas: 2.5, cpa: 80, cpc: 3.5, cpm: 15 }, 'Fashion': { roas: 4.2, cpa: 25, cpc: 1.3, cpm: 9 } }
    const b = benchmarks[industry] || { roas: 3.5, cpa: 35, cpc: 2.0, cpm: 10 }
    const s = (v, good, ok) => v <= good ? 'good' : v <= ok ? 'warn' : 'bad'
    const si = (v, good, ok) => v >= good ? 'good' : v >= ok ? 'warn' : 'bad'
    setMetrics([
      { label: 'ROAS', value: d.roas.toFixed(2) + 'x', bench: 'Benchmark ' + b.roas + 'x', status: si(d.roas, b.roas, b.roas * 0.8) },
      { label: 'CPA', value: 'AED ' + d.cpa.toFixed(2), bench: 'Target AED ' + b.cpa, status: s(d.cpa, b.cpa, b.cpa * 1.3) },
      { label: platform === 'google' ? 'CPC' : 'CPM', value: 'AED ' + (platform === 'google' ? d.cpc : d.cpm).toFixed(2), bench: 'Avg AED ' + (platform === 'google' ? b.cpc : b.cpm), status: s(platform === 'google' ? d.cpc : d.cpm, platform === 'google' ? b.cpc : b.cpm, (platform === 'google' ? b.cpc : b.cpm) * 1.3) },
      { label: 'CTR', value: d.ctr.toFixed(2) + '%', bench: 'Industry avg 3.1%', status: si(d.ctr, 3, 1.5) },
      { label: 'Conv. rate', value: d.convRate.toFixed(2) + '%', bench: 'Industry avg 3.7%', status: si(d.convRate, 3.5, 2) },
      { label: 'Spend', value: 'AED ' + d.totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 }), bench: d.totals.conversions + ' conversions', status: 'warn' },
    ])
  }

  const sBg = { good: 'bg-green-50', bad: 'bg-red-50', warn: 'bg-amber-50' }
  const sIcon = s => s === 'good' ? <TrendingUp size={12} className="text-green-600"/> : s === 'bad' ? <TrendingDown size={12} className="text-red-600"/> : <Minus size={12} className="text-amber-600"/>

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="text-lg font-semibold text-gray-900">Account audit</h1><p className="text-sm text-gray-400 mt-0.5">Agent 1 — upload campaign data and get a full AI-powered analysis</p></div>
        <button className="btn-primary" onClick={run} disabled={running || !clientId}><Play size={13}/>{running ? 'Analysing...' : 'Run audit'}</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div><label className="block text-xs text-gray-500 mb-1.5">Client</label>
          <select className="select" value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Platform</label>
          <div className="flex gap-2">
            {['google','meta'].map(p => <button key={p} onClick={() => setPlatform(p)} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${platform===p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>{p==='google'?'Google Ads':'Meta Ads'}</button>)}
          </div>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1.5">Date range</label>
          <select className="select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
            {['Last 30 days','Last 60 days','Last 90 days','This year'].map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className={`card border-dashed p-8 text-center cursor-pointer mb-2 ${dragOver ? 'border-gray-400 bg-gray-50' : 'hover:border-gray-300'}`}
        onClick={() => document.getElementById('audit-input').click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)) }}>
        <Upload size={22} className="text-gray-300 mx-auto mb-2"/>
        <p className="text-sm font-medium text-gray-600 mb-1">Drop your {platform==='google'?'Google Ads':'Meta Ads'} CSV export here</p>
        <p className="text-xs text-gray-400">{platform==='google'?'Google Ads → Reports → Campaigns → Download':'Meta Ads Manager → Campaigns → Export'}</p>
        <input id="audit-input" type="file" accept=".csv" className="hidden" onChange={e => addFiles(Array.from(e.target.files))}/>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</div>}

      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {files.map(f => <div key={f.name} className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5"><FileText size={12} className="text-gray-400"/>{f.name}<button onClick={() => setFiles(files.filter(x => x.name !== f.name))} className="text-gray-400 hover:text-red-500"><X size={12}/></button></div>)}
        </div>
      )}

      {(summary || running) && (
        <div className="card p-5 mb-4">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3">Agent 1 — analysis</p>
          {running && !summary && <div className="flex gap-1.5 mb-2">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div>}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {metrics.map(m => <div key={m.label} className={`card p-4 ${sBg[m.status]||''}`}><div className="flex items-center justify-between mb-2"><p className="text-xs text-gray-500">{m.label}</p>{sIcon(m.status)}</div><p className="text-xl font-medium text-gray-900">{m.value}</p><p className="text-xs text-gray-400 mt-1">{m.bench}</p></div>)}
        </div>
      )}

      {campaigns.filter(c => c.roas > 0).length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-4">ROAS by campaign</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={campaigns.filter(c => c.roas > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#9ca3af'}}/><YAxis tick={{fontSize:11,fill:'#9ca3af'}} tickFormatter={v=>v+'x'}/><Tooltip formatter={v=>[parseFloat(v).toFixed(2)+'x','ROAS']}/><Bar dataKey="roas" fill="#1a1a2e" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {recos.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Prioritised recommendations</p>
          <div className="space-y-2">
            {recos.map((r,i) => <div key={i} className="card p-4 flex gap-3"><div className="w-6 h-6 rounded-full bg-brand-dark text-brand-gold text-[11px] font-medium flex items-center justify-center shrink-0 mt-0.5">{i+1}</div><div><p className="text-sm font-medium text-gray-900 mb-1">{r.title}</p><p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p><span className={`inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${r.impact==='High'?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>{r.impact} impact</span></div></div>)}
          </div>
        </div>
      )}

      {pastAudits.length > 0 && (
        <div className="mt-6"><p className="text-sm font-medium text-gray-900 mb-3">Past audits</p>
          <div className="space-y-2">
            {pastAudits.map(a => <div key={a.id} className="card px-4 py-3 flex items-center justify-between"><div><p className="text-sm text-gray-700">{a.platform==='google'?'Google Ads':'Meta Ads'} · {a.date_range}</p><p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div><button className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1" onClick={()=>{if(a.summary)setSummary(a.summary);if(a.metrics_json)setMetrics(a.metrics_json);if(a.recommendations_json)setRecos(a.recommendations_json)}}>View</button></div>)}
          </div>
        </div>
      )}
    </div>
  )
}
export default function AuditPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading...</div>}>
      <AuditPageInner />
    </Suspense>
  )
}
