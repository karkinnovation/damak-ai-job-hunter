export type NepalLocation = {
  city?: string | null
  district?: string | null
  province?: string | null
  ward?: number | null
}

export function locationLabel(location: NepalLocation, options?: { ward?: boolean }) {
  const city = String(location.city || '').trim()
  const district = String(location.district || '').trim()
  const province = String(location.province || '').trim()
  const ward = location.ward != null ? Number(location.ward) : null

  const primary = city || district || province || 'Nepal'
  const parts: string[] = [primary]

  if (options?.ward !== false && ward) parts[0] += `-${ward}`
  if (district && district.toLowerCase() !== primary.toLowerCase()) parts.push(district)
  if (province && !parts.some(p => p.toLowerCase() === province.toLowerCase())) parts.push(province)

  return parts.join(', ')
}
