import {
  Prisma,
  ReservationStatus,
  AllocationStatus,
  InvoiceStatus,
  ReceiptStatus,
  InvoiceItemType,
  RoomStatus,
  IncomeStatus,
  ExpenseStatus,
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
  IncomeReportDTO,
  IncomeReportItemDTO,
  IncomeCategorySummaryDTO,
  ExpenseReportDTO,
  ExpenseReportItemDTO,
  ExpenseCategorySummaryDTO,
  CashFlowReportDTO,
  DailyCashFlowDTO,
  CashFlowInflowSourceDTO,
  CashFlowOutflowCategoryDTO,
  CashFlowAccountSummaryDTO,
  RevenueVsExpenseReportDTO,
  RoomPerformanceReportDTO,
  RoomPerformanceItemDTO,
  MonthlyPerformanceReportDTO,
  MonthlyPerformanceMonthDTO,
  PropertySummaryReportDTO,
  PropertySummaryItemDTO,
  GuestReportDTO,
  GuestReportItemDTO,
  MonthlyGuestLoyaltyDTO,
} from "./reports.types"
import {
  getHotelTodayDate,
  getHotelTodayDateUtc,
  getHotelDateBoundaryUtc,
  addDaysToYmd,
  HOTEL_TIMEZONE,
} from "@/lib/date"
import { MAX_REPORT_RANGE_DAYS } from "./reports.validation"

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
    if (diffDays > MAX_REPORT_RANGE_DAYS) {
      throw new BadRequestError(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days (10 years)`)
    }

    const totalDays = diffDays + 1
    const todayUtcStr = getHotelTodayDateUtc().toISOString().split("T")[0]!
    const propertyFilterSql = propertyId ? Prisma.sql`AND rm.property_id = ${propertyId}` : Prisma.empty

    // 1. Single consolidated query: Total physical rooms + daily breakdown via CTE
    const dayRows = await prisma.$queryRaw<Array<{
      total_rooms: number
      day: Date
      day_of_week: string
      occupied_rooms: number
      room_revenue: Prisma.Decimal
      otb_rooms: number
      otb_revenue: Prisma.Decimal
    }>>`
      WITH total_rooms_cte AS (
        SELECT COUNT(*)::int as count FROM rooms rm WHERE 1=1 ${propertyFilterSql}
      ),
      daily_alloc AS (
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
        (SELECT count FROM total_rooms_cte)::int as total_rooms,
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

    const totalRooms = dayRows[0]?.total_rooms ?? 0
    const totalAvailableRoomNights = totalRooms * totalDays

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
    if (diffDays > MAX_REPORT_RANGE_DAYS) {
      throw new BadRequestError(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days (10 years)`)
    }

    const startTzSql = Prisma.sql`((${startDate} || ' 00:00:00')::timestamp AT TIME ZONE ${HOTEL_TIMEZONE} AT TIME ZONE 'UTC')`
    const endTzSql = Prisma.sql`((to_char(${endDate}::date + 1, 'YYYY-MM-DD') || ' 00:00:00')::timestamp AT TIME ZONE ${HOTEL_TIMEZONE} AT TIME ZONE 'UTC')`

    const invPropertySql = propertyId ? Prisma.sql`AND property_id = ${propertyId}` : Prisma.empty
    const invJoinPropertySql = propertyId ? Prisma.sql`AND inv.property_id = ${propertyId}` : Prisma.empty
    const payPropertySql = propertyId ? Prisma.sql`AND property_id = ${propertyId}` : Prisma.empty

    // Consolidated single-query revenue report
    const singleRows = await prisma.$queryRaw<Array<{
      inv_agg: {
        invoice_count: number
        total_invoiced: number | string
        tax_total: number | string
        discount_total: number | string
      } | null
      pay_agg: {
        payment_count: number
        total_collected: number | string
      } | null
      total_outstanding: number | string
      recognized_direct_income: number | string
      charge_breakdown: Array<{
        item_type: string
        count: number
        amount: number | string
      }> | null
      method_breakdown: Array<{
        method: string
        count: number
        amount: number | string
      }> | null
      daily_breakdown: Array<{
        date: string
        invoicedAmount: number | string
        collectedAmount: number | string
      }> | null
      prop_breakdown: Array<{
        property_id: string
        property_name: string
        total_invoiced: number | string
        total_collected: number | string
      }> | null
    }>>`
      WITH inv_summary AS (
        SELECT
          COUNT(*)::int as invoice_count,
          COALESCE(SUM(grand_total), 0) as total_invoiced,
          COALESCE(SUM(tax_total), 0) as tax_total,
          COALESCE(SUM(discount_total), 0) as discount_total
        FROM invoices
        WHERE created_at >= ${startTzSql} AND created_at < ${endTzSql}
          AND status <> 'VOID'
          ${invPropertySql}
      ),
      pay_summary AS (
        SELECT
          COUNT(*)::int as payment_count,
          COALESCE(SUM(amount), 0) as total_collected
        FROM receipts
        WHERE paid_at >= ${startTzSql} AND paid_at < ${endTzSql}
          AND (status = 'RECORDED' OR voided_at >= ${endTzSql})
          AND invoice_id IS NOT NULL
          ${payPropertySql}
      ),
      direct_income_summary AS (
        SELECT COALESCE(SUM(amount), 0) as recognized_direct_income
        FROM receipts
        WHERE paid_at >= ${startTzSql} AND paid_at < ${endTzSql}
          AND (status = 'RECORDED' OR voided_at >= ${endTzSql})
          AND income_id IS NOT NULL
          ${payPropertySql}
      ),
      out_summary AS (
        SELECT COALESCE(SUM(
          GREATEST(0, inv.grand_total - COALESCE(p.paid, 0))
        ), 0) as total_outstanding
        FROM invoices inv
        LEFT JOIN LATERAL (
          SELECT SUM(amount) as paid
          FROM receipts
          WHERE invoice_id = inv.id
            AND paid_at < ${endTzSql}
            AND (status = 'RECORDED' OR voided_at >= ${endTzSql})
        ) p ON true
        WHERE inv.created_at < ${endTzSql}
          AND inv.status <> 'VOID'
          ${invJoinPropertySql}
      ),
      charge_summary AS (
        SELECT
          ii.item_type::text as item_type,
          COUNT(*)::int as count,
          COALESCE(SUM(ii.line_total), 0) as amount
        FROM invoice_items ii
        JOIN invoices inv ON inv.id = ii.invoice_id
        WHERE inv.created_at >= ${startTzSql} AND inv.created_at < ${endTzSql}
          AND inv.status <> 'VOID'
          ${invJoinPropertySql}
        GROUP BY ii.item_type
      ),
      method_summary AS (
        SELECT
          payment_method_code::text as method,
          COUNT(*)::int as count,
          COALESCE(SUM(amount), 0) as amount
        FROM receipts
        WHERE paid_at >= ${startTzSql} AND paid_at < ${endTzSql}
          AND (status = 'RECORDED' OR voided_at >= ${endTzSql})
          AND invoice_id IS NOT NULL
          ${payPropertySql}
        GROUP BY payment_method_code
      ),
      daily_inv AS (
        SELECT
          to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE ${HOTEL_TIMEZONE}, 'YYYY-MM-DD') as day_key,
          SUM(grand_total) as invoiced
        FROM invoices
        WHERE created_at >= ${startTzSql} AND created_at < ${endTzSql}
          AND status <> 'VOID'
          ${invPropertySql}
        GROUP BY 1
      ),
      daily_pay AS (
        SELECT
          to_char(paid_at AT TIME ZONE 'UTC' AT TIME ZONE ${HOTEL_TIMEZONE}, 'YYYY-MM-DD') as day_key,
          SUM(amount) as collected
        FROM receipts
        WHERE paid_at >= ${startTzSql} AND paid_at < ${endTzSql}
          AND (status = 'RECORDED' OR voided_at >= ${endTzSql})
          AND invoice_id IS NOT NULL
          ${payPropertySql}
        GROUP BY 1
      ),
      daily_summary AS (
        SELECT
          to_char(d.dt::date, 'YYYY-MM-DD') as date,
          COALESCE(di.invoiced, 0) as "invoicedAmount",
          COALESCE(dp.collected, 0) as "collectedAmount"
        FROM generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) d(dt)
        LEFT JOIN daily_inv di ON di.day_key = to_char(d.dt::date, 'YYYY-MM-DD')
        LEFT JOIN daily_pay dp ON dp.day_key = to_char(d.dt::date, 'YYYY-MM-DD')
        ORDER BY d.dt::date ASC
      )
      SELECT
        (SELECT row_to_json(inv_summary) FROM inv_summary) as inv_agg,
        (SELECT row_to_json(pay_summary) FROM pay_summary) as pay_agg,
        (SELECT total_outstanding FROM out_summary) as total_outstanding,
        (SELECT recognized_direct_income FROM direct_income_summary) as recognized_direct_income,
        COALESCE((SELECT json_agg(charge_summary) FROM charge_summary), '[]'::json) as charge_breakdown,
        COALESCE((SELECT json_agg(method_summary) FROM method_summary), '[]'::json) as method_breakdown,
        COALESCE((SELECT json_agg(daily_summary) FROM daily_summary), '[]'::json) as daily_breakdown
        ${!propertyId ? Prisma.sql`, (
          SELECT json_agg(prop_agg) FROM (
            SELECT
              p.id as property_id,
              p.name as property_name,
              COALESCE(inv.total_invoiced, 0) as total_invoiced,
              COALESCE(pay.total_collected, 0) as total_collected
            FROM properties p
            LEFT JOIN (
              SELECT property_id, SUM(grand_total) as total_invoiced
              FROM invoices
              WHERE created_at >= ${startTzSql} AND created_at < ${endTzSql}
                AND status <> 'VOID'
              GROUP BY property_id
            ) inv ON inv.property_id = p.id
            LEFT JOIN (
              SELECT property_id, SUM(amount) as total_collected
              FROM receipts
              WHERE paid_at >= ${startTzSql} AND paid_at < ${endTzSql}
                AND (status = 'RECORDED' OR voided_at >= ${endTzSql})
                AND invoice_id IS NOT NULL
              GROUP BY property_id
            ) pay ON pay.property_id = p.id
            ORDER BY p.name ASC
          ) prop_agg
        ) as prop_breakdown` : Prisma.sql`, NULL::json as prop_breakdown`};
    `

    const row = singleRows[0]
    const totalInvoicedDec = new Prisma.Decimal(row?.inv_agg?.total_invoiced ?? 0)
    const taxTotalDec = new Prisma.Decimal(row?.inv_agg?.tax_total ?? 0)
    const discountTotalDec = new Prisma.Decimal(row?.inv_agg?.discount_total ?? 0)
    const invoiceCount = row?.inv_agg?.invoice_count ?? 0

    const totalCollectedDec = new Prisma.Decimal(row?.pay_agg?.total_collected ?? 0)
    const paymentCount = row?.pay_agg?.payment_count ?? 0
    const totalOutstandingDec = new Prisma.Decimal(row?.total_outstanding ?? 0)

    let roomChargesDec = new Prisma.Decimal(0)
    let extraChargesDec = new Prisma.Decimal(0)
    const chargeTypeBreakdown: ChargeTypeBreakdownDTO[] = []
    const chargeRows = row?.charge_breakdown || []
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

    const methodRows = row?.method_breakdown || []
    const paymentMethodBreakdown: PaymentMethodBreakdownDTO[] = []
    for (const m of methodRows) {
      const amt = new Prisma.Decimal(m.amount)
      const pct = totalCollectedDec.gt(0) ? amt.div(totalCollectedDec).mul(100).toNumber() : 0
      paymentMethodBreakdown.push({
        method: m.method,
        amount: amt.toFixed(2),
        count: m.count,
        percentage: Math.round(pct * 10) / 10,
      })
    }

    const dailyBreakdown: DailyRevenueDTO[] = (row?.daily_breakdown || []).map((dr) => ({
      date: dr.date,
      invoicedAmount: new Prisma.Decimal(dr.invoicedAmount).toFixed(2),
      collectedAmount: new Prisma.Decimal(dr.collectedAmount).toFixed(2),
    }))

    let propertyBreakdown: PropertyBreakdownDTO[] | undefined
    if (!propertyId && row?.prop_breakdown) {
      propertyBreakdown = row.prop_breakdown.map((pr) => ({
        propertyId: pr.property_id,
        propertyName: pr.property_name,
        totalInvoiced: new Prisma.Decimal(pr.total_invoiced).toFixed(2),
        totalCollected: new Prisma.Decimal(pr.total_collected).toFixed(2),
      }))
    }

    const directIncomeDec = new Prisma.Decimal(row?.recognized_direct_income ?? 0)
    const totalRecognizedRevenueDec = totalInvoicedDec.add(directIncomeDec)

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
      recognizedDirectIncome: directIncomeDec.toFixed(2),
      totalRecognizedRevenue: totalRecognizedRevenueDec.toFixed(2),
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
    if (diffDays > MAX_REPORT_RANGE_DAYS) {
      throw new BadRequestError(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days (10 years)`)
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
    const limit = Math.min(5000, Math.max(1, params.limit || 25))
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

    type QueryRowType = {
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
      invoiceId?: string | null
      invoiceNumber?: string | null
      invoiceTotalPaid?: string | null
      invoiceBalanceDue?: string | null
      specialRequests: string | null
      fullCount: bigint | number
    }

    let queryRows: QueryRowType[] = []
    const invoiceMap = new Map<
      string,
      { id: string; invoiceNumber: string; totalPaid: string; balanceDue: string }
    >()

    if (params.sort === "balance") {
      queryRows = await prisma.$queryRaw<QueryRowType[]>(Prisma.sql`
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
          LEFT JOIN receipts p ON p.invoice_id = i.id
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
    } else {
      queryRows = await prisma.$queryRaw<QueryRowType[]>(Prisma.sql`
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
          res.special_requests AS "specialRequests",
          COUNT(*) OVER() AS "fullCount"
        FROM reservation_rooms rr
        JOIN rooms rm ON rm.id = rr.room_id
        JOIN buildings bld ON bld.id = rm.building_id
        JOIN floors flr ON flr.id = rm.floor_id
        JOIN room_categories rc ON rc.id = rr.room_category_id
        JOIN reservations res ON res.id = rr.reservation_id
        JOIN customers cust ON cust.id = res.customer_id
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

      const resIds = Array.from(new Set(queryRows.map((r) => r.reservationId)))
      if (resIds.length > 0) {
        const invoices = await prisma.$queryRaw<
          Array<{
            id: string
            reservationId: string
            invoiceNumber: string
            totalPaid: string
            balanceDue: string
          }>
        >(Prisma.sql`
          SELECT
            i.id,
            i.reservation_id AS "reservationId",
            i.invoice_number AS "invoiceNumber",
            COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'RECORDED'), 0)::text AS "totalPaid",
            GREATEST(0, i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'RECORDED'), 0))::text AS "balanceDue"
          FROM invoices i
          LEFT JOIN receipts p ON p.invoice_id = i.id
          WHERE i.reservation_id IN (${Prisma.join(resIds)})
            AND i.status != 'VOID'
          GROUP BY i.id, i.reservation_id, i.invoice_number, i.grand_total, i.created_at
          ORDER BY i.created_at ASC
        `)

        for (const inv of invoices) {
          if (!invoiceMap.has(inv.reservationId)) {
            invoiceMap.set(inv.reservationId, inv)
          }
        }
      }
    }

    const total = queryRows.length > 0 ? Number(queryRows[0]?.fullCount ?? 0) : 0
    const rows: DailyOperationItemDTO[] = queryRows.map((r) => {
      const inv = invoiceMap.get(r.reservationId)
      return {
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
        invoiceId: r.invoiceId ?? inv?.id ?? null,
        invoiceNumber: r.invoiceNumber ?? inv?.invoiceNumber ?? null,
        invoiceGrandTotal: null,
        invoiceTotalPaid: r.invoiceTotalPaid ?? inv?.totalPaid ?? null,
        invoiceBalanceDue: r.invoiceBalanceDue ?? inv?.balanceDue ?? null,
        specialRequests: r.specialRequests,
      }
    })

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
              include: { receipts: { where: { status: ReceiptStatus.RECORDED } } },
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
              include: { receipts: { where: { status: ReceiptStatus.RECORDED } } },
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
              include: { receipts: { where: { status: ReceiptStatus.RECORDED } } },
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
              include: { receipts: { where: { status: ReceiptStatus.RECORDED } } },
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
        const paidDec = inv.receipts.reduce(
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

    // 1 & 2. Consolidated Room Inventory & Pagination Query (Resolves rooms, relations, and total count in 1 query)
    let effectivePropertyId = propertyId
    let resolvedCategoryId = options?.categoryId === "all" ? undefined : options?.categoryId
    const page = Math.max(1, options?.page || 1)
    const limit = Math.min(5000, Math.max(1, options?.limit || 25))
    const skip = (page - 1) * limit
    const searchPattern = options?.q?.trim() ? `%${options.q.trim()}%` : null

    if (!effectivePropertyId) {
      const firstProp = await prisma.property.findFirst({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
      if (firstProp) {
        effectivePropertyId = firstProp.id
      }
    }

    if (!resolvedCategoryId && options?.categoryId !== "all" && effectivePropertyId) {
      const firstCat = await prisma.roomCategory.findFirst({
        where: {
          OR: [{ propertyId: effectivePropertyId }, { propertyId: null }],
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
      if (firstCat) {
        resolvedCategoryId = firstCat.id
      }
    }

    // Query 1: Paginated rooms with relations, property name, and windowed total count
    const roomRows = await prisma.$queryRaw<Array<{
      id: string
      roomNo: string
      displayName: string | null
      capacity: number
      status: RoomStatus
      priceOverride: Prisma.Decimal | null
      buildingId: string
      buildingName: string
      floorId: string
      floorNo: number
      categoryId: string
      categoryName: string
      categoryBasePrice: Prisma.Decimal
      propertyId: string
      propertyName: string
      fullCount: number
    }>>`
      SELECT
        rm.id,
        rm.room_no as "roomNo",
        rm.display_name as "displayName",
        rm.capacity,
        rm.status,
        rm.price_override as "priceOverride",
        bld.id as "buildingId",
        bld.name as "buildingName",
        flr.id as "floorId",
        flr.floor_no as "floorNo",
        rc.id as "categoryId",
        rc.name as "categoryName",
        rc.base_price as "categoryBasePrice",
        p.id as "propertyId",
        p.name as "propertyName",
        COUNT(*) OVER()::int as "fullCount"
      FROM rooms rm
      JOIN buildings bld ON bld.id = rm.building_id
      JOIN floors flr ON flr.id = rm.floor_id
      JOIN room_categories rc ON rc.id = rm.room_category_id
      JOIN properties p ON p.id = rm.property_id
      WHERE (${effectivePropertyId ?? null}::text IS NULL OR rm.property_id = ${effectivePropertyId ?? null})
        AND (${resolvedCategoryId ?? null}::text IS NULL OR rm.room_category_id = ${resolvedCategoryId ?? null})
        AND (${buildingId ?? null}::text IS NULL OR rm.building_id = ${buildingId ?? null})
        AND (${options?.floorId ?? null}::text IS NULL OR rm.floor_id = ${options?.floorId ?? null})
        AND (${searchPattern}::text IS NULL OR rm.room_no ILIKE ${searchPattern})
      ORDER BY bld.name ASC, flr.floor_no ASC, rm.room_no ASC
      LIMIT ${limit} OFFSET ${skip};
    `

    const totalRooms = roomRows[0]?.fullCount ?? 0
    const propName = roomRows[0]?.propertyName || null
    const catName = roomRows[0]?.categoryName || null

    const physicalRooms = roomRows.map((r) => ({
      id: r.id,
      roomNo: r.roomNo,
      displayName: r.displayName,
      capacity: r.capacity,
      status: r.status,
      priceOverride: r.priceOverride ? new Prisma.Decimal(r.priceOverride) : null,
      building: { id: r.buildingId, name: r.buildingName },
      floor: { id: r.floorId, floorNo: r.floorNo },
      category: { id: r.categoryId, name: r.categoryName, basePrice: new Prisma.Decimal(r.categoryBasePrice) },
      propertyId: r.propertyId,
    }))

    // Query 2: Fetch overlapping allocations ONLY for the paginated room IDs
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
      selectedProperty: propName && effectivePropertyId ? { id: effectivePropertyId, name: propName } : undefined,
      selectedCategory: resolvedCategoryId ? { id: resolvedCategoryId, name: catName || "" } : null,
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
    options?: { page?: number; limit?: number; onlyInvoiceReceipts?: boolean }
  ): Promise<ShiftCollectionsReportDTO> {
    // Disambiguate positional parameters:
    // If startDateStr does not conform to YYYY-MM-DD, it may be propertyId
    // passed from shorthand calls such as getShiftCollections(todayStr, propertyId).
    let effectivePropertyId = propertyId
    let effectiveStartDateStr = startDateStr

    if (startDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      if (!effectivePropertyId) {
        effectivePropertyId = startDateStr
      }
      effectiveStartDateStr = undefined
    }

    const todayIso = getHotelTodayDate()
    const effectiveStart = effectiveStartDateStr || dateStr || todayIso
    const effectiveEnd = endDateStr || dateStr || todayIso

    // Explicit validation: reject invalid date formats early
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(effectiveStart)) {
      throw new BadRequestError(`Invalid startDate format: "${effectiveStart}". Expected YYYY-MM-DD`)
    }
    if (!dateRegex.test(effectiveEnd)) {
      throw new BadRequestError(`Invalid endDate format: "${effectiveEnd}". Expected YYYY-MM-DD`)
    }

    // Half-open range boundaries in HOTEL_TIMEZONE converted to UTC Date instances
    const startObj = getHotelDateBoundaryUtc(effectiveStart, HOTEL_TIMEZONE)
    const nextDayStr = addDaysToYmd(effectiveEnd, 1)
    const endObj = getHotelDateBoundaryUtc(nextDayStr, HOTEL_TIMEZONE)

    if (!(startObj instanceof Date) || isNaN(startObj.getTime())) {
      throw new BadRequestError(`Could not construct valid start Date object from "${effectiveStart}"`)
    }
    if (!(endObj instanceof Date) || isNaN(endObj.getTime())) {
      throw new BadRequestError(`Could not construct valid end Date object from "${effectiveEnd}"`)
    }

    const diffDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > MAX_REPORT_RANGE_DAYS) {
      throw new BadRequestError(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days (10 years)`)
    }

    const propertyFilterSql = effectivePropertyId ? Prisma.sql`AND p.property_id = ${effectivePropertyId}` : Prisma.empty
    const staffFilterSql = staffUserId
      ? Prisma.sql`AND (CASE WHEN p.status = 'VOIDED' AND p.voided_by IS NOT NULL THEN p.voided_by ELSE p.created_by END) = ${staffUserId}`
      : Prisma.empty
    const invoiceOnlyFilterSql = options?.onlyInvoiceReceipts ? Prisma.sql`AND p.invoice_id IS NOT NULL` : Prisma.empty

    const page = Math.max(1, options?.page || 1)
    const limit = Math.min(5000, Math.max(1, options?.limit || 25))
    const offset = (page - 1) * limit

    // 1. Consolidated Summary Query (Totals + Method Breakdown + Staff Breakdown via CTE)
    const summaryRows = await prisma.$queryRaw<Array<{
      total_count: number
      total_collected: Prisma.Decimal | string
      method_breakdown: Array<{
        payment_method: string
        count: number
        amount: number | string
      }> | null
      staff_breakdown: Array<{
        user_id: string
        user_name: string
        user_email: string
        payment_method: string
        method_amount: number | string
        total_count: number
      }> | null
    }>>`
      WITH base_filtered AS (
        SELECT
          p.id as payment_id,
          p.amount,
          p.payment_method_code as payment_method,
          CASE WHEN p.status = 'VOIDED' AND p.voided_by IS NOT NULL THEN p.voided_by ELSE p.created_by END as effective_staff_id,
          CASE 
            WHEN p.status = 'RECORDED' THEN p.amount
            WHEN p.status = 'VOIDED' AND p.voided_at AT TIME ZONE 'UTC' >= ${startObj} AND p.voided_at AT TIME ZONE 'UTC' < ${endObj} THEN -p.amount
            ELSE p.amount
          END as effective_amount
        FROM receipts p
        WHERE (
          (p.paid_at AT TIME ZONE 'UTC' >= ${startObj} AND p.paid_at AT TIME ZONE 'UTC' < ${endObj} AND (p.status = 'RECORDED' OR p.voided_at AT TIME ZONE 'UTC' >= ${endObj}))
          OR (p.voided_at AT TIME ZONE 'UTC' >= ${startObj} AND p.voided_at AT TIME ZONE 'UTC' < ${endObj} AND p.status = 'VOIDED')
        )
        ${propertyFilterSql}
        ${staffFilterSql}
        ${invoiceOnlyFilterSql}
      ),
      totals AS (
        SELECT
          COUNT(*)::int as total_count,
          COALESCE(SUM(effective_amount), 0) as total_collected
        FROM base_filtered
      ),
      method_summary AS (
        SELECT
          payment_method::text as payment_method,
          COUNT(*)::int as count,
          COALESCE(SUM(effective_amount), 0) as amount
        FROM base_filtered
        GROUP BY payment_method
      ),
      staff_summary AS (
        SELECT
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          bf.payment_method::text as payment_method,
          COALESCE(SUM(bf.effective_amount), 0) as method_amount,
          COUNT(*)::int as total_count
        FROM base_filtered bf
        JOIN users u ON u.id = bf.effective_staff_id
        GROUP BY u.id, u.name, u.email, bf.payment_method
      )
      SELECT
        (SELECT total_count FROM totals) as total_count,
        (SELECT total_collected FROM totals) as total_collected,
        COALESCE((SELECT json_agg(method_summary) FROM method_summary), '[]'::json) as method_breakdown,
        COALESCE((SELECT json_agg(staff_summary) FROM staff_summary), '[]'::json) as staff_breakdown;
    `

    const sumRow = summaryRows[0]
    const totalTransactions = sumRow?.total_count ?? 0
    const totalCollectedDec = new Prisma.Decimal(sumRow?.total_collected ?? 0)

    const methodBreakdown: PaymentMethodBreakdownDTO[] = (sumRow?.method_breakdown || []).map((m) => {
      const amt = new Prisma.Decimal(m.amount)
      const pct = totalCollectedDec.gt(0) ? amt.div(totalCollectedDec).mul(100).toNumber() : 0
      return {
        method: m.payment_method,
        amount: amt.toFixed(2),
        count: m.count,
        percentage: Math.round(pct * 10) / 10,
      }
    })

    const staffMap = new Map<string, {
      userId: string
      userName: string
      userEmail: string
      totalCollected: Prisma.Decimal
      paymentCount: number
      methods: Record<string, string>
    }>()

    for (const sr of sumRow?.staff_breakdown || []) {
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
      status: ReceiptStatus
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
        p.payment_method_code::text as payment_method,
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
      FROM receipts p
      JOIN users u ON u.id = p.created_by
      LEFT JOIN users vu ON vu.id = p.voided_by
      JOIN invoices inv ON inv.id = p.invoice_id
      LEFT JOIN reservations r ON r.id = inv.reservation_id
      LEFT JOIN customers c ON c.id = r.customer_id
      WHERE (
        (p.paid_at AT TIME ZONE 'UTC' >= ${startObj} AND p.paid_at AT TIME ZONE 'UTC' < ${endObj} AND (p.status = 'RECORDED' OR p.voided_at AT TIME ZONE 'UTC' >= ${endObj}))
        OR (p.voided_at AT TIME ZONE 'UTC' >= ${startObj} AND p.voided_at AT TIME ZONE 'UTC' < ${endObj} AND p.status = 'VOIDED')
      )
      ${propertyFilterSql}
      ${staffFilterSql}
      ORDER BY COALESCE(p.voided_at, p.paid_at) DESC, p.id DESC
      LIMIT ${limit} OFFSET ${offset};
    `

    const transactions: PaymentTransactionDTO[] = txRows.map((tx) => {
      const isVoidInThisRange =
        tx.status === ReceiptStatus.VOIDED &&
        Boolean(tx.voided_at && tx.voided_at >= startObj && tx.voided_at < endObj)
      const isVoid = isVoidInThisRange
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
        paidAt: (isVoid && tx.voided_at ? tx.voided_at : tx.paid_at).toISOString(),
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
    options?: { page?: number; limit?: number; asOfDate?: string }
  ): Promise<ReceivablesReportDTO> {
    const asOfDateStr = options?.asOfDate || getHotelTodayDate()
    const asOfDateObj = new Date(`${asOfDateStr}T23:59:59.999Z`)
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
            (${asOfDateStr}::date - i.created_at::date) AS days_aging
          FROM invoices i
          LEFT JOIN LATERAL (
            SELECT SUM(amount) AS paid 
            FROM receipts 
            WHERE invoice_id = i.id
              AND paid_at <= ${asOfDateObj}
              AND (status = 'RECORDED' OR voided_at > ${asOfDateObj})
          ) p ON true
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(
                (SELECT 'IN_HOUSE' FROM reservation_rooms rr WHERE rr.reservation_id = i.reservation_id AND rr.status = 'CHECKED_IN' LIMIT 1),
                (SELECT 'FUTURE' FROM reservation_rooms rr WHERE rr.reservation_id = i.reservation_id AND rr.status = 'CONFIRMED' LIMIT 1),
                'DEPARTED'
              ) AS stay_status
          ) st ON true
          WHERE i.created_at <= ${asOfDateObj}
            AND i.status <> 'VOID'
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

    const sum = await scopedCached(`receivables-summary-${asOfDateStr}`, propertyId, 60, fetchSummary)

    const page = Math.max(1, options?.page || 1)
    const limit = Math.min(5000, Math.max(1, options?.limit || 25))
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
        COALESCE(r.customer_id, i.customer_id) AS customer_id,
        r.status AS reservation_status,
        COALESCE(c.first_name, i.customer_name, 'Guest') AS first_name,
        c.last_name,
        c.phone,
        c.email,
        i.created_at AS issue_date,
        i.grand_total,
        COALESCE(p.paid, 0) AS total_paid,
        (i.grand_total - COALESCE(p.paid, 0)) AS balance_due,
        (${asOfDateStr}::date - i.created_at::date)::int AS days_aging,
        st.stay_status,
        (st.stay_status = 'IN_HOUSE') AS is_guest_in_house,
        CASE
          WHEN (${asOfDateStr}::date - i.created_at::date) <= 7 THEN '0-7'
          WHEN (${asOfDateStr}::date - i.created_at::date) <= 30 THEN '8-30'
          WHEN (${asOfDateStr}::date - i.created_at::date) <= 60 THEN '31-60'
          ELSE '60+'
        END AS aging_bucket,
        (
          SELECT array_agg(rm.room_no)
          FROM reservation_rooms rr
          JOIN rooms rm ON rm.id = rr.room_id
          WHERE rr.reservation_id = r.id
        ) AS room_numbers
      FROM invoices i
      LEFT JOIN reservations r ON r.id = i.reservation_id
      LEFT JOIN customers c ON c.id = COALESCE(r.customer_id, i.customer_id)
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS paid 
        FROM receipts 
        WHERE invoice_id = i.id
          AND paid_at <= ${asOfDateObj}
          AND (status = 'RECORDED' OR voided_at > ${asOfDateObj})
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            (SELECT 'IN_HOUSE' FROM reservation_rooms rr WHERE rr.reservation_id = i.reservation_id AND rr.status = 'CHECKED_IN' LIMIT 1),
            (SELECT 'FUTURE' FROM reservation_rooms rr WHERE rr.reservation_id = i.reservation_id AND rr.status = 'CONFIRMED' LIMIT 1),
            'DEPARTED'
          ) AS stay_status
      ) st ON true
      WHERE i.created_at <= ${asOfDateObj}
        AND i.status <> 'VOID'
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
      asOfDate: asOfDateStr,
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
      if (diffDays > MAX_REPORT_RANGE_DAYS) {
        throw new BadRequestError(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days (10 years)`)
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
    const limit = Math.min(5000, Math.max(1, options?.limit || 25))
    const offset = (page - 1) * limit

    // 1. Consolidated totals query in SQL
    const totalRows = await prisma.$queryRaw<Array<{
      inv_count: number
      inv_total_discount: Prisma.Decimal | string
      rate_count: number
      rate_total_variance: Prisma.Decimal | string
    }>>`
      WITH inv_disc AS (
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
          )
      ),
      rate_disc AS (
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
          AND rr.booked_nightly_rate < rc.base_price
      )
      SELECT
        (SELECT count FROM inv_disc)::int as inv_count,
        (SELECT total_discount FROM inv_disc) as inv_total_discount,
        (SELECT count FROM rate_disc)::int as rate_count,
        (SELECT total_variance FROM rate_disc) as rate_total_variance;
    `
    const tot = totalRows[0]
    const discountedInvoicesCount = tot?.inv_count ?? 0
    const totalInvoiceDiscountsDec = new Prisma.Decimal(tot?.inv_total_discount ?? 0)
    const rateOverridesCount = tot?.rate_count ?? 0
    const totalRateOverrideDiscountsDec = new Prisma.Decimal(tot?.rate_total_variance ?? 0)
    const totalConcessionDec = totalInvoiceDiscountsDec.add(totalRateOverrideDiscountsDec)

    // 2. Paginated invoice discounts (with inline items via JSON) & rate overrides in a single consolidated page query
    const pageRows = await prisma.$queryRaw<Array<{
      inv_rows: Array<{
        invoice_id: string
        invoice_number: string
        reservation_id: string
        reservation_no: string
        first_name: string
        last_name: string | null
        discount_total: Prisma.Decimal | number | string
        created_at: Date | string
        items: Array<{
          description: string
          unitPrice: number | string
          lineTotal: number | string
        }> | null
      }>
      rate_rows: Array<{
        allocation_id: string
        reservation_id: string
        reservation_no: string
        room_no: string
        category_name: string
        base_price: Prisma.Decimal | number | string
        booked_rate: Prisma.Decimal | number | string
        rate_variance: Prisma.Decimal | number | string
        nights: number
        total_variance: Prisma.Decimal | number | string
        arrival_date: Date | string
        departure_date: Date | string
      }>
    }>>`
      WITH inv_page AS (
        SELECT
          inv.id as invoice_id,
          inv.invoice_number,
          inv.reservation_id,
          r.reservation_no,
          c.first_name,
          c.last_name,
          inv.discount_total,
          inv.created_at,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'description', ii.description,
              'unitPrice', ii.unit_price,
              'lineTotal', ii.line_total
            )), '[]'::json)
            FROM invoice_items ii
            WHERE ii.invoice_id = inv.id AND ii.item_type = 'DISCOUNT'
          ) as items
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
        LIMIT ${limit} OFFSET ${offset}
      ),
      rate_page AS (
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
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT
        COALESCE((SELECT json_agg(inv_page.*) FROM inv_page), '[]'::json) as inv_rows,
        COALESCE((SELECT json_agg(rate_page.*) FROM rate_page), '[]'::json) as rate_rows;
    `
    const invPageRows = pageRows[0]?.inv_rows ?? []
    const ratePageRows = pageRows[0]?.rate_rows ?? []

    const invoiceDiscounts: InvoiceDiscountItemDTO[] = invPageRows.map((inv) => {
      const discItems = (inv.items || []).map((item) => ({
        description: item.description,
        unitPrice: new Prisma.Decimal(item.unitPrice).toFixed(2),
        lineTotal: new Prisma.Decimal(item.lineTotal).toFixed(2),
      }))
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
        createdAt:
          inv.created_at instanceof Date
            ? inv.created_at.toISOString()
            : new Date(
                typeof inv.created_at === "string" && !inv.created_at.includes("Z")
                  ? `${inv.created_at}Z`
                  : inv.created_at
              ).toISOString(),
      }
    })

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

  /**
   * Generates Direct Income Report:
   * Categorizes direct non-invoice hotel revenues by income head and status.
   * Invariant: Clearly distinguishes expected/billed amount from recognized realized receipts.
   * Excludes voided receipts and voided incomes.
   */
  static async getIncomeReport(params: {
    startDate: string
    endDate: string
    propertyId: string
    incomeHeadId?: string
    status?: string
    page?: number
    limit?: number
  }): Promise<IncomeReportDTO> {
    const { startDate, endDate, propertyId, incomeHeadId, status } = params
    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)

    const page = Math.max(1, params.page || 1)
    const limit = Math.min(5000, Math.max(1, params.limit || 25))
    const offset = (page - 1) * limit

    let mappedStatus: IncomeStatus | undefined
    if (status && status !== "ALL") {
      if (status === "RECORDED") mappedStatus = IncomeStatus.RECEIVED
      else if (status === "PARTIALLY_PAID") mappedStatus = IncomeStatus.PARTIALLY_RECEIVED
      else if (Object.values(IncomeStatus).includes(status as IncomeStatus)) {
        mappedStatus = status as IncomeStatus
      }
    }

    const whereClause: Prisma.IncomeWhereInput = {
      propertyId,
      incomeDate: { gte: startObj, lte: endObj },
      ...(incomeHeadId ? { incomeHeadId } : {}),
      ...(mappedStatus
        ? mappedStatus === IncomeStatus.VOID
          ? { status: IncomeStatus.VOID }
          : {
              status: mappedStatus,
              OR: [
                { status: { not: IncomeStatus.VOID } },
                { voidedAt: { gt: endObj } },
              ],
            }
        : {
            OR: [
              { status: { not: IncomeStatus.VOID } },
              { voidedAt: { gt: endObj } },
            ],
          }),
    }

    const [totalCount, incomes] = await Promise.all([
      prisma.income.count({ where: whereClause }),
      prisma.income.findMany({
        where: whereClause,
        include: {
          incomeHead: { select: { name: true, code: true } },
          creator: { select: { name: true } },
          receipts: {
            where: {
              paidAt: { lte: endObj },
              OR: [
                { status: "RECORDED" },
                { voidedAt: { gt: endObj } },
              ],
            },
            select: { amount: true },
          },
        },
        orderBy: [{ incomeDate: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: limit,
      }),
    ])

    const incomeHeads = await prisma.incomeHead.findMany({
      where: { propertyId },
      select: { id: true, name: true, code: true },
    })
    const headMap = new Map(incomeHeads.map((h) => [h.id, h]))

    const allIncomesSummary = await prisma.income.findMany({
      where: whereClause,
      select: {
        id: true,
        incomeHeadId: true,
        expectedAmount: true,
        receipts: {
          where: {
            paidAt: { lte: endObj },
            OR: [
              { status: "RECORDED" },
              { voidedAt: { gt: endObj } },
            ],
          },
          select: { amount: true },
        },
      },
    })

    let totalExpectedDec = new Prisma.Decimal(0)
    let totalReceivedDec = new Prisma.Decimal(0)
    const categoryTotals = new Map<string, { expected: Prisma.Decimal; received: Prisma.Decimal; count: number }>()

    for (const inc of allIncomesSummary) {
      const exp = new Prisma.Decimal(inc.expectedAmount)
      const rec = inc.receipts.reduce((acc, r) => acc.add(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0))
      totalExpectedDec = totalExpectedDec.add(exp)
      totalReceivedDec = totalReceivedDec.add(rec)

      const existing = categoryTotals.get(inc.incomeHeadId) || {
        expected: new Prisma.Decimal(0),
        received: new Prisma.Decimal(0),
        count: 0,
      }
      existing.expected = existing.expected.add(exp)
      existing.received = existing.received.add(rec)
      existing.count += 1
      categoryTotals.set(inc.incomeHeadId, existing)
    }

    const totalPendingDec = totalExpectedDec.sub(totalReceivedDec)
    const totalPendingAmount = totalPendingDec.gt(0) ? totalPendingDec.toFixed(2) : "0.00"

    const categoryBreakdown: IncomeCategorySummaryDTO[] = Array.from(categoryTotals.entries()).map(([headId, data]) => {
      const h = headMap.get(headId)
      return {
        categoryName: h?.name || "Direct Income",
        categoryCode: h?.code || "OTHER",
        expectedAmount: data.expected.toFixed(2),
        receivedAmount: data.received.toFixed(2),
        incomeCount: data.count,
      }
    })

    const items: IncomeReportItemDTO[] = incomes.map((inc) => {
      const exp = new Prisma.Decimal(inc.expectedAmount)
      const rec = inc.receipts.reduce((acc, r) => acc.add(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0))
      const pending = exp.sub(rec)
      return {
        id: inc.id,
        incomeDate: inc.incomeDate instanceof Date ? inc.incomeDate.toISOString().split("T")[0]! : String(inc.incomeDate).slice(0, 10),
        title: inc.title,
        categoryName: inc.incomeHead.name,
        categoryCode: inc.incomeHead.code,
        expectedAmount: exp.toFixed(2),
        receivedAmount: rec.toFixed(2),
        pendingAmount: pending.gt(0) ? pending.toFixed(2) : "0.00",
        status: inc.status,
        receiptCount: inc.receipts.length,
        creatorName: inc.creator.name,
        createdAt: inc.createdAt.toISOString(),
      }
    })

    const totalReceiptsCount = incomes.reduce((acc, inc) => acc + inc.receipts.length, 0)

    return {
      startDate,
      endDate,
      totalExpectedAmount: totalExpectedDec.toFixed(2),
      totalReceivedAmount: totalReceivedDec.toFixed(2),
      totalPendingAmount,
      incomeCount: totalCount,
      receiptCount: totalReceiptsCount,
      categoryBreakdown,
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    }
  }

  /**
   * Generates Operating Expense Report:
   * Categorizes operating expenditures by expense head and vendor.
   * Invariant: Clearly separates recorded expenses (incurred obligations) from actual outgoing payments.
   */
  static async getExpenseReport(params: {
    startDate: string
    endDate: string
    propertyId: string
    expenseHeadId?: string
    status?: string
    page?: number
    limit?: number
  }): Promise<ExpenseReportDTO> {
    const { startDate, endDate, propertyId, expenseHeadId, status } = params
    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)

    const page = Math.max(1, params.page || 1)
    const limit = Math.min(5000, Math.max(1, params.limit || 25))
    const offset = (page - 1) * limit

    let mappedExpenseStatus: ExpenseStatus | undefined
    if (status && status !== "ALL") {
      if (status === "RECORDED") mappedExpenseStatus = ExpenseStatus.PAID
      else if (Object.values(ExpenseStatus).includes(status as ExpenseStatus)) {
        mappedExpenseStatus = status as ExpenseStatus
      }
    }

    const whereClause: Prisma.ExpenseWhereInput = {
      propertyId,
      expenseDate: { gte: startObj, lte: endObj },
      ...(expenseHeadId ? { expenseHeadId } : {}),
      ...(mappedExpenseStatus
        ? mappedExpenseStatus === ExpenseStatus.VOID
          ? { status: ExpenseStatus.VOID }
          : {
              status: mappedExpenseStatus,
              OR: [
                { status: { not: ExpenseStatus.VOID } },
                { voidedAt: { gt: endObj } },
              ],
            }
        : {
            OR: [
              { status: { not: ExpenseStatus.VOID } },
              { voidedAt: { gt: endObj } },
            ],
          }),
    }

    const [totalCount, expenses, allExpensesSummary, expenseHeads] = await Promise.all([
      prisma.expense.count({ where: whereClause }),
      prisma.expense.findMany({
        where: whereClause,
        include: {
          expenseHead: { select: { name: true, code: true } },
          creator: { select: { name: true } },
          payments: {
            where: {
              paidAt: { lte: endObj },
              OR: [
                { status: "RECORDED" },
                { voidedAt: { gt: endObj } },
              ],
            },
            select: { amount: true },
          },
        },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: limit,
      }),
      prisma.expense.findMany({
        where: whereClause,
        select: {
          id: true,
          expenseHeadId: true,
          amount: true,
          payments: {
            where: {
              paidAt: { lte: endObj },
              OR: [
                { status: "RECORDED" },
                { voidedAt: { gt: endObj } },
              ],
            },
            select: { amount: true },
          },
        },
      }),
      prisma.expenseHead.findMany({
        where: { propertyId },
        select: { id: true, name: true, code: true },
      }),
    ])

    const headMap = new Map(expenseHeads.map((h) => [h.id, h]))

    let totalRecordedDec = new Prisma.Decimal(0)
    let totalDisbursedDec = new Prisma.Decimal(0)
    let totalPaymentCount = 0
    const categoryTotals = new Map<string, { recorded: Prisma.Decimal; disbursed: Prisma.Decimal; count: number }>()

    for (const exp of allExpensesSummary) {
      const rec = new Prisma.Decimal(exp.amount)
      const disb = exp.payments.reduce((acc, p) => acc.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0))
      totalRecordedDec = totalRecordedDec.add(rec)
      totalDisbursedDec = totalDisbursedDec.add(disb)
      totalPaymentCount += exp.payments.length

      const existing = categoryTotals.get(exp.expenseHeadId) || {
        recorded: new Prisma.Decimal(0),
        disbursed: new Prisma.Decimal(0),
        count: 0,
      }
      existing.recorded = existing.recorded.add(rec)
      existing.disbursed = existing.disbursed.add(disb)
      existing.count += 1
      categoryTotals.set(exp.expenseHeadId, existing)
    }

    const totalPendingDec = totalRecordedDec.sub(totalDisbursedDec)
    const totalPendingPayables = totalPendingDec.gt(0) ? totalPendingDec.toFixed(2) : "0.00"

    const categoryBreakdown: ExpenseCategorySummaryDTO[] = Array.from(categoryTotals.entries()).map(([headId, data]) => {
      const h = headMap.get(headId)
      const pending = data.recorded.sub(data.disbursed)
      return {
        categoryName: h?.name || "Operating Expense",
        categoryCode: h?.code || "MISC",
        recordedAmount: data.recorded.toFixed(2),
        disbursedAmount: data.disbursed.toFixed(2),
        pendingAmount: pending.gt(0) ? pending.toFixed(2) : "0.00",
        expenseCount: data.count,
      }
    })

    const items: ExpenseReportItemDTO[] = expenses.map((exp) => {
      const recorded = new Prisma.Decimal(exp.amount)
      const disbursed = exp.payments.reduce((acc, p) => acc.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0))
      const pending = recorded.sub(disbursed)
      return {
        id: exp.id,
        expenseDate: exp.expenseDate instanceof Date ? exp.expenseDate.toISOString().split("T")[0]! : String(exp.expenseDate).slice(0, 10),
        title: exp.title,
        categoryName: exp.expenseHead.name,
        categoryCode: exp.expenseHead.code,
        vendorName: exp.vendorName,
        referenceNumber: exp.referenceNumber,
        recordedAmount: recorded.toFixed(2),
        disbursedAmount: disbursed.toFixed(2),
        pendingPayable: pending.gt(0) ? pending.toFixed(2) : "0.00",
        status: exp.status,
        paymentCount: exp.payments.length,
        creatorName: exp.creator.name,
        createdAt: exp.createdAt.toISOString(),
      }
    })

    return {
      startDate,
      endDate,
      totalRecordedExpenses: totalRecordedDec.toFixed(2),
      totalDisbursedPayments: totalDisbursedDec.toFixed(2),
      totalPendingPayables,
      expenseCount: totalCount,
      paymentCount: totalPaymentCount,
      categoryBreakdown,
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    }
  }

  /**
   * Generates Cash Flow Report:
   * Realized cash inflows (receipts) vs actual cash disbursements (payments).
   * Invariants:
   * 1. Strictly excludes inter-account transfers.
   * 2. Strictly excludes voided receipts and voided payments.
   * 3. Calculates daily trend and account breakdown.
   */
  static async getCashFlowReport(filters: ReportFilterDTO): Promise<CashFlowReportDTO> {
    const { startDate, endDate, propertyId } = filters
    if (!propertyId) {
      throw new BadRequestError("propertyId is required for Cash Flow Report")
    }

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)

    const [receipts, payments, accounts] = await Promise.all([
      prisma.receipt.findMany({
        where: {
          propertyId,
          paidAt: { gte: startObj, lte: endObj },
          OR: [
            { status: "RECORDED" },
            { voidedAt: { gt: endObj } },
          ],
        },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          accountId: true,
          invoiceId: true,
          incomeId: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          propertyId,
          paidAt: { gte: startObj, lte: endObj },
          OR: [
            { status: "RECORDED" },
            { voidedAt: { gt: endObj } },
          ],
        },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          accountId: true,
          expense: {
            select: {
              expenseHeadId: true,
              expenseHead: { select: { name: true, code: true } },
            },
          },
        },
      }),
      prisma.financialAccount.findMany({
        where: { propertyId, isActive: true },
        select: { id: true, accountName: true, accountType: true },
      }),
    ])

    let totalInflowsDec = new Prisma.Decimal(0)
    let invoiceInflowsDec = new Prisma.Decimal(0)
    let invoiceReceiptCount = 0
    let directIncomeInflowsDec = new Prisma.Decimal(0)
    let directIncomeReceiptCount = 0

    const dailyMap = new Map<string, { inflows: Prisma.Decimal; outflows: Prisma.Decimal; rCount: number; pCount: number }>()
    const accountMap = new Map<string, { inflows: Prisma.Decimal; outflows: Prisma.Decimal }>()

    for (const a of accounts) {
      accountMap.set(a.id, { inflows: new Prisma.Decimal(0), outflows: new Prisma.Decimal(0) })
    }

    for (const r of receipts) {
      const amt = new Prisma.Decimal(r.amount)
      totalInflowsDec = totalInflowsDec.add(amt)

      if (r.invoiceId) {
        invoiceInflowsDec = invoiceInflowsDec.add(amt)
        invoiceReceiptCount += 1
      } else if (r.incomeId) {
        directIncomeInflowsDec = directIncomeInflowsDec.add(amt)
        directIncomeReceiptCount += 1
      }

      const dayKey = getHotelTodayDate(r.paidAt)
      const d = dailyMap.get(dayKey) || {
        inflows: new Prisma.Decimal(0),
        outflows: new Prisma.Decimal(0),
        rCount: 0,
        pCount: 0,
      }
      d.inflows = d.inflows.add(amt)
      d.rCount += 1
      dailyMap.set(dayKey, d)

      if (r.accountId) {
        const acc = accountMap.get(r.accountId) || { inflows: new Prisma.Decimal(0), outflows: new Prisma.Decimal(0) }
        acc.inflows = acc.inflows.add(amt)
        accountMap.set(r.accountId, acc)
      }
    }

    let totalOutflowsDec = new Prisma.Decimal(0)
    const expenseHeadTotals = new Map<string, { amount: Prisma.Decimal; count: number; name: string; code: string }>()

    for (const p of payments) {
      const amt = new Prisma.Decimal(p.amount)
      totalOutflowsDec = totalOutflowsDec.add(amt)

      const headId = p.expense?.expenseHeadId || "OTHER"
      const headName = p.expense?.expenseHead?.name || "Operating Expense"
      const headCode = p.expense?.expenseHead?.code || "MISC"

      const existing = expenseHeadTotals.get(headId) || {
        amount: new Prisma.Decimal(0),
        count: 0,
        name: headName,
        code: headCode,
      }
      existing.amount = existing.amount.add(amt)
      existing.count += 1
      expenseHeadTotals.set(headId, existing)

      const dayKey = getHotelTodayDate(p.paidAt)
      const d = dailyMap.get(dayKey) || {
        inflows: new Prisma.Decimal(0),
        outflows: new Prisma.Decimal(0),
        rCount: 0,
        pCount: 0,
      }
      d.outflows = d.outflows.add(amt)
      d.pCount += 1
      dailyMap.set(dayKey, d)

      if (p.accountId) {
        const acc = accountMap.get(p.accountId) || { inflows: new Prisma.Decimal(0), outflows: new Prisma.Decimal(0) }
        acc.outflows = acc.outflows.add(amt)
        accountMap.set(p.accountId, acc)
      }
    }

    const netCashFlowDec = totalInflowsDec.sub(totalOutflowsDec)

    const sDate = new Date(`${startDate}T00:00:00.000Z`)
    const eDate = new Date(`${endDate}T00:00:00.000Z`)
    const dailyBreakdown: DailyCashFlowDTO[] = []

    for (let cur = new Date(sDate); cur <= eDate; cur.setDate(cur.getDate() + 1)) {
      const k = cur.toISOString().split("T")[0]!
      const d = dailyMap.get(k) || {
        inflows: new Prisma.Decimal(0),
        outflows: new Prisma.Decimal(0),
        rCount: 0,
        pCount: 0,
      }
      dailyBreakdown.push({
        date: k,
        inflows: d.inflows.toFixed(2),
        outflows: d.outflows.toFixed(2),
        netCashFlow: d.inflows.sub(d.outflows).toFixed(2),
        receiptCount: d.rCount,
        paymentCount: d.pCount,
      })
    }

    const inflowSources: CashFlowInflowSourceDTO[] = [
      {
        source: "GUEST_INVOICE",
        amount: invoiceInflowsDec.toFixed(2),
        count: invoiceReceiptCount,
        percentage: totalInflowsDec.gt(0)
          ? Math.round(invoiceInflowsDec.div(totalInflowsDec).mul(100).toNumber() * 10) / 10
          : 0,
      },
      {
        source: "DIRECT_INCOME",
        amount: directIncomeInflowsDec.toFixed(2),
        count: directIncomeReceiptCount,
        percentage: totalInflowsDec.gt(0)
          ? Math.round(directIncomeInflowsDec.div(totalInflowsDec).mul(100).toNumber() * 10) / 10
          : 0,
      },
    ]

    const outflowCategories: CashFlowOutflowCategoryDTO[] = Array.from(expenseHeadTotals.values()).map((eh) => {
      const pct = totalOutflowsDec.gt(0)
        ? Math.round(eh.amount.div(totalOutflowsDec).mul(100).toNumber() * 10) / 10
        : 0
      return {
        categoryName: eh.name,
        categoryCode: eh.code,
        amount: eh.amount.toFixed(2),
        count: eh.count,
        percentage: pct,
      }
    })

    const accountSummaries: CashFlowAccountSummaryDTO[] = accounts.map((a) => {
      const accData = accountMap.get(a.id) || { inflows: new Prisma.Decimal(0), outflows: new Prisma.Decimal(0) }
      return {
        accountId: a.id,
        accountName: a.accountName,
        accountType: a.accountType,
        inflows: accData.inflows.toFixed(2),
        outflows: accData.outflows.toFixed(2),
        netChange: accData.inflows.sub(accData.outflows).toFixed(2),
      }
    })

    return {
      startDate,
      endDate,
      totalInflows: totalInflowsDec.toFixed(2),
      totalOutflows: totalOutflowsDec.toFixed(2),
      netCashFlow: netCashFlowDec.toFixed(2),
      receiptCount: receipts.length,
      paymentCount: payments.length,
      dailyBreakdown,
      inflowSources,
      outflowCategories,
      accountSummaries,
    }
  }

  /**
   * Generates Revenue vs Expense Report:
   * Computes Recognized Revenue vs Incurred Operating Expenses and Net Operating Result.
   * Compares Accrual/Recognized basis against actual Cash Movement.
   */
  static async getRevenueVsExpenseReport(filters: ReportFilterDTO): Promise<RevenueVsExpenseReportDTO> {
    const { startDate, endDate, propertyId } = filters
    if (!propertyId) {
      throw new BadRequestError("propertyId is required for Revenue vs Expense Report")
    }

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)

    const [invoices, directIncomeReceipts, recordedExpenses, cashReceipts, cashPayments] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          propertyId,
          createdAt: { gte: startObj, lte: endObj },
          status: { not: "VOID" },
        },
        include: {
          items: true,
        },
      }),
      prisma.receipt.aggregate({
        where: {
          propertyId,
          incomeId: { not: null },
          paidAt: { gte: startObj, lte: endObj },
          OR: [
            { status: "RECORDED" },
            { voidedAt: { gt: endObj } },
          ],
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          propertyId,
          expenseDate: { gte: startObj, lte: endObj },
          OR: [
            { status: { not: "VOID" } },
            { voidedAt: { gt: endObj } },
          ],
        },
        _sum: { amount: true },
      }),
      prisma.receipt.aggregate({
        where: {
          propertyId,
          paidAt: { gte: startObj, lte: endObj },
          OR: [
            { status: "RECORDED" },
            { voidedAt: { gt: endObj } },
          ],
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          propertyId,
          paidAt: { gte: startObj, lte: endObj },
          OR: [
            { status: "RECORDED" },
            { voidedAt: { gt: endObj } },
          ],
        },
        _sum: { amount: true },
      }),
    ])

    let roomChargesDec = new Prisma.Decimal(0)
    let extraChargesDec = new Prisma.Decimal(0)
    let taxTotalDec = new Prisma.Decimal(0)
    let discountTotalDec = new Prisma.Decimal(0)
    let netInvoicedDec = new Prisma.Decimal(0)

    for (const inv of invoices) {
      netInvoicedDec = netInvoicedDec.add(new Prisma.Decimal(inv.grandTotal))
      taxTotalDec = taxTotalDec.add(new Prisma.Decimal(inv.taxTotal))
      discountTotalDec = discountTotalDec.add(new Prisma.Decimal(inv.discountTotal))

      for (const it of inv.items) {
        const amt = new Prisma.Decimal(it.lineTotal)
        if (it.itemType === InvoiceItemType.ROOM_CHARGE) {
          roomChargesDec = roomChargesDec.add(amt)
        } else {
          extraChargesDec = extraChargesDec.add(amt)
        }
      }
    }

    const recognizedDirectIncomeDec = new Prisma.Decimal(directIncomeReceipts._sum.amount || 0)
    const totalRecognizedRevenueDec = netInvoicedDec.add(recognizedDirectIncomeDec)

    const totalRecordedExpensesDec = new Prisma.Decimal(recordedExpenses._sum.amount || 0)
    const netOperatingResultDec = totalRecognizedRevenueDec.sub(totalRecordedExpensesDec)

    const operatingMarginPct = totalRecognizedRevenueDec.gt(0)
      ? Math.round(netOperatingResultDec.div(totalRecognizedRevenueDec).mul(100).toNumber() * 10) / 10
      : 0

    const totalCashReceiptsDec = new Prisma.Decimal(cashReceipts._sum.amount || 0)
    const totalCashDisbursementsDec = new Prisma.Decimal(cashPayments._sum.amount || 0)
    const netCashMovementDec = totalCashReceiptsDec.sub(totalCashDisbursementsDec)

    return {
      startDate,
      endDate,
      invoicedRoomCharges: roomChargesDec.toFixed(2),
      invoicedExtraCharges: extraChargesDec.toFixed(2),
      invoicedTaxes: taxTotalDec.toFixed(2),
      invoicedDiscounts: discountTotalDec.toFixed(2),
      netInvoicedRevenue: netInvoicedDec.toFixed(2),
      recognizedDirectIncome: recognizedDirectIncomeDec.toFixed(2),
      totalRecognizedRevenue: totalRecognizedRevenueDec.toFixed(2),
      totalRecordedExpenses: totalRecordedExpensesDec.toFixed(2),
      netOperatingResult: netOperatingResultDec.toFixed(2),
      operatingMarginPercentage: operatingMarginPct,
      totalCashReceipts: totalCashReceiptsDec.toFixed(2),
      totalCashDisbursements: totalCashDisbursementsDec.toFixed(2),
      netCashMovement: netCashMovementDec.toFixed(2),
    }
  }

  /**
   * Generates Room Performance Report:
   * Evaluates occupancy, room revenue, ADR, RevPAR, and maintenance status per physical room.
   * Invariant: Attributed via ReservationRoom allocations and snapshotted nightly rates,
   * never by assuming invoice totals can be attributed directly to rooms.
   */
  static async getRoomPerformanceReport(params: {
    startDate: string
    endDate: string
    propertyId: string
    categoryId?: string
    page?: number
    limit?: number
  }): Promise<RoomPerformanceReportDTO> {
    const { startDate, endDate, propertyId, categoryId } = params
    const s = new Date(`${startDate}T00:00:00.000Z`).getTime()
    const e = new Date(`${endDate}T00:00:00.000Z`).getTime()
    if (e < s) {
      throw new BadRequestError("endDate must be on or after startDate")
    }
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24))
    if (diffDays > MAX_REPORT_RANGE_DAYS) {
      throw new BadRequestError(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days (10 years)`)
    }
    const totalDays = diffDays + 1
    const todayUtcStr = getHotelTodayDateUtc().toISOString().split("T")[0]!

    const page = Math.max(1, params.page || 1)
    const limit = Math.min(5000, Math.max(1, params.limit || 25))
    const offset = (page - 1) * limit

    const categoryFilterSql = categoryId ? Prisma.sql`AND rm.room_category_id = ${categoryId}` : Prisma.empty

    const [countRows, roomRows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COUNT(*)::int as total
        FROM rooms rm
        WHERE rm.property_id = ${propertyId}
        ${categoryFilterSql};
      `,
      prisma.$queryRaw<Array<{
        room_id: string
        room_no: string
        display_name: string | null
        category_name: string
        floor_no: number
        building_name: string
        current_status: RoomStatus
        nights_sold: number
        room_revenue: Prisma.Decimal
      }>>`
        SELECT
          rm.id as room_id,
          rm.room_no,
          rm.display_name,
          rc.name as category_name,
          f.floor_no,
          b.name as building_name,
          rm.status as current_status,
          COALESCE(SUM(alloc.nights), 0)::int as nights_sold,
          COALESCE(SUM(alloc.rev), 0) as room_revenue
        FROM rooms rm
        JOIN room_categories rc ON rc.id = rm.room_category_id
        JOIN buildings b ON b.id = rm.building_id
        JOIN floors f ON f.id = rm.floor_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int as nights,
            COALESCE(SUM(rr.booked_nightly_rate), 0) as rev
          FROM reservation_rooms rr
          CROSS JOIN LATERAL generate_series(
            GREATEST(rr.arrival_date, ${startDate}::date),
            LEAST(COALESCE(rr.actual_checkout_date, rr.departure_date) - 1, ${endDate}::date),
            '1 day'::interval
          ) d(dt)
          WHERE rr.room_id = rm.id
            AND rr.arrival_date <= ${endDate}::date
            AND COALESCE(rr.actual_checkout_date, rr.departure_date) > ${startDate}::date
            AND (
              rr.status IN ('CHECKED_IN', 'CHECKED_OUT')
              OR (rr.status = 'CONFIRMED' AND d.dt::date >= ${todayUtcStr}::date)
            )
        ) alloc ON true
        WHERE rm.property_id = ${propertyId}
        ${categoryFilterSql}
        GROUP BY rm.id, rm.room_no, rm.display_name, rc.name, f.floor_no, b.name, rm.status
        ORDER BY rm.room_no ASC
        LIMIT ${limit} OFFSET ${offset};
      `,
    ])

    const totalRoomsCount = countRows[0]?.total || 0

    let totalNightsSold = 0
    let totalRoomRevenueDec = new Prisma.Decimal(0)

    const rooms: RoomPerformanceItemDTO[] = roomRows.map((r) => {
      const sold = Number(r.nights_sold) || 0
      const revDec = new Prisma.Decimal(r.room_revenue || 0)
      totalNightsSold += sold
      totalRoomRevenueDec = totalRoomRevenueDec.add(revDec)

      const occRate = totalDays > 0 ? Math.round((sold / totalDays) * 1000) / 10 : 0
      const adr = sold > 0 ? revDec.div(sold).toFixed(2) : "0.00"
      const revpar = totalDays > 0 ? revDec.div(totalDays).toFixed(2) : "0.00"

      return {
        roomId: r.room_id,
        roomNo: r.room_no,
        roomDisplayName: r.display_name,
        categoryName: r.category_name,
        floorNo: r.floor_no,
        buildingName: r.building_name,
        nightsSold: sold,
        totalAvailableNights: totalDays,
        occupancyRate: occRate,
        roomRevenue: revDec.toFixed(2),
        adr,
        revpar,
        currentStatus: r.current_status,
      }
    })

    const totalAvailableRoomNights = totalRoomsCount * totalDays
    const avgOccRate = totalAvailableRoomNights > 0
      ? Math.round((totalNightsSold / totalAvailableRoomNights) * 1000) / 10
      : 0
    const avgAdr = totalNightsSold > 0 ? totalRoomRevenueDec.div(totalNightsSold).toFixed(2) : "0.00"
    const avgRevpar = totalAvailableRoomNights > 0 ? totalRoomRevenueDec.div(totalAvailableRoomNights).toFixed(2) : "0.00"

    return {
      startDate,
      endDate,
      totalRooms: totalRoomsCount,
      totalDays,
      totalNightsSold,
      totalRoomRevenue: totalRoomRevenueDec.toFixed(2),
      averageAdr: avgAdr,
      averageRevpar: avgRevpar,
      averageOccupancyRate: avgOccRate,
      rooms,
      pagination: {
        page,
        limit,
        total: totalRoomsCount,
        totalPages: Math.max(1, Math.ceil(totalRoomsCount / limit)),
      },
    }
  }

  /**
   * Generates Monthly Performance Report:
   * Executive rolling monthly trend of occupancy, revenue, expenses, and Net Operating Result.
   */
  static async getMonthlyPerformanceReport(filters: {
    startMonth?: string
    endMonth?: string
    propertyId?: string
  }): Promise<MonthlyPerformanceReportDTO> {
    const { propertyId } = filters
    if (!propertyId) {
      throw new BadRequestError("propertyId is required for Monthly Performance Report")
    }

    const todayStr = getHotelTodayDate()
    const currentYear = parseInt(todayStr.slice(0, 4), 10)
    const currentMonth = parseInt(todayStr.slice(5, 7), 10)

    const endM = filters.endMonth || `${currentYear}-${String(currentMonth).padStart(2, "0")}`
    let startM = filters.startMonth
    if (!startM) {
      const pastDate = new Date(currentYear, currentMonth - 12, 1)
      startM = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, "0")}`
    }

    const [sY, sM] = startM.split("-").map(Number)
    const [eY, eM] = endM.split("-").map(Number)

    const months: MonthlyPerformanceMonthDTO[] = []
    let curY = sY!
    let curM = sM!

    while (curY < eY! || (curY === eY! && curM <= eM!)) {
      const mStr = `${curY}-${String(curM).padStart(2, "0")}`
      const startOfMonth = `${mStr}-01`
      const daysInM = new Date(curY, curM, 0).getDate()
      const endOfMonth = `${mStr}-${String(daysInM).padStart(2, "0")}`

      const [occ, revVsExp] = await Promise.all([
        this.getOccupancyReport({ startDate: startOfMonth, endDate: endOfMonth, propertyId }),
        this.getRevenueVsExpenseReport({ startDate: startOfMonth, endDate: endOfMonth, propertyId }),
      ])

      const dateObj = new Date(curY, curM - 1, 1)
      const monthName = dateObj.toLocaleDateString("en-US", { month: "short", year: "numeric" })

      months.push({
        monthKey: mStr,
        monthName,
        totalRooms: occ.totalRooms,
        availableNights: occ.totalAvailableRoomNights,
        occupiedNights: occ.totalOccupiedRoomNights,
        occupancyRate: occ.occupancyRate,
        roomRevenue: occ.totalRoomRevenue,
        adr: occ.adr,
        revpar: occ.revpar,
        netInvoicedRevenue: revVsExp.netInvoicedRevenue,
        recognizedDirectIncome: revVsExp.recognizedDirectIncome,
        totalRecognizedRevenue: revVsExp.totalRecognizedRevenue,
        recordedExpenses: revVsExp.totalRecordedExpenses,
        netOperatingResult: revVsExp.netOperatingResult,
        cashInflows: revVsExp.totalCashReceipts,
        cashOutflows: revVsExp.totalCashDisbursements,
        netCashMovement: revVsExp.netCashMovement,
      })

      curM++
      if (curM > 12) {
        curM = 1
        curY++
      }
    }

    return {
      startMonth: startM,
      endMonth: endM,
      months,
    }
  }

  /**
   * Generates Property Summary Report (Super Admin only):
   * Cross-property operational and financial comparison table.
   */
  static async getPropertySummaryReport(filters?: {
    startDate?: string
    endDate?: string
  }): Promise<PropertySummaryReportDTO> {
    const todayStr = getHotelTodayDate()
    const startDate = filters?.startDate || `${todayStr.slice(0, 7)}-01`
    const endDate = filters?.endDate || todayStr

    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)

    const properties = await prisma.property.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        status: true,
        _count: {
          select: {
            rooms: true,
            users: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    const propertySummaries: PropertySummaryItemDTO[] = []

    for (const p of properties) {
      const [roomCounts, activeResCount, invoicedAgg, directIncomeAgg, expensesAgg, cashRecAgg, cashPayAgg] = await Promise.all([
        prisma.room.groupBy({
          by: ["status"],
          where: { propertyId: p.id },
          _count: { _all: true },
        }),
        prisma.reservation.count({
          where: {
            propertyId: p.id,
            status: ReservationStatus.CONFIRMED,
          },
        }),
        prisma.invoice.aggregate({
          where: {
            propertyId: p.id,
            createdAt: { gte: startObj, lte: endObj },
            status: { not: "VOID" },
          },
          _sum: { grandTotal: true },
        }),
        prisma.receipt.aggregate({
          where: {
            propertyId: p.id,
            paidAt: { gte: startObj, lte: endObj },
            incomeId: { not: null },
            OR: [
              { status: "RECORDED" },
              { voidedAt: { gt: endObj } },
            ],
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            propertyId: p.id,
            expenseDate: { gte: startObj, lte: endObj },
            OR: [
              { status: { not: "VOID" } },
              { voidedAt: { gt: endObj } },
            ],
          },
          _sum: { amount: true },
        }),
        prisma.receipt.aggregate({
          where: {
            propertyId: p.id,
            paidAt: { gte: startObj, lte: endObj },
            OR: [
              { status: "RECORDED" },
              { voidedAt: { gt: endObj } },
            ],
          },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: {
            propertyId: p.id,
            paidAt: { gte: startObj, lte: endObj },
            OR: [
              { status: "RECORDED" },
              { voidedAt: { gt: endObj } },
            ],
          },
          _sum: { amount: true },
        }),
      ])

      let clean = 0
      let occupied = 0
      for (const rc of roomCounts) {
        if (rc.status === RoomStatus.VACANT_CLEAN) clean = rc._count._all
        else if (rc.status === RoomStatus.OCCUPIED) occupied = rc._count._all
      }

      const totalRooms = p._count.rooms
      const occRate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 1000) / 10 : 0

      const invoicedDec = new Prisma.Decimal(invoicedAgg._sum.grandTotal || 0)
      const directIncomeDec = new Prisma.Decimal(directIncomeAgg._sum.amount || 0)
      const totalRecognizedRevenueDec = invoicedDec.add(directIncomeDec)

      const recordedExpensesDec = new Prisma.Decimal(expensesAgg._sum.amount || 0)
      const netOperatingResultDec = totalRecognizedRevenueDec.sub(recordedExpensesDec)

      const totalCashCollectedDec = new Prisma.Decimal(cashRecAgg._sum.amount || 0)
      const totalCashDisbursedDec = new Prisma.Decimal(cashPayAgg._sum.amount || 0)
      const netCashMovementDec = totalCashCollectedDec.sub(totalCashDisbursedDec)

      propertySummaries.push({
        propertyId: p.id,
        propertyName: p.name,
        city: p.city,
        status: p.status,
        totalRooms,
        cleanRooms: clean,
        occupiedRooms: occupied,
        activeReservations: activeResCount,
        occupancyRate: occRate,
        totalInvoicedRevenue: invoicedDec.toFixed(2),
        recognizedDirectIncome: directIncomeDec.toFixed(2),
        totalRecognizedRevenue: totalRecognizedRevenueDec.toFixed(2),
        recordedExpenses: recordedExpensesDec.toFixed(2),
        netOperatingResult: netOperatingResultDec.toFixed(2),
        totalCashCollected: totalCashCollectedDec.toFixed(2),
        totalCashDisbursed: totalCashDisbursedDec.toFixed(2),
        netCashMovement: netCashMovementDec.toFixed(2),
        activeStaffCount: p._count.users,
      })
    }

    const activeProperties = properties.filter((p) => p.status === "ACTIVE").length
    const totalRooms = propertySummaries.reduce((acc, p) => acc + p.totalRooms, 0)

    return {
      startDate,
      endDate,
      totalProperties: properties.length,
      activeProperties,
      totalRooms,
      properties: propertySummaries,
    }
  }

  /**
   * Generates Guest Analytics Report:
   * Aggregates spend, stay frequency, repeat guest metrics, and booking history.
   */
  static async getGuestReport(params: {
    startDate?: string
    endDate?: string
    propertyId?: string
    q?: string
    page?: number
    limit?: number
  }): Promise<GuestReportDTO> {
    const { startDate, endDate, propertyId, q } = params
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(5000, Math.max(1, params.limit || 25))
    const offset = (page - 1) * limit

    const whereClause: Prisma.CustomerWhereInput = {
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(propertyId
        ? {
            reservations: {
              some: {
                propertyId,
                ...(startDate && endDate
                  ? {
                      createdAt: {
                        gte: new Date(`${startDate}T00:00:00.000Z`),
                        lte: new Date(`${endDate}T23:59:59.999Z`),
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
    }

    const propertyFilterSql = propertyId ? Prisma.sql`AND r.property_id = ${propertyId}` : Prisma.empty
    const dateRangeFilterSql =
      startDate && endDate
        ? Prisma.sql`AND rr.arrival_date >= ${startDate}::date AND rr.arrival_date <= ${endDate}::date`
        : Prisma.empty

    // Execute customer list and monthly historical loyalty CTE in parallel
    const [totalCount, customers, monthlyRows] = await Promise.all([
      prisma.customer.count({ where: whereClause }),
      prisma.customer.findMany({
        where: whereClause,
        include: {
          reservations: {
            where: {
              ...(propertyId ? { propertyId } : {}),
              ...(startDate && endDate
                ? {
                    createdAt: {
                      gte: new Date(`${startDate}T00:00:00.000Z`),
                      lte: new Date(`${endDate}T23:59:59.999Z`),
                    },
                  }
                : {}),
            },
            include: {
              rooms: {
                select: {
                  arrivalDate: true,
                  departureDate: true,
                  bookedNightlyRate: true,
                },
              },
              invoices: {
                where: { status: { not: "VOID" } },
                select: { grandTotal: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        skip: offset,
        take: limit,
      }),
      prisma.$queryRaw<Array<{
        month: string
        total_guests: number
        new_guests: number
        returning_guests: number
        loyalty_rate: number
      }>>`
        WITH guest_first_stay AS (
          SELECT r.customer_id, MIN(rr.arrival_date) as first_stay_at
          FROM reservation_rooms rr
          JOIN reservations r ON r.id = rr.reservation_id
          WHERE r.status != 'CANCELLED' AND rr.status != 'CANCELLED' ${propertyFilterSql}
          GROUP BY r.customer_id
        ),
        monthly_stays AS (
          SELECT 
            to_char(rr.arrival_date, 'YYYY-MM') as month,
            r.customer_id,
            gfs.first_stay_at,
            rr.arrival_date as stay_at
          FROM reservation_rooms rr
          JOIN reservations r ON r.id = rr.reservation_id
          JOIN guest_first_stay gfs ON gfs.customer_id = r.customer_id
          WHERE r.status != 'CANCELLED' AND rr.status != 'CANCELLED' ${propertyFilterSql} ${dateRangeFilterSql}
        ),
        monthly_agg AS (
          SELECT
            month,
            COUNT(DISTINCT customer_id)::int as total_guests,
            COUNT(DISTINCT CASE WHEN to_char(first_stay_at, 'YYYY-MM') < month THEN customer_id END)::int as returning_guests
          FROM monthly_stays
          GROUP BY month
          ORDER BY month ASC
        )
        SELECT
          month,
          total_guests,
          (total_guests - returning_guests)::int as new_guests,
          returning_guests,
          ROUND((returning_guests::numeric / NULLIF(total_guests, 0)::numeric) * 100, 1)::float as loyalty_rate
        FROM monthly_agg;
      `,
    ])

    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthlyTrend: MonthlyGuestLoyaltyDTO[] = (monthlyRows || []).map((row) => {
      const [y, m] = row.month.split("-")
      const mIdx = parseInt(m || "1", 10) - 1
      const displayMonth = `${MONTH_LABELS[mIdx] || m} ${y}`
      return {
        month: row.month,
        displayMonth,
        totalGuests: row.total_guests,
        newGuests: row.new_guests,
        returningGuests: row.returning_guests,
        loyaltyRate: row.loyalty_rate ?? 0,
      }
    })

    let totalSpendDec = new Prisma.Decimal(0)
    let repeatCount = 0

    const items: GuestReportItemDTO[] = customers.map((c) => {
      const resCount = c.reservations.length
      if (resCount > 1) repeatCount += 1

      let guestSpend = new Prisma.Decimal(0)
      let totalNights = 0
      let latestStay: Date | null = null

      for (const res of c.reservations) {
        for (const inv of res.invoices) {
          guestSpend = guestSpend.add(new Prisma.Decimal(inv.grandTotal))
        }
        for (const rm of res.rooms) {
          const s = rm.arrivalDate.getTime()
          const e = rm.departureDate.getTime()
          const nights = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)))
          totalNights += nights

          if (!latestStay || rm.departureDate > latestStay) {
            latestStay = rm.departureDate
          }
        }
      }

      totalSpendDec = totalSpendDec.add(guestSpend)

      return {
        customerId: c.id,
        guestName: `${c.firstName} ${c.lastName || ""}`.trim(),
        email: c.email,
        phone: c.phone,
        nationality: c.nationality,
        address: c.address,
        totalReservations: resCount,
        totalStayNights: totalNights,
        totalSpend: guestSpend.toFixed(2),
        lastStayDate: latestStay ? latestStay.toISOString().split("T")[0]! : null,
        isRepeatGuest: resCount > 1,
      }
    })

    const totalTrendGuests = monthlyTrend.reduce((acc, m) => acc + m.totalGuests, 0)
    const totalReturningTrend = monthlyTrend.reduce((acc, m) => acc + m.returningGuests, 0)
    const overallLoyaltyPct =
      totalTrendGuests > 0
        ? Math.round((totalReturningTrend / totalTrendGuests) * 1000) / 10
        : totalCount > 0
        ? Math.round((repeatCount / (customers.length || 1)) * 1000) / 10
        : 0
    const avgSpend = totalCount > 0 ? totalSpendDec.div(customers.length || 1).toFixed(2) : "0.00"

    return {
      startDate,
      endDate,
      totalUniqueGuests: totalCount,
      repeatGuestCount: totalReturningTrend > 0 ? totalReturningTrend : repeatCount,
      repeatGuestPercentage: overallLoyaltyPct,
      totalGuestSpend: totalSpendDec.toFixed(2),
      averageSpendPerGuest: avgSpend,
      monthlyTrend,
      guests: items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    }
  }
}
