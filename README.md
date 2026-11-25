# Jeevanam

Rent, loans and expense tracking for a residency / PG owner. React 19 + TypeScript + Vite, Tailwind v4, TanStack Query, Supabase (auth, Postgres, storage) and Capacitor for Android.

## Run locally

```powershell
npm install
npm run dev
```

With no Supabase credentials the app runs in **demo mode**: everything is stored in the browser (`localStorage`).

## Connect Supabase

1. Create a Supabase project and run `supabase/setup-all.sql` in the SQL editor (it is the migrations in `supabase/migrations`, in order).
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Enable the Google provider under Authentication → Providers, and add these redirect URLs: your site URL, `http://localhost:5173/**` and `com.jeevanam.app://login-callback` (Android).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check and production build |
| `npm run lint` | Oxlint |
| `npm test` | Vitest |
| `npx cap sync android` | Copy the build into the Android project |

## Layout

- `src/pages` – one file per route
- `src/features/<area>` – components, hooks, services and types per feature (each service has a demo branch and a Supabase branch)
- `src/components` – shared UI (`ui` = primitives, `common` = app components)
- `src/lib/demo-store.ts` – the local demo database
- `supabase` – migrations and seed
- `server` – optional WhatsApp broadcast server
