**Live app:** [https://saas-lms-khaki.vercel.app/](https://saas-lms-khaki.vercel.app/)  
**Designed by** CcMaurice, aka SkillTech

# SaaS LMS

Multi-tenant **learning management system**: schools (organizations) on shared infrastructure, with a separate **platform operator** console, per-school member apps, and optional public marketing pages.

## Documentation

- **[Application guide (features, routes, login)](docs/APP-GUIDE.md)** — full itinerary of areas, roles, demo accounts, and how to save that document as PDF from your browser.
- **[Porting prompt (logic to another stack)](docs/PORTING-PROMPT.md)** — copy-paste prompt to reuse assessment, gradebook, reporting, and education-level logic elsewhere.

## Quick start

```bash
npm install
# Configure .env — at minimum DATABASE_URL and JWT/session secrets (see docs/APP-GUIDE.md §6)
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo school login:** slug `demo-school`, seeded users such as `admin@test.com` / `password123` (change for anything beyond local dev). In development only, `GET /api/dev/quick-login` signs you in as the demo admin.

**Platform console:** set `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` in `.env`, then open `/platform/login`.

## Tech stack

Next.js (App Router), React, TypeScript, PostgreSQL, Prisma, Tailwind CSS.

## Scripts

| Command | Description |
|--------|----------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run db:deploy` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo org and users |
| `npm run db:studio` | Prisma Studio |
| `npm test` | Run tests |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
