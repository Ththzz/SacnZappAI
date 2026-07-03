# ScanZapp AI

Next.js application for food scanning, nutrition tracking, hydration tracking, and AI-assisted health chat.

## Local development

The local setup continues to use the ignored SQLite database under `data/`.

```bash
npm install
npm run db:sqlite:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm test
npm run lint
npm run build
```

## Production deployment

Production uses Supabase PostgreSQL and Vercel. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for connection setup, migrations, environment variables, preview verification, and production promotion.
