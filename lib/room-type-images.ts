export type CatalogImage = { url: string; caption: string }

/** Five curated gallery images per catalog room type slug, themed to amenities. */
export const catalogImagesByType: Record<string, CatalogImage[]> = {
  twin: [
    {
      url: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
      caption: "Twin beds overview",
    },
    {
      url: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80",
      caption: "Writing desk with chair",
    },
    {
      url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
      caption: "Private en-suite bathroom",
    },
    {
      url: "https://images.unsplash.com/photo-1774979517495-e425464c5d5e?auto=format&fit=crop&w=1200&q=80",
      caption: "In-room coffee maker and mini-refrigerator",
    },
    {
      url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
      caption: "Flat-screen television and room ambiance",
    },
  ],
  queen: [
    {
      url: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80",
      caption: "Two queen beds",
    },
    {
      url: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80",
      caption: "Work desk with ergonomic chair",
    },
    {
      url: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&q=80",
      caption: "Spacious full bathroom",
    },
    {
      url: "https://images.unsplash.com/photo-1770757587087-766db2874c21?auto=format&fit=crop&w=1200&q=80",
      caption: "Premium coffee station and microwave",
    },
    {
      url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
      caption: "Spacious queen room layout",
    },
  ],
  king: [
    {
      url: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80",
      caption: "Plush king bed",
    },
    {
      url: "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&q=80",
      caption: "Luxury walk-in shower",
    },
    {
      url: "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1200&q=80",
      caption: "Sofa bed and seating area",
    },
    {
      url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
      caption: "Executive work desk and Nespresso station",
    },
    {
      url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
      caption: "Elegant king room overview",
    },
  ],
  suite: [
    {
      url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
      caption: "Separate living area",
    },
    {
      url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
      caption: "King bedroom",
    },
    {
      url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
      caption: "Master bathroom with soaking tub",
    },
    {
      url: "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=1200&q=80",
      caption: "Wet bar and kitchenette",
    },
    {
      url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
      caption: "Full suite panorama",
    },
  ],
}

export function coverImageForType(slug: string): string {
  return catalogImagesByType[slug][0].url
}
