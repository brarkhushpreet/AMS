import { getRedis } from "@/lib/redis";
import { CONSUME_RATE_LIMIT } from "@/lib/redis-protocol.js";

type MemoryWindow = { count: number; resetAt: number };

const memoryWindows = new Map<string, MemoryWindow>();

export async function consumeRateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const redis = await getRedis();
  if (redis) {
    try {
      const namespaced = `rate-limit:${key}`;
      const [count, ttl] = await redis.eval(CONSUME_RATE_LIMIT, {
        keys: [namespaced], arguments: [String(windowSeconds)],
      }) as [number, number];
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds: Math.max(1, ttl),
      };
    } catch {
      // Configured distributed protection must not silently become per-node.
      return { allowed: false, remaining: 0, retryAfterSeconds: 5 };
    }
  }
  if (process.env.REDIS_URL) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 5 };
  }

  const now = Date.now();
  const current = memoryWindows.get(key);
  const window =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowSeconds * 1_000 }
      : current;
  window.count += 1;
  memoryWindows.set(key, window);

  if (memoryWindows.size > 2_000) {
    for (const [candidate, value] of memoryWindows) {
      if (value.resetAt <= now) memoryWindows.delete(candidate);
    }
  }

  return {
    allowed: window.count <= limit,
    remaining: Math.max(0, limit - window.count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((window.resetAt - now) / 1_000),
    ),
  };
}
