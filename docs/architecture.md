# Hôtel Levio — Architecture

## Backend Architecture

```mermaid
flowchart TD
    Browser["🌐 Browser\nClient Components + Stripe.js"]

    subgraph NextJS["Next.js 15 — App Router"]
        Middleware["middleware.ts\nRoute protection\n(admin guard, auth redirects)"]
        RSC["Server Components\nPages — data fetching\nno client JS"]
        SA["Server Actions\napp/actions.ts\napp/admin/actions.ts\napp/account/actions.ts"]
        API["API Routes\n/api/auth/[...nextauth]\n/api/stripe/webhook\n/api/uploadthing"]
    end

    subgraph AuthLayer["Auth — NextAuth v5"]
        Session["JWT Session Cookie"]
        Credentials["Credentials Provider\nemail + bcrypt password"]
        OAuthProv["OAuth Providers\nGoogle / Facebook"]
    end

    subgraph DataLayer["Data Layer"]
        Prisma["Prisma ORM\n(prisma/schema.prisma)"]
        PG[("PostgreSQL")]
    end

    subgraph External["External Services"]
        Stripe["Stripe\nPaymentIntents\nWebhook events"]
        UT["UploadThing\nImage CDN\n(room photos)"]
        Email["nodemailer\nMailpit in dev\nSMTP in prod"]
    end

    Browser -- "HTTP / RSC stream" --> Middleware
    Middleware --> RSC
    Middleware --> API
    Browser -- "Server Action POST" --> SA

    RSC --> AuthLayer
    SA  --> AuthLayer
    API --> AuthLayer
    AuthLayer --> Prisma

    RSC --> Prisma
    SA  --> Prisma
    API --> Prisma
    Prisma --> PG

    SA  -- "createPaymentIntent\nconfirmBooking" --> Stripe
    API -- "/api/stripe/webhook\nconfirm / cancel bookings" --> Stripe

    SA  -- "deleteRoomImage" --> UT
    API -- "/api/uploadthing\nfile router" --> UT

    SA  -- "sendMail (fire-and-forget)" --> Email
```

---

## Database Schema

```mermaid
erDiagram
    USER {
        string  id          PK
        string  name
        string  email       UK
        string  password        "nullable — hashed bcrypt"
        string  phone
        string  addressLine1
        string  addressLine2
        string  city
        string  province
        string  postalCode
        string  country         "default CA"
        string  role            "CUSTOMER | ADMIN"
        datetime createdAt
        datetime updatedAt
    }

    ROOM_SUBCATEGORY {
        string  id              PK
        string  name                "e.g. Lake View, Lower Level"
        string  roomType            "TWIN | QUEEN | KING | SUITE"
        int     basePrice           "cents/night"
        int     fromPriceCents      "lowest across inventory rooms"
        boolean hasWeekendRates
        boolean featured
        datetime createdAt
        datetime updatedAt
    }

    ROOM {
        string  id          PK
        string  name
        string  slug        UK
        string  description
        string  type            "TWIN | QUEEN | KING | SUITE"
        int     basePrice       "cents/night"
        int     capacity
        int     beds
        int     floor
        string  roomNumber  UK
        string  subcategoryId   FK  "nullable"
        boolean isCatalog       "true for the display room per type"
        datetime createdAt
        datetime updatedAt
    }

    AMENITY {
        string  id          PK
        string  name        UK
        string  category        "nullable grouping label"
        datetime createdAt
        datetime updatedAt
    }

    ROOM_IMAGE {
        string  id          PK
        string  roomId      FK
        string  url
        string  key             "nullable — UploadThing file key"
        int     sortOrder       "0 = cover photo"
        datetime createdAt
    }

    ROOM_BLACKOUT {
        string  id          PK
        string  roomId      FK
        date    startDate
        date    endDate
        string  reason          "nullable"
        datetime createdAt
    }

    ROOM_PRICE_RULE {
        string  id          PK
        string  roomId      FK
        int     dayOfWeek       "0 = Sun … 6 = Sat"
        int     price           "cents — overrides basePrice"
        datetime createdAt
        datetime updatedAt
    }

    NEARBY_PLACE {
        string  id          PK
        string  roomId      FK
        string  name
        string  category
        string  distance
    }

    BOOKING {
        string  id                          PK
        string  userId                      FK
        string  roomId                      FK
        string  subcategoryId               FK  "nullable"
        date    checkIn
        date    checkOut
        int     guests
        int     totalPrice                  "cents"
        string  status                      "PENDING | CONFIRMED | CANCELLED"
        string  stripeSessionId             "nullable"
        string  dateChangeStripePaymentId   UK  "nullable"
        string  guestName                   "nullable — denormalized"
        string  guestEmail                  "nullable — denormalized"
        string  guestPhone                  "nullable — denormalized"
        string  specialRequests             "nullable"
        datetime createdAt
        datetime updatedAt
    }

    USER             ||--o{ BOOKING          : "makes"
    ROOM             ||--o{ BOOKING          : "reserved via"
    ROOM_SUBCATEGORY |o--o{ BOOKING          : "categorizes"
    ROOM_SUBCATEGORY |o--o{ ROOM             : "classifies"
    ROOM             ||--o{ ROOM_IMAGE       : "has"
    ROOM             ||--o{ ROOM_BLACKOUT    : "has"
    ROOM             ||--o{ ROOM_PRICE_RULE  : "has"
    ROOM             ||--o{ NEARBY_PLACE     : "has"
    ROOM             }o--o{ AMENITY          : "features"
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Server Actions over REST API | Collocates mutation logic with the UI; no separate API layer to maintain for guest-facing flows |
| JWT sessions (not DB sessions) | Stateless; no `Session` table needed; works with edge middleware |
| Prices stored as integers (cents) | Eliminates floating-point rounding errors across pricing, Stripe, and display |
| Booking denormalizes guest fields | Preserves guest details at booking time; survives profile edits or account deletion |
| `isCatalog` flag on Room | One display room per type drives the homepage gallery; inventory rooms hold real floor/unit data |
| Cascade deletes on RoomImage, RoomBlackout, RoomPriceRule, NearbyPlace | Rooms can be deleted cleanly without orphaned records |
| `SetNull` on Booking → RoomSubcategory | Subcategory deletion does not cancel existing bookings |
