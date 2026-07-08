"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { AmenityWithCount } from "@/lib/queries"
import {
  createAmenity,
  updateAmenity,
  deleteAmenity,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  category: z.string().trim().optional(),
})
type FormValues = z.infer<typeof schema>

function AmenityDialog({
  amenity,
  trigger,
}: {
  amenity?: AmenityWithCount
  trigger: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: amenity?.name ?? "",
      category: amenity?.category ?? "",
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: amenity?.name ?? "",
        category: amenity?.category ?? "",
      })
    }
  }, [open, amenity, form])

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = amenity
        ? await updateAmenity(amenity.id, values)
        : await createAmenity(values)
      if (result.ok) {
        toast.success(amenity ? "Amenity updated" : "Amenity created")
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{amenity ? "Edit amenity" : "New amenity"}</DialogTitle>
          <DialogDescription>
            {amenity
              ? "Update this amenity. Changes apply to every room using it."
              : "Add an amenity to the catalog. You can assign it to rooms afterwards."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Free high-speed Wi-Fi"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Suite" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function AmenitiesManager({
  amenities,
}: {
  amenities: AmenityWithCount[]
}) {
  const [pending, startTransition] = React.useTransition()

  function handleDelete(a: AmenityWithCount) {
    if (
      !confirm(
        `Delete "${a.name}"? It will be removed from ${a._count.rooms} room(s).`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await deleteAmenity(a.id)
      if (result.ok) toast.success("Amenity deleted")
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {amenities.length} amenities in the catalog
        </p>
        <AmenityDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> New amenity
            </Button>
          }
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amenity</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {amenities.length ? (
              amenities.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>
                    {a.category ? (
                      <Badge variant="secondary">{a.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{a._count.rooms}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <AmenityDialog
                        amenity={a}
                        trigger={
                          <Button variant="ghost" size="icon" title="Edit">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        disabled={pending}
                        onClick={() => handleDelete(a)}
                      >
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No amenities yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
