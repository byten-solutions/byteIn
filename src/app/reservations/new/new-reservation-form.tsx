"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  User,
  Bed,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Search,
  ArrowLeft,
  Loader2,
  Copy,
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

interface CategoryOption {
  id: string;
  name: string;
  basePrice: string;
  maxOccupancy: number;
}

interface AvailableRoom {
  id: string;
  roomNo: string;
  displayName: string | null;
  capacity: number;
  status: string;
  building: { id: string; name: string };
  floor: { id: string; floorNo: number; name: string | null };
  category: {
    id: string;
    name: string;
    basePrice: string;
    maxOccupancy: number;
  };
  effectiveRate: string;
}

interface AllocationDraft {
  roomId: string;
  roomNo: string;
  categoryName: string;
  arrivalDate: string;
  departureDate: string;
  bookedNightlyRate: string;
  adults: number;
  children: number;
  maxCapacity: number;
}

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
}

export function NewReservationForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();

  // Helper date defaults
  const today = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().split("T")[0];

  // Guest State
  const [guestMode, setGuestMode] = useState<"new" | "existing">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerOption[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
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

  // Search Availability State
  const [searchArrival, setSearchArrival] = useState(today);
  const [searchDeparture, setSearchDeparture] = useState(tomorrow);
  const [searchCategoryId, setSearchCategoryId] = useState("");
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  // Allocations Cart
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [specialRequests, setSpecialRequests] = useState("");

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Debounced search for existing customers
  useEffect(() => {
    if (guestMode !== "existing" || !customerSearchQuery.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await fetch(
          `/api/customers?search=${encodeURIComponent(customerSearchQuery.trim())}&limit=5`
        );
        const data = await res.json();
        if (data.success) {
          setCustomerSearchResults(data.customers || []);
        }
      } catch (err) {
        console.error("Failed to search customers:", err);
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearchQuery, guestMode]);

  // Fetch available rooms
  const handleCheckAvailability = async () => {
    if (!searchArrival || !searchDeparture) {
      setFormError("Please select both arrival and departure dates to check availability.");
      return;
    }
    if (searchDeparture <= searchArrival) {
      setFormError("Departure date must be after arrival date.");
      return;
    }

    setFormError(null);
    setCheckingAvailability(true);
    setAvailabilityChecked(true);

    try {
      let url = `/api/availability?arrivalDate=${searchArrival}&departureDate=${searchDeparture}`;
      if (searchCategoryId) {
        url += `&roomCategoryId=${encodeURIComponent(searchCategoryId)}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to check room availability");
      }

      setAvailableRooms(data.rooms || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to search available rooms";
      setFormError(message);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Add room to allocations
  const handleAddRoom = (room: AvailableRoom) => {
    // Check if room is already added for overlapping dates in draft
    const alreadyAdded = allocations.some((a) => a.roomId === room.id);
    if (alreadyAdded) {
      setFormError(`Room ${room.roomNo} has already been added to this booking.`);
      return;
    }

    setFormError(null);
    const newAllocation: AllocationDraft = {
      roomId: room.id,
      roomNo: room.roomNo,
      categoryName: room.category.name,
      arrivalDate: searchArrival,
      departureDate: searchDeparture,
      bookedNightlyRate: room.effectiveRate,
      adults: 1,
      children: 0,
      maxCapacity: room.capacity,
    };

    setAllocations((prev) => [...prev, newAllocation]);
  };

  // Remove room from allocations
  const handleRemoveAllocation = (roomId: string) => {
    setAllocations((prev) => prev.filter((a) => a.roomId !== roomId));
  };

  // Update allocation attributes
  const handleUpdateAllocation = (
    index: number,
    field: keyof AllocationDraft,
    value: string | number
  ) => {
    setAllocations((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Apply default search dates to all allocations
  const handleApplyDatesToAll = () => {
    setAllocations((prev) =>
      prev.map((a) => ({
        ...a,
        arrivalDate: searchArrival,
        departureDate: searchDeparture,
      }))
    );
  };

  // Calculate stay duration (nights)
  const getNights = (arrivalStr: string, departureStr: string) => {
    const arr = new Date(arrivalStr);
    const dep = new Date(departureStr);
    return Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
  };

  // Calculate booking summary
  const totalNights = allocations.reduce(
    (acc, a) => acc + getNights(a.arrivalDate, a.departureDate),
    0
  );
  const totalEstimatedCost = allocations.reduce((acc, a) => {
    const nights = getNights(a.arrivalDate, a.departureDate);
    const rate = parseFloat(a.bookedNightlyRate) || 0;
    return acc + nights * rate;
  }, 0);

  // Submit Reservation
  const handleSubmitBooking = async () => {
    setFormError(null);

    // Validation
    if (allocations.length === 0) {
      setFormError("Please allocate at least one room to this reservation.");
      return;
    }

    for (const alloc of allocations) {
      if (alloc.departureDate <= alloc.arrivalDate) {
        setFormError(
          `Departure date must be after arrival date for Room ${alloc.roomNo}.`
        );
        return;
      }
    }

    if (guestMode === "new") {
      if (!newCustomer.firstName.trim()) {
        setFormError("Guest first name is required.");
        return;
      }
    } else {
      if (!selectedCustomerId) {
        setFormError("Please select an existing primary guest.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload: {
        specialRequests: string | null;
        allocations: {
          roomId: string;
          arrivalDate: string;
          departureDate: string;
          bookedNightlyRate: number;
          adults: number;
          children: number;
        }[];
        newCustomer?: {
          firstName: string;
          lastName: string | null;
          phone: string | null;
          email: string | null;
          nationality: string | null;
          address: string | null;
          idProofType: string | null;
          idProofNumber: string | null;
          remarks: string | null;
        };
        customerId?: string;
      } = {
        specialRequests: specialRequests.trim() || null,
        allocations: allocations.map((a) => ({
          roomId: a.roomId,
          arrivalDate: a.arrivalDate,
          departureDate: a.departureDate,
          bookedNightlyRate: parseFloat(a.bookedNightlyRate),
          adults: parseInt(a.adults.toString(), 10) || 1,
          children: parseInt(a.children.toString(), 10) || 0,
        })),
      };

      if (guestMode === "new") {
        payload.newCustomer = {
          firstName: newCustomer.firstName.trim(),
          lastName: newCustomer.lastName.trim() || null,
          phone: newCustomer.phone.trim() || null,
          email: newCustomer.email.trim() || null,
          nationality: newCustomer.nationality.trim() || null,
          address: newCustomer.address.trim() || null,
          idProofType: newCustomer.idProofType.trim() || null,
          idProofNumber: newCustomer.idProofNumber.trim() || null,
          remarks: newCustomer.remarks.trim() || null,
        };
      } else {
        payload.customerId = selectedCustomerId;
      }

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create reservation");
      }

      // Success: redirect to reservation details
      router.push(`/reservations/${data.reservation.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred while booking reservation.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/reservations">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Create New Reservation</h1>
            <p className="text-xs text-muted-foreground">
              Reception desk multi-room booking with real-time availability checks.
            </p>
          </div>
        </div>
      </div>

      {formError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{formError}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Guest & Dates/Availability (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Primary Guest Details */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  1. Primary Guest Details
                </CardTitle>
                <div className="flex items-center gap-1 bg-background rounded-md p-1 border">
                  <Button
                    type="button"
                    variant={guestMode === "new" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setGuestMode("new");
                      setSelectedCustomerId("");
                    }}
                  >
                    New Guest
                  </Button>
                  <Button
                    type="button"
                    variant={guestMode === "existing" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setGuestMode("existing")}
                  >
                    Existing Guest
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {guestMode === "new" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. John"
                      className="text-xs h-8"
                      value={newCustomer.firstName}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, firstName: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Last Name</Label>
                    <Input
                      placeholder="e.g. Doe"
                      className="text-xs h-8"
                      value={newCustomer.lastName}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, lastName: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      className="text-xs h-8"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, phone: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Email Address</Label>
                    <Input
                      type="email"
                      placeholder="guest@example.com"
                      className="text-xs h-8"
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Nationality</Label>
                    <Input
                      placeholder="e.g. American"
                      className="text-xs h-8"
                      value={newCustomer.nationality}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, nationality: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">ID Proof Type</Label>
                    <select
                      className="w-full text-xs h-8 rounded-md border border-input bg-transparent px-2.5 py-1 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={newCustomer.idProofType}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, idProofType: e.target.value })
                      }
                    >
                      <option value="Passport">Passport</option>
                      <option value="National ID">National ID</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">ID Proof Number</Label>
                    <Input
                      placeholder="e.g. A12345678"
                      className="text-xs h-8"
                      value={newCustomer.idProofNumber}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, idProofNumber: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Residential Address</Label>
                    <Input
                      placeholder="City, Country"
                      className="text-xs h-8"
                      value={newCustomer.address}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, address: e.target.value })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search existing guest by name, phone, or email..."
                      className="pl-9 text-xs h-9"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    />
                  </div>

                  {searchingCustomer && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Searching guests...
                    </div>
                  )}

                  {customerSearchResults.length > 0 && (
                    <div className="border rounded-md divide-y text-xs max-h-48 overflow-y-auto">
                      {customerSearchResults.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerSearchQuery(`${c.firstName} ${c.lastName || ""}`.trim());
                            setCustomerSearchResults([]);
                          }}
                          className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedCustomerId === c.id ? "bg-primary/10 font-semibold" : ""
                          }`}
                        >
                          <div>
                            <span className="font-medium">
                              {c.firstName} {c.lastName}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              {c.phone || c.email || ""}
                            </span>
                          </div>
                          {selectedCustomerId === c.id && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedCustomerId && (
                    <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <span>Guest selected: <strong>{customerSearchQuery}</strong></span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px]"
                        onClick={() => setSelectedCustomerId("")}
                      >
                        Change
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Date Range & Live Availability Search */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                2. Check Room Availability
              </CardTitle>
              <CardDescription className="text-xs">
                Query physical rooms with half-open date interval [arrival, departure) safety.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Arrival Date (Check-in)</Label>
                  <Input
                    type="date"
                    className="text-xs h-8 font-mono"
                    value={searchArrival}
                    onChange={(e) => setSearchArrival(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Departure Date (Check-out)</Label>
                  <Input
                    type="date"
                    className="text-xs h-8 font-mono"
                    value={searchDeparture}
                    onChange={(e) => setSearchDeparture(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Category (Optional)</Label>
                  <select
                    className="w-full text-xs h-8 rounded-md border border-input bg-transparent px-2.5 py-1 shadow-xs"
                    value={searchCategoryId}
                    onChange={(e) => setSearchCategoryId(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (${c.basePrice}/night)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCheckAvailability}
                  disabled={checkingAvailability}
                  className="h-8 text-xs"
                >
                  {checkingAvailability ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Checking Availability...
                    </>
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5 mr-1.5" />
                      Search Available Rooms
                    </>
                  )}
                </Button>

                {allocations.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyDatesToAll}
                    className="h-8 text-xs text-muted-foreground"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Apply Dates to All Added Rooms
                  </Button>
                )}
              </div>

              {/* Availability Results Grid */}
              {availabilityChecked && (
                <div className="pt-2">
                  <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                    <span>
                      Available Rooms ({availableRooms.length}) for {searchArrival} → {searchDeparture}
                    </span>
                  </div>

                  {availableRooms.length === 0 ? (
                    <div className="p-6 text-center border rounded-md text-xs text-muted-foreground bg-muted/10">
                      No physical rooms available for the selected stay dates and category.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
                      {availableRooms.map((room) => {
                        const isAdded = allocations.some((a) => a.roomId === room.id);

                        return (
                          <div
                            key={room.id}
                            className={`border rounded-lg p-3 text-xs flex flex-col justify-between transition-colors ${
                              isAdded ? "bg-muted/40 border-primary/30" : "bg-card hover:border-foreground/30"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold font-mono text-sm">
                                  Room {room.roomNo}
                                </span>
                                <Badge variant="secondary" className="text-[10px]">
                                  {room.category.name}
                                </Badge>
                              </div>

                              <div className="text-muted-foreground text-[11px]">
                                {room.building.name} • Floor {room.floor.floorNo} • Max {room.capacity} Guests
                              </div>

                              <div className="font-semibold text-primary pt-1">
                                ${parseFloat(room.effectiveRate).toFixed(2)}{" "}
                                <span className="text-[10px] text-muted-foreground font-normal">/ night</span>
                              </div>
                            </div>

                            <div className="pt-2">
                              {isAdded ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemoveAllocation(room.id)}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  className="w-full h-7 text-xs"
                                  onClick={() => handleAddRoom(room)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add to Booking
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Special Requests */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold">
                3. Special Requests & Remarks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea
                placeholder="Optional notes or special requests (e.g. late check-in, ground floor preference, extra bedding)..."
                className="text-xs resize-none"
                rows={3}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Multi-Room Allocations & Summary (1 Col) */}
        <div className="space-y-6">
          <Card className="shadow-xs sticky top-20">
            <CardHeader className="p-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bed className="h-4 w-4 text-primary" />
                  Allocated Rooms ({allocations.length})
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {allocations.length} Room{allocations.length === 1 ? "" : "s"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {allocations.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                  <Bed className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  No rooms added yet.
                  <p className="text-[11px] mt-1">
                    Check availability and click &quot;Add to Booking&quot;.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allocations.map((alloc, idx) => {
                    const nights = getNights(alloc.arrivalDate, alloc.departureDate);
                    const roomTotal = nights * (parseFloat(alloc.bookedNightlyRate) || 0);

                    return (
                      <div
                        key={alloc.roomId}
                        className="border rounded-md p-3 text-xs space-y-2 bg-muted/10 relative"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold font-mono">Room {alloc.roomNo}</span>
                            <span className="text-muted-foreground text-[11px] ml-1.5">
                              ({alloc.categoryName})
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveAllocation(alloc.roomId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Stay Dates per Room */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Arrival:</span>
                            <Input
                              type="date"
                              className="text-[11px] h-7 px-2 font-mono"
                              value={alloc.arrivalDate}
                              onChange={(e) =>
                                handleUpdateAllocation(idx, "arrivalDate", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Departure:</span>
                            <Input
                              type="date"
                              className="text-[11px] h-7 px-2 font-mono"
                              value={alloc.departureDate}
                              onChange={(e) =>
                                handleUpdateAllocation(idx, "departureDate", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        {/* Occupancy and Booked Rate Snapshot */}
                        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Adults:</span>
                            <Input
                              type="number"
                              min={1}
                              className="text-[11px] h-7 px-2 font-mono"
                              value={alloc.adults}
                              onChange={(e) =>
                                handleUpdateAllocation(idx, "adults", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Children:</span>
                            <Input
                              type="number"
                              min={0}
                              className="text-[11px] h-7 px-2 font-mono"
                              value={alloc.children}
                              onChange={(e) =>
                                handleUpdateAllocation(idx, "children", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Rate ($):</span>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              className="text-[11px] h-7 px-2 font-mono"
                              value={alloc.bookedNightlyRate}
                              onChange={(e) =>
                                handleUpdateAllocation(idx, "bookedNightlyRate", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t text-muted-foreground">
                          <span>{nights} night(s) × ${parseFloat(alloc.bookedNightlyRate || "0").toFixed(2)}</span>
                          <span className="font-semibold text-foreground">
                            ${roomTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total Summary */}
              <div className="border-t pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Rooms</span>
                  <span>{allocations.length}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Guest Nights</span>
                  <span>{totalNights}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1 border-t">
                  <span>Estimated Total</span>
                  <span className="text-primary font-mono">${totalEstimatedCost.toFixed(2)}</span>
                </div>
              </div>

              <Button
                type="button"
                className="w-full bg-primary hover:bg-primary/90 text-xs h-9"
                disabled={submitting || allocations.length === 0}
                onClick={handleSubmitBooking}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Reservation...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm & Book Reservation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
