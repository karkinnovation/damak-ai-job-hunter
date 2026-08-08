import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { haversineKm } from '@/lib/matching'
import { DistanceMap } from '@/components/LeafletMap'

async function confirmApply(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['job_seeker'])
  const jobId = String(formData.get('job_id') || '')

  const [{ data: seeker }, { data: job }] = await Promise.all([
    supabase.from('job_seeker_profiles').select('latitude,longitude').eq('user_id', user.id).maybeSingle(),
    supabase.from('jobs').select('id,status,latitude,longitude,businesses(latitude,longitude)').eq('id', jobId).maybeSingle(),
  ])

  if (!job || job.status !== 'open') redirect('/jobs?error=' + encodeURIComponent('This vacancy is no longer open.'))
  if (seeker?.latitude == null || seeker?.longitude == null) redirect('/seeker/profile?error=' + encodeURIComponent('Choose your home location on the map before applying.'))

  const business = Array.isArray(job.businesses) ? job.businesses[0] : job.businesses
  const workLat = job.latitude ?? business?.latitude
  const workLng = job.longitude ?? business?.longitude
  if (workLat == null || workLng == null) redirect(`/jobs/${jobId}?error=` + encodeURIComponent('The employer needs to set a workplace location before applications can calculate distance.'))

  // Recalculate on the server. Never trust a distance submitted by the browser.
  const distanceKm = haversineKm(Number(seeker.latitude), Number(seeker.longitude), Number(workLat), Number(workLng))
  const { error } = await supabase.from('applications').insert({
    job_id: jobId,
    job_seeker_id: user.id,
    status: 'applied',
    distance_km: Number(distanceKm.toFixed(2)),
  })

  if (error && error.code !== '23505') redirect(`/jobs/${jobId}/apply?error=` + encodeURIComponent(error.message))
  revalidatePath('/seeker/applications')
  revalidatePath(`/jobs/${jobId}`)
  redirect('/seeker/applications')
}

export default async function ApplyPreview({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ error?: string }> }) {
  const { id } = await params
  const { error } = await searchParams
  const { supabase, user } = await requireRole(['job_seeker'])

  const [{ data: job }, { data: seeker }, { data: existing }] = await Promise.all([
    supabase.from('jobs').select('*,businesses(business_name,latitude,longitude)').eq('id', id).eq('status', 'open').maybeSingle(),
    supabase.from('job_seeker_profiles').select('latitude,longitude,max_travel_km').eq('user_id', user.id).maybeSingle(),
    supabase.from('applications').select('id,status').eq('job_id', id).eq('job_seeker_id', user.id).maybeSingle(),
  ])

  if (!job) notFound()
  if (existing) redirect('/seeker/applications')

  const business = Array.isArray(job.businesses) ? job.businesses[0] : job.businesses
  const homeLat = seeker?.latitude != null ? Number(seeker.latitude) : null
  const homeLng = seeker?.longitude != null ? Number(seeker.longitude) : null
  const workLat = job.latitude != null ? Number(job.latitude) : business?.latitude != null ? Number(business.latitude) : null
  const workLng = job.longitude != null ? Number(job.longitude) : business?.longitude != null ? Number(business.longitude) : null
  const hasDistance = homeLat != null && homeLng != null && workLat != null && workLng != null
  const distanceKm = hasDistance ? haversineKm(homeLat!, homeLng!, workLat!, workLng!) : null
  const withinPreference = distanceKm != null && seeker?.max_travel_km != null ? distanceKm <= Number(seeker.max_travel_km) : null

  return (
    <section className="narrow applyPreviewPage">
      <span className="eyebrow">Confirm application</span>
      <h1>{job.title}</h1>
      <p className="muted">{business?.business_name || 'Local employer'} · Damak-{job.ward}</p>
      {error && <p className="error">{error}</p>}

      {hasDistance ? (
        <>
          <div className={`distanceSummary card ${withinPreference ? 'within' : 'outside'}`}>
            <span className="distanceNumber">{distanceKm!.toFixed(1)} km</span>
            <div>
              <strong>from your saved home location</strong>
              <p className="muted">{withinPreference ? `Within your preferred ${Number(seeker!.max_travel_km)} km travel radius.` : `Beyond your preferred ${Number(seeker!.max_travel_km)} km travel radius.`}</p>
            </div>
          </div>
          <div className="card mapPreviewCard">
            <h3>Home → workplace</h3>
            <p className="muted">The line is a straight-line distance used consistently by Awasar’s matching score. It is not a road-route estimate.</p>
            <DistanceMap home={{ latitude: homeLat!, longitude: homeLng! }} work={{ latitude: workLat!, longitude: workLng! }} />
          </div>
          <div className="applyConfirmActions">
            <form action={confirmApply}><input type="hidden" name="job_id" value={job.id} /><button className="button">Confirm application</button></form>
            <Link className="button secondary" href={`/jobs/${job.id}`}>Back to job</Link>
          </div>
        </>
      ) : (
        <div className="card">
          <h3>Location setup required</h3>
          <p className="muted">Awasar needs both your home pin and the employer’s workplace pin to calculate distance before applying.</p>
          {homeLat == null || homeLng == null ? <Link className="button" href="/seeker/profile">Set my home location</Link> : <p className="notice">This employer has not set a workplace location yet. You can return to the vacancy and try again after it is updated.</p>}
        </div>
      )}
    </section>
  )
}
