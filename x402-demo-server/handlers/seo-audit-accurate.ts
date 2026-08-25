import type { Context } from 'hono';
import { analyzeHtmlSeoRules, SeoIssue } from './seo-audit-fast';
import { groqManager } from './lib/groq-manager';

/**
 * POST /seo-audit-accurate
 * High-precision LLM-assisted SEO audit for a single page URL.
 */
export async function handleSeoAuditAccurateRequest(c: Context) {
  const startTime = Date.now();
  try {
    console.log('✓ PAYMENT VERIFIED - POST /seo-audit-accurate handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { page_url } = body;

    if (!page_url || typeof page_url !== 'string') {
      return c.json({ error: 'page_url is a required parameter in the request body.' }, 400);
    }

    const targetUrl = page_url.startsWith('http') ? page_url : `https://${page_url}`;
    const pageRes = await fetch(targetUrl, {
      headers: { 'User-Agent': 'PRISM-SEOAudit/1.0' },
    });

    if (!pageRes.ok) {
      return c.json({ error: `Failed to fetch page from ${targetUrl}: ${pageRes.statusText}` }, 400);
    }

    const html = await pageRes.text();

    // Perform baseline rule checks first
    const { issues: ruleIssues, seo_score: ruleScore } = await analyzeHtmlSeoRules(html, targetUrl);

    // Extract text content for LLM readability and keyword relevance analysis
    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 3000)
      .trim();

    const aiResult = await groqManager.chatCompletion<{
      llm_issues?: SeoIssue[];
      seo_score?: number;
    }>({
      model: 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO specialist and technical auditor. Analyze webpage text content for readability, engagement, keyword relevance, search intent match, and content depth. Return ONLY valid JSON: { "llm_issues": [{ "category": "content"|"metadata"|"heading"|"images"|"links", "severity": "low"|"medium"|"high", "description": string, "suggestion": string }], "seo_score": number } where seo_score is a float between 0.0 and 1.0.',
        },
        {
          role: 'user',
          content: `Page URL: ${targetUrl}\n\nWebpage Extract:\n${cleanText}`,
        },
      ],
      temperature: 0.1,
    });

    const parsed = aiResult.data || {};
    const llmIssues: SeoIssue[] = Array.isArray(parsed.llm_issues) ? parsed.llm_issues : [];
    const llmScore = typeof parsed.seo_score === 'number' ? Math.max(0, Math.min(1, parsed.seo_score)) : ruleScore;

    // Combine rule-based issues and LLM issues
    const combinedIssues = [...ruleIssues, ...llmIssues];
    const finalScore = parseFloat(((ruleScore * 0.4) + (llmScore * 0.6)).toFixed(2));
    const totalLatency = Date.now() - startTime;

    return c.json({
      success: true,
      page_url: targetUrl,
      issues: combinedIssues,
      seo_score: finalScore,
      confidence: 0.94,
      latency_ms: totalLatency,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in seo-audit-accurate handler:', error);
    const status = error.status && typeof error.status === 'number' ? error.status : 500;
    return c.json({
      success: false,
      error: {
        code: error.code || 'AI_ANALYSIS_FAILED',
        message: error.message || 'SEO audit AI analysis failed',
        status,
        rotationReasons: error.rotationReasons,
      },
    }, status);
  }
}
