"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, Plus, AlertCircle, Sparkles, Edit2, Trash2, CheckCircle2, XCircle } from "lucide-react"
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
import type { IncomeHeadDTO } from "@/modules/income/income.types"

export function IncomeCategoriesDialog({
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
  const [categories, setCategories] = React.useState<IncomeHeadDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Sub-forms: create / edit
  const [isCreating, setIsCreating] = React.useState(false)
  const [editingCategory, setEditingCategory] = React.useState<IncomeHeadDTO | null>(null)

  // Form states
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (!isOpen) return
    let mounted = true

    async function load() {
      try {
        const res = await fetch(`/api/income-heads?propertyId=${propertyId}`)
        const data = await res.json()
        if (mounted) {
          if (res.ok) {
            setCategories(data.incomeHeads || [])
            setError(null)
          } else {
            setError(data.error || "Failed to load categories")
          }
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load categories")
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

  const startEdit = (cat: IncomeHeadDTO) => {
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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    const trimmedCode = code.trim().toUpperCase()

    if (trimmedName.length < 2) {
      setFormError("Category name must be at least 2 characters.")
      return
    }
    if (trimmedCode.length < 2 || !/^[A-Z0-9_]+$/.test(trimmedCode)) {
      setFormError("Code must be at least 2 alphanumeric characters/underscores (e.g. COMM_TOURS).")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/income-heads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          name: trimmedName,
          code: trimmedCode,
          description: description.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create category")
      }

      toast.success(`Category '${trimmedName}' created successfully`)
      cancelSubForm()
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Creation failed")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return
    setFormError(null)

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setFormError("Category name must be at least 2 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/income-heads/${editingCategory.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update category")
      }

      toast.success(`Category '${trimmedName}' updated successfully`)
      cancelSubForm()
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Update failed")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (cat: IncomeHeadDTO) => {
    if (cat.incomeCount && cat.incomeCount > 0) {
      toast.error(
        `Cannot delete '${cat.name}' because it is referenced by ${cat.incomeCount} income record(s). Deactivate it instead.`
      )
      return
    }

    if (!confirm(`Are you sure you want to permanently delete category '${cat.name}'?`)) {
      return
    }

    try {
      const res = await fetch(`/api/income-heads/${cat.id}?propertyId=${propertyId}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete category")
      }

      toast.success(`Category '${cat.name}' deleted successfully`)
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  const handleSeedDefaults = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/income-heads/seed?propertyId=${propertyId}`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to seed default categories")
      }

      toast.success(`Standard categories seeded successfully (${data.seededCount} added)`)
      setReloadKey((k) => k + 1)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to seed categories")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">Income Categories</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Manage property-specific income heads and accounting classification codes.
              </DialogDescription>
            </div>
            {!isCreating && !editingCategory && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSeedDefaults}
                  className="gap-1.5 text-xs h-8 cursor-pointer"
                  disabled={loading}
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  Seed Defaults
                </Button>
                <Button
                  size="sm"
                  onClick={startCreate}
                  className="gap-1.5 text-xs h-8 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Add Category
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Sub-form: Create Category */}
        {isCreating && (
          <form onSubmit={handleCreateSubmit} className="p-4 border rounded-xl bg-muted/30 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Create Income Category
              </h4>
              <button
                type="button"
                onClick={cancelSubForm}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="catName" className="text-xs">Category Name *</Label>
                <Input
                  id="catName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Travel Desk Commission"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="catCode" className="text-xs">Category Code * (Immutable)</Label>
                <Input
                  id="catCode"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. COMMISSION"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="catDesc" className="text-xs">Description (Optional)</Label>
              <Input
                id="catDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of direct income collected under this category"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelSubForm} className="h-8 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="h-8 text-xs">
                {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Save Category
              </Button>
            </div>
          </form>
        )}

        {/* Sub-form: Edit Category */}
        {editingCategory && (
          <form onSubmit={handleEditSubmit} className="p-4 border rounded-xl bg-muted/30 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Edit Category: <span className="font-mono text-primary">{editingCategory.code}</span>
              </h4>
              <button
                type="button"
                onClick={cancelSubForm}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="editCatName" className="text-xs">Category Name *</Label>
                <Input
                  id="editCatName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Category Code (Read-Only)</Label>
                <div className="h-8 px-3 rounded-md bg-muted border border-border/60 flex items-center text-xs font-mono text-muted-foreground select-none">
                  {editingCategory.code}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="editCatDesc" className="text-xs">Description</Label>
              <Input
                id="editCatDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editCatActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 rounded-sm border-border cursor-pointer accent-primary"
              />
              <Label htmlFor="editCatActive" className="text-xs cursor-pointer font-normal">
                Category is active and available for new income records
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelSubForm} className="h-8 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="h-8 text-xs">
                {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Update Category
              </Button>
            </div>
          </form>
        )}

        {/* Categories Table */}
        <div className="flex-1 overflow-y-auto border rounded-xl bg-card">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-xs">Loading categories...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center p-12 space-y-3">
              <p className="text-xs text-muted-foreground">No income categories configured yet.</p>
              <Button size="sm" variant="outline" onClick={handleSeedDefaults} className="gap-1.5 text-xs">
                <Sparkles className="size-3.5 text-amber-500" />
                Seed Standard Categories
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Category Name</TableHead>
                  <TableHead className="text-xs">Code</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Incomes</TableHead>
                  <TableHead className="text-xs text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="text-xs py-2.5">
                      <div className="font-semibold text-foreground">{cat.name}</div>
                      {cat.description && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                          {cat.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs py-2.5 font-mono text-muted-foreground">
                      {cat.code}
                    </TableCell>
                    <TableCell className="text-xs py-2.5">
                      {cat.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="size-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <XCircle className="size-3" /> Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs py-2.5 text-right font-medium">
                      {cat.incomeCount || 0}
                    </TableCell>
                    <TableCell className="text-xs py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(cat)}
                          title="Edit Category"
                          className="size-7 cursor-pointer hover:bg-muted"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cat)}
                          title={
                            cat.incomeCount && cat.incomeCount > 0
                              ? "Referenced categories cannot be deleted; deactivate instead."
                              : "Delete Category"
                          }
                          disabled={Boolean(cat.incomeCount && cat.incomeCount > 0)}
                          className="size-7 cursor-pointer hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
