# Supabase Postgres (Prisma)

This app uses **Prisma** with **`pg`** and **`@prisma/adapter-pg`**. You do **not** need `@supabase/supabase-js` for the main LMS database (unless you add Supabase Auth or Storage APIs separately).

## Connection strings

1. **Supabase Dashboard → Project Settings → Database**

2. **`DATABASE_URL`** — **Transaction pooler** (IPv4 or dedicated pooler), port **6543**.  
   Add `pgbouncer=true` if not in the URI. Example shape:

   `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`

3. **`DIRECT_URL`** — **Session mode** or **direct** connection, port **5432** (for `prisma migrate deploy` and `prisma migrate dev`). See [Supabase: Prisma](https://supabase.com/docs/guides/database/prisma).

Set both in Vercel **Production** (and locally in `.env` / `.env.local`).

## First-time schema

```bash
npx prisma migrate deploy
npm run db:seed   # optional demo data
```

## Moving data from old MySQL

There is **no automatic** migration in this repo. Options:

- Re-seed / recreate content, or  
- Use a migration tool (e.g. **pgloader**, ETL, or export/import per table) with careful type and enum mapping.
