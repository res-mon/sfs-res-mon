# Multi-stage build Dockerfile for Simple Frontend Stack
# This approach creates a lightweight final image without build dependencies

# STAGE 1: Frontend Build
# Uses Bun for fast dependency installation and frontend asset building
FROM --platform=$BUILDPLATFORM oven/bun:latest AS frontend_builder

# Set the working directory
WORKDIR /app

# Copy package configuration files first for better caching
# This way, dependencies are only re-installed when these files change
COPY bun.lock package.json tsconfig.json vite.config.ts ./

# Copy source code
COPY src/ ./src/

# Install dependencies with Bun (much faster than npm/yarn)
RUN bun install

# Build the frontend assets (creates dist/ folder)
RUN bun run frontend:build

# STAGE 2: Backend Build
# Uses Go to compile the backend service into a static binary
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS backend_builder

# Install necessary system dependencies
RUN apk add --no-cache \
  unzip \
  ca-certificates

# Set the working directory
WORKDIR /app

# Copy Go dependency files first for better caching
COPY go.mod go.sum ./
# Download dependencies separately to leverage Docker layer caching
RUN go mod download

# Copy main Go files and backend code
COPY main.go .
COPY src/backend/ ./src/backend/
# Copy the frontend build artifacts from the previous stage
COPY --from=frontend_builder /app/dist/ ./dist/

# Build the Go application with optimizations:
# - CGO_ENABLED=0: Creates statically linked binary
# - GOOS/GOARCH: Target the specific OS/architecture from build args
# - ldflags="-s -w": Strips debug information to reduce binary size
ARG TARGETOS TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-s -w" -o simple_frontend_stack ./main.go

# STAGE 3: Final Image
# Minimal Alpine image containing only the necessary runtime files
FROM alpine:latest

# Install minimal runtime dependencies
# - unzip: Required for PocketBase's zip features
# - ca-certificates: Required for HTTPS connections
# - wget: Required for health check
# - su-exec: For privilege de-escalation in entrypoint
RUN apk add --no-cache \
  unzip \
  ca-certificates \
  wget \
  su-exec

# Set the working directory
WORKDIR /app

# Create a non-root user to run the application for improved security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create directories for PocketBase data with proper permissions
RUN mkdir -p /app/pb_data /app/pb_public /app/pb_hooks /app/pb_migrations && \
  chown -R appuser:appgroup /app

# Create an entrypoint script to fix permissions at runtime
RUN echo '#!/bin/sh\n\
  # Fix ownership of mounted volumes (running as root)\n\
  chown -R appuser:appgroup /app/pb_data /app/pb_public /app/pb_hooks /app/pb_migrations\n\
  \n\
  # Run the application as appuser\n\
  exec su-exec appuser:appgroup "$@"' > /app/docker-entrypoint.sh && \
  chmod +x /app/docker-entrypoint.sh


# Copy only the compiled binary from the backend build stage
# This keeps the final image small and free of build tools/source code
COPY --from=backend_builder /app/simple_frontend_stack /app/simple_frontend_stack

# Make the binary executable
RUN chmod +x /app/simple_frontend_stack

# Document the port the application uses
EXPOSE 8161

# Set up a health check to verify the application is running correctly
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8161/ || exit 1

# Define volumes for persistent data
VOLUME ["/app/pb_data", "/app/pb_public", "/app/pb_hooks", "/app/pb_migrations"]

# Define the entrypoint and command to run the application
# Note: We don't use USER appuser because entrypoint needs to start as root
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/simple_frontend_stack", "serve", "--http=0.0.0.0:8161"]

# Build this image with:
# docker build -t simple-frontend-stack .
#
# Run this image with:
# docker run -p 8161:8161 simple-frontend-stack
#
# For data persistence, mount volumes:
# docker run -p 8161:8161 \
#   -v ./pb_data:/app/pb_data \
#   -v ./pb_public:/app/pb_public \
#   -v ./pb_hooks:/app/pb_hooks \
#   -v ./pb_migrations:/app/pb_migrations \
#   simple-frontend-stack
#
# Pass environment variables for configuration:
# docker run -p 8161:8161 -e APP_ENV=production -e DEBUG=false simple-frontend-stack
#
# For multi-architecture builds use:
# docker buildx build --platform linux/amd64,linux/arm64 -t simple-frontend-stack . --push
