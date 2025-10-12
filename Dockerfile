# =========================
# Stage 1: Build
# =========================
FROM oven/bun:latest AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build TypeScript
RUN bun run build

# =========================
# Stage 2: Production
# =========================
FROM oven/bun:latest AS production

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install production dependencies only
RUN bun install --production

# Copy built files
COPY --from=builder /app/dist ./dist

# Set environment variable
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the app
CMD ["bun", "run", "start:prod"]
