# Apply Awasar v10

This update is based on Awasar v9 and includes the user's latest Nav.tsx, AI Match page and AIExplanation.tsx as the new baseline.

## Recommended: drop-in update
Extract `awasar-v10-performance-ui-update.zip` into your existing Awasar project and replace files.

The update ZIP intentionally does NOT include `public/awasar.png`, so your current manual logo file is preserved.

Then run:

```bat
npm run build
```

If successful:

```bat
git add .
git commit -m "Improve site-wide performance and UI"
git pull --rebase origin main
git push origin main
```

No new Supabase migration is required by v10. Keep the v8/v9 migrations already applied.
