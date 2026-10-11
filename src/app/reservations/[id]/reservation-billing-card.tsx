"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InvoiceDetailDTO } from "@/modules/billing/billing.types";
import { InvoiceStatus } from "@prisma/client";
import { CreditCard, ArrowUpRight, Plus, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReservationBillingCardProps {
  reservationId: string;
  initialInvoice: InvoiceDetailDTO | null;
  estimatedTotal: number;
}

export function ReservationBillingCard({
  reservationId,
  initialInvoice,
  estimatedTotal,
}: ReservationBillingCardProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetailDTO | null>(initialInvoice);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateInvoice = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          autoIssue: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create invoice");
      setInvoice(json.data);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold">
            <CheckCircle2 className="size-3 mr-1" />
            Paid
          </Badge>
        );
      case InvoiceStatus.PARTIALLY_PAID:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs font-semibold">
            <Clock className="size-3 mr-1" />
            Partial
          </Badge>
        );
      case InvoiceStatus.ISSUED:
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20 text-xs font-semibold">
            <AlertCircle className="size-3 mr-1" />
            Issued
          </Badge>
        );
      case InvoiceStatus.DRAFT:
        return <Badge variant="outline">Draft</Badge>;
      case InvoiceStatus.VOID:
        return <Badge variant="destructive">Void</Badge>;
    }
  };

  return (
    <Card className="shadow-xs border-primary/20 bg-card">
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CreditCard className="size-4 text-primary" />
          Billing & Invoicing
        </CardTitle>
        {invoice && getStatusBadge(invoice.status)}
      </CardHeader>
      <CardContent className="p-4 space-y-3 text-xs">
        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs">
            {error}
          </div>
        )}

        {invoice ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invoice Number:</span>
              <span className="font-mono font-bold text-foreground">
                {invoice.invoiceNumber}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Grand Total:</span>
              <span className="font-mono font-bold text-foreground">
                ${invoice.grandTotal}
              </span>
            </div>

            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span>Total Paid:</span>
              <span className="font-mono font-semibold">${invoice.totalPaid}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t font-semibold">
              <span className="text-foreground">Balance Due:</span>
              <span
                className={`font-mono ${
                  parseFloat(invoice.balanceDue) === 0
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                ${invoice.balanceDue}
              </span>
            </div>

            <Link
              href={`/billing/${invoice.id}`}
              className="w-full mt-2 py-2 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90 transition cursor-pointer"
            >
              Open Invoice & Payments Hub
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="text-muted-foreground italic">No invoice generated yet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated Room Subtotal:</span>
              <span className="font-mono font-semibold text-foreground">
                ${estimatedTotal.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              disabled={creating}
              onClick={handleCreateInvoice}
              className="w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              {creating ? "Generating Invoice..." : "Generate Invoice Now"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
