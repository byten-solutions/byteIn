"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tag, Users, DollarSign, Edit, Trash2, Check, Sparkles } from "lucide-react";
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
  userRole: "ADMIN" | "RECEPTIONIST";
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

  const isAdmin = userRole === "ADMIN";

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
        name: categoryName,
        description: categoryDescription || null,
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
      router.refresh();
      // Update local state
      if (editingCategory) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? data.category : c))
        );
      } else {
        setCategories((prev) => [...prev, data.category]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving category");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryItem) => {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/room-categories/${cat.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting category");
    } finally {
      setLoading(false);
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
          name: amenityName,
          description: amenityDescription || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create amenity");
      }

      setAllAmenities((prev) => [...prev, data.amenity]);
      setAmenityName("");
      setAmenityDescription("");
      setIsAmenityDialogOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating amenity");
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
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

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAmenityName("");
                setAmenityDescription("");
                setIsAmenityDialogOpen(true);
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Add Amenity
            </Button>
            <Button size="sm" onClick={openCreateCategory}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Category
            </Button>
          </div>
        )}
      </div>

      {/* Categories Grid */}
      {filteredCategories.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <CardContent className="space-y-2 pt-6">
            <Tag className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
            <h3 className="text-base font-semibold">No room categories found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search
                ? "No categories matched your search term."
                : "Create room categories with base pricing and occupancy limits to begin setting up rooms."}
            </p>
            {isAdmin && !search && (
              <Button size="sm" onClick={openCreateCategory} className="mt-4">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create First Category
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => (
            <Card key={cat.id} className="flex flex-col justify-between shadow-xs hover:border-foreground/20 transition-colors">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold">{cat.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {cat.description || "No description provided"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {cat._count.rooms} {cat._count.rooms === 1 ? "room" : "rooms"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Base Rate
                    </span>
                    <span className="font-semibold text-sm font-mono">
                      ${Number(cat.basePrice).toFixed(2)}
                      <span className="text-[10px] text-muted-foreground font-normal"> /night</span>
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                      <Users className="h-3 w-3" /> Max Capacity
                    </span>
                    <span className="font-semibold text-sm">
                      {cat.maxOccupancy} {cat.maxOccupancy === 1 ? "Guest" : "Guests"}
                    </span>
                  </div>
                </div>

                {cat.amenities.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Included Amenities:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {cat.amenities.map(({ amenity }) => (
                        <Badge key={amenity.id} variant="secondary" className="text-[10px] py-0 px-2 font-normal">
                          {amenity.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => openEditCategory(cat)}
                      disabled={loading}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteCategory(cat)}
                      disabled={loading || cat._count.rooms > 0}
                      title={
                        cat._count.rooms > 0
                          ? "Cannot delete category while rooms are assigned to it"
                          : "Delete category"
                      }
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Category Modal */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Room Category" : "Add Room Category"}
            </DialogTitle>
            <DialogDescription>
              Configure category details, snapshotted base price, and occupancy limit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="catName">Category Name *</Label>
              <Input
                id="catName"
                required
                placeholder="e.g. Deluxe Double Room"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="catPrice">Base Nightly Rate ($) *</Label>
                <Input
                  id="catPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="120.00"
                  value={categoryPrice}
                  onChange={(e) => setCategoryPrice(e.target.value)}
                  disabled={loading}
                />
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
                />
              </div>
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
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Amenities</Label>
                <span className="text-[11px] text-muted-foreground">Select all that apply</span>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-muted/20">
                {allAmenities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No amenities created yet.</p>
                ) : (
                  allAmenities.map((amenity) => {
                    const isSelected = selectedAmenityIds.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        className={`flex items-center justify-between w-full p-1.5 rounded text-xs text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span>{amenity.name}</span>
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

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
              Create a reusable amenity (e.g. Balcony, Mini Bar, Jacuzzi).
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
