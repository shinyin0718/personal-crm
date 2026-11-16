# Self-hosted image: `docker compose up` (see README).
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads
# Prisma CLI is kept so the container can apply migrations on start.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY prisma ./prisma
COPY prisma.config.ts package.json ./
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
