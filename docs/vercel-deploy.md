# Deploy SaaS LMS on Vercel

## Pre-push checklist (GitHub → Vercel)

- **Node:** `package.json` pins `"engines": { "node": "20.x" }` and `.nvmrc` is `20`, so Vercel and local dev stay on the **Node 20** LTS line instead of floating to a new major when `>=20.9.0` was used. To move to Node 22 later, change both and set **Project → Settings → Node.js Version** in Vercel if needed.
- `npm run lint` and `npm test` pass; `npm run build` succeeds (or delete a stale `.next` folder if TypeScript validator errors appear, then rebuild).
- Commit **all** `prisma/migrations/*` folders (Production runs `prisma migrate deploy` during build when `VERCEL_ENV=production`).
- Do **not** commit `.env`, `.env.local`, or secrets — only `.env.example` is tracked.
- After connecting the repo, confirm Vercel **Production** has `DATABASE_URL`, **`DIRECT_URL`** (Supabase), and `JWT_SECRET` (≥16 chars). Set **`NEXT_PUBLIC_APP_URL`** to your canonical public URL (`https://your-custom-domain.com` or `https://your-project.vercel.app`) if you want it fixed in client bundles; if omitted, **Production** server-side links use Vercel’s **`VERCEL_PROJECT_PRODUCTION_URL`** (your primary hostname, including a configured custom domain).
- **Health checks:** `GET /api/health` is a cheap liveness probe (no database). `GET /api/health/ready` runs `SELECT 1` against Postgres — use after deploy or in uptime monitoring to catch bad `DATABASE_URL` / firewall issues early.

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

5. **After the first production deploy**, set `NEXT_PUBLIC_APP_URL` to your canonical URL (custom domain or `https://your-project.vercel.app`) and redeploy if you want that value in client bundles and guaranteed OAuth redirect parity. Server-side links still resolve without it via `VERCEL_PROJECT_PRODUCTION_URL` on Production.

**Note:** CLI deploys do not auto-deploy on `git push`; run `npx vercel` or `npx vercel --prod` again when you change code.

## 3. Optional: Git-connected deploy

If you prefer continuous deploys from a host:

1. Push the repo to GitHub, GitLab, or Bitbucket.
2. In Vercel → **Add New…** → **Project** → **Import** the repository.
3. **Framework Preset:** Next.js. **Build Command** comes from `vercel.json` (`node scripts/vercel-build.mjs`). **Install:** default (`npm install`); `postinstall` runs `prisma generate`.

## Custom domain

1. In Vercel: **Project → Settings → Domains** → add your hostname (e.g. `lms.school.org` or `www.school.org`).
2. At your DNS provider, add the **A** / **CNAME** records Vercel shows until the domain is **Valid**.
3. Set the domain as **production** if Vercel offers multiple domains (so it becomes the primary hostname).

**How the app picks the public URL**

- **`NEXT_PUBLIC_APP_URL`** (Production) — optional but **recommended** for Google OAuth and any code that reads this at build time in the browser. Use your custom origin with **no trailing slash**, e.g. `https://lms.school.org`.
- If unset, **Production** server routes and certificate QR codes use **`VERCEL_PROJECT_PRODUCTION_URL`** (Vercel system variable: primary production host, which becomes your custom domain once assigned). Leave **Automatically expose System Environment Variables** enabled under **Project → Settings → Environment Variables**.
- **Preview** deployments still use the per-deployment **`VERCEL_URL`** so preview links stay on the preview host.

**Google OAuth:** In Google Cloud Console → **Credentials** → your OAuth client, add **Authorized redirect URI** `https://<your-domain>/api/auth/google/callback` (keep a `*.vercel.app` URI too if you still test on the default URL).

## 4. Environment variables

In **Project → Settings → Environment Variables**, add at least:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Supabase **pooler** `postgresql://…:6543/…?pgbouncer=true` (runtime + optional migrate if no `DIRECT_URL`) |
| `DIRECT_URL` | Supabase **direct/session** `postgresql://…:5432/…` — **strongly recommended** for Production so `prisma migrate deploy` during build succeeds |
| `JWT_SECRET` | Long random string (≥32 chars recommended) |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL, no trailing slash (e.g. `https://lms.school.org` or `https://your-project.vercel.app`). **Recommended** for OAuth; optional on Production if you rely on `VERCEL_PROJECT_PRODUCTION_URL` for server-only absolute URLs. **Do not** leave `http://localhost:3000` in Vercel envs—if you do, the app ignores it on Production/Preview for absolute URLs (certificates, OAuth base, etc.) and falls back to Vercel hostnames. |
| `PLATFORM_JWT_SECRET` | Long random, if you use `/platform` |
| `PLATFORM_ADMIN_EMAIL` | Platform operator login email |
| `PLATFORM_ADMIN_PASSWORD` | Platform operator password |
| `BLOB_READ_WRITE_TOKEN` | **Recommended on Vercel:** from **Storage → Blob** in the Vercel dashboard (read-write). Enables persistent uploads (lessons, CMS assets, avatars, etc.). Add to **Production** and **Preview** if previews should upload files. |
| `SKIP_PRISMA_MIGRATE_ON_VERCEL` | Optional **`true`**: skip `prisma migrate deploy` during the Vercel build (use only if you apply migrations yourself in CI or before deploy). |

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
