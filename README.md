# AI Decision Copilot для SMM

Платформа поддержки решений для SMM-специалистов: интерпретация метрик, системные гипотезы и AI-ассистент **без** генерации контента и автостратегий.

## Стек

- React 19 + TypeScript + Vite
- Tailwind CSS 4 + компоненты в стиле shadcn/ui
- Supabase (Auth, PostgreSQL, RLS, Edge Functions)
- Recharts, PapaParse, SheetJS (xlsx)
- OpenAI API (только server-side через Edge Function)

## Быстрый старт

### 1. Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. В SQL Editor выполните миграцию: `supabase/migrations/20250601000000_initial_schema.sql`
3. Включите Email auth в Authentication → Providers
4. Скопируйте URL и anon key

### 2. Переменные окружения

```bash
cp .env.example .env
```

Заполните:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 3. Бэкенд API (загрузка проекта + кэш)

```bash
cd server
cp .env.example .env
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (Dashboard → API → service_role)
npm install
npm run dev
```

В корневом `.env`:

```
VITE_API_URL=http://localhost:3001
```

В SQL Editor также выполните `supabase/migrations/20250603000000_perf_indexes.sql`.

`useProject` ходит только в `GET /api/projects/:id/bundle` — **без прямых SQL/RPC с клиента**. Кэш LRU на сервере (по умолчанию 60 с).

### 4. AI (DeepSeek)

1. Зарегистрируйтесь на [platform.deepseek.com](https://platform.deepseek.com), пополните баланс или используйте промо-кредиты (если есть в кабинете).
2. Создайте API key: [API Keys](https://platform.deepseek.com/api_keys).
3. В `server/.env`:

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
AI_MODEL=deepseek-v4-flash
```

Постоянного бесплатного API нет — оплата по токенам; чат на [chat.deepseek.com](https://chat.deepseek.com) бесплатный. Модель `deepseek-v4-flash` — самая дешёвая для продакшена.

### 5. Запуск

Терминал 1 — API:

```bash
cd server && npm run dev
```

Терминал 2 — фронтенд:

```bash
npm install
npm run dev
```

По умолчанию AI в **демо-режиме** (`VITE_USE_MOCK_AI=true`). После `DEEPSEEK_API_KEY` в `server/.env` и перезапуска API:

```env
VITE_USE_MOCK_AI=false
```

## Маршруты

| Путь | Описание |
|------|----------|
| `/login`, `/signup` | Авторизация |
| `/onboarding` | Первый вход: трек + демо-проект |
| `/projects` | Список проектов (макс. 10) |
| `/projects/:id/overview` | Дашборд аналитики |
| `/projects/:id/import` | Импорт CSV/XLSX (LiveDune) |
| `/projects/:id/hypotheses` | Реестр гипотез |
| `/projects/:id/ai` | AI-аналитик и AI-коуч |
| `/projects/:id/report` | Отчёт за период (.md) |

## Демо-проект

При онбординге «Демо-проект» создаётся **Демо: Косметика бренд** — 10 постов, метрики и 2 гипотезы.

## Лицензия

MIT
