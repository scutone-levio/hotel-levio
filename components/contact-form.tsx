"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ContactForm() {
  const [state, setState] = React.useState<"idle" | "submitting" | "success">(
    "idle",
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const [fields, setFields] = React.useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  })

  function set(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: "" }))
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!fields.name.trim()) next.name = "Name is required."
    if (!fields.email.trim()) {
      next.email = "Email address is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      next.email = "Please enter a valid email address."
    }
    if (!fields.message.trim()) next.message = "Message is required."
    return next
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setState("submitting")
    // Simulate network delay for demo purposes.
    await new Promise((r) => setTimeout(r, 800))
    setState("success")
  }

  if (state === "success") {
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-3">
        <div className="text-4xl">✉️</div>
        <h3 className="text-lg">Message received</h3>
        <p className="text-muted-foreground text-sm">
          Thank you for reaching out. A member of our concierge team will be in
          touch within 24 hours.
        </p>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => {
            setState("idle")
            setFields({ name: "", email: "", phone: "", message: "" })
          }}
        >
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Marie Dupont"
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name ? (
            <p className="text-destructive text-xs">{errors.name}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">
            Email address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="marie@example.com"
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email ? (
            <p className="text-destructive text-xs">{errors.email}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telephone number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 (514) 555-0100"
          value={fields.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">
          Message <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="message"
          rows={5}
          placeholder="How can we help you?"
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          aria-invalid={!!errors.message}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {errors.message ? (
          <p className="text-destructive text-xs">{errors.message}</p>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        Fields marked <span className="text-destructive">*</span> are required.
      </p>

      <Button type="submit" disabled={state === "submitting"} className="w-full sm:w-auto">
        {state === "submitting" ? "Sending…" : "Send message"}
      </Button>
    </form>
  )
}
