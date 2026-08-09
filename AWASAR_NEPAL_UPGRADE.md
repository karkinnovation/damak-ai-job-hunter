# Awasar Nepal — National Location Upgrade

This update converts the existing Damak-only Awasar build into a Nepal-wide job platform.

## 1. Run the Supabase migration FIRST

Supabase -> SQL Editor -> New query

Run:

`supabase/national_location_migration.sql`

It:
- removes the Damak-only city constraints
- expands ward support to 1–99
- adds `district` and `province` to seekers, businesses and jobs
- backfills existing Damak rows as Jhapa / Koshi Province
- syncs business province/district/city/ward/coordinates into vacancies
- adds national location indexes
- upgrades anonymous talent browsing to province/district/city/ward filters

## 2. Replace project files

Copy the update ZIP contents over the existing Awasar project and choose Replace.

## 3. Build

```bat
npm run build
```

## 4. Deploy

```bat
git add .
git commit -m "Expand Awasar from Damak to Nepal"
git pull --rebase origin main
git push origin main
```

## What changed

Location model:
Province -> District -> City / Municipality -> Ward -> exact latitude/longitude.

- Business Profile supports anywhere in Nepal.
- Job Seeker Profile supports anywhere in Nepal.
- Vacancies inherit the employer workplace location.
- Homepage and Jobs search can filter by city, district or province.
- OpenStreetMap/Nominatim search is Nepal-wide.
- Current-location reverse geocoding can fill administrative fields for free.
- No Google Maps API key is required.
- Matching still prioritizes exact Haversine distance.
- If coordinates are unavailable, fallback matching compares city -> district -> province rather than Damak ward numbers.
- Anonymous talent search works nationally.

## Existing Damak data

Existing `city = 'Damak'` rows are preserved and backfilled as:
- district: Jhapa
- province: Koshi Province

No existing applications or users are deleted.
