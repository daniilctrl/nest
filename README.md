# User Service (NestJS)

## Requirements

- Node.js 20+
- npm
- Docker + Docker Compose

## Environment Variables

1. Copy `env.example` to `.env`.
2. Fill values if needed.

## Run Infrastructure

PostgreSQL + MinIO:

```bash
docker compose up -d
```

Redis:

```bash
docker compose -f docker-compose.storage.yml up -d
```

## Install and Run App

```bash
npm install
npm run start:dev
```

App: `http://localhost:3000`  
Swagger: `http://localhost:3000/api`

## Scripts

- `npm run build` - build project
- `npm run start:dev` - start in watch mode
- `npm run lint` - run ESLint with `--fix`
- `npm test` - unit tests
- `npm run test:e2e` - e2e tests
- `npm run test:all` - unit + e2e tests
