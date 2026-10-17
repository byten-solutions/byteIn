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
