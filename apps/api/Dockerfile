# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Étape 1 — dépendances complètes et compilation
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Les manifestes d'abord : le cache de couches survit à un changement de code.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspaces --include-workspace-root

COPY packages/core packages/core
COPY apps/api apps/api

RUN npm run build --workspace @workpulse/core \
 && npm run prisma:generate --workspace @workpulse/api \
 && npm run build --workspace @workpulse/api

# ---------------------------------------------------------------------------
# Étape 2 — dépendances de production seulement
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace @workpulse/api --include-workspace-root
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma

# ---------------------------------------------------------------------------
# Étape 3 — image finale, sans outils de compilation
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache tini \
 && addgroup -S workpulse && adduser -S workpulse -G workpulse

COPY --from=deps  --chown=workpulse:workpulse /app/node_modules      node_modules
COPY --from=deps  --chown=workpulse:workpulse /app/packages/core     packages/core
COPY --from=build --chown=workpulse:workpulse /app/apps/api/dist     apps/api/dist
COPY --from=build --chown=workpulse:workpulse /app/apps/api/prisma   apps/api/prisma
COPY --chown=workpulse:workpulse apps/api/package.json apps/api/package.json
COPY --chown=workpulse:workpulse package.json package.json

USER workpulse
EXPOSE 3000

# La sonde de vie fait foi : le conteneur ne sera pas jugé sain sans réponse.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini récolte les processus orphelins : sans lui, l'arrêt propre du conteneur
# laisserait des connexions PostgreSQL ouvertes.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
