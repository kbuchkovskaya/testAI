FROM node:20-alpine

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app code
COPY . .

# Cloud/container platforms inject PORT; local default is fine too
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
