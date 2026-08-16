# Multi-stage Dockerfile for 24/7 Cloud Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN pnpm exec tsc

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy compiled files and data volume
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
