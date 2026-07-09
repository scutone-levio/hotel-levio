import Image from "next/image"
import { MapPin, Clock, Phone, Globe } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Badge } from "@/components/ui/badge"

export const metadata = {
  title: "About Us — Hôtel Levio",
  description:
    "Discover Hôtel Levio, Montréal's most exclusive boutique hotel in the heart of downtown, steps from the Old Port.",
}

const nearbyPlaces = [
  {
    name: "Old Port of Montréal",
    distance: "12 min walk",
    description:
      "A vibrant waterfront destination along the St. Lawrence River with boutiques, restaurants, and seasonal events.",
    icon: "🚢",
  },
  {
    name: "Notre-Dame Basilica",
    distance: "14 min walk",
    description:
      "One of North America's most stunning Gothic Revival churches, an icon of Montréal's heritage.",
    icon: "⛪",
  },
  {
    name: "McGill University",
    distance: "6 min walk",
    description:
      "One of Canada's top research universities, whose beautiful campus borders the hotel's neighbourhood.",
    icon: "🎓",
  },
  {
    name: "Place des Arts",
    distance: "8 min walk",
    description:
      "Montréal's premier performing-arts complex, home to the Orchestre Symphonique and major festivals.",
    icon: "🎭",
  },
  {
    name: "Underground City (RESO)",
    distance: "Direct access",
    description:
      "32 km of climate-controlled tunnels linking shopping, dining, metro stations, and cultural venues.",
    icon: "🛍️",
  },
  {
    name: "Musée des beaux-arts",
    distance: "10 min walk",
    description:
      "Canada's largest art museum, housing a world-class permanent collection and blockbuster exhibitions.",
    icon: "🖼️",
  },
  {
    name: "Mount Royal Park",
    distance: "20 min walk",
    description:
      "Frederick Law Olmsted's masterpiece — a forested mountain in the heart of the city with panoramic views.",
    icon: "🌿",
  },
  {
    name: "Chinatown",
    distance: "10 min walk",
    description:
      "A lively neighbourhood packed with authentic Asian cuisine, dim sum, and specialty grocers.",
    icon: "🥟",
  },
  {
    name: "Crescent Street",
    distance: "8 min walk",
    description:
      "Montréal's most celebrated strip for fine dining, terraces, live music, and upscale boutiques.",
    icon: "🍷",
  },
  {
    name: "Centre Bell",
    distance: "15 min walk",
    description:
      "Home of the Montréal Canadiens and the city's premier venue for world-class concerts and sporting events.",
    icon: "🏒",
  },
  {
    name: "Palais des congrès",
    distance: "10 min walk",
    description:
      "Montréal's convention centre, renowned for its iconic stained-glass façade and architectural bold.",
    icon: "🏛️",
  },
  {
    name: "Square Phillips",
    distance: "4 min walk",
    description:
      "A charming public square surrounded by heritage buildings, flagship stores, and café terraces.",
    icon: "☕",
  },
]

export default function AboutPage() {
  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="via-background dark:via-background absolute inset-0 -z-10 bg-gradient-to-br from-slate-100 to-amber-50 dark:from-slate-950/40 dark:to-amber-950/20" />
          <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
            <Badge variant="secondary" className="mb-5">
              Downtown Montréal
            </Badge>
            <h1 className="mx-auto max-w-3xl text-4xl tracking-tight text-balance sm:text-6xl">
              Where Montréal's golden mile meets timeless luxury
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-pretty">
              Hôtel Levio occupies the crown floors of one of downtown
              Montréal's most prestigious addresses — steps from the Old Port,
              McGill University, and the finest dining the city has to offer.
            </p>
            <div className="text-muted-foreground mt-4 flex items-center justify-center gap-1 text-sm">
              <MapPin className="size-4 shrink-0" />
              1801 av. McGill College, bureau 1055, Montréal (QC) H3A 2N4
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl tracking-tight">Our story</h2>
              <div className="text-muted-foreground mt-4 space-y-4 text-base leading-relaxed">
                <p>
                  Founded in 2018 by a trio of hospitality veterans who shared a
                  single conviction — that Montréal deserved a hotel as
                  extraordinary as the city itself — Hôtel Levio was designed
                  from the ground up to be nothing short of exceptional.
                </p>
                <p>
                  Every suite, every corridor, every detail was conceived in
                  collaboration with award-winning Québécois designers, blending
                  the city's celebrated joie de vivre with understated European
                  elegance. The result is a sanctuary where business and leisure
                  travellers alike arrive as guests and leave as devotees.
                </p>
                <p>
                  Situated on the upper floors of the McGill College tower, the
                  hotel commands sweeping views over the mountain to the north
                  and the glittering skyline to the south — a perspective on
                  Montréal available nowhere else.
                </p>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl">
              <Image
                src="https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80"
                alt="Hôtel Levio lobby"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </section>

        {/* Photo Gallery */}
        <section className="bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-12 text-center text-3xl tracking-tight">
              Inside Hôtel Levio
            </h2>
            <div className="grid gap-10 sm:grid-cols-2">
              {/* Foyer */}
              <div className="space-y-4">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-md">
                  <Image
                    src="https://images.unsplash.com/photo-1568084680786-a84f91d1153c?auto=format&fit=crop&w=1200&q=80"
                    alt="Hotel foyer"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <p className="text-center text-sm font-medium">
                  Grand Foyer
                </p>
                <p className="text-muted-foreground text-center text-sm">
                  Soaring ceilings, hand-selected marble, and bespoke lighting
                  set the tone the moment you step inside.
                </p>
              </div>
              {/* Gym */}
              <div className="space-y-4">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-md">
                  <Image
                    src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80"
                    alt="Hotel fitness centre"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <p className="text-center text-sm font-medium">
                  Fitness Centre
                </p>
                <p className="text-muted-foreground text-center text-sm">
                  State-of-the-art equipment, panoramic city views, and a
                  dedicated wellness team — open 24 hours.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Nearby Amenities */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl tracking-tight">
              Everything Montréal within reach
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
              Our central location on McGill College Avenue puts the best of the
              city at your doorstep — from the Old Port waterfront to the
              cultural institutions of the Quartier des spectacles.
            </p>
          </div>

          {/* City overview image */}
          <div className="relative mb-12 aspect-[21/9] overflow-hidden rounded-2xl shadow-lg">
            <Image
              src="https://images.unsplash.com/photo-1605979421023-8964ff1920f3?auto=format&fit=crop&w=1800&q=80"
              alt="Montréal Old Port waterfront"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-5 left-6 text-white">
              <p className="text-lg font-semibold">Old Port of Montréal</p>
              <p className="text-sm opacity-80">12 minutes on foot</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {nearbyPlaces.map((place) => (
              <div
                key={place.name}
                className="rounded-xl border bg-card p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{place.icon}</span>
                    <span className="font-semibold text-sm">{place.name}</span>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {place.distance}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {place.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Quick facts */}
        <section className="bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-8 text-center text-3xl tracking-tight">
              At a glance
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="text-center space-y-2">
                <div className="text-4xl font-bold">10</div>
                <div className="text-muted-foreground text-sm">Floors of guest rooms</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl font-bold">4.9★</div>
                <div className="text-muted-foreground text-sm">Average guest rating</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl font-bold">24/7</div>
                <div className="text-muted-foreground text-sm">Concierge & room service</div>
              </div>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3 text-sm">
              <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <Clock className="text-primary mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Check-in / Check-out</p>
                  <p className="text-muted-foreground">3:00 PM / 12:00 PM</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <Phone className="text-primary mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Reservations</p>
                  <p className="text-muted-foreground">+1 (514) 555-0199</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <Globe className="text-primary mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Languages</p>
                  <p className="text-muted-foreground">French · English · Spanish</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
