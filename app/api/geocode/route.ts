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

let lastNominatimRequestAt = 0
let nominatimQueue: Promise<void> = Promise.resolve()

function cleanQuery(value: string) {
  return value.replace(/[%,]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function searchAwasarBusinesses(query: string): Promise<Place[]> {
  try {
    const supabase = await createClient()
    const safe = cleanQuery(query)
    const { data, error } = await supabase
      .from('businesses')
      .select('id,business_name,ward,city,district,province,latitude,longitude')
      .ilike('business_name', `%${safe}%`)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(5)

    if (error) return []

    return (data || []).map((business: any) => ({
      id: `awasar-${business.id}`,
      name: business.business_name,
      address: [business.city && `${business.city}-${business.ward}`, business.district, business.province, 'Nepal'].filter(Boolean).join(', '),
      latitude: Number(business.latitude),
      longitude: Number(business.longitude),
      source: 'awasar' as const,
      city: business.city || undefined,
      district: business.district || undefined,
      province: business.province || undefined,
      ward: business.ward != null ? Number(business.ward) : undefined,
    })).filter((place: Place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
  } catch {
    return []
  }
}

async function waitForNominatimSlot() {
  const previous = nominatimQueue
  let release!: () => void
  nominatimQueue = new Promise<void>(resolve => { release = resolve })
  await previous
  const wait = Math.max(0, 1050 - (Date.now() - lastNominatimRequestAt))
  if (wait) await new Promise(resolve => setTimeout(resolve, wait))
  lastNominatimRequestAt = Date.now()
  release()
}

async function searchNominatim(query: string): Promise<Place[]> {
  await waitForNominatimSlot()
  const q = /\bnepal\b/i.test(query) ? query : `${query}, Nepal`
  const url =
    'https://nominatim.openstreetmap.org/search' +
    '?format=jsonv2&limit=6&addressdetails=1&countrycodes=np' +
    `&q=${encodeURIComponent(q)}`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Awasar/1.0 (job matching platform for Nepal)',
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
    next: { revalidate: 86400 },
  })

  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const data = await res.json()

  return (data || []).map((item: any) => {
    const full: string = item.display_name || ''
    const parts = full.split(',').map((s: string) => s.trim())
    const a = item.address || {}
    const wardText = String(a.ward || a.suburb || '').match(/\d+/)?.[0]
    return {
      id: `osm-${item.osm_type || 'place'}-${item.osm_id || item.place_id}`,
      name: item.name || parts[0] || 'Unnamed place',
      address: parts.slice(1, 6).join(', '),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      source: 'osm' as const,
      city: a.city || a.town || a.municipality || a.village || a.suburb || undefined,
      district: a.county || a.district || a.state_district || undefined,
      province: a.state || a.region || undefined,
      ward: wardText ? Number(wardText) : undefined,
    }
  }).filter((p: Place) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
}

function dedupePlaces(places: Place[]) {
  const seen = new Set<string>()
  return places.filter(place => {
    const key = `${place.name.toLowerCase()}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function GET(request: Request) {
  const query = cleanQuery(new URL(request.url).searchParams.get('q') || '')
  if (query.length < 2) return NextResponse.json({ results: [] })

  const own = await searchAwasarBusinesses(query)
  try {
    const osm = await searchNominatim(query)
    return NextResponse.json({ results: dedupePlaces([...own, ...osm]).slice(0, 8) })
  } catch {
    return NextResponse.json({ results: own })
  }
}
