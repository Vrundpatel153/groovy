import axios from "axios";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { getCachedPage, setCachedPage, CachedPage } from "./cache";

export interface ScrapedPage {
  url: string;
  html: string;
  responseTimeMs: number;
  contentLength: number;
  fromCache: boolean;
}

export interface ScrapeResult {
  inputUrl: string;
  finalUrl: string;
  companyName: string;
  homepage: ScrapedPage;
  pages: ScrapedPage[];
  allPages: ScrapedPage[];
  robotsTxt: string | null;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; FrictionSniffer/1.0; +https://github.com/friction-sniffer)";

const FETCH_TIMEOUT = 15000; // 15s

// Priority paths to look for internal pages
const PRIORITY_PATHS = [
  "/pricing",
  "/about",
  "/about-us",
  "/blog",
  "/contact",
  "/contact-us",
  "/products",
  "/product",
  "/services",
  "/features",
  "/solutions",
  "/demo",
  "/resources",
  "/team",
  "/careers",
  "/faq",
  "/support",
];

async function fetchPage(url: string): Promise<ScrapedPage> {
  // Check cache first
  const cached = getCachedPage(url);
  if (cached) {
    return {
      url: cached.url,
      html: cached.html,
      responseTimeMs: cached.responseTimeMs,
      contentLength: cached.contentLength,
      fromCache: true,
    };
  }

  const start = Date.now();
  try {
    const resp = await axios.get(url, {
      timeout: FETCH_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      maxRedirects: 5,
      // Accept any status to avoid throwing on 4xx/5xx
      validateStatus: (status) => status < 500,
    });
    const elapsed = Date.now() - start;
    const html = typeof resp.data === "string" ? resp.data : String(resp.data);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(resp.headers)) {
      if (typeof v === "string") headers[k] = v;
    }

    // Cache it
    setCachedPage(url, html, headers, elapsed);

    return {
      url,
      html,
      responseTimeMs: elapsed,
      contentLength: Buffer.byteLength(html, "utf-8"),
      fromCache: false,
    };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    // Return a minimal page on error so analysis can continue
    const errorHtml = `<!-- FETCH_ERROR: ${err.message} -->`;
    return {
      url,
      html: errorHtml,
      responseTimeMs: elapsed,
      contentLength: 0,
      fromCache: false,
    };
  }
}

async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const resp = await axios.get(robotsUrl, {
      timeout: 5000,
      headers: { "User-Agent": USER_AGENT },
      validateStatus: (s) => s < 500,
    });
    if (resp.status === 200 && typeof resp.data === "string") {
      return resp.data;
    }
  } catch {
    // robots.txt not available
  }
  return null;
}

function isAllowed(
  robotsTxtContent: string | null,
  url: string,
  baseUrl: string
): boolean {
  if (!robotsTxtContent) return true;
  try {
    const robots = robotsParser(new URL("/robots.txt", baseUrl).href, robotsTxtContent);
    return robots.isAllowed(url, USER_AGENT) !== false;
  } catch {
    return true;
  }
}

function extractInternalLinks(
  html: string,
  baseUrl: string
): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const resolved = new URL(href, baseUrl);
      // Same host only
      if (resolved.hostname !== base.hostname) return;
      // Skip anchors, mailto, tel, javascript
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;
      // Skip asset files
      const ext = resolved.pathname.split(".").pop()?.toLowerCase();
      if (
        ext &&
        [
          "pdf", "jpg", "jpeg", "png", "gif", "svg", "css", "js",
          "zip", "mp4", "mp3", "webp", "ico", "woff", "woff2", "ttf",
        ].includes(ext)
      )
        return;

      // Normalize: strip hash, keep path
      resolved.hash = "";
      const clean = resolved.href.replace(/\/$/, "");
      if (clean !== baseUrl.replace(/\/$/, "")) {
        links.add(clean);
      }
    } catch {
      // Invalid URL, skip
    }
  });

  return Array.from(links);
}

function pickBestPages(
  internalLinks: string[],
  baseUrl: string,
  count: number
): string[] {
  const base = new URL(baseUrl);
  const scored: { url: string; score: number }[] = [];

  for (const link of internalLinks) {
    try {
      const u = new URL(link);
      const pathLower = u.pathname.toLowerCase();
      // Check priority paths
      let score = 0;
      for (let i = 0; i < PRIORITY_PATHS.length; i++) {
        if (pathLower.startsWith(PRIORITY_PATHS[i])) {
          score = PRIORITY_PATHS.length - i; // Higher priority = higher score
          break;
        }
      }
      // Prefer shorter paths (closer to root)
      score += Math.max(0, 5 - pathLower.split("/").filter(Boolean).length);
      scored.push({ url: link, score });
    } catch {
      continue;
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by path
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of scored) {
    const path = new URL(item.url).pathname.toLowerCase().replace(/\/$/, "");
    if (!seen.has(path)) {
      seen.add(path);
      result.push(item.url);
      if (result.length >= count) break;
    }
  }

  return result;
}

function extractCompanyName(html: string, url: string): string {
  const $ = cheerio.load(html);

  // Try <title> tag
  const title = $("title").first().text().trim();
  if (title) {
    // Often "Company Name | Tagline" or "Company Name - Tagline"
    const parts = title.split(/[|\-–—:]/);
    const name = parts[0].trim();
    if (name && name.length < 60) return name;
  }

  // Try og:site_name
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName) return ogSiteName.trim();

  // Fallback: domain name
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch {
    return "Unknown Company";
  }
}

export async function scrapeSite(inputUrl: string): Promise<ScrapeResult> {
  // Normalize URL
  let normalizedUrl = inputUrl.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  // Fetch robots.txt
  const robotsTxt = await fetchRobotsTxt(normalizedUrl);

  // Fetch homepage
  const homepage = await fetchPage(normalizedUrl);
  const finalUrl = normalizedUrl;

  // Extract company name
  const companyName = extractCompanyName(homepage.html, finalUrl);

  // Discover internal links
  const internalLinks = extractInternalLinks(homepage.html, finalUrl);

  // Filter by robots.txt
  const allowedLinks = internalLinks.filter((link) =>
    isAllowed(robotsTxt, link, finalUrl)
  );

  // Pick best 3 pages
  const selectedUrls = pickBestPages(allowedLinks, finalUrl, 3);

  // Fetch selected pages
  const pages: ScrapedPage[] = [];
  for (const pageUrl of selectedUrls) {
    const page = await fetchPage(pageUrl);
    pages.push(page);
  }

  return {
    inputUrl,
    finalUrl,
    companyName,
    homepage,
    pages,
    allPages: [homepage, ...pages],
    robotsTxt,
  };
}
