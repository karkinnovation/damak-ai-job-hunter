# Awasar search freeze fix

## Cause
The old `SearchSubmitButton` did this during its own click:
- set `pending = true`
- re-render as `disabled`

That can cancel/prevent the form's native submit default action. The user sees
"Searching…" forever, but the GET request/navigation never actually begins.

## Fix
Replace:
`components/SearchSubmitButton.tsx`

with the file in this patch.

The search forms themselves do not need to change.

## Test
1. `npm run build`
2. `npm run dev`
3. Open `/`
4. Search `Account`, a company name, or a skill
5. Confirm the URL changes to `/?q=...`
6. Test `/jobs` as well

## Deploy
git add components/SearchSubmitButton.tsx
git commit -m "Fix search form freeze"
git pull --rebase origin main
git push origin main
