import * as cheerio from "cheerio";
import { ScrapedPage, ScrapeResult } from "./scraper";

export interface FrictionPoint {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  detail: string;
  citation: string; // which page it was found on
}

// ─── Chat Widget Detection ──────────────────────────────────────────────────
const CHAT_SIGNATURES = [
  'intercom','drift','crisp','tawk.to','tawkto','zendesk','freshchat',
  'livechat','tidio','olark','userlike','chaport','hubspot-messages',
  'hubspotmeetings','fb-customerchat','messenger','chat-widget',
  'liveagent','smartsupp','jivochat',
];

function detectChatWidget(html: string): boolean {
  const lower = html.toLowerCase();
  return CHAT_SIGNATURES.some((sig) => lower.includes(sig));
}

// ─── Booking Widget Detection ───────────────────────────────────────────────
const BOOKING_SIGNATURES = [
  'calendly','chilipiper','savvycal','cal.com','book a demo','schedule a demo',
  'schedule a call','book a call','request a demo','get a demo',
  'talk to sales','talk to us','book time','acuityscheduling','oncehub',
  'hubspot meetings','demobooked','chili piper',
];

function detectBookingWidget(html: string): boolean {
  const lower = html.toLowerCase();
  return BOOKING_SIGNATURES.some((sig) => lower.includes(sig));
}

// ─── Blog Freshness ────────────────────────────────────────────────────────
const BLOG_PATH_PATTERNS = ['/blog', '/news', '/updates', '/insights', '/resources', '/articles'];

function checkBlogFreshness(
  pages: ScrapedPage[],
  homepageUrl: string
): { stale: boolean; noBlog: boolean; newestDate: Date | null; pageUrl: string | null } {
  const blogPage = pages.find((p) => {
    const urlLower = p.url.toLowerCase();
    return BLOG_PATH_PATTERNS.some((pat) => urlLower.includes(pat));
  });

  if (!blogPage) {
    return { stale: false, noBlog: true, newestDate: null, pageUrl: null };
  }

  const $ = cheerio.load(blogPage.html);
  const textContent = $.text();
  const dates: Date[] = [];

  // Pattern 1: "January 15, 2024" or "Jan 15 2024"
  const monthPattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}/gi;
  let match;
  while ((match = monthPattern.exec(textContent)) !== null) {
    const d = new Date(match[0]);
    if (!isNaN(d.getTime())) dates.push(d);
  }

  // Pattern 2: "2024-01-15" or "2024/01/15"
  const isoPattern = /\b20\d{2}[-\/]\d{2}[-\/]\d{2}\b/g;
  while ((match = isoPattern.exec(textContent)) !== null) {
    const d = new Date(match[0]);
    if (!isNaN(d.getTime())) dates.push(d);
  }

  // Filter valid dates and sort descending
  const validDates = dates.filter((d) => !isNaN(d.getTime()));
  if (validDates.length === 0) {
    return { stale: false, noBlog: false, newestDate: null, pageUrl: blogPage.url };
  }

  validDates.sort((a, b) => b.getTime() - a.getTime());
  const mostRecent = validDates[0];
  const daysSince = Math.floor(
    (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    stale: daysSince > 90,
    noBlog: false,
    newestDate: mostRecent,
    pageUrl: blogPage.url,
  };
}

// ─── Page Speed / Weight ────────────────────────────────────────────────────
function checkPageWeight(page: ScrapedPage): {
  slow: boolean;
  heavy: boolean;
  responseTimeMs: number;
  sizeKB: number;
} {
  const sizeKB = Math.round(page.contentLength / 1024);
  return {
    slow: page.responseTimeMs > 2000,
    heavy: sizeKB > 3000, // 3MB
    responseTimeMs: page.responseTimeMs,
    sizeKB,
  };
}

// ─── CTA Analysis ───────────────────────────────────────────────────────────
const CTA_KEYWORDS = [
  'demo','trial','get started','start free','free trial','sign up',
  'try free','try it','book','contact','request','schedule','buy',
  'purchase','get access','join','start today',
];

function countCTAs(html: string): number {
  const $ = cheerio.load(html);
  let ctaCount = 0;

  $("a, button").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (CTA_KEYWORDS.some((kw) => text.includes(kw))) {
      ctaCount++;
    }
  });

  return ctaCount;
}

// ─── Mobile Viewport ────────────────────────────────────────────────────────
function hasMobileViewport(html: string): boolean {
  const $ = cheerio.load(html);
  const viewport = $('meta[name="viewport"]').attr("content");
  return !!viewport;
}

// ─── A11y Hints ─────────────────────────────────────────────────────────────
interface A11yIssues {
  missingAltText: { total: number; missing: number };
  missingLangAttr: boolean;
  noSkipNav: boolean;
  noAriaLandmarks: boolean;
}

function checkA11y(html: string): A11yIssues {
  const $ = cheerio.load(html);

  // Images without alt
  const allImages = $("img").length;
  const missingAlt = $("img:not([alt]), img[alt='']").length;

  // Lang attribute
  const langAttr = $("html").attr("lang");
  const missingLang = !langAttr || langAttr.trim() === "";

  // Skip navigation
  const skipNav =
    $('a[href="#main"], a[href="#content"], a[href="#maincontent"], .skip-nav, .skip-link, [class*="skip"]').length > 0;

  // ARIA landmarks
  const ariaLandmarks =
    $('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').length;

  return {
    missingAltText: { total: allImages, missing: missingAlt },
    missingLangAttr: missingLang,
    noSkipNav: !skipNav,
    noAriaLandmarks: ariaLandmarks < 2,
  };
}

// ─── SSL Check ──────────────────────────────────────────────────────────────
function checkSSL(url: string): boolean {
  return url.startsWith("https://");
}

// ─── Main Heuristics Runner ─────────────────────────────────────────────────
export function runHeuristics(scrapeResult: ScrapeResult): FrictionPoint[] {
  const frictions: FrictionPoint[] = [];
  const { homepage, allPages, finalUrl } = scrapeResult;

  // 1. Chat Widget — check ALL pages
  const anyChat = allPages.some((p) => detectChatWidget(p.html));
  if (!anyChat) {
    frictions.push({
      id: "no_chat_widget",
      label: "No Live Chat Widget",
      severity: "medium",
      detail:
        "No live chat or chatbot widget detected on any analyzed page. Visitors cannot get instant answers, which often increases bounce rate for B2B sites.",
      citation: "all pages analyzed",
    });
  }

  // 2. Booking Widget — check ALL pages
  const anyBooking = allPages.some((p) => detectBookingWidget(p.html));
  if (!anyBooking) {
    frictions.push({
      id: "no_booking_widget",
      label: "No Booking / Demo Scheduling",
      severity: "high",
      detail:
        "No booking or demo scheduling integration found (Calendly, Cal.com, etc.). Prospects cannot self-schedule, adding friction to the sales funnel.",
      citation: "all pages analyzed",
    });
  }

  // 3. Blog Freshness
  const blogCheck = checkBlogFreshness(allPages, homepage.url);
  if (blogCheck.noBlog) {
    frictions.push({
      id: "stale_blog",
      label: "No Blog Found",
      severity: "medium",
      detail: "No blog page was scraped - blog may not exist or be linked",
      citation: homepage.url,
    });
  } else if (blogCheck.stale && blogCheck.newestDate) {
    frictions.push({
      id: "stale_blog",
      label: "Stale Blog Content",
      severity: "medium",
      detail: `Most recent blog post: ${blogCheck.newestDate.toDateString()}`,
      citation: blogCheck.pageUrl || "blog page",
    });
  }

  // 4. Page Speed / Weight — check homepage
  const speedCheck = checkPageWeight(homepage);
  if (speedCheck.slow) {
    frictions.push({
      id: "slow_page",
      label: "Slow Page Response",
      severity: "high",
      detail: `Homepage server response time is ${speedCheck.responseTimeMs}ms (threshold: 2000ms). Slow pages increase bounce rate significantly.`,
      citation: homepage.url,
    });
  }
  if (speedCheck.heavy) {
    frictions.push({
      id: "heavy_page",
      label: "Heavy Page Weight",
      severity: "medium",
      detail: `Homepage weighs ${speedCheck.sizeKB}KB (threshold: 3000KB). Large pages load slowly on mobile and hurt user experience.`,
      citation: homepage.url,
    });
  }

  // 5. CTA Count — check homepage
  const homepageCTAs = countCTAs(homepage.html);
  if (homepageCTAs < 2) {
    frictions.push({
      id: "weak_cta",
      label: "Weak Call-to-Action",
      severity: "high",
      detail: `Only ${homepageCTAs} CTA(s) found on homepage`,
      citation: homepage.url,
    });
  }

  // 6. Mobile Viewport
  if (!hasMobileViewport(homepage.html)) {
    frictions.push({
      id: "no_mobile_viewport",
      label: "Missing Mobile Viewport",
      severity: "medium",
      detail:
        "No mobile viewport meta tag found. The site may not render properly on mobile devices, losing a significant portion of traffic.",
      citation: homepage.url,
    });
  }

  // 7. A11y Issues — check homepage
  const a11y = checkA11y(homepage.html);
  const a11yIssues: string[] = [];

  if (
    a11y.missingAltText.total > 0 &&
    a11y.missingAltText.missing / a11y.missingAltText.total > 0.5
  ) {
    a11yIssues.push(
      `${a11y.missingAltText.missing}/${a11y.missingAltText.total} images missing alt text`
    );
  }
  if (a11y.missingLangAttr) {
    a11yIssues.push("missing lang attribute on <html>");
  }
  if (a11y.noSkipNav) {
    a11yIssues.push("no skip-navigation link");
  }
  if (a11y.noAriaLandmarks) {
    a11yIssues.push("insufficient ARIA landmarks / semantic HTML");
  }

  if (a11yIssues.length >= 2) {
    frictions.push({
      id: "poor_a11y",
      label: "Accessibility Concerns",
      severity: "low",
      detail: `Multiple accessibility issues detected: ${a11yIssues.join("; ")}. This can limit audience reach and create compliance risks.`,
      citation: homepage.url,
    });
  }

  // 8. SSL Check
  if (!checkSSL(finalUrl)) {
    frictions.push({
      id: "no_ssl",
      label: "No HTTPS",
      severity: "high",
      detail:
        "Site is not served over HTTPS. This hurts trust, SEO, and triggers browser security warnings.",
      citation: finalUrl,
    });
  }

  return frictions;
}
