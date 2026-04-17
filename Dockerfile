# ============================================
# Stage 1: Dependencies Installation Stage
# ============================================

# Keep this pinned and update intentionally.
ARG NODE_VERSION=25.9.0-slim

FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

RUN if [ -f package-lock.json ]; then \
    npm ci --no-audit --no-fund; \
    elif [ -f yarn.lock ]; then \
    npm install -g yarn && yarn install --frozen-lockfile --production=false; \
    elif [ -f pnpm-lock.yaml ]; then \
    npm install -g pnpm@10.33.0 && pnpm install --frozen-lockfile; \
    else \
    echo "No lockfile found." && exit 1; \
    fi

# ============================================
# Stage 2: Build Next.js application in standalone mode
# ============================================

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1

# Uncomment to disable telemetry during build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN if [ -f package-lock.json ]; then \
    npm run build; \
    elif [ -f yarn.lock ]; then \
    npm install -g yarn && yarn build; \
    elif [ -f pnpm-lock.yaml ]; then \
    npm install -g pnpm@10.33.0 && pnpm build; \
    else \
    echo "No lockfile found." && exit 1; \
    fi

# ============================================
# Stage 3: Run Next.js application
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/db/db.sqlite

# Uncomment to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/src/server/db ./src/server/db
COPY --from=builder --chown=node:node /app/src/server/scripts ./src/server/scripts
COPY --from=builder --chown=node:node /app/src/server/resources ./src/server/resources
COPY --from=builder --chown=node:node /app/src/server/types ./src/server/types
COPY --from=builder --chown=node:node /app/src/bot ./src/bot
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node ./scripts/container-start.sh /app/container-start.sh

RUN npm install -g pnpm@10.33.0 \
    && mkdir -p .next db \
    && chown -R node:node .next db /app/container-start.sh \
    && chmod +x /app/container-start.sh

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["/app/container-start.sh"]
