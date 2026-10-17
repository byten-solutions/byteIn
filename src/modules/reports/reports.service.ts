import {
  Prisma,
  ReservationStatus,
  AllocationStatus,
  InvoiceStatus,
  PaymentStatus,
  InvoiceItemType,
  RoomStatus,
} from "@prisma/client"
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
      invoiceWhere.reservation = {
        rooms: {
          some: {
            room: { propertyId },
          },
        },
      }
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
      paymentWhere.invoice = {
        reservation: {
          rooms: {
            some: {
              room: { propertyId },
            },
          },
        },
      }
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
      resWhere.rooms = {
        some: {
          room: { propertyId },
        },
      }
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
  static async getDailyOperations(
    targetDateStr?: string,
    propertyId?: string
  ): Promise<DailyOperationsReportDTO> {
    const dateStr = targetDateStr || getHotelTodayDate()
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`)
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)

    const baseWhere: Prisma.ReservationRoomWhereInput = {}
    if (propertyId) {
      baseWhere.room = { propertyId }
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

  /**
   * Generates Room Availability Grid / Tape Chart (Date-by-Room matrix)
   * Shows booked slots with guest names and links, vacant rooms, and maintenance blocks.
   */
  static async getAvailabilityGrid(
    startDateStr: string,
    endDateStr: string,
    propertyId?: string
  ): Promise<AvailabilityGridDTO> {
    const startObj = new Date(`${startDateStr}T00:00:00.000Z`)
    const endObj = new Date(`${endDateStr}T00:00:00.000Z`)

    const numDays =
      Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const dates: string[] = []
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startObj.getTime() + i * 24 * 60 * 60 * 1000)
      dates.push(d.toISOString().split("T")[0]!)
    }

    // 1. Fetch physical rooms
    const roomWhere: Prisma.RoomWhereInput = {}
    if (propertyId) {
      roomWhere.propertyId = propertyId
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
    })

    // 2. Fetch overlapping allocations in window
    const nextDayAfterEnd = new Date(endObj.getTime() + 24 * 60 * 60 * 1000)
    const allocations = await prisma.reservationRoom.findMany({
      where: {
        status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN] },
        arrivalDate: { lt: nextDayAfterEnd },
        departureDate: { gt: startObj },
        reservation: { status: { not: ReservationStatus.CANCELLED } },
        ...(propertyId ? { room: { propertyId } } : {}),
      },
      include: {
        reservation: {
          include: { customer: true },
        },
      },
    })

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
      paidAt: { gte: startObj, lte: endObj },
      status: PaymentStatus.RECORDED,
    }

    if (staffUserId) {
      paymentWhere.createdBy = staffUserId
    }

    if (propertyId) {
      paymentWhere.invoice = {
        reservation: {
          rooms: {
            some: {
              room: { propertyId },
            },
          },
        },
      }
    }

    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      include: {
        creator: true,
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
      totalCollectedDec = totalCollectedDec.add(p.amount)

      // 1. Payment Method aggregation
      const mExisting = methodMap.get(p.paymentMethod) || {
        amount: new Prisma.Decimal(0),
        count: 0,
      }
      mExisting.amount = mExisting.amount.add(p.amount)
      mExisting.count++
      methodMap.set(p.paymentMethod, mExisting)

      // 2. Staff user aggregation
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
      const curMethodAmount = sExisting.methods[p.paymentMethod] || new Prisma.Decimal(0)
      sExisting.methods[p.paymentMethod] = curMethodAmount.add(p.amount)
      staffMap.set(uId, sExisting)

      // 3. Transaction list item
      const customer = p.invoice.reservation?.customer
      const guestName = customer ? `${customer.firstName} ${customer.lastName}` : "Direct Folio"
      const roomNos = p.invoice.reservation?.rooms?.map((r) => r.room.roomNo) || []

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
    filterOption: "all" | "in_house" | "future" | "departed" = "all"
  ): Promise<ReceivablesReportDTO> {
    const todayStr = getHotelTodayDate()
    const now = new Date()

    const invoiceWhere: Prisma.InvoiceWhereInput = {
      status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
    }

    if (propertyId) {
      invoiceWhere.reservation = {
        rooms: {
          some: {
            room: { propertyId },
          },
        },
      }
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        payments: {
          where: { status: PaymentStatus.RECORDED },
        },
        reservation: {
          include: {
            customer: true,
            rooms: {
              include: { room: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    })

    let totalReceivablesDec = new Prisma.Decimal(0)
    let inHouseReceivablesDec = new Prisma.Decimal(0)
    let futureReceivablesDec = new Prisma.Decimal(0)
    let departedReceivablesDec = new Prisma.Decimal(0)

    let inHouseCount = 0
    let futureCount = 0
    let departedCount = 0

    let b0to7 = new Prisma.Decimal(0)
    let b8to30 = new Prisma.Decimal(0)
    let b31to60 = new Prisma.Decimal(0)
    let b60Plus = new Prisma.Decimal(0)

    const items: ReceivableItemDTO[] = []

    for (const inv of invoices) {
      if (!inv.reservation) continue

      const totalPaidDec = inv.payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      )
      const balanceDec = inv.grandTotal.sub(totalPaidDec)

      if (balanceDec.lte(0)) continue

      totalReceivablesDec = totalReceivablesDec.add(balanceDec)

      const rooms = inv.reservation.rooms
      const isInHouse = rooms.some((r) => r.status === AllocationStatus.CHECKED_IN)
      const isFuture = !isInHouse && rooms.some((r) => r.status === AllocationStatus.CONFIRMED)

      const guestStayStatus: "IN_HOUSE" | "FUTURE" | "DEPARTED" = isInHouse
        ? "IN_HOUSE"
        : isFuture
        ? "FUTURE"
        : "DEPARTED"

      if (guestStayStatus === "IN_HOUSE") {
        inHouseCount++
        inHouseReceivablesDec = inHouseReceivablesDec.add(balanceDec)
      } else if (guestStayStatus === "FUTURE") {
        futureCount++
        futureReceivablesDec = futureReceivablesDec.add(balanceDec)
      } else {
        departedCount++
        departedReceivablesDec = departedReceivablesDec.add(balanceDec)
      }

      // Calculate days aging since invoice creation
      const daysAging = Math.max(
        0,
        Math.floor((now.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      )

      let bucket: "0-7" | "8-30" | "31-60" | "60+" = "0-7"
      if (daysAging <= 7) {
        bucket = "0-7"
        b0to7 = b0to7.add(balanceDec)
      } else if (daysAging <= 30) {
        bucket = "8-30"
        b8to30 = b8to30.add(balanceDec)
      } else if (daysAging <= 60) {
        bucket = "31-60"
        b31to60 = b31to60.add(balanceDec)
      } else {
        bucket = "60+"
        b60Plus = b60Plus.add(balanceDec)
      }

      // Filter check
      if (filterOption === "in_house" && guestStayStatus !== "IN_HOUSE") continue
      if (filterOption === "future" && guestStayStatus !== "FUTURE") continue
      if (filterOption === "departed" && guestStayStatus !== "DEPARTED") continue

      const cust = inv.reservation.customer
      const roomNos = inv.reservation.rooms.map((r) => r.room.roomNo)

      items.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        reservationId: inv.reservationId,
        reservationNo: inv.reservation.reservationNo,
        customerId: inv.reservation.customerId,
        guestName: `${cust.firstName} ${cust.lastName || ""}`.trim(),
        guestPhone: cust.phone || null,
        guestEmail: cust.email || null,
        roomNumbers: roomNos,
        reservationStatus: inv.reservation.status,
        isGuestInHouse: isInHouse,
        guestStayStatus,
        issueDate: inv.createdAt.toISOString().split("T")[0]!,
        grandTotal: inv.grandTotal.toFixed(2),
        totalPaid: totalPaidDec.toFixed(2),
        balanceDue: balanceDec.toFixed(2),
        daysAging,
        agingBucket: bucket,
      })
    }

    return {
      asOfDate: todayStr,
      totalReceivables: totalReceivablesDec.toFixed(2),
      totalInvoices: items.length,
      inHouseReceivables: inHouseReceivablesDec.toFixed(2),
      inHouseCount,
      futureReceivables: futureReceivablesDec.toFixed(2),
      futureCount,
      departedReceivables: departedReceivablesDec.toFixed(2),
      departedCount,
      agingSummary: {
        bucket0to7: b0to7.toFixed(2),
        bucket8to30: b8to30.toFixed(2),
        bucket31to60: b31to60.toFixed(2),
        bucket60Plus: b60Plus.toFixed(2),
      },
      items,
    }
  }
}
