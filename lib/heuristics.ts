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
  // Script sources / ids
  "intercom",
  "drift",
  "zendesk",
  "zopim",
  "crisp",
  "livechat",
  "tidio",
  "tawk",
  "hubspot",
  "freshchat",
  "olark",
  "chatwoot",
  "gorgias",
  "smartsupp",
  "liveperson",
  "comm100",
  "chatbot",
  "live-chat",
  "chat-widget",
  "messenger-widget",
  // Common class/id patterns
  "chat-bubble",
  "chat-launcher",
  "chat-container",
];

function detectChatWidget(html: string): boolean {
  const lower = html.toLowerCase();
  return CHAT_SIGNATURES.some((sig) => lower.includes(sig));
}

// ─── Booking Widget Detection ───────────────────────────────────────────────
const BOOKING_SIGNATURES = [
  "calendly",
  "cal.com",
  "acuity",
  "hubspot.com/meetings",
  "chilipiper",
  "savvycal",
  "youcanbook",
  "oncehub",
  "schedule a demo",
  "schedule a call",
  "book a demo",
  "book a call",
  "book a meeting",
  "schedule demo",
  "schedule call",
  "book demo",
  "book call",
  "request a demo",
  "get a demo",
  "free consultation",
  "schedule consultation",
];

function detectBookingWidget(html: string): boolean {
  const lower = html.toLowerCase();
  return BOOKING_SIGNATURES.some((sig) => lower.includes(sig));
}

// ─── Blog Freshness ────────────────────────────────────────────────────────
function checkBlogFreshness(
  pages: ScrapedPage[]
): { stale: boolean; newestDate: string | null; pageUrl: string | null } {
  const blogPage = pages.find((p) =>
    p.url.toLowerCase().includes("/blog")
  );

  if (!blogPage) {
    return { stale: false, newestDate: null, pageUrl: null };
  }

  const $ = cheerio.load(blogPage.html);
  const dates: Date[] = [];

  // Look for <time> elements
  $("time[datetime]").each((_, el) => {
    const dt = $(el).attr("datetime");
    if (dt) {
      const d = new Date(dt);
      if (!isNaN(d.getTime())) dates.push(d);
    }
  });

  // Look for common date patterns in text
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/g, // 2024-01-15
    /(\w+ \d{1,2},? \d{4})/g, // January 15, 2024 or Jan 15 2024
    /(\d{1,2}\/\d{1,2}\/\d{4})/g, // 01/15/2024
  ];

  const textContent = $.text();
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(textContent)) !== null) {
      const d = new Date(match[1]);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2015) {
        dates.push(d);
      }
    }
  }

  if (dates.length === 0) {
    return { stale: false, newestDate: null, pageUrl: blogPage.url };
  }

  const newest = new Date(Math.max(...dates.map((d) => d.getTime())));
  const daysSince = Math.floor(
    (Date.now() - newest.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    stale: daysSince > 90,
    newestDate: newest.toISOString().split("T")[0],
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
  "get started",
  "try free",
  "try for free",
  "start free",
  "free trial",
  "sign up",
  "signup",
  "register",
  "buy now",
  "purchase",
  "subscribe",
  "join",
  "contact us",
  "contact sales",
  "request demo",
  "request a demo",
  "book a demo",
  "schedule",
  "learn more",
  "see demo",
  "watch demo",
  "explore",
  "download",
  "get quote",
  "get a quote",
  "start now",
  "begin",
  "create account",
  "talk to sales",
  "talk to us",
  "let's talk",
  "get in touch",
];

function countCTAs(html: string): number {
  const $ = cheerio.load(html);
  let ctaCount = 0;

  // Check buttons and links
  $("a, button").each((_, el) => {
    const text = $(el).text().toLowerCase().trim();
    const href = $(el).attr("href") || "";

    if (CTA_KEYWORDS.some((kw) => text.includes(kw))) {
      ctaCount++;
    }
    // Also check for common CTA link patterns
    if (
      href.includes("/signup") ||
      href.includes("/register") ||
      href.includes("/trial") ||
      href.includes("/demo") ||
      href.includes("/contact") ||
      href.includes("/pricing")
    ) {
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
  const blogCheck = checkBlogFreshness(allPages);
  if (blogCheck.stale) {
    frictions.push({
      id: "stale_blog",
      label: "Stale Blog Content",
      severity: "medium",
      detail: `Blog appears stale — most recent post dated ${blogCheck.newestDate}. This signals low content investment and may hurt SEO and trust.`,
      citation: blogCheck.pageUrl || "blog page",
    });
  } else if (blogCheck.pageUrl && !blogCheck.newestDate) {
    // Blog page exists but no dates found — might still be stale
    frictions.push({
      id: "stale_blog",
      label: "Blog Freshness Unknown",
      severity: "low",
      detail:
        "Blog page found but no article dates detected. Content freshness could not be verified.",
      citation: blogCheck.pageUrl,
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
      detail: `Only ${homepageCTAs} CTA(s) detected on homepage. B2B sites typically need multiple clear CTAs (demo, trial, contact) to convert visitors.`,
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
