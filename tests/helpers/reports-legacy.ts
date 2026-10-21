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
import { BadRequestError } from "@/lib/errors"
import type {
  ReportFilterDTO,
  OccupancyReportDTO,
  DailyOccupancyDTO,
  CategoryPerformanceDTO,
  PropertyBreakdownDTO,
  RevenueReportDTO,
  PaymentMethodBreakdownDTO,
  ChargeTypeBreakdownDTO,
  DailyRevenueDTO,
  ReservationStatusReportDTO,
  ReservationStatusCountDTO,
  DailyOperationsReportDTO,
  DailyOperationsCountsDTO,
  DailyOperationsListDTO,
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
} from "@/modules/reports/reports.types"
import { getHotelTodayDate, getHotelTodayDateUtc } from "@/lib/date"

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

    const s = new Date(`${startDate}T00:00:00.000Z`).getTime()
    const e = new Date(`${endDate}T00:00:00.000Z`).getTime()
    if (e < s) {
      throw new BadRequestError("endDate must be on or after startDate")
    }
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24))
    if (diffDays > 366) {
      throw new BadRequestError("Date range cannot exceed 366 days")
    }

    const totalDays = diffDays + 1
    const todayUtcStr = getHotelTodayDateUtc().toISOString().split("T")[0]!
    const propertyFilterSql = propertyId ? Prisma.sql`AND rm.property_id = ${propertyId}` : Prisma.empty

    // 1. Total physical rooms
    const roomCountRows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int as count FROM rooms rm WHERE 1=1 ${propertyFilterSql};
    `
    const totalRooms = roomCountRows[0]?.count ?? 0
    const totalAvailableRoomNights = totalRooms * totalDays

    // 2. Daily breakdown using CTE + lateral generate_series
    const dayRows = await prisma.$queryRaw<Array<{
      day: Date
      day_of_week: string
      occupied_rooms: number
      room_revenue: Prisma.Decimal
      otb_rooms: number
      otb_revenue: Prisma.Decimal
    }>>`
      WITH daily_alloc AS (
        SELECT
          d.dt::date as day,
          COUNT(DISTINCT rr.room_id) FILTER (WHERE (
            rr.status IN ('CHECKED_IN', 'CHECKED_OUT')
            OR (rr.status = 'CONFIRMED' AND d.dt::date >= ${todayUtcStr}::date)
          ))::int as occupied_rooms,
          COALESCE(SUM(rr.booked_nightly_rate) FILTER (WHERE (
            rr.status IN ('CHECKED_IN', 'CHECKED_OUT')
            OR (rr.status = 'CONFIRMED' AND d.dt::date >= ${todayUtcStr}::date)
          )), 0) as room_revenue,
          COUNT(DISTINCT rr.room_id) FILTER (WHERE rr.status = 'CONFIRMED' AND d.dt::date >= ${todayUtcStr}::date)::int as otb_rooms,
          COALESCE(SUM(rr.booked_nightly_rate) FILTER (WHERE rr.status = 'CONFIRMED' AND d.dt::date >= ${todayUtcStr}::date), 0) as otb_revenue
        FROM reservation_rooms rr
        JOIN rooms rm ON rm.id = rr.room_id ${propertyFilterSql}
        CROSS JOIN LATERAL generate_series(
          GREATEST(rr.arrival_date, ${startDate}::date),
          LEAST(COALESCE(rr.actual_checkout_date, rr.departure_date) - 1, ${endDate}::date),
          '1 day'::interval
        ) d(dt)
        WHERE rr.arrival_date <= ${endDate}::date
          AND COALESCE(rr.actual_checkout_date, rr.departure_date) > ${startDate}::date
          AND rr.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
        GROUP BY d.dt::date
      )
      SELECT
        cal.dt::date as day,
        to_char(cal.dt::date, 'FMDay') as day_of_week,
        COALESCE(da.occupied_rooms, 0)::int as occupied_rooms,
        COALESCE(da.room_revenue, 0) as room_revenue,
        COALESCE(da.otb_rooms, 0)::int as otb_rooms,
        COALESCE(da.otb_revenue, 0) as otb_revenue
      FROM generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) cal(dt)
      LEFT JOIN daily_alloc da ON da.day = cal.dt::date
      ORDER BY cal.dt::date ASC;
    `

    let totalOccupiedRoomNights = 0
    let totalRoomRevenueDec = new Prisma.Decimal(0)
    let totalOtbRoomNights = 0
    let totalOtbRevenueDec = new Prisma.Decimal(0)

    const dailyBreakdown: DailyOccupancyDTO[] = dayRows.map((row) => {
      const dateStr = row.day instanceof Date ? row.day.toISOString().split("T")[0]! : String(row.day).slice(0, 10)
      const occRooms = row.occupied_rooms || 0
      const revDec = new Prisma.Decimal(row.room_revenue)
      const otbRooms = row.otb_rooms || 0
      const otbRevDec = new Prisma.Decimal(row.otb_revenue)

      totalOccupiedRoomNights += occRooms
      totalRoomRevenueDec = totalRoomRevenueDec.add(revDec)
      totalOtbRoomNights += otbRooms
      totalOtbRevenueDec = totalOtbRevenueDec.add(otbRevDec)

      const occRate = totalRooms > 0 ? Math.round((occRooms / totalRooms) * 1000) / 10 : 0
      const adr = occRooms > 0 ? revDec.div(occRooms).toFixed(2) : "0.00"
      const revpar = totalRooms > 0 ? revDec.div(totalRooms).toFixed(2) : "0.00"

      return {
        date: dateStr,
        dayOfWeek: row.day_of_week.trim(),
        totalRooms,
        occupiedRooms: occRooms,
        availableRooms: Math.max(0, totalRooms - occRooms),
        occupancyRate: occRate,
        roomRevenue: revDec.toFixed(2),
        adr,
        revpar,
        otbRooms,
        otbRevenue: otbRevDec.toFixed(2),
      }
    })

    // 3. Category breakdown
    const catRows = await prisma.$queryRaw<Array<{
      category_id: string
      category_name: string
      total_rooms: number
      occupied_nights: number
      room_revenue: Prisma.Decimal
    }>>`
      SELECT
        rc.id as category_id,
        rc.name as category_name,
        COUNT(DISTINCT rm.id)::int as total_rooms,
        COALESCE(SUM(
          GREATEST(0,
            LEAST(COALESCE(rr.actual_checkout_date, rr.departure_date), (${endDate}::date + 1))
            - GREATEST(rr.arrival_date, ${startDate}::date)
          )
        ), 0)::int as occupied_nights,
        COALESCE(SUM(
          GREATEST(0,
            LEAST(COALESCE(rr.actual_checkout_date, rr.departure_date), (${endDate}::date + 1))
            - GREATEST(rr.arrival_date, ${startDate}::date)
          ) * rr.booked_nightly_rate
        ), 0) as room_revenue
      FROM room_categories rc
      JOIN rooms rm ON rm.room_category_id = rc.id ${propertyFilterSql}
      LEFT JOIN reservation_rooms rr ON rr.room_id = rm.id
        AND rr.arrival_date < (${endDate}::date + 1)
        AND COALESCE(rr.actual_checkout_date, rr.departure_date) > ${startDate}::date
        AND (
          rr.status IN ('CHECKED_IN', 'CHECKED_OUT')
          OR (rr.status = 'CONFIRMED' AND COALESCE(rr.actual_checkout_date, rr.departure_date) > ${todayUtcStr}::date)
        )
      GROUP BY rc.id, rc.name
      ORDER BY rc.name ASC;
    `

    const categoryBreakdown: CategoryPerformanceDTO[] = catRows.map((cat) => {
      const cRooms = cat.total_rooms || 0
      const cAvailNights = cRooms * totalDays
      const cOccNights = cat.occupied_nights || 0
      const cRevDec = new Prisma.Decimal(cat.room_revenue)
      const cOccRate = cAvailNights > 0 ? Math.round((cOccNights / cAvailNights) * 1000) / 10 : 0
      const cAdr = cOccNights > 0 ? cRevDec.div(cOccNights).toFixed(2) : "0.00"
      const cRevpar = cAvailNights > 0 ? cRevDec.div(cAvailNights).toFixed(2) : "0.00"

      return {
        categoryId: cat.category_id,
        categoryName: cat.category_name,
        totalRooms: cRooms,
        availableRoomNights: cAvailNights,
        occupiedRoomNights: cOccNights,
        occupancyRate: cOccRate,
        roomRevenue: cRevDec.toFixed(2),
        adr: cAdr,
        revpar: cRevpar,
      }
    })

    // 4. Property breakdown for SUPER_ADMIN when no propertyId
    let propertyBreakdown: PropertyBreakdownDTO[] | undefined
    if (!propertyId) {
      const propRows = await prisma.$queryRaw<Array<{
        property_id: string
        property_name: string
        total_rooms: number
        occupied_nights: number
        room_revenue: Prisma.Decimal
      }>>`
        SELECT
          p.id as property_id,
          p.name as property_name,
          COUNT(DISTINCT rm.id)::int as total_rooms,
          COALESCE(SUM(
            GREATEST(0,
              LEAST(COALESCE(rr.actual_checkout_date, rr.departure_date), (${endDate}::date + 1))
              - GREATEST(rr.arrival_date, ${startDate}::date)
            )
          ), 0)::int as occupied_nights,
          COALESCE(SUM(
            GREATEST(0,
              LEAST(COALESCE(rr.actual_checkout_date, rr.departure_date), (${endDate}::date + 1))
              - GREATEST(rr.arrival_date, ${startDate}::date)
            ) * rr.booked_nightly_rate
          ), 0) as room_revenue
        FROM properties p
        JOIN rooms rm ON rm.property_id = p.id
        LEFT JOIN reservation_rooms rr ON rr.room_id = rm.id
          AND rr.arrival_date < (${endDate}::date + 1)
          AND COALESCE(rr.actual_checkout_date, rr.departure_date) > ${startDate}::date
          AND (
            rr.status IN ('CHECKED_IN', 'CHECKED_OUT')
            OR (rr.status = 'CONFIRMED' AND COALESCE(rr.actual_checkout_date, rr.departure_date) > ${todayUtcStr}::date)
          )
        GROUP BY p.id, p.name
        ORDER BY p.name ASC;
      `
      propertyBreakdown = propRows.map((pr) => {
        const pRooms = pr.total_rooms || 0
        const pAvail = pRooms * totalDays
        const pOcc = pr.occupied_nights || 0
        const pRevDec = new Prisma.Decimal(pr.room_revenue)
        return {
          propertyId: pr.property_id,
          propertyName: pr.property_name,
          totalRooms: pRooms,
          occupiedRoomNights: pOcc,
          occupancyRate: pAvail > 0 ? Math.round((pOcc / pAvail) * 1000) / 10 : 0,
          totalRevenue: pRevDec.toFixed(2),
        }
      })
    }

    const overallOccupancyRate = totalAvailableRoomNights > 0
      ? Math.round((totalOccupiedRoomNights / totalAvailableRoomNights) * 1000) / 10
      : 0
    const averageDailyOccupancy = totalDays > 0
      ? Math.round((totalOccupiedRoomNights / totalDays) * 10) / 10
      : 0
    const adr = totalOccupiedRoomNights > 0
      ? totalRoomRevenueDec.div(totalOccupiedRoomNights).toFixed(2)
      : "0.00"
    const revpar = totalAvailableRoomNights > 0
      ? totalRoomRevenueDec.div(totalAvailableRoomNights).toFixed(2)
      : "0.00"

    return {
      startDate,
      endDate,
      totalDays,
      totalRooms,
      totalAvailableRoomNights,
      totalOccupiedRoomNights,
      occupancyRate: overallOccupancyRate,
      averageDailyOccupancy,
      totalRoomRevenue: totalRoomRevenueDec.toFixed(2),
      adr,
      revpar,
      totalOtbRoomNights,
      totalOtbRevenue: totalOtbRevenueDec.toFixed(2),
      dailyBreakdown,
      categoryBreakdown,
      ...(propertyBreakdown ? { propertyBreakdown } : {}),
    }
  }

  static async getRevenueReport(filters: ReportFilterDTO): Promise<RevenueReportDTO> {
    const { startDate, endDate, propertyId } = filters

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)
    const diffDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 366) {
      throw new BadRequestError("Date range cannot exceed 366 days")
    }

    const invPropertySql = propertyId ? Prisma.sql`AND property_id = ${propertyId}` : Prisma.empty
    const invJoinPropertySql = propertyId ? Prisma.sql`AND inv.property_id = ${propertyId}` : Prisma.empty
    const payPropertySql = propertyId ? Prisma.sql`AND property_id = ${propertyId}` : Prisma.empty

    // 1. Invoices aggregate
    const invAgg = await prisma.$queryRaw<Array<{
      invoice_count: number
      total_invoiced: Prisma.Decimal
      tax_total: Prisma.Decimal
      discount_total: Prisma.Decimal
    }>>`
      SELECT
        COUNT(*)::int as invoice_count,
        COALESCE(SUM(grand_total), 0) as total_invoiced,
        COALESCE(SUM(tax_total), 0) as tax_total,
        COALESCE(SUM(discount_total), 0) as discount_total
      FROM invoices
      WHERE created_at >= ${startObj} AND created_at <= ${endObj}
        AND status <> 'VOID'
        ${invPropertySql};
    `
    const totalInvoicedDec = new Prisma.Decimal(invAgg[0]?.total_invoiced ?? 0)
    const taxTotalDec = new Prisma.Decimal(invAgg[0]?.tax_total ?? 0)
    const discountTotalDec = new Prisma.Decimal(invAgg[0]?.discount_total ?? 0)
    const invoiceCount = invAgg[0]?.invoice_count ?? 0

    // 2. Payments aggregate
    const payAgg = await prisma.$queryRaw<Array<{
      payment_count: number
      total_collected: Prisma.Decimal
    }>>`
      SELECT
        COUNT(*)::int as payment_count,
        COALESCE(SUM(amount), 0) as total_collected
      FROM payments
      WHERE paid_at >= ${startObj} AND paid_at <= ${endObj}
        AND status = 'RECORDED'
        ${payPropertySql};
    `
    const totalCollectedDec = new Prisma.Decimal(payAgg[0]?.total_collected ?? 0)
    const paymentCount = payAgg[0]?.payment_count ?? 0

    // 3. Outstanding balance on invoices in period (via LATERAL join on unpaid candidate invoices)
    const outAgg = await prisma.$queryRaw<Array<{ total_outstanding: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(
        GREATEST(0, inv.grand_total - COALESCE(p.paid, 0))
      ), 0) as total_outstanding
      FROM invoices inv
      LEFT JOIN LATERAL (
        SELECT SUM(amount) as paid
        FROM payments
        WHERE invoice_id = inv.id AND status = 'RECORDED'
      ) p ON true
      WHERE inv.created_at >= ${startObj} AND inv.created_at <= ${endObj}
        AND inv.status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID')
        ${invJoinPropertySql};
    `
    const totalOutstandingDec = new Prisma.Decimal(outAgg[0]?.total_outstanding ?? 0)

    // 4. Charge types breakdown
    const chargeRows = await prisma.$queryRaw<Array<{
      item_type: string
      count: number
      amount: Prisma.Decimal
    }>>`
      SELECT
        ii.item_type::text,
        COUNT(*)::int as count,
        COALESCE(SUM(ii.line_total), 0) as amount
      FROM invoice_items ii
      JOIN invoices inv ON inv.id = ii.invoice_id
      WHERE inv.created_at >= ${startObj} AND inv.created_at <= ${endObj}
        AND inv.status <> 'VOID'
        ${invJoinPropertySql}
      GROUP BY ii.item_type;
    `
    let roomChargesDec = new Prisma.Decimal(0)
    let extraChargesDec = new Prisma.Decimal(0)
    const chargeTypeBreakdown: ChargeTypeBreakdownDTO[] = []
    const totalSubtotal = chargeRows.reduce((sum, r) => sum.add(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0))

    for (const r of chargeRows) {
      const amt = new Prisma.Decimal(r.amount)
      if (r.item_type === InvoiceItemType.ROOM_CHARGE) {
        roomChargesDec = roomChargesDec.add(amt)
      } else {
        extraChargesDec = extraChargesDec.add(amt)
      }
      const pct = totalSubtotal.gt(0) ? amt.div(totalSubtotal).mul(100).toNumber() : 0
      chargeTypeBreakdown.push({
        itemType: r.item_type,
        amount: amt.toFixed(2),
        count: r.count,
        percentage: Math.round(pct * 10) / 10,
      })
    }

    // 5. Payment method breakdown
    const methodRows = await prisma.$queryRaw<Array<{
      payment_method: string
      count: number
      amount: Prisma.Decimal
    }>>`
      SELECT
        payment_method::text,
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0) as amount
      FROM payments
      WHERE paid_at >= ${startObj} AND paid_at <= ${endObj}
        AND status = 'RECORDED'
        ${payPropertySql}
      GROUP BY payment_method;
    `
    const paymentMethodBreakdown: PaymentMethodBreakdownDTO[] = []
    for (const m of methodRows) {
      const amt = new Prisma.Decimal(m.amount)
      const pct = totalCollectedDec.gt(0) ? amt.div(totalCollectedDec).mul(100).toNumber() : 0
      paymentMethodBreakdown.push({
        method: m.payment_method,
        amount: amt.toFixed(2),
        count: m.count,
        percentage: Math.round(pct * 10) / 10,
      })
    }

    // 6. Daily revenue breakdown
    const dailyRows = await prisma.$queryRaw<Array<{
      day_str: string
      invoiced: Prisma.Decimal
      collected: Prisma.Decimal
    }>>`
      WITH daily_inv AS (
        SELECT
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') as day_key,
          SUM(grand_total) as invoiced
        FROM invoices
        WHERE created_at >= ${startObj} AND created_at <= ${endObj}
          AND status <> 'VOID'
          ${invPropertySql}
        GROUP BY 1
      ),
      daily_pay AS (
        SELECT
          to_char(paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') as day_key,
          SUM(amount) as collected
        FROM payments
        WHERE paid_at >= ${startObj} AND paid_at <= ${endObj}
          AND status = 'RECORDED'
          ${payPropertySql}
        GROUP BY 1
      )
      SELECT
        to_char(d.dt::date, 'YYYY-MM-DD') as day_str,
        COALESCE(di.invoiced, 0) as invoiced,
        COALESCE(dp.collected, 0) as collected
      FROM generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) d(dt)
      LEFT JOIN daily_inv di ON di.day_key = to_char(d.dt::date, 'YYYY-MM-DD')
      LEFT JOIN daily_pay dp ON dp.day_key = to_char(d.dt::date, 'YYYY-MM-DD')
      ORDER BY d.dt::date ASC;
    `
    const dailyBreakdown: DailyRevenueDTO[] = dailyRows.map((dr) => ({
      date: dr.day_str,
      invoicedAmount: new Prisma.Decimal(dr.invoiced).toFixed(2),
      collectedAmount: new Prisma.Decimal(dr.collected).toFixed(2),
    }))

    // 7. Property breakdown if SUPER_ADMIN
    let propertyBreakdown: PropertyBreakdownDTO[] | undefined
    if (!propertyId) {
      const propRows = await prisma.$queryRaw<Array<{
        property_id: string
        property_name: string
        total_invoiced: Prisma.Decimal
        total_collected: Prisma.Decimal
      }>>`
        SELECT
          p.id as property_id,
          p.name as property_name,
          COALESCE(inv.total_invoiced, 0) as total_invoiced,
          COALESCE(pay.total_collected, 0) as total_collected
        FROM properties p
        LEFT JOIN (
          SELECT property_id, SUM(grand_total) as total_invoiced
          FROM invoices
          WHERE created_at >= ${startObj} AND created_at <= ${endObj}
            AND status <> 'VOID'
          GROUP BY property_id
        ) inv ON inv.property_id = p.id
        LEFT JOIN (
          SELECT property_id, SUM(amount) as total_collected
          FROM payments
          WHERE paid_at >= ${startObj} AND paid_at <= ${endObj}
            AND status = 'RECORDED'
          GROUP BY property_id
        ) pay ON pay.property_id = p.id
        ORDER BY p.name ASC;
      `
      propertyBreakdown = propRows.map((pr) => ({
        propertyId: pr.property_id,
        propertyName: pr.property_name,
        totalInvoiced: new Prisma.Decimal(pr.total_invoiced).toFixed(2),
        totalCollected: new Prisma.Decimal(pr.total_collected).toFixed(2),
      }))
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
      invoiceCount,
      paymentCount,
      paymentMethodBreakdown,
      chargeTypeBreakdown,
      dailyBreakdown,
      ...(propertyBreakdown ? { propertyBreakdown } : {}),
    }
  }

  static async getReservationStatusReport(
    filters: ReportFilterDTO
  ): Promise<ReservationStatusReportDTO> {
    const { startDate, endDate, propertyId } = filters

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)
    const diffDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 366) {
      throw new BadRequestError("Date range cannot exceed 366 days")
    }

    const propertyFilterSql = propertyId ? Prisma.sql`AND r.property_id = ${propertyId}` : Prisma.empty

    const rows = await prisma.$queryRaw<Array<{
      status: ReservationStatus
      reservation_count: number
      allocation_count: number
      room_nights: number
      total_value: Prisma.Decimal
    }>>`
      SELECT
        r.status,
        COUNT(DISTINCT r.id)::int as reservation_count,
        COUNT(rr.id)::int as allocation_count,
        COALESCE(SUM(
          GREATEST(1, COALESCE(rr.actual_checkout_date, rr.departure_date) - rr.arrival_date)
        ), 0)::int as room_nights,
        COALESCE(SUM(
          GREATEST(1, COALESCE(rr.actual_checkout_date, rr.departure_date) - rr.arrival_date) * rr.booked_nightly_rate
        ), 0) as total_value
      FROM reservations r
      LEFT JOIN reservation_rooms rr ON rr.reservation_id = r.id
      WHERE r.created_at >= ${startObj} AND r.created_at <= ${endObj}
        ${propertyFilterSql}
      GROUP BY r.status;
    `

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

    let totalReservations = 0
    let totalAllocations = 0
    let totalStayNights = 0

    for (const row of rows) {
      const entry = statusMap.get(row.status)
      if (entry) {
        entry.count = row.reservation_count
        entry.roomNights = row.room_nights
        entry.totalValue = new Prisma.Decimal(row.total_value)
      }
      totalReservations += row.reservation_count
      totalAllocations += row.allocation_count
      totalStayNights += row.room_nights
    }

    let cancelledCount = 0
    let completedCount = 0
    const statusBreakdown: ReservationStatusCountDTO[] = []

    for (const [status, data] of statusMap.entries()) {
      const pct = totalReservations > 0 ? (data.count / totalReservations) * 100 : 0
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

    const averageLengthOfStay = totalAllocations > 0
      ? Math.round((totalStayNights / totalAllocations) * 10) / 10
      : 0
    const cancellationRate = totalReservations > 0
      ? Math.round((cancelledCount / totalReservations) * 1000) / 10
      : 0
    const completionRate = totalReservations > 0
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

  public static invalidateReportsCache(propertyId?: string | null): void {
    invalidateScoped("daily-operations", propertyId)
    invalidateScoped("billing-summary", propertyId)
    invalidateScoped("receivables-summary", propertyId)
  }

  static async getDailyOperationsCounts(
    targetDateStr?: string,
    propertyId?: string
  ): Promise<DailyOperationsCountsDTO> {
    const dateStr = targetDateStr || getHotelTodayDate()

    const rows = await prisma.$queryRaw<
      Array<{
        arrivals: bigint | number
        checked_in_arrivals: bigint | number
        departures: bigint | number
        checked_out_departures: bigint | number
        in_house: bigint | number
        overdue: bigint | number
      }>
    >(Prisma.sql`
      WITH hotel_rooms AS (
        SELECT id FROM rooms
        WHERE (${propertyId ?? null}::text IS NULL OR property_id = ${propertyId ?? null})
      )
      SELECT
        COUNT(*) FILTER (
          WHERE rr.status = 'CONFIRMED'
            AND rr.arrival_date = ${dateStr}::date
        ) AS arrivals,
        COUNT(*) FILTER (
          WHERE rr.status = 'CHECKED_IN'
            AND rr.arrival_date = ${dateStr}::date
        ) AS checked_in_arrivals,
        COUNT(*) FILTER (
          WHERE rr.status = 'CHECKED_IN'
            AND rr.departure_date = ${dateStr}::date
        ) AS departures,
        COUNT(*) FILTER (
          WHERE rr.status = 'CHECKED_OUT'
            AND rr.departure_date = ${dateStr}::date
        ) AS checked_out_departures,
        COUNT(*) FILTER (
          WHERE rr.status = 'CHECKED_IN'
            AND rr.arrival_date < (${dateStr}::date + 1)
            AND rr.departure_date > ${dateStr}::date
        ) AS in_house,
        COUNT(*) FILTER (
          WHERE rr.status = 'CONFIRMED'
            AND rr.arrival_date < ${dateStr}::date
        ) AS overdue
      FROM reservation_rooms rr
      JOIN reservations res ON res.id = rr.reservation_id
      WHERE rr.room_id IN (SELECT id FROM hotel_rooms)
        AND res.status != 'CANCELLED'
    `)

    const r = rows[0]
    const arrivals = Number(r?.arrivals ?? 0)
    const checkedInArrivals = Number(r?.checked_in_arrivals ?? 0)
    const departures = Number(r?.departures ?? 0)
    const checkedOutDepartures = Number(r?.checked_out_departures ?? 0)
    const inHouse = Number(r?.in_house ?? 0)
    const overdue = Number(r?.overdue ?? 0)

    return {
      targetDate: dateStr,
      arrivals,
      checkedInArrivals,
      departures,
      checkedOutDepartures,
      inHouse,
      overdue,
      expectedArrivalsCount: arrivals + checkedInArrivals,
      expectedDeparturesCount: departures + checkedOutDepartures,
      inHouseCount: inHouse,
      pendingArrivalsCount: overdue,
    }
  }

  static async getDailyOperationsList(params: {
    type: "arrivals" | "departures" | "in-house" | "overdue" | "in_house" | "pending"
    date?: string
    propertyId?: string
    q?: string
    page?: number
    limit?: number
    sort?: string
    dir?: "asc" | "desc"
  }): Promise<DailyOperationsListDTO> {
    const dateStr = params.date || getHotelTodayDate()
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(2000, Math.max(1, params.limit || 25))
    const offset = (page - 1) * limit
    const q = params.q?.trim() || null
    const dir = params.dir === "desc" ? "DESC" : "ASC"

    const normalizedType =
      params.type === "in_house" ? "in-house" : params.type === "pending" ? "overdue" : params.type

    let sortSql = Prisma.sql`rm.room_no ASC, rr.id ASC`
    if (params.sort === "room") {
      sortSql = dir === "DESC" ? Prisma.sql`rm.room_no DESC, rr.id ASC` : Prisma.sql`rm.room_no ASC, rr.id ASC`
    } else if (params.sort === "guest") {
      sortSql = dir === "DESC" ? Prisma.sql`cust.first_name DESC, rr.id ASC` : Prisma.sql`cust.first_name ASC, rr.id ASC`
    } else if (params.sort === "dates") {
      sortSql = dir === "DESC" ? Prisma.sql`rr.arrival_date DESC, rr.id ASC` : Prisma.sql`rr.arrival_date ASC, rr.id ASC`
    } else if (params.sort === "rate") {
      sortSql = dir === "DESC" ? Prisma.sql`rr.booked_nightly_rate DESC, rr.id ASC` : Prisma.sql`rr.booked_nightly_rate ASC, rr.id ASC`
    } else if (params.sort === "status") {
      sortSql = dir === "DESC" ? Prisma.sql`rr.status DESC, rr.id ASC` : Prisma.sql`rr.status ASC, rr.id ASC`
    } else if (params.sort === "balance") {
      sortSql = dir === "DESC" ? Prisma.sql`inv.balance_due DESC NULLS LAST, rr.id ASC` : Prisma.sql`inv.balance_due ASC NULLS LAST, rr.id ASC`
    } else if (normalizedType === "overdue") {
      sortSql = Prisma.sql`rr.arrival_date ASC, rr.id ASC`
    }

    let typePredicate = Prisma.sql`true`
    if (normalizedType === "arrivals") {
      typePredicate = Prisma.sql`rr.arrival_date = ${dateStr}::date AND rr.status IN ('CONFIRMED', 'CHECKED_IN')`
    } else if (normalizedType === "departures") {
      typePredicate = Prisma.sql`rr.departure_date = ${dateStr}::date AND rr.status IN ('CHECKED_IN', 'CHECKED_OUT')`
    } else if (normalizedType === "in-house") {
      typePredicate = Prisma.sql`rr.status = 'CHECKED_IN' AND rr.arrival_date < (${dateStr}::date + 1) AND rr.departure_date > ${dateStr}::date`
    } else if (normalizedType === "overdue") {
      typePredicate = Prisma.sql`rr.status = 'CONFIRMED' AND rr.arrival_date < ${dateStr}::date`
    }

    const queryRows = await prisma.$queryRaw<
      Array<{
        allocationId: string
        reservationId: string
        reservationNo: string
        customerId: string
        guestName: string
        guestPhone: string | null
        guestEmail: string | null
        roomId: string
        roomNo: string
        roomDisplayName: string | null
        roomCategoryName: string
        buildingName: string
        floorNo: number
        arrivalDate: string
        departureDate: string
        stayNights: number
        bookedNightlyRate: string
        allocationStatus: AllocationStatus
        roomStatus: RoomStatus
        invoiceId: string | null
        invoiceNumber: string | null
        invoiceTotalPaid: string | null
        invoiceBalanceDue: string | null
        specialRequests: string | null
        fullCount: bigint | number
      }>
    >(Prisma.sql`
      SELECT
        rr.id AS "allocationId",
        rr.reservation_id AS "reservationId",
        res.reservation_no AS "reservationNo",
        res.customer_id AS "customerId",
        CONCAT(cust.first_name, ' ', cust.last_name) AS "guestName",
        cust.phone AS "guestPhone",
        cust.email AS "guestEmail",
        rr.room_id AS "roomId",
        rm.room_no AS "roomNo",
        rm.display_name AS "roomDisplayName",
        rc.name AS "roomCategoryName",
        bld.name AS "buildingName",
        flr.floor_no AS "floorNo",
        TO_CHAR(rr.arrival_date, 'YYYY-MM-DD') AS "arrivalDate",
        TO_CHAR(COALESCE(rr.actual_checkout_date, rr.departure_date), 'YYYY-MM-DD') AS "departureDate",
        GREATEST(1, COALESCE(rr.actual_checkout_date, rr.departure_date) - rr.arrival_date)::int AS "stayNights",
        rr.booked_nightly_rate::text AS "bookedNightlyRate",
        rr.status AS "allocationStatus",
        rm.status AS "roomStatus",
        inv.id AS "invoiceId",
        inv.invoice_number AS "invoiceNumber",
        inv.total_paid::text AS "invoiceTotalPaid",
        inv.balance_due::text AS "invoiceBalanceDue",
        res.special_requests AS "specialRequests",
        COUNT(*) OVER() AS "fullCount"
      FROM reservation_rooms rr
      JOIN rooms rm ON rm.id = rr.room_id
      JOIN buildings bld ON bld.id = rm.building_id
      JOIN floors flr ON flr.id = rm.floor_id
      JOIN room_categories rc ON rc.id = rr.room_category_id
      JOIN reservations res ON res.id = rr.reservation_id
      JOIN customers cust ON cust.id = res.customer_id
      LEFT JOIN LATERAL (
        SELECT
          i.id,
          i.invoice_number,
          COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'RECORDED'), 0) AS total_paid,
          GREATEST(0, i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'RECORDED'), 0)) AS balance_due
        FROM invoices i
        LEFT JOIN payments p ON p.invoice_id = i.id
        WHERE i.reservation_id = res.id
          AND i.status != 'VOID'
        GROUP BY i.id, i.invoice_number, i.grand_total, i.created_at
        ORDER BY i.created_at ASC
        LIMIT 1
      ) inv ON true
      WHERE (${params.propertyId ?? null}::text IS NULL OR rm.property_id = ${params.propertyId ?? null})
        AND ${typePredicate}
        AND res.status != 'CANCELLED'
        AND (
          ${q}::text IS NULL OR
          CONCAT(cust.first_name, ' ', cust.last_name) ILIKE ${'%' + (q || '') + '%'} OR
          res.reservation_no ILIKE ${'%' + (q || '') + '%'} OR
          rm.room_no ILIKE ${'%' + (q || '') + '%'}
        )
      ORDER BY ${sortSql}
      LIMIT ${limit} OFFSET ${offset}
    `)

    const total = queryRows.length > 0 ? Number(queryRows[0]?.fullCount ?? 0) : 0
    const rows: DailyOperationItemDTO[] = queryRows.map((r) => ({
      allocationId: r.allocationId,
      reservationId: r.reservationId,
      reservationNo: r.reservationNo,
      customerId: r.customerId,
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      guestEmail: r.guestEmail,
      roomId: r.roomId,
      roomNo: r.roomNo,
      roomDisplayName: r.roomDisplayName,
      roomCategoryName: r.roomCategoryName,
      buildingName: r.buildingName,
      floorNo: r.floorNo,
      arrivalDate: r.arrivalDate,
      departureDate: r.departureDate,
      stayNights: r.stayNights,
      bookedNightlyRate: r.bookedNightlyRate,
      allocationStatus: r.allocationStatus,
      roomStatus: r.roomStatus,
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoiceNumber,
      invoiceGrandTotal: null,
      invoiceTotalPaid: r.invoiceTotalPaid,
      invoiceBalanceDue: r.invoiceBalanceDue,
      specialRequests: r.specialRequests,
    }))

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return {
      targetDate: dateStr,
      type: normalizedType as "arrivals" | "departures" | "in-house" | "overdue",
      rows,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
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
   * Paginated by room (default limit 25, max 100). Never loads all rooms of a hotel.
   */
  static async getAvailabilityGrid(
    startDateStr?: string,
    endDateStr?: string,
    propertyId?: string,
    buildingId?: string,
    options?: {
      categoryId?: string
      floorId?: string
      q?: string
      page?: number
      limit?: number
    }
  ): Promise<AvailabilityGridDTO> {
    const todayStr = getHotelTodayDate()
    const resolvedStartStr = startDateStr || todayStr
    let resolvedEndStr = endDateStr

    if (!resolvedEndStr) {
      const sDate = new Date(`${resolvedStartStr}T00:00:00.000Z`)
      const eDate = new Date(sDate.getTime() + 6 * 24 * 60 * 60 * 1000)
      resolvedEndStr = eDate.toISOString().split("T")[0]!
    }

    const startObj = new Date(`${resolvedStartStr}T00:00:00.000Z`)
    const endObj = new Date(`${resolvedEndStr}T00:00:00.000Z`)

    const numDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (numDays > 31) {
      throw new BadRequestError("Availability grid range cannot exceed 31 days")
    }
    if (numDays < 1) {
      throw new BadRequestError("endDate must be on or after startDate")
    }

    const dates: string[] = []
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startObj.getTime() + i * 24 * 60 * 60 * 1000)
      dates.push(d.toISOString().split("T")[0]!)
    }

    // 1. Determine scoped property
    let effectivePropertyId = propertyId
    let propRecord: { id: string; name: string } | null = null

    if (effectivePropertyId) {
      propRecord = await prisma.property.findUnique({
        where: { id: effectivePropertyId },
        select: { id: true, name: true },
      })
    } else {
      propRecord = await prisma.property.findFirst({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
      if (propRecord) {
        effectivePropertyId = propRecord.id
      }
    }

    // 2. Resolve default room category (first by name of selected hotel)
    let resolvedCategoryId = options?.categoryId
    let selectedCategoryObj: { id: string; name: string } | null = null

    if (resolvedCategoryId === "all") {
      resolvedCategoryId = undefined
    } else if (!resolvedCategoryId && effectivePropertyId) {
      const firstCat = await prisma.roomCategory.findFirst({
        where: {
          OR: [{ propertyId: effectivePropertyId }, { propertyId: null }],
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
      if (firstCat) {
        resolvedCategoryId = firstCat.id
        selectedCategoryObj = firstCat
      }
    } else if (resolvedCategoryId) {
      const cat = await prisma.roomCategory.findUnique({
        where: { id: resolvedCategoryId },
        select: { id: true, name: true },
      })
      if (cat) {
        selectedCategoryObj = cat
      }
    }

    // 3. Room Filters & Pagination
    const roomWhere: Prisma.RoomWhereInput = {}
    if (effectivePropertyId) {
      roomWhere.propertyId = effectivePropertyId
    }
    if (resolvedCategoryId) {
      roomWhere.roomCategoryId = resolvedCategoryId
    }
    if (buildingId) {
      roomWhere.buildingId = buildingId
    }
    if (options?.floorId) {
      roomWhere.floorId = options.floorId
    }
    if (options?.q?.trim()) {
      roomWhere.roomNo = { contains: options.q.trim(), mode: "insensitive" }
    }

    const page = Math.max(1, options?.page || 1)
    const limit = Math.min(100, Math.max(1, options?.limit || 25))
    const skip = (page - 1) * limit

    const [totalRooms, physicalRooms] = await Promise.all([
      prisma.room.count({ where: roomWhere }),
      prisma.room.findMany({
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
        skip,
        take: limit,
      }),
    ])

    // 4. Fetch overlapping allocations ONLY for the paginated room IDs
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

    // 5. Assemble room date matrix
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

    const totalPages = Math.max(1, Math.ceil(totalRooms / limit))

    return {
      startDate: resolvedStartStr,
      endDate: resolvedEndStr,
      dates,
      rooms,
      totalRooms,
      selectedProperty: propRecord ? { id: propRecord.id, name: propRecord.name } : undefined,
      selectedCategory: selectedCategoryObj,
      pagination: {
        page,
        limit,
        total: totalRooms,
        totalPages,
      },
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
    propertyId?: string,
    options?: { page?: number; limit?: number }
  ): Promise<ShiftCollectionsReportDTO> {
    const todayIso = getHotelTodayDate()
    const effectiveStart = startDateStr || dateStr || todayIso
    const effectiveEnd = endDateStr || dateStr || todayIso

    const startObj = new Date(`${effectiveStart}T00:00:00.000Z`)
    const endObj = new Date(`${effectiveEnd}T23:59:59.999Z`)
    const diffDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 366) {
      throw new BadRequestError("Date range cannot exceed 366 days")
    }

    const propertyFilterSql = propertyId ? Prisma.sql`AND p.property_id = ${propertyId}` : Prisma.empty
    const staffFilterSql = staffUserId
      ? Prisma.sql`AND (CASE WHEN p.status = 'VOIDED' AND p.voided_by IS NOT NULL THEN p.voided_by ELSE p.created_by END) = ${staffUserId}`
      : Prisma.empty

    const page = Math.max(1, options?.page || 1)
    const limit = Math.min(100, Math.max(1, options?.limit || 25))
    const offset = (page - 1) * limit

    // 1. Overall totals and count
    const totalsRows = await prisma.$queryRaw<Array<{
      total_count: number
      total_collected: Prisma.Decimal
    }>>`
      SELECT
        COUNT(*)::int as total_count,
        COALESCE(SUM(
          CASE 
            WHEN p.status = 'RECORDED' THEN p.amount
            WHEN p.status = 'VOIDED' AND p.voided_at >= ${startObj} AND p.voided_at <= ${endObj} THEN -p.amount
            ELSE p.amount
          END
        ), 0) as total_collected
      FROM payments p
      WHERE (
        (p.paid_at >= ${startObj} AND p.paid_at <= ${endObj} AND p.status = 'RECORDED')
        OR (p.voided_at >= ${startObj} AND p.voided_at <= ${endObj} AND p.status = 'VOIDED')
      )
      ${propertyFilterSql}
      ${staffFilterSql};
    `
    const totalTransactions = totalsRows[0]?.total_count ?? 0
    const totalCollectedDec = new Prisma.Decimal(totalsRows[0]?.total_collected ?? 0)

    // 2. Method breakdown
    const methodRows = await prisma.$queryRaw<Array<{
      payment_method: string
      count: number
      amount: Prisma.Decimal
    }>>`
      SELECT
        p.payment_method::text,
        COUNT(*)::int as count,
        COALESCE(SUM(
          CASE 
            WHEN p.status = 'RECORDED' THEN p.amount
            WHEN p.status = 'VOIDED' AND p.voided_at >= ${startObj} AND p.voided_at <= ${endObj} THEN -p.amount
            ELSE p.amount
          END
        ), 0) as amount
      FROM payments p
      WHERE (
        (p.paid_at >= ${startObj} AND p.paid_at <= ${endObj} AND p.status = 'RECORDED')
        OR (p.voided_at >= ${startObj} AND p.voided_at <= ${endObj} AND p.status = 'VOIDED')
      )
      ${propertyFilterSql}
      ${staffFilterSql}
      GROUP BY p.payment_method;
    `
    const methodBreakdown: PaymentMethodBreakdownDTO[] = methodRows.map((m) => {
      const amt = new Prisma.Decimal(m.amount)
      const pct = totalCollectedDec.gt(0) ? amt.div(totalCollectedDec).mul(100).toNumber() : 0
      return {
        method: m.payment_method,
        amount: amt.toFixed(2),
        count: m.count,
        percentage: Math.round(pct * 10) / 10,
      }
    })

    // 3. Staff breakdown
    const staffRows = await prisma.$queryRaw<Array<{
      user_id: string
      user_name: string
      user_email: string
      payment_method: string
      method_amount: Prisma.Decimal
      total_count: number
    }>>`
      SELECT
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        p.payment_method::text,
        COALESCE(SUM(
          CASE 
            WHEN p.status = 'RECORDED' THEN p.amount
            WHEN p.status = 'VOIDED' AND p.voided_at >= ${startObj} AND p.voided_at <= ${endObj} THEN -p.amount
            ELSE p.amount
          END
        ), 0) as method_amount,
        COUNT(*)::int as total_count
      FROM payments p
      JOIN users u ON u.id = CASE WHEN p.status = 'VOIDED' AND p.voided_by IS NOT NULL THEN p.voided_by ELSE p.created_by END
      WHERE (
        (p.paid_at >= ${startObj} AND p.paid_at <= ${endObj} AND p.status = 'RECORDED')
        OR (p.voided_at >= ${startObj} AND p.voided_at <= ${endObj} AND p.status = 'VOIDED')
      )
      ${propertyFilterSql}
      ${staffFilterSql}
      GROUP BY u.id, u.name, u.email, p.payment_method;
    `
    const staffMap = new Map<string, {
      userId: string
      userName: string
      userEmail: string
      totalCollected: Prisma.Decimal
      paymentCount: number
      methods: Record<string, string>
    }>()

    for (const sr of staffRows) {
      let entry = staffMap.get(sr.user_id)
      if (!entry) {
        entry = {
          userId: sr.user_id,
          userName: sr.user_name,
          userEmail: sr.user_email,
          totalCollected: new Prisma.Decimal(0),
          paymentCount: 0,
          methods: {},
        }
        staffMap.set(sr.user_id, entry)
      }
      const mAmt = new Prisma.Decimal(sr.method_amount)
      entry.totalCollected = entry.totalCollected.add(mAmt)
      entry.paymentCount += sr.total_count
      entry.methods[sr.payment_method] = mAmt.toFixed(2)
    }

    const staffBreakdown: StaffCollectionBreakdownDTO[] = Array.from(staffMap.values()).map((s) => ({
      userId: s.userId,
      userName: s.userName,
      userEmail: s.userEmail,
      totalCollected: s.totalCollected.toFixed(2),
      paymentCount: s.paymentCount,
      methods: s.methods,
    }))

    // 4. Paginated transactions
    const txRows = await prisma.$queryRaw<Array<{
      payment_id: string
      invoice_id: string
      amount: Prisma.Decimal
      payment_method: string
      reference_number: string | null
      status: PaymentStatus
      paid_at: Date
      voided_at: Date | null
      void_reason: string | null
      created_by: string
      voided_by: string | null
      creator_name: string | null
      voider_name: string | null
      invoice_number: string
      reservation_id: string | null
      reservation_no: string | null
      first_name: string | null
      last_name: string | null
      room_numbers: string[] | null
    }>>`
      SELECT
        p.id as payment_id,
        p.invoice_id,
        p.amount,
        p.payment_method::text,
        p.reference_number,
        p.status,
        p.paid_at,
        p.voided_at,
        p.void_reason,
        p.created_by,
        p.voided_by,
        u.name as creator_name,
        vu.name as voider_name,
        inv.invoice_number,
        inv.reservation_id,
        r.reservation_no,
        c.first_name,
        c.last_name,
        (
          SELECT array_agg(rm.room_no)
          FROM reservation_rooms rr
          JOIN rooms rm ON rm.id = rr.room_id
          WHERE rr.reservation_id = r.id
        ) as room_numbers
      FROM payments p
      JOIN users u ON u.id = p.created_by
      LEFT JOIN users vu ON vu.id = p.voided_by
      JOIN invoices inv ON inv.id = p.invoice_id
      LEFT JOIN reservations r ON r.id = inv.reservation_id
      LEFT JOIN customers c ON c.id = r.customer_id
      WHERE (
        (p.paid_at >= ${startObj} AND p.paid_at <= ${endObj} AND p.status = 'RECORDED')
        OR (p.voided_at >= ${startObj} AND p.voided_at <= ${endObj} AND p.status = 'VOIDED')
      )
      ${propertyFilterSql}
      ${staffFilterSql}
      ORDER BY COALESCE(p.voided_at, p.paid_at) DESC, p.id DESC
      LIMIT ${limit} OFFSET ${offset};
    `

    const transactions: PaymentTransactionDTO[] = txRows.map((tx) => {
      const isVoid = tx.status === PaymentStatus.VOIDED
      const effectiveUser = isVoid && tx.voided_by ? tx.voided_by : tx.created_by
      const effectiveUserName = isVoid ? (tx.voider_name || tx.creator_name || "System Staff") : (tx.creator_name || "System Staff")
      const guestName = tx.first_name ? `${tx.first_name} ${tx.last_name || ""}`.trim() : "Direct Folio"
      const prefix = isVoid ? "VOID" : "REC"

      return {
        paymentId: tx.payment_id,
        receiptNumber: `${prefix}-${tx.payment_id.slice(-8).toUpperCase()}`,
        invoiceId: tx.invoice_id,
        invoiceNumber: tx.invoice_number,
        reservationId: tx.reservation_id,
        reservationNo: tx.reservation_no,
        guestName,
        roomNumbers: tx.room_numbers || [],
        amount: isVoid ? (-new Prisma.Decimal(tx.amount)).toFixed(2) : new Prisma.Decimal(tx.amount).toFixed(2),
        paymentMethod: tx.payment_method,
        referenceNumber: tx.reference_number,
        notes: isVoid ? (tx.void_reason ? `Voided: ${tx.void_reason}` : "Payment voided") : null,
        recordedByUserId: effectiveUser,
        recordedByUserName: effectiveUserName,
        paidAt: (tx.voided_at || tx.paid_at).toISOString(),
      }
    })

    return {
      targetDate: effectiveStart === effectiveEnd ? effectiveStart : `${effectiveStart} to ${effectiveEnd}`,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      totalCollected: totalCollectedDec.toFixed(2),
      totalTransactions,
      methodBreakdown,
      staffBreakdown,
      transactions,
      pagination: {
        page,
        limit,
        total: totalTransactions,
        totalPages: Math.ceil(totalTransactions / limit),
      },
    }
  }

  static async getReceivablesReport(
    propertyId?: string,
    filterOption: "all" | "in_house" | "future" | "departed" = "all",
    options?: { page?: number; limit?: number }
  ): Promise<ReceivablesReportDTO> {
    const todayStr = getHotelTodayDate()
    const propertyFilterSql = propertyId ? Prisma.sql`AND i.property_id = ${propertyId}` : Prisma.empty

    const fetchSummary = async () => {
      const summaryRows = await prisma.$queryRaw<Array<{
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
      }>>`
        WITH unpaid_inv AS (
          SELECT 
            i.id,
            i.created_at,
            i.grand_total,
            COALESCE(p.paid, 0) AS total_paid,
            (i.grand_total - COALESCE(p.paid, 0)) AS balance_due,
            st.stay_status,
            (CURRENT_DATE - i.created_at::date) AS days_aging
          FROM invoices i
          LEFT JOIN LATERAL (
            SELECT SUM(amount) AS paid 
            FROM payments 
            WHERE invoice_id = i.id AND status = 'RECORDED'
          ) p ON true
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(
                (SELECT 'IN_HOUSE' FROM reservation_rooms rr WHERE rr.reservation_id = i.reservation_id AND rr.status = 'CHECKED_IN' LIMIT 1),
                (SELECT 'FUTURE' FROM reservation_rooms rr WHERE rr.reservation_id = i.reservation_id AND rr.status = 'CONFIRMED' LIMIT 1),
                'DEPARTED'
              ) AS stay_status
          ) st ON true
          WHERE i.status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID')
            ${propertyFilterSql}
            AND (i.grand_total - COALESCE(p.paid, 0)) > 0
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

    const page = Math.max(1, options?.page || 1)
    const limit = Math.min(100, Math.max(1, options?.limit || 25))
    const offset = (page - 1) * limit

    let totalForFilter = sum.total_invoices
    if (filterOption === "in_house") totalForFilter = sum.in_house_count
    else if (filterOption === "future") totalForFilter = sum.future_count
    else if (filterOption === "departed") totalForFilter = sum.departed_count

    const stayStatusFilterSql =
      filterOption === "in_house"
        ? Prisma.sql`AND st.stay_status = 'IN_HOUSE'`
        : filterOption === "future"
        ? Prisma.sql`AND st.stay_status = 'FUTURE'`
        : filterOption === "departed"
        ? Prisma.sql`AND st.stay_status = 'DEPARTED'`
        : Prisma.empty

    const itemRows = await prisma.$queryRaw<Array<{
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
      room_numbers: string[] | null
    }>>`
      SELECT 
        i.id AS invoice_id,
        i.invoice_number,
        i.reservation_id,
        r.reservation_no,
        r.customer_id,
        r.status AS reservation_status,
        c.first_name,
        c.last_name,
        c.phone,
        c.email,
        i.created_at AS issue_date,
        i.grand_total,
        COALESCE(p.paid, 0) AS total_paid,
        (i.grand_total - COALESCE(p.paid, 0)) AS balance_due,
        (CURRENT_DATE - i.created_at::date)::int AS days_aging,
        st.stay_status,
        (st.stay_status = 'IN_HOUSE') AS is_guest_in_house,
        CASE
          WHEN (CURRENT_DATE - i.created_at::date) <= 7 THEN '0-7'
          WHEN (CURRENT_DATE - i.created_at::date) <= 30 THEN '8-30'
          WHEN (CURRENT_DATE - i.created_at::date) <= 60 THEN '31-60'
          ELSE '60+'
        END AS aging_bucket,
        (
          SELECT array_agg(rm.room_no)
          FROM reservation_rooms rr
          JOIN rooms rm ON rm.id = rr.room_id
          WHERE rr.reservation_id = r.id
        ) AS room_numbers
      FROM invoices i
      JOIN reservations r ON r.id = i.reservation_id
      JOIN customers c ON c.id = r.customer_id
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS paid 
        FROM payments 
        WHERE invoice_id = i.id AND status = 'RECORDED'
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            (SELECT 'IN_HOUSE' FROM reservation_rooms rr WHERE rr.reservation_id = i.reservation_id AND rr.status = 'CHECKED_IN' LIMIT 1),
            (SELECT 'FUTURE' FROM reservation_rooms rr WHERE rr.reservation_id = i.reservation_id AND rr.status = 'CONFIRMED' LIMIT 1),
            'DEPARTED'
          ) AS stay_status
      ) st ON true
      WHERE i.status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID')
        ${propertyFilterSql}
        AND (i.grand_total - COALESCE(p.paid, 0)) > 0
        ${stayStatusFilterSql}
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT ${limit} OFFSET ${offset};
    `

    const items: ReceivableItemDTO[] = itemRows.map((r) => ({
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number,
      reservationId: r.reservation_id,
      reservationNo: r.reservation_no,
      customerId: r.customer_id,
      guestName: `${r.first_name} ${r.last_name || ""}`.trim(),
      guestPhone: r.phone,
      guestEmail: r.email,
      roomNumbers: r.room_numbers || [],
      reservationStatus: r.reservation_status,
      isGuestInHouse: r.is_guest_in_house,
      guestStayStatus: r.stay_status,
      issueDate: r.issue_date instanceof Date ? r.issue_date.toISOString().split("T")[0]! : String(r.issue_date).slice(0, 10),
      grandTotal: new Prisma.Decimal(r.grand_total).toFixed(2),
      totalPaid: new Prisma.Decimal(r.total_paid).toFixed(2),
      balanceDue: new Prisma.Decimal(r.balance_due).toFixed(2),
      daysAging: r.days_aging,
      agingBucket: r.aging_bucket,
    }))

    return {
      asOfDate: todayStr,
      totalReceivables: new Prisma.Decimal(sum.total_receivables).toFixed(2),
      totalInvoices: sum.total_invoices,
      inHouseReceivables: new Prisma.Decimal(sum.in_house_receivables).toFixed(2),
      inHouseCount: sum.in_house_count,
      futureReceivables: new Prisma.Decimal(sum.future_receivables).toFixed(2),
      futureCount: sum.future_count,
      departedReceivables: new Prisma.Decimal(sum.departed_receivables).toFixed(2),
      departedCount: sum.departed_count,
      agingSummary: {
        bucket0to7: new Prisma.Decimal(sum.bucket_0_to_7).toFixed(2),
        bucket8to30: new Prisma.Decimal(sum.bucket_8_to_30).toFixed(2),
        bucket31to60: new Prisma.Decimal(sum.bucket_31_to_60).toFixed(2),
        bucket60Plus: new Prisma.Decimal(sum.bucket_60_plus).toFixed(2),
      },
      items,
      pagination: {
        page,
        limit,
        total: totalForFilter,
        totalPages: Math.ceil(totalForFilter / limit),
      },
    }
  }

  static async getDiscountsReport(
    filters: Partial<ReportFilterDTO> = {},
    options?: { page?: number; limit?: number }
  ): Promise<DiscountsReportDTO> {
    const { startDate, endDate, propertyId } = filters
    if (startDate && endDate) {
      const s = new Date(`${startDate}T00:00:00.000Z`).getTime()
      const e = new Date(`${endDate}T23:59:59.999Z`).getTime()
      const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24))
      if (diffDays > 366) {
        throw new BadRequestError("Date range cannot exceed 366 days")
      }
    }

    const startObj = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null
    const endObj = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null

    const invPropertySql = propertyId ? Prisma.sql`AND inv.property_id = ${propertyId}` : Prisma.empty
    const invDateSql = startObj && endObj
      ? Prisma.sql`AND inv.created_at >= ${startObj} AND inv.created_at <= ${endObj}`
      : startObj
      ? Prisma.sql`AND inv.created_at >= ${startObj}`
      : endObj
      ? Prisma.sql`AND inv.created_at <= ${endObj}`
      : Prisma.empty

    const rrPropertySql = propertyId ? Prisma.sql`AND rm.property_id = ${propertyId}` : Prisma.empty
    const rrDateSql = startDate && endDate
      ? Prisma.sql`AND rr.arrival_date >= ${startDate}::date AND rr.departure_date <= ${endDate}::date`
      : startDate
      ? Prisma.sql`AND rr.arrival_date >= ${startDate}::date`
      : endDate
      ? Prisma.sql`AND rr.departure_date <= ${endDate}::date`
      : Prisma.empty

    const page = Math.max(1, options?.page || 1)
    const limit = Math.min(100, Math.max(1, options?.limit || 25))
    const offset = (page - 1) * limit

    // 1. Full scoped totals in SQL
    const invTotalRows = await prisma.$queryRaw<Array<{
      count: number
      total_discount: Prisma.Decimal
    }>>`
      SELECT
        COUNT(*)::int as count,
        COALESCE(SUM(
          CASE 
            WHEN inv.discount_total > 0 THEN inv.discount_total
            ELSE COALESCE((
              SELECT SUM(ABS(ii.line_total))
              FROM invoice_items ii
              WHERE ii.invoice_id = inv.id AND ii.item_type = 'DISCOUNT'
            ), 0)
          END
        ), 0) as total_discount
      FROM invoices inv
      WHERE inv.status <> 'VOID'
        ${invPropertySql}
        ${invDateSql}
        AND (
          inv.discount_total > 0
          OR EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.item_type = 'DISCOUNT')
        );
    `
    const discountedInvoicesCount = invTotalRows[0]?.count ?? 0
    const totalInvoiceDiscountsDec = new Prisma.Decimal(invTotalRows[0]?.total_discount ?? 0)

    const rateOverrideTotalRows = await prisma.$queryRaw<Array<{
      count: number
      total_variance: Prisma.Decimal
    }>>`
      SELECT
        COUNT(*)::int as count,
        COALESCE(SUM(
          (rc.base_price - rr.booked_nightly_rate) * 
          GREATEST(1, rr.departure_date - rr.arrival_date)
        ), 0) as total_variance
      FROM reservation_rooms rr
      JOIN room_categories rc ON rc.id = rr.room_category_id
      JOIN rooms rm ON rm.id = rr.room_id
      WHERE rr.status <> 'CANCELLED'
        ${rrPropertySql}
        ${rrDateSql}
        AND rr.booked_nightly_rate < rc.base_price;
    `
    const rateOverridesCount = rateOverrideTotalRows[0]?.count ?? 0
    const totalRateOverrideDiscountsDec = new Prisma.Decimal(rateOverrideTotalRows[0]?.total_variance ?? 0)
    const totalConcessionDec = totalInvoiceDiscountsDec.add(totalRateOverrideDiscountsDec)

    // 2. Paginated invoice discounts
    const invPageRows = await prisma.$queryRaw<Array<{
      invoice_id: string
      invoice_number: string
      reservation_id: string
      reservation_no: string
      first_name: string
      last_name: string | null
      discount_total: Prisma.Decimal
      created_at: Date
    }>>`
      SELECT
        inv.id as invoice_id,
        inv.invoice_number,
        inv.reservation_id,
        r.reservation_no,
        c.first_name,
        c.last_name,
        inv.discount_total,
        inv.created_at
      FROM invoices inv
      JOIN reservations r ON r.id = inv.reservation_id
      JOIN customers c ON c.id = r.customer_id
      WHERE inv.status <> 'VOID'
        ${invPropertySql}
        ${invDateSql}
        AND (
          inv.discount_total > 0
          OR EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.item_type = 'DISCOUNT')
        )
      ORDER BY inv.created_at DESC, inv.id DESC
      LIMIT ${limit} OFFSET ${offset};
    `

    // Fetch items for the page of invoices only
    const invoiceIds = invPageRows.map((r) => r.invoice_id)
    const itemsByInvoice = new Map<string, Array<{ description: string; unitPrice: string; lineTotal: string }>>()
    if (invoiceIds.length > 0) {
      const items = await prisma.invoiceItem.findMany({
        where: {
          invoiceId: { in: invoiceIds },
          itemType: InvoiceItemType.DISCOUNT,
        },
        select: {
          invoiceId: true,
          description: true,
          unitPrice: true,
          lineTotal: true,
        },
      })
      for (const item of items) {
        let list = itemsByInvoice.get(item.invoiceId)
        if (!list) {
          list = []
          itemsByInvoice.set(item.invoiceId, list)
        }
        list.push({
          description: item.description,
          unitPrice: item.unitPrice.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })
      }
    }

    const invoiceDiscounts: InvoiceDiscountItemDTO[] = invPageRows.map((inv) => {
      const discItems = itemsByInvoice.get(inv.invoice_id) || []
      let invDiscDec = new Prisma.Decimal(inv.discount_total)
      if (invDiscDec.isZero() && discItems.length > 0) {
        invDiscDec = discItems.reduce((sum, item) => sum.add(new Prisma.Decimal(item.lineTotal).abs()), new Prisma.Decimal(0))
      }
      return {
        invoiceId: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        reservationId: inv.reservation_id,
        reservationNo: inv.reservation_no,
        customerName: `${inv.first_name} ${inv.last_name || ""}`.trim(),
        discountTotal: invDiscDec.toFixed(2),
        items: discItems,
        createdAt: inv.created_at instanceof Date ? inv.created_at.toISOString() : String(inv.created_at),
      }
    })

    // 3. Paginated rate overrides
    const ratePageRows = await prisma.$queryRaw<Array<{
      allocation_id: string
      reservation_id: string
      reservation_no: string
      room_no: string
      category_name: string
      base_price: Prisma.Decimal
      booked_rate: Prisma.Decimal
      rate_variance: Prisma.Decimal
      nights: number
      total_variance: Prisma.Decimal
      arrival_date: Date
      departure_date: Date
    }>>`
      SELECT
        rr.id as allocation_id,
        rr.reservation_id,
        r.reservation_no,
        rm.room_no,
        rc.name as category_name,
        rc.base_price,
        rr.booked_nightly_rate as booked_rate,
        (rc.base_price - rr.booked_nightly_rate) as rate_variance,
        GREATEST(1, rr.departure_date - rr.arrival_date)::int as nights,
        ((rc.base_price - rr.booked_nightly_rate) * GREATEST(1, rr.departure_date - rr.arrival_date)) as total_variance,
        rr.arrival_date,
        rr.departure_date
      FROM reservation_rooms rr
      JOIN rooms rm ON rm.id = rr.room_id
      JOIN room_categories rc ON rc.id = rr.room_category_id
      JOIN reservations r ON r.id = rr.reservation_id
      WHERE rr.status <> 'CANCELLED'
        ${rrPropertySql}
        ${rrDateSql}
        AND rr.booked_nightly_rate < rc.base_price
      ORDER BY rr.created_at DESC, rr.id DESC
      LIMIT ${limit} OFFSET ${offset};
    `

    const rateOverrides: RateOverrideItemDTO[] = ratePageRows.map((r) => ({
      reservationId: r.reservation_id,
      reservationNo: r.reservation_no,
      allocationId: r.allocation_id,
      roomNo: r.room_no,
      categoryName: r.category_name,
      basePrice: new Prisma.Decimal(r.base_price).toFixed(2),
      bookedRate: new Prisma.Decimal(r.booked_rate).toFixed(2),
      rateVariance: new Prisma.Decimal(r.rate_variance).toFixed(2),
      nights: r.nights,
      totalVariance: new Prisma.Decimal(r.total_variance).toFixed(2),
      arrivalDate: r.arrival_date instanceof Date ? r.arrival_date.toISOString().split("T")[0]! : String(r.arrival_date).slice(0, 10),
      departureDate: r.departure_date instanceof Date ? r.departure_date.toISOString().split("T")[0]! : String(r.departure_date).slice(0, 10),
    }))

    const maxItems = Math.max(discountedInvoicesCount, rateOverridesCount)

    return {
      summary: {
        totalInvoiceDiscounts: totalInvoiceDiscountsDec.toFixed(2),
        totalRateOverrideDiscounts: totalRateOverrideDiscountsDec.toFixed(2),
        totalConcessionImpact: totalConcessionDec.toFixed(2),
        discountedInvoicesCount,
        rateOverridesCount,
      },
      invoiceDiscounts,
      rateOverrides,
      pagination: {
        page,
        limit,
        total: maxItems,
        totalPages: Math.ceil(maxItems / limit),
      },
    }
  }
}
