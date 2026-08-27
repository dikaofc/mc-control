# Dashboard service (standalone two-service mode): build a static export,
# serve it with nginx. Talks to the manager via NEXT_PUBLIC_MANAGER_URL (build-time).
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# NEXT_PUBLIC_MANAGER_URL is injected by Railway at build time.
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/out /usr/share/nginx/html
# SPA fallback so client-side routes (/project?id=...) resolve to index.html.
RUN printf 'server {\n  listen 3000;\n  root /usr/share/nginx/html;\n  location /api { return 404; }\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 3000
