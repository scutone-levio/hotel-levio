"use client"

import * as React from "react"
import type { RoomType } from "@prisma/client"
import { toast } from "sonner"
import { Trash2, Plus, Edit2, Check, X } from "lucide-react"

import type { RoomSubcategoryWithCount } from "@/lib/queries"
import { ROOM_TYPES, ROOM_TYPE_LABELS, centsToDollarsString, formatPrice, parseDollarsToCents } from "@/lib/rooms"
import {
  createRoomSubcategory,
  updateRoomSubcategory,
  deleteRoomSubcategory,
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
      data-testid={`featured-toggle-${subcategoryId}`}
    />
  )
}

interface SubcategoriesManagerProps {
  initialSubcategories: RoomSubcategoryWithCount[]
}

export function SubcategoriesManager({
  initialSubcategories,
}: SubcategoriesManagerProps) {
  const [subcategories, setSubcategories] = React.useState<
    RoomSubcategoryWithCount[]
  >(initialSubcategories)
  const [selectedType, setSelectedType] = React.useState<RoomType>("TWIN")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editPrice, setEditPrice] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newPrice, setNewPrice] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const filteredSubs = React.useMemo(
    () =>
      subcategories.filter((s) => s.roomType === selectedType),
    [subcategories, selectedType],
  )

  function handleFeaturedChange(subcategoryId: string, featured: boolean) {
    setSubcategories((prev) =>
      prev.map((s) => (s.id === subcategoryId ? { ...s, featured } : s)),
    )
  }

  const handleCreate = async () => {
    if (!newName || !newPrice) {
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
        selectedType,
        newName,
        basePriceCents,
      )
      if (result.ok) {
        toast.success(`Created "${newName}"`)
        setNewName("")
        setNewPrice("")
        setIsCreating(false)
        // Refetch subcategories
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    } catch (err) {
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
    } catch (err) {
      toast.error("Failed to update subcategory")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string, count: number) => {
    if (count > 0) {
      toast.error(`Cannot delete: ${count} room(s) assigned`)
      return
    }

    if (!confirm(`Delete "${name}"?`)) return

    setIsSubmitting(true)
    try {
      const result = await deleteRoomSubcategory(id)
      if (result.ok) {
        toast.success("Deleted successfully")
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error("Failed to delete subcategory")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-[200px]">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">
            Room Type
          </Label>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as RoomType)}>
            <SelectTrigger className="h-9 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROOM_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {ROOM_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isCreating ? (
          <Button
            onClick={() => setIsCreating(true)}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            <Plus className="size-4 mr-1" /> New Subcategory
          </Button>
        ) : null}
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4">New Subcategory</h3>
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

      {/* Subcategories table */}
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
                  No subcategories for this room type
                </TableCell>
              </TableRow>
            ) : (
              filteredSubs.map((sub) => (
                <TableRow key={sub.id}>
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
                            onClick={() => handleEdit(sub.id)}
                            disabled={isSubmitting}
                            className="p-1.5 hover:bg-muted rounded"
                          >
                            <Check className="size-4 text-green-600" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={isSubmitting}
                            className="p-1.5 hover:bg-muted rounded"
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
                        <FeaturedToggle
                          subcategoryId={sub.id}
                          initialFeatured={sub.featured}
                          disabled={isSubmitting}
                          onFeaturedChange={(featured) =>
                            handleFeaturedChange(sub.id, featured)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPrice(sub.basePrice, "CAD")}
                      </TableCell>
                      <TableCell className="text-center">{sub._count.rooms}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingId(sub.id)
                              setEditName(sub.name)
                              setEditPrice(centsToDollarsString(sub.basePrice))
                            }}
                            disabled={isSubmitting}
                            className="p-1.5 hover:bg-muted rounded"
                          >
                            <Edit2 className="size-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(sub.id, sub.name, sub._count.rooms)
                            }
                            disabled={isSubmitting || sub._count.rooms > 0}
                            className="p-1.5 hover:bg-muted rounded disabled:opacity-50"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </button>
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
