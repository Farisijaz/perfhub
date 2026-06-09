'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useParams, useRouter } from 'next/navigation'
import { Download, ArrowLeft, FileText } from 'lucide-react'

export default function ClientReportPage() {
  const { id } = useParams()
  const router = useRouter()
  const [client, setClient] = useState(null)
  const [audit, setAudit] = useState(null)
  const [competitors, setCompetitors] = useState([])
  const [strategy, setStrategy] = useState(null)
  const [creative, setCreative] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!id) return
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    const supabase = createBrowserClient()
    const [
      { data: clientData },
      { data: auditData },
      { data: competitorData },
      { data: strategyData },
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('audits').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1),
      supabase.from('competitor_analyses').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(5),
      supabase.from('strategies').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1),
    ])
    setClient(clientData)
    setAudit(auditData?.[0] || null)
    setCompetitors(competitorData || [])
    setStrategy(strategyData?.[0] || null)
    setLoading(false)
  }

  function exportPDF() {
    setGenerating(true)
    const win = window.open('', '_blank')
    const s = strategy?.strategy_json
    const a = audit
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    // ── helpers ──────────────────────────────────────────────────────────────
    const pill = (text, bg, color) => `<span style="display:inline-block;background:${bg};color:${color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;margin:2px 3px 2px 0">${text}</span>`
    const redPill = t => pill(t, '#fef2f2', '#991b1b')
    const greenPill = t => pill(t, '#f0fdf4', '#166534')
    const bluePill = t => pill(t, '#eff6ff', '#1d4ed8')
    const grayPill = t => pill(t, '#f3f4f6', '#374151')
    const metricCard = (label, value, status) => {
      const bg = status === 'good' ? '#f0fdf4' : status === 'bad' ? '#fef2f2' : '#fffbeb'
      const border = status === 'good' ? '#bbf7d0' : status === 'bad' ? '#fecaca' : '#fde68a'
      return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:14px;flex:1;min-width:140px"><div style="font-size:11px;color:#6b7280;margin-bottom:4px">${label}</div><div style="font-size:20px;font-weight:600;color:#111827">${value}</div></div>`
    }
    const sectionTitle = (t, sub='') => `<div style="margin:32px 0 16px"><h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 4px">${t}</h2>${sub?`<p style="font-size:13px;color:#9ca3af;margin:0">${sub}</p>`:''}</div><hr style="border:none;border-top:2px solid #f0f0f0;margin-bottom:20px">`

    // ── AUDIT SECTION ─────────────────────────────────────────────────────────
    let auditHtml = ''
    if (a) {
      const metrics = a.metrics_json || []
      const recos = a.recommendations_json || []
      auditHtml = `
        ${sectionTitle('Account audit', `${a.platform === 'google' ? 'Google Ads' : 'Meta Ads'} · ${a.date_range}`)}
        ${metrics.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">${metrics.map(m => metricCard(m.label, m.value, m.status)).join('')}</div>` : ''}
        ${a.summary ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px"><p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px">AI Analysis</p><p style="font-size:13px;color:#374151;line-height:1.7;margin:0;white-space:pre-wrap">${a.summary}</p></div>` : ''}
        ${recos.length ? `
          <p style="font-size:12px;font-weight:600;color:#374151;margin:0 0 10px">Prioritised recommendations</p>
          ${recos.map((r,i) => `<div style="display:flex;gap:12px;padding:12px;border:1px solid #f0f0f0;border-radius:8px;margin-bottom:8px"><div style="width:22px;height:22px;border-radius:50%;background:#1a1a2e;color:#e8c97e;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div><div><div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:3px">${r.title}</div><div style="font-size:12px;color:#6b7280;line-height:1.5">${r.desc}</div><span style="display:inline-block;margin-top:5px;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${r.impact==='High'?'#f0fdf4':'#fffbeb'};color:${r.impact==='High'?'#166534':'#92400e'}">${r.impact} impact</span></div></div>`).join('')}
        ` : ''}
      `
    } else {
      auditHtml = `${sectionTitle('Account audit')}<p style="font-size:13px;color:#9ca3af">No audit has been run for this client yet.</p>`
    }

    // ── COMPETITOR SECTION ────────────────────────────────────────────────────
    let competitorHtml = ''
    if (competitors.length) {
      const threatBg = { High: '#fef2f2', Medium: '#fffbeb', Low: '#f0fdf4' }
      const threatColor = { High: '#991b1b', Medium: '#92400e', Low: '#166534' }
      competitorHtml = `
        ${sectionTitle('Competitor analysis', `${competitors.length} competitor${competitors.length > 1 ? 's' : ''} analysed`)}
        ${competitors.map(c => {
          const a = c.analysis_json
          const threat = a?.threat_level || 'Medium'
          return `
          <div style="border:1px solid #e5e7eb;border-radius:10px;margin-bottom:16px;overflow:hidden">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #f0f0f0">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:32px;height:32px;border-radius:7px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#374151">${c.competitor_name.slice(0,2).toUpperCase()}</div>
                <div><div style="font-size:14px;font-weight:600;color:#111827">${c.competitor_name}</div>${c.competitor_url?`<div style="font-size:11px;color:#9ca3af">${c.competitor_url.replace(/https?:\/\//,'')}</div>`:''}</div>
              </div>
              <span style="font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;background:${threatBg[threat]};color:${threatColor[threat]}">${threat} threat</span>
            </div>
            ${a?.overview ? `<div style="padding:12px 16px;border-bottom:1px solid #f0f0f0"><p style="font-size:13px;color:#374151;line-height:1.6;margin:0">${a.overview}</p></div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #f0f0f0">
              <div style="padding:12px 16px;border-right:1px solid #f0f0f0">
                <div style="font-size:10px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Strengths</div>
                ${(a?.strengths||[]).map(s=>`<div style="font-size:11px;background:#f0fdf4;color:#166534;padding:4px 8px;border-radius:5px;margin-bottom:4px">${s}</div>`).join('')}
              </div>
              <div style="padding:12px 16px;border-right:1px solid #f0f0f0">
                <div style="font-size:10px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Weaknesses</div>
                ${(a?.weaknesses||[]).map(w=>`<div style="font-size:11px;background:#fef2f2;color:#991b1b;padding:4px 8px;border-radius:5px;margin-bottom:4px">${w}</div>`).join('')}
              </div>
              <div style="padding:12px 16px">
                <div style="font-size:10px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Your opportunity</div>
                ${(a?.opportunities_for_client||[]).map(o=>`<div style="font-size:11px;background:#eff6ff;color:#1d4ed8;padding:4px 8px;border-radius:5px;margin-bottom:4px">${o}</div>`).join('')}
              </div>
            </div>
            ${a?.threat_reason ? `<div style="padding:10px 16px;background:#f9fafb"><p style="font-size:11px;color:#6b7280;font-style:italic;margin:0">${a.threat_reason}</p></div>` : ''}
          </div>`
        }).join('')}
      `
    } else {
      competitorHtml = `${sectionTitle('Competitor analysis')}<p style="font-size:13px;color:#9ca3af">No competitor analysis has been run for this client yet.</p>`
    }

    // ── STRATEGY SECTION ──────────────────────────────────────────────────────
    let strategyHtml = ''
    if (s) {
      const kw = s.keyword_strategy
      strategyHtml = `
        ${sectionTitle('Strategy & media plan', strategy?.title || '')}
        ${s.tracking_alert ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:16px"><p style="font-size:12px;font-weight:600;color:#991b1b;margin:0">⚠️ Tracking alert: ${s.tracking_alert}</p></div>` : ''}
        ${s.executive_summary ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #1a1a2e"><p style="font-size:13px;color:#374151;line-height:1.7;margin:0">${s.executive_summary}</p></div>` : ''}

        ${s.expected_kpis ? `
          <p style="font-size:12px;font-weight:600;color:#374151;margin:0 0 10px">Expected KPIs</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
            ${[['Expected ROAS',s.expected_kpis.expected_roas],['Expected CPA',s.expected_kpis.expected_cpa],['Monthly Conversions',s.expected_kpis.monthly_conversions],['Monthly Impressions',s.expected_kpis.monthly_impressions],['Monthly Clicks',s.expected_kpis.monthly_clicks],['Expected CPL',s.expected_kpis.expected_cpl]].filter(([,v])=>v).map(([l,v])=>`<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px"><div style="font-size:10px;color:#9ca3af;margin-bottom:4px">${l}</div><div style="font-size:18px;font-weight:600;color:#111827">${v}</div></div>`).join('')}
          </div>` : ''}

        ${s.channel_strategy?.length ? `
          <p style="font-size:12px;font-weight:600;color:#374151;margin:0 0 10px">Channel strategy & budget split</p>
          ${s.channel_strategy.map(ch => `
            <div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:10px;overflow:hidden">
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #f0f0f0">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:13px;font-weight:600;color:#111827">${ch.channel}</span>
                  <span style="font-size:10px;background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:20px">${ch.role}</span>
                </div>
                <div style="text-align:right"><div style="font-size:13px;font-weight:600;color:#111827">AED ${(ch.monthly_budget||0).toLocaleString()}/mo</div><div style="font-size:11px;color:#9ca3af">${ch.budget_percentage}% of budget</div></div>
              </div>
              <div style="padding:10px 14px">
                ${ch.bid_strategy ? `<div style="font-size:11px;background:#eff6ff;color:#1d4ed8;padding:6px 10px;border-radius:6px;margin-bottom:8px;font-weight:500">Bid strategy: ${ch.bid_strategy}</div>` : ''}
                <p style="font-size:12px;color:#6b7280;margin:0 0 8px;line-height:1.5">${ch.rationale}</p>
                ${ch.budget_split?.length ? `
                  <div style="margin-top:8px">
                    ${ch.budget_split.map(b=>`<div style="display:flex;justify-content:space-between;font-size:11px;color:#374151;padding:4px 0;border-bottom:1px solid #f9fafb"><span>${b.campaign_type}</span><span style="font-weight:500">AED ${(b.budget_aed||0).toLocaleString()} (${b.percentage}%)</span></div>`).join('')}
                  </div>` : ''}
              </div>
            </div>`).join('')}
        ` : ''}

        ${kw ? `
          <p style="font-size:12px;font-weight:600;color:#374151;margin:20px 0 10px">Keyword strategy</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div><div style="font-size:10px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Branded keywords (${kw.branded_keywords?.length||0})</div><div style="display:flex;flex-wrap:wrap;gap:4px">${(kw.branded_keywords||[]).map(k=>bluePill(k)).join('')}</div></div>
            <div><div style="font-size:10px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Non-brand keywords (${kw.non_brand_keywords?.length||0})</div><div style="display:flex;flex-wrap:wrap;gap:4px">${(kw.non_brand_keywords||[]).map(k=>greenPill(k)).join('')}</div></div>
            <div><div style="font-size:10px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Account-level negatives</div><div style="display:flex;flex-wrap:wrap;gap:4px">${(kw.account_level_negatives||[]).map(k=>redPill('-'+k)).join('')}</div></div>
            <div><div style="font-size:10px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Campaign-level negatives</div><div style="display:flex;flex-wrap:wrap;gap:4px">${(kw.campaign_level_negatives||[]).map(k=>redPill('-'+k)).join('')}</div></div>
          </div>` : ''}

        ${s.quick_wins?.length ? `
          <p style="font-size:12px;font-weight:600;color:#374151;margin:20px 0 10px">Quick wins & timeline</p>
          ${s.quick_wins.map(w => {
            const action = typeof w === 'object' ? w.action : w
            const timeline = typeof w === 'object' ? w.timeline : null
            const impact = typeof w === 'object' ? w.expected_impact : null
            return `<div style="display:flex;gap:10px;padding:10px 12px;background:#f9fafb;border-radius:7px;margin-bottom:6px;align-items:flex-start">
              ${timeline ? `<span style="background:#1a1a2e;color:#e8c97e;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;flex-shrink:0">${timeline}</span>` : ''}
              <div><div style="font-size:12px;color:#374151">${action}</div>${impact?`<div style="font-size:11px;color:#16a34a;margin-top:3px">→ ${impact}</div>`:''}</div>
            </div>`
          }).join('')}
        ` : ''}

        ${s.target_audience ? `
          <p style="font-size:12px;font-weight:600;color:#374151;margin:20px 0 10px">Target audience</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            ${s.target_audience.primary ? `<div style="background:#f9fafb;border-radius:8px;padding:12px"><div style="font-size:10px;color:#9ca3af;margin-bottom:4px">Primary</div><p style="font-size:12px;color:#374151;line-height:1.5;margin:0">${s.target_audience.primary}</p></div>` : ''}
            ${s.target_audience.secondary ? `<div style="background:#f9fafb;border-radius:8px;padding:12px"><div style="font-size:10px;color:#9ca3af;margin-bottom:4px">Secondary</div><p style="font-size:12px;color:#374151;line-height:1.5;margin:0">${s.target_audience.secondary}</p></div>` : ''}
          </div>
          ${s.target_audience.interests?.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${s.target_audience.interests.map(t=>grayPill(t)).join('')}</div>` : ''}
        ` : ''}
      `
    } else {
      strategyHtml = `${sectionTitle('Strategy & media plan')}<p style="font-size:13px;color:#9ca3af">No strategy has been built for this client yet.</p>`
    }

    // ── AD CREATIVE NOTE ──────────────────────────────────────────────────────
    const creativeHtml = `
      ${sectionTitle('Ad creative')}
      <div style="background:#f9fafb;border-radius:8px;padding:16px;border:1px solid #e5e7eb">
        <p style="font-size:13px;color:#6b7280;margin:0">Ad copy variants are available in the Ad Creative section of PerfHub. Export from the Ad Creative page for the full set of headlines, descriptions and creative briefs per variant.</p>
      </div>
    `

    win.document.write(`<!DOCTYPE html><html><head><title>Full Report — ${client?.name}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;padding:0;background:white}
      @media print{
        .no-print{display:none}
        body{padding:0}
        .page-break{page-break-before:always}
      }
    </style></head><body>

    <!-- COVER PAGE -->
    <div style="min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;padding:60px 60px 40px;background:white">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="background:#1a1a2e;color:#e8c97e;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;letter-spacing:.05em">PerfHub</div>
        <div style="font-size:12px;color:#9ca3af">${now}</div>
      </div>
      <div>
        <p style="font-size:13px;color:#9ca3af;margin:0 0 12px;text-transform:uppercase;letter-spacing:.1em">Performance Marketing Report</p>
        <h1 style="font-size:48px;font-weight:700;color:#111827;margin:0 0 16px;line-height:1.1">${client?.name}</h1>
        <p style="font-size:16px;color:#6b7280;margin:0 0 32px">${client?.industry || ''} ${client?.website ? '· ' + client.website.replace(/https?:\/\//, '') : ''}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${audit ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px"><div style="font-size:10px;color:#9ca3af;margin-bottom:2px">Latest audit</div><div style="font-size:13px;font-weight:500">${new Date(audit.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div></div>` : ''}
          ${competitors.length ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px"><div style="font-size:10px;color:#9ca3af;margin-bottom:2px">Competitors tracked</div><div style="font-size:13px;font-weight:500">${competitors.length}</div></div>` : ''}
          ${strategy ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px"><div style="font-size:10px;color:#9ca3af;margin-bottom:2px">Strategy</div><div style="font-size:13px;font-weight:500">${strategy.title}</div></div>` : ''}
          ${client?.monthly_budget ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px"><div style="font-size:10px;color:#9ca3af;margin-bottom:2px">Monthly budget</div><div style="font-size:13px;font-weight:500">AED ${client.monthly_budget.toLocaleString()}</div></div>` : ''}
        </div>
      </div>
      <div style="border-top:1px solid #f0f0f0;padding-top:20px">
        <p style="font-size:11px;color:#9ca3af">Prepared by PerfHub · ${now} · Confidential</p>
      </div>
    </div>

    <!-- REPORT CONTENT -->
    <div style="padding:40px 60px" class="page-break">
      ${auditHtml}
      <div class="page-break" style="margin-top:40px">${competitorHtml}</div>
      <div class="page-break" style="margin-top:40px">${strategyHtml}</div>
      <div style="margin-top:40px">${creativeHtml}</div>
      <div style="margin-top:48px;padding-top:20px;border-top:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center">
        <p style="font-size:11px;color:#9ca3af">PerfHub · Performance Marketing Report · ${client?.name}</p>
        <p style="font-size:11px;color:#9ca3af">${now}</p>
      </div>
    </div>

    <script>window.onload = () => { window.print(); }</script>
    </body></html>`)

    win.document.close()
    setGenerating(false)
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-screen">
      <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{animationDelay:`${i*.15}s`}}/>)}</div>
    </div>
  )

  if (!client) return (
    <div className="p-6 text-center">
      <p className="text-sm text-gray-500">Client not found.</p>
    </div>
  )

  const hasData = audit || competitors.length || strategy

  return (
    <div className="p-6 max-w-2xl">
      <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6" onClick={() => router.push('/clients')}>
        <ArrowLeft size={14}/> Back to clients
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Full client report</h1>
          <p className="text-sm text-gray-400 mt-0.5">{client.name} · {client.industry}</p>
        </div>
        <button className="btn-primary" onClick={exportPDF} disabled={generating || !hasData}>
          <Download size={13}/>{generating ? 'Generating...' : 'Export PDF'}
        </button>
      </div>

      <div className="space-y-3">
        {[
          ['Account audit', audit ? `${audit.platform === 'google' ? 'Google Ads' : 'Meta Ads'} · ${audit.date_range} · ${new Date(audit.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}` : null],
          ['Competitor analysis', competitors.length ? `${competitors.length} competitor${competitors.length>1?'s':''} · ${competitors.map(c=>c.competitor_name).join(', ')}` : null],
          ['Strategy & media plan', strategy ? `${strategy.title} · ${new Date(strategy.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}` : null],
          ['Ad creative', 'Export from Ad Creative page for full copy'],
        ].map(([label, detail]) => (
          <div key={label} className={`card p-4 flex items-center justify-between ${detail ? '' : 'opacity-40'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${detail ? 'bg-green-500' : 'bg-gray-300'}`}/>
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{detail || 'No data yet — run this agent first'}</p>
              </div>
            </div>
            {detail && <FileText size={14} className="text-gray-300"/>}
          </div>
        ))}
      </div>

      {!hasData && (
        <div className="card p-8 text-center mt-4">
          <p className="text-sm text-gray-500 mb-1">No data available yet</p>
          <p className="text-xs text-gray-400">Run an audit, competitor analysis and strategy for this client first, then come back to export the full report.</p>
        </div>
      )}
    </div>
  )
}
