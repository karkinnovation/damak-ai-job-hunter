import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const preferredRegion = 'auto'

type Place = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  source: 'awasar' | 'osm'
  city?: string
  district?: string
  province?: string
  ward?: number
}

function clean(value: string) {
  return value
    .replace(/[%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchAwasarBusinesses(query: string): Promise<Place[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('businesses')
      .select(`
        id,
        business_name,
        ward,
        city,
        district,
        province,
        latitude,
        longitude
      `)
      .ilike('business_name', `%${query}%`)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(5)

    if (error) return []

    return (data || [])
      .map((business: any) => ({
        id: `awasar-${business.id}`,
        name: business.business_name,
        address: [
          business.city &&
            `${business.city}${business.ward ? `-${business.ward}` : ''}`,
          business.district,
          business.province,
          'Nepal',
        ]
          .filter(Boolean)
          .join(', '),
        latitude: Number(business.latitude),
        longitude: Number(business.longitude),
        source: 'awasar' as const,
        city: business.city || undefined,
        district: business.district || undefined,
        province: business.province || undefined,
        ward:
          business.ward == null
            ? undefined
            : Number(business.ward),
      }))
      .filter(
        place =>
          Number.isFinite(place.latitude) &&
          Number.isFinite(place.longitude)
      )
  } catch {
    return []
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined
}

function resultAddress(properties: Record<string, unknown>) {
  return [
    stringValue(properties.street),
    stringValue(properties.locality),
    stringValue(properties.district),
    stringValue(properties.county),
    stringValue(properties.state),
    'Nepal',
  ]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(', ')
}

function wardFrom(properties: Record<string, unknown>) {
  const candidates = [
    properties.locality,
    properties.district,
    properties.name,
  ]

  for (const candidate of candidates) {
    const match = String(candidate || '').match(/\b(?:ward\s*)?(\d{1,2})\b/i)
    if (match) {
      const value = Number(match[1])
      if (value >= 1 && value <= 99) return value
    }
  }

  return undefined
}

/*
 * Photon is an OpenStreetMap-based geocoder designed for search-as-you-type.
 * The public server is suitable for reasonable/light project use.
 *
 * We still proxy through our own Next route so the UI has one stable API and
 * can be switched to another provider later without changing the browser code.
 */
async function searchPhoton(query: string): Promise<Place[]> {
  const params = new URLSearchParams({
    q: `${query}, Nepal`,
    lang: 'en',
    limit: '8',
  })

  const response = await fetch(
    `https://photon.komoot.io/api/?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Awasar/1.0 Nepal job-matching map search',
      },
      // Every typed query is cached independently on the Next server/CDN.
      next: { revalidate: 86400 },
    }
  )

  if (!response.ok) {
    throw new Error(`Photon ${response.status}`)
  }

  const data = (await response.json()) as {
    features?: Array<{
      geometry?: {
        coordinates?: [number, number]
      }
      properties?: Record<string, unknown>
    }>
  }

  return (data.features || [])
    .map((feature, index): Place | null => {
      const properties = feature.properties || {}
      const coordinates = feature.geometry?.coordinates

      if (!coordinates || coordinates.length < 2) return null

      const longitude = Number(coordinates[0])
      const latitude = Number(coordinates[1])

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null
      }

      const countryCode = String(
        properties.countrycode ||
          properties.country_code ||
          ''
      ).toUpperCase()

      const country = String(properties.country || '').toLowerCase()

      /*
       * Prefer explicit Nepal results. If the provider omits country metadata,
       * keep results only when they fall inside Nepal's approximate bounds.
       */
      const insideNepal =
        latitude >= 26.2 &&
        latitude <= 30.5 &&
        longitude >= 80.0 &&
        longitude <= 88.3

      if (
        countryCode &&
        countryCode !== 'NP' &&
        countryCode !== 'NPL'
      ) {
        return null
      }

      if (
        country &&
        !country.includes('nepal') &&
        !insideNepal
      ) {
        return null
      }

      if (!countryCode && !country && !insideNepal) {
        return null
      }

      const name =
        stringValue(properties.name) ||
        stringValue(properties.street) ||
        stringValue(properties.city) ||
        stringValue(properties.locality) ||
        'Place'

      const city =
        stringValue(properties.city) ||
        stringValue(properties.locality) ||
        stringValue(properties.town) ||
        stringValue(properties.village)

      const district =
        stringValue(properties.district) ||
        stringValue(properties.county)

      const province =
        stringValue(properties.state) ||
        stringValue(properties.region)

      const osmType =
        stringValue(properties.osm_type) ||
        stringValue(properties.type) ||
        'place'

      const osmId =
        properties.osm_id ||
        properties.extent ||
        `${latitude}-${longitude}-${index}`

      return {
        id: `osm-${osmType}-${String(osmId)}`,
        name,
        address: resultAddress(properties),
        latitude,
        longitude,
        source: 'osm',
        city,
        district,
        province,
        ward: wardFrom(properties),
      }
    })
    .filter((place): place is Place => Boolean(place))
}

function dedupe(places: Place[]) {
  const seen = new Set<string>()

  return places.filter(place => {
    const key = `${place.name.toLowerCase()}-${place.latitude.toFixed(
      4
    )}-${place.longitude.toFixed(4)}`

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export async function GET(request: Request) {
  const query = clean(
    new URL(request.url).searchParams.get('q') || ''
  )

  if (query.length < 3) {
    return NextResponse.json({ results: [] })
  }

  /*
   * Internal Awasar businesses are instant and get priority.
   * Photon adds Nepal-wide OSM places for the live suggestion list.
   */
  const ownPromise = searchAwasarBusinesses(query)
  const photonPromise = searchPhoton(query).catch(() => [])

  const [own, photon] = await Promise.all([
    ownPromise,
    photonPromise,
  ])

  return NextResponse.json(
    {
      results: dedupe([...own, ...photon]).slice(0, 10),
    },
    {
      headers: {
        'Cache-Control':
          'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
