# Awasar v11 — Map, Search, Motion & Performance Update

## What changed

### Job search
- Fixed company-name searching when Supabase returns `businesses(...)` as an array.
- The homepage and `/jobs` now normalize the nested business relation before search/rendering.
- Filtered searches inspect a larger candidate set than the default listing view, while the normal page remains lightweight.

### Place/business search
- Replaced typing-driven autocomplete with an explicit **Search** button.
- Search first checks Awasar's own registered businesses and saved pins.
- Only if there is no Awasar business match does it query OpenStreetMap/Nominatim.
- Repeat searches are cached in the browser for 24 hours.
- Nominatim requests are cached server-side and locally throttled.
- Users can always tap the map directly if external place search is unavailable.

### Maps
- Workplace/business labels are now permanently visible on map markers instead of requiring hover/tap.
- Employer profile marker text updates while the employer types the business name.
- Apply map is deliberately **view-only** and contains no place-search box.
- Added free external links for:
  - OpenStreetMap workplace map
  - Google Street View via Maps URL (no Google Maps API key or billing required)
- Street View availability depends on imagery coverage at that coordinate.

### Speed / perceived responsiveness
- Added `app/loading.tsx` so clicks show instant loading feedback during Server Component navigation.
- Reduced long page/card animation durations and removed the old half-second stagger that made finished pages feel slow.
- Shortened the route animation on the Apply map from 2.2 seconds to 0.9 seconds.
- Added preconnects for Leaflet and OpenStreetMap resources.
- Leaflet maps use `preferCanvas` where helpful.

## Database
No new Supabase migration is required for v11.

## Apply
1. Copy the update over the existing Awasar project.
2. Run `npm run build` locally.
3. Commit and push to GitHub.
4. Vercel will redeploy automatically.

## Validation performed here
- `tsc --noEmit` passed.
- ESLint passed for every modified TS/TSX file.
- Full Next production build could not be completed in this sandbox because its package mirror cannot provide the Linux SWC binary for Next.js 16.2.12. Run `npm run build` on the existing local install before pushing.
