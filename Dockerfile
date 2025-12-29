# # =========================
# # Stage 1: Build
# # =========================
# FROM oven/bun:latest AS builder

# # Set working directory
# WORKDIR /app

# # Copy package files
# COPY package.json bun.lock ./

# # Install dependencies
# RUN bun install

# # Copy source code
# COPY . .

# # Build TypeScript
# RUN bun run build

# # =========================
# # Stage 2: Production
# # =========================
# FROM oven/bun:latest AS production

# WORKDIR /app

# # Copy package files
# COPY package.json bun.lock ./

# # Install production dependencies only
# RUN bun install --production

# # Copy built files
# COPY --from=builder /app/dist ./dist
# COPY --from=builder /app/generated ./generated

# # Set environment variable
# ENV NODE_ENV=production

# # Expose port
# EXPOSE 3000

# # Start the app
# CMD ["bun", "run", "start:prod"]

# ????????
# Step 1: Build stage
FROM oven/bun:latest AS builder

# Set working directory
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

# Copy package.json and package-lock.json
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

RUN bunx prisma generate

RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start:prod"]