# Apply the Awasar update to your deployed project

## Safest method (recommended)

Your current local repository already has a working `package-lock.json`, Supabase setup and Vercel connection. Preserve those.

1. Back up your current folder or commit any current work.
2. Extract `awasar-ui-update.zip`.
3. Copy its files into the root of your existing `damak-ai-job-hunter` folder.
4. Allow Windows to replace matching files.
5. Do **not** delete your existing `package-lock.json`.
6. Run:

```bash
npm run build
```

7. If successful:

```bash
git add .
git commit -m "Rebrand to Awasar and add job-first homepage search"
git pull --rebase origin main
git push origin main
```

Vercel should deploy the push automatically.

## No new environment variables

This UI/search update does not require new secrets. Keep the existing Supabase variables and, if enabled, your server-side Gemini variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `GEMINI_API_KEY` (server-side only)
- `GEMINI_MODEL=gemini-2.5-flash`

## What to test after deployment

1. Homepage shows open vacancies.
2. Search by title/skill/company works.
3. Category and ward filters work.
4. A logged-out user sees Login / Register.
5. A logged-in user sees Dashboard / Logout, not Login / Register.
6. `Find my best matches` opens the AI matching flow.
