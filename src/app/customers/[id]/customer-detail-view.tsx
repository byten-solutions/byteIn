"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User,
  FileText,
  Calendar,
  ArrowLeft,
  Bed,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SerializedCustomerDetail {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  address: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  remarks: string | null;
  createdAt: string;
  reservations: {
    id: string;
    reservationNo: string;
    status: string;
    createdAt: string;
    rooms: {
      id: string;
      roomNo: string;
      categoryName: string;
      arrivalDate: string;
      departureDate: string;
      bookedNightlyRate: string;
      status: string;
    }[];
  }[];
}

export function CustomerDetailView({
  customer: initialCustomer,
}: {
  customer: SerializedCustomerDetail;
}) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [formData, setFormData] = useState({
    firstName: initialCustomer.firstName,
    lastName: initialCustomer.lastName || "",
    phone: initialCustomer.phone || "",
    email: initialCustomer.email || "",
    nationality: initialCustomer.nationality || "",
    address: initialCustomer.address || "",
    idProofType: initialCustomer.idProofType || "Passport",
    idProofNumber: initialCustomer.idProofNumber || "",
    remarks: initialCustomer.remarks || "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.firstName.trim()) {
      setMessage({ type: "error", text: "First name is required." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update guest");
      }

      setCustomer((prev) => ({
        ...prev,
        ...data.customer,
      }));
      setMessage({ type: "success", text: "Guest details updated successfully." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update guest details";
      setMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/customers">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              All Guests
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {customer.firstName} {customer.lastName || ""}
            </h1>
            <p className="text-xs text-muted-foreground">
              Guest since {new Date(customer.createdAt).toLocaleDateString()} • {customer.reservations.length} total bookings
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-md border p-3 text-xs flex items-start gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Guest Profile & Edit Form (1 Col) */}
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Guest Profile
              </CardTitle>
              <CardDescription className="text-xs">
                Edit contact and identification details.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4">
              <form onSubmit={handleUpdate} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">First Name</Label>
                    <Input
                      className="h-8 text-xs"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Last Name</Label>
                    <Input
                      className="h-8 text-xs"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Phone</Label>
                  <Input
                    className="h-8 text-xs"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Email</Label>
                  <Input
                    type="email"
                    className="h-8 text-xs"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Nationality</Label>
                  <Input
                    className="h-8 text-xs"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">ID Type</Label>
                    <select
                      className="w-full text-xs h-8 rounded-md border border-input bg-transparent px-2 shadow-xs"
                      value={formData.idProofType}
                      onChange={(e) => setFormData({ ...formData, idProofType: e.target.value })}
                    >
                      <option value="Passport">Passport</option>
                      <option value="National ID">National ID</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">ID Number</Label>
                    <Input
                      className="h-8 text-xs font-mono"
                      value={formData.idProofNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, idProofNumber: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Address</Label>
                  <Input
                    className="h-8 text-xs"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Remarks / Preferences</Label>
                  <Textarea
                    className="text-xs resize-none"
                    rows={2}
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>

                <Button type="submit" size="sm" className="w-full h-8 text-xs mt-2" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      Update Guest Details
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Reservation History (2 Cols) */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Reservation History ({customer.reservations.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Past and current bookings associated with this guest.
                  </CardDescription>
                </div>
                <Link href="/reservations/new">
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    Book Stay
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {customer.reservations.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No reservations recorded for this guest.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-semibold">Reservation #</TableHead>
                        <TableHead className="text-xs font-semibold">Rooms</TableHead>
                        <TableHead className="text-xs font-semibold">Stay Dates</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.reservations.map((res) => {
                        const earliestArrival = res.rooms.map((r) => r.arrivalDate).sort()[0];
                        const latestDeparture = res.rooms.map((r) => r.departureDate).sort().slice(-1)[0];

                        return (
                          <TableRow key={res.id} className="text-xs hover:bg-muted/30">
                            <TableCell className="font-mono font-medium">
                              <Link
                                href={`/reservations/${res.id}`}
                                className="text-primary hover:underline"
                              >
                                {res.reservationNo}
                              </Link>
                            </TableCell>

                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {res.rooms.map((rm) => (
                                  <Badge key={rm.id} variant="outline" className="text-[10px] font-mono py-0">
                                    <Bed className="h-2.5 w-2.5 mr-1" />
                                    {rm.roomNo} ({rm.categoryName})
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>

                            <TableCell className="font-medium text-xs">
                              {earliestArrival} → {latestDeparture}
                            </TableCell>

                            <TableCell>
                              {getStatusBadge(res.status)}
                            </TableCell>

                            <TableCell className="text-right">
                              <Link href={`/reservations/${res.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                                  View
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
