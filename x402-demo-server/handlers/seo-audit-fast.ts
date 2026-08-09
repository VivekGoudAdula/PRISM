import type { Context } from 'hono';

export interface SeoIssue {
  category: 'metadata' | 'heading' | 'images' | 'links' | 'content';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

/**
 * Performs rule-based SEO checks on HTML content.
 */
export async function analyzeHtmlSeoRules(html: string, pageUrl: string): Promise<{ issues: SeoIssue[]; seo_score: number }> {
  const issues: SeoIssue[] = [];
  let scoreDeductions = 0;

  // 1. Title Tag Check
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].trim() : '';

  if (!titleText) {
    issues.push({
      category: 'metadata',
      severity: 'high',
      description: 'Missing title tag.',
      suggestion: 'Add a descriptive <title> tag between 30 and 60 characters.',
    });
    scoreDeductions += 0.25;
  } else if (titleText.length < 30 || titleText.length > 60) {
    issues.push({
      category: 'metadata',
      severity: 'medium',
      description: `Title tag length (${titleText.length} chars) is outside optimal range (30-60 chars).`,
      suggestion: 'Adjust title tag length to be between 30 and 60 characters for best SERP display.',
    });
    scoreDeductions += 0.10;
  }

  // 2. Meta Description Check
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const metaDescText = metaDescMatch ? metaDescMatch[1].trim() : '';

  if (!metaDescText) {
    issues.push({
      category: 'metadata',
      severity: 'high',
      description: 'Missing meta description.',
      suggestion: 'Add a concise <meta name="description"> tag between 120 and 160 characters.',
    });
    scoreDeductions += 0.25;
  } else if (metaDescText.length < 120 || metaDescText.length > 160) {
    issues.push({
      category: 'metadata',
      severity: 'medium',
      description: `Meta description length (${metaDescText.length} chars) is outside optimal range (120-160 chars).`,
      suggestion: 'Optimize meta description length to be between 120 and 160 characters.',
    });
    scoreDeductions += 0.10;
  }

  // 3. Single H1 Check
  const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
  if (h1Matches.length === 0) {
    issues.push({
      category: 'heading',
      severity: 'high',
      description: 'Missing H1 heading on the page.',
      suggestion: 'Include exactly one <h1> tag representing the primary page heading.',
    });
    scoreDeductions += 0.20;
  } else if (h1Matches.length > 1) {
    issues.push({
      category: 'heading',
      severity: 'medium',
      description: `Multiple H1 headings found (${h1Matches.length} headings).`,
      suggestion: 'Use a single <h1> heading per page and structure secondary headings with <h2>-<h6>.',
    });
    scoreDeductions += 0.10;
  }

  // 4. Images Missing Alt Text
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  let missingAltCount = 0;
  for (const img of imgMatches) {
    const hasAlt = /alt=["']([^"']*)["']/i.test(img);
    if (!hasAlt) {
      missingAltCount++;
    } else {
      const altContentMatch = img.match(/alt=["']([^"']*)["']/i);
      if (altContentMatch && !altContentMatch[1].trim()) {
        missingAltCount++;
      }
    }
  }
  if (missingAltCount > 0) {
    issues.push({
      category: 'images',
      severity: missingAltCount > 3 ? 'high' : 'medium',
      description: `Found ${missingAltCount} image(s) missing alt text out of ${imgMatches.length} total image(s).`,
      suggestion: 'Add descriptive alt attribute values to all <img> elements for accessibility and SEO image search.',
    });
    scoreDeductions += Math.min(0.20, missingAltCount * 0.05);
  }

  // 5. Internal Links & Basic Broken Links Check
  let baseOrigin = '';
  try {
    baseOrigin = new URL(pageUrl).origin;
  } catch {
    baseOrigin = '';
  }

  const hrefRegex = /href=["']([^"']+)["']/gi;
  const internalHrefs: string[] = [];
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      continue;
    }
    try {
      const resolved = new URL(rawHref, pageUrl);
      if (baseOrigin && resolved.origin === baseOrigin) {
        internalHrefs.push(resolved.href);
      }
    } catch {
      issues.push({
        category: 'links',
        severity: 'low',
        description: `Malformed link found in HTML: "${rawHref}".`,
        suggestion: 'Fix invalid URL syntax in link href attributes.',
      });
      scoreDeductions += 0.02;
    }
  }

  // Basic check on up to 5 internal links (HEAD/GET fetch check)
  const linksToCheck = Array.from(new Set(internalHrefs)).slice(0, 5);
  let brokenCount = 0;
  for (const link of linksToCheck) {
    try {
      const res = await fetch(link, { method: 'HEAD', headers: { 'User-Agent': 'PRISM-SEOAudit/1.0' } });
      if (!res.ok && res.status !== 405) {
        brokenCount++;
      }
    } catch {
      brokenCount++;
    }
  }
  if (brokenCount > 0) {
    issues.push({
      category: 'links',
      severity: 'high',
      description: `Found ${brokenCount} internal broken or unreachable link(s) among checked sample.`,
      suggestion: 'Verify internal link URLs and ensure they return HTTP status 200.',
    });
    scoreDeductions += 0.15;
  }

  // 6. Word Count / Readability Estimate
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = bodyText ? bodyText.split(/\s+/).length : 0;
  if (words < 300) {
    issues.push({
      category: 'content',
      severity: 'medium',
      description: `Low word count (${words} words). Thin content may underperform in search rankings.`,
      suggestion: 'Expand page content to at least 300-500 words of relevant, structured text.',
    });
    scoreDeductions += 0.15;
  }

  const seo_score = Math.max(0, Math.min(1, parseFloat((1.0 - scoreDeductions).toFixed(2))));

  return {
    issues,
    seo_score,
  };
}

/**
 * POST /seo-audit-fast
 * Fast rule-based SEO audit for a single page URL (no LLM call).
 */
export async function handleSeoAuditFastRequest(c: Context) {
  const startTime = Date.now();
  try {
    console.log('✓ PAYMENT VERIFIED - POST /seo-audit-fast handler executing');
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
    const { issues, seo_score } = await analyzeHtmlSeoRules(html, targetUrl);

    const latency_ms = Date.now() - startTime;

    return c.json({
      page_url: targetUrl,
      issues,
      seo_score,
      confidence: 0.78,
      latency_ms,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in seo-audit-fast handler:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
}
