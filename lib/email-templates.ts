import { format, differenceInCalendarDays } from "date-fns"

const PRIMARY = "#004c5f"
const BG = "#f8fafc"
const BORDER = "#e2e8f0"
const MUTED = "#64748b"
const WHITE = "#ffffff"

function base(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${WHITE};border-radius:12px;border:1px solid ${BORDER};overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${PRIMARY};padding:28px 36px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:${WHITE};letter-spacing:-0.3px;">
              Hôtel Levio
            </p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:0.5px;text-transform:uppercase;">
              Montréal · Canada
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:36px;">${body}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:${BG};border-top:1px solid ${BORDER};padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:${MUTED};">
              Hôtel Levio · 1801 av. McGill College, bureau 1055, Montréal (QC) H3A 2N4<br/>
              <a href="mailto:bonjour@hotellevio.com" style="color:${PRIMARY};text-decoration:none;">bonjour@hotellevio.com</a>
              &nbsp;·&nbsp;
              <a href="tel:+15145550199" style="color:${PRIMARY};text-decoration:none;">+1 (514) 555-0199</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};width:40%;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;font-weight:600;color:#0f172a;vertical-align:top;">${value}</td>
  </tr>`
}

export type BookingEmailData = {
  bookingId: string
  roomName: string
  roomNumber?: string | null
  checkIn: Date
  checkOut: Date
  nights: number
  guests: number
  guestName: string
  guestEmail: string
  guestPhone?: string | null
  specialRequests?: string | null
  totalPrice: number
}

function fmt(d: Date) { return format(d, "EEE, MMM d, yyyy") }
function money(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100)
}
function ref(id: string) { return id.slice(-8).toUpperCase() }

/* ------------------------------------------------------------------ */
/*  Guest confirmation                                                  */
/* ------------------------------------------------------------------ */
export function guestConfirmationEmail(data: BookingEmailData) {
  const subject = `Reservation Confirmed — ${data.roomName} · Hôtel Levio`

  const html = base(`
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Your reservation is confirmed!</p>
    <p style="margin:0 0 28px;font-size:15px;color:${MUTED};">
      Hi ${data.guestName.split(" ")[0]}, thank you for choosing Hôtel Levio. We look forward to welcoming you.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${row("Booking reference", `#${ref(data.bookingId)}`)}
      ${row("Room", data.roomNumber ? `${data.roomName} (Room ${data.roomNumber})` : data.roomName)}
      ${row("Check-in", `${fmt(data.checkIn)} <span style="font-weight:400;color:${MUTED}">(from 3:00 PM)</span>`)}
      ${row("Check-out", `${fmt(data.checkOut)} <span style="font-weight:400;color:${MUTED}">(by 12:00 PM)</span>`)}
      ${row("Stay", `${data.nights} night${data.nights > 1 ? "s" : ""} · ${data.guests} guest${data.guests > 1 ? "s" : ""}`)}
      ${data.specialRequests ? row("Special requests", data.specialRequests) : ""}
      ${row("Total charged (CAD)", money(data.totalPrice))}
    </table>

    <p style="margin:28px 0 8px;font-size:13px;color:${MUTED};">
      Free cancellation up to 48 hours before check-in. Reply to this email or contact us at
      <a href="mailto:bonjour@hotellevio.com" style="color:${PRIMARY};">bonjour@hotellevio.com</a>
      if you need to make any changes.
    </p>
  `)

  const text = [
    `RESERVATION CONFIRMED — HÔTEL LEVIO`,
    ``,
    `Hi ${data.guestName},`,
    ``,
    `Your booking is confirmed. Here is your summary:`,
    ``,
    `Reference:   #${ref(data.bookingId)}`,
    `Room:        ${data.roomName}`,
    `Check-in:    ${fmt(data.checkIn)} (from 3:00 PM)`,
    `Check-out:   ${fmt(data.checkOut)} (by 12:00 PM)`,
    `Stay:        ${data.nights} night${data.nights > 1 ? "s" : ""}, ${data.guests} guest${data.guests > 1 ? "s" : ""}`,
    data.specialRequests ? `Requests:    ${data.specialRequests}` : "",
    `Total (CAD): ${money(data.totalPrice)}`,
    ``,
    `Free cancellation up to 48 h before check-in.`,
    `Contact: bonjour@hotellevio.com · +1 (514) 555-0199`,
  ].filter((l) => l !== undefined).join("\n")

  return { subject, html, text }
}

/* ------------------------------------------------------------------ */
/*  Admin — new booking notification                                    */
/* ------------------------------------------------------------------ */
export function adminNotificationEmail(data: BookingEmailData) {
  const subject = `New Booking #${ref(data.bookingId)} — ${data.roomName} · ${fmt(data.checkIn)}`

  const html = base(`
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">New reservation received</p>
    <p style="margin:0 0 28px;font-size:15px;color:${MUTED};">
      A new booking has been confirmed and payment collected.
    </p>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px;">Guest</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row("Name", data.guestName)}
      ${row("Email", `<a href="mailto:${data.guestEmail}" style="color:${PRIMARY};">${data.guestEmail}</a>`)}
      ${data.guestPhone ? row("Phone", data.guestPhone) : ""}
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px;">Stay</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row("Booking reference", `#${ref(data.bookingId)}`)}
      ${row("Room", data.roomNumber ? `${data.roomName} (Room ${data.roomNumber})` : data.roomName)}
      ${row("Check-in", fmt(data.checkIn))}
      ${row("Check-out", fmt(data.checkOut))}
      ${row("Duration", `${data.nights} night${data.nights > 1 ? "s" : ""} · ${data.guests} guest${data.guests > 1 ? "s" : ""}`)}
      ${data.specialRequests ? row("Special requests", data.specialRequests) : ""}
      ${row("Revenue (CAD)", money(data.totalPrice))}
    </table>

    <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/admin"
       style="display:inline-block;background:${PRIMARY};color:${WHITE};font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
      View in Admin Dashboard →
    </a>
  `)

  const text = [
    `NEW BOOKING — HÔTEL LEVIO`,
    ``,
    `Reference:   #${ref(data.bookingId)}`,
    `Room:        ${data.roomName}`,
    `Check-in:    ${fmt(data.checkIn)}`,
    `Check-out:   ${fmt(data.checkOut)}`,
    `Duration:    ${data.nights} night${data.nights > 1 ? "s" : ""}, ${data.guests} guest${data.guests > 1 ? "s" : ""}`,
    ``,
    `Guest:       ${data.guestName}`,
    `Email:       ${data.guestEmail}`,
    data.guestPhone ? `Phone:       ${data.guestPhone}` : "",
    data.specialRequests ? `Requests:    ${data.specialRequests}` : "",
    ``,
    `Revenue:     ${money(data.totalPrice)}`,
  ].filter((l) => l !== undefined).join("\n")

  return { subject, html, text }
}

/* ------------------------------------------------------------------ */
/*  Admin — booking modified                                            */
/* ------------------------------------------------------------------ */

type BookingSnapshot = {
  id: string
  checkIn: Date
  checkOut: Date
  guests: number
  totalPrice: number
  status: string
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  specialRequests: string | null
}

export function adminBookingModifiedEmail(data: {
  before: BookingSnapshot
  after: BookingSnapshot
  roomName: string
}) {
  const { before, after } = data
  const subject = `Booking Modified #${ref(after.id)} — ${data.roomName}`

  type Change = { label: string; from: string; to: string }
  const changes: Change[] = []

  function maybeAdd(label: string, a: unknown, b: unknown, display?: (v: unknown) => string) {
    const d = display ?? ((v: unknown) => String(v ?? "—"))
    if (String(a ?? "") !== String(b ?? "")) changes.push({ label, from: d(a), to: d(b) })
  }

  maybeAdd("Check-in", before.checkIn, after.checkIn, (v) => fmt(v as Date))
  maybeAdd("Check-out", before.checkOut, after.checkOut, (v) => fmt(v as Date))
  maybeAdd("Guests", before.guests, after.guests)
  maybeAdd("Status", before.status, after.status)
  maybeAdd("Total", before.totalPrice, after.totalPrice, (v) => money(v as number))
  maybeAdd("Guest name", before.guestName, after.guestName)
  maybeAdd("Guest email", before.guestEmail, after.guestEmail)
  maybeAdd("Guest phone", before.guestPhone, after.guestPhone)
  maybeAdd("Special requests", before.specialRequests, after.specialRequests)

  const changesHtml = changes.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding:6px 0;font-size:12px;font-weight:700;color:${MUTED};width:30%;">Field</td>
          <td style="padding:6px 0;font-size:12px;font-weight:700;color:${MUTED};width:35%;">Before</td>
          <td style="padding:6px 0;font-size:12px;font-weight:700;color:${MUTED};width:35%;">After</td>
        </tr>
        ${changes.map((c) => `
          <tr style="border-top:1px solid ${BORDER};">
            <td style="padding:8px 0;font-size:13px;color:${MUTED};">${c.label}</td>
            <td style="padding:8px 0;font-size:13px;text-decoration:line-through;color:${MUTED};">${c.from}</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;">${c.to}</td>
          </tr>`).join("")}
      </table>`
    : `<p style="color:${MUTED};font-size:13px;margin:0 0 24px;">No fields were changed.</p>`

  const html = base(`
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Booking modified</p>
    <p style="margin:0 0 4px;font-size:14px;color:${MUTED};">Reference <strong>#${ref(after.id)}</strong> · ${data.roomName}</p>
    <p style="margin:0 0 28px;font-size:14px;color:${MUTED};">Guest: ${after.guestName ?? after.guestEmail ?? "Unknown"}</p>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px;">Changes</p>
    ${changesHtml}

    <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/admin"
       style="display:inline-block;background:${PRIMARY};color:${WHITE};font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
      View in Admin Dashboard →
    </a>
  `)

  const text = [
    `BOOKING MODIFIED — HÔTEL LEVIO`,
    ``,
    `Reference: #${ref(after.id)}`,
    `Room:      ${data.roomName}`,
    `Guest:     ${after.guestName ?? after.guestEmail ?? "Unknown"}`,
    ``,
    `Changes:`,
    ...changes.map((c) => `  ${c.label}: "${c.from}" → "${c.to}"`),
  ].join("\n")

  return { subject, html, text }
}

/* ------------------------------------------------------------------ */
/*  Admin — booking deleted                                             */
/* ------------------------------------------------------------------ */

export function adminBookingDeletedEmail(data: {
  booking: BookingSnapshot
  roomName: string
}) {
  const { booking } = data
  const subject = `Booking Deleted #${ref(booking.id)} — ${data.roomName}`
  const nights = differenceInCalendarDays(booking.checkOut, booking.checkIn)

  const html = base(`
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Booking deleted</p>
    <p style="margin:0 0 28px;font-size:15px;color:${MUTED};">The following reservation has been permanently removed.</p>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${row("Booking reference", `#${ref(booking.id)}`)}
      ${row("Room", data.roomName)}
      ${row("Guest", booking.guestName ?? booking.guestEmail ?? "Unknown")}
      ${booking.guestEmail ? row("Email", booking.guestEmail) : ""}
      ${row("Check-in", fmt(booking.checkIn))}
      ${row("Check-out", fmt(booking.checkOut))}
      ${row("Duration", `${nights} night${nights !== 1 ? "s" : ""} · ${booking.guests} guest${booking.guests !== 1 ? "s" : ""}`)}
      ${row("Status at deletion", booking.status)}
      ${row("Revenue lost (CAD)", money(booking.totalPrice))}
    </table>
  `)

  const text = [
    `BOOKING DELETED — HÔTEL LEVIO`,
    ``,
    `Reference: #${ref(booking.id)}`,
    `Room:      ${data.roomName}`,
    `Guest:     ${booking.guestName ?? booking.guestEmail ?? "Unknown"}`,
    `Check-in:  ${fmt(booking.checkIn)}`,
    `Check-out: ${fmt(booking.checkOut)}`,
    `Status:    ${booking.status}`,
    `Revenue:   ${money(booking.totalPrice)}`,
  ].join("\n")

  return { subject, html, text }
}
