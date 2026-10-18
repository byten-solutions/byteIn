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
      }),
      prisma.customer.count({ where }),
    ]);

    const customerIds = customers.map((c) => c.id);
    const countMap = new Map<string, number>();
    const resMap = new Map<
      string,
      Array<{
        id: string;
        status: string;
        createdAt: Date;
        rooms: Array<{
          arrivalDate: Date;
          departureDate: Date;
          status: string;
        }>;
      }>
    >();

    if (customerIds.length > 0) {
      const [countGroups, resRows] = await Promise.all([
        prisma.reservation.groupBy({
          by: ["customerId"],
          where: { customerId: { in: customerIds } },
          _count: { _all: true },
        }),
        prisma.$queryRaw<
          Array<{
            reservationId: string;
            customerId: string;
            reservationStatus: string;
            reservationCreatedAt: Date;
            roomId: string | null;
            arrivalDate: Date | null;
            departureDate: Date | null;
            roomStatus: string | null;
          }>
        >`
          SELECT
            r.id AS "reservationId",
            r.customer_id AS "customerId",
            r.status::text AS "reservationStatus",
            r.created_at AS "reservationCreatedAt",
            rr.id AS "roomId",
            rr.arrival_date AS "arrivalDate",
            rr.departure_date AS "departureDate",
            rr.status::text AS "roomStatus"
          FROM (
            SELECT id, customer_id, status, created_at,
                   ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) as rn
            FROM reservations
            WHERE customer_id = ANY(${customerIds}::text[])
          ) r
          LEFT JOIN reservation_rooms rr ON rr.reservation_id = r.id
          WHERE r.rn <= 5
          ORDER BY r.customer_id, r.created_at DESC
        `,
      ]);

      for (const g of countGroups) {
        countMap.set(g.customerId, g._count._all);
      }

      for (const row of resRows) {
        if (!resMap.has(row.customerId)) {
          resMap.set(row.customerId, []);
        }
        const custResList = resMap.get(row.customerId)!;
        let resObj = custResList.find((r) => r.id === row.reservationId);
        if (!resObj) {
          resObj = {
            id: row.reservationId,
            status: row.reservationStatus,
            createdAt: row.reservationCreatedAt,
            rooms: [],
          };
          custResList.push(resObj);
        }
        if (row.roomId && row.arrivalDate && row.departureDate && row.roomStatus) {
          resObj.rooms.push({
            arrivalDate: row.arrivalDate,
            departureDate: row.departureDate,
            status: row.roomStatus,
          });
        }
      }
    }

    const enrichedCustomers = customers.map((c) =>
      maskCustomer({
        ...c,
        _count: { reservations: countMap.get(c.id) || 0 },
        reservations: resMap.get(c.id) || [],
      })
    );

    return {
      customers: enrichedCustomers,
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

