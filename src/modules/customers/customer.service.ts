import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { sanitizePagination } from "@/lib/pagination";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilterOptions,
} from "./customer.types";

/**
 * Normalizes government ID input: stores only the last 4 characters/digits.
 * Strips out bullet characters if previously masked.
 */
export function normalizeIdProofNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/^[•\s*]+/, "").trim();
  if (!cleaned) return null;
  return cleaned.length > 4 ? cleaned.slice(-4) : cleaned;
}

/**
 * Formats an ID proof number with bullet masking ("•••• 1234").
 */
export function maskIdProofNumber(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  const last4 = trimmed.replace(/^[•\s*]+/, "").trim().slice(-4);
  if (!last4) return null;
  return `•••• ${last4}`;
}

export function maskCustomer<T extends { idProofNumber?: string | null }>(customer: T): T {
  return {
    ...customer,
    idProofNumber: maskIdProofNumber(customer.idProofNumber),
  };
}

export class CustomerService {
  static async createCustomer(input: CreateCustomerInput) {
    const created = await prisma.customer.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        nationality: input.nationality?.trim() || null,
        address: input.address?.trim() || null,
        idProofType: input.idProofType?.trim() || null,
        idProofNumber: normalizeIdProofNumber(input.idProofNumber),
        remarks: input.remarks?.trim() || null,
      },
    });
    return maskCustomer(created);
  }

  static async getCustomers(options: CustomerFilterOptions = {}) {
    const { search } = options;
    const { page, limit, skip } = sanitizePagination(options.page, options.limit, 20);

    const where: Prisma.CustomerWhereInput = {};

    if (search && search.trim() !== "") {
      const q = search.trim();
      const last4 = q.replace(/^[•\s*]+/, "").trim().slice(-4);
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(last4.length > 0
          ? [{ idProofNumber: { contains: last4, mode: "insensitive" as const } }]
          : []),
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: { reservations: true },
          },
          reservations: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              rooms: {
                select: {
                  arrivalDate: true,
                  departureDate: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      customers: customers.map((c) => maskCustomer(c)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        reservations: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            rooms: {
              include: {
                room: true,
                roomCategory: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    return maskCustomer(customer);
  }

  static async updateCustomer(id: string, input: UpdateCustomerInput) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Customer not found");
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName.trim() }),
        ...(input.lastName !== undefined && { lastName: input.lastName?.trim() || null }),
        ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
        ...(input.email !== undefined && { email: input.email?.trim() || null }),
        ...(input.nationality !== undefined && {
          nationality: input.nationality?.trim() || null,
        }),
        ...(input.address !== undefined && { address: input.address?.trim() || null }),
        ...(input.idProofType !== undefined && {
          idProofType: input.idProofType?.trim() || null,
        }),
        ...(input.idProofNumber !== undefined && {
          idProofNumber: normalizeIdProofNumber(input.idProofNumber),
        }),
        ...(input.remarks !== undefined && { remarks: input.remarks?.trim() || null }),
      },
    });

    return maskCustomer(updated);
  }

  /**
   * Migrates existing customer records in PostgreSQL to only retain the last 4 characters of ID proof.
   */
  static async migrateExistingCustomerIds(): Promise<number> {
    const customersWithId = await prisma.customer.findMany({
      where: {
        idProofNumber: { not: null },
      },
      select: { id: true, idProofNumber: true },
    });

    let migratedCount = 0;
    for (const c of customersWithId) {
      if (c.idProofNumber && c.idProofNumber.length > 4) {
        const last4 = c.idProofNumber.slice(-4);
        await prisma.customer.update({
          where: { id: c.id },
          data: { idProofNumber: last4 },
        });
        migratedCount++;
      }
    }
    return migratedCount;
  }
}

