#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";

const SEEDED_EMAILS = [
  "superadmin@byteinn.local",
  "admin@byteinn.local",
  "reception@byteinn.local",
];

interface RotateOptions {
  email?: string;
  allSeeded?: boolean;
  disable?: boolean;
}

export function parseArgs(args: string[]): RotateOptions {
  const options: RotateOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--all-seeded") {
      options.allSeeded = true;
    } else if (arg === "--email" && i + 1 < args.length) {
      options.email = args[++i].trim().toLowerCase();
    } else if (arg === "--disable") {
      options.disable = true;
    }
  }
  return options;
}

export async function rotatePasswords(
  prisma: PrismaClient,
  options: RotateOptions,
  newPassword?: string
) {
  if (!options.allSeeded && !options.email) {
    throw new Error("Must specify either --email <address> or --all-seeded");
  }

  const targetEmails = options.allSeeded
    ? SEEDED_EMAILS
    : [options.email!];

  if (options.disable) {
    const result = await prisma.user.updateMany({
      where: { email: { in: targetEmails } },
      data: {
        status: "DISABLED",
        tokenVersion: { increment: 1 },
      },
    });

    return {
      action: "DISABLED",
      affectedEmails: targetEmails,
      count: result.count,
    };
  }

  // Validate password strength
  if (!newPassword || newPassword.trim().length < 12) {
    throw new Error("Password must be at least 12 characters long and non-empty");
  }

  const passwordHash = await AuthService.hashPassword(newPassword.trim());

  const result = await prisma.user.updateMany({
    where: { email: { in: targetEmails } },
    data: {
      passwordHash,
      mustChangePassword: true,
      tokenVersion: { increment: 1 },
    },
  });

  return {
    action: "ROTATED",
    affectedEmails: targetEmails,
    count: result.count,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const newPassword = process.env.NEW_PASSWORD;
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("Error: DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    const result = await rotatePasswords(prisma, options, newPassword);
    console.log(`Successfully ${result.action} account(s):`);
    for (const email of result.affectedEmails) {
      console.log(` - ${email}`);
    }
    console.log(`Total rows affected: ${result.count}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("rotate-seeded-passwords.ts")) {
  main();
}
