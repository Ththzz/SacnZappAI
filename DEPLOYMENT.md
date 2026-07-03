# Supabase + Vercel deployment

## Architecture

- Next.js and Node.js functions run on Vercel.
- Prisma connects to Supabase PostgreSQL.
- `DATABASE_URL` is the Supavisor transaction pooler URL used by application traffic.
- `DIRECT_URL` is the direct or session pooler URL used by Prisma migrations.
- Local development can continue using SQLite when `DATABASE_URL` is absent.

The generated production Prisma schema is derived from `prisma/schema.prisma` by `scripts/prisma-schema.mjs`. Do not edit `prisma/schema.postgresql.prisma`; it is intentionally ignored.

## 1. Create the Supabase database

1. Create a Supabase project in a region close to the Vercel function region.
2. In **Connect**, copy:
   - Transaction pooler URL, port `6543`.
   - Direct URL or session pooler URL, port `5432`.
3. For production, create a dedicated Prisma database role by following the official [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma).
4. If the application uses Prisma exclusively, consider disabling the Supabase Data API. Do not expose the Prisma role credentials to browser code.

Create an uncommitted `.env` file for Prisma CLI commands:

```dotenv
DATABASE_URL="postgresql://postgres.dhhqdvnrhybcyegvhnik:PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.dhhqdvnrhybcyegvhnik:PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
QWEN_API_KEY="..."
QWEN_MODEL="qwen/qwen3.7-plus"
NEXT_PUBLIC_AI_MODEL="qwen/qwen3.7-plus"
```

Use the exact URLs supplied by Supabase and URL-encode special characters in the password.

## 2. Apply the database schema

The initial PostgreSQL migration is committed under `prisma/migrations`.

```bash
npm run db:generate
npm run db:migrate
```

Verify migration state:

```bash
npx prisma migrate status --schema prisma/schema.postgresql.prisma
```

Do not run the SQLite migration script against Supabase. `npm run db:sqlite:migrate` is local-only.

The new Supabase database starts empty. Do not run `npm run db:seed` in production unless demo accounts are intentionally required.

To create the first production admin, register that account through the normal user sign-up flow, then run this trusted CLI command with production database credentials:

```bash
ADMIN_EMAIL="owner@example.com" npm run admin:promote
```

There is intentionally no public admin sign-up option.

## 3. Configure Vercel

Import the Git repository as a Next.js project. Add these variables to both Preview and Production:

- `DATABASE_URL`
- `DIRECT_URL`
- `QWEN_API_KEY`
- `QWEN_MODEL`
- `NEXT_PUBLIC_AI_MODEL`
- `AI_BASE_URL` if using a non-default AI endpoint

Public sign-up always creates a regular user and has no admin sign-up secret or alternate admin mode.

Vercel runs `postinstall`, which generates the PostgreSQL Prisma Client whenever `DATABASE_URL` is PostgreSQL. The build intentionally fails if required production secrets are missing.

## 4. Preview verification

Deploy a Preview first and verify:

```bash
DEPLOYMENT_URL="https://your-preview.vercel.app" npm run deploy:smoke
```

If Vercel Deployment Protection is enabled, also set `VERCEL_AUTOMATION_BYPASS_SECRET`.

1. Sign up creates a regular user and redirects to onboarding.
2. Sign in restores the database-backed session.
3. Profile changes persist after a new browser session.
4. Food scan accepts an optimized image up to 3 MB.
5. Meal and water entries persist.
6. AI chat streams and conversation history reloads.
7. Admin routes reject regular users.
8. Function logs contain no database connection, payload, or timeout errors.

## 5. Production promotion

After Preview passes:

1. Apply migrations to the production Supabase project with `npm run db:migrate`.
2. Confirm Production environment variables point to the production project.
3. Promote the verified deployment.
4. Monitor Vercel function errors and Supabase connection usage.

Supabase recommends transaction pooling for temporary serverless clients and direct/session connections for migrations: [connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
