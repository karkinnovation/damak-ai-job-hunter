# Search hard-fix

This version removes the pending-button implementation entirely and intercepts the GET search form itself.
`FastSearchForm` serializes non-empty fields and navigates with `window.location.assign()`.

Why: if the interface ever displays `Searching…`, an older SearchSubmitButton is still deployed. This build never contains that text.

Also moves category/salary filtering into Supabase before rows are returned, reducing payload and response time.

Test URLs:
- /?q=Account
- /?category=IT%20%2F%20Software
- /jobs?q=Karki%20Innovation

After extraction run `npm run build`.
