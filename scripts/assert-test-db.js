#!/usr/bin/env node

/**
 * Safety guard: Aborts automated test execution if target database does not end in '_test'.
 * Protects dev, demo, and production databases from test fixture mutation or cleanup.
 */
const dbUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://apple@localhost:5432/byteinn_test?schema=public";

let dbName = "";
try {
  const parsed = new URL(dbUrl);
  dbName = parsed.pathname.replace(/^\//, "");
} catch (_err) {
  console.error("\x1b[31m[SAFETY ABORT] Invalid database URL for tests:\x1b[0m", dbUrl);
  process.exit(1);
}

if (!dbName.endsWith("_test")) {
  console.error(
    `\x1b[31m[SAFETY ABORT] Refusing to run tests against database '${dbName}'. Test target database name MUST end in '_test' to prevent data loss in dev/demo/prod environments.\x1b[0m`
  );
  process.exit(1);
}

console.warn(`\x1b[32m[TEST DB GUARD] Verified safe test database: '${dbName}'\x1b[0m`);
