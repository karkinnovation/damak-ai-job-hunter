# Awasar v9 — Application Quality Guardrails

## Application Fatigue Signal
- Each submitted application stores a snapshot of its deterministic match score and mismatch patterns.
- The dashboard groups recent mismatch keys and shows a nudge after the same issue appears 4+ times.
- Nudges are dismissible and suppressed for the same pattern for 7 days.
- No workers or queues are required; detection happens via a small PostgreSQL RPC when the dashboard loads.

## Application Rate Limiting
- Default: maximum 2 applications per rolling hour and 5 applications per Nepal calendar day.
- Enforcement is inside the `submit_application_guarded` PostgreSQL function, not only in the UI.
- Low matches below 40% are not blocked; the applicant sees an extra confirmation modal.
- Apply page displays daily/hourly remaining counts and a friendly reset time when blocked.
- Limit hits are logged for a future admin view.

## Faster Apply Path
- Application count enforcement, duplicate protection and insertion occur in one atomic RPC.
- Hourly and daily counts use `applications(job_seeker_id, created_at desc)`.
- The server recalculates match score and distance; no Gemini request blocks applying.
