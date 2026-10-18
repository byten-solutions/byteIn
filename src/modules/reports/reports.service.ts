import {
  Prisma,
  ReservationStatus,
  AllocationStatus,
  InvoiceStatus,
  PaymentStatus,
  InvoiceItemType,
  RoomStatus,
} from "@prisma/client"
import { scopedCached, invalidateScoped } from "@/lib/scoped-cache"
import { prisma } from "@/lib/prisma"
import type {
  ReportFilterDTO,
  OccupancyReportDTO,
  DailyOccupancyDTO,
  CategoryPerformanceDTO,
  RevenueReportDTO,
  PaymentMethodBreakdownDTO,
  ChargeTypeBreakdownDTO,
  DailyRevenueDTO,
  ReservationStatusReportDTO,
  ReservationStatusCountDTO,
  DailyOperationsReportDTO,
  DailyOperationItemDTO,
  AvailabilityGridDTO,
  AvailabilityGridRoomDTO,
  AvailabilityGridSlotDTO,
  ShiftCollectionsReportDTO,
  PaymentTransactionDTO,
  StaffCollectionBreakdownDTO,
  ReceivablesReportDTO,
  ReceivableItemDTO,
  DiscountsReportDTO,
  InvoiceDiscountItemDTO,
  RateOverrideItemDTO,
} from "./reports.types"
import { getHotelTodayDate, getHotelTodayDateUtc } from "@/lib/date"
import { EXCLUDE_PAST_CONFIRMED_FROM_OCCUPANCY, FUTURE_OCCUPANCY_POLICY } from "@/config/reports"

export class ReportsService {
  /**
   * Generates a date-range historical occupancy report based on physical room inventory
   * and half-open active room allocation intervals [arrivalDate, departureDate).
   * Calculates ADR, RevPAR, and Category-level breakdowns.
   * Formula:
   *   Occupancy Rate = (Occupied Room Nights / Available Room Nights) * 100
   *   ADR = Room Revenue / Occupied Room Nights
   *   RevPAR = Room Revenue / Available Room Nights
   */
  static async getOccupancyReport(filters: ReportFilterDTO): Promise<OccupancyReportDTO> {
    const { startDate, endDate, propertyId } = filters

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T00:00:00.000Z`)

    // 1. Get physical rooms in inventory with their category
    const roomWhere: Prisma.RoomWhereInput = {}
    if (propertyId) {
      roomWhere.propertyId = propertyId
    }
    const rooms = await prisma.room.findMany({
      where: roomWhere,
      include: {
        category: true,
      },
    })
    const totalRooms = rooms.length

    // 2. Fetch all allocations that overlap with the date range [startObj, endObj + 1 day)
    const nextDayAfterEnd = new Date(endObj.getTime() + 24 * 60 * 60 * 1000)

    const allocations = await prisma.reservationRoom.findMany({
      where: {
        status: {
          in: [
            AllocationStatus.CONFIRMED,
            AllocationStatus.CHECKED_IN,
            AllocationStatus.CHECKED_OUT,
          ],
        },
        arrivalDate: { lt: nextDayAfterEnd },
        departureDate: { gt: startObj },
        ...(propertyId
          ? {
              room: { propertyId },
            }
          : {}),
      },
      include: {
        room: {
          include: { category: true },
        },
        roomCategory: true,
      },
    })

    // 3. Compute calendar days in range
    const totalDays =
      Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const totalAvailableRoomNights = totalRooms * totalDays

    const todayUtc = getHotelTodayDateUtc().getTime()

    // 4. Daily breakdown map
    const dailyMap = new Map<
      string,
      {
        occupiedRooms: Set<string>
        otbRooms: Set<string>
        roomRevenue: Prisma.Decimal
        otbRevenue: Prisma.Decimal
      }
    >()

    // Initialize map for all dates in interval
    for (let i = 0; i < totalDays; i++) {
      const curDate = new Date(startObj.getTime() + i * 24 * 60 * 60 * 1000)
      const dateKey = curDate.toISOString().split("T")[0]!
      dailyMap.set(dateKey, {
        occupiedRooms: new Set<string>(),
        otbRooms: new Set<string>(),
        roomRevenue: new Prisma.Decimal(0),
        otbRevenue: new Prisma.Decimal(0),
      })
    }

    // Category performance accumulator
    const categoryMap = new Map<
      string,
      {
        categoryName: string
        totalRooms: number
        occupiedNights: number
        roomRevenue: Prisma.Decimal
      }
    >()

    // Initialize category map from all physical rooms
    for (const r of rooms) {
      const catId = r.roomCategoryId
      const catName = r.category.name
      const existing = categoryMap.get(catId) || {
        categoryName: catName,
        totalRooms: 0,
        occupiedNights: 0,
        roomRevenue: new Prisma.Decimal(0),
      }
      existing.totalRooms += 1
      categoryMap.set(catId, existing)
    }

    let totalOccupiedRoomNights = 0
    let totalRoomRevenueDec = new Prisma.Decimal(0)
    let totalOtbRoomNights = 0
    let totalOtbRevenueDec = new Prisma.Decimal(0)

    // Evaluate occupancy night-by-night
    for (const alloc of allocations) {
      const effectiveDep = alloc.actualCheckoutDate ?? alloc.departureDate
      const allocArr = new Date(alloc.arrivalDate).getTime()
      const allocDep = new Date(effectiveDep).getTime()
      const nightlyRate = alloc.bookedNightlyRate

      for (let i = 0; i < totalDays; i++) {
        const curDayStart = startObj.getTime() + i * 24 * 60 * 60 * 1000
        const dateKey = new Date(curDayStart).toISOString().split("T")[0]!

        // Half-open interval: arrival inclusive, departure exclusive
        if (allocArr <= curDayStart && curDayStart < allocDep) {
          const isPastDate = curDayStart < todayUtc
          const isRealized =
            alloc.status === AllocationStatus.CHECKED_IN ||
            alloc.status === AllocationStatus.CHECKED_OUT

          const dayEntry = dailyMap.get(dateKey)
          if (!dayEntry) continue

          if (isRealized) {
            if (!dayEntry.occupiedRooms.has(alloc.roomId)) {
              dayEntry.occupiedRooms.add(alloc.roomId)
              dayEntry.roomRevenue = dayEntry.roomRevenue.add(nightlyRate)
              totalOccupiedRoomNights++
              totalRoomRevenueDec = totalRoomRevenueDec.add(nightlyRate)

              // Category attribution
              const catId = alloc.roomCategoryId
              const catEntry = categoryMap.get(catId)
              if (catEntry) {
                catEntry.occupiedNights += 1
                catEntry.roomRevenue = catEntry.roomRevenue.add(nightlyRate)
              }
            }
          } else if (alloc.status === AllocationStatus.CONFIRMED) {
            if (isPastDate && EXCLUDE_PAST_CONFIRMED_FROM_OCCUPANCY) {
              // Past unarrived confirmed allocations are strictly excluded from realized occupancy and revenue
            } else {
              // Current or future OTB reserved rooms
              if (!dayEntry.otbRooms.has(alloc.roomId)) {
                dayEntry.otbRooms.add(alloc.roomId)
                dayEntry.otbRevenue = dayEntry.otbRevenue.add(nightlyRate)
                totalOtbRoomNights++
                totalOtbRevenueDec = totalOtbRevenueDec.add(nightlyRate)
              }

              if (FUTURE_OCCUPANCY_POLICY === "INCLUDE_IN_OCCUPANCY") {
                if (!dayEntry.occupiedRooms.has(alloc.roomId)) {
                  dayEntry.occupiedRooms.add(alloc.roomId)
                  dayEntry.roomRevenue = dayEntry.roomRevenue.add(nightlyRate)
                  totalOccupiedRoomNights++
                  totalRoomRevenueDec = totalRoomRevenueDec.add(nightlyRate)

                  // Category attribution
                  const catId = alloc.roomCategoryId
                  const catEntry = categoryMap.get(catId)
                  if (catEntry) {
                    catEntry.occupiedNights += 1
                    catEntry.roomRevenue = catEntry.roomRevenue.add(nightlyRate)
                  }
                }
              }
            }
          }
        }
      }
    }

    // 5. Build daily breakdown DTO
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]
    const dailyBreakdown: DailyOccupancyDTO[] = []

    for (const [dateStr, entry] of dailyMap.entries()) {
      const dObj = new Date(`${dateStr}T00:00:00.000Z`)
      const occupied = entry.occupiedRooms.size
      const otb = entry.otbRooms.size
      const available = Math.max(0, totalRooms - occupied)
      const rate = totalRooms > 0 ? (occupied / totalRooms) * 100 : 0
      const dayRev = entry.roomRevenue
      const dayAdr = occupied > 0 ? dayRev.div(occupied) : new Prisma.Decimal(0)
      const dayRevpar = totalRooms > 0 ? dayRev.div(totalRooms) : new Prisma.Decimal(0)

      dailyBreakdown.push({
        date: dateStr,
        dayOfWeek: dayNames[dObj.getUTCDay()]!,
        totalRooms,
        occupiedRooms: occupied,
        availableRooms: available,
        occupancyRate: Math.round(rate * 10) / 10,
        roomRevenue: dayRev.toFixed(2),
        adr: dayAdr.toFixed(2),
        revpar: dayRevpar.toFixed(2),
        otbRooms: otb,
        otbRevenue: entry.otbRevenue.toFixed(2),
      })
    }

    // 6. Build category breakdown DTO
    const categoryBreakdown: CategoryPerformanceDTO[] = []
    for (const [catId, cat] of categoryMap.entries()) {
      const catAvailableNights = cat.totalRooms * totalDays
      const catRate =
        catAvailableNights > 0 ? (cat.occupiedNights / catAvailableNights) * 100 : 0
      const catAdr =
        cat.occupiedNights > 0 ? cat.roomRevenue.div(cat.occupiedNights) : new Prisma.Decimal(0)
      const catRevpar =
        catAvailableNights > 0
          ? cat.roomRevenue.div(catAvailableNights)
          : new Prisma.Decimal(0)

      categoryBreakdown.push({
        categoryId: catId,
        categoryName: cat.categoryName,
        totalRooms: cat.totalRooms,
        availableRoomNights: catAvailableNights,
        occupiedRoomNights: cat.occupiedNights,
        occupancyRate: Math.round(catRate * 10) / 10,
        roomRevenue: cat.roomRevenue.toFixed(2),
        adr: catAdr.toFixed(2),
        revpar: catRevpar.toFixed(2),
      })
    }

    const overallRate =
      totalAvailableRoomNights > 0
        ? (totalOccupiedRoomNights / totalAvailableRoomNights) * 100
        : 0

    const averageDailyOccupancy =
      totalDays > 0 ? totalOccupiedRoomNights / totalDays : 0

    const overallAdr =
      totalOccupiedRoomNights > 0
        ? totalRoomRevenueDec.div(totalOccupiedRoomNights)
        : new Prisma.Decimal(0)

    const overallRevpar =
      totalAvailableRoomNights > 0
        ? totalRoomRevenueDec.div(totalAvailableRoomNights)
        : new Prisma.Decimal(0)

    return {
      startDate,
      endDate,
      totalDays,
      totalRooms,
      totalAvailableRoomNights,
      totalOccupiedRoomNights,
      occupancyRate: Math.round(overallRate * 10) / 10,
      averageDailyOccupancy: Math.round(averageDailyOccupancy * 10) / 10,
      totalRoomRevenue: totalRoomRevenueDec.toFixed(2),
      adr: overallAdr.toFixed(2),
      revpar: overallRevpar.toFixed(2),
      totalOtbRoomNights,
      totalOtbRevenue: totalOtbRevenueDec.toFixed(2),
      dailyBreakdown,
      categoryBreakdown,
    }
  }

  /**
   * Generates a date-range revenue and collections report distinguishing
   * invoiced revenue from money actually collected.
   */
  static async getRevenueReport(filters: ReportFilterDTO): Promise<RevenueReportDTO> {
    const { startDate, endDate, propertyId } = filters

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)

    // 1. Fetch Invoices created/issued in date range
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      createdAt: { gte: startObj, lte: endObj },
      status: { not: InvoiceStatus.VOID },
    }
    if (propertyId) {
      invoiceWhere.propertyId = propertyId
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        items: true,
        payments: {
          where: { status: PaymentStatus.RECORDED },
        },
      },
    })

    // 2. Fetch Payments recorded in date range
    const paymentWhere: Prisma.PaymentWhereInput = {
      paidAt: { gte: startObj, lte: endObj },
      status: PaymentStatus.RECORDED,
    }
    if (propertyId) {
      paymentWhere.propertyId = propertyId
    }

    const payments = await prisma.payment.findMany({
      where: paymentWhere,
    })

    // 3. Aggregate Invoiced Totals
    let totalInvoicedDec = new Prisma.Decimal(0)
    let taxTotalDec = new Prisma.Decimal(0)
    let discountTotalDec = new Prisma.Decimal(0)
    let roomChargesDec = new Prisma.Decimal(0)
    let extraChargesDec = new Prisma.Decimal(0)

    const chargeTypeMap = new Map<string, { amount: Prisma.Decimal; count: number }>()

    for (const inv of invoices) {
      totalInvoicedDec = totalInvoicedDec.add(inv.grandTotal)
      taxTotalDec = taxTotalDec.add(inv.taxTotal)
      discountTotalDec = discountTotalDec.add(inv.discountTotal)

      for (const item of inv.items) {
        if (item.itemType === InvoiceItemType.ROOM_CHARGE) {
          roomChargesDec = roomChargesDec.add(item.lineTotal)
        } else {
          extraChargesDec = extraChargesDec.add(item.lineTotal)
        }

        const typeKey = item.itemType
        const existing = chargeTypeMap.get(typeKey) || {
          amount: new Prisma.Decimal(0),
          count: 0,
        }
        chargeTypeMap.set(typeKey, {
          amount: existing.amount.add(item.lineTotal),
          count: existing.count + 1,
        })
      }
    }

    // 4. Aggregate Collected Payments & Payment Method Breakdown
    let totalCollectedDec = new Prisma.Decimal(0)
    const methodMap = new Map<string, { amount: Prisma.Decimal; count: number }>()

    for (const p of payments) {
      totalCollectedDec = totalCollectedDec.add(p.amount)
      const existing = methodMap.get(p.paymentMethod) || {
        amount: new Prisma.Decimal(0),
        count: 0,
      }
      methodMap.set(p.paymentMethod, {
        amount: existing.amount.add(p.amount),
        count: existing.count + 1,
      })
    }

    // 5. Aggregate Outstanding Balance on invoices in the period
    let totalOutstandingDec = new Prisma.Decimal(0)
    for (const inv of invoices) {
      const invPaid = inv.payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      )
      const balance = inv.grandTotal.sub(invPaid)
      if (balance.gt(0)) {
        totalOutstandingDec = totalOutstandingDec.add(balance)
      }
    }

    // 6. Build Payment Method Breakdown DTO
    const paymentMethodBreakdown: PaymentMethodBreakdownDTO[] = []
    for (const [method, data] of methodMap.entries()) {
      const pct =
        totalCollectedDec.gt(0)
          ? data.amount.div(totalCollectedDec).mul(100).toNumber()
          : 0
      paymentMethodBreakdown.push({
        method,
        amount: data.amount.toFixed(2),
        count: data.count,
        percentage: Math.round(pct * 10) / 10,
      })
    }

    // 7. Build Charge Type Breakdown DTO
    const chargeTypeBreakdown: ChargeTypeBreakdownDTO[] = []
    const totalSubtotal = roomChargesDec.add(extraChargesDec)
    for (const [itemType, data] of chargeTypeMap.entries()) {
      const pct =
        totalSubtotal.gt(0)
          ? data.amount.div(totalSubtotal).mul(100).toNumber()
          : 0
      chargeTypeBreakdown.push({
        itemType,
        amount: data.amount.toFixed(2),
        count: data.count,
        percentage: Math.round(pct * 10) / 10,
      })
    }

    // 8. Build Daily Revenue Breakdown
    const sTime = new Date(`${startDate}T00:00:00.000Z`).getTime()
    const eTime = new Date(`${endDate}T00:00:00.000Z`).getTime()
    const numDays = Math.round((eTime - sTime) / (1000 * 60 * 60 * 24)) + 1

    const dailyRevenueMap = new Map<
      string,
      { invoiced: Prisma.Decimal; collected: Prisma.Decimal }
    >()

    for (let i = 0; i < numDays; i++) {
      const dayDate = new Date(sTime + i * 24 * 60 * 60 * 1000)
      const key = dayDate.toISOString().split("T")[0]!
      dailyRevenueMap.set(key, {
        invoiced: new Prisma.Decimal(0),
        collected: new Prisma.Decimal(0),
      })
    }

    for (const inv of invoices) {
      const invDate = inv.createdAt.toISOString().split("T")[0]!
      const entry = dailyRevenueMap.get(invDate)
      if (entry) {
        entry.invoiced = entry.invoiced.add(inv.grandTotal)
      }
    }

    for (const p of payments) {
      const payDate = p.paidAt.toISOString().split("T")[0]!
      const entry = dailyRevenueMap.get(payDate)
      if (entry) {
        entry.collected = entry.collected.add(p.amount)
      }
    }

    const dailyBreakdown: DailyRevenueDTO[] = []
    for (const [dStr, entry] of dailyRevenueMap.entries()) {
      dailyBreakdown.push({
        date: dStr,
        invoicedAmount: entry.invoiced.toFixed(2),
        collectedAmount: entry.collected.toFixed(2),
      })
    }

    return {
      startDate,
      endDate,
      totalInvoiced: totalInvoicedDec.toFixed(2),
      totalCollected: totalCollectedDec.toFixed(2),
      totalOutstanding: totalOutstandingDec.toFixed(2),
      roomChargesTotal: roomChargesDec.toFixed(2),
      extraChargesTotal: extraChargesDec.toFixed(2),
      taxTotal: taxTotalDec.toFixed(2),
      discountTotal: discountTotalDec.toFixed(2),
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      paymentMethodBreakdown,
      chargeTypeBreakdown,
      dailyBreakdown,
    }
  }

  /**
   * Generates reservation status metrics across a selected date range.
   */
  static async getReservationStatusReport(
    filters: ReportFilterDTO
  ): Promise<ReservationStatusReportDTO> {
    const { startDate, endDate, propertyId } = filters

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)

    const resWhere: Prisma.ReservationWhereInput = {
      createdAt: { gte: startObj, lte: endObj },
    }
    if (propertyId) {
      resWhere.propertyId = propertyId
    }

    const reservations = await prisma.reservation.findMany({
      where: resWhere,
      include: {
        rooms: true,
      },
    })

    const totalReservations = reservations.length
    let totalAllocations = 0
    let totalStayNights = 0

    const statusMap = new Map<
      ReservationStatus,
      { count: number; roomNights: number; totalValue: Prisma.Decimal }
    >()

    for (const status of Object.values(ReservationStatus)) {
      statusMap.set(status, {
        count: 0,
        roomNights: 0,
        totalValue: new Prisma.Decimal(0),
      })
    }

    for (const res of reservations) {
      const entry = statusMap.get(res.status)!
      entry.count++

      for (const alloc of res.rooms) {
        totalAllocations++
        const effectiveDep = alloc.actualCheckoutDate ?? alloc.departureDate
        const nights = Math.max(
          1,
          Math.round(
            (effectiveDep.getTime() - alloc.arrivalDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
        totalStayNights += nights
        entry.roomNights += nights
        entry.totalValue = entry.totalValue.add(
          alloc.bookedNightlyRate.mul(nights)
        )
      }
    }

    const statusBreakdown: ReservationStatusCountDTO[] = []
    let cancelledCount = 0
    let completedCount = 0

    for (const [status, data] of statusMap.entries()) {
      const pct =
        totalReservations > 0 ? (data.count / totalReservations) * 100 : 0
      if (status === ReservationStatus.CANCELLED) {
        cancelledCount = data.count
      }
      if (status === ReservationStatus.COMPLETED) {
        completedCount = data.count
      }

      statusBreakdown.push({
        status,
        count: data.count,
        percentage: Math.round(pct * 10) / 10,
        roomNights: data.roomNights,
        totalValue: data.totalValue.toFixed(2),
      })
    }

    const averageLengthOfStay =
      totalAllocations > 0
        ? Math.round((totalStayNights / totalAllocations) * 10) / 10
        : 0

    const cancellationRate =
      totalReservations > 0
        ? Math.round((cancelledCount / totalReservations) * 1000) / 10
        : 0

    const completionRate =
      totalReservations > 0
        ? Math.round((completedCount / totalReservations) * 1000) / 10
        : 0

    return {
      startDate,
      endDate,
      totalReservations,
      totalAllocations,
      totalStayNights,
      averageLengthOfStay,
      cancellationRate,
      completionRate,
      statusBreakdown,
    }
  }

  /**
   * Generates Daily Operations shift report:
   * 1. Expected Arrivals (with guest info, allocated room, invoice balance due)
   * 2. Expected Departures (with guest info, room, invoice balance due)
   * 3. Current In-House Guests (checked-in allocations actively staying)
   * 4. Pending / Overdue Arrivals (scheduled check-ins in the past that never checked in)
   */
  public static invalidateReportsCache(propertyId?: string | null): void {
    invalidateScoped("daily-operations", propertyId)
    invalidateScoped("billing-summary", propertyId)
    invalidateScoped("receivables-summary", propertyId)
  }

  static async getDailyOperations(
    targetDateStr?: string,
    propertyId?: string
  ): Promise<DailyOperationsReportDTO> {
    const dateStr = targetDateStr || getHotelTodayDate()

    let effectivePropertyId = propertyId
    if (!effectivePropertyId) {
      const firstProp = await prisma.property.findFirst({
        select: { id: true },
        orderBy: { name: "asc" },
      })
      if (firstProp) {
        effectivePropertyId = firstProp.id
      }
    }

    const fetchOps = async (): Promise<DailyOperationsReportDTO> => {
      const targetDate = new Date(`${dateStr}T00:00:00.000Z`)
      const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)

      const baseWhere: Prisma.ReservationRoomWhereInput = {}
      if (effectivePropertyId) {
        baseWhere.room = { propertyId: effectivePropertyId }
      }

      // 1. Fetch Arrivals scheduled for targetDate
      const arrivalAllocations = await prisma.reservationRoom.findMany({
        where: {
          ...baseWhere,
        arrivalDate: { gte: targetDate, lt: nextDay },
        status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN] },
        reservation: { status: { not: ReservationStatus.CANCELLED } },
      },
      include: {
        reservation: {
          include: {
            customer: true,
            invoices: {
              where: { status: { not: InvoiceStatus.VOID } },
              include: { payments: { where: { status: PaymentStatus.RECORDED } } },
            },
          },
        },
        room: {
          include: { building: true, floor: true },
        },
        roomCategory: true,
      },
      orderBy: [{ room: { roomNo: "asc" } }],
    })

    // 2. Fetch Departures scheduled for targetDate
    const departureAllocations = await prisma.reservationRoom.findMany({
      where: {
        ...baseWhere,
        departureDate: { gte: targetDate, lt: nextDay },
        status: { in: [AllocationStatus.CHECKED_IN, AllocationStatus.CHECKED_OUT] },
        reservation: { status: { not: ReservationStatus.CANCELLED } },
      },
      include: {
        reservation: {
          include: {
            customer: true,
            invoices: {
              where: { status: { not: InvoiceStatus.VOID } },
              include: { payments: { where: { status: PaymentStatus.RECORDED } } },
            },
          },
        },
        room: {
          include: { building: true, floor: true },
        },
        roomCategory: true,
      },
      orderBy: [{ room: { roomNo: "asc" } }],
    })

    // 3. Fetch In-House guests staying on targetDate
    // Arrival on or before target date, departure strictly after target date, status CHECKED_IN
    const inHouseAllocations = await prisma.reservationRoom.findMany({
      where: {
        ...baseWhere,
        status: AllocationStatus.CHECKED_IN,
        arrivalDate: { lt: nextDay },
        departureDate: { gt: targetDate },
      },
      include: {
        reservation: {
          include: {
            customer: true,
            invoices: {
              where: { status: { not: InvoiceStatus.VOID } },
              include: { payments: { where: { status: PaymentStatus.RECORDED } } },
            },
          },
        },
        room: {
          include: { building: true, floor: true },
        },
        roomCategory: true,
      },
      orderBy: [{ room: { roomNo: "asc" } }],
    })

    // 4. Fetch Pending / Overdue check-ins (scheduled BEFORE target date, still CONFIRMED)
    const pendingAllocations = await prisma.reservationRoom.findMany({
      where: {
        ...baseWhere,
        status: AllocationStatus.CONFIRMED,
        arrivalDate: { lt: targetDate },
        reservation: { status: { not: ReservationStatus.CANCELLED } },
      },
      include: {
        reservation: {
          include: {
            customer: true,
            invoices: {
              where: { status: { not: InvoiceStatus.VOID } },
              include: { payments: { where: { status: PaymentStatus.RECORDED } } },
            },
          },
        },
        room: {
          include: { building: true, floor: true },
        },
        roomCategory: true,
      },
      orderBy: [{ arrivalDate: "asc" }],
    })

    // Helper to map DB allocation to DailyOperationItemDTO
    const mapToItem = (alloc: (typeof arrivalAllocations)[number]): DailyOperationItemDTO => {
      const inv = alloc.reservation.invoices[0]
      let grandTotal: string | null = null
      let totalPaid: string | null = null
      let balanceDue: string | null = null

      if (inv) {
        grandTotal = inv.grandTotal.toFixed(2)
        const paidDec = inv.payments.reduce(
          (sum, p) => sum.add(p.amount),
          new Prisma.Decimal(0)
        )
        totalPaid = paidDec.toFixed(2)
        balanceDue = inv.grandTotal.sub(paidDec).toFixed(2)
      }

      const effectiveDep = alloc.actualCheckoutDate ?? alloc.departureDate
      const stayNights = Math.max(
        1,
        Math.round(
          (effectiveDep.getTime() - alloc.arrivalDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )

      return {
        allocationId: alloc.id,
        reservationId: alloc.reservationId,
        reservationNo: alloc.reservation.reservationNo,
        customerId: alloc.reservation.customerId,
        guestName: `${alloc.reservation.customer.firstName} ${alloc.reservation.customer.lastName}`,
        guestPhone: alloc.reservation.customer.phone || null,
        guestEmail: alloc.reservation.customer.email || null,
        roomId: alloc.roomId,
        roomNo: alloc.room.roomNo,
        roomDisplayName: alloc.room.displayName,
        roomCategoryName: alloc.roomCategory.name,
        buildingName: alloc.room.building.name,
        floorNo: alloc.room.floor.floorNo,
        arrivalDate: alloc.arrivalDate.toISOString().split("T")[0]!,
        departureDate: alloc.departureDate.toISOString().split("T")[0]!,
        stayNights,
        bookedNightlyRate: alloc.bookedNightlyRate.toFixed(2),
        allocationStatus: alloc.status,
        roomStatus: alloc.room.status,
        invoiceId: inv ? inv.id : null,
        invoiceNumber: inv ? inv.invoiceNumber : null,
        invoiceGrandTotal: grandTotal,
        invoiceTotalPaid: totalPaid,
        invoiceBalanceDue: balanceDue,
        specialRequests: alloc.reservation.specialRequests,
      }
    }

    const arrivals = arrivalAllocations.map(mapToItem)
    const departures = departureAllocations.map(mapToItem)
    const inHouse = inHouseAllocations.map(mapToItem)
    const pendingArrivals = pendingAllocations.map(mapToItem)

    // Calculate Summary totals
    let totalArrivalBalance = new Prisma.Decimal(0)
    for (const a of arrivals) {
      if (a.invoiceBalanceDue) {
        totalArrivalBalance = totalArrivalBalance.add(new Prisma.Decimal(a.invoiceBalanceDue))
      }
    }

    let totalDepartureBalance = new Prisma.Decimal(0)
    for (const d of departures) {
      if (d.invoiceBalanceDue) {
        totalDepartureBalance = totalDepartureBalance.add(new Prisma.Decimal(d.invoiceBalanceDue))
      }
    }

    let totalInHouseBalance = new Prisma.Decimal(0)
    for (const ih of inHouse) {
      if (ih.invoiceBalanceDue) {
        totalInHouseBalance = totalInHouseBalance.add(new Prisma.Decimal(ih.invoiceBalanceDue))
      }
    }

    const checkedInArrivalsCount = arrivals.filter(
      (a) => a.allocationStatus === AllocationStatus.CHECKED_IN
    ).length

    const checkedOutDeparturesCount = departures.filter(
      (d) => d.allocationStatus === AllocationStatus.CHECKED_OUT
    ).length

    return {
      targetDate: dateStr,
      summary: {
        expectedArrivalsCount: arrivals.length,
        checkedInArrivalsCount,
        expectedDeparturesCount: departures.length,
        checkedOutDeparturesCount,
        inHouseCount: inHouse.length,
        pendingArrivalsCount: pendingArrivals.length,
        totalArrivalBalanceDue: totalArrivalBalance.toFixed(2),
        totalDepartureBalanceDue: totalDepartureBalance.toFixed(2),
        totalInHouseBalanceDue: totalInHouseBalance.toFixed(2),
      },
      arrivals,
      departures,
      inHouse,
      pendingArrivals,
    }
  }

    return scopedCached("daily-operations", effectivePropertyId, 60, fetchOps, [dateStr])
  }

  /**
   * Generates Room Availability Grid / Tape Chart (Date-by-Room matrix)
   * Shows booked slots with guest names and links, vacant rooms, and maintenance blocks.
   */
  static async getAvailabilityGrid(
    startDateStr: string,
    endDateStr: string,
    propertyId?: string,
    buildingId?: string
  ): Promise<AvailabilityGridDTO> {
    const startObj = new Date(`${startDateStr}T00:00:00.000Z`)
    const endObj = new Date(`${endDateStr}T00:00:00.000Z`)

    const numDays = Math.min(
      31,
      Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    )

    const dates: string[] = []
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startObj.getTime() + i * 24 * 60 * 60 * 1000)
      dates.push(d.toISOString().split("T")[0]!)
    }

    // 1. Determine scoped property
    let effectivePropertyId = propertyId
    if (!effectivePropertyId) {
      const firstProp = await prisma.property.findFirst({
        select: { id: true },
        orderBy: { name: "asc" },
      })
      if (firstProp) {
        effectivePropertyId = firstProp.id
      }
    }

    const roomWhere: Prisma.RoomWhereInput = {}
    if (effectivePropertyId) {
      roomWhere.propertyId = effectivePropertyId
    }
    if (buildingId) {
      roomWhere.buildingId = buildingId
    }

    const physicalRooms = await prisma.room.findMany({
      where: roomWhere,
      include: {
        building: true,
        floor: true,
        category: true,
      },
      orderBy: [
        { building: { name: "asc" } },
        { floor: { floorNo: "asc" } },
        { roomNo: "asc" },
      ],
      take: 100, // Bound view to max 100 rooms for instant render and lightweight payload
    })

    // 2. Fetch overlapping allocations in window ONLY for the scoped rooms
    const nextDayAfterEnd = new Date(startObj.getTime() + numDays * 24 * 60 * 60 * 1000)
    const roomIds = physicalRooms.map((r) => r.id)
    const allocations =
      roomIds.length > 0
        ? await prisma.reservationRoom.findMany({
            where: {
              roomId: { in: roomIds },
              status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN] },
              arrivalDate: { lt: nextDayAfterEnd },
              departureDate: { gt: startObj },
              reservation: { status: { not: ReservationStatus.CANCELLED } },
            },
            include: {
              reservation: {
                include: { customer: true },
              },
            },
          })
        : []

    // Map allocations by roomId
    const allocMap = new Map<string, typeof allocations>()
    for (const alloc of allocations) {
      const list = allocMap.get(alloc.roomId) || []
      list.push(alloc)
      allocMap.set(alloc.roomId, list)
    }

    // 3. Assemble rooms matrix
    const rooms: AvailabilityGridRoomDTO[] = []

    for (const r of physicalRooms) {
      const roomAllocs = allocMap.get(r.id) || []
      const slots: AvailabilityGridSlotDTO[] = []
      const defaultRate = r.priceOverride || r.category.basePrice
      const isRoomUnderMaintenance =
        r.status === RoomStatus.MAINTENANCE || r.status === RoomStatus.OUT_OF_SERVICE

      for (let i = 0; i < numDays; i++) {
        const curDayStart = startObj.getTime() + i * 24 * 60 * 60 * 1000
        const dateStr = dates[i]!

        // Find allocation covering this day: arrival <= curDayStart < departure
        const matchedAlloc = roomAllocs.find((a) => {
          const arr = a.arrivalDate.getTime()
          const effectiveDep = a.actualCheckoutDate ?? a.departureDate
          const dep = effectiveDep.getTime()
          return arr <= curDayStart && curDayStart < dep
        })

        if (matchedAlloc) {
          const arrIso = matchedAlloc.arrivalDate.toISOString().split("T")[0]!
          const depIso = matchedAlloc.departureDate.toISOString().split("T")[0]!

          slots.push({
            date: dateStr,
            isAvailable: false,
            isOccupied: true,
            isMaintenance: false,
            nightlyRate: matchedAlloc.bookedNightlyRate.toFixed(2),
            allocationId: matchedAlloc.id,
            reservationId: matchedAlloc.reservationId,
            reservationNo: matchedAlloc.reservation.reservationNo,
            guestName: `${matchedAlloc.reservation.customer.firstName} ${matchedAlloc.reservation.customer.lastName}`,
            allocationStatus: matchedAlloc.status,
            isArrivalDay: dateStr === arrIso,
            isDepartureDay: dateStr === depIso,
          })
        } else if (isRoomUnderMaintenance) {
          slots.push({
            date: dateStr,
            isAvailable: false,
            isOccupied: false,
            isMaintenance: true,
            nightlyRate: defaultRate.toFixed(2),
          })
        } else {
          slots.push({
            date: dateStr,
            isAvailable: true,
            isOccupied: false,
            isMaintenance: false,
            nightlyRate: defaultRate.toFixed(2),
          })
        }
      }

      rooms.push({
        roomId: r.id,
        roomNo: r.roomNo,
        displayName: r.displayName,
        categoryName: r.category.name,
        buildingName: r.building.name,
        floorNo: r.floor.floorNo,
        currentStatus: r.status,
        capacity: r.capacity,
        basePrice: defaultRate.toFixed(2),
        slots,
      })
    }

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      dates,
      rooms,
      totalRooms: physicalRooms.length,
    }
  }

  /**
   * Generates Shift Collections / Daily Cash Drawer Reconciliation report:
   * Splits payments by payment method, by staff user, and itemizes receipt transactions.
   */
  static async getShiftCollections(
    dateStr?: string,
    startDateStr?: string,
    endDateStr?: string,
    staffUserId?: string,
    propertyId?: string
  ): Promise<ShiftCollectionsReportDTO> {
    const todayIso = getHotelTodayDate()
    const effectiveStart = startDateStr || dateStr || todayIso
    const effectiveEnd = endDateStr || dateStr || todayIso

    const startObj = new Date(`${effectiveStart}T00:00:00.000Z`)
    const endObj = new Date(`${effectiveEnd}T23:59:59.999Z`)

    const paymentWhere: Prisma.PaymentWhereInput = {
      OR: [
        { paidAt: { gte: startObj, lte: endObj } },
        { status: PaymentStatus.VOIDED, voidedAt: { gte: startObj, lte: endObj } },
      ],
    }

    if (propertyId) {
      paymentWhere.propertyId = propertyId
    }

    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      include: {
        creator: true,
        voider: true,
        invoice: {
          include: {
            reservation: {
              include: {
                customer: true,
                rooms: {
                  include: { room: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ paidAt: "desc" }],
    })

    let totalCollectedDec = new Prisma.Decimal(0)
    const methodMap = new Map<string, { amount: Prisma.Decimal; count: number }>()
    const staffMap = new Map<
      string,
      {
        userName: string
        userEmail: string
        total: Prisma.Decimal
        count: number
        methods: Record<string, Prisma.Decimal>
      }
    >()

    const transactions: PaymentTransactionDTO[] = []

    for (const p of payments) {
      const wasRecordedInWindow = p.paidAt >= startObj && p.paidAt <= endObj
      const wasVoidedInWindow =
        p.status === PaymentStatus.VOIDED &&
        p.voidedAt !== null &&
        p.voidedAt >= startObj &&
        p.voidedAt <= endObj

      // 1. Process payment collection if recorded in this window
      // If voided in a future shift, past shift total remains unchanged
      if (wasRecordedInWindow) {
        if (!staffUserId || p.createdBy === staffUserId) {
          totalCollectedDec = totalCollectedDec.add(p.amount)

          const mExisting = methodMap.get(p.paymentMethod) || {
            amount: new Prisma.Decimal(0),
            count: 0,
          }
          mExisting.amount = mExisting.amount.add(p.amount)
          mExisting.count++
          methodMap.set(p.paymentMethod, mExisting)

          const uId = p.createdBy
          const uName = p.creator?.name || "System Staff"
          const uEmail = p.creator?.email || ""
          const sExisting = staffMap.get(uId) || {
            userName: uName,
            userEmail: uEmail,
            total: new Prisma.Decimal(0),
            count: 0,
            methods: {} as Record<string, Prisma.Decimal>,
          }
          sExisting.total = sExisting.total.add(p.amount)
          sExisting.count++
          const curMethodAmount =
            sExisting.methods[p.paymentMethod] || new Prisma.Decimal(0)
          sExisting.methods[p.paymentMethod] = curMethodAmount.add(p.amount)
          staffMap.set(uId, sExisting)

          const customer = p.invoice.reservation?.customer
          const guestName = customer
            ? `${customer.firstName} ${customer.lastName}`
            : "Direct Folio"
          const roomNos =
            p.invoice.reservation?.rooms?.map((r) => r.room.roomNo) || []

          transactions.push({
            paymentId: p.id,
            receiptNumber: `REC-${p.id.slice(-8).toUpperCase()}`,
            invoiceId: p.invoiceId,
            invoiceNumber: p.invoice.invoiceNumber,
            reservationId: p.invoice.reservationId,
            reservationNo: p.invoice.reservation?.reservationNo || null,
            guestName,
            roomNumbers: roomNos,
            amount: p.amount.toFixed(2),
            paymentMethod: p.paymentMethod,
            referenceNumber: p.referenceNumber,
            notes: null,
            recordedByUserId: p.createdBy,
            recordedByUserName: uName,
            paidAt: p.paidAt.toISOString(),
          })
        }
      }

      // 2. Process payment void if voided in this window
      // Attributed to the shift where the void actually occurred
      if (wasVoidedInWindow) {
        const voidStaffId = p.voidedBy || p.createdBy
        if (!staffUserId || voidStaffId === staffUserId) {
          totalCollectedDec = totalCollectedDec.sub(p.amount)

          const mExisting = methodMap.get(p.paymentMethod) || {
            amount: new Prisma.Decimal(0),
            count: 0,
          }
          mExisting.amount = mExisting.amount.sub(p.amount)
          methodMap.set(p.paymentMethod, mExisting)

          const voiderName = p.voider?.name || p.creator?.name || "System Staff"
          const voiderEmail = p.voider?.email || p.creator?.email || ""
          const sExisting = staffMap.get(voidStaffId) || {
            userName: voiderName,
            userEmail: voiderEmail,
            total: new Prisma.Decimal(0),
            count: 0,
            methods: {} as Record<string, Prisma.Decimal>,
          }
          sExisting.total = sExisting.total.sub(p.amount)
          const curMethodAmount =
            sExisting.methods[p.paymentMethod] || new Prisma.Decimal(0)
          sExisting.methods[p.paymentMethod] = curMethodAmount.sub(p.amount)
          staffMap.set(voidStaffId, sExisting)

          const customer = p.invoice.reservation?.customer
          const guestName = customer
            ? `${customer.firstName} ${customer.lastName}`
            : "Direct Folio"
          const roomNos =
            p.invoice.reservation?.rooms?.map((r) => r.room.roomNo) || []

          transactions.push({
            paymentId: p.id,
            receiptNumber: `VOID-${p.id.slice(-8).toUpperCase()}`,
            invoiceId: p.invoiceId,
            invoiceNumber: p.invoice.invoiceNumber,
            reservationId: p.invoice.reservationId,
            reservationNo: p.invoice.reservation?.reservationNo || null,
            guestName,
            roomNumbers: roomNos,
            amount: (-p.amount).toFixed(2),
            paymentMethod: p.paymentMethod,
            referenceNumber: p.referenceNumber,
            notes: p.voidReason ? `Voided: ${p.voidReason}` : "Payment voided",
            recordedByUserId: voidStaffId,
            recordedByUserName: voiderName,
            paidAt: (p.voidedAt || p.paidAt).toISOString(),
          })
        }
      }
    }

    const methodBreakdown: PaymentMethodBreakdownDTO[] = []
    for (const [method, data] of methodMap.entries()) {
      const pct =
        totalCollectedDec.gt(0)
          ? data.amount.div(totalCollectedDec).mul(100).toNumber()
          : 0
      methodBreakdown.push({
        method,
        amount: data.amount.toFixed(2),
        count: data.count,
        percentage: Math.round(pct * 10) / 10,
      })
    }

    const staffBreakdown: StaffCollectionBreakdownDTO[] = []
    for (const [userId, data] of staffMap.entries()) {
      const methodsFormatted: Record<string, string> = {}
      for (const [mName, mDec] of Object.entries(data.methods)) {
        methodsFormatted[mName] = mDec.toFixed(2)
      }
      staffBreakdown.push({
        userId,
        userName: data.userName,
        userEmail: data.userEmail,
        totalCollected: data.total.toFixed(2),
        paymentCount: data.count,
        methods: methodsFormatted,
      })
    }

    return {
      targetDate: effectiveStart === effectiveEnd ? effectiveStart : `${effectiveStart} to ${effectiveEnd}`,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      totalCollected: totalCollectedDec.toFixed(2),
      totalTransactions: payments.length,
      methodBreakdown,
      staffBreakdown,
      transactions,
    }
  }

  /**
   * Generates Outstanding Balances / Receivables Aging report.
   * Identifies all unpaid invoices, ages them into standard aging buckets,
   * and clearly flags whether debtor is currently in-house or departed.
   */
  static async getReceivablesReport(
    propertyId?: string,
    filterOption: "all" | "in_house" | "future" | "departed" = "all",
    options?: { page?: number; limit?: number }
  ): Promise<ReceivablesReportDTO> {
    const todayStr = getHotelTodayDate()

    // 1. Compute summary aggregates using SQL (cached with tag billing-summary)
    const propertyFilterSql = propertyId
      ? Prisma.sql`AND i.property_id = ${propertyId}`
      : Prisma.empty

    const fetchSummary = async () => {
      const summaryRows = await prisma.$queryRaw<
        Array<{
          total_invoices: number
          total_receivables: string
          in_house_count: number
          in_house_receivables: string
          future_count: number
          future_receivables: string
          departed_count: number
          departed_receivables: string
          bucket_0_to_7: string
          bucket_8_to_30: string
          bucket_31_to_60: string
          bucket_60_plus: string
        }>
      >`
        WITH unpaid_inv AS (
          SELECT 
            i.id,
            i.created_at,
            i.grand_total,
            COALESCE(p.paid, 0) AS total_paid,
            (i.grand_total - COALESCE(p.paid, 0)) AS balance_due,
            i.reservation_id,
            CASE
              WHEN in_house.reservation_id IS NOT NULL THEN 'IN_HOUSE'
              WHEN confirmed.reservation_id IS NOT NULL THEN 'FUTURE'
              ELSE 'DEPARTED'
            END AS stay_status,
            (CURRENT_DATE - i.created_at::date) AS days_aging
          FROM invoices i
          LEFT JOIN (
            SELECT invoice_id, SUM(amount) AS paid 
            FROM payments 
            WHERE status = 'RECORDED' 
            GROUP BY invoice_id
          ) p ON p.invoice_id = i.id
          LEFT JOIN (
            SELECT DISTINCT reservation_id FROM reservation_rooms WHERE status = 'CHECKED_IN'
          ) in_house ON in_house.reservation_id = i.reservation_id
          LEFT JOIN (
            SELECT DISTINCT reservation_id FROM reservation_rooms WHERE status = 'CONFIRMED'
          ) confirmed ON confirmed.reservation_id = i.reservation_id
          WHERE i.status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID')
            AND (i.grand_total - COALESCE(p.paid, 0)) > 0
            ${propertyFilterSql}
        )
        SELECT 
          COUNT(*)::int AS total_invoices,
          COALESCE(SUM(balance_due), 0)::text AS total_receivables,
          COUNT(*) FILTER (WHERE stay_status = 'IN_HOUSE')::int AS in_house_count,
          COALESCE(SUM(balance_due) FILTER (WHERE stay_status = 'IN_HOUSE'), 0)::text AS in_house_receivables,
          COUNT(*) FILTER (WHERE stay_status = 'FUTURE')::int AS future_count,
          COALESCE(SUM(balance_due) FILTER (WHERE stay_status = 'FUTURE'), 0)::text AS future_receivables,
          COUNT(*) FILTER (WHERE stay_status = 'DEPARTED')::int AS departed_count,
          COALESCE(SUM(balance_due) FILTER (WHERE stay_status = 'DEPARTED'), 0)::text AS departed_receivables,
          COALESCE(SUM(balance_due) FILTER (WHERE days_aging <= 7), 0)::text AS bucket_0_to_7,
          COALESCE(SUM(balance_due) FILTER (WHERE days_aging BETWEEN 8 AND 30), 0)::text AS bucket_8_to_30,
          COALESCE(SUM(balance_due) FILTER (WHERE days_aging BETWEEN 31 AND 60), 0)::text AS bucket_31_to_60,
          COALESCE(SUM(balance_due) FILTER (WHERE days_aging > 60), 0)::text AS bucket_60_plus
        FROM unpaid_inv;
      `

      return summaryRows[0] || {
        total_invoices: 0,
        total_receivables: "0.00",
        in_house_count: 0,
        in_house_receivables: "0.00",
        future_count: 0,
        future_receivables: "0.00",
        departed_count: 0,
        departed_receivables: "0.00",
        bucket_0_to_7: "0.00",
        bucket_8_to_30: "0.00",
        bucket_31_to_60: "0.00",
        bucket_60_plus: "0.00",
      }
    }

    const sum = await scopedCached("receivables-summary", propertyId, 60, fetchSummary)

    // 2. Determine pagination
    const page = Math.max(1, options?.page || 1)
    const limit = options?.limit
      ? Math.max(1, Math.min(200, options.limit))
      : options?.page
      ? 50
      : undefined
    const skip = limit ? (page - 1) * limit : 0

    let totalForFilter = sum.total_invoices
    if (filterOption === "in_house") totalForFilter = sum.in_house_count
    else if (filterOption === "future") totalForFilter = sum.future_count
    else if (filterOption === "departed") totalForFilter = sum.departed_count

    const stayStatusFilterSql =
      filterOption === "in_house"
        ? Prisma.sql`AND u.stay_status = 'IN_HOUSE'`
        : filterOption === "future"
        ? Prisma.sql`AND u.stay_status = 'FUTURE'`
        : filterOption === "departed"
        ? Prisma.sql`AND u.stay_status = 'DEPARTED'`
        : Prisma.empty

    const paginationSql = limit
      ? Prisma.sql`LIMIT ${limit} OFFSET ${skip}`
      : Prisma.sql`LIMIT 500`

    const itemRows = await prisma.$queryRaw<
      Array<{
        invoice_id: string
        invoice_number: string
        reservation_id: string
        reservation_no: string
        customer_id: string
        reservation_status: ReservationStatus
        first_name: string
        last_name: string | null
        phone: string | null
        email: string | null
        stay_status: "IN_HOUSE" | "FUTURE" | "DEPARTED"
        is_guest_in_house: boolean
        issue_date: Date
        grand_total: Prisma.Decimal
        total_paid: Prisma.Decimal
        balance_due: Prisma.Decimal
        days_aging: number
        aging_bucket: "0-7" | "8-30" | "31-60" | "60+"
      }>
    >`
      WITH unpaid_inv AS (
        SELECT 
          i.id AS invoice_id,
          i.invoice_number,
          i.reservation_id,
          i.created_at,
          i.grand_total,
          COALESCE(p.paid, 0) AS total_paid,
          (i.grand_total - COALESCE(p.paid, 0)) AS balance_due,
          CASE
            WHEN in_house.reservation_id IS NOT NULL THEN 'IN_HOUSE'
            WHEN confirmed.reservation_id IS NOT NULL THEN 'FUTURE'
            ELSE 'DEPARTED'
          END AS stay_status,
          (CURRENT_DATE - i.created_at::date) AS days_aging
        FROM invoices i
        LEFT JOIN (
          SELECT invoice_id, SUM(amount) AS paid 
          FROM payments 
          WHERE status = 'RECORDED' 
          GROUP BY invoice_id
        ) p ON p.invoice_id = i.id
        LEFT JOIN (
          SELECT DISTINCT reservation_id FROM reservation_rooms WHERE status = 'CHECKED_IN'
        ) in_house ON in_house.reservation_id = i.reservation_id
        LEFT JOIN (
          SELECT DISTINCT reservation_id FROM reservation_rooms WHERE status = 'CONFIRMED'
        ) confirmed ON confirmed.reservation_id = i.reservation_id
        WHERE i.status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID')
          AND (i.grand_total - COALESCE(p.paid, 0)) > 0
          ${propertyFilterSql}
      )
      SELECT 
        u.invoice_id,
        u.invoice_number,
        u.reservation_id,
        r.reservation_no,
        r.customer_id,
        r.status AS reservation_status,
        c.first_name,
        c.last_name,
        c.phone,
        c.email,
        u.stay_status,
        (u.stay_status = 'IN_HOUSE') AS is_guest_in_house,
        u.created_at AS issue_date,
        u.grand_total,
        u.total_paid,
        u.balance_due,
        u.days_aging,
        CASE
          WHEN u.days_aging <= 7 THEN '0-7'
          WHEN u.days_aging <= 30 THEN '8-30'
          WHEN u.days_aging <= 60 THEN '31-60'
          ELSE '60+'
        END AS aging_bucket
      FROM unpaid_inv u
      JOIN reservations r ON r.id = u.reservation_id
      JOIN customers c ON c.id = r.customer_id
      WHERE 1=1
        ${stayStatusFilterSql}
      ORDER BY u.created_at ASC
      ${paginationSql};
    `

    // 3. Fetch room numbers for the returned items
    const reservationIds = Array.from(new Set(itemRows.map((r) => r.reservation_id)))
    const reservationRooms =
      reservationIds.length > 0
        ? await prisma.reservationRoom.findMany({
            where: { reservationId: { in: reservationIds } },
            select: { reservationId: true, room: { select: { roomNo: true } } },
          })
        : []

    const roomMap = new Map<string, string[]>()
    for (const rr of reservationRooms) {
      const list = roomMap.get(rr.reservationId) || []
      list.push(rr.room.roomNo)
      roomMap.set(rr.reservationId, list)
    }

    const items: ReceivableItemDTO[] = itemRows.map((r) => ({
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number,
      reservationId: r.reservation_id,
      reservationNo: r.reservation_no,
      customerId: r.customer_id,
      guestName: `${r.first_name} ${r.last_name || ""}`.trim(),
      guestPhone: r.phone || null,
      guestEmail: r.email || null,
      roomNumbers: roomMap.get(r.reservation_id) || [],
      reservationStatus: r.reservation_status,
      isGuestInHouse: r.is_guest_in_house,
      guestStayStatus: r.stay_status,
      issueDate:
        r.issue_date instanceof Date
          ? r.issue_date.toISOString().split("T")[0]!
          : String(r.issue_date).split("T")[0]!,
      grandTotal: Number(r.grand_total).toFixed(2),
      totalPaid: Number(r.total_paid).toFixed(2),
      balanceDue: Number(r.balance_due).toFixed(2),
      daysAging: Number(r.days_aging),
      agingBucket: r.aging_bucket,
    }))

    return {
      asOfDate: todayStr,
      totalReceivables: Number(sum.total_receivables).toFixed(2),
      totalInvoices: sum.total_invoices,
      inHouseReceivables: Number(sum.in_house_receivables).toFixed(2),
      inHouseCount: sum.in_house_count,
      futureReceivables: Number(sum.future_receivables).toFixed(2),
      futureCount: sum.future_count,
      departedReceivables: Number(sum.departed_receivables).toFixed(2),
      departedCount: sum.departed_count,
      agingSummary: {
        bucket0to7: Number(sum.bucket_0_to_7).toFixed(2),
        bucket8to30: Number(sum.bucket_8_to_30).toFixed(2),
        bucket31to60: Number(sum.bucket_31_to_60).toFixed(2),
        bucket60Plus: Number(sum.bucket_60_plus).toFixed(2),
      },
      items,
      ...(limit
        ? {
            pagination: {
              page,
              limit,
              total: totalForFilter,
              totalPages: Math.ceil(totalForFilter / limit) || 1,
            },
          }
        : {}),
    }
  }

  /**
   * Generates an itemized report of invoice discounts and room rate overrides (ADV-BIL-02).
   */
  static async getDiscountsReport(filters: Partial<ReportFilterDTO> = {}): Promise<DiscountsReportDTO> {
    const { startDate, endDate, propertyId } = filters

    // 1. Fetch invoices with discounts (discountTotal > 0 or items with itemType: DISCOUNT)
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      status: { not: InvoiceStatus.VOID },
      OR: [
        { discountTotal: { gt: 0 } },
        { items: { some: { itemType: InvoiceItemType.DISCOUNT } } },
      ],
    }

    if (propertyId) {
      invoiceWhere.propertyId = propertyId
    }

    if (startDate || endDate) {
      invoiceWhere.createdAt = {}
      if (startDate) {
        invoiceWhere.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`)
      }
      if (endDate) {
        invoiceWhere.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`)
      }
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        reservation: {
          include: { customer: true },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    })

    let totalInvoiceDiscountsDec = new Prisma.Decimal(0)
    const invoiceDiscounts: InvoiceDiscountItemDTO[] = []

    for (const inv of invoices) {
      const discountItems = inv.items.filter((i) => i.itemType === InvoiceItemType.DISCOUNT)
      let invDiscountDec = new Prisma.Decimal(inv.discountTotal)
      if (invDiscountDec.isZero() && discountItems.length > 0) {
        invDiscountDec = discountItems.reduce((sum, item) => sum.add(item.lineTotal.abs()), new Prisma.Decimal(0))
      }

      totalInvoiceDiscountsDec = totalInvoiceDiscountsDec.add(invDiscountDec)

      invoiceDiscounts.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        reservationId: inv.reservationId,
        reservationNo: inv.reservation.reservationNo,
        customerName: `${inv.reservation.customer.firstName} ${inv.reservation.customer.lastName || ""}`.trim(),
        discountTotal: invDiscountDec.toFixed(2),
        items: discountItems.map((item) => ({
          description: item.description,
          unitPrice: item.unitPrice.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })),
        createdAt: inv.createdAt.toISOString(),
      })
    }

    // 2. Fetch room allocations where bookedNightlyRate < category.basePrice
    const allocWhere: Prisma.ReservationRoomWhereInput = {
      status: { not: AllocationStatus.CANCELLED },
    }

    if (propertyId) {
      allocWhere.room = { propertyId }
    }

    if (startDate || endDate) {
      if (startDate) {
        allocWhere.arrivalDate = { gte: new Date(`${startDate}T00:00:00.000Z`) }
      }
      if (endDate) {
        allocWhere.departureDate = { lte: new Date(`${endDate}T23:59:59.999Z`) }
      }
    }

    const allocations = await prisma.reservationRoom.findMany({
      where: allocWhere,
      include: {
        room: true,
        roomCategory: true,
        reservation: {
          include: { customer: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    let totalRateOverrideDiscountsDec = new Prisma.Decimal(0)
    const rateOverrides: RateOverrideItemDTO[] = []

    for (const alloc of allocations) {
      const basePriceDec = new Prisma.Decimal(alloc.roomCategory.basePrice)
      const bookedRateDec = new Prisma.Decimal(alloc.bookedNightlyRate)

      if (bookedRateDec.lessThan(basePriceDec)) {
        const varianceDec = basePriceDec.minus(bookedRateDec)
        const nights = Math.max(
          1,
          Math.round((alloc.departureDate.getTime() - alloc.arrivalDate.getTime()) / (1000 * 60 * 60 * 24))
        )
        const totalVarianceDec = varianceDec.mul(nights)

        totalRateOverrideDiscountsDec = totalRateOverrideDiscountsDec.add(totalVarianceDec)

        rateOverrides.push({
          reservationId: alloc.reservationId,
          reservationNo: alloc.reservation.reservationNo,
          allocationId: alloc.id,
          roomNo: alloc.room.roomNo,
          categoryName: alloc.roomCategory.name,
          basePrice: basePriceDec.toFixed(2),
          bookedRate: bookedRateDec.toFixed(2),
          rateVariance: varianceDec.toFixed(2),
          nights,
          totalVariance: totalVarianceDec.toFixed(2),
          arrivalDate: alloc.arrivalDate.toISOString().split("T")[0]!,
          departureDate: alloc.departureDate.toISOString().split("T")[0]!,
        })
      }
    }

    const totalConcessionDec = totalInvoiceDiscountsDec.add(totalRateOverrideDiscountsDec)

    return {
      summary: {
        totalInvoiceDiscounts: totalInvoiceDiscountsDec.toFixed(2),
        totalRateOverrideDiscounts: totalRateOverrideDiscountsDec.toFixed(2),
        totalConcessionImpact: totalConcessionDec.toFixed(2),
        discountedInvoicesCount: invoiceDiscounts.length,
        rateOverridesCount: rateOverrides.length,
      },
      invoiceDiscounts,
      rateOverrides,
    }
  }
}
