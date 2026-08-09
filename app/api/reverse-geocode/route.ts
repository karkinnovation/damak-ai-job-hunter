import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function num(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = num(url.searchParams.get('lat'))
  const lon = num(url.searchParams.get('lon'))

  if (lat == null || lon == null || lat < 26 || lat > 31 || lon < 80 || lon > 89) {
    return NextResponse.json({ error: 'Choose a location inside Nepal.' }, { status: 400 })
  }

  const endpoint =
    'https://nominatim.openstreetmap.org/reverse' +
    `?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`

  try {
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Awasar/1.0 (job matching platform for Nepal)',
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
      next: { revalidate: 86400 },
    })

    if (!res.ok) throw new Error(`reverse ${res.status}`)
    const item = await res.json()
    const a = item.address || {}
    const wardText = String(a.ward || a.suburb || '').match(/\d+/)?.[0]

    return NextResponse.json({
      city: a.city || a.town || a.municipality || a.village || a.suburb || '',
      district: a.county || a.district || a.state_district || '',
      province: a.state || a.region || '',
      ward: wardText ? Number(wardText) : null,
      display_name: item.display_name || '',
    })
  } catch {
    return NextResponse.json({ error: 'Could not identify this location automatically.' }, { status: 503 })
  }
}
