# People — a personal CRM

Remember the people you meet. Snap a business card, check the details the AI read off it, and log
every time you meet someone (when, where, what you talked about).

- **Accounts**: email + password, optionally "Sign in with Google". Every row has a `user_id` and every query filters on it, so each account sees only its own contacts.
- **Card scanning**: photo → vision AI (Gemini, GPT-4o or Claude) → pre-filled form → you confirm → saved.
- **People list** with search and filters (name, company, event, date met, tag); **person page** with contact info and a timeline of meetings.
- **Tags**, **export** to CSV or vCard (Account page), installable on phones (PWA manifest).
- LinkedIn is stored as a URL only; there is no LinkedIn API integration.

Stack: Next.js 16 (App Router) · Tailwind CSS 4 · Postgres · Prisma 7 · Auth.js v5.

## Local development

Needs Node 24 and Docker (for Postgres).

```bash
docker run -d --name crm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=crm -p 5432:5432 postgres:17
cp .env.example .env            # then set AUTH_SECRET (npx auth secret), GEMINI_API_KEY,
                                # and ALLOW_PASSWORD_SIGNUP=true unless you set up Google sign-in
npm install
npx prisma migrate dev          # create tables
npm run db:seed                 # optional demo data: demo@example.com / demo-password
npm run dev                     # http://localhost:3000
```

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Configuration

All settings are environment variables; see [`.env.example`](.env.example).

| Setting | What it does |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Postgres. On Neon use the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL` (used by migrations). |
| `AUTH_SECRET` | Required. Signs session cookies. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google sign-in, which is how new accounts are created (Google has verified the email). Redirect URI: `https://<your-domain>/api/auth/callback/google`. See [Google sign-in setup](#google-sign-in-setup). |
| `ALLOW_PASSWORD_SIGNUP` | `true` also allows email + password sign-up. Off by default because it can't prove the email is theirs, so `SIGNUP_ALLOWLIST` could be bypassed. Existing password accounts can always sign in. |
| `VISION_PROVIDER` | `gemini` (default, has a free tier), `openai` (GPT-4o) or `anthropic` (Claude). Set the matching `*_API_KEY`. |
| `SIGNUP_ALLOWLIST` | Who may create an account: comma-separated emails and/or `@domain` entries. Empty means anyone can sign up, so set it on a public deployment. Applies to Google sign-in too. |
| *(login limit)* | Built in, no setting: 5 wrong passwords per email, or 30 per IP address, within 15 minutes blocks further tries until the window passes. Behind your own proxy, make sure it sets `X-Forwarded-For`; Vercel does this for you. |
| `SCAN_DAILY_LIMIT` | Card reads (uploads + retries) per account per 24 hours, to protect your AI key. Default `20`. |
| `GEMINI_MODELS` | Comma-separated Gemini models tried in order when one is busy or out of quota. |
| `S3_*` | Any S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO). Card photos are private and served through the app only to their owner. |
| `UPLOAD_DIR` | Used when `S3_BUCKET` is empty: photos are saved to this folder (self-hosting only; Vercel's disk is not persistent). |

The prompt that tells the AI how to read a card is in [`src/lib/vision/parse.ts`](src/lib/vision/parse.ts).

## Deploy: Vercel + Neon

1. Create a database at [neon.tech](https://neon.tech) (free tier). Copy the **pooled** and **direct** connection strings.
2. Create an S3-compatible bucket for card photos, e.g. Cloudflare R2 (free tier): make a bucket and an API token with read/write access to it.
3. On [vercel.com/new](https://vercel.com/new), import this repo. Under **Environment Variables** add `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `GEMINI_API_KEY` (or another provider's key), `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (see below), `SIGNUP_ALLOWLIST` (your email), and the `S3_*` values.
4. In **Settings → Build and Deployment**, set the Build Command to `npm run vercel-build` (runs database migrations, then builds).
5. Deploy.

## Google sign-in setup

1. At [console.cloud.google.com](https://console.cloud.google.com), create a project (free).
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your email, and add yourself as a test user (or publish the app).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**: type *Web application*; add `https://<your-domain>/api/auth/callback/google` under *Authorized redirect URIs* (and `http://localhost:3000/api/auth/callback/google` for local dev).
4. Copy the client ID and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

## Self-host with Docker

```bash
cp .env.example .env     # set AUTH_SECRET, an AI key, and Google sign-in keys
                         # (or ALLOW_PASSWORD_SIGNUP=true); S3 is optional
POSTGRES_PASSWORD=pick-a-password docker compose up -d --build
```

This starts Postgres and the app on port 3000. Migrations run on every start. Without `S3_BUCKET`,
card photos are stored in the `uploads` Docker volume. Put a reverse proxy with HTTPS (Caddy, nginx,
Traefik) in front for a public server, and set `AUTH_URL` to its public address.
