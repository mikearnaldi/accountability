# syntax=docker/dockerfile:1

# Dependencies stage - cached separately from source changes
FROM node:22-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/persistence/package.json ./packages/persistence/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/

# Install dependencies with cache mount for pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build stage
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/persistence/node_modules ./packages/persistence/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules

# Copy source code
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY packages ./packages

# Build the application with cache mount for build artifacts
RUN --mount=type=cache,target=/app/packages/web/.vite \
    --mount=type=cache,target=/app/packages/web/node_modules/.vite \
    pnpm build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 accountability

# Copy built output from builder
COPY --from=builder --chown=accountability:nodejs /app/packages/web/.output ./

# Install externalized runtime dependencies (pg doesn't bundle well)
RUN npm install --no-save pg pg-pool

USER accountability

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.mjs"]
