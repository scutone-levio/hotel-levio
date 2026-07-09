import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Privacy Policy — Hôtel Levio",
  description: "Hôtel Levio's privacy policy — how we collect, use, and protect your personal information.",
}

export default function PrivacyPage() {
  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
          <h1 className="text-4xl tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm mb-12">
            Last updated: July 2026
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10 text-sm leading-7">

            <section className="space-y-3">
              <h2 className="text-xl">1. Introduction</h2>
              <p className="text-muted-foreground">
                Hôtel Levio ("<strong>we</strong>", "<strong>us</strong>", or
                "<strong>our</strong>") is committed to protecting the personal
                information of our guests, website visitors, and any other
                individuals whose data we process. This Privacy Policy explains
                what information we collect, why we collect it, how we use it,
                and the rights you have with respect to your data.
              </p>
              <p className="text-muted-foreground">
                This policy applies to all personal information collected through
                our website, reservation systems, mobile applications, in-hotel
                services, and any other interactions you have with Hôtel Levio.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">2. Information we collect</h2>
              <p className="text-muted-foreground">We collect information in two principal ways:</p>
              <div className="space-y-4">
                <div>
                  <h3>Information you provide directly</h3>
                  <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
                    <li>Full name, email address, and telephone number</li>
                    <li>Mailing address and billing information</li>
                    <li>Reservation details (check-in/check-out dates, room preferences, number of guests)</li>
                    <li>Loyalty programme and account credentials</li>
                    <li>Communications you send us (enquiries, feedback, complaints)</li>
                    <li>Special requests (dietary requirements, accessibility needs)</li>
                  </ul>
                </div>
                <div>
                  <h3>Information collected automatically</h3>
                  <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
                    <li>IP address, browser type, and operating system</li>
                    <li>Pages visited, time spent, and referring URLs</li>
                    <li>Cookie identifiers and device identifiers</li>
                    <li>In-hotel Wi-Fi usage logs (anonymised)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">3. How we use your information</h2>
              <p className="text-muted-foreground">We use your personal information to:</p>
              <ul className="text-muted-foreground list-disc list-inside space-y-1">
                <li>Process reservations and manage your stay</li>
                <li>Charge for services and issue receipts</li>
                <li>Communicate with you about your booking and any changes</li>
                <li>Respond to your enquiries and provide customer support</li>
                <li>Personalise your experience and anticipate your preferences</li>
                <li>Send promotional offers and newsletters (only with your consent)</li>
                <li>Comply with legal and regulatory obligations</li>
                <li>Detect, investigate, and prevent fraudulent transactions</li>
                <li>Improve our services and website functionality</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">4. Legal bases for processing</h2>
              <p className="text-muted-foreground">
                Where applicable under Québec's Act respecting the protection of
                personal information in the private sector (Law 25) and other
                applicable legislation, we process your personal information on
                the following legal bases:
              </p>
              <ul className="text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>Contract performance</strong> — to fulfil your reservation and deliver hotel services</li>
                <li><strong>Legitimate interest</strong> — to improve our services, prevent fraud, and maintain security</li>
                <li><strong>Consent</strong> — for marketing communications and non-essential cookies</li>
                <li><strong>Legal obligation</strong> — to comply with applicable laws and regulations</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">5. Cookies</h2>
              <p className="text-muted-foreground">
                Our website uses cookies and similar tracking technologies to
                enhance your browsing experience, analyse site traffic, and
                personalise content. We use:
              </p>
              <ul className="text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>Strictly necessary cookies</strong> — required for the website to function (e.g. session management)</li>
                <li><strong>Analytical cookies</strong> — to understand how visitors interact with our site</li>
                <li><strong>Marketing cookies</strong> — to deliver relevant advertisements (only with your consent)</li>
              </ul>
              <p className="text-muted-foreground">
                You may withdraw consent for non-essential cookies at any time
                through your browser settings or our cookie preference centre.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">6. Sharing of information</h2>
              <p className="text-muted-foreground">
                We do not sell your personal information. We may share it with:
              </p>
              <ul className="text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>Service providers</strong> — payment processors, IT service providers, and analytics partners who are contractually bound to protect your data</li>
                <li><strong>Law enforcement</strong> — when required by law, court order, or governmental authority</li>
                <li><strong>Business transfers</strong> — in the event of a merger, acquisition, or sale of assets, subject to appropriate confidentiality agreements</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">7. Data retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information for as long as necessary to
                fulfil the purposes described in this policy, unless a longer
                retention period is required by law. Reservation records are
                typically retained for seven (7) years for accounting and
                regulatory purposes. Marketing data is retained until you
                withdraw consent.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">8. Your rights</h2>
              <p className="text-muted-foreground">
                Depending on your jurisdiction, you may have the right to:
              </p>
              <ul className="text-muted-foreground list-disc list-inside space-y-1">
                <li>Access the personal information we hold about you</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Request deletion of your personal information</li>
                <li>Object to or restrict certain types of processing</li>
                <li>Withdraw consent at any time (without affecting the lawfulness of prior processing)</li>
                <li>Lodge a complaint with a supervisory authority</li>
              </ul>
              <p className="text-muted-foreground">
                To exercise any of these rights, please contact our Privacy
                Officer at{" "}
                <a href="mailto:privacy@hotellevio.com" className="text-primary underline-offset-4 hover:underline">
                  privacy@hotellevio.com
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">9. Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organisational measures to
                protect your personal information against unauthorised access,
                alteration, disclosure, or destruction. These include encryption
                in transit and at rest, access controls, and regular security
                assessments. However, no method of transmission over the internet
                is completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">10. Children&apos;s privacy</h2>
              <p className="text-muted-foreground">
                Our services are not directed to children under the age of 14. We
                do not knowingly collect personal information from children. If
                you believe we have inadvertently done so, please contact us and
                we will promptly delete the information.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">11. Changes to this policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time to reflect
                changes in our practices or applicable law. We will notify you of
                material changes by posting the revised policy on our website and
                updating the "Last updated" date above. Your continued use of our
                services after such changes constitutes acceptance of the updated
                policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl">12. Contact us</h2>
              <p className="text-muted-foreground">
                If you have questions or concerns about this Privacy Policy or our
                data practices, please contact our Privacy Officer:
              </p>
              <address className="text-muted-foreground not-italic space-y-1">
                <p>Hôtel Levio — Privacy Officer</p>
                <p>1801 av. McGill College, bureau 1055</p>
                <p>Montréal (QC) H3A 2N4, Canada</p>
                <p>
                  <a href="mailto:privacy@hotellevio.com" className="text-primary underline-offset-4 hover:underline">
                    privacy@hotellevio.com
                  </a>
                </p>
                <p>+1 (514) 555-0199</p>
              </address>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
