# Deploy SaaS LMS on Vercel

## Pre-push checklist (GitHub → Vercel)

- `npm run lint` and `npm test` pass; `npm run build` succeeds (or delete a stale `.next` folder if TypeScript validator errors appear, then rebuild).
- Commit **all** `prisma/migrations/*` folders (Production runs `prisma migrate deploy` during build when `VERCEL_ENV=production`).
- Do **not** commit `.env`, `.env.local`, or secrets — only `.env.example` is tracked.
- After connecting the repo, confirm Vercel **Production** has `DATABASE_URL`, **`DIRECT_URL`** (Supabase), `JWT_SECRET` (≥16 chars), and `NEXT_PUBLIC_APP_URL` matching your deployment URL.

Vercel runs **Next.js** well. The app uses **PostgreSQL** via **Prisma** and the **`pg`** driver (Supabase-compatible). The database must be reachable from Vercel’s build (migrations) and serverless runtime.

## 1. Create a Supabase (or other Postgres) database

Recommended: **[Supabase](https://supabase.com)** — create a project, then in **Project Settings → Database**:

- **`DATABASE_URL` (runtime):** use the **Transaction pooler** URI (port **6543**). Ensure the query string includes **`pgbouncer=true`** (and **`sslmode=require`** if not already present). See [Prisma + Supabase](https://supabase.com/docs/guides/database/prisma).
- **`DIRECT_URL` (migrations):** use the **direct** or **session** connection (port **5432**) so `prisma migrate deploy` can use advisory locks. **`prisma.config.ts`** uses `DIRECT_URL` when set, otherwise falls back to `DATABASE_URL`.

Local alternative: `docker compose up postgres adminer -d` and `npm run db:bootstrap` (see `.env.example`).

Apply the schema:

- Either let **Vercel’s production build** run migrations (`prisma migrate deploy` when `VERCEL_ENV=production` via `scripts/vercel-build.mjs`), **or**
- Run `npx prisma migrate deploy` yourself (with `DIRECT_URL` or a direct `DATABASE_URL`) before the first deploy. **Preview** deployments skip migrate by default.

Optional: seed demo data once (from your machine, with `DATABASE_URL` pointing at the cloud DB):

`npx tsx prisma/seed.ts`

## 2. CLI-only deploy (no Git)

Use this when you do **not** connect a Git provider. Each deploy uploads your **current local directory** (respecting `.vercelignore` if you add one).

1. **Install / run CLI** (from the project root, e.g. `c:\saasLMS`):

   `npx vercel login`

   Complete the browser or device-code flow when prompted.

2. **Link the folder to Vercel** (creates `.vercel/` — already listed in `.gitignore`):

   `npx vercel link`

   - Pick your account or team (e.g. **ccmaurices-projects**).
   - Create a **new** project or link an existing one.
   - Confirm settings; `vercel.json` supplies the build command (`node scripts/vercel-build.mjs`).

3. **Set environment variables** (required before a successful build). Either:

   - **Dashboard:** Project → **Settings** → **Environment Variables**, or  
   - **CLI:** `npx vercel env add DATABASE_URL` (repeat per variable; choose Production / Preview / Development when asked).

   Use the same names as in [§4](#4-environment-variables) below (at minimum `DATABASE_URL`, **`DIRECT_URL` on Supabase for production builds**, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, and `BLOB_READ_WRITE_TOKEN` for uploads).

4. **Deploy**

   - Preview: `npx vercel`  
   - Production: `npx vercel --prod`

5. **After the first production deploy**, set `NEXT_PUBLIC_APP_URL` to your real production URL (e.g. `https://your-project.vercel.app`) and redeploy if OAuth or absolute links depend on it.

**Note:** CLI deploys do not auto-deploy on `git push`; run `npx vercel` or `npx vercel --prod` again when you change code.

## 3. Optional: Git-connected deploy

If you prefer continuous deploys from a host:

1. Push the repo to GitHub, GitLab, or Bitbucket.
2. In Vercel → **Add New…** → **Project** → **Import** the repository.
3. **Framework Preset:** Next.js. **Build Command** comes from `vercel.json` (`node scripts/vercel-build.mjs`). **Install:** default (`npm install`); `postinstall` runs `prisma generate`.

## 4. Environment variables

In **Project → Settings → Environment Variables**, add at least:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Supabase **pooler** `postgresql://…:6543/…?pgbouncer=true` (runtime + optional migrate if no `DIRECT_URL`) |
| `DIRECT_URL` | Supabase **direct/session** `postgresql://…:5432/…` — **strongly recommended** for Production so `prisma migrate deploy` during build succeeds |
| `JWT_SECRET` | Long random string (≥32 chars recommended) |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` (no trailing slash) |
| `PLATFORM_JWT_SECRET` | Long random, if you use `/platform` |
| `PLATFORM_ADMIN_EMAIL` | Platform operator login email |
| `PLATFORM_ADMIN_PASSWORD` | Platform operator password |
| `BLOB_READ_WRITE_TOKEN` | **Recommended on Vercel:** from **Storage → Blob** in the Vercel dashboard (read-write). Enables persistent uploads (lessons, CMS assets, avatars, etc.). Add to **Production** and **Preview** if previews should upload files. |

Optional: `OPENAI_API_KEY`, `GOOGLE_*`, `RESEND_*`, `GEMINI_*`, `PG_POOL_MAX`, etc., as in `.env.example`.

**Google OAuth:** add your Vercel URL + `/api/auth/google/callback` to authorized redirect URIs in Google Cloud Console.

Redeploy after changing env vars.

## 5. File uploads (Vercel Blob)

The app uses **`@vercel/blob`** when `BLOB_READ_WRITE_TOKEN` is set: uploaded files are stored in Blob and the database keeps the public `https://…blob.vercel-storage.com/…` URL. Without the token, uploads use the local `UPLOAD_DIR` path, which is **ephemeral** on Vercel and unsuitable for production.

1. In the Vercel project, open **Storage** → create or select a **Blob** store.
2. Link it to the project and copy the **Read/Write** token into `BLOB_READ_WRITE_TOKEN` for the environments you need (at minimum **Production**).

## 6. Other limitations on Vercel

- **Platform in-app DB dump/restore** targets legacy **MySQL** only. For Supabase, use **Database → Backups** or `pg_dump` / `psql` from a trusted environment.

## 7. After deploy

Open your production URL, register or log in, and confirm DB connectivity. If the build fails on `prisma migrate deploy`, set **`DIRECT_URL`** to a non-pooler Postgres URL, confirm `DATABASE_URL` / firewall, and check the Prisma error above the stack trace in the build log.
