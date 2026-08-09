# Awasar map search submit fix

## What was wrong

`components/PlaceSearch.tsx` rendered its own `<form>` even though `LocationPicker`
is used inside the seeker/employer profile `<form>`.

HTML does not support nested forms reliably. Clicking the map Search button could
therefore submit the outer profile form, making the whole page refresh instead
of running `/api/geocode`.

## What changed

- Removed the nested `<form>` from PlaceSearch.
- Map Search button is explicitly `type="button"`.
- Search button calls geocoding directly.
- Pressing Enter in the place input uses `preventDefault()` + `stopPropagation()`.
- Search-result buttons are also explicitly `type="button"`.
- Added a 9-second request timeout so a slow geocoder cannot appear stuck forever.
- Existing OpenStreetMap/Nominatim + Awasar business search remains unchanged.
- No Supabase migration is required.

## Install

Replace:
`components/PlaceSearch.tsx`

Then run:
`npm run build`

Test in both:
- Job seeker profile map
- Employer/business profile map

Search examples:
- Kathmandu
- Pokhara Lakeside
- Dharan
- Karki Innovation
