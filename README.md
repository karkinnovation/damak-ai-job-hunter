# Damak AI Job Hunter

Hackathon-ready MVP for two-sided local job matching in Damak, Jhapa, Nepal.

## What works

- Email/password registration and login with Job Seeker / Employer roles
- Protected role-specific dashboards
- Job seeker profile: Damak ward, education, skills, experience, expected NPR salary, full/part-time preference, hours, preferred categories, travel distance, optional coordinates
- Employer/business profile
- Vacancy posting and closing
- Public vacancy browsing and job details
- Deterministic 0–100 compatibility scoring
- AI-generated explanation using Google Gemini API, with deterministic fallback when no API key is configured
- Job seeker “Hunt Jobs For Me” ranking
- Apply flow and “My Applications”
- Employer applicant ranking with reasons
- Manual reviewed / shortlist / reject actions; AI never auto-rejects
- Minimal admin moderation panel
- Supabase Row Level Security policies and role-escalation protection
- Server-side Zod input validation
- Security response headers

## Stack

- Next.js App Router + TypeScript
- Supabase Auth + PostgreSQL + RLS
- Zod validation
- Google Gemini API for natural-language match explanations
- Plain responsive CSS (no UI dependency required)

## 1. Create Supabase project

Create a Supabase project, then open **SQL Editor** and run:

`supabase/schema.sql`

The migration creates all tables, signup trigger, indexes and RLS policies.

## 2. Configure authentication

In Supabase Auth settings:

1. Set your Site URL to `http://localhost:3000` while developing.
2. Add `http://localhost:3000/auth/confirm` and `http://localhost:3000/auth/callback` as allowed redirect URLs.
3. Keep email confirmation enabled. In **Authentication → Email Templates → Confirm signup**, use a token-hash link that points to: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
4. Strongly recommended before public launch: enable CAPTCHA and review Supabase Auth rate limits.

## 3. Environment

Copy `.env.example` to `.env.local` and fill in values from Supabase **Connect / API keys**.

```bash
cp .env.example .env.local
```

Use the **publishable** Supabase key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do not put a service-role/secret key in the browser or in any `NEXT_PUBLIC_*` variable.

`GEMINI_API_KEY` is optional for development: without it, the app uses deterministic explanations so your demo still works. When present, it is read only from server code. Set `GEMINI_MODEL=gemini-2.5-flash` for the low-latency default.

## 4. Install and run

Use Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 5. Demo setup

Recommended demo:

### Employer

Register an Employer account, create a business profile, then post 4–5 vacancies such as:

- Account Assistant — Excel + Accounting — NPR 20k–24k — 12 months preferred
- Computer Operator — Computer Basics + Typing + Excel — NPR 18k–23k
- Office Assistant — Word + Communication — NPR 17k–22k
- Salesperson — Sales + Customer Service — NPR 16k–25k
- Graphic Designer — Photoshop + Graphic Design — NPR 22k–30k

### Job seeker

Register a Job Seeker account with:

- Damak-5
- +2 Management
- Skills: Excel, Computer Basics, Accounting, Customer Service
- Experience: 8 months
- Expected salary: NPR 18,000–25,000
- Full-time
- 09:00–18:00
- Travel: 5 km

Click **Hunt Jobs For Me**, apply to the top result, then switch back to the employer and open **Applicants**.

## Scoring model

The implementation is deterministic. The LLM does not invent or change the score.

- Skills: 25%
- Availability: 15%
- Salary compatibility: 15%
- Experience: 15%
- Location/distance: 15%
- Employment type: 5%
- Education: 5%
- Preferred job category: 5%

If both sides have coordinates, Haversine distance is used. Otherwise Damak ward proximity provides a fallback location score.

## Security decisions

This is hardened for a hackathon MVP, not a substitute for a professional production security audit.

- Authorization is enforced in PostgreSQL RLS, not only hidden in UI.
- Server code uses a validated Supabase user before protected actions.
- A database trigger prevents users from changing their own role to `admin`.
- Admin role is never accepted during public signup.
- Candidate profile details are only readable by the candidate, admins, or employers who have received that candidate's application.
- Gemini API key never reaches the browser.
- Matching intentionally excludes protected/sensitive traits.
- Inputs are schema-validated and length/range bounded.
- Duplicate applications are prevented by a database unique constraint.
- Public jobs are read-only to anonymous visitors.
- `X-Frame-Options`, `nosniff`, referrer and permissions headers are configured.

### Before a real public launch

Add/verify: CAPTCHA, production email delivery, monitoring/audit logs, abuse throttling using a shared rate-limit store, backups, privacy policy/consent, data retention/deletion flows, vulnerability/dependency scanning, CSP tuned to your deployment, penetration testing, and legal review appropriate for Nepal employment/privacy requirements.

## Admin

Register the intended admin normally, find its UUID under Supabase Authentication, then run this in SQL Editor as database owner:

```sql
update public.profiles set role = 'admin' where id = '<ADMIN_USER_UUID>';
```

The database trigger blocks normal authenticated users from making this change themselves.

## Architecture

```text
Browser
  ↓
Next.js App Router / Server Actions
  ↓
Supabase Auth + PostgreSQL RLS
  ↓
Deterministic matching engine
  ↓
Gemini explanation (optional, server-only)
```

## Expansion later

The MVP intentionally hardcodes the city to Damak. For multi-city expansion, introduce a `cities`/`locations` table and replace the Damak-only database checks while keeping the matching interface unchanged.
