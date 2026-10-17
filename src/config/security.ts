/**
 * Security Configuration & Access Policies
 */

/**
 * Whether to trust client-provided proxy headers (X-Forwarded-For) for client IP extraction.
 * In standalone or non-proxied deployments, trusting X-Forwarded-For allows spoofing.
 * ADV-SESS-01 policy constant.
 * Default: false (safe default; do not trust untrusted proxy headers).
 */
export const TRUST_PROXY_HEADERS = false;
