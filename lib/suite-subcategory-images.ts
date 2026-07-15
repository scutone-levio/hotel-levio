import type { PublicSubcategoryName } from "@/lib/subcategories"
import {
  CITY_VIEW_NAME,
  LAKE_VIEW_NAME,
  LOWER_LEVEL_NAME,
} from "@/lib/subcategories"

export type SubcategoryGalleryImage = { url: string; caption: string }

const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`

const SUITE_LAKE_VIEW_BED_URL =
  "https://cache.marriott.com/is/image/marriotts7prod/ak-yhmak-suite-lake-view-37673:Classic-Hor?wid=1920&fit=constrain"

const SUITE_CITY_VIEW_BED_URL =
  "https://89223c933572e0e97754-f4517e43d990491f3d217ca39cc16c54.ssl.cf1.rackcdn.com/u/hotel-grand-pacific/signature-city-view-suite/hotelgrandpacific_signature-city-view-suite_01-1.jpg"

const SUITE_CITY_VIEW_LOUNGE_URL =
  "https://cdn.odehotels.com/wp-content/uploads/sites/213/2024/08/23210520/IMG1628_Inchcolm_EVT_300724_S08_0165_HDR-scaled-1.jpeg"

const SUITE_LAKE_VIEW_LOUNGE_URL =
  "https://cache.marriott.com/is/image/marriotts7prod/ak-yhmak-suite-39252:Classic-Hor?wid=1920&fit=constrain"

const SUITE_LAKE_VIEW_BATHROOM_URL =
  "https://cms.inspirato.com/ImageGen.ashx?image=%2Fmedia%2F9447639%2Fstudio-suite-bathroom.jpg&width=1081.5"

const SUITE_CITY_VIEW_BATHROOM_URL =
  "https://media-cdn.tripadvisor.com/media/photo-s/19/a8/b3/01/deluxe-suite-bathroom.jpg"

/** Three hotel room images per Suite subcategory: beds, washroom, lounge. */
export const suiteSubcategoryImagesByName: Record<
  PublicSubcategoryName,
  SubcategoryGalleryImage[]
> = {
  [LAKE_VIEW_NAME]: [
    {
      url: SUITE_LAKE_VIEW_BED_URL,
      caption: "King bed",
    },
    {
      url: SUITE_LAKE_VIEW_BATHROOM_URL,
      caption: "Master bathroom with soaking tub",
    },
    {
      url: SUITE_LAKE_VIEW_LOUNGE_URL,
      caption: "Sitting area with sofa and writing desk",
    },
  ],
  [CITY_VIEW_NAME]: [
    {
      url: SUITE_CITY_VIEW_BED_URL,
      caption: "King bed",
    },
    {
      url: SUITE_CITY_VIEW_BATHROOM_URL,
      caption: "Marble en-suite bathroom",
    },
    {
      url: SUITE_CITY_VIEW_LOUNGE_URL,
      caption: "Sitting area with sofa and writing desk",
    },
  ],
  [LOWER_LEVEL_NAME]: [
    {
      url: u("1631049307264-da0ec9d70304"),
      caption: "King bed",
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
