import { createClient, type RedisClientType } from "redis";

// Redis uses `{}` here to mean “no command extensions”, not an arbitrary object.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type RedisClient = RedisClientType<{}, {}, {}, 3, {}>;

const globalForRedis = globalThis as unknown as {
  redis?: RedisClient;
  redisConnection?: Promise<RedisClient | null>;
};

export async function getRedis(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) return null;
  if (globalForRedis.redis?.isReady) return globalForRedis.redis;
  if (globalForRedis.redisConnection) return globalForRedis.redisConnection;

  const connection = (async () => {
    const client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 750,
        reconnectStrategy: false,
      },
    });

    client.on("error", () => {
      // Redis is an optimization and realtime coordinator; database paths remain usable.
    });

    try {
      await client.connect();
      globalForRedis.redis = client;
      return client;
    } catch {
      await client.disconnect().catch(() => undefined);
      return null;
    } finally {
      globalForRedis.redisConnection = undefined;
    }
  })();

  globalForRedis.redisConnection = connection;
  return connection;
}

export async function cacheJson<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = await getRedis();
  if (redis) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  }

  const value = await loader();
  if (redis) {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }
  return value;
}

export async function invalidateCache(...patterns: string[]) {
  const redis = await getRedis();
  if (!redis) return;

  for (const pattern of patterns) {
    let cursor = "0";
    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      if (result.keys.length > 0) await redis.del(result.keys);
    } while (cursor !== "0");
  }
}
