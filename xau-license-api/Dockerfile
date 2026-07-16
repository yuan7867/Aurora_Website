FROM node:22-alpine

WORKDIR /app

COPY xau-license-api/package.json xau-license-api/package-lock.json ./
RUN npm ci --omit=dev

COPY xau-license-api/src ./src
COPY xau-license-api/migrations ./migrations

EXPOSE 8000

CMD ["sh", "-c", "npm run migrate && npm start"]
