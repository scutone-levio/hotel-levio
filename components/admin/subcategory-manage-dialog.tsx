"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { RoomType } from "@prisma/client"
import { ImageIcon, Settings2, X } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

import type { RoomSubcategoryWithCount } from "@/lib/queries"
import { ROOM_TYPE_SHORT_LABELS } from "@/lib/rooms"
import {
  addSubcategoryImage,
  deleteSubcategoryImage,
} from "@/app/admin/actions"
import { UploadDropzone } from "@/lib/uploadthing"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { pluralize } from "@/lib/utils"

function uploadHintMessage(
  atLimit: boolean,
  remaining: number,
  imageCount: number,
) {
  if (atLimit) {
    return "Maximum of 5 images reached. Delete one to upload a replacement."
  }

  const imageWord = pluralize(remaining, "image")
  return `Upload up to ${remaining} more ${imageWord} (${imageCount}/5). The first image is the cover on listing cards. When empty, catalog room images are shown instead.`
}

type SubcategoryManageDialogProps = {
  subcategory: RoomSubcategoryWithCount
  roomType: RoomType
}

export function SubcategoryManageDialog({
  subcategory,
  roomType,
}: SubcategoryManageDialogProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const images = subcategory.images

  function refreshAfterMutation(onSuccess: () => Promise<void>) {
    startTransition(async () => {
      await onSuccess()
      router.refresh()
    })
  }

  function remove(imageId: string) {
    refreshAfterMutation(async () => {
      const result = await deleteSubcategoryImage(imageId)
      if (result.ok) toast.success("Image removed")
      else toast.error(result.error)
    })
  }

  const atLimit = images.length >= 5
  const remaining = Math.max(0, 5 - images.length)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="size-4" /> Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {ROOM_TYPE_SHORT_LABELS[roomType]} · {subcategory.name} — Images
          </DialogTitle>
          <DialogDescription>
            Listing photos for this subcategory. Guests see these instead of the
            shared catalog gallery when at least one image is uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {images.length ? (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group bg-muted relative aspect-square overflow-hidden rounded-md"
                >
                  <Image
                    src={img.url}
                    alt={`${subcategory.name} room`}
                    fill
                    sizes="150px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => remove(img.id)}
                    disabled={pending}
                    aria-label="Delete image"
                    className="bg-background/80 absolute top-1 right-1 rounded-full p-1 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                    title="Delete image"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-md border border-dashed p-6 text-sm">
              <ImageIcon className="size-6" />
              No subcategory images yet. Catalog room photos will be used until
              you upload here.
            </div>
          )}

          <p className="text-muted-foreground text-xs">
            {uploadHintMessage(atLimit, remaining, images.length)}
          </p>

          {!atLimit ? (
            <UploadDropzone
              endpoint="roomImage"
              onClientUploadComplete={(res) => {
                refreshAfterMutation(async () => {
                  let failures = 0
                  let uploaded = 0
                  for (const f of res) {
                    const url =
                      (f as { ufsUrl?: string; url: string }).ufsUrl ?? f.url
                    const result = await addSubcategoryImage(
                      subcategory.id,
                      url,
                      f.key,
                    )
                    if (!result.ok) {
                      failures += 1
                      toast.error(result.error)
                      continue
                    }
                    uploaded += 1
                  }
                  if (failures === 0 && uploaded > 0) {
                    toast.success(
                      uploaded === 1
                        ? "1 image uploaded"
                        : `${uploaded} images uploaded`,
                    )
                  }
                })
              }}
              onUploadError={(e) => {
                toast.error(e.message)
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
