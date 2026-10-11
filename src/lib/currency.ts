export const CURRENCY_CODE = "INR";
export const CURRENCY_SYMBOL = "₹";
export const LOCALE = "en-IN";

const inrFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric or Decimal string/number value in Indian Rupees (₹)
 * with Indian digit grouping (e.g. ₹3,82,500.00).
 * Preserves Decimal representations without introducing floating-point arithmetic.
 */
export function formatMoney(
  value: number | string | { toString(): string } | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return inrFormatter.format(0);
  }
  const numericVal = typeof value === "number" ? value : parseFloat(value.toString());
  if (isNaN(numericVal)) {
    return inrFormatter.format(0);
  }
  return inrFormatter.format(numericVal);
}

/**
 * Formats quantity values: whole numbers as integers ("17" not "17.00"),
 * and non-integers trimmed cleanly ("1.5").
 */
export function formatQuantity(
  qty: number | string | { toString(): string } | null | undefined
): string {
  if (qty === null || qty === undefined || qty === "") return "0";
  const num = typeof qty === "number" ? qty : parseFloat(qty.toString());
  if (isNaN(num)) return "0";
  return Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(2)).toString();
}

/**
 * Formats a payment method code into a human-readable label (e.g. "Cash", "Card", "UPI", "Bank transfer").
 */
export function getPaymentMethodLabel(method: string): string {
  const methodMap: Record<string, string> = {
    CASH: "Cash",
    CARD: "Card",
    UPI: "UPI",
    BANK_TRANSFER: "Bank transfer",
  };
  return methodMap[method] || method.replace(/_/g, " ");
}

/**
 * Formats payment method with optional reference (e.g. "UPI • Ref 12345" or "Cash").
 */
export function formatPaymentMethod(method: string, referenceNumber?: string | null): string {
  const label = getPaymentMethodLabel(method);
  if (referenceNumber && referenceNumber.trim()) {
    return `${label} • Ref ${referenceNumber.trim()}`;
  }
  return label;
}

/**
 * Cleans stringified role objects ("System Administrator ([object Object])") to prevent rendering [object Object].
 */
export function formatStaffName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/\s*\(\[object Object\]\)/g, "").trim();
}
