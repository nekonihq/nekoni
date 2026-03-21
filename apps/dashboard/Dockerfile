FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
