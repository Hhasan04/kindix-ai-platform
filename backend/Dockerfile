# KINDIX backend -- NestJS API
#
# Multi-stage build: compile TypeScript in a full node_modules stage, then
# ship only the production dependencies + compiled dist/ in the runtime image.
#
# IMPORTANT: this image does NOT run migrations on startup. `npm run
# migration:run` is a manual/CI step (see /docs) -- baking it into CMD would
# race every time you scale to >1 backend container, or restart the
# container, and re-run migrations against a database that's already
# mid-migration or already up to date. Run migrations explicitly instead.

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
