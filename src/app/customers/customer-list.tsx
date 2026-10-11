"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Users,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PageHeader,
  DataTableShell,
  MobileCardList,
  EmptyState,
} from "@/components/ui-kit"
import { getIdProofOptions } from "@/lib/constants"

export interface SerializedCustomer {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
  nationality: string | null
  address: string | null
  idProofType: string | null
  idProofNumber: string | null
  remarks: string | null
  reservationsCount: number
  createdAt: string
}

export interface CustomerPagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface CustomerListProps {
  initialCustomers: SerializedCustomer[]
  initialPagination?: CustomerPagination
}

export function CustomerList({
  initialCustomers,
  initialPagination,
}: CustomerListProps) {
  const router = useRouter()
  const [customers, setCustomers] = React.useState<SerializedCustomer[]>(initialCustomers)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(initialPagination?.page || 1)
  const [pagination, setPagination] = React.useState<CustomerPagination>(
    initialPagination || {
      total: initialCustomers.length,
      page: 1,
      limit: 20,
      totalPages: Math.max(1, Math.ceil(initialCustomers.length / 20)),
    }
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const isInitialMount = React.useRef(true)

  // Register Guest Dialog State
  const [isRegisterOpen, setIsRegisterOpen] = React.useState(false)
  const [showIdAddress, setShowIdAddress] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    nationality: "",
    address: "",
    idProofType: "Passport",
    idProofNumber: "",
    remarks: "",
  })

  const fetchCustomers = React.useCallback(async (query = searchTerm, page = currentPage) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("search", query.trim())
      params.set("page", String(page))
      params.set("limit", "20")

      const res = await fetch(`/api/customers?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch customers")
      const data = await res.json()

      if (data.success) {
        const mapped: SerializedCustomer[] = data.customers.map((c: {
          id: string
          firstName: string
          lastName: string | null
          phone: string | null
          email: string | null
          nationality: string | null
          address: string | null
          idProofType: string | null
          idProofNumber: string | null
          remarks: string | null
          _count?: { reservations: number }
          reservationsCount?: number
          createdAt: string | Date
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
        }))

        setCustomers(mapped)
        if (data.pagination) {
          setPagination(data.pagination)
        }
      }
    } catch (err: unknown) {
      console.error("Error fetching customers:", err)
      setError("Unable to load guest directory. Please retry.")
    } finally {
      setLoading(false)
    }
  }, [searchTerm, currentPage])

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const timer = setTimeout(() => {
      fetchCustomers(searchTerm, currentPage)
    }, 250)

    return () => clearTimeout(timer)
  }, [fetchCustomers, searchTerm, currentPage])

  const handleRegisterGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.firstName.trim()) {
      setFormError("First name is required.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to register guest")
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
      }

      setCustomers((prev) => [newCustomer, ...prev])
      setPagination((prev) => ({
        ...prev,
        total: prev.total + 1,
      }))

      toast.success(`Guest ${newCustomer.firstName} registered successfully`)
      setIsRegisterOpen(false)
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
      })
      setShowIdAddress(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register guest"
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Guests"
        description="Reception desk guest directory, profiles, and stay records"
        action={
          <Button
            size="sm"
            onClick={() => {
              setFormError(null)
              setIsRegisterOpen(true)
            }}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5"
          >
            <Plus className="size-4" />
            <span>Register Guest</span>
          </Button>
        }
      />

      {/* Toolbar: Search input */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by guest name, phone, email, or ID..."
            className="pl-9 h-10 text-xs sm:text-sm bg-card"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>
      </div>

      {/* Table & Mobile Cards */}
      <DataTableShell
        isLoading={loading}
        error={error}
        onRetry={() => fetchCustomers()}
        isEmpty={customers.length === 0}
        emptyState={
          <EmptyState
            icon={<Users className="size-6" />}
            title="No guests found"
            description={
              searchTerm
                ? `No guests match "${searchTerm}".`
                : "No guests registered in directory yet."
            }
            action={
              <Button
                size="sm"
                onClick={() => setIsRegisterOpen(true)}
                className="gap-1.5"
              >
                <Plus className="size-4" />
                <span>Register First Guest</span>
              </Button>
            }
          />
        }
        pagination={{
          page: currentPage,
          totalPages: pagination.totalPages,
          totalCount: pagination.total,
          limit: pagination.limit,
          onPageChange: (p) => setCurrentPage(p),
        }}
        mobileView={
          <MobileCardList
            items={customers}
            keyExtractor={(c) => c.id}
            renderCard={(c) => {
              const fullName = `${c.firstName} ${c.lastName || ""}`.trim()
              return (
                <div
                  onClick={() => router.push(`/customers/${c.id}`)}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-2 cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-sm">{fullName}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                      {c.reservationsCount} stay{c.reservationsCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <div>{c.phone || c.email || "No contact registered"}</div>
                    {c.idProofNumber ? (
                      <div className="font-mono text-[11px]">
                        {c.idProofType || "ID"}: {c.idProofNumber}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground/60 italic">Unrecorded ID</div>
                    )}
                  </div>
                </div>
              )
            }}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold">Guest</TableHead>
              <TableHead className="text-xs font-semibold">Contact</TableHead>
              <TableHead className="text-xs font-semibold">ID Proof</TableHead>
              <TableHead className="text-right text-xs font-semibold">Stays</TableHead>
              <TableHead className="w-[44px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => {
              const fullName = `${c.firstName} ${c.lastName || ""}`.trim()
              return (
                <TableRow
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  className="h-16 text-xs hover:bg-muted/40 cursor-pointer transition-colors group"
                >
                  <TableCell className="font-medium">
                    <span className="font-semibold text-foreground text-xs block">{fullName}</span>
                    {c.address && (
                      <span className="text-[11px] text-muted-foreground block truncate max-w-[220px]">
                        {c.address}
                      </span>
                    )}
                    {c.nationality && (
                      <span className="text-[10px] text-muted-foreground/80 block">
                        {c.nationality}
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <span className="text-foreground block">{c.phone || "—"}</span>
                    <span className="text-[11px] text-muted-foreground block truncate max-w-[200px]">
                      {c.email || "No email"}
                    </span>
                  </TableCell>

                  <TableCell>
                    {c.idProofNumber ? (
                      <div>
                        <span className="font-mono text-foreground text-xs block">{c.idProofNumber}</span>
                        <span className="text-[10px] text-muted-foreground">{c.idProofType || "Document"}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60 italic text-xs">Unrecorded</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right font-mono font-medium">
                    <span className="rounded-full bg-muted/70 px-2.5 py-1 text-xs text-foreground">
                      {c.reservationsCount} stay{c.reservationsCount === 1 ? "" : "s"}
                    </span>
                  </TableCell>

                  <TableCell className="text-right p-0 pr-4">
                    <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors ml-auto" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </DataTableShell>

      {/* REGISTER GUEST DIALOG */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Guest</DialogTitle>
            <DialogDescription>
              Create a new guest record in the property directory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterGuest} className="space-y-4 py-2 text-xs">
            {formError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">First Name *</Label>
                <Input
                  placeholder="e.g. Jane"
                  className="h-10 text-xs sm:text-sm"
                  value={formData.firstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Last Name</Label>
                <Input
                  placeholder="e.g. Smith"
                  className="h-10 text-xs sm:text-sm"
                  value={formData.lastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input
                  placeholder="+91 98765 43210"
                  className="h-10 text-xs sm:text-sm font-mono"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  type="email"
                  placeholder="e.g. jane@example.com"
                  className="h-10 text-xs sm:text-sm"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            {/* Collapsed ID and address section */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowIdAddress(!showIdAddress)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                {showIdAddress ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                <span>ID proof & address (optional)</span>
              </button>

              {showIdAddress && (
                <div className="mt-2.5 space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5 animate-in fade-in-50">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Nationality</Label>
                    <Input
                      placeholder="e.g. Indian"
                      className="h-9 text-xs"
                      value={formData.nationality}
                      onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">ID Proof Type</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs"
                        value={formData.idProofType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, idProofType: e.target.value }))}
                      >
                        {getIdProofOptions(formData.idProofType).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">ID Proof Number</Label>
                      <Input
                        placeholder="e.g. Pass No or National ID"
                        className="h-9 text-xs font-mono"
                        value={formData.idProofNumber}
                        onChange={(e) => setFormData((prev) => ({ ...prev, idProofNumber: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Residential Address</Label>
                    <Input
                      placeholder="City, State"
                      className="h-9 text-xs"
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Remarks / Preferences</Label>
                    <Input
                      placeholder="VIP, quiet room requested..."
                      className="h-9 text-xs"
                      value={formData.remarks}
                      onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                </div>
              )}
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
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
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
  )
}
