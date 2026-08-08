# Awasar v10 — UI + performance pass

This version treats the supplied Nav.tsx, AI Match page and AIExplanation.tsx as the new baseline and keeps the existing Awasar features.

## Performance changes
- AI Match fetches only the fields needed for matching instead of `select('*')`.
- AI Match evaluates the latest 30 open jobs instead of 50.
- Gemini auto-generates only for the top 2 results; all other cards immediately show deterministic explanations and offer an on-demand AI explanation.
- AI explanations are cached in `sessionStorage` for 12 hours and have an 8-second client timeout.
- Employer applicant Gemini explanations also auto-load only for the top 2 candidates.
- Removed remaining `select('*')` calls from high-traffic profile, apply, job-detail and AI-explanation paths.
- Public homepage query reduced from 80 to 50 vacancies before local filtering.
- Long result cards use CSS `content-visibility:auto` so off-screen cards cost less to paint.
- Auth checks use `getClaims()` on job detail/nudge routes where a verified user id is enough.

## UI changes
- Preserves the Awasar image logo in the navbar.
- Adds Talent to employer navigation.
- Cleaner AI Match summary (jobs checked / strong matches / best score).
- Improved card spacing, hover states, focus states, form controls and mobile layout.
- More readable AI explanations and match reasons.
- Friendlier empty states and action labels.
- Better mobile logo sizing and action touch targets.

No new Supabase migration is required for v10 itself. Keep the v8/v9 migrations already used by the project.
