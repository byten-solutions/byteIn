"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Tag,
  Users,
  IndianRupee,
  Pencil,
  Trash2,
  Check,
  Sparkles,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { RowActionsMenu } from "@/components/ui-kit/row-actions-menu";
import { MoneyText } from "@/components/ui-kit/money-text";
import { FormSection } from "@/components/ui-kit/form-section";
import { cn } from "@/lib/utils";

interface AmenityItem {
  id: string;
  name: string;
  description: string | null;
}

interface CategoryItem {
  id: string;
  propertyId: string | null;
  name: string;
  description: string | null;
  basePrice: string | number;
  maxOccupancy: number;
  amenities: { amenity: AmenityItem }[];
  _count: { rooms: number };
}

interface Props {
  initialCategories: CategoryItem[];
  amenities: AmenityItem[];
  userRole: "SUPER_ADMIN" | "ADMIN" | "RECEPTIONIST";
}

export function CategoryManager({
  initialCategories,
  amenities,
  userRole,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [allAmenities, setAllAmenities] = useState<AmenityItem[]>(amenities);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const prevSearchRef = useRef(search);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCategories = useCallback(async (q: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const url = new URL("/api/room-categories", window.location.origin);
      if (q.trim()) url.searchParams.set("search", q.trim());

      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to load categories");
      const json = await res.json();
      if (json.success && json.categories) {
        setCategories(
          json.categories.map((cat: CategoryItem & { basePrice: unknown }) => ({
            ...cat,
            basePrice: String(cat.basePrice),
          }))
        );
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Failed to search categories");
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (prevSearchRef.current === search) return;
    prevSearchRef.current = search;

    const timer = setTimeout(() => {
      fetchCategories(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, fetchCategories]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Dialog state for Category
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryPrice, setCategoryPrice] = useState("");
  const [categoryOccupancy, setCategoryOccupancy] = useState("2");
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);

  // Dialog state for Amenity
  const [isAmenityDialogOpen, setIsAmenityDialogOpen] = useState(false);
  const [amenityName, setAmenityName] = useState("");
  const [amenityDescription, setAmenityDescription] = useState("");

  // Delete category confirmation dialog
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryPrice("");
    setCategoryOccupancy("2");
    setSelectedAmenityIds([]);
    setError(null);
    setIsCategoryDialogOpen(true);
  };

  const openEditCategory = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDescription(cat.description || "");
    setCategoryPrice(cat.basePrice.toString());
    setCategoryOccupancy(cat.maxOccupancy.toString());
    setSelectedAmenityIds(cat.amenities.map((a) => a.amenity.id));
    setError(null);
    setIsCategoryDialogOpen(true);
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: categoryName.trim(),
        description: categoryDescription.trim() || null,
        basePrice: parseFloat(categoryPrice) || 0,
        maxOccupancy: parseInt(categoryOccupancy, 10) || 1,
        amenityIds: selectedAmenityIds,
      };

      const url = editingCategory
        ? `/api/room-categories/${editingCategory.id}`
        : "/api/room-categories";
      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save room category");
      }

      setIsCategoryDialogOpen(false);
      toast.success(
        editingCategory
          ? `Category "${data.category.name}" updated`
          : `Category "${data.category.name}" created`
      );
      router.refresh();

      if (editingCategory) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? data.category : c))
        );
      } else {
        setCategories((prev) => [...prev, data.category]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving category";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/room-categories/${categoryToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
      toast.success(`Category "${categoryToDelete.name}" deleted`);
      setCategoryToDelete(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error deleting category";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/amenities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: amenityName.trim(),
          description: amenityDescription.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create amenity");
      }

      setAllAmenities((prev) => [...prev, data.amenity]);
      // Automatically add new amenity to selected amenities in category modal if open
      if (isCategoryDialogOpen) {
        setSelectedAmenityIds((prev) => [...prev, data.amenity.id]);
      }
      setAmenityName("");
      setAmenityDescription("");
      setIsAmenityDialogOpen(false);
      toast.success(`Amenity "${data.amenity.name}" created`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error creating amenity";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Room categories"
        description="Define room category specifications, base nightly rates, occupancy limits, and attached amenities."
        action={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAmenityName("");
                  setAmenityDescription("");
                  setIsAmenityDialogOpen(true);
                }}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" />
                <span>Add amenity</span>
              </Button>
              <Button onClick={openCreateCategory} className="gap-1.5">
                <Plus className="size-4" />
                <span>Add category</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium flex items-center justify-between"
        >
          <span>{error}</span>
          <Button variant="ghost" size="xs" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search categories by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearch("")}
            className="text-xs h-9 text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="size-3.5" />
            <span>Clear search</span>
          </Button>
        )}
      </div>

      {/* Categories Grid */}
      {filteredCategories.length === 0 ? (
        <EmptyState
          icon={<Tag className="size-6" />}
          title={categories.length === 0 ? "No categories configured" : "No matching categories"}
          description={
            categories.length === 0
              ? "Create room categories with base pricing and occupancy limits to begin setting up rooms."
              : "No categories match your search term. Try clearing your search query."
          }
          action={
            isAdmin && categories.length === 0 ? (
              <Button onClick={openCreateCategory} size="sm">
                <Plus className="size-4 mr-1.5" />
                Add first category
              </Button>
            ) : search ? (
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const hasRooms = cat._count.rooms > 0;

            return (
              <Card
                key={cat.id}
                className="flex flex-col justify-between shadow-xs hover:border-foreground/20 transition-colors group"
              >
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold">{cat.name}</CardTitle>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {cat._count.rooms} {cat._count.rooms === 1 ? "room" : "rooms"}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs line-clamp-2">
                        {cat.description || "No description provided"}
                      </CardDescription>
                    </div>

                    {isAdmin && (
                      <RowActionsMenu
                        items={[
                          {
                            label: "Edit category",
                            icon: <Pencil className="size-3.5" />,
                            onClick: () => openEditCategory(cat),
                          },
                          {
                            label: "Delete category",
                            icon: <Trash2 className="size-3.5" />,
                            variant: "destructive",
                            disabled: hasRooms,
                            onClick: () => {
                              if (!hasRooms) setCategoryToDelete(cat);
                            },
                          },
                        ]}
                      />
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs border border-border/40">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                        <IndianRupee className="size-3" /> Base Rate
                      </span>
                      <div className="flex items-baseline gap-1">
                        <MoneyText value={cat.basePrice} className="text-base font-bold text-foreground" />
                        <span className="text-[10px] text-muted-foreground font-normal">/night</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                        <Users className="size-3" /> Max Capacity
                      </span>
                      <span className="font-semibold text-sm text-foreground">
                        {cat.maxOccupancy} {cat.maxOccupancy === 1 ? "Guest" : "Guests"}
                      </span>
                    </div>
                  </div>

                  {cat.amenities.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Amenities
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {cat.amenities.slice(0, 3).map(({ amenity }) => (
                          <Badge key={amenity.id} variant="secondary" className="text-[10px] py-0 px-2 font-normal">
                            {amenity.name}
                          </Badge>
                        ))}
                        {cat.amenities.length > 3 && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Badge variant="outline" className="text-[10px] py-0 px-2 font-normal cursor-help">
                                  +{cat.amenities.length - 3} more
                                </Badge>
                              }
                            />
                            <TooltipContent>
                              <div className="text-xs space-y-0.5">
                                {cat.amenities.slice(3).map(({ amenity }) => (
                                  <div key={amenity.id}>{amenity.name}</div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <button
                        type="button"
                        onClick={() => openEditCategory(cat)}
                        className="text-primary hover:underline text-xs font-medium cursor-pointer"
                      >
                        Edit category
                      </button>
                      {hasRooms && (
                        <span className="text-[11px] text-muted-foreground">
                          {cat._count.rooms} assigned
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
        title="Delete Room Category"
        description={`Are you sure you want to delete category "${categoryToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Category"
        variant="destructive"
        isPending={isDeleting}
        onConfirm={handleDeleteCategory}
      />

      {/* Create / Edit Category Modal */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Room Category" : "Add Room Category"}
            </DialogTitle>
            <DialogDescription>
              Configure category details, base nightly rate, and occupancy limit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4">
            <FormSection
              title="Basics"
              description="Name and detailed description for this category"
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="catName">Category Name *</Label>
                  <Input
                    id="catName"
                    required
                    placeholder="e.g. Deluxe Double Room"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    disabled={loading}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="catDesc">Description</Label>
                  <Textarea
                    id="catDesc"
                    rows={2}
                    placeholder="Features, bed configurations, view description..."
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    disabled={loading}
                    className="text-xs"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Pricing & Capacity"
              description="Base price per night and maximum guest occupancy"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="catPrice">Base Nightly Rate *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground select-none">
                      ₹
                    </span>
                    <Input
                      id="catPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="e.g. 1500"
                      value={categoryPrice}
                      onChange={(e) => setCategoryPrice(e.target.value)}
                      disabled={loading}
                      className="pl-7 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="catOccupancy">Max Occupancy *</Label>
                  <Input
                    id="catOccupancy"
                    type="number"
                    min="1"
                    required
                    placeholder="2"
                    value={categoryOccupancy}
                    onChange={(e) => setCategoryOccupancy(e.target.value)}
                    disabled={loading}
                    className="text-xs"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Amenities"
              description="Select all included amenities for this room category"
            >
              <div className="flex flex-wrap gap-2 pt-1">
                {allAmenities.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-1">No amenities created yet.</p>
                ) : (
                  allAmenities.map((amenity) => {
                    const isSelected = selectedAmenityIds.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-muted/40 hover:bg-muted text-foreground border-border/60"
                        )}
                      >
                        {isSelected && <Check className="size-3.5 shrink-0" />}
                        <span>{amenity.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </FormSection>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCategoryDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Amenity Modal */}
      <Dialog open={isAmenityDialogOpen} onOpenChange={setIsAmenityDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Amenity</DialogTitle>
            <DialogDescription>
              Create a reusable amenity (e.g. Balcony, Mini Bar, Ocean View).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAmenity} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="amenityName">Amenity Name *</Label>
              <Input
                id="amenityName"
                required
                placeholder="e.g. Free High-Speed Wi-Fi"
                value={amenityName}
                onChange={(e) => setAmenityName(e.target.value)}
                disabled={loading}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amenityDesc">Description</Label>
              <Input
                id="amenityDesc"
                placeholder="Optional description"
                value={amenityDescription}
                onChange={(e) => setAmenityDescription(e.target.value)}
                disabled={loading}
                className="text-xs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAmenityDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Saving..." : "Add Amenity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
