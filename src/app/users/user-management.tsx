"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserCheck,
  UserX,
  Building2,
  Plus,
  Search,
  KeyRound,
  Pencil,
  Trash2,
  Shield,
  Globe,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { RoleName } from "@prisma/client";
import type { SessionPayload } from "@/modules/auth/auth.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PaginationFooter } from "@/components/ui-kit/pagination-footer";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

interface SerializedUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  role: RoleName;
  propertyId: string | null;
  property?: { id: string; name: string; status: string } | null;
  status: string;
  mustChangePassword: boolean;
  tokenVersion: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RoleOption {
  id: string;
  name: RoleName;
  description: string | null;
}

interface PropertyOption {
  id: string;
  name: string;
  status: string;
}

interface UserManagementProps {
  session: SessionPayload;
  initialUsers: SerializedUser[];
  initialPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  roles: RoleOption[];
  properties: PropertyOption[];
}

export function UserManagement({
  session,
  initialUsers,
  initialPagination,
  roles,
  properties,
}: UserManagementProps) {
  const router = useRouter();
  const [users, setUsers] = useState<SerializedUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [selectedHotelFilter, setSelectedHotelFilter] = useState<string>("ALL");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  const [page, setPage] = useState(initialPagination?.page || 1);
  const [limit, setLimit] = useState(initialPagination?.limit || DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(initialPagination?.total ?? initialUsers.length);
  const [totalPages, setTotalPages] = useState(
    initialPagination?.totalPages ?? Math.max(1, Math.ceil(initialUsers.length / DEFAULT_PAGE_SIZE))
  );
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const prevFiltersRef = React.useRef({
    search,
    selectedHotelFilter,
    selectedRoleFilter,
    selectedStatusFilter,
    page,
    limit,
  });

  const isSuperAdmin = session.role === RoleName.SUPER_ADMIN;

  // Dialog States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPwDialogOpen, setResetPwDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Active Target for edit/reset/delete
  const [activeUser, setActiveUser] = useState<SerializedUser | null>(null);

  // Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States - Create
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRoleId, setCreateRoleId] = useState(roles[0]?.id || "");
  const [createPropertyId, setCreatePropertyId] = useState(
    isSuperAdmin ? "" : session.propertyId || ""
  );
  const [createMustChangePw, setCreateMustChangePw] = useState(true);

  // Form States - Edit
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editPropertyId, setEditPropertyId] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editMustChangePw, setEditMustChangePw] = useState(false);

  // Form States - Reset Password
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetMustChangePw, setResetMustChangePw] = useState(true);

  // KPI Calculations
  const totalUsers = total;
  const activeCount = users.filter((u) => u.status === "ACTIVE").length;
  const disabledCount = users.filter((u) => u.status === "DISABLED").length;
  const uniqueHotelsCount = useMemo(() => {
    return properties.length;
  }, [properties]);

  const fetchUsers = React.useCallback(
    async (
      q = search,
      hotel = selectedHotelFilter,
      role = selectedRoleFilter,
      status = selectedStatusFilter,
      p = page,
      l = limit
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("search", q.trim());
        if (hotel !== "ALL") params.set("propertyId", hotel);
        if (role !== "ALL") params.set("role", role);
        if (status !== "ALL") params.set("status", status);
        params.set("page", String(p));
        params.set("limit", String(l));

        const res = await fetch(`/api/users?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load staff accounts");
        const json = await res.json();
        if (json.success) {
          setUsers(json.data || json.users || []);
          if (json.total !== undefined) setTotal(json.total);
          if (json.totalPages !== undefined) setTotalPages(json.totalPages);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast.error("Failed to load users");
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    },
    [search, selectedHotelFilter, selectedRoleFilter, selectedStatusFilter, page, limit]
  );

  React.useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.search !== search ||
      prev.selectedHotelFilter !== selectedHotelFilter ||
      prev.selectedRoleFilter !== selectedRoleFilter ||
      prev.selectedStatusFilter !== selectedStatusFilter;
    const pageChanged = prev.page !== page;
    const limitChanged = prev.limit !== limit;

    if (!filtersChanged && !pageChanged && !limitChanged) {
      return;
    }

    if ((filtersChanged || limitChanged) && page !== 1) {
      prevFiltersRef.current = {
        search,
        selectedHotelFilter,
        selectedRoleFilter,
        selectedStatusFilter,
        page: 1,
        limit,
      };
      setPage(1);
      return;
    }

    prevFiltersRef.current = {
      search,
      selectedHotelFilter,
      selectedRoleFilter,
      selectedStatusFilter,
      page,
      limit,
    };

    const timer = setTimeout(() => {
      fetchUsers(search, selectedHotelFilter, selectedRoleFilter, selectedStatusFilter, page, limit);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, selectedHotelFilter, selectedRoleFilter, selectedStatusFilter, page, limit, fetchUsers]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setCreateName("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateRoleId(roles[0]?.id || "");
    setCreatePropertyId(isSuperAdmin ? (properties[0]?.id || "") : (session.propertyId || ""));
    setCreateMustChangePw(true);
    setCreateDialogOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createEmail.trim() || !createPassword.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const selectedRole = roles.find((r) => r.id === createRoleId);
    const requiresProperty = selectedRole?.name !== RoleName.SUPER_ADMIN;

    if (requiresProperty && isSuperAdmin && !createPropertyId) {
      toast.error("Please select a hotel for this user account.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          email: createEmail.trim(),
          password: createPassword,
          roleId: createRoleId,
          propertyId: requiresProperty ? createPropertyId || null : null,
          mustChangePassword: createMustChangePw,
          status: "ACTIVE",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create user");
      }

      toast.success("User account created successfully.");
      setCreateDialogOpen(false);
      fetchUsers();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (user: SerializedUser) => {
    setActiveUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRoleId(user.roleId);
    setEditPropertyId(user.propertyId || "");
    setEditStatus(user.status);
    setEditMustChangePw(user.mustChangePassword);
    setEditDialogOpen(true);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;

    setIsSubmitting(true);
    try {
      const updatePayload: Record<string, unknown> = {
        name: editName.trim(),
        email: editEmail.trim(),
        status: editStatus,
        mustChangePassword: editMustChangePw,
      };

      if (isSuperAdmin) {
        updatePayload.roleId = editRoleId;
        const selectedRole = roles.find((r) => r.id === editRoleId);
        if (selectedRole?.name === RoleName.SUPER_ADMIN) {
          updatePayload.propertyId = null;
        } else {
          updatePayload.propertyId = editPropertyId || null;
        }
      }

      const res = await fetch(`/api/users/${activeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update user");
      }

      toast.success("User updated successfully.");
      setEditDialogOpen(false);
      setUsers((prev) =>
        prev.map((u) => (u.id === activeUser.id ? { ...u, ...json.data } : u))
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Reset Password Dialog
  const handleOpenResetPw = (user: SerializedUser) => {
    setActiveUser(user);
    setResetNewPassword("");
    setResetMustChangePw(true);
    setResetPwDialogOpen(true);
  };

  // Submit Reset Password
  const handleResetPwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser || !resetNewPassword.trim()) {
      toast.error("Please enter a new password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${activeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetNewPassword,
          mustChangePassword: resetMustChangePw,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to reset password");
      }

      toast.success(`Password reset for ${activeUser.name}.`);
      setResetPwDialogOpen(false);
      setUsers((prev) =>
        prev.map((u) => (u.id === activeUser.id ? { ...u, ...json.data } : u))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (user: SerializedUser) => {
    const nextStatus = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update user status");
      }

      toast.success(
        nextStatus === "ACTIVE"
          ? `${user.name} is now active.`
          : `${user.name} has been disabled.`
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  // Open Delete Dialog
  const handleOpenDelete = (user: SerializedUser) => {
    setActiveUser(user);
    setDeleteDialogOpen(true);
  };

  // Submit Delete
  const handleDeleteSubmit = async () => {
    if (!activeUser) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${activeUser.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete user");
      }

      toast.success(`User ${activeUser.name} deleted.`);
      setDeleteDialogOpen(false);
      fetchUsers();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "U"
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Staff & User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin
              ? "Platform-wide user management, role assignments, and hotel staffing control."
              : `Manage receptionist staff accounts and credentials for ${
                  session.property?.name || "your hotel"
                }.`}
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2 shadow-xs">
          <Plus className="size-4" />
          <span>Add Staff Member</span>
        </Button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/80 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
                Total Users
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground mt-1 font-mono">
                {totalUsers}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
                Active Staff
              </p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {activeCount}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserCheck className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
                Disabled
              </p>
              <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {disabledCount}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <UserX className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
                {isSuperAdmin ? "Hotels" : "Assigned Hotel"}
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground mt-1 font-mono truncate max-w-[140px]">
                {isSuperAdmin ? uniqueHotelsCount : "1 Hotel"}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
              <Building2 className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border border-border/80 shadow-2xs">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by staff name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Hotel Selector (Super Admin only) */}
            {isSuperAdmin && (
              <select
                value={selectedHotelFilter}
                onChange={(e) => setSelectedHotelFilter(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Hotels</option>
                <option value="GLOBAL">Platform Super Admins (No Hotel)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {/* Role Filter */}
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Roles</option>
              {isSuperAdmin && <option value={RoleName.SUPER_ADMIN}>Super Admin</option>}
              <option value={RoleName.ADMIN}>Hotel Admin</option>
              <option value={RoleName.RECEPTIONIST}>Receptionist</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>

            {/* Reset Filters button */}
            {(search ||
              selectedHotelFilter !== "ALL" ||
              selectedRoleFilter !== "ALL" ||
              selectedStatusFilter !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedHotelFilter("ALL");
                  setSelectedRoleFilter("ALL");
                  setSelectedStatusFilter("ALL");
                }}
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border border-border/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Assigned Hotel</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Security / Setup</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Users className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-medium text-foreground">No staff members found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || selectedHotelFilter !== "ALL" || selectedRoleFilter !== "ALL"
                        ? "Try clearing filters to find users."
                        : "Click 'Add Staff Member' to create a new user account."}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isUserSuperAdmin = user.role === RoleName.SUPER_ADMIN;
                  const isUserAdmin = user.role === RoleName.ADMIN;
                  const isSelf = user.id === session.sub;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "size-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 tracking-tight",
                              isUserSuperAdmin
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                                : "bg-primary/10 text-primary border border-primary/20"
                            )}
                          >
                            {getInitials(user.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground truncate">
                                {user.name}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate font-mono">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Hotel Assignment */}
                      <td className="py-3.5 px-4">
                        {isUserSuperAdmin ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            <Globe className="size-3 text-purple-600 dark:text-purple-400" />
                            <span>System-Wide (All)</span>
                          </div>
                        ) : user.property ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
                            <Building2 className="size-3 text-muted-foreground" />
                            <span className="truncate max-w-[160px]">{user.property.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            isUserSuperAdmin
                              ? "default"
                              : isUserAdmin
                              ? "secondary"
                              : "outline"
                          }
                          className={cn(
                            "text-xs font-semibold px-2 py-0.5",
                            isUserSuperAdmin && "bg-purple-600 hover:bg-purple-700 text-white"
                          )}
                        >
                          <Shield className="size-3 mr-1 inline" />
                          {isUserSuperAdmin
                            ? "Super Admin"
                            : isUserAdmin
                            ? "Hotel Admin"
                            : "Receptionist"}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-medium",
                            user.status === "ACTIVE"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "border-muted-foreground/30 bg-muted text-muted-foreground"
                          )}
                        >
                          {user.status === "ACTIVE" ? (
                            <>
                              <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                              Active
                            </>
                          ) : (
                            <>
                              <span className="size-1.5 rounded-full bg-muted-foreground mr-1.5 inline-block" />
                              Disabled
                            </>
                          )}
                        </Badge>
                      </td>

                      {/* Security Status */}
                      <td className="py-3.5 px-4 text-xs">
                        {user.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            Must reset PW
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                            Verified
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Details */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(user)}
                            className="size-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit User"
                          >
                            <Pencil className="size-3.5" />
                          </Button>

                          {/* Reset Password */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenResetPw(user)}
                            className="size-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Reset Password"
                          >
                            <KeyRound className="size-3.5" />
                          </Button>

                          {/* Toggle Active/Disabled */}
                          {!isSelf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(user)}
                              className={cn(
                                "size-8 p-0",
                                user.status === "ACTIVE"
                                  ? "text-muted-foreground hover:text-amber-600"
                                  : "text-muted-foreground hover:text-emerald-600"
                              )}
                              title={user.status === "ACTIVE" ? "Disable User" : "Activate User"}
                            >
                              <UserX className="size-3.5" />
                            </Button>
                          )}

                          {/* Delete User */}
                          {!isSelf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDelete(user)}
                              className="size-8 p-0 text-muted-foreground hover:text-destructive"
                              title="Delete User"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          isLoading={isLoading}
          onPageChange={(newPage) => {
            setPage(newPage);
            fetchUsers(search, selectedHotelFilter, selectedRoleFilter, selectedStatusFilter, newPage, limit);
          }}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
            fetchUsers(search, selectedHotelFilter, selectedRoleFilter, selectedStatusFilter, 1, newLimit);
          }}
          syncUrl={true}
        />
      </Card>

      {/* CREATE USER DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Create a new user account with role permissions and hotel assignment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                required
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Maria Santos"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Work Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="reception@byteinn.local"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Temporary Password *</Label>
              <Input
                id="password"
                type="text"
                required
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special"
              />
              <p className="text-[11px] text-muted-foreground">
                Must include uppercase, lowercase, number, and special character.
              </p>
            </div>

            {/* Role Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="roleId">Role *</Label>
              <select
                id="roleId"
                value={createRoleId}
                onChange={(e) => setCreateRoleId(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name === RoleName.SUPER_ADMIN
                      ? "Super Administrator (Platform)"
                      : r.name === RoleName.ADMIN
                      ? "Hotel Administrator"
                      : "Front Desk Receptionist"}
                  </option>
                ))}
              </select>
            </div>

            {/* Hotel Assignment */}
            {(() => {
              const selectedRole = roles.find((r) => r.id === createRoleId);
              const isSuper = selectedRole?.name === RoleName.SUPER_ADMIN;

              if (isSuper) {
                return (
                  <div className="rounded-lg p-3 bg-muted/50 border border-border text-xs text-muted-foreground flex items-center gap-2">
                    <Globe className="size-4 text-purple-600 shrink-0" />
                    <span>Super Administrators have system-wide access across all hotels.</span>
                  </div>
                );
              }

              if (!isSuperAdmin) {
                return (
                  <div className="space-y-1.5">
                    <Label>Assigned Hotel</Label>
                    <Input
                      disabled
                      value={session.property?.name || "Current Hotel"}
                      className="bg-muted text-muted-foreground"
                    />
                  </div>
                );
              }

              return (
                <div className="space-y-1.5">
                  <Label htmlFor="hotelId">Assigned Hotel *</Label>
                  <select
                    id="hotelId"
                    required
                    value={createPropertyId}
                    onChange={(e) => setCreatePropertyId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select a hotel...</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {/* Must Change Password Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="mustChangePw"
                checked={createMustChangePw}
                onChange={(e) => setCreateMustChangePw(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="mustChangePw" className="text-xs font-normal cursor-pointer">
                Require password reset on first login
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                Create Staff Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT USER DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update account profile and operational permissions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editName">Full Name</Label>
              <Input
                id="editName"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editEmail">Work Email</Label>
              <Input
                id="editEmail"
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>

            {/* Super Admin can change Role */}
            {isSuperAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="editRole">Role</Label>
                <select
                  id="editRole"
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Super Admin can change Hotel */}
            {isSuperAdmin && editRoleId !== roles.find((r) => r.name === RoleName.SUPER_ADMIN)?.id && (
              <div className="space-y-1.5">
                <Label htmlFor="editHotel">Assigned Hotel</Label>
                <select
                  id="editHotel"
                  value={editPropertyId}
                  onChange={(e) => setEditPropertyId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No Hotel (Unassigned)</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="editStatus">Status</Label>
              <select
                id="editStatus"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>

            {/* Must Change Password Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editMustChangePw"
                checked={editMustChangePw}
                onChange={(e) => setEditMustChangePw(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="editMustChangePw" className="text-xs font-normal cursor-pointer">
                Require password change on next login
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD DIALOG */}
      <Dialog open={resetPwDialogOpen} onOpenChange={setResetPwDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a temporary password for <strong>{activeUser?.name}</strong> ({activeUser?.email}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPwSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="resetPassword">New Password *</Label>
              <Input
                id="resetPassword"
                type="text"
                required
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="e.g. TempPass@2026"
              />
              <p className="text-[11px] text-muted-foreground">
                Must contain at least 8 characters with uppercase, lowercase, number, and special character.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="resetMustChange"
                checked={resetMustChangePw}
                onChange={(e) => setResetMustChangePw(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="resetMustChange" className="text-xs font-normal cursor-pointer">
                Force user to change this password on next login
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPwDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" />
              <span>Confirm Account Deletion</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete the account for{" "}
              <strong>{activeUser?.name}</strong> ({activeUser?.email})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
