import { config } from 'dotenv';
config();

export interface SitePage {
  url: string;
  title?: string;
}

export interface FetchSitePagesResult {
  pages: SitePage[];
  skipped: number;
  capped: boolean;
  total_pages_found: number;
}

/**
 * Extract website URL from text string if embedded within a prompt.
 * Trims trailing punctuation like commas, periods, or quotes.
 */
export function extractWebsiteUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return null;
  // Clean trailing punctuation attached from sentence structure
  let cleaned = match[0].replace(/[,.;:!?"']+$|[\)\]\}]+$/g, '');
  return cleaned || null;
}

/**
 * Normalizes URL and removes trailing slash unless root.
 */
function normalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    parsed.hash = '';
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;
    return parsed.href;
  } catch {
    return urlStr;
  }
}

/**
 * Extracts title tag content from HTML string if present.
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : undefined;
}

/**
 * Parses sitemap XML content for page URLs.
 */
function parseSitemapUrls(xmlText: string, baseOrigin: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xmlText)) !== null) {
    const loc = match[1].trim();
    try {
      const locUrl = new URL(loc);
      if (locUrl.origin === baseOrigin) {
        urls.push(normalizeUrl(locUrl.href));
      }
    } catch {
      // ignore invalid URLs in sitemap
    }
  }
  return urls;
}

/**
 * Extracts internal links from HTML string.
 */
function extractInternalLinks(html: string, baseOrigin: string, currentUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      continue;
    }
    try {
      const resolved = new URL(rawHref, currentUrl);
      if (resolved.origin === baseOrigin) {
        links.push(normalizeUrl(resolved.href));
      }
    } catch {
      // ignore malformed URLs
    }
  }
  return links;
}

/**
 * Fetches website pages by first trying sitemap.xml, then falling back to crawling.
 * Caps at 20 pages and reports skipped count.
 */
export async function fetchSitePages(siteUrl: string): Promise<{ pages: SitePage[]; skipped: number }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
  } catch {
    throw new Error(`Invalid website URL: ${siteUrl}`);
  }

  const baseOrigin = parsedUrl.origin;
  const discoveredPagesMap = new Map<string, SitePage>();

  // ── Step 1: Try fetching sitemap.xml ──────────────────────────────────────
  const sitemapUrl = `${baseOrigin}/sitemap.xml`;
  let sitemapSuccess = false;

  try {
    const sitemapRes = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'PRISM-SEOAudit-Crawler/1.0' },
    });
    if (sitemapRes.ok) {
      const xmlText = await sitemapRes.text();
      const sitemapPageUrls = parseSitemapUrls(xmlText, baseOrigin);
      if (sitemapPageUrls.length > 0) {
        sitemapSuccess = true;
        for (const url of sitemapPageUrls) {
          if (!discoveredPagesMap.has(url)) {
            discoveredPagesMap.set(url, { url });
          }
        }
      }
    }
  } catch (err) {
    console.log(`[fetch-website] Sitemap fetch failed for ${sitemapUrl}:`, err);
  }

  // ── Step 2: Fallback to Crawling if no sitemap pages found ────────────────
  if (!sitemapSuccess || discoveredPagesMap.size === 0) {
    const homepageUrl = normalizeUrl(parsedUrl.href);
    discoveredPagesMap.set(homepageUrl, { url: homepageUrl });

    try {
      const homeRes = await fetch(homepageUrl, {
        headers: { 'User-Agent': 'PRISM-SEOAudit-Crawler/1.0' },
      });
      if (homeRes.ok) {
        const html = await homeRes.text();
        const title = extractTitle(html);
        if (title) {
          discoveredPagesMap.set(homepageUrl, { url: homepageUrl, title });
        }

        // Extract internal links (1 level deep)
        const internalLinks = extractInternalLinks(html, baseOrigin, homepageUrl);
        for (const link of internalLinks) {
          if (!discoveredPagesMap.has(link)) {
            discoveredPagesMap.set(link, { url: link });
          }
        }
      }
    } catch (err) {
      console.log(`[fetch-website] Homepage crawl failed for ${homepageUrl}:`, err);
    }
  }

  const pages = Array.from(discoveredPagesMap.values());
  const total_pages_found = pages.length;
  const skipped = 0;

  return {
    pages,
    skipped,
  };
}
