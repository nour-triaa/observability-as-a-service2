FROM node:20-alpine

WORKDIR /app

# Copie des dépendances d'abord (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copie du code source
COPY index.js .

# Utilisateur non-root pour la sécurité
RUN addgroup -S bridge && adduser -S bridge -G bridge
USER bridge

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "index.js"]
