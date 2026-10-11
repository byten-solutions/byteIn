"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Users,
  PlusCircle,
  Search,
  User,
  Phone,
  Mail,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface SerializedCustomer {
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
  reservationsCount: number;
  createdAt: string;
}

export interface CustomerPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CustomerListProps {
  initialCustomers: SerializedCustomer[];
  initialPagination?: CustomerPagination;
}

export function CustomerList({
  initialCustomers,
  initialPagination,
}: CustomerListProps) {
  const [customers, setCustomers] = useState<SerializedCustomer[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(initialPagination?.page || 1);
  const [pagination, setPagination] = useState<CustomerPagination>(
    initialPagination || {
      total: initialCustomers.length,
      page: 1,
      limit: 20,
      totalPages: Math.max(1, Math.ceil(initialCustomers.length / 20)),
    }
  );
  const [loading, setLoading] = useState(false);
  const isInitialMount = useRef(true);

  // Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    nationality: "",
    address: "",
    idProofType: "Passport",
    idProofNumber: "",
    remarks: "",
  });

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.set("search", searchTerm.trim());
        params.set("page", String(currentPage));
        params.set("limit", "20");

        const res = await fetch(`/api/customers?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch customers");
        const data = await res.json();

        if (isMounted && data.success) {
          const mapped: SerializedCustomer[] = data.customers.map((c: {
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
            _count?: { reservations: number };
            reservationsCount?: number;
            createdAt: string | Date;
          }) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            phone: c.phone,
            email: c.email,
            nationality: c.nationality,
            address: c.address,
            idProofType: c.idProofType,
            idProofNumber: c.idProofNumber,
            remarks: c.remarks,
            reservationsCount: c._count?.reservations ?? c.reservationsCount ?? 0,
            createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date(c.createdAt).toISOString(),
          }));

          setCustomers(mapped);
          if (data.pagination) {
            setPagination(data.pagination);
          }
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchTerm, currentPage]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleRegisterGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.firstName.trim()) {
      setFormError("First name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register guest");
      }

      const newCustomer: SerializedCustomer = {
        id: data.customer.id,
        firstName: data.customer.firstName,
        lastName: data.customer.lastName,
        phone: data.customer.phone,
        email: data.customer.email,
        nationality: data.customer.nationality,
        address: data.customer.address,
        idProofType: data.customer.idProofType,
        idProofNumber: data.customer.idProofNumber,
        remarks: data.customer.remarks,
        reservationsCount: 0,
        createdAt: new Date().toISOString(),
      };

      setCustomers((prev) => [newCustomer, ...prev]);
      setPagination((prev) => ({
        ...prev,
        total: prev.total + 1,
      }));
      setIsRegisterOpen(false);
      setFormData({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        nationality: "",
        address: "",
        idProofType: "Passport",
        idProofNumber: "",
        remarks: "",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register guest";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Guest Directory
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Registered guests, identification documents, and stay history.
          </p>
        </div>

        <Button
          onClick={() => {
            setFormError(null);
            setIsRegisterOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 shadow-sm"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Register New Guest
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="shadow-xs">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email, nationality, or ID proof #..."
              className="pl-9 text-xs sm:text-sm"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Guest Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Registered Guests ({pagination.total})
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
          <CardDescription className="text-xs">
            Reception guest registry with verified identification details.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-semibold">No guests found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? "No guests match your current search query."
                  : "No guests have been registered yet."}
              </p>
              <div className="mt-4">
                <Button size="sm" onClick={() => setIsRegisterOpen(true)}>
                  <PlusCircle className="h-4 w-4 mr-1.5" />
                  Register First Guest
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Guest Name</TableHead>
                    <TableHead className="text-xs font-semibold">Contact Details</TableHead>
                    <TableHead className="text-xs font-semibold">ID Proof</TableHead>
                    <TableHead className="text-xs font-semibold">Nationality</TableHead>
                    <TableHead className="text-xs font-semibold">Stays</TableHead>
                    <TableHead className="text-xs font-semibold">Registered</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => {
                    const fullName = `${c.firstName} ${c.lastName || ""}`.trim();

                    return (
                      <TableRow key={c.id} className="text-xs hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium">
                          <Link
                            href={`/customers/${c.id}`}
                            className="text-primary hover:underline font-semibold flex items-center gap-1.5"
                          >
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {fullName}
                          </Link>
                          {c.address && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                              {c.address}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-0.5">
                            {c.phone && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Phone className="h-3 w-3 shrink-0" />
                                {c.phone}
                              </div>
                            )}
                            {c.email && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Mail className="h-3 w-3 shrink-0" />
                                {c.email}
                              </div>
                            )}
                            {!c.phone && !c.email && (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {c.idProofNumber ? (
                            <div>
                              <Badge variant="outline" className="text-[10px] font-mono py-0">
                                {c.idProofType || "Document"}
                              </Badge>
                              <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                                {c.idProofNumber}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Unrecorded</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {c.nationality ? (
                            <span className="flex items-center gap-1 text-xs">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              {c.nationality}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            <Calendar className="h-3 w-3 mr-1" />
                            {c.reservationsCount} {c.reservationsCount === 1 ? "booking" : "bookings"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-muted-foreground text-[11px]">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </TableCell>

                        <TableCell className="text-right">
                          <Link href={`/customers/${c.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                              View Profile
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
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

          {/* Bounded Pagination Controls */}
          <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing{" "}
              <span className="font-medium text-foreground">
                {pagination.total === 0 ? 0 : (currentPage - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(currentPage * pagination.limit, pagination.total)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{pagination.total}</span> guests
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <span className="px-2">
                Page {currentPage} of {pagination.totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={currentPage >= pagination.totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Register New Guest Dialog */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Register New Guest</DialogTitle>
            <DialogDescription className="text-xs">
              Collect guest personal and identity document details for reception desk operations.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleRegisterGuest} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. Eleanor"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Last Name</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. Vance"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone Number</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Email Address</Label>
                <Input
                  type="email"
                  className="h-8 text-xs"
                  placeholder="guest@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nationality</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. British"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">ID Document Type</Label>
                <select
                  className="w-full text-xs h-8 rounded-md border border-input bg-transparent px-2.5 shadow-xs"
                  value={formData.idProofType}
                  onChange={(e) => setFormData({ ...formData, idProofType: e.target.value })}
                >
                  <option value="Passport">Passport</option>
                  <option value="National ID">National ID</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">ID Document Number</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder="e.g. 987654321"
                value={formData.idProofNumber}
                onChange={(e) => setFormData({ ...formData, idProofNumber: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Residential Address</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Street, City, Country"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRegisterOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register Guest"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
