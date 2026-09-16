# KINDIX frontend -- Angular app served via nginx
#
# The app's services (chat.service.ts, auth.service.ts, dashboard.service.ts)
# call http://localhost:3000/... directly by hardcoded absolute URL. Those
# requests run in the user's browser, not inside the Docker network, so they
# correctly hit the backend's host-published port -- no nginx proxy/rewrite
# is added here on purpose. This image only serves the static build.

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# ---- Stage 2: runtime ----
FROM nginx:alpine
# @angular/build:application's default output path: dist/<project>/browser
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
