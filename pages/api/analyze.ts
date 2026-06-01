import type { NextApiRequest, NextApiResponse } from "next";
import { scrapeSite } from "@/lib/scraper";
import { runHeuristics, FrictionPoint } from "@/lib/heuristics";
import { generateHook, HookResult } from "@/lib/groq";

export interface AnalyzeResponse {
  url: string;
  company_name: string;
  pages_analyzed: string[];
  friction_points: FrictionPoint[];
  hook_text: string;
  citations: string[];
  cached: boolean;
  analysis_time_ms: number;
  error?: string;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyzeResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res
      .status(400)
      .json({ error: "Missing or invalid 'url' in request body." });
  }

  // Basic URL validation
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  try {
    new URL(normalizedUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL format." });
  }

  const startTime = Date.now();

  try {
    // Step 1: Scrape
    console.log(`[analyze] Scraping ${normalizedUrl}...`);
    const scrapeResult = await scrapeSite(normalizedUrl);

    const allCached = scrapeResult.allPages.every((p) => p.fromCache);
    console.log(
      `[analyze] Scraped ${scrapeResult.allPages.length} pages (cached: ${allCached})`
    );

    // Step 2: Heuristics
    console.log(`[analyze] Running heuristics...`);
    const frictionPoints = runHeuristics(scrapeResult);
    console.log(
      `[analyze] Found ${frictionPoints.length} friction points`
    );

    // Step 3: LLM Hook
    console.log(`[analyze] Generating hook via Groq...`);
    const hookResult: HookResult = await generateHook(
      normalizedUrl,
      scrapeResult.companyName,
      frictionPoints
    );
    console.log(`[analyze] Hook generated`);

    const analysisTime = Date.now() - startTime;

    const response: AnalyzeResponse = {
      url: normalizedUrl,
      company_name: scrapeResult.companyName,
      pages_analyzed: scrapeResult.allPages.map((p) => p.url),
      friction_points: frictionPoints,
      hook_text: hookResult.hook_text,
      citations: hookResult.citations,
      cached: allCached,
      analysis_time_ms: analysisTime,
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error(`[analyze] Error:`, err);
    return res.status(500).json({
      error: `Analysis failed: ${err.message}`,
    });
  }
}
