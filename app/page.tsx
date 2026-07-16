import { Suspense } from "react"
import { getPublicRoomListings } from "@/lib/queries"
import { getActiveRoomTypes } from "@/lib/room-types"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HomeContent } from "@/components/home-content"

export const dynamic = "force-dynamic"

export default async function Home() {
  const [rooms, roomTypes] = await Promise.all([
    getPublicRoomListings(),
    getActiveRoomTypes(),
  ])

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Suspense required for useSearchParams inside HomeContent */}
        <Suspense>
          <HomeContent rooms={rooms} roomTypes={roomTypes} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
