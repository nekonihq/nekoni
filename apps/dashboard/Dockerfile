FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

# Copy workspace manifests and lockfile first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/dashboard/package.json ./apps/dashboard/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/dashboard/ ./apps/dashboard/

RUN pnpm --filter @nekoni/shared-types build
RUN pnpm --filter @nekoni/dashboard build

FROM nginx:alpine
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
