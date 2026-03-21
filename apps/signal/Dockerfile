FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm

COPY package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000
CMD ["node", "dist/index.js"]
