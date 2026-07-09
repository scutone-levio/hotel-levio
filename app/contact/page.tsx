import { MapPin, Phone, Mail, Clock } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ContactForm } from "@/components/contact-form"
import { PageHeader } from "@/components/page-header"

export const metadata = {
  title: "Contact Us — Hôtel Levio",
  description:
    "Get in touch with Hôtel Levio. Our concierge team is available 24/7 to assist with reservations and enquiries.",
}

export default function ContactPage() {
  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <PageHeader
              eyebrow="Get in touch"
              title="We'd love to hear from you"
              subtitle="Whether you're planning a stay, organising a private event, or simply have a question, our team is here around the clock to make it effortless."
            />
          </div>

          <div className="grid gap-12 lg:grid-cols-3">
            {/* Contact details */}
            <aside className="space-y-8 lg:col-span-1">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                    <MapPin className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Address</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      1801 av. McGill College, bureau 1055
                      <br />
                      Montréal (QC) H3A 2N4
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                    <Phone className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Phone</p>
                    <p className="text-muted-foreground text-sm">
                      +1 (514) 555-0199
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Reservations & enquiries
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                    <Mail className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Email</p>
                    <p className="text-muted-foreground text-sm">
                      bonjour@hotellevio.com
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Concierge hours</p>
                    <p className="text-muted-foreground text-sm">
                      24 hours · 7 days a week
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5 text-sm space-y-1">
                <p className="font-medium">Response time</p>
                <p className="text-muted-foreground">
                  We aim to respond to all enquiries within 24 hours. For urgent
                  matters, please call us directly.
                </p>
              </div>
            </aside>

            {/* Form */}
            <div className="rounded-xl border bg-card p-8 lg:col-span-2">
              <h2 className="text-xl mb-6">Send us a message</h2>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
