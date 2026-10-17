/**
 * Business policies and configuration for reservation lifecycle and room allocation operations.
 * Governs Batch 2 adversarial audit remediations (cancellation, no-shows, stay extensions, room changes).
 */

/**
 * When changing a room allocation to another room, determines rate calculation behavior:
 * - "KEEP_ORIGINAL_RATE": Retains the locked bookedNightlyRate from original booking.
 * - "APPLY_NEW_RATE": Adopts the target room's active rate (or priceOverride).
 */
export const ROOM_CHANGE_RATE_POLICY: "KEEP_ORIGINAL_RATE" | "APPLY_NEW_RATE" = "KEEP_ORIGINAL_RATE";

/**
 * When an allocation is checked out earlier than the booked departure date:
 * - "CHARGE_ACTUAL_NIGHTS": Reconciles draft invoice room charges down to actual nights stayed.
 * - "CHARGE_FULL_BOOKING": Retains room charges for the full original booked departure duration.
 */
export const EARLY_CHECKOUT_INVOICE_POLICY: "CHARGE_ACTUAL_NIGHTS" | "CHARGE_FULL_BOOKING" = "CHARGE_ACTUAL_NIGHTS";

/**
 * Whether marking an allocation as NO_SHOW automatically releases the room immediately.
 */
export const NO_SHOW_RELEASE_ROOM = true;

/**
 * Invariant: When an allocation is cancelled or marked NO_SHOW, whether the parent reservation
 * automatically transitions to CANCELLED if all remaining allocations are cancelled/no-show.
 */
export const AUTO_CANCEL_RESERVATION_WHEN_ALL_ALLOCATIONS_CANCELLED = true;

/**
 * Policy governing invoice billing when an allocation or reservation is marked NO_SHOW:
 * - "RETAIN_FIRST_NIGHT": Charges only the first night room rate and credits/adjusts subsequent nights.
 * - "CHARGE_FULL": Charges the full booked duration.
 * - "WAIVE_ALL": Voids or credits all charges.
 */
export const NO_SHOW_BILLING_POLICY: "RETAIN_FIRST_NIGHT" | "CHARGE_FULL" | "WAIVE_ALL" = "RETAIN_FIRST_NIGHT";

/**
 * Policy governing check-in attempts occurring before the scheduled arrival date:
 * - "BLOCK": Strictly rejects check-in if hotel today is before arrivalDate.
 * - "ALLOW_WITH_ARRIVAL_UPDATE": Updates arrivalDate to today if room is available.
 */
export const EARLY_CHECKIN_POLICY: "BLOCK" | "ALLOW_WITH_ARRIVAL_UPDATE" = "BLOCK";

/**
 * Policy governing when an allocation can be marked NO_SHOW:
 * - "ON_OR_AFTER_ARRIVAL": Strictly requires hotel today >= arrivalDate.
 * - "ANYTIME": Permits no-show marking before arrival date.
 */
export const NO_SHOW_MIN_DATE_POLICY: "ON_OR_AFTER_ARRIVAL" | "ANYTIME" = "ON_OR_AFTER_ARRIVAL";

/**
 * Policy governing cancellation of reservations that have recorded payments:
 * - "REQUIRE_VOID_OR_ADMIN": Receptionist can only cancel if payments are voided first; ADMIN is permitted.
 * - "ADMIN_ONLY": Only ADMIN can cancel reservations with recorded payments.
 * - "BLOCK": Cannot cancel until all payments are voided/refunded.
 */
export const CANCEL_WITH_PAYMENTS_POLICY: "REQUIRE_VOID_OR_ADMIN" | "ADMIN_ONLY" | "BLOCK" = "REQUIRE_VOID_OR_ADMIN";

/**
 * Policy governing backdated checkout requests:
 * - "DISALLOW": Rejects checkout if effective checkout date is before arrivalDate.
 * - "ADMIN_ONLY": Requires ADMIN role to record backdated checkout.
 */
export const BACKDATED_CHECKOUT_POLICY: "DISALLOW" | "ADMIN_ONLY" = "DISALLOW";

