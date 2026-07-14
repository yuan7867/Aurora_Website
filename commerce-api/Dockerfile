FROM node:22-alpine

WORKDIR /app

COPY commerce-api/package.json ./
COPY commerce-api/src ./src

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "src/server.js"]
