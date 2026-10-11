import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { sanitizePagination } from "@/lib/pagination";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilterOptions,
} from "./customer.types";

export class CustomerService {
  static async createCustomer(input: CreateCustomerInput) {
    return prisma.customer.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        nationality: input.nationality?.trim() || null,
        address: input.address?.trim() || null,
        idProofType: input.idProofType?.trim() || null,
        idProofNumber: input.idProofNumber?.trim() || null,
        remarks: input.remarks?.trim() || null,
      },
    });
  }

  static async getCustomers(options: CustomerFilterOptions = {}) {
    const { search } = options;
    const { page, limit, skip } = sanitizePagination(options.page, options.limit, 20);

    const where: Prisma.CustomerWhereInput = {};

    if (search && search.trim() !== "") {
      const q = search.trim();
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
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
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      customers,
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

    return customer;
  }

  static async updateCustomer(id: string, input: UpdateCustomerInput) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Customer not found");
    }

    return prisma.customer.update({
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
          idProofNumber: input.idProofNumber?.trim() || null,
        }),
        ...(input.remarks !== undefined && { remarks: input.remarks?.trim() || null }),
      },
    });
  }
}
