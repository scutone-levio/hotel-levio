import { Suspense } from "react"
import { getRooms } from "@/lib/queries"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HomeContent } from "@/components/home-content"

export const dynamic = "force-dynamic"

export default async function Home() {
  const rooms = await getRooms()

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Suspense required for useSearchParams inside HomeContent */}
        <Suspense>
          <HomeContent rooms={rooms} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
