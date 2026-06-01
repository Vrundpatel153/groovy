import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

export async function getCached(
  url: string
): Promise<{ html: string; meta: Record<string, any> } | null> {
  try {
    const hash = hashUrl(url);
    const data = await redis.get<{ html: string; meta: Record<string, any> }>(
      `fc:${hash}`
    );
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCache(
  url: string,
  html: string,
  meta: Record<string, any>
): Promise<void> {
  try {
    const hash = hashUrl(url);
    // Truncate HTML to 800KB max to stay within Upstash free tier limits
    const safeHtml = html.length > 800000 ? html.slice(0, 800000) : html;
    await redis.set(
      `fc:${hash}`,
      JSON.stringify({ html: safeHtml, meta }),
      { ex: 60 * 60 * 24 * 7 } // 7-day TTL
    );
  } catch {
    // Cache write failure is non-fatal — continue without caching
  }
}
