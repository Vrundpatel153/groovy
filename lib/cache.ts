import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), "cache");

interface CachedPage {
  url: string;
  html: string;
  headers: Record<string, string>;
  fetchedAt: string;
  responseTimeMs: number;
  contentLength: number;
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function urlToKey(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function cacheFilePath(url: string): string {
  return path.join(CACHE_DIR, `${urlToKey(url)}.json`);
}

export function getCachedPage(url: string): CachedPage | null {
  ensureCacheDir();
  const fp = cacheFilePath(url);
  if (fs.existsSync(fp)) {
    try {
      const raw = fs.readFileSync(fp, "utf-8");
      return JSON.parse(raw) as CachedPage;
    } catch {
      return null;
    }
  }
  return null;
}

export function setCachedPage(
  url: string,
  html: string,
  headers: Record<string, string>,
  responseTimeMs: number
): CachedPage {
  ensureCacheDir();
  const entry: CachedPage = {
    url,
    html,
    headers,
    fetchedAt: new Date().toISOString(),
    responseTimeMs,
    contentLength: Buffer.byteLength(html, "utf-8"),
  };
  fs.writeFileSync(cacheFilePath(url), JSON.stringify(entry), "utf-8");
  return entry;
}

export function isCached(url: string): boolean {
  ensureCacheDir();
  return fs.existsSync(cacheFilePath(url));
}

export function clearCache(): void {
  ensureCacheDir();
  const files = fs.readdirSync(CACHE_DIR);
  for (const f of files) {
    if (f.endsWith(".json")) {
      fs.unlinkSync(path.join(CACHE_DIR, f));
    }
  }
}

export type { CachedPage };
