"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Loader2,
  Plus,
  AlertCircle,
  Sparkles,
  Edit2,
  Trash2,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
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
import type { ExpenseHeadDTO } from "@/modules/expenses/expenses.types"

export function ExpenseCategoriesDialog({
  isOpen,
  onClose,
  propertyId,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  onSuccess: () => void
}) {
  const [categories, setCategories] = React.useState<ExpenseHeadDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // View mode: 'list' | 'add' | 'edit'
  const [view, setView] = React.useState<"list" | "add" | "edit">("list")
  const [editingCategory, setEditingCategory] = React.useState<ExpenseHeadDTO | null>(null)

  // Form states
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [seeding, setSeeding] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (!isOpen || !propertyId) return
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/expense-heads?propertyId=${propertyId}&includeInactive=true`)
        const data = await res.json()
        if (mounted) {
          if (res.ok) {
            setCategories(data.expenseHeads || [])
            setError(null)
          } else {
            setError(data.error || "Failed to load expense categories")
          }
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load expense categories")
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [isOpen, propertyId, reloadKey])

  const startCreate = () => {
    setEditingCategory(null)
    setName("")
    setCode("")
    setDescription("")
    setIsActive(true)
    setFormError(null)
    setView("add")
  }

  const startEdit = (cat: ExpenseHeadDTO) => {
    setEditingCategory(cat)
    setName(cat.name)
    setCode(cat.code)
    setDescription(cat.description || "")
    setIsActive(cat.isActive)
    setFormError(null)
    setView("edit")
  }

  const backToList = () => {
    setView("list")
    setEditingCategory(null)
    setFormError(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError("Category name is required.")
      return
    }

    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode || !/^[A-Z0-9_]+$/.test(cleanCode)) {
      setFormError("Category code must contain only uppercase letters, numbers, and underscores.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/expense-heads?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          name: name.trim(),
          code: cleanCode,
          description: description.trim() || undefined,
          isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create category")
      }

      toast.success(`Category "${name}" created successfully`)
      backToList()
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create category")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return
    setFormError(null)

    if (!name.trim()) {
      setFormError("Category name cannot be empty.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/expense-heads/${editingCategory.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          name: name.trim(),
          description: description.trim() || null,
          isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update category")
      }

      toast.success("Category updated successfully")
      backToList()
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to update category")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (cat: ExpenseHeadDTO) => {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/expense-heads/${cat.id}?propertyId=${propertyId}`, {
        method: "DELETE",
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete category")
      }

      toast.success("Category deleted successfully")
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category")
    }
  }

  const handleSeedDefaults = async () => {
    setSeeding(true)
    try {
      const res = await fetch(`/api/expense-heads/seed?propertyId=${propertyId}`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to seed default categories")
      }

      if (data.seededCount > 0) {
        toast.success(`Initialized ${data.seededCount} standard expense categories`)
      } else {
        toast.info("Standard categories are already seeded")
      }
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to seed categories")
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {view === "list" ? (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle>Expense Categories</DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-between gap-2 pt-1 pb-1">
              <span className="text-xs text-muted-foreground">
                {categories.length} {categories.length === 1 ? "category" : "categories"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSeedDefaults}
                  disabled={seeding || loading}
                  className="h-8 text-xs cursor-pointer"
                >
                  {seeding ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="size-3.5 mr-1.5 text-primary" />
                  )}
                  Seed Defaults
                </Button>
                <Button
                  size="sm"
                  onClick={startCreate}
                  disabled={loading}
                  className="h-8 text-xs cursor-pointer"
                >
                  <Plus className="size-3.5 mr-1.5" />
                  Add Category
                </Button>
              </div>
            </div>

            <div className="py-2 min-h-[260px] max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="text-xs">Loading categories...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8 text-xs text-destructive space-y-1">
                  <AlertCircle className="size-5 mx-auto" />
                  <p>{error}</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg space-y-3">
                  <p className="text-xs text-muted-foreground">
                    No expense categories configured for this hotel.
                  </p>
                  <Button size="sm" onClick={handleSeedDefaults} disabled={seeding} className="text-xs">
                    {seeding && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                    Seed Standard Categories
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs font-semibold">Code</TableHead>
                        <TableHead className="text-xs font-semibold">Name</TableHead>
                        <TableHead className="text-xs font-semibold text-center w-20">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-right w-16">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((cat) => (
                        <TableRow key={cat.id} className="text-xs hover:bg-muted/40 transition-colors">
                          <TableCell className="font-mono text-[11px] font-semibold text-primary">
                            {cat.code}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {cat.name}
                            {cat.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1">{cat.description}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                cat.isActive
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {cat.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(cat)}
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                title="Edit Category"
                              >
                                <Edit2 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(cat)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title="Delete Category"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs cursor-pointer">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Form View: Add or Edit */
          <form onSubmit={view === "add" ? handleCreate : handleUpdate} className="space-y-4">
            <DialogHeader className="pr-8">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={backToList}
                  className="h-7 px-1.5 text-xs text-muted-foreground cursor-pointer"
                >
                  <ArrowLeft className="size-3.5 mr-1" />
                  Categories
                </Button>
                <DialogTitle>
                  {view === "add" ? "New Category" : `Edit Category: ${editingCategory?.code}`}
                </DialogTitle>
              </div>
            </DialogHeader>

            {formError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Category Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Laundry Supplies"
                  className="h-9 text-xs"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Category Code *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. LAUNDRY"
                  className="h-9 text-xs font-mono uppercase"
                  disabled={view === "edit"}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Description (Optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description"
                  className="h-9 text-xs"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary size-3.5"
                  />
                  Active (available for new expenses)
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={backToList}
                disabled={submitting}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="text-xs cursor-pointer"
              >
                {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                {view === "add" ? "Save Category" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
