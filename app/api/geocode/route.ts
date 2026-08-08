import { NextResponse } from 'next/server'

/*
 * Server-side place search.
 *
 * This runs on the server rather than in the browser for three reasons:
 *
 *  1. Nominatim's usage policy requires a User-Agent that identifies the
 *     application. Browsers forbid setting User-Agent from fetch(), so
 *     browser-side calls get rejected — this was why search silently failed.
 *  2. A Google Places key must never reach the client.
 *  3. One place to swap providers without touching any UI.
 *
 * Provider: Google Places if GOOGLE_MAPS_API_KEY is set (returns the business
 * names people know from Google Maps), otherwise OpenStreetMap's Nominatim,
 * which also indexes shops and businesses but with thinner local coverage.
 */

export const runtime = 'nodejs'

type Place = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}

// Bias toward Jhapa so "Damak" finds the local town, not a same-named place.
const JHAPA = { lat: 26.66, lng: 87.7, radiusMeters: 40000 }

async function searchGoogle(query: string, key: string): Promise<Place[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: 'NP',
      maxResultCount: 6,
      locationBias: {
        circle: {
          center: { latitude: JHAPA.lat, longitude: JHAPA.lng },
          radius: JHAPA.radiusMeters,
        },
      },
    }),
  })

  if (!res.ok) throw new Error(`google ${res.status}`)
  const data = await res.json()

  return (data.places || []).map((p: any) => ({
    id: p.id,
    name: p.displayName?.text || p.formattedAddress || 'Unnamed place',
    address: p.formattedAddress || '',
    latitude: p.location?.latitude,
    longitude: p.location?.longitude,
  })).filter((p: Place) => p.latitude != null && p.longitude != null)
}

async function searchNominatim(query: string): Promise<Place[]> {
  const url =
    'https://nominatim.openstreetmap.org/search' +
    '?format=jsonv2&limit=6&addressdetails=1&countrycodes=np' +
    `&viewbox=87.35,26.95,88.25,26.25&q=${encodeURIComponent(query)}`

  const res = await fetch(url, {
    headers: {
      // Required by the Nominatim usage policy.
      'User-Agent': 'Awasar/1.0 (job board for Damak, Jhapa, Nepal)',
      Accept: 'application/json',
    },
  })

  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const data = await res.json()

  return (data || []).map((item: any) => {
    const full: string = item.display_name || ''
    const parts = full.split(',').map((s: string) => s.trim())
    return {
      id: String(item.place_id),
      name: item.name || parts[0] || 'Unnamed place',
      address: parts.slice(1, 4).join(', '),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }
  }).filter((p: Place) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() || ''

  if (query.length < 3) {
    return NextResponse.json({ results: [] })
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY

  try {
    const results = googleKey
      ? await searchGoogle(query, googleKey)
      : await searchNominatim(query)

    return NextResponse.json(
      { results, provider: googleKey ? 'google' : 'osm' },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    )
  } catch {
    // If Google is configured but failing (bad key, quota), still try OSM
    // rather than leaving the user with a dead search box.
    if (googleKey) {
      try {
        const results = await searchNominatim(query)
        return NextResponse.json({ results, provider: 'osm' })
      } catch {
        /* fall through */
      }
    }
    return NextResponse.json(
      { results: [], error: 'Place search is temporarily unavailable.' },
      { status: 503 }
    )
  }
}
