# WorkSync Attendance Tracker

Cleaned project package.

## What was fixed

The original download was a compressed Linux workspace archive with unnecessary builder files, logs, screenshots, upload folders, and a hardcoded database path. This cleaned version keeps the actual Next.js app source, Prisma schema, and public assets.

## Run locally

1. Install Node.js 20 or newer.
2. Extract this ZIP.
3. Open a terminal inside the extracted folder.
4. Copy `.env.example` to `.env.local` and fill in your Google OAuth values.
5. Run:

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

6. Open:

```text
http://localhost:3000
```

## Google OAuth

WorkSync uses NextAuth with the Google provider. Create a Google OAuth Web Client in Google Cloud Console and add these authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://work-sync-two.vercel.app/api/auth/callback/google
```

Set these variables locally and in Vercel:

```env
NEXTAUTH_URL="https://work-sync-two.vercel.app"
NEXTAUTH_SECRET="replace-with-a-random-secret"
GOOGLE_CLIENT_ID="replace-with-google-client-id"
GOOGLE_CLIENT_SECRET="replace-with-google-client-secret"
WORKSYNC_ALLOWED_EMAILS="you@example.com"
```

`WORKSYNC_ALLOWED_EMAILS` is optional. Leave it empty to allow any verified Google account, or add a comma-separated list to restrict access.

## Database

The Prisma schema is kept for project compatibility and generated client setup:

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
