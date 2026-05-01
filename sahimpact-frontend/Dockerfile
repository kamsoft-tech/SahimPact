# Build stage
# Use Debian-based slim image instead of Alpine for better compatibility with Tailwind 4 native bindings
FROM node:20-slim AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
# Remove lockfile and install to fix potential native binding mismatches from Windows/Alpine
RUN rm -rf package-lock.json node_modules && npm install

# Build the app
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
# Copy built static files to Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
