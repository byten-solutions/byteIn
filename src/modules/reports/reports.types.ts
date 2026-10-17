import { ReservationStatus, AllocationStatus, RoomStatus } from "@prisma/client"

export interface ReportFilterDTO {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  propertyId?: string
}

// ----------------------------------------------------------------------------
// 1. Occupancy, ADR, RevPAR & Category Performance
// ----------------------------------------------------------------------------

export interface DailyOccupancyDTO {
  date: string // YYYY-MM-DD
  dayOfWeek: string
  totalRooms: number
  occupiedRooms: number
  availableRooms: number
  occupancyRate: number // percentage 0 - 100
  roomRevenue: string
  adr: string
  revpar: string
}

export interface CategoryPerformanceDTO {
  categoryId: string
  categoryName: string
  totalRooms: number
  availableRoomNights: number
  occupiedRoomNights: number
  occupancyRate: number
  roomRevenue: string
  adr: string
  revpar: string
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
  totalRoomRevenue: string
  adr: string    // Average Daily Rate (totalRoomRevenue / totalOccupiedRoomNights)
  revpar: string // Revenue Per Available Room (totalRoomRevenue / totalAvailableRoomNights)
  dailyBreakdown: DailyOccupancyDTO[]
  categoryBreakdown: CategoryPerformanceDTO[]
}

// ----------------------------------------------------------------------------
// 2. Revenue & Financial Summary
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// 3. Reservation Status Breakdown
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// 4. Daily Operations (Arrivals, Departures, In-House, Overdue)
// ----------------------------------------------------------------------------

export interface DailyOperationItemDTO {
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
  arrivalDate: string    // YYYY-MM-DD
  departureDate: string  // YYYY-MM-DD
  stayNights: number
  bookedNightlyRate: string
  allocationStatus: AllocationStatus
  roomStatus: RoomStatus
  invoiceId: string | null
  invoiceNumber: string | null
  invoiceGrandTotal: string | null
  invoiceTotalPaid: string | null
  invoiceBalanceDue: string | null
  specialRequests: string | null
}

export interface DailyOperationsReportDTO {
  targetDate: string // YYYY-MM-DD
  summary: {
    expectedArrivalsCount: number
    checkedInArrivalsCount: number
    expectedDeparturesCount: number
    checkedOutDeparturesCount: number
    inHouseCount: number
    pendingArrivalsCount: number // past due / no-shows
    totalArrivalBalanceDue: string
    totalDepartureBalanceDue: string
    totalInHouseBalanceDue: string
  }
  arrivals: DailyOperationItemDTO[]
  departures: DailyOperationItemDTO[]
  inHouse: DailyOperationItemDTO[]
  pendingArrivals: DailyOperationItemDTO[] // overdue check-ins
}

// ----------------------------------------------------------------------------
// 5. Room Availability Grid (Tape Chart / Rack Chart)
// ----------------------------------------------------------------------------

export interface AvailabilityGridSlotDTO {
  date: string // YYYY-MM-DD
  isAvailable: boolean
  isOccupied: boolean
  isMaintenance: boolean
  nightlyRate: string
  allocationId?: string
  reservationId?: string
  reservationNo?: string
  guestName?: string
  allocationStatus?: AllocationStatus
  isArrivalDay?: boolean
  isDepartureDay?: boolean
}

export interface AvailabilityGridRoomDTO {
  roomId: string
  roomNo: string
  displayName: string | null
  categoryName: string
  buildingName: string
  floorNo: number
  currentStatus: RoomStatus
  capacity: number
  basePrice: string
  slots: AvailabilityGridSlotDTO[]
}

export interface AvailabilityGridDTO {
  startDate: string
  endDate: string
  dates: string[] // List of YYYY-MM-DD dates in the window
  rooms: AvailabilityGridRoomDTO[]
  totalRooms: number
}

// ----------------------------------------------------------------------------
// 6. Shift Collections & End-of-Day Reconciliation
// ----------------------------------------------------------------------------

export interface PaymentTransactionDTO {
  paymentId: string
  receiptNumber: string
  invoiceId: string
  invoiceNumber: string
  reservationId: string | null
  reservationNo: string | null
  guestName: string
  roomNumbers: string[]
  amount: string
  paymentMethod: string
  referenceNumber: string | null
  notes: string | null
  recordedByUserId: string
  recordedByUserName: string
  paidAt: string // ISO timestamp
}

export interface StaffCollectionBreakdownDTO {
  userId: string
  userName: string
  userEmail: string
  totalCollected: string
  paymentCount: number
  methods: Record<string, string> // e.g. { CASH: "500.00", CARD: "1200.00", UPI: "800.00" }
}

export interface ShiftCollectionsReportDTO {
  targetDate: string
  startDate?: string
  endDate?: string
  totalCollected: string
  totalTransactions: number
  methodBreakdown: PaymentMethodBreakdownDTO[]
  staffBreakdown: StaffCollectionBreakdownDTO[]
  transactions: PaymentTransactionDTO[]
}

// ----------------------------------------------------------------------------
// 7. Receivables / Outstanding Balances Report
// ----------------------------------------------------------------------------

export interface ReceivableItemDTO {
  invoiceId: string
  invoiceNumber: string
  reservationId: string
  reservationNo: string
  customerId: string
  guestName: string
  guestPhone: string | null
  guestEmail: string | null
  roomNumbers: string[]
  reservationStatus: ReservationStatus
  isGuestInHouse: boolean
  issueDate: string
  grandTotal: string
  totalPaid: string
  balanceDue: string
  daysAging: number
  agingBucket: "0-7" | "8-30" | "31-60" | "60+"
}

export interface ReceivablesReportDTO {
  asOfDate: string
  totalReceivables: string
  totalInvoices: number
  inHouseReceivables: string
  inHouseCount: number
  departedReceivables: string
  departedCount: number
  agingSummary: {
    bucket0to7: string
    bucket8to30: string
    bucket31to60: string
    bucket60Plus: string
  }
  items: ReceivableItemDTO[]
}
