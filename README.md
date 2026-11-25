# Jeevanam

Rent, loans and expense tracking for a residency / PG owner. React 19 + TypeScript + Vite, Tailwind v4, TanStack Query, Supabase (auth, Postgres, storage) and Capacitor for Android.

## Run locally

```powershell
npm install
npm run dev
```

## Set up Supabase (required)

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

## Build the Android app (APK)

Needs Android Studio (for the SDK and Java). From the project folder:

```powershell
$env:VITE_WHATSAPP_SERVER_TOKEN = ''   # keep the PC server token out of the app
npm run build
npx cap sync android
cd android
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat assembleRelease
```

The signed APK is `android/app/build/outputs/apk/release/app-release.apk`. Signing uses
`android/keystore.properties` and `android/jeevanam-release.jks` (both gitignored — back
them up, because updates must be signed with the same key). Raise `versionCode` in
`android/app/build.gradle` for every new release.

On the phone, Broadcast opens WhatsApp with each tenant's message ready; the PC WhatsApp
server (`server/`) is only used from the browser version.

## Layout

- `src/pages` – one file per route
- `src/features/<area>` – components, hooks, services and types per feature (services talk to Supabase)
- `src/components` – shared UI (`ui` = primitives, `common` = app components)
- `supabase` – migrations and seed
- `server` – optional WhatsApp broadcast server
