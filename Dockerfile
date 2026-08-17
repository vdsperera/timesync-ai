# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for deterministic install
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:20-alpine AS runtime

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Set Node environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY server.js ./
COPY public ./public

# Run as a non-root user for security
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Health check using the internal endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application using dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
