import type { PublicSubcategoryName } from "@/lib/subcategories"
import {
  CITY_VIEW_NAME,
  LAKE_VIEW_NAME,
  LOWER_LEVEL_NAME,
} from "@/lib/subcategories"

export type SubcategoryGalleryImage = { url: string; caption: string }

const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`

/** Three well-lit hotel room images per Queen subcategory: beds, washroom, lounge. */
export const queenSubcategoryImagesByName: Record<
  PublicSubcategoryName,
  SubcategoryGalleryImage[]
> = {
  [LAKE_VIEW_NAME]: [
    {
      url: u("1566665797739-1674de7a421a"),
      caption: "Two queen beds",
    },
    {
      url: u("1620626011761-996317b8d101"),
      caption: "En-suite bathroom with walk-in shower",
    },
    {
      url: u("1776763018821-8feeaeeee0a5"),
      caption: "Sitting area with sofa and writing desk",
    },
  ],
  [CITY_VIEW_NAME]: [
    {
      url: u("1631049035182-249067d7618e"),
      caption: "Two queen beds",
    },
    {
      url: u("1552321554-5fefe8c9ef14"),
      caption: "Marble en-suite bathroom",
    },
    {
      url: u("1776763018821-8feeaeeee0a5"),
      caption: "Sitting area with sofa and writing desk",
    },
  ],
  [LOWER_LEVEL_NAME]: [
    {
      url: u("1631049421450-348ccd7f8949"),
      caption: "Two queen beds",
    },
    {
      url: u("1584622650111-993a426fbf0a"),
      caption: "Private en-suite bathroom",
    },
    {
      url: u("1776763018821-8feeaeeee0a5"),
      caption: "Sitting area with sofa and writing desk",
    },
  ],
}
