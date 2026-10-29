# One Render Free service: public Next.js server and loopback-only ASP.NET API.
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG RENDER_EXTERNAL_URL
ARG NEXT_PUBLIC_SITE_URL
ENV API_INTERNAL_URL=http://127.0.0.1:8080
ENV NEXT_TELEMETRY_DISABLED=1
RUN NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$RENDER_EXTERNAL_URL}" npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS backend-build
WORKDIR /build
COPY backend/Thesamenot.Api/ backend/Thesamenot.Api/
RUN dotnet publish backend/Thesamenot.Api -c Release -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble
WORKDIR /app
COPY --from=frontend-build /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend-build --chown=app:app /build/frontend/.next/standalone /app/web
COPY --from=frontend-build --chown=app:app /build/frontend/.next/static /app/web/.next/static
COPY --from=frontend-build --chown=app:app /build/frontend/public /app/web/public
COPY --from=frontend-build --chown=app:app /build/frontend/node_modules/sharp /app/web/node_modules/sharp
COPY --from=frontend-build --chown=app:app /build/frontend/node_modules/@img /app/web/node_modules/@img
COPY --from=backend-build --chown=app:app /publish /app/api
COPY --chown=app:app deploy/preview/start.mjs /app/start.mjs
ENV NODE_ENV=production \
    ASPNETCORE_ENVIRONMENT=Preview \
    NEXT_TELEMETRY_DISABLED=1 \
    DOTNET_GCHeapHardLimit=0xC000000 \
    NODE_OPTIONS=--max-old-space-size=192 \
    MALLOC_ARENA_MAX=2
ENV Media__Mode=Disabled Media__SharpModule=/app/web/node_modules/sharp
USER app
EXPOSE 10000
CMD ["node", "/app/start.mjs"]
