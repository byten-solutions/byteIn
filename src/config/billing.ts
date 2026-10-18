/**
 * Billing & Financial Policies
 */

/**
 * Whether payment submissions strictly require an Idempotency-Key header.
 * If false, Idempotency-Key is optional but honored and deduplicated whenever provided.
 * ADV-BIL-04 policy constant.
 * Default: false (optional, backward-compatible).
 */
export const REQUIRE_PAYMENT_IDEMPOTENCY_KEY = true;
