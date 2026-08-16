# Multi-stage Dockerfile for 24/7 Cloud Deployment
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm matching package.json version
RUN npm install -g pnpm@10.30.3

# Install all dependencies (including devDependencies for build)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copy source code and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm exec tsc

# Prune devDependencies to keep image lean
RUN pnpm prune --prod

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy pruned production dependencies and compiled JavaScript
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "dist/index.js"]
