# syntax=docker/dockerfile:1

# ---- Base -------------------------------------------------------------------
# Node 26 (matches .nvmrc). Alpine keeps the image small.
FROM node:26-alpine AS base
# libc6-compat is needed by some native deps (e.g. Prisma engines) on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- Dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Builder ----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client before building.
RUN npx prisma generate
# Disable Next.js telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runner -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a non-root user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy the standalone server output and static assets.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma schema + generated client for running migrations at startup.
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# server.js is produced by Next.js `output: "standalone"`.
CMD ["node", "server.js"]
