FROM node:23-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV LISTEN_HOST=0.0.0.0
EXPOSE 3200

CMD ["node", "server.js"]
