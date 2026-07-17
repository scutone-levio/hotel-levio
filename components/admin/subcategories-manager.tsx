"use client"

import * as React from "react"
import { toast } from "sonner"
import { Archive, Plus, Edit2, Check, X, RotateCcw } from "lucide-react"

import type { RoomSubcategoryWithCount } from "@/lib/queries"
import type { RoomTypeRecord } from "@/lib/room-types"
import { roomTypeLabel } from "@/lib/room-type-labels"
import { SubcategoryManageDialog } from "@/components/admin/subcategory-manage-dialog"
import {
  centsToDollarsString,
  formatPrice,
  parseDollarsToCents,
} from "@/lib/rooms"
import {
  createRoomSubcategory,
  updateRoomSubcategory,
  archiveRoomSubcategory,
  restoreRoomSubcategory,
  setSubcategoryFeatured,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
function FeaturedToggle({
  subcategoryId,
  initialFeatured,
  disabled,
  onFeaturedChange,
}: {
  subcategoryId: string
  initialFeatured: boolean
  disabled?: boolean
  onFeaturedChange?: (featured: boolean) => void
}) {
  const [featured, setFeatured] = React.useState(initialFeatured)
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => {
    setFeatured(initialFeatured)
  }, [subcategoryId, initialFeatured])

  function toggle(checked: boolean) {
    setFeatured(checked)
    startTransition(async () => {
      const result = await setSubcategoryFeatured(subcategoryId, checked)
      if (result.ok) {
        onFeaturedChange?.(checked)
        toast.success(
          checked ? "Subcategory marked as featured" : "Featured removed",
        )
      } else {
        setFeatured(!checked)
        toast.error(result.error)
      }
    })
  }

  return (
    <Switch
      id={`featured-${subcategoryId}`}
      checked={featured}
      disabled={disabled || pending}
      onCheckedChange={toggle}
      aria-label={
        featured ? "Remove featured status" : "Mark subcategory as featured"
      }
      data-testid={`featured-toggle-${subcategoryId}`}
    />
  )
}

interface SubcategoriesManagerProps {
  roomTypes: RoomTypeRecord[]
  initialSubcategories: RoomSubcategoryWithCount[]
}

export function SubcategoriesManager({
  roomTypes,
  initialSubcategories,
}: SubcategoriesManagerProps) {
  const [subcategories, setSubcategories] = React.useState<
    RoomSubcategoryWithCount[]
  >(initialSubcategories)
  const [archiveFilter, setArchiveFilter] = React.useState<"active" | "archived">(
    "active",
  )

  React.useEffect(() => {
    setSubcategories(initialSubcategories)
  }, [initialSubcategories])

  const activeTypes = roomTypes.filter((t) => t.isActive)
  const [selectedTypeId, setSelectedTypeId] = React.useState(
    () => activeTypes[0]?.id ?? "",
  )
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editPrice, setEditPrice] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newPrice, setNewPrice] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  React.useEffect(() => {
    if (!activeTypes.some((t) => t.id === selectedTypeId)) {
      setSelectedTypeId(activeTypes[0]?.id ?? "")
    }
  }, [activeTypes, selectedTypeId])

  const filteredSubs = React.useMemo(
    () =>
      subcategories.filter((s) => {
        if (s.roomTypeId !== selectedTypeId) return false
        return archiveFilter === "archived" ? !s.isActive : s.isActive
      }),
    [subcategories, selectedTypeId, archiveFilter],
  )

  function handleFeaturedChange(subcategoryId: string, featured: boolean) {
    setSubcategories((prev) =>
      prev.map((s) => (s.id === subcategoryId ? { ...s, featured } : s)),
    )
  }

  const handleCreate = async () => {
    if (!newName || !newPrice || !selectedTypeId) {
      toast.error("Fill in all fields")
      return
    }

    const basePriceCents = parseDollarsToCents(newPrice)
    if (basePriceCents === null) {
      toast.error("Enter a valid price")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createRoomSubcategory(
        selectedTypeId,
        newName,
        basePriceCents,
      )
      if (result.ok) {
        toast.success(`Created "${newName}"`)
        setNewName("")
        setNewPrice("")
        setIsCreating(false)
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Failed to create subcategory")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (id: string) => {
    if (!editName || !editPrice) {
      toast.error("Fill in all fields")
      return
    }

    const basePriceCents = parseDollarsToCents(editPrice)
    if (basePriceCents === null) {
      toast.error("Enter a valid price")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await updateRoomSubcategory(id, editName, basePriceCents)
      if (result.ok) {
        toast.success("Updated successfully")
        setEditingId(null)
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Failed to update subcategory")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"?`)) return

    setIsSubmitting(true)
    try {
      const result = await archiveRoomSubcategory(id)
      if (result.ok) {
        toast.success("Subcategory archived")
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Failed to archive subcategory")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestore = async (id: string) => {
    setIsSubmitting(true)
    try {
      const result = await restoreRoomSubcategory(id)
      if (result.ok) {
        toast.success("Subcategory restored")
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Failed to restore subcategory")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedType = activeTypes.find((t) => t.id === selectedTypeId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-[200px]">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">
            Room Type
          </Label>
          <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
            <SelectTrigger className="h-9 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {roomTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-full border bg-white p-0.5">
            <Button
              type="button"
              variant={archiveFilter === "active" ? "default" : "ghost"}
              size="xs"
              className="rounded-full"
              onClick={() => setArchiveFilter("active")}
            >
              Active
            </Button>
            <Button
              type="button"
              variant={archiveFilter === "archived" ? "default" : "ghost"}
              size="xs"
              className="rounded-full"
              onClick={() => setArchiveFilter("archived")}
            >
              Archived
            </Button>
          </div>
          {archiveFilter === "active" && !isCreating ? (
            <Button
              onClick={() => setIsCreating(true)}
              variant="blue"
              size="sm"
              className="w-full sm:w-auto"
              disabled={!selectedTypeId}
            >
              <Plus className="size-4 mr-1" /> New Subcategory
            </Button>
          ) : null}
        </div>
      </div>

      {isCreating && archiveFilter === "active" && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4">New Subcategory — {selectedType?.name}</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Garden View"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Base price / night ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="119"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={isSubmitting}
                size="sm"
                variant="blue"
                className="flex-1"
              >
                Create
              </Button>
              <Button
                onClick={() => {
                  setIsCreating(false)
                  setNewName("")
                  setNewPrice("")
                }}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Featured</TableHead>
              <TableHead className="text-right">Base Price</TableHead>
              <TableHead className="text-center">Rooms Using</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No {archiveFilter} subcategories for this room type
                </TableCell>
              </TableRow>
            ) : (
              filteredSubs.map((sub) => (
                <TableRow key={sub.id} className="bg-white">
                  {editingId === sub.id ? (
                    <>
                      <TableCell>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="h-8 text-sm text-right"
                        />
                      </TableCell>
                      <TableCell className="text-center">{sub._count.rooms}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(sub.id)}
                            disabled={isSubmitting}
                            aria-label={`Save changes to ${sub.name}`}
                            className="p-1.5 hover:bg-muted rounded cursor-pointer"
                          >
                            <Check className="size-4 text-green-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            disabled={isSubmitting}
                            aria-label="Cancel editing subcategory"
                            className="p-1.5 hover:bg-muted rounded cursor-pointer"
                          >
                            <X className="size-4 text-muted-foreground" />
                          </button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{sub.name}</TableCell>
                      <TableCell className="text-center">
                        {sub.isActive ? (
                          <FeaturedToggle
                            subcategoryId={sub.id}
                            initialFeatured={sub.featured}
                            disabled={isSubmitting}
                            onFeaturedChange={(featured) =>
                              handleFeaturedChange(sub.id, featured)
                            }
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPrice(sub.basePrice, "CAD")}
                      </TableCell>
                      <TableCell className="text-center">{sub._count.rooms}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {sub.isActive ? (
                            <>
                              <SubcategoryManageDialog subcategory={sub} />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(sub.id)
                                  setEditName(sub.name)
                                  setEditPrice(centsToDollarsString(sub.basePrice))
                                }}
                                disabled={isSubmitting}
                                aria-label={`Edit ${sub.name}`}
                                className="p-1.5 hover:bg-muted rounded cursor-pointer"
                              >
                                <Edit2 className="size-4 text-muted-foreground" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleArchive(sub.id, sub.name)}
                                disabled={isSubmitting}
                                className="p-1.5 hover:bg-muted rounded cursor-pointer"
                                title="Archive subcategory"
                              >
                                <Archive className="size-4 text-muted-foreground" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRestore(sub.id)}
                              disabled={isSubmitting}
                              className="p-1.5 hover:bg-muted rounded cursor-pointer"
                              title="Restore subcategory"
                            >
                              <RotateCcw className="size-4 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
