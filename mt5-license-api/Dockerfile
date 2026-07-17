FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY mt5-license-api/package.json mt5-license-api/package-lock.json ./
RUN npm ci --omit=dev

COPY mt5-license-api/src ./src
COPY mt5-license-api/migrations ./migrations

EXPOSE 8000

CMD ["sh", "-c", "npm run migrate && exec npm start"]
