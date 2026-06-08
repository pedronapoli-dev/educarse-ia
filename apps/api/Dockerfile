# ── Stage 1: Install & build ──────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json tsconfig.json turbo.json ./

# Copy only the packages and apps needed by the API
COPY packages/types/  packages/types/
COPY apps/api/        apps/api/

# Install all workspace dependencies
RUN npm ci --workspace=packages/types --workspace=apps/api

# Build types first (API depends on it), then API
RUN npm run build --workspace=packages/types && \
    npm run build --workspace=apps/api

# ── Stage 2: Production image ────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy root workspace files for npm resolution
COPY package.json package-lock.json ./

# Copy built packages
COPY --from=builder /app/packages/types/dist/      packages/types/dist/
COPY --from=builder /app/packages/types/package.json packages/types/

# Copy built API
COPY --from=builder /app/apps/api/dist/            apps/api/dist/
COPY --from=builder /app/apps/api/package.json     apps/api/

# Install production dependencies only
RUN npm ci --workspace=packages/types --workspace=apps/api --omit=dev

EXPOSE 3001

CMD ["node", "apps/api/dist/server.js"]
