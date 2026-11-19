import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { IncomeHeadService } from "@/modules/income/income-head.service";
import { updateIncomeHeadSchema } from "@/modules/income/income.validation";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;

    const requestedPropertyId = req.nextUrl.searchParams.get("propertyId");
    const propertyId = resolveScope(session, requestedPropertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const existing = await prisma.incomeHead.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (!existing) {
      throw new NotFoundError("Income category not found");
    }
    if (existing.propertyId !== propertyId) {
      if (session.role === RoleName.SUPER_ADMIN) {
        throw new BadRequestError(
          "The specified income category does not belong to the selected property."
        );
      }
      throw new NotFoundError("Income category not found");
    }

    const incomeHead = await IncomeHeadService.getIncomeHeadById(propertyId, id);

    return NextResponse.json({ success: true, incomeHead });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;
    const body = await req.json();
    const validated = updateIncomeHeadSchema.parse(body);

    const requestedPropertyId = req.nextUrl.searchParams.get("propertyId");
    const propertyId = resolveScope(session, requestedPropertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const existing = await prisma.incomeHead.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (!existing) {
      throw new NotFoundError("Income category not found");
    }
    if (existing.propertyId !== propertyId) {
      if (session.role === RoleName.SUPER_ADMIN) {
        throw new BadRequestError(
          "The specified income category does not belong to the selected property."
        );
      }
      throw new NotFoundError("Income category not found");
    }

    const incomeHead = await IncomeHeadService.updateIncomeHead(
      propertyId,
      id,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, incomeHead });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;

    const requestedPropertyId = req.nextUrl.searchParams.get("propertyId");
    const propertyId = resolveScope(session, requestedPropertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const existing = await prisma.incomeHead.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (!existing) {
      throw new NotFoundError("Income category not found");
    }
    if (existing.propertyId !== propertyId) {
      if (session.role === RoleName.SUPER_ADMIN) {
        throw new BadRequestError(
          "The specified income category does not belong to the selected property."
        );
      }
      throw new NotFoundError("Income category not found");
    }

    const result = await IncomeHeadService.deleteOrDeactivateIncomeHead(
      propertyId,
      id,
      session.sub
    );

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    return handleApiError(error);
  }
}
