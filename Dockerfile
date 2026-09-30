FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY data ./data
COPY scripts ./scripts
COPY render.yaml ./render.yaml

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
