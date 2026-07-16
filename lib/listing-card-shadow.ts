/** Shared elevation shadow for room and reservation listing cards. */
export const LISTING_CARD_SHADOW_CLASS =
  "shadow-[0_1px_2px_rgba(15,42,61,0.07),0_18px_34px_-18px_rgba(15,42,61,0.32)]"

export const LISTING_CARD_SHADOW_HOVER_CLASS =
  "hover:shadow-[0_2px_4px_rgba(15,42,61,0.08),0_26px_42px_-16px_rgba(15,42,61,0.38)]"

export const LISTING_CARD_HOVER_LIFT_CLASS =
  "transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5"

/** Room cards use a slightly stronger lift on hover. */
export const ROOM_CARD_HOVER_LIFT_CLASS =
  "transition-[transform,box-shadow] duration-300 hover:-translate-y-1"
