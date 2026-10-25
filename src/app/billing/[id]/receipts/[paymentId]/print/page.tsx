import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"
import { BillingService } from "@/modules/billing/billing.service"
import { PropertyService } from "@/modules/properties/property.service"
import { formatDateTime } from "@/lib/date-format"
import { formatMoney, getPaymentMethodLabel, formatStaffName } from "@/lib/currency"
import { PrintToolbar } from "../../../print/print-toolbar"

export const metadata: Metadata = {
  title: "Print Receipt — byteInn",
  robots: {
    index: false,
    follow: false,
  },
}

interface PrintReceiptPageProps {
  params: Promise<{ id: string; paymentId: string }>
}

export default async function PrintReceiptPage({ params }: PrintReceiptPageProps) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const { id, paymentId } = await params
  let invoice
  try {
    invoice = await BillingService.getInvoiceById(id)
  } catch {
    notFound()
  }

  const payment = invoice.payments.find((p) => p.id === paymentId)
  if (!payment) {
    notFound()
  }

  const receipt = {
    receiptNumber: `REC-${payment.id.slice(-8).toUpperCase()}`,
    paymentId: payment.id,
    invoiceNumber: invoice.invoiceNumber,
    reservationNo: invoice.reservationNo,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    customerPhone: invoice.customerPhone,
    amountPaid: payment.amount,
    paymentMethod: payment.paymentMethod,
    referenceNumber: payment.referenceNumber,
    paidAt: payment.paidAt,
    recordedByName: payment.creatorName || "Staff",
    invoiceGrandTotal: invoice.grandTotal,
    invoiceTotalPaid: invoice.totalPaid,
    remainingBalance: invoice.balanceDue,
    invoiceStatus: invoice.status,
  }

  let property = null
  try {
    const properties = await PropertyService.getProperties()
    property = properties[0] || null
  } catch (err) {
    console.error("Failed to fetch property details for print receipt:", err)
  }

  const propertyName = property?.name || "byteInn Hotel & Suites"
  const propertyAddress = [property?.address, property?.city, property?.state, property?.country]
    .filter(Boolean)
    .join(", ") || "Bengaluru, Karnataka, India"
  const propertyPhone = property?.phone || "+91 98765 43210"

  const remainingNum = parseFloat(receipt.remainingBalance || "0")

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
        }
      `}</style>

      <div className="mx-auto max-w-[210mm] bg-white p-8 sm:p-12 print:p-0 shadow-lg print:shadow-none border border-zinc-200 print:border-none">
        <PrintToolbar />

        {/* Receipt Container - Designed to fit neatly on one page */}
        <div className="max-w-xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center pb-6 border-b-2 border-zinc-800">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 font-mono">
              {propertyName}
            </h1>
            <p className="text-xs text-zinc-600 mt-1">{propertyAddress}</p>
            <p className="text-xs text-zinc-600">Phone: {propertyPhone}</p>
            <div className="mt-4 inline-block border border-zinc-300 bg-zinc-50 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider text-zinc-800">
              Payment Receipt
            </div>
          </div>

          {/* Key Identifiers Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50 border border-zinc-200 p-4 rounded-lg">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                Receipt Number
              </span>
              <span className="font-mono font-bold text-zinc-900 text-sm">
                {receipt.receiptNumber}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                Invoice Number
              </span>
              <span className="font-mono font-bold text-zinc-900 text-sm">
                #{receipt.invoiceNumber}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                Guest Name
              </span>
              <span className="font-semibold text-zinc-900">{receipt.customerName}</span>
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                Reservation #
              </span>
              <span className="font-mono text-zinc-900">#{receipt.reservationNo}</span>
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                Payment Date & Time
              </span>
              <span className="text-zinc-900">{formatDateTime(receipt.paidAt)}</span>
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                Payment Method
              </span>
              <span className="font-medium text-zinc-900">
                {getPaymentMethodLabel(receipt.paymentMethod)}
                {receipt.referenceNumber ? ` • Ref ${receipt.referenceNumber}` : ""}
              </span>
            </div>
          </div>

          {/* Amount Paid Callout */}
          <div className="p-5 rounded-lg border-2 border-zinc-800 bg-zinc-50 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
              Amount Paid
            </span>
            <span className="text-2xl font-extrabold text-zinc-900 font-mono">
              {formatMoney(receipt.amountPaid)}
            </span>
          </div>

          {/* Folio Balance Summary */}
          <div className="space-y-2 pt-2 border-t border-zinc-200 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Invoice Total:</span>
              <span className="font-mono text-zinc-900">{formatMoney(receipt.invoiceGrandTotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Total Paid to Date:</span>
              <span className="font-mono text-zinc-900">{formatMoney(receipt.invoiceTotalPaid)}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-zinc-200 text-zinc-900 text-sm">
              <span>Remaining Balance:</span>
              <span className="font-mono">
                {remainingNum === 0 ? "₹0.00 (PAID)" : formatMoney(receipt.remainingBalance)}
              </span>
            </div>
          </div>

          {/* Staff Attribution & Footer */}
          <div className="pt-6 border-t border-zinc-200 text-center text-xs text-zinc-500 space-y-1">
            <p>
              Issued by <strong className="text-zinc-800">{formatStaffName(receipt.recordedByName)}</strong>
            </p>
            <p className="text-[11px]">byteInn Property Management System • Official Reception Copy</p>
          </div>
        </div>
      </div>
    </div>
  )
}
