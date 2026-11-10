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
  CheckCircle2,
  XCircle,
  Tag,
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

  // Sub-forms: create / edit
  const [isCreating, setIsCreating] = React.useState(false)
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
    setIsCreating(true)
  }

  const startEdit = (cat: ExpenseHeadDTO) => {
    setIsCreating(false)
    setEditingCategory(cat)
    setName(cat.name)
    setCode(cat.code)
    setDescription(cat.description || "")
    setIsActive(cat.isActive)
    setFormError(null)
  }

  const cancelSubForm = () => {
    setIsCreating(false)
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
      cancelSubForm()
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
      cancelSubForm()
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to update category")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (cat: ExpenseHeadDTO) => {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"? Referenced categories cannot be deleted.`)) {
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

  const handleToggleActive = async (cat: ExpenseHeadDTO) => {
    try {
      const res = await fetch(`/api/expense-heads/${cat.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          isActive: !cat.isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update category status")
      }

      toast.success(`Category "${cat.name}" marked as ${!cat.isActive ? "active" : "inactive"}`)
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle status")
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
        toast.success(`Successfully initialized ${data.seededCount} standard expense categories`)
      } else {
        toast.info("Standard expense categories are already seeded for this property")
      }
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to seed default categories")
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Tag className="size-4" />
              </div>
              <div>
                <DialogTitle>Expense Categories</DialogTitle>
                <DialogDescription className="text-xs">
                  Property-scoped expense categories for operational and administrative accounting.
                </DialogDescription>
              </div>
            </div>

            {!isCreating && !editingCategory && (
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
            )}
          </div>
        </DialogHeader>

        {/* Sub-form: Create or Edit */}
        {(isCreating || editingCategory) && (
          <form
            onSubmit={isCreating ? handleCreate : handleUpdate}
            className="mx-6 p-4 rounded-xl border border-border/80 bg-muted/40 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {isCreating ? "New Expense Category" : `Edit Category: ${editingCategory?.code}`}
              </span>
              <button
                type="button"
                onClick={cancelSubForm}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Linen & Laundry Supplies"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Category Code *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. LINEN_SUPPLIES"
                  className="h-8 text-xs font-mono uppercase"
                  disabled={Boolean(editingCategory)}
                  required
                />
                {editingCategory && (
                  <p className="text-[10px] text-muted-foreground">Category code is strictly immutable after creation.</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description (Optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details on what disbursements belong in this category"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-3.5"
                />
                Active (available for recording new expenses)
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelSubForm}
                  className="h-7 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="h-7 text-xs cursor-pointer"
                >
                  {submitting && <Loader2 className="size-3 animate-spin mr-1.5" />}
                  {isCreating ? "Save Category" : "Update Category"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Categories Table */}
        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">Loading categories...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-xs text-destructive space-y-1">
              <AlertCircle className="size-5 mx-auto" />
              <p>{error}</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl bg-card/50 space-y-3">
              <Tag className="size-8 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">No Expense Categories Found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click &quot;Seed Defaults&quot; to initialize standard hotel operating expense heads or create custom ones.
                </p>
              </div>
              <Button size="sm" onClick={handleSeedDefaults} disabled={seeding} className="text-xs">
                {seeding ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Sparkles className="size-3.5 mr-1.5" />}
                Seed Standard Categories
              </Button>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold">Code</TableHead>
                    <TableHead className="text-xs font-semibold">Name</TableHead>
                    <TableHead className="text-xs font-semibold hidden sm:table-cell">Description</TableHead>
                    <TableHead className="text-xs font-semibold text-center w-24">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right w-24">Actions</TableHead>
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
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell max-w-xs truncate">
                        {cat.description || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(cat)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                          title="Click to toggle status"
                        >
                          {cat.isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="size-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                              <XCircle className="size-3" />
                              Inactive
                            </span>
                          )}
                        </button>
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

        <DialogFooter className="p-4 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs cursor-pointer">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
