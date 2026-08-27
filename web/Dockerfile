# Dashboard service: Next.js, served by its own Node server (standalone output).
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# ---- build ----
FROM base AS build
# NEXT_PUBLIC_MANAGER_URL must be provided at build time (Vercel/Railway env).
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime ----
FROM base AS runner
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
