-- Separate date-change payment references from the original checkout session ID.
ALTER TABLE "Booking"
ADD COLUMN "dateChangeStripePaymentId" TEXT;

-- Enforce one booking per date-change payment intent (NULL values are excluded from uniqueness).
CREATE UNIQUE INDEX "Booking_dateChangeStripePaymentId_key"
ON "Booking" ("dateChangeStripePaymentId")
WHERE "dateChangeStripePaymentId" IS NOT NULL;
