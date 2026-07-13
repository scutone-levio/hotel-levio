export function validateDateChangePaymentIntentUsage(
  existingBooking: { id: string } | null,
): { ok: true } | { ok: false; error: string } {
  if (existingBooking) {
    return { ok: false, error: "Payment intent already used for a booking" }
  }
  return { ok: true }
}

export function buildDateChangeBookingUpdateData(
  _booking: { stripeSessionId: string | null },
  dateChangeStripePaymentId: string | undefined,
  checkIn: Date,
  checkOut: Date,
  totalPrice: number,
) {
  return {
    checkIn,
    checkOut,
    totalPrice,
    // stripeSessionId is intentionally not updated — original checkout reference preserved.
    dateChangeStripePaymentId: dateChangeStripePaymentId ?? null,
  }
}
