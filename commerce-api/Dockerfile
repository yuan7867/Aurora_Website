FROM node:22-alpine

WORKDIR /app

COPY commerce-api/package.json ./
COPY commerce-api/package-lock.json ./
RUN npm ci --omit=dev

COPY commerce-api/src ./src
COPY commerce-api/migrations ./migrations

ENV NODE_ENV=production
EXPOSE 8080

CMD ["sh", "-c", "npm run migrate && exec npm start"]
