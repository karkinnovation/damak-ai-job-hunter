# Security notes

This repository is hardened for a hackathon MVP. No web application should be described as perfectly secure, and a real public launch should receive an independent security/privacy review.

## Implemented

- Supabase Auth with server-side cookie handling (`@supabase/ssr`).
- Server authorization uses a validated user (`getUser`) and database RLS remains the final authorization boundary.
- PostgreSQL Row Level Security on every private application table.
- Role checks on protected server actions.
- Signup only permits `job_seeker` or `employer`; `admin` cannot be selected publicly.
- Database trigger blocks authenticated users from changing their own role.
- Candidate profiles are visible only to the candidate, admins, and employers whose jobs the candidate applied to.
- Employer write policies require ownership of the business/job.
- Duplicate applications are prevented at database level.
- Gemini API key is server-only and must never use a `NEXT_PUBLIC_` prefix.
- AI receives only job-relevant matching fields, not email/phone/name.
- Zod validation bounds strings, salary, hours, coordinates, wards and list sizes.
- Basic security response headers are configured.
- No raw HTML rendering of user-entered job descriptions.
- AI never performs automatic rejection/hiring.

## Configure before public use

- Enable Supabase email confirmation.
- Enable CAPTCHA/bot protection.
- Use custom production SMTP.
- Configure Supabase Auth rate limits.
- Add a shared production rate limiter for expensive AI actions.
- Add a strict Content-Security-Policy after confirming production domains.
- Enable dependency/vulnerability scanning.
- Add structured audit logging and alerting.
- Add privacy consent, retention, export and deletion flows.
- Add backups/recovery testing.
- Review Nepal employment/privacy/legal obligations.
- Pen-test authorization boundaries and IDOR cases before launch.

## Secrets

Never commit `.env.local`. Never expose a Supabase service-role/secret key in `NEXT_PUBLIC_*`. The MVP does not need a service-role key at all.
