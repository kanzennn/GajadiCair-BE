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