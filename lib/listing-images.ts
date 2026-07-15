export type ListingImage = { id: string; url: string; sortOrder?: number }

/** Subcategory gallery when present; otherwise catalog room images. */
export function resolveListingImages<T extends ListingImage>(
  catalogImages: T[],
  subcategoryImages?: T[] | null,
): T[] {
  if (subcategoryImages && subcategoryImages.length > 0) {
    return subcategoryImages
  }
  return catalogImages
}

export function listingCoverImageUrl(
  catalogImages: ListingImage[],
  subcategoryImages?: ListingImage[] | null,
): string | null {
  return resolveListingImages(catalogImages, subcategoryImages)[0]?.url ?? null
}

export function resolveListingImagesForRoom(room: {
  images: ListingImage[]
  subcategory?: { images?: ListingImage[] } | null
}): ListingImage[] {
  return resolveListingImages(room.images, room.subcategory?.images)
}
