# Mission Control agent-server daemon — Node 22, TS build, SQLite (better-sqlite3).
# Build context is the agent-server/ directory (Coolify base_directory=/agent-server).
# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
# Toolchain for better-sqlite3's native addon. Prebuilt binaries usually resolve,
# but keep the compiler available so `npm install` never fails on a cache miss.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/agent-server

# ---- deps: install everything (dev deps needed for the tsc build) ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- build: compile TypeScript to dist/ ----
FROM base AS build
COPY --from=deps /app/agent-server/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
# Reachable by the Traefik reverse proxy on the Docker network (see MC_SERVER_HOST).
ENV MC_SERVER_HOST=0.0.0.0
WORKDIR /app/agent-server
COPY --from=build /app/agent-server/node_modules ./node_modules
COPY --from=build /app/agent-server/dist ./dist
COPY package.json ./package.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p store
EXPOSE 3099
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
