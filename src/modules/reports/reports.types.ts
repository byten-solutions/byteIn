import { ReservationStatus } from "@prisma/client"

export interface ReportFilterDTO {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  propertyId?: string
}

export interface DailyOccupancyDTO {
  date: string // YYYY-MM-DD
  dayOfWeek: string
  totalRooms: number
  occupiedRooms: number
  availableRooms: number
  occupancyRate: number // percentage 0 - 100
}

export interface OccupancyReportDTO {
  startDate: string
  endDate: string
  totalDays: number
  totalRooms: number
  totalAvailableRoomNights: number
  totalOccupiedRoomNights: number
  occupancyRate: number // percentage 0 - 100
  averageDailyOccupancy: number
  dailyBreakdown: DailyOccupancyDTO[]
}

export interface PaymentMethodBreakdownDTO {
  method: string
  amount: string
  count: number
  percentage: number
}

export interface ChargeTypeBreakdownDTO {
  itemType: string
  amount: string
  count: number
  percentage: number
}

export interface DailyRevenueDTO {
  date: string // YYYY-MM-DD
  invoicedAmount: string
  collectedAmount: string
}

export interface RevenueReportDTO {
  startDate: string
  endDate: string
  totalInvoiced: string
  totalCollected: string
  totalOutstanding: string
  roomChargesTotal: string
  extraChargesTotal: string
  taxTotal: string
  discountTotal: string
  invoiceCount: number
  paymentCount: number
  paymentMethodBreakdown: PaymentMethodBreakdownDTO[]
  chargeTypeBreakdown: ChargeTypeBreakdownDTO[]
  dailyBreakdown: DailyRevenueDTO[]
}

export interface ReservationStatusCountDTO {
  status: ReservationStatus
  count: number
  percentage: number
  roomNights: number
  totalValue: string
}

export interface ReservationStatusReportDTO {
  startDate: string
  endDate: string
  totalReservations: number
  totalAllocations: number
  totalStayNights: number
  averageLengthOfStay: number
  cancellationRate: number // percentage 0 - 100
  completionRate: number   // percentage 0 - 100
  statusBreakdown: ReservationStatusCountDTO[]
}
