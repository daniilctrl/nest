# NestJS Monorepo

Монорепозиторий содержит два приложения:

- `user-service` - основной API сервис с PostgreSQL
- `notification-service` - каркас будущего сервиса уведомлений

И одну общую библиотеку:

- `libs/shared` - общие `utils` и `constants`, переиспользуемые между сервисами

## Требования

- Node.js 20+
- npm
- Docker + Docker Compose

## Переменные окружения

1. Скопируйте `env.example` в `.env`
2. При необходимости заполните значения

## Запуск инфраструктуры

PostgreSQL + MinIO:

```bash
docker compose up -d
```

Redis:

```bash
docker compose -f docker-compose.storage.yml up -d
```

## Установка зависимостей

```bash
npm install
```

## Запуск сервисов

`user-service`:

```bash
npm run start:user-service:dev
```

`notification-service`:

```bash
npm run start:notification-service:dev
```

`user-service` HTTP: `http://localhost:3000`  
Swagger: `http://localhost:3000/api`

## Сборка

```bash
npm run build:user-service
npm run build:notification-service
```

## Что такое Libraries в монорепе

`libs` - это общий код (shared modules/utilities/types), который можно импортировать в разные приложения монорепозитория.

В этом проекте в `libs/shared` вынесены:

- `utils/password.util.ts`
- `utils/money.util.ts`
- `constants/money.constants.ts`

Импорт выполняется через алиас:

```ts
import { hashPassword } from '@app/shared';
```
