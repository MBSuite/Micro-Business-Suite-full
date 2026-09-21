# ============================================================
# Micro Business Suite — Production Dockerfile (Next.js standalone)
# Build with output: 'standalone' (see next.config.ts)
# ============================================================

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder so fail-fast guards (db.ts, auth.ts) pass during page-data collection;
# replaced by real values at runtime via compose environment.
ENV DATABASE_URL=postgresql://mbs:mbs@db:5432/mbs?sslmode=disable
ENV POSTGRES_URL=postgresql://mbs:mbs@db:5432/mbs?sslmode=disable
ENV NEXTAUTH_SECRET=docker-build-placeholder-not-used-at-runtime
ENV AUTH_SECRET=docker-build-placeholder-not-used-at-runtime
RUN pnpm build

# ---------- Stage 3: runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]