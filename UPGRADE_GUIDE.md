# Gemini + Performance + UI Upgrade

This upgrade is designed to be copied over your existing working repository. It does **not** require a database migration and it adds **no new npm dependency**.

## What changed

1. **Gemini AI explanations**
   - Replaces the OpenAI integration with Google Gemini.
   - Uses `gemini-2.5-flash` by default.
   - The Gemini API key stays server-side.
   - Match percentages are still deterministic; Gemini only explains the score.

2. **Faster AI Job Hunter**
   - Match cards render immediately without waiting for an LLM.
   - Gemini explanations load separately when the top cards enter the viewport.
   - Explanations are cached in `match_results` for 12 hours when the score is unchanged.
   - Only visible/top results request Gemini automatically; lower results can request it on demand.

3. **Faster employer applicant ranking**
   - Candidate profiles are loaded in batch instead of doing multiple queries per applicant.
   - Gemini no longer blocks the whole applicant page.

4. **Faster application history**
   - Removes the old N+1 query pattern for match results.

5. **Login/navigation consistency**
   - Successful login/register now performs a clean navigation to `/dashboard`, so the server-rendered navigation immediately reflects the authenticated user.
   - Authenticated users who open `/auth` are redirected to `/dashboard`.
   - Navigation is role-aware for Job Seekers, Employers, and Admins.

6. **UI consistency**
   - Unified cards, buttons, typography, auth screen, navigation, spacing, mobile behavior, and Gemini explanation UI.

## Apply to your existing project

Extract/copy the upgrade files into the root of your existing `damak-ai-job-hunter` folder and allow Windows to replace matching files.

Do **not** delete your existing `package-lock.json`.

Then run:

```bat
npm run build
```

If the build succeeds:

```bat
git add .
git commit -m "Add Gemini AI and improve performance and UI"
git push origin main
```

Vercel should deploy the new GitHub commit automatically.

## Add Gemini to Vercel

Create a Gemini API key in Google AI Studio. In Vercel open:

`Project -> Settings -> Environment Variables`

Add:

```text
GEMINI_API_KEY=YOUR_KEY
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEY` must **not** start with `NEXT_PUBLIC_`.

After saving the variables, redeploy once.

## Existing Vercel variables to keep

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
GEMINI_API_KEY
GEMINI_MODEL
```

## Test checklist

1. Log out and log back in. The header should switch from `Login / Register` to role-specific navigation plus your name and Logout.
2. Job Seeker -> AI Hunt. Scores should appear immediately.
3. The first visible matches should show `Gemini AI` and update their explanation without blocking the page.
4. Apply to a job.
5. Employer -> Vacancies -> Applicants. Ranking should appear quickly; Gemini explanations load independently.
6. Refresh AI Hunt. Cached Gemini explanations should return much faster.

## Security note

The browser never receives the Gemini key. `/api/ai/explain` checks the current Supabase session and verifies that a job seeker is requesting their own match, or that an employer owns the vacancy and the candidate actually applied.
