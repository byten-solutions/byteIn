import { PrismaClient } from "@prisma/client";
import { requestMetricsStorage } from "./server-timing";

// Safety check: Prevent automated tests from connecting to non-test databases
const isRunningTests =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test") || arg.includes(".test."));

if (isRunningTests) {
  const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || "";
  try {
    const rawUrl = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://") ? dbUrl : `postgresql://${dbUrl}`;
    const parsed = new URL(rawUrl);
    const dbName = parsed.pathname.replace(/^\//, "").split("?")[0];
    if (dbName && !dbName.endsWith("_test")) {
      throw new Error(
        `[SAFETY GUARD] Critical abort: Automated test execution detected targeting non-test database '${dbName}'. Test target database name MUST end in '_test'.`
      );
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("[SAFETY GUARD]")) {
      console.error(err.message);
      process.exit(1);
    }
  }
}

/**
 * Normalizes and guards the datasource connection URL for serverless/production runtimes.
 *
 * If connecting to a Supabase pooler (pooler.supabase.com):
 * 1. Automatically rewrites port 5432 (Session mode) to port 6543 (Transaction mode).
 *    On Vercel and serverless functions, port 5432 session pooler is strictly capped (15 clients)
 *    and unreachable, leading to connection timeouts and EMAXCONNSESSION errors.
 *    Port 6543 is Supabase's transaction pooler built for serverless environments.
 * 2. Automatically appends `pgbouncer=true` if missing (required by Prisma for transaction poolers).
 * 3. Automatically sets `connection_limit=5` if missing to protect client pool bounds.
 */
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  if (url.includes("pooler.supabase.com")) {
    let rewritten = url;

    // Migrate from Session mode (5432) to Transaction mode (6543)
    if (rewritten.includes(":5432")) {
      rewritten = rewritten.replace(":5432", ":6543");
    }

    // Ensure pgbouncer parameter is present for transaction poolers
    if (!rewritten.includes("pgbouncer=true")) {
      const sep = rewritten.includes("?") ? "&" : "?";
      rewritten = `${rewritten}${sep}pgbouncer=true`;
    }

    // Ensure connection limit is capped for serverless functions
    if (!rewritten.includes("connection_limit")) {
      const sep = rewritten.includes("?") ? "&" : "?";
      rewritten = `${rewritten}${sep}connection_limit=5`;
    }

    return rewritten;
  }

  return undefined;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const datasourceUrl = getDatasourceUrl();
  const baseClient = new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return baseClient.$extends({
    query: {
      $allOperations({ args, query }) {
        const delay = parseInt(process.env.SIMULATE_DB_LATENCY_MS || "0", 10);
        const metrics = requestMetricsStorage.getStore();
        const start = performance.now();

        const execute = () => {
          const queryPromise = query(args);
          if (metrics) {
            metrics.queryCount++;
            return queryPromise.then((result) => {
              metrics.dbMs += performance.now() - start;
              return result;
            });
          }
          return queryPromise;
        };

        if (delay > 0) {
          return new Promise((resolve) => setTimeout(resolve, delay)).then(execute);
        }
        return execute();
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Always retain singleton on globalThis across all environments (production chunks, warm containers, dev HMR)
// to ensure Next.js route handlers share a single connection pool and never exceed database pool limits.
globalForPrisma.prisma = prisma;
