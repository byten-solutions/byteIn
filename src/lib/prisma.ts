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
 * Computes the datasource URL with protective connection limit bounds
 * if connecting to a Supabase pooler without an explicit connection_limit.
 * Supabase session pooler (port 5432) has a strict pool_size of 15;
 * capping the client pool to 5 prevents EMAXCONNSESSION crashes.
 */
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  if (url.includes("pooler.supabase.com") && !url.includes("connection_limit")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}connection_limit=5`;
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
