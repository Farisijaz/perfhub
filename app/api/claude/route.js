import { callClaude, callClaudeWithSearch, safeJSON, MODELS } from '@/lib/claude'
import { createServerClient } from '@/lib/supabase'

const CACHE_TTL_DAYS = { market_audit: 7, competitor: 3, audit: 1, strategy: 7 }

function cacheExpired(createdAt, agent) {
  if (!createdAt) return true
  const ageMs = Date.now() - new Date(createdAt).getTime()
  return ageMs > (CACHE_TTL_DAYS[agent] || 1) * 24 * 60 * 60 * 1000
}

export async function POST(request) {
  try {
    const { agent, payload } = await request.json()
    switch (agent) {

      case 'audit': {
        const { clientName, industry, platform, dateRange, metrics, clientId } = payload
        if (clientId && !metrics) {
          const supabase = createServerClient()
          const { data: cached } = await supabase.from('audits').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).single()
          if (cached && !cacheExpired(cached.created_at, 'audit'))
            return Response.json({ success: true, summary: cached.summary, recommendations: cached.recommendations_json, cached: true })
        }
        const benchmarks = {
          'F&B / Restaurant': { roas: 3.5, cpa: 35, cpc: 1.2, cpm: 8 },
          'E-commerce': { roas: 4.0, cpa: 200, cpc: 1.5, cpm: 10 },
          'Real Estate': { roas: 2.5, cpa: 800, cpc: 3.5, cpm: 15 },
          'Healthcare': { roas: 3.0, cpa: 120, cpc: 2.8, cpm: 12 },
          'Education': { roas: 2.8, cpa: 150, cpc: 2.2, cpm: 11 },
          'Automotive': { roas: 3.2, cpa: 600, cpc: 2.5, cpm: 13 },
          'Finance': { roas: 2.8, cpa: 200, cpc: 3.8, cpm: 14 },
          'Retail': { roas: 4.0, cpa: 120, cpc: 1.4, cpm: 9 },
          'Travel & Hospitality': { roas: 3.8, cpa: 250, cpc: 1.8, cpm: 11 },
          'Technology': { roas: 3.0, cpa: 180, cpc: 3.2, cpm: 13 },
          'Fashion': { roas: 4.2, cpa: 180, cpc: 1.3, cpm: 9 },
          'Beauty & Wellness': { roas: 4.0, cpa: 150, cpc: 1.4, cpm: 9 },
        }
        const b = benchmarks[industry] || { roas: 3.5, cpa: 150, cpc: 2.0, cpm: 10 }
        const metricsText = metrics
          ? `Spend: AED ${metrics.totals.spend.toFixed(2)} | Clicks: ${metrics.totals.clicks} | Impressions: ${metrics.totals.impressions.toLocaleString()} | Conversions: ${metrics.totals.conversions} | ROAS: ${metrics.roas.toFixed(2)}x | CPC: AED ${metrics.cpc.toFixed(2)} | CPM: AED ${metrics.cpm.toFixed(2)} | CPA: AED ${metrics.cpa.toFixed(2)} | CTR: ${metrics.ctr.toFixed(2)}% | Conv rate: ${metrics.convRate.toFixed(2)}%`
          : 'No CSV uploaded — provide general best-practice audit recommendations.'
        const raw = await callClaudeWithSearch({
          model: MODELS.standard,
          maxTokens: 2500,
          systemPrompt: `You are a senior performance marketing analyst at a Dubai agency. Search for current ${industry} ${platform === 'google' ? 'Google Ads' : 'Meta Ads'} benchmarks. Write in plain paragraphs only. No markdown, no headers, no bullet points. IMPORTANT: Start your first paragraph with the client name. Never start with a comma, conjunction, or connecting word.`,
          userPrompt: `Audit for ${clientName} (${industry}) — ${platform === 'google' ? 'Google Ads' : 'Meta Ads'}, ${dateRange}. Currency: AED.\nSearch: "${industry} ${platform === 'google' ? 'Google Ads' : 'Meta Ads'} benchmarks ${new Date().getFullYear()} CPC ROAS"\nMetrics: ${metricsText}\nBenchmarks: ROAS ${b.roas}x | CPA AED ${b.cpa} | CPC AED ${b.cpc} | CPM AED ${b.cpm}\nWrite 4 paragraphs starting with "${clientName}": (1) Account health vs benchmarks. (2) Top issues with numbers. (3) Opportunities. (4) 3 priority actions with expected uplift. End with one bottom-line sentence.`,
        })
        const text = raw.replace(/^[\s,;.]+/, '').replace(/^(so|and|but|however|therefore|thus|also|additionally|furthermore|moreover)[,\s]+/i, '')
        return Response.json({ success: true, summary: text, recommendations: buildAuditRecos(metrics, b, platform, industry), benchmarks: b })
      }

      case 'competitor': {
        const { clientName, industry, competitorName, competitorUrl, clientId } = payload
        if (clientId) {
          const supabase = createServerClient()
          const { data: cached } = await supabase.from('competitor_analyses').select('*').eq('client_id', clientId).eq('competitor_name', competitorName).order('created_at', { ascending: false }).limit(1).single()
          if (cached && !cacheExpired(cached.created_at, 'competitor'))
            return Response.json({ success: true, analysis: cached.analysis_json, cached: true })
        }
        const text = await callClaudeWithSearch({
          model: MODELS.standard, maxTokens: 3000,
          systemPrompt: `You are a competitive intelligence analyst. Search the web for real current data. CRITICAL: Respond with a single valid JSON object only. No text before or after. Start with { end with }.`,
          userPrompt: `Analyse "${competitorName}" (${competitorUrl || 'no URL'}) as a competitor to ${clientName} in ${industry} in UAE/Middle East.\nSearch: "${competitorName} ads marketing ${new Date().getFullYear()}"\nJSON only:\n{"overview":"2-3 sentence overview","organic_social":{"estimated_followers":"range","posting_frequency":"X posts/week","engagement_rate":"X%","top_content_themes":["t1","t2","t3"],"platforms":["Instagram","Facebook"]},"paid_advertising":{"is_running_ads":true,"estimated_platforms":["Google Ads","Meta Ads"],"estimated_monthly_spend":"AED X,000 - AED X,000","ad_angles":["a1","a2","a3"]},"strengths":["s1","s2","s3"],"weaknesses":["w1","w2","w3"],"opportunities_for_client":["o1","o2","o3"],"threat_level":"High","threat_reason":"one sentence"}`,
        })
        const analysis = safeJSON(text)
        if (!analysis) return Response.json({ success: false, error: 'Could not parse analysis' }, { status: 500 })
        return Response.json({ success: true, analysis })
      }

      case 'strategy': {
        const { clientName, industry, goal, budget, duration, channels, currentRoas, clientId, market = 'UAE' } = payload
        if (clientId) {
          const supabase = createServerClient()
          const { data: cached } = await supabase.from('strategies').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).single()
          // Only use cache if market matches or no market field stored
          const cachedMarket = cached?.market || 'UAE'
          if (cached && !cacheExpired(cached.created_at, 'strategy') && cachedMarket === (market || 'UAE'))
            return Response.json({ success: true, strategy: cached.strategy_json, cached: true })
        }
        const hasTrackingIssue = currentRoas === 0 || currentRoas === '0' || currentRoas === '0.00'
        const text = await callClaudeWithSearch({
          model: MODELS.premium, maxTokens: 6000,
          systemPrompt: `You are a senior performance marketing strategist. Search for current UAE market data. CRITICAL: Respond with a single valid JSON object only. Start with { end with }.`,
          userPrompt: `Strategy for ${clientName} (${industry}).\nSearch: "${industry} digital marketing benchmarks ${market} ${new Date().getFullYear()}"\nGoal: ${goal} | Budget: AED ${budget}/month | Duration: ${duration} | Channels: ${channels.join(', ')} | Market: ${market}\n${hasTrackingIssue ? 'CRITICAL: ROAS is 0. Make fixing conversion tracking the top priority.' : ''}\nJSON only:\n{"executive_summary":"3-4 sentence overview","market_opportunity":"2-3 sentences on UAE opportunity","tracking_alert":${hasTrackingIssue ? '"CRITICAL: Conversion tracking broken. Fix before scaling spend."' : 'null'},"target_audience":{"primary":"detailed description","secondary":"description","demographics":"age, gender, income, location","interests":["i1","i2","i3","i4","i5"]},"channel_strategy":[{"channel":"name","role":"conversion|awareness|consideration","budget_percentage":40,"monthly_budget":4000,"rationale":"why","bid_strategy":"specific bid strategy","campaign_types":["type1","type2"],"budget_split":[{"campaign_type":"name","budget_aed":2000,"percentage":50,"rationale":"why"}],"kpis":["ROAS 4x","CPA AED 30"],"benchmarks":{"cpc":"AED 1.50","cpm":"AED 8","ctr":"3%","cpa":"AED 30","roas":"4x"}}],"keyword_strategy":{"branded_keywords":["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8","kw9","kw10"],"non_brand_keywords":["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8","kw9","kw10"],"account_level_negatives":["neg1","neg2","neg3","neg4","neg5","neg6","neg7","neg8","neg9","neg10"],"campaign_level_negatives":["neg1","neg2","neg3","neg4","neg5","neg6","neg7","neg8","neg9","neg10"]},"media_plan":{"month1":"Week 1-2: setup tasks. Week 3-4: launch tasks.","month2":"optimization focus","month3":"scaling tactics"},"creative_direction":{"tone":"brand tone description","messaging_pillars":["pillar1","pillar2","pillar3"],"formats":["format1","format2","format3"]},"expected_kpis":{"monthly_impressions":"range","monthly_clicks":"range","monthly_conversions":"range","expected_roas":"Xx","expected_cpa":"AED X","expected_cpl":"AED X or N/A"},"quick_wins":[{"action":"action","timeline":"Week 1","expected_impact":"result"},{"action":"action","timeline":"Week 2","expected_impact":"result"},{"action":"action","timeline":"Week 3-4","expected_impact":"result"}],"risks":["risk1 with mitigation","risk2 with mitigation"]}`,
        })
        const strategy = safeJSON(text)
        if (!strategy) return Response.json({ success: false, error: 'Could not parse strategy' }, { status: 500 })
        return Response.json({ success: true, strategy })
      }

      case 'creative': {
        const { clientName, industry, adType, objective, product, usp, cta, tone, market = 'UAE' } = payload
        const text = await callClaude({
          model: MODELS.standard, maxTokens: 4000,
          systemPrompt: `You are a performance marketing copywriter for UAE markets. Always respond with valid JSON only, no markdown, no backticks.`,
          userPrompt: `Write ${adType} for ${clientName} (${industry}).\nObjective: ${objective} | Product: ${product || 'main product'} | USPs: ${usp || 'quality and reliability'} | CTA: ${cta} | Tone: ${tone} | Market: ${market}\nSTRICT LIMITS: Headlines max 30 chars. Descriptions max 90 chars. Primary text max 125 chars.\nJSON only:\n{"ads":[{"variant":"Variant A","angle":"angle name","headlines":["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],"descriptions":["d1","d2","d3","d4","d5"],"primary_text":"under 125 chars","body_copy":"2-3 sentence body","cta":"${cta}","image_direction":"visual brief"},{"variant":"Variant B","angle":"different angle","headlines":["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],"descriptions":["d1","d2","d3","d4","d5"],"primary_text":"under 125","body_copy":"body","cta":"${cta}","image_direction":"brief"},{"variant":"Variant C","angle":"third angle","headlines":["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],"descriptions":["d1","d2","d3","d4","d5"],"primary_text":"under 125","body_copy":"body","cta":"${cta}","image_direction":"brief"}],"ab_test_recommendation":"which to test first and why","creative_notes":"notes for design team"}`,
        })
        const creative = safeJSON(text)
        if (!creative) return Response.json({ success: false, error: 'Could not parse creative' }, { status: 500 })
        return Response.json({ success: true, creative })
      }

      case 'tracking': {
        const { clientName, industry, platform, website } = payload
        const text = await callClaude({
          model: MODELS.standard,
          maxTokens: 2500,
          systemPrompt: `You are a digital marketing tracking specialist. Provide clear step-by-step setup guides for GTM, GA4, Meta Pixel, and Google Ads conversion tracking. Write for a non-technical marketing manager. Always respond with valid JSON only, no markdown, no backticks.`,
          userPrompt: `Create a complete tracking setup guide for ${clientName} (${industry}). Platform: ${platform} | Website: ${website || 'not provided'} | Market: UAE\n\nRespond with ONLY this JSON structure:\n{"tracking_setup":[{"platform":"Google Tag Manager","priority":"First","steps":[{"step":1,"action":"Create GTM account","detail":"Go to tagmanager.google.com, sign in with your Google account, click Create Account, enter your company name and website URL"},{"step":2,"action":"Install GTM code on website","detail":"In GTM go to Admin then Install Google Tag Manager. Copy the first snippet and paste it in the head of every page on your website. Copy the second snippet and paste it immediately after the opening body tag."}]},{"platform":"GA4 Setup","priority":"Second","steps":[{"step":1,"action":"Create GA4 property","detail":"Go to analytics.google.com, click Admin in the bottom left, click Create Property, select GA4, enter your website name and URL, complete the setup wizard"},{"step":2,"action":"Connect GA4 via GTM","detail":"In GTM create a new tag, choose Google Analytics GA4 Configuration as the tag type, enter your GA4 Measurement ID which starts with G-, set the trigger to All Pages, save and publish"}]},{"platform":"Meta Pixel","priority":"Third","steps":[{"step":1,"action":"Create Meta Pixel","detail":"In Meta Business Manager go to Events Manager, click Connect Data Sources, select Web, choose Meta Pixel, give it a name and click Create"},{"step":2,"action":"Install Pixel via GTM","detail":"In GTM create a Custom HTML tag, paste the Meta Pixel base code from Events Manager, set the trigger to All Pages. Add separate event tags for key actions like Purchase and Lead."}]},{"platform":"Google Ads Conversion Tracking","priority":"Fourth","steps":[{"step":1,"action":"Create conversion action in Google Ads","detail":"In Google Ads click Goals then Conversions then the blue plus button. Select Website as your conversion source and follow the setup steps."},{"step":2,"action":"Set a conversion value","detail":"When setting up your conversion choose Use different values for each conversion and set a default value equal to your average sale or lead value in AED. This is essential for ROAS to work correctly."},{"step":3,"action":"Install tag via GTM","detail":"Copy your Conversion ID and Conversion Label from Google Ads. In GTM create a Google Ads Conversion Tracking tag, paste your ID and label, and set the trigger to fire only on your order confirmation or thank you page."}]}],"key_events_to_track":["purchase","lead","page_view","add_to_cart","begin_checkout","contact_form_submit","phone_call_click"],"gtm_tags_needed":["GA4 Configuration Tag","Meta Pixel Base Code","Google Ads Conversion Tracking Tag","GA4 Purchase Event Tag","Meta Purchase Event Tag"],"verification_checklist":["GTM Preview mode shows all tags firing correctly on key pages","GA4 DebugView shows events appearing in real time","Meta Pixel Helper Chrome extension shows the pixel is active","Google Tag Assistant confirms Google Ads conversion tag is working","Submit a test conversion and verify it appears in Google Ads within 3 hours","ROAS is no longer showing 0.00x in your Google Ads dashboard"]}`,
        })
        const tracking = safeJSON(text)
        if (!tracking) return Response.json({ success: false, error: 'Could not parse tracking' }, { status: 500 })
        return Response.json({ success: true, tracking })
      }

      case 'market_audit': {
        const { clientName, industry, website, market, competitors, budget, clientId } = payload
        if (clientId) {
          const supabase = createServerClient()
          const { data: cached } = await supabase.from('market_audits').select('*').eq('client_id', clientId).eq('market', market).order('created_at', { ascending: false }).limit(1).single()
          if (cached && !cacheExpired(cached.created_at, 'market_audit'))
            return Response.json({ success: true, benchmarks: cached.benchmark_json, competitor_intel: cached.competitor_intel_json, opportunities: cached.opportunities_json, summary: cached.summary, strategy: cached.strategy_json, cached: true })
        }
        const competitorList = competitors.map((c, i) => `${i+1}. ${c.name}${c.website ? ' (' + c.website + ')' : ''}`).join('\n')
        const text = await callClaudeWithSearch({
          model: MODELS.premium, maxTokens: 7000,
          systemPrompt: `You are a senior performance marketing strategist. Search the web for real current data on this market and industry. CRITICAL: Respond with a single valid JSON object only. No text before or after. No markdown. Start with { end with }.`,
          userPrompt: `Conduct a market audit AND launch strategy for a new business entering paid advertising.\nSearch: "${industry} Google Ads benchmarks ${market} ${new Date().getFullYear()} CPC CPM ROAS" and "${competitors.map(c=>c.name).join(' OR ')} digital advertising ${new Date().getFullYear()}"\nClient: ${clientName} | Industry: ${industry} | Market: ${market} | Budget: ${budget ? 'AED ' + budget : 'not set'}\nCompetitors:\n${competitorList}\nJSON only:\n{"summary":"3-4 paragraph market overview for ${market}","benchmarks":{"google":{"avg_cpc":"AED X.XX","avg_cpm":"AED X.XX","avg_ctr":"X.X%","avg_cpa":"AED XXX","avg_roas":"X.Xx","avg_conv_rate":"X.X%"},"meta":{"avg_cpc":"AED X.XX","avg_cpm":"AED X.XX","avg_ctr":"X.X%","avg_cpa":"AED XXX","avg_roas":"X.Xx","avg_engagement_rate":"X.X%"},"platform_notes":"which platforms dominate in ${market}"},"competitor_intel":[{"name":"name","website":"url","ad_presence":"Strong|Moderate|Weak","estimated_spend":"AED X,000 - AED X,000/month","platforms":["Google Ads","Meta Ads"],"ad_angles":["a1","a2","a3"],"likely_keywords":["k1","k2","k3","k4","k5"],"gap":"what they miss"}],"opportunities":[{"title":"opportunity","detail":"2-3 sentences for ${market}","action":"first action"},{"title":"opportunity","detail":"explanation","action":"action"},{"title":"opportunity","detail":"explanation","action":"action"}],"strategy":{"executive_summary":"3-4 sentence launch overview for ${market}","target_audience":{"primary":"detailed description","secondary":"secondary","interests":["i1","i2","i3","i4","i5"]},"channel_strategy":[{"channel":"name","role":"conversion|awareness","budget_percentage":55,"monthly_budget":5500,"rationale":"why for ${market}","bid_strategy":"bid strategy for new account","budget_split":[{"campaign_type":"name","budget_aed":2000,"percentage":50,"rationale":"why"}]}],"keyword_strategy":{"branded_keywords":["k1","k2","k3","k4","k5"],"non_brand_keywords":["k1","k2","k3","k4","k5","k6","k7","k8","k9","k10"],"competitor_keywords":["k1","k2","k3"],"account_level_negatives":["n1","n2","n3","n4","n5"]},"expected_kpis":{"monthly_impressions":"range","monthly_clicks":"range","monthly_conversions":"range","expected_roas":"Xx","expected_cpa":"AED X","expected_cpl":"AED X or N/A"},"quick_wins":[{"action":"action","timeline":"Week 1","expected_impact":"result"},{"action":"action","timeline":"Week 2","expected_impact":"result"},{"action":"action","timeline":"Week 3-4","expected_impact":"result"}],"launch_checklist":["item1","item2","item3","item4","item5"]}}`,
        })
        const result = safeJSON(text)
        if (!result) return Response.json({ success: false, error: 'Could not parse market audit' }, { status: 500 })
        return Response.json({ success: true, benchmarks: result.benchmarks, competitor_intel: result.competitor_intel, opportunities: result.opportunities, summary: result.summary, strategy: result.strategy })
      }

      case 'market_strategy':
        return Response.json({ success: true, strategy: null, cached: true })

      case 'insight': {
        const { clientName, industry, auditCount, latestMetrics, strategyCount, competitorNames } = payload
        const text = await callClaude({
          model: MODELS.fast, maxTokens: 600,
          systemPrompt: `You are a senior performance marketing analyst. Write sharp executive-level insights in plain paragraphs. No markdown, no headers, no bullet points.`,
          userPrompt: `Write a concise performance summary for ${clientName} (${industry}).\nAudits: ${auditCount} | Metrics: ${JSON.stringify(latestMetrics?.slice(0,3))} | Strategies: ${strategyCount} | Competitors: ${competitorNames}\n3 short paragraphs: (1) Current account health. (2) Strategic progress. (3) Top 2 focus areas this week.`,
        })
        return Response.json({ success: true, insight: text })
      }

      default:
        return Response.json({ success: false, error: 'Unknown agent' }, { status: 400 })
    }
  } catch (err) {
    console.error('Agent error:', err)
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}

function buildAuditRecos(data, b, platform, industry) {
  if (!data) return [{ title: 'Upload a CSV for personalised recommendations', desc: 'Export from your ad platform and upload above.', impact: 'High' }]
  const r = []
  if (data.roas === 0) r.push({ title: 'Conversion value tracking is broken — fix immediately', desc: 'ROAS is showing 0.00x because Google Ads is not receiving purchase values. Go to Tools → Conversions → your purchase action → set value to your average order value in AED.', impact: 'High' })
  else if (data.roas < b.roas) r.push({ title: 'ROAS below benchmark — restructure bid strategy', desc: `ROAS of ${data.roas.toFixed(1)}x is below the ${b.roas}x benchmark. Switch to Target ROAS bidding at ${(b.roas * 0.9).toFixed(1)}x. Expected: +20-35% ROAS in 4 weeks.`, impact: 'High' })
  if (data.cpa > b.cpa) r.push({ title: 'CPA above target — align landing pages to ad copy', desc: `CPA of AED ${data.cpa.toFixed(0)} exceeds the AED ${b.cpa} target. A/B test landing page headlines. Expected: 15-25% CPA reduction.`, impact: 'High' })
  if (data.ctr < 2) r.push({ title: 'Low CTR — test new headlines and creative formats', desc: `CTR of ${data.ctr.toFixed(2)}% is below the 3.1% average. Test video formats which drive 20-30% higher CTR.`, impact: 'Medium' })
  if (platform === 'meta' && data.frequency > 3) r.push({ title: 'Ad fatigue — refresh creatives urgently', desc: `Frequency of ${data.frequency.toFixed(1)} exceeds the 3.0 optimal ceiling. Introduce 4-6 new variants immediately.`, impact: 'High' })
  if (platform === 'google' && data.cpc > b.cpc * 1.3) r.push({ title: 'CPC elevated — add negative keywords', desc: `CPC of AED ${data.cpc.toFixed(2)} is above the AED ${b.cpc} average. Run a search term report and add negatives. Expected: 10-20% CPC reduction.`, impact: 'Medium' })
  r.push({ title: 'Set automated budget protection rules', desc: `Pause ads with CPA above AED ${(b.cpa * 1.5).toFixed(0)} after 100 impressions. Scale budget +20% when ROAS exceeds ${(b.roas * 1.2).toFixed(1)}x.`, impact: 'Medium' })
  return r.slice(0, 5)
}
