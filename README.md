# WorkSync Attendance Tracker

Cleaned project package.

## What was fixed

The original download was a compressed Linux workspace archive with unnecessary builder files, logs, screenshots, upload folders, and a hardcoded database path. This cleaned version keeps the actual Next.js app source, Prisma schema, and public assets.

## Run locally

1. Install Node.js 20 or newer.
2. Extract this ZIP.
3. Open a terminal inside the extracted folder.
4. Run:

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

5. Open:

```text
http://localhost:3000
```

## Database

This package currently uses local SQLite:

```env
DATABASE_URL="file:../db/custom.db"
```

Create the local database from the Prisma schema:

```bash
npm run db:push
```

For Supabase later, this app will need database migration from SQLite to PostgreSQL and API validation changes where needed. Do not just paste the Supabase URL into this project and expect everything to be production-ready without testing migrations.

## Main folders

```text
src/        App pages, API routes, screens, UI components
prisma/     Prisma schema
db/         Local SQLite database
public/     Logo and public assets
```
