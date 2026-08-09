# Awasar live map places update

This update removes the map Search button completely.

## New behaviour

- Start typing in the map place input.
- After 3 characters, suggestions appear automatically.
- Suggestions include:
  - registered Awasar businesses first;
  - Nepal-wide OpenStreetMap places via Photon.
- No Enter/Search button is required.
- Clicking a suggestion immediately moves the map pin.
- Pressing Enter selects the first visible result and never submits the outer profile form.
- Typing is debounced by 450ms and old requests are cancelled.
- Search responses are cached in the browser and server/CDN.
- Users can still tap the map or use current location.

## Why Photon

Public Nominatim explicitly forbids client autocomplete/search-as-you-type.
Photon is an OpenStreetMap geocoder with search-as-you-type support.

## Files

- components/PlaceSearch.tsx
- components/LeafletMap.tsx
- app/api/geocode/route.ts
- app/globals.css

No Supabase migration is required.

## Test

Try:
- Kathmandu
- Pokhara
- Dharan
- Birtamode
- Lakeside
- Karki Innovation

The list should appear while typing without any Search button.
