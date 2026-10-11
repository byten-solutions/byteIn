"use client";

import { useState } from "react";
import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";
import { InvoiceDetailDTO, InvoiceListResponse } from "@/modules/billing/billing.types";
import {
  CreditCard,
  Search,
  Receipt,
  ArrowUpRight,
  Filter,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

interface InvoiceListProps {
  initialData: InvoiceListResponse;
}

export function InvoiceList({ initialData }: InvoiceListProps) {
  const [data, setData] = useState<InvoiceListResponse>(initialData);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);

  const fetchInvoices = async (searchTerm = search, status = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (status !== "ALL") params.set("status", status);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    fetchInvoices(val, statusFilter);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    fetchInvoices(search, status);
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3" />
            Paid
          </span>
        );
      case InvoiceStatus.PARTIALLY_PAID:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3" />
            Partial
          </span>
        );
      case InvoiceStatus.ISSUED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <AlertCircle className="size-3" />
            Issued
          </span>
        );
      case InvoiceStatus.DRAFT:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20">
            <FileText className="size-3" />
            Draft
          </span>
        );
      case InvoiceStatus.VOID:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20">
            Void
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="size-6 text-primary" />
            Billing & Invoicing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage reservation invoices, extra charges, payment recording, and receipts.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Total Invoiced
            </span>
            <span className="text-2xl font-bold text-foreground mt-1 block">
              ${data.summary.totalInvoiced}
            </span>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Receipt className="size-5" />
          </div>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Total Collected
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              ${data.summary.totalCollected}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <DollarSign className="size-5" />
          </div>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Outstanding Balance
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
              ${data.summary.totalOutstanding}
            </span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock className="size-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border rounded-xl p-3 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by invoice #, reservation #, guest name, or phone..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted/30 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Filter className="size-4 text-muted-foreground shrink-0 hidden sm:block" />
          {(["ALL", "ISSUED", "PARTIALLY_PAID", "PAID", "DRAFT", "VOID"] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusFilterChange(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  statusFilter === status
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {status.replace("_", " ")}
              </button>
            )
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Guest & Reservation</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Collected</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Loading invoices...
                  </td>
                </tr>
              ) : data.invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Receipt className="size-8 mx-auto mb-2 opacity-40" />
                    No invoices match your search or filter.
                  </td>
                </tr>
              ) : (
                data.invoices.map((inv: InvoiceDetailDTO) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/20 transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground font-mono">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(inv.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">
                        {inv.customerName}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Res #{inv.reservationNo}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(inv.status)}</td>

                    <td className="py-3.5 px-4 text-right font-medium font-mono text-foreground">
                      ${inv.grandTotal}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium font-mono text-emerald-600 dark:text-emerald-400">
                      ${inv.totalPaid}
                    </td>

                    <td className="py-3.5 px-4 text-right font-semibold font-mono text-amber-600 dark:text-amber-400">
                      ${inv.balanceDue}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/billing/${inv.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition cursor-pointer"
                      >
                        View Hub
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-muted/20 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {data.invoices.length} of {data.total} invoice{data.total === 1 ? "" : "s"}
          </span>
          <span>Page {data.page} of {data.totalPages}</span>
        </div>
      </div>
    </div>
  );
}
