-- Separate date-change payment references from the original checkout session ID.
ALTER TABLE "Booking"
ADD COLUMN "dateChangeStripePaymentId" TEXT;
