# ============================================================
# Smart Parking – Frontend Dockerfile
#
# Build context: project root  (set via docker-compose.yml)
#   context: .
#   dockerfile: frontend/Dockerfile
#
# Stage 1  – Build the Vite/React app with Node 20
# Stage 2  – Serve the compiled assets through nginx:alpine
# ============================================================

# ---- Stage 1: Build ----------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first so this layer is cached
# when only source files change.
COPY frontend/package*.json ./

# Install all deps (dev deps are required for tsc + vite build)
RUN npm ci

# Accept build arg for Google Maps API key (passed from docker-compose)
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

# Copy the full frontend source tree
COPY frontend/ .

# Compile: tsc type-check + vite bundle → /app/dist
RUN npm run build

# ---- Stage 2: Production serve -----------------------------
FROM nginx:1.27-alpine AS production

# Drop the default site
RUN rm -rf /usr/share/nginx/html/* \
    && rm /etc/nginx/conf.d/default.conf

# Copy compiled static assets from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the project nginx config (available because context = root)
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# nginx:alpine base image already sets CMD ["nginx", "-g", "daemon off;"]
