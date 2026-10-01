import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/classpulse";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// A Worker isolate serves many requests, but its TCP sockets belong to the
// request that opened them. Never reuse a PrismaPg pool across Worker requests.
const workerClients = new WeakMap<object, PrismaClient>();

function getClient(): PrismaClient {
  let context: ReturnType<typeof getCloudflareContext> | undefined;
  try {
    context = getCloudflareContext();
  } catch {
    // The custom Node server has no Cloudflare request context.
  }

  if (context) {
    let client = workerClients.get(context);
    if (!client) {
      const workerUrl = (context.env as Record<string, unknown>).DATABASE_URL;
      client = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: typeof workerUrl === "string" ? workerUrl : databaseUrl,
          maxUses: 1,
          connectionTimeoutMillis: 5_000,
        }),
      });
      workerClients.set(context, client);
    }
    return client;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }
  return globalForPrisma.prisma;
}

// Keep the existing db.user / db.$transaction API while resolving the client
// from the current request instead of capturing one at module initialization.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
