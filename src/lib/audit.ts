import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const SENSITIVE_KEYS = new Set([
  "idproofnumber",
  "id_proof_number",
  "verifiedidnumber",
  "verified_id_number",
  "idnumber",
  "id_number",
  "governmentid",
  "government_id",
  "password",
  "passwordhash",
  "password_hash",
]);

/**
 * Strips government ID numbers and credential keys recursively from JSON data.
 */
export function sanitizeAuditData<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      // Strip ID number / sensitive credential field entirely from new logs
      continue;
    }
    if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}

export interface CreateAuditLogInput {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldData?: unknown;
  newData?: unknown;
}

/**
 * Creates an audit log entry with sensitive fields (such as government IDs and passwords) stripped.
 */
export async function createSafeAuditLog(
  db: Prisma.TransactionClient | typeof prisma,
  input: CreateAuditLogInput
) {
  const sanitizedOld = input.oldData !== undefined ? sanitizeAuditData(input.oldData) : undefined;
  const sanitizedNew = input.newData !== undefined ? sanitizeAuditData(input.newData) : undefined;

  return db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      oldData: (sanitizedOld as Prisma.InputJsonValue) ?? undefined,
      newData: (sanitizedNew as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

/**
 * Scans existing audit_logs and redacts any recorded government ID numbers or passwords.
 */
export async function redactExistingAuditLogs(
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const logs = await db.auditLog.findMany({
    select: { id: true, oldData: true, newData: true },
  });

  let redactedCount = 0;
  for (const log of logs) {
    const hasOld = log.oldData !== null && log.oldData !== undefined;
    const hasNew = log.newData !== null && log.newData !== undefined;

    const cleanedOld = hasOld ? sanitizeAuditData(log.oldData) : null;
    const cleanedNew = hasNew ? sanitizeAuditData(log.newData) : null;

    const oldChanged = hasOld && JSON.stringify(cleanedOld) !== JSON.stringify(log.oldData);
    const newChanged = hasNew && JSON.stringify(cleanedNew) !== JSON.stringify(log.newData);

    if (oldChanged || newChanged) {
      await db.auditLog.update({
        where: { id: log.id },
        data: {
          ...(oldChanged ? { oldData: cleanedOld as Prisma.InputJsonValue } : {}),
          ...(newChanged ? { newData: cleanedNew as Prisma.InputJsonValue } : {}),
        },
      });
      redactedCount++;
    }
  }

  return redactedCount;
}
