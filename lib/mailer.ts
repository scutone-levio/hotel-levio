import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false, // Mailpit (and most dev SMTP servers) do not use TLS
  ...(process.env.SMTP_USER
    ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
    : {}),
})

const FROM = process.env.SMTP_FROM ?? "noreply@hotellevio.com"

export async function sendMail(opts: {
  to: string
  subject: string
  html: string
  text?: string
}) {
  return transporter.sendMail({
    from: `Hôtel Levio <${FROM}>`,
    ...opts,
  })
}
