import { MapPin, Phone, Mail, Clock } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ContactForm } from "@/components/contact-form"
import { Button } from "@/components/ui/button"

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
        {/* Hero */}
        <section className="relative overflow-hidden bg-linear-to-b from-[#081a27] via-[#0f2a3d] to-[#3f6f83] px-6 py-22 text-center sm:py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[30%] left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(220,174,112,0.13) 0%, transparent 60%)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(115deg, rgba(220,174,112,0.04) 0%, transparent 40%)" }}
          />

          <div className="relative mx-auto max-w-2xl">
            <p className="inline-flex items-center gap-3 text-[0.72rem] tracking-[0.24em] text-[#dcae70] uppercase">
              <span className="h-px w-9 bg-[#dcae70]/70" />
              Concierge · 24 hours a day
              <span className="h-px w-9 bg-[#dcae70]/70" />
            </p>

            <h1 className="mx-auto mt-6 max-w-xl text-4xl leading-[1.12] font-medium text-balance text-[#f8f3e6] sm:text-[3.5rem]">
              We&apos;d love to{" "}
              <em className="text-[#dcae70] not-italic">hear</em>{" "}
              from you
            </h1>

            <p className="mx-auto mt-5 max-w-md text-[1.02rem] leading-relaxed text-[#f8f3e6]/65 text-pretty">
              Planning a stay, organising a private event, or simply have a
              question — our team is here around the clock to make it effortless.
            </p>

            {/* Contact channel strip */}
            <div
              className="mt-10 grid grid-cols-4 overflow-hidden rounded-[0.875rem] border border-[#c69456]/20"
              style={{ background: "rgba(8,26,39,0.40)", backdropFilter: "blur(4px)" }}
            >
              <div className="flex flex-col items-center gap-2.5 px-4 py-5 text-center">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#c69456]/25 bg-[#c69456]/12">
                  <MapPin className="size-3.5 text-[#dcae70]" />
                </div>
                <span className="text-[0.62rem] tracking-[0.16em] text-[#f8f3e6]/40 uppercase">Address</span>
                <span className="text-[0.82rem] font-medium leading-snug text-[#f8f3e6]">1801 McGill College<br />Montréal (QC)</span>
              </div>
              <div className="flex flex-col items-center gap-2.5 border-l border-[#c69456]/20 px-4 py-5 text-center">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#c69456]/25 bg-[#c69456]/12">
                  <Phone className="size-3.5 text-[#dcae70]" />
                </div>
                <span className="text-[0.62rem] tracking-[0.16em] text-[#f8f3e6]/40 uppercase">Phone</span>
                <span className="text-[0.82rem] font-medium leading-snug text-[#f8f3e6]">+1 (514) 555-0199</span>
                <span className="text-[0.68rem] text-[#f8f3e6]/40">Reservations &amp; enquiries</span>
              </div>
              <div className="flex flex-col items-center gap-2.5 border-l border-[#c69456]/20 px-4 py-5 text-center">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#c69456]/25 bg-[#c69456]/12">
                  <Mail className="size-3.5 text-[#dcae70]" />
                </div>
                <span className="text-[0.62rem] tracking-[0.16em] text-[#f8f3e6]/40 uppercase">Email</span>
                <span className="text-[0.82rem] font-medium leading-snug text-[#f8f3e6]">bonjour@<br />hotellevio.com</span>
              </div>
              <div className="flex flex-col items-center gap-2.5 border-l border-[#c69456]/20 px-4 py-5 text-center">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#c69456]/25 bg-[#c69456]/12">
                  <Clock className="size-3.5 text-[#dcae70]" />
                </div>
                <span className="text-[0.62rem] tracking-[0.16em] text-[#f8f3e6]/40 uppercase">Concierge</span>
                <span className="text-[0.82rem] font-medium leading-snug text-[#f8f3e6]">24 hours</span>
                <span className="text-[0.68rem] text-[#f8f3e6]/40">7 days a week</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a href="#contact-form">Send a message</a>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-[#c69456]/35 bg-transparent text-[#f8f3e6] hover:border-[#c69456]/70 hover:bg-[#c69456]/10 hover:text-[#dcae70]"
                asChild
              >
                <a href="tel:+15145550199">Call us now</a>
              </Button>
            </div>

            <p className="mt-6 text-[0.72rem] tracking-[0.06em] text-[#f8f3e6]/38">
              We reply to all enquiries within{" "}
              <span className="font-medium text-[#f8f3e6]/60">24 hours</span>{" "}
              — urgent matters, please call.
            </p>
          </div>
        </section>

        <section id="contact-form" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
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
