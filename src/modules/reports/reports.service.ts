import { Prisma, ReservationStatus, AllocationStatus, InvoiceStatus, PaymentStatus, InvoiceItemType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type {
  ReportFilterDTO,
  OccupancyReportDTO,
  DailyOccupancyDTO,
  RevenueReportDTO,
  PaymentMethodBreakdownDTO,
  ChargeTypeBreakdownDTO,
  DailyRevenueDTO,
  ReservationStatusReportDTO,
  ReservationStatusCountDTO,
} from "./reports.types"

export class ReportsService {
  /**
   * Generates a date-range historical occupancy report based on physical room inventory
   * and half-open active room allocation intervals [arrivalDate, departureDate).
   * Excludes cancelled allocations.
   * Formula: Occupancy Rate = (Occupied Room Nights / Available Room Nights) * 100
   */
  static async getOccupancyReport(filters: ReportFilterDTO): Promise<OccupancyReportDTO> {
    const { startDate, endDate, propertyId } = filters

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T00:00:00.000Z`)

    // 1. Get total physical rooms in inventory (scoped to property if specified)
    const roomWhere: Prisma.RoomWhereInput = {}
    if (propertyId) {
      roomWhere.propertyId = propertyId
    }
    const totalRooms = await prisma.room.count({ where: roomWhere })

    // 2. Fetch all allocations that overlap with the date range [startObj, endObj + 1 day)
    // Overlap condition: arrivalDate < (endObj + 1 day) AND departureDate > startObj
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
      select: {
        id: true,
        roomId: true,
        arrivalDate: true,
        departureDate: true,
      },
    })

    // 3. Generate daily breakdown
    const dailyBreakdown: DailyOccupancyDTO[] = []
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    let currentCursor = new Date(startObj.getTime())
    let totalOccupiedNights = 0

    while (currentCursor.getTime() <= endObj.getTime()) {
      const curIsoDate = currentCursor.toISOString().split("T")[0]
      const curTime = currentCursor.getTime()
      const nextTime = curTime + 24 * 60 * 60 * 1000

      // An allocation occupies a room on night `curTime` if arrivalDate <= curTime AND departureDate > curTime
      const occupiedRoomIds = new Set<string>()
      for (const alloc of allocations) {
        const arrTime = alloc.arrivalDate.getTime()
        const depTime = alloc.departureDate.getTime()
        if (arrTime <= curTime && depTime > curTime) {
          occupiedRoomIds.add(alloc.roomId)
        }
      }

      const occupiedRooms = Math.min(totalRooms, occupiedRoomIds.size)
      const availableRooms = Math.max(0, totalRooms - occupiedRooms)
      const dayRate =
        totalRooms > 0
          ? Math.round((occupiedRooms / totalRooms) * 10000) / 100
          : 0

      totalOccupiedNights += occupiedRooms

      dailyBreakdown.push({
        date: curIsoDate,
        dayOfWeek: dayNames[currentCursor.getUTCDay()],
        totalRooms,
        occupiedRooms,
        availableRooms,
        occupancyRate: dayRate,
      })

      currentCursor = new Date(nextTime)
    }

    const totalDays = dailyBreakdown.length
    const totalAvailableRoomNights = totalRooms * totalDays
    const overallRate =
      totalAvailableRoomNights > 0
        ? Math.round((totalOccupiedNights / totalAvailableRoomNights) * 10000) / 100
        : 0

    const averageDailyOccupancy =
      totalDays > 0 ? Math.round((totalOccupiedNights / totalDays) * 10) / 10 : 0

    return {
      startDate,
      endDate,
      totalDays,
      totalRooms,
      totalAvailableRoomNights,
      totalOccupiedRoomNights: totalOccupiedNights,
      occupancyRate: overallRate,
      averageDailyOccupancy,
      dailyBreakdown,
    }
  }

  /**
   * Generates a date-range revenue vs. collections report distinguishing
   * invoiced amounts from money actually recorded and collected.
   */
  static async getRevenueReport(filters: ReportFilterDTO): Promise<RevenueReportDTO> {
    const { startDate, endDate, propertyId } = filters

    const rangeStart = new Date(`${startDate}T00:00:00.000Z`)
    const rangeEnd = new Date(`${endDate}T23:59:59.999Z`)

    // 1. Fetch Invoices created/issued in date range
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      createdAt: { gte: rangeStart, lte: rangeEnd },
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
      paidAt: { gte: rangeStart, lte: rangeEnd },
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
      const balance = Prisma.Decimal.max(new Prisma.Decimal(0), inv.grandTotal.sub(invPaid))
      totalOutstandingDec = totalOutstandingDec.add(balance)
    }

    // 6. Build Method & Charge Type Breakdown Arrays
    const paymentMethodBreakdown: PaymentMethodBreakdownDTO[] = []
    const totalCollectedNum = totalCollectedDec.toNumber()

    for (const [method, data] of methodMap.entries()) {
      const amtNum = data.amount.toNumber()
      paymentMethodBreakdown.push({
        method,
        amount: data.amount.toFixed(2),
        count: data.count,
        percentage:
          totalCollectedNum > 0
            ? Math.round((amtNum / totalCollectedNum) * 1000) / 10
            : 0,
      })
    }
    paymentMethodBreakdown.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))

    const chargeTypeBreakdown: ChargeTypeBreakdownDTO[] = []
    const totalInvoicedNum = totalInvoicedDec.toNumber()

    for (const [itemType, data] of chargeTypeMap.entries()) {
      const amtNum = data.amount.toNumber()
      chargeTypeBreakdown.push({
        itemType,
        amount: data.amount.toFixed(2),
        count: data.count,
        percentage:
          totalInvoicedNum > 0
            ? Math.round((amtNum / totalInvoicedNum) * 1000) / 10
            : 0,
      })
    }
    chargeTypeBreakdown.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))

    // 7. Daily Breakdown of Invoiced vs. Collected
    const dailyMap = new Map<string, { invoiced: Prisma.Decimal; collected: Prisma.Decimal }>()

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T00:00:00.000Z`)
    let cur = new Date(startObj.getTime())

    while (cur.getTime() <= endObj.getTime()) {
      const iso = cur.toISOString().split("T")[0]
      dailyMap.set(iso, {
        invoiced: new Prisma.Decimal(0),
        collected: new Prisma.Decimal(0),
      })
      cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000)
    }

    for (const inv of invoices) {
      const d = inv.createdAt.toISOString().split("T")[0]
      const entry = dailyMap.get(d)
      if (entry) {
        entry.invoiced = entry.invoiced.add(inv.grandTotal)
      }
    }

    for (const p of payments) {
      const d = p.paidAt.toISOString().split("T")[0]
      const entry = dailyMap.get(d)
      if (entry) {
        entry.collected = entry.collected.add(p.amount)
      }
    }

    const dailyBreakdown: DailyRevenueDTO[] = Array.from(dailyMap.entries()).map(
      ([date, data]) => ({
        date,
        invoicedAmount: data.invoiced.toFixed(2),
        collectedAmount: data.collected.toFixed(2),
      })
    )

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
   * Generates a date-range report breaking down reservations by actual status
   * (CONFIRMED, COMPLETED, CANCELLED) with average stay length and conversion rates.
   */
  static async getReservationStatusReport(
    filters: ReportFilterDTO
  ): Promise<ReservationStatusReportDTO> {
    const { startDate, endDate, propertyId } = filters

    const rangeStart = new Date(`${startDate}T00:00:00.000Z`)
    const rangeEnd = new Date(`${endDate}T23:59:59.999Z`)

    const resWhere: Prisma.ReservationWhereInput = {
      createdAt: { gte: rangeStart, lte: rangeEnd },
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
      totalAllocations += res.rooms.length
      const group = statusMap.get(res.status)!
      group.count += 1

      for (const room of res.rooms) {
        const diffMs = room.departureDate.getTime() - room.arrivalDate.getTime()
        const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)))
        totalStayNights += nights
        group.roomNights += nights

        const rate = new Prisma.Decimal(room.bookedNightlyRate.toString())
        group.totalValue = group.totalValue.add(rate.mul(nights))
      }
    }

    const statusBreakdown: ReservationStatusCountDTO[] = []
    for (const [status, data] of statusMap.entries()) {
      statusBreakdown.push({
        status,
        count: data.count,
        percentage:
          totalReservations > 0
            ? Math.round((data.count / totalReservations) * 1000) / 10
            : 0,
        roomNights: data.roomNights,
        totalValue: data.totalValue.toFixed(2),
      })
    }

    const cancelledData = statusMap.get(ReservationStatus.CANCELLED)
    const completedData = statusMap.get(ReservationStatus.COMPLETED)

    const cancellationRate =
      totalReservations > 0
        ? Math.round(((cancelledData?.count || 0) / totalReservations) * 1000) / 10
        : 0

    const completionRate =
      totalReservations > 0
        ? Math.round(((completedData?.count || 0) / totalReservations) * 1000) / 10
        : 0

    const averageLengthOfStay =
      totalReservations > 0
        ? Math.round((totalStayNights / totalReservations) * 10) / 10
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
}
