# ApexFit AI

ApexFit AI is an India-first fitness and nutrition web app built with Next.js, Firebase Realtime Database, Firebase Authentication, and Groq. It includes structured workouts, nutrition tracking, hydration, adaptive insights, optional camera guidance, Arena features, and a server-side AI coach.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A Firebase project
- A Groq API key for the AI Coach and optional food scanning
- Vercel or another Node-compatible deployment target for production

## Local setup

```bash
npm ci
cp .env.example .env.local
# Fill in .env.local; never commit it.
npm run check-env
npm run dev
```

Open <http://localhost:3000>. The production checks are:

```bash
npm run typecheck
npm test
npm run build
```

Use `npm run check-env:production` before a production deployment. It reports only missing variable names and never prints secret values.

## Firebase setup

1. Create a Firebase project and register a Web app.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Enable Google Sign-In only if you want the Google button enabled.
4. Create a **Realtime Database** in the required region.
5. Copy the web configuration into the `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local` and Vercel.
6. Create a Firebase service account and add its project ID, client email, and private key to the server-only `FIREBASE_ADMIN_*` variables.
7. Deploy the database rules from this repository:

```bash
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only database
```

The Firebase Admin private key must preserve newlines. In Vercel, paste it as a single value containing escaped `\\n` sequences; the server converts them back to line breaks.

## Environment variables

### Required in the browser

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Required for server API routes in production

```env
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
GROQ_API_KEY_PRIMARY=
```

### Optional

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED=true
GROQ_API_KEY_SECONDARY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_ENABLED=false
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_POSE_WASM_URL=
NEXT_PUBLIC_POSE_MODEL_URL=
```

Set `NEXT_PUBLIC_SITE_URL` to the real HTTPS origin in production so Open Graph, robots, and sitemap metadata do not use `localhost`.

Food-photo analysis is intentionally disabled until `GROQ_VISION_ENABLED=true` and a compatible Groq vision key/model are configured. The camera features require HTTPS and explicit browser permission; camera frames are processed locally and are not uploaded by the app.

## Health and troubleshooting

`GET /api/health` returns a safe configuration summary. It never returns keys or private key values. A `200` response means the core Firebase client/Admin configuration is present; a `503` response means the deployment is incomplete.

Common errors:

- `Configuration required`: one or more Firebase web variables are missing or the app was not redeployed after adding them.
- `AUTH_NOT_CONFIGURED`: Firebase Admin variables are missing or the private key formatting is invalid.
- `GROQ_NOT_CONFIGURED`: add `GROQ_API_KEY_PRIMARY` or the fallback key.
- Google `operation-not-allowed`: enable the Google provider in Firebase Authentication.
- Database permission denied: verify the database URL, signed-in user, and deployed `realtime-database.rules.json`.
- Camera unavailable: use an HTTPS URL, allow camera permission, and close other camera apps/tabs.

## Project structure

- `src/app`: routes, layouts, API handlers, error recovery, metadata
- `src/components`: reusable UI and feature components
- `src/lib/auth`: Firebase Auth provider and auth error mapping
- `src/lib/db`: client-side Realtime Database reads and writes
- `src/lib/firebase`: browser and server Firebase initialization
- `src/lib/arena`: server-authoritative competition logic
- `src/lib/ai`: Groq integration, validation, and rate limiting
- `src/lib/core`, `src/lib/health`, `src/lib/workouts`, `src/lib/pose`: deterministic domain logic
- `realtime-database.rules.json`: Firebase security rules

## Security notes

Never commit `.env.local`, service account JSON files, private keys, or API keys. Firebase web configuration is public by design, but access control comes from Authentication and database rules. Server-only credentials must never use the `NEXT_PUBLIC_` prefix.
