/**
 * Reporting & Occupancy Metrics Configuration
 */

/**
 * Whether past dates strictly exclude unarrived CONFIRMED reservations from realized occupied room counts and room revenue.
 * Under USALI guidelines, historical occupancy only counts realized stays (CHECKED_IN / CHECKED_OUT).
 * ADV-REP-01 policy constant.
 * Default: true.
 */
export const EXCLUDE_PAST_CONFIRMED_FROM_OCCUPANCY = true;

/**
 * Policy for whether future/current dates in Occupancy Reports include CONFIRMED (on-the-books) bookings
 * in the headline occupiedRooms & roomRevenue metrics, or strictly partition them into otbRooms/otbRevenue.
 * - "INCLUDE_IN_OCCUPANCY": future confirmed bookings count toward headline occupiedRooms & roomRevenue (standard PMS forward demand forecast).
 * - "SEPARATE_OTB_ONLY": headline occupiedRooms strictly counts in-house guests, while future confirmed bookings appear only in otbRooms.
 * ADV-REP-01 policy constant.
 * Default: "INCLUDE_IN_OCCUPANCY".
 */
export const FUTURE_OCCUPANCY_POLICY: "INCLUDE_IN_OCCUPANCY" | "SEPARATE_OTB_ONLY" = "INCLUDE_IN_OCCUPANCY";
