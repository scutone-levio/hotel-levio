import type { PublicSubcategoryName } from "@/lib/subcategories"
import {
  CITY_VIEW_NAME,
  LAKE_VIEW_NAME,
  LOWER_LEVEL_NAME,
} from "@/lib/subcategories"

export type SubcategoryGalleryImage = { url: string; caption: string }

const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`

const KING_LOUNGE_URL =
  "https://wyndhamfallsviewhotel.com/images/rooms/king-presidential-suite-4.jpg"

const KING_LAKE_VIEW_BED_URL =
  "https://image-tc.galaxy.tf/wijpeg-a30526ouxd6jib09o41op7eyt/luxury-room-king-bed.jpg"

/** Three hotel room images per King subcategory: beds, washroom, lounge. */
export const kingSubcategoryImagesByName: Record<
  PublicSubcategoryName,
  SubcategoryGalleryImage[]
> = {
  [LAKE_VIEW_NAME]: [
    {
      url: KING_LAKE_VIEW_BED_URL,
      caption: "King bed",
    },
    {
      url: u("1620626011761-996317b8d101"),
      caption: "En-suite bathroom with walk-in shower",
    },
    {
      url: KING_LOUNGE_URL,
      caption: "Sitting area with sofa and writing desk",
    },
  ],
  [CITY_VIEW_NAME]: [
    {
      url: u("1777016844282-46fa8713cdae"),
      caption: "King bed",
    },
    {
      url: u("1552321554-5fefe8c9ef14"),
      caption: "Marble en-suite bathroom",
    },
    {
      url: KING_LOUNGE_URL,
      caption: "Sitting area with sofa and writing desk",
    },
  ],
  [LOWER_LEVEL_NAME]: [
    {
      url: u("1611892440504-42a792e24d32"),
      caption: "King bed",
    },
    {
      url: u("1584622650111-993a426fbf0a"),
      caption: "Private en-suite bathroom",
    },
    {
      url: KING_LOUNGE_URL,
      caption: "Sitting area with sofa and writing desk",
    },
  ],
}
