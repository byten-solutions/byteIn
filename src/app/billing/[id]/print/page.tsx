import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"
import { BillingService } from "@/modules/billing/billing.service"
import { PropertyService } from "@/modules/properties/property.service"
import { formatDate, formatDateTime } from "@/lib/date-format"
import { formatMoney, formatQuantity, getPaymentMethodLabel, formatStaffName } from "@/lib/currency"
import { PrintToolbar } from "./print-toolbar"

export const metadata: Metadata = {
  title: "Print Invoice — byteInn",
  robots: {
    index: false,
    follow: false,
  },
}

interface PrintInvoicePageProps {
  params: Promise<{ id: string }>
}

export default async function PrintInvoicePage({ params }: PrintInvoicePageProps) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const { id } = await params
  let invoice
  try {
    invoice = await BillingService.getInvoiceById(id)
  } catch {
    notFound()
  }

  let property = null
  try {
    const properties = await PropertyService.getProperties()
    property = properties[0] || null
  } catch (err) {
    console.error("Failed to fetch property details for print invoice:", err)
  }

  const propertyName = property?.name || "byteInn Hotel & Suites"
  const propertyAddress = [property?.address, property?.city, property?.state, property?.country]
    .filter(Boolean)
    .join(", ") || "Bengaluru, Karnataka, India"
  const propertyPhone = property?.phone || "+91 98765 43210"

  const balanceNum = parseFloat(invoice.balanceDue || "0")
  const issueDateStr = invoice.issuedAt ? formatDate(invoice.issuedAt) : formatDate(invoice.createdAt)

  return (
    <div className="min-h-screen bg-zinc-100 p-4 sm:p-8 print:p-0 print:bg-white text-zinc-900 font-sans">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 15mm;
        }
        @media print {
          body {
            background-color: #ffffff !important;
            color: #18181b !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[210mm] bg-white p-8 sm:p-12 print:p-0 shadow-lg print:shadow-none border border-zinc-200 print:border-none">
        <PrintToolbar />

        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b border-zinc-300 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{propertyName}</h1>
            <p className="text-xs text-zinc-600 mt-1 max-w-sm">{propertyAddress}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Phone: {propertyPhone}</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 uppercase">
              Invoice
            </span>
            <div className="text-xs font-mono font-bold text-zinc-700 mt-1">
              #{invoice.invoiceNumber}
            </div>
            <div className="mt-2 inline-block rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-800">
              {invoice.status.replace(/_/g, " ")}
            </div>
          </div>
        </div>

        {/* Meta Grid */}
        <div className="grid grid-cols-2 gap-8 text-xs mb-8">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Billed To
            </h2>
            <div className="font-bold text-sm text-zinc-900">{invoice.customerName}</div>
            {invoice.customerPhone && (
              <div className="text-zinc-600 font-mono mt-0.5">Phone: {invoice.customerPhone}</div>
            )}
            {invoice.customerEmail && (
              <div className="text-zinc-600 mt-0.5">Email: {invoice.customerEmail}</div>
            )}
          </div>

          <div className="space-y-1 text-right">
            <div>
              <span className="text-zinc-500">Issue Date:</span>{" "}
              <span className="font-medium text-zinc-900">{issueDateStr}</span>
            </div>
            <div>
              <span className="text-zinc-500">Reservation:</span>{" "}
              <span className="font-mono font-medium text-zinc-900">#{invoice.reservationNo}</span>
            </div>
            <div>
              <span className="text-zinc-500">Generated:</span>{" "}
              <span className="text-zinc-700">{formatDateTime(invoice.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                <th className="py-2.5 pr-4">Description</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 pl-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {invoice.items.map((item) => (
                <tr key={item.id} className="print-avoid-break">
                  <td className="py-3 pr-4 font-medium text-zinc-900">{item.description}</td>
                  <td className="py-3 px-3 text-zinc-600">
                    {item.itemType === "ROOM_CHARGE" ? "Room Charge" : "Extra Charge"}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-zinc-700">
                    {formatQuantity(item.quantity)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-zinc-700">
                    {formatMoney(item.unitPrice)}
                  </td>
                  <td className="py-3 pl-3 text-right font-mono font-semibold text-zinc-900">
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Totals */}
        <div className="flex justify-end mb-8 print-avoid-break">
          <div className="w-72 space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-200 text-zinc-600">
              <span>Subtotal:</span>
              <span className="font-mono text-zinc-900">{formatMoney(invoice.subtotal)}</span>
            </div>
            {parseFloat(invoice.discountTotal) > 0 && (
              <div className="flex justify-between py-1 border-b border-zinc-200 text-zinc-600">
                <span>Discount:</span>
                <span className="font-mono text-emerald-700">-{formatMoney(invoice.discountTotal)}</span>
              </div>
            )}
            {parseFloat(invoice.taxTotal) > 0 && (
              <div className="flex justify-between py-1 border-b border-zinc-200 text-zinc-600">
                <span>Tax:</span>
                <span className="font-mono text-zinc-900">{formatMoney(invoice.taxTotal)}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b-2 border-zinc-800 text-sm font-bold text-zinc-900">
              <span>Grand Total:</span>
              <span className="font-mono">{formatMoney(invoice.grandTotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-zinc-600">
              <span>Total Paid:</span>
              <span className="font-mono text-zinc-900">{formatMoney(invoice.totalPaid)}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-zinc-800 text-base font-extrabold text-zinc-900">
              <span>Balance Due:</span>
              <span className="font-mono">
                {balanceNum === 0 ? "₹0.00 (PAID)" : formatMoney(invoice.balanceDue)}
              </span>
            </div>
          </div>
        </div>

        {/* Payments Section */}
        {invoice.payments.length > 0 && (
          <div className="mb-8 print-avoid-break">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Payment Record ({invoice.payments.length})
            </h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-300 text-[10px] font-semibold uppercase text-zinc-500">
                  <th className="py-1.5 pr-2">Date & Time</th>
                  <th className="py-1.5 px-2">Method & Reference</th>
                  <th className="py-1.5 px-2">Staff</th>
                  <th className="py-1.5 px-2">Status</th>
                  <th className="py-1.5 pl-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-2 text-zinc-700">{formatDateTime(p.paidAt)}</td>
                    <td className="py-2 px-2 text-zinc-800 font-medium">
                      {getPaymentMethodLabel(p.paymentMethod)}
                      {p.referenceNumber && (
                        <span className="text-zinc-500 font-mono text-[11px] ml-1.5">
                          Ref {p.referenceNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-zinc-600">
                      {p.creatorName ? formatStaffName(p.creatorName) : "Staff"}
                    </td>
                    <td className="py-2 px-2">
                      <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border border-zinc-200 bg-zinc-50 text-zinc-800">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-right font-mono font-semibold text-zinc-900">
                      {formatMoney(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 print-avoid-break">
          <p className="font-medium text-zinc-700">Thank you for choosing {propertyName}!</p>
          <p className="mt-1 text-[11px]">
            This is a computer-generated invoice issued via byteInn Property Management System.
          </p>
        </div>
      </div>
    </div>
  )
}
