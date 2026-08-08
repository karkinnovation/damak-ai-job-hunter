# Awasar v8 Features

## Reverse Vacancy / Anonymous Skill Broadcasting

Job seekers can opt into employer discovery before applying to any vacancy. The opt-in is disabled by default.

Employer discovery uses a `SECURITY DEFINER` database function as a privacy boundary. Direct employer access to `job_seeker_profiles` remains blocked by RLS.

## Map-Based Location

Awasar uses Leaflet 1.9.4 and OpenStreetMap tiles. Job seeker and employer coordinates are stored in the existing latitude/longitude fields.

## Distance on Apply

The confirmation page calculates Haversine distance server-side, shows a map preview, then recalculates the distance again inside the server action before inserting the application.

The value is stored in `applications.distance_km` for stable application history.

## Matching Integration

`lib/matching.ts` already uses `haversineKm()` in the location factor whenever both candidate and vacancy coordinates are available. Business location is copied to vacancy coordinates, so the same distance automatically influences the existing 15% location component of the compatibility score.
