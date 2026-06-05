import { callClaude, safeJSON } from '@/lib/claude'
import { createServerClient } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { agent, payload } = await request.json()

    switch (agent) {

      case 'audit': {
        const { clientName, industry, platform, dateRange, metrics } = payload
        const benchmarks = {
          'F&B / Restaurant':     { roas: 3.5, cpa: 25,  cpc: 1.2, cpm: 8  },
          'E-commerce':           { roas: 4.0, cpa: 30,  cpc: 1.5, cpm: 10 },
          'Real Estate':          { roas: 2.5, cpa: 80,  cpc: 3.5, cpm: 15 },
          'Healthcare':           { roas: 3.0, cpa: 50,  cpc: 2.8, cpm: 12 },
          'Education':            { roas: 2.8, cpa: 45,  cpc: 2.2, cpm: 11 },
          'Automotive':           { roas: 3.2, cpa: 60,  cpc: 2.5, cpm: 13 },
          'Finance':              { roas: 2.8, cpa: 55,  cpc: 3.8, cpm: 14 },
          'Retail':               { roas: 4.0, cpa: 28,  cpc: 1.4, cpm: 9  },
          'Travel & Hospitality': { roas: 3.8, cpa: 40,  cpc: 1.8, cpm: 11 },
          'Technology':           { roas: 3.0, cpa: 60,  cpc: 3.2, cpm: 13 },
          'Fashion':              { roas: 4.2, cpa: 25,  cpc: 1.3, cpm: 9  },
        }
        const b = benchmarks[industry] || { roas: 3.5, cpa: 35, cpc: 2.0, cpm: 10 }
        const metricsText = metrics
          ? `Spend: AED ${metrics.totals.spend.toFixed(2)} | Clicks: ${metrics.totals.clicks} | Impressions: ${metrics.totals.impressions.toLocaleString()} | Conversions: ${metrics.totals.conversions} | ROAS: ${metrics.roas.toFixed(2)}x | CPC: AED ${metrics.cpc.toFixed(2)} | CPM: AED ${metrics.cpm.toFixed(2)} | CPA: AED ${metrics.cpa.toFixed(2)} | CTR: ${metrics.ctr.toFixed(2)}% | Conv rate: ${metrics.convRate.toFixed(2)}%${metrics.frequency ? ` | Frequency: ${metrics.frequency.toFixed(1)}` : ''}`
          : 'No CSV uploaded — provide general best-practice audit recommendations.'

        const text = await callClaude({
          systemPrompt: `You are a senior performance marketing analyst at a leading digital agency in Dubai. Write direct, specific, client-ready audit reports. Write in plain flowing paragraphs only. Do not use markdown, headers, bullet points, asterisks, hashtags, or any special formatting. No bold text. Just clean professional paragraphs separated by line breaks.`,
          userPrompt: `Write a performance audit for ${clientName} (${industry}) — ${platform === 'google' ? 'Google Ads' : 'Meta Ads'}. Period: ${dateRange}. Currency is AED.

Metrics: ${metricsText}
Benchmarks: ROAS ${b.roas}x | CPA AED ${b.cpa} | CPC AED ${b.cpc} | CPM AED ${b.cpm}

Write 4 paragraphs with no headers or formatting:
Paragraph 1: Overall account health vs benchmarks.
Paragraph 2: Top issues with specific numbers.
Paragraph 3: Opportunities to scale.
Paragraph 4: 3 priority actions with expected improvement.
End with one bottom-line sentence.`
        })

        const recommendations = buildAuditRecos(metrics, b, platform, industry)
        return Response.json({ success: true, summary: text, recommendations, benchmarks: b })
      }

      case 'competitor': {
        const { clientName, industry, competitorName, competitorUrl } = payload
        const text = await callClaude({
          systemPrompt: `You are a senior competitive intelligence analyst at a performance marketing agency in Dubai. Be specific, data-driven, and actionable. Always respond with valid JSON only, no other text, no markdown.`,
          userPrompt: `Analyse "${competitorName}" (${competitorUrl || 'no URL'}) as a competitor to ${clientName} in the ${industry || 'digital marketing'} industry in UAE/Middle East.

Respond with ONLY this JSON, no markdown, no backticks:
{
  "overview": "2-3 sentence company overview",
  "organic_social": {
    "estimated_followers": "estimated follower range",
    "posting_frequency": "estimated posts per week",
    "engagement_rate": "estimated %",
    "top_content_themes": ["theme1", "theme2", "theme3"],
    "platforms": ["Instagram", "Facebook"]
  },
  "paid_advertising": {
    "is_running_ads": true,
    "estimated_platforms": ["Google Ads", "Meta Ads"],
    "ad_themes": ["theme1", "theme2"],
    "estimated_monthly_spend": "AED X,000 - AED X,000",
    "ad_angles": ["angle1", "angle2", "angle3"]
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "opportunities_for_client": ["opportunity1", "opportunity2", "opportunity3"],
  "threat_level": "High",
  "threat_reason": "one sentence"
}`
        })
        const analysis = safeJSON(text)
        if (!analysis) return Response.json({ success: false, error: 'Could not parse analysis' }, { status: 500 })
        return Response.json({ success: true, analysis })
      }

      case 'strategy': {
        const { clientName, industry, goal, budget, duration, channels } = payload
        const text = await callClaude({
          systemPrompt: `You are a senior performance marketing strategist at a leading digital agency in Dubai. Create comprehensive, data-driven marketing strategies for UAE/Middle East clients. Always respond with valid JSON only, no markdown, no backticks.`,
          userPrompt: `Create a performance marketing strategy for ${clientName} (${industry}).
Goal: ${goal} | Budget: AED ${budget}/month | Duration: ${duration} | Channels: ${channels.join(', ')} | Market: UAE

Respond with ONLY this JSON, no markdown:
{
  "executive_summary": "3-4 sentence overview",
  "market_opportunity": "2-3 sentences on UAE market opportunity",
  "target_audience": {
    "primary": "description",
    "secondary": "description",
    "demographics": "age, gender, income",
    "interests": ["interest1", "interest2", "interest3"]
  },
  "channel_strategy": [
    {
      "channel": "Google Search",
      "role": "conversion",
      "budget_percentage": 40,
      "monthly_budget": 4000,
      "rationale": "why this channel",
      "kpis": ["ROAS 4x", "CPA AED 30"],
      "benchmarks": { "cpc": "AED 1.50", "cpm": "AED 8", "ctr": "3%", "cpa": "AED 30", "roas": "4x" }
    }
  ],
  "creative_direction": {
    "messaging_pillars": ["pillar1", "pillar2", "pillar3"],
    "tone": "brand tone",
    "formats": ["format1", "format2"]
  },
  "media_plan": {
    "month1": "focus and tactics",
    "month2": "focus and tactics",
    "month3": "focus and tactics"
  },
  "expected_kpis": {
    "monthly_impressions": "500,000 - 700,000",
    "monthly_clicks": "15,000 - 20,000",
    "monthly_conversions": "300 - 450",
    "expected_roas": "3.8x",
    "expected_cpa": "AED 28",
    "expected_cpl": "AED 22"
  },
  "quick_wins": ["win1", "win2", "win3"],
  "risks": ["risk1", "risk2"]
}`
        })
        const strategy = safeJSON(text)
        if (!strategy) return Response.json({ success: false, error: 'Could not parse strategy' }, { status: 500 })
        return Response.json({ success: true, strategy })
      }

      case 'creative': {
        const { clientName, industry, adType, objective, product, usp, cta, tone } = payload
        const text = await callClaude({
          systemPrompt: `You are a world-class performance marketing copywriter. You write high-converting ads for Dubai and UAE markets. Always respond with valid JSON only, no markdown, no backticks, no extra text.`,
          userPrompt: `Write ${adType} for ${clientName} (${industry}).
Objective: ${objective} | Product: ${product} | USPs: ${usp || 'quality and reliability'} | CTA: ${cta} | Tone: ${tone} | Market: UAE/Dubai

Respond with ONLY this JSON:
{
  "ads": [
    {
      "variant": "Variant A",
      "angle": "the hook",
      "headlines": ["headline1 max 30 chars", "headline2 max 30 chars", "headline3 max 30 chars"],
      "descriptions": ["description1 max 90 chars", "description2 max 90 chars"],
      "primary_text": "meta primary text max 125 chars",
      "body_copy": "2-3 sentence body copy",
      "cta": "${cta}",
      "image_direction": "visual brief for designer"
    },
    {
      "variant": "Variant B",
      "angle": "different angle",
      "headlines": ["headline1", "headline2", "headline3"],
      "descriptions": ["description1", "description2"],
      "primary_text": "primary text",
      "body_copy": "body copy",
      "cta": "${cta}",
      "image_direction": "visual brief"
    },
    {
      "variant": "Variant C",
      "angle": "third angle",
      "headlines": ["headline1", "headline2", "headline3"],
      "descriptions": ["description1", "description2"],
      "primary_text": "primary text",
      "body_copy": "body copy",
      "cta": "${cta}",
      "image_direction": "visual brief"
    }
  ],
  "ab_test_recommendation": "which to test first and why",
  "creative_notes": "notes for design team"
}`
        })
        const creative = safeJSON(text)
        if (!creative) return Response.json({ success: false, error: 'Could not parse creative' }, { status: 500 })
        return Response.json({ success: true, creative })
      }

      case 'tracking': {
        const { clientName, industry, platform } = payload
        const text = await callClaude({
          systemPrompt: `You are a digital marketing tracking specialist. Provide clear step-by-step guides for GTM, GA4, Meta Pixel, and CAPI. Write for a non-technical marketing manager. Always respond with valid JSON only, no markdown, no backticks.`,
          userPrompt: `Create a complete tracking setup guide for ${clientName} (${industry}).
Platform focus: ${platform} | Market: UAE

Respond with ONLY this JSON:
{
  "tracking_setup": [
    {
      "platform": "Google Tag Manager",
      "priority": "First",
      "steps": [
        {"step": 1, "action": "Create GTM account", "detail": "Go to tagmanager.google.com, sign in with your Google account, click Create Account, enter your company name and website URL"},
        {"step": 2, "action": "Install GTM snippet", "detail": "Copy the GTM container snippet from Admin > Install Google Tag Manager and paste the first part in your website head, second part after opening body tag"}
      ]
    },
    {
      "platform": "GA4 Setup",
      "priority": "Second",
      "steps": [
        {"step": 1, "action": "Create GA4 property", "detail": "Go to analytics.google.com, click Admin, then Create Property, select GA4, enter your website details"}
      ]
    },
    {
      "platform": "Meta Pixel and CAPI",
      "priority": "Third",
      "steps": [
        {"step": 1, "action": "Create Meta Pixel", "detail": "Go to Meta Business Manager, click Events Manager, click Connect Data Sources, select Web, then Meta Pixel"}
      ]
    },
    {
      "platform": "Google Ads Conversion Tracking",
      "priority": "Fourth",
      "steps": [
        {"step": 1, "action": "Create conversion action", "detail": "In Google Ads, click Tools and Settings, then Conversions, click the blue plus button, select Website"}
      ]
    }
  ],
  "key_events_to_track": ["purchase", "lead", "page_view", "add_to_cart", "contact_form_submit"],
  "gtm_tags_needed": ["GA4 Configuration Tag", "Meta Pixel Base Code", "Google Ads Conversion Tracking", "GA4 Event Tags"],
  "verification_checklist": ["GTM Preview mode shows all tags firing on key pages", "GA4 DebugView shows events in real time", "Meta Pixel Helper Chrome extension shows pixel active", "Google Tag Assistant confirms Google Ads tag is working", "Test purchase or lead form submission appears in all platforms"]
}`
        })
        const tracking = safeJSON(text)
        if (!tracking) return Response.json({ success: false, error: 'Could not parse tracking' }, { status: 500 })
        return Response.json({ success: true, tracking })
      }

      case 'insight': {
        const { clientName, industry, auditCount, latestMetrics, strategyCount, competitorNames } = payload
        const text = await callClaude({
          systemPrompt: `You are a senior performance marketing analyst. Write sharp, executive-level insights in plain paragraphs. No markdown, no headers, no bullet points, no asterisks. Just clean professional text.`,
          userPrompt: `Write a concise performance summary for ${clientName} (${industry}).
Audits run: ${auditCount} | Latest metrics: ${JSON.stringify(latestMetrics?.slice(0,3))} | Strategies: ${strategyCount} | Competitors tracked: ${competitorNames}

Write 3 short paragraphs in plain text:
1. Current account health based on latest data.
2. Strategic progress and what has been put in place.
3. Top 2 things to focus on this week.

Be direct. Write like a trusted advisor giving a weekly briefing. No formatting, no headers.`
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
  if (data.roas < b.roas) r.push({ title: 'ROAS below benchmark — restructure bid strategy', desc: `ROAS of ${data.roas.toFixed(1)}x is below the ${b.roas}x benchmark. Switch to Target ROAS bidding at ${(b.roas * 0.9).toFixed(1)}x. Expected: +20-35% ROAS in 4 weeks.`, impact: 'High' })
  if (data.cpa > b.cpa) r.push({ title: 'CPA above target — align landing pages to ad copy', desc: `CPA of AED ${data.cpa.toFixed(0)} exceeds the AED ${b.cpa} target. A/B test landing page headlines. Expected: 15-25% CPA reduction.`, impact: 'High' })
  if (data.ctr < 2) r.push({ title: 'Low CTR — test new headlines and creative formats', desc: `CTR of ${data.ctr.toFixed(2)}% is below the 3.1% average. Test video formats which drive 20-30% higher CTR.`, impact: 'Medium' })
  if (platform === 'meta' && data.frequency > 3) r.push({ title: 'Ad fatigue — refresh creatives urgently', desc: `Frequency of ${data.frequency.toFixed(1)} exceeds the 3.0 optimal ceiling. Introduce 4-6 new variants immediately.`, impact: 'High' })
  if (platform === 'google' && data.cpc > b.cpc * 1.3) r.push({ title: 'CPC elevated — add negative keywords', desc: `CPC of AED ${data.cpc.toFixed(2)} is above the AED ${b.cpc} average. Run a search term report and add negatives. Expected: 10-20% CPC reduction.`, impact: 'Medium' })
  r.push({ title: 'Set automated budget protection rules', desc: `Pause ads with CPA above AED ${(b.cpa * 1.5).toFixed(0)} after 100 impressions. Scale budget +20% when ROAS exceeds ${(b.roas * 1.2).toFixed(1)}x.`, impact: 'Medium' })
  return r.slice(0, 5)
}
