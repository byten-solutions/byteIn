import { PrismaClient } from "@prisma/client";

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

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
