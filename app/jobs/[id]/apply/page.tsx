import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { calculateMatch, haversineKm } from '@/lib/matching'
import { snapshotMismatchPatterns } from '@/lib/applicationInsights'
import { JourneyMap } from '@/components/JourneyMap'
import { ApplyGuard } from '@/components/ApplyGuard'
import { locationLabel } from '@/lib/location'

const HOURLY_LIMIT = 2
const DAILY_LIMIT = 5

function matchInput(seeker: any, job: any) {
  return {
    seeker: {
      skills: seeker.skills || [],
      experience_months: seeker.experience_months,
      education_level: seeker.education_level,
      expected_salary_min: seeker.expected_salary_min,
      expected_salary_max: seeker.expected_salary_max,
      employment_type: seeker.employment_type,
      available_from: String(seeker.available_from).slice(0, 5),
      available_until: String(seeker.available_until).slice(0, 5),
      max_travel_km: Number(seeker.max_travel_km),
      latitude: seeker.latitude,
      longitude: seeker.longitude,
      ward: seeker.ward,
      city: seeker.city, district: seeker.district, province: seeker.province,
      preferred_categories: seeker.preferred_categories || [],
    },
    job: {
      required_skills: job.required_skills || [],
      preferred_skills: job.preferred_skills || [],
      experience_required_months: job.experience_required_months,
      education_requirement: job.education_requirement,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      employment_type: job.employment_type,
      working_start: String(job.working_start).slice(0, 5),
      working_end: String(job.working_end).slice(0, 5),
      latitude: job.latitude,
      longitude: job.longitude,
      ward: job.ward,
      city: job.city, district: job.district, province: job.province,
      category: job.category,
    },
  }
}

function formatReset(value?: string | null) {
  if (!value) return 'soon'
  return new Intl.DateTimeFormat('en-NP', {
    timeZone: 'Asia/Kathmandu',
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

async function confirmApply(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['job_seeker'])
  const jobId = String(formData.get('job_id') || '')

  const [{ data: seeker }, { data: job }] = await Promise.all([
    supabase.from('job_seeker_profiles').select('user_id,skills,experience_months,education_level,expected_salary_min,expected_salary_max,employment_type,available_from,available_until,max_travel_km,latitude,longitude,ward,city,district,province,preferred_categories').eq('user_id', user.id).maybeSingle(),
    supabase.from('jobs').select('id,title,status,category,ward,city,district,province,salary_min,salary_max,employment_type,required_skills,preferred_skills,experience_required_months,education_requirement,working_start,working_end,latitude,longitude,businesses(business_name,latitude,longitude)').eq('id', jobId).maybeSingle(),
  ])

  if (!job || job.status !== 'open') redirect('/jobs?error=' + encodeURIComponent('This vacancy is no longer open.'))
  if (!seeker) redirect('/seeker/profile?error=' + encodeURIComponent('Complete your profile before applying.'))
  if (seeker.latitude == null || seeker.longitude == null) redirect('/seeker/profile?error=' + encodeURIComponent('Choose your home location on the map before applying.'))

  const business = Array.isArray(job.businesses) ? job.businesses[0] : job.businesses
  const workLat = job.latitude ?? business?.latitude
  const workLng = job.longitude ?? business?.longitude
  if (workLat == null || workLng == null) redirect(`/jobs/${jobId}?error=` + encodeURIComponent('The employer needs to set a workplace location before applications can calculate distance.'))

  const distanceKm = haversineKm(Number(seeker.latitude), Number(seeker.longitude), Number(workLat), Number(workLng))
  const breakdown = calculateMatch(matchInput(seeker, { ...job, latitude: workLat, longitude: workLng }))
  const snapshot = snapshotMismatchPatterns(breakdown.mismatches)

  const { data, error } = await supabase.rpc('submit_application_guarded', {
    p_job_id: jobId,
    p_distance_km: Number(distanceKm.toFixed(2)),
    p_match_score: breakdown.score,
    p_mismatch_reasons: snapshot.reasons,
    p_mismatch_keys: snapshot.keys,
    p_hourly_limit: HOURLY_LIMIT,
    p_daily_limit: DAILY_LIMIT,
  })

  if (error) {
    redirect(`/jobs/${jobId}/apply?error=` + encodeURIComponent(`Application check failed: ${error.message}`))
  }

  const result = data as any
  if (!result?.ok) {
    const reset = result?.reset_at ? ` You can try again after ${formatReset(result.reset_at)}.` : ''
    redirect(`/jobs/${jobId}/apply?error=` + encodeURIComponent(`${result?.message || 'Application could not be submitted.'}${reset}`))
  }

  revalidatePath('/dashboard')
  revalidatePath('/seeker/applications')
  revalidatePath(`/jobs/${jobId}`)
  redirect('/seeker/applications')
}

export default async function ApplyPreview({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ error?: string }> }) {
  const { id } = await params
  const { error } = await searchParams
  const { supabase, user } = await requireRole(['job_seeker'])

  const [jobResult, seekerResult, existingResult, rateResult] = await Promise.all([
    supabase.from('jobs').select('id,title,status,category,ward,city,district,province,salary_min,salary_max,employment_type,required_skills,preferred_skills,experience_required_months,education_requirement,working_start,working_end,latitude,longitude,businesses(business_name,latitude,longitude)').eq('id', id).eq('status', 'open').maybeSingle(),
    supabase.from('job_seeker_profiles').select('user_id,skills,experience_months,education_level,expected_salary_min,expected_salary_max,employment_type,available_from,available_until,max_travel_km,latitude,longitude,ward,city,district,province,preferred_categories').eq('user_id', user.id).maybeSingle(),
    supabase.from('applications').select('id,status').eq('job_id', id).eq('job_seeker_id', user.id).maybeSingle(),
    supabase.rpc('application_rate_status', { p_hourly_limit: HOURLY_LIMIT, p_daily_limit: DAILY_LIMIT }),
  ])

  const job = jobResult.data
  const seeker = seekerResult.data
  const existing = existingResult.data

  if (!job) notFound()
  if (existing) redirect('/seeker/applications')
  if (!seeker) redirect('/seeker/profile?error=' + encodeURIComponent('Complete your profile before applying.'))

  const business = Array.isArray(job.businesses) ? job.businesses[0] : job.businesses
  const homeLat = seeker.latitude != null ? Number(seeker.latitude) : null
  const homeLng = seeker.longitude != null ? Number(seeker.longitude) : null
  const workLat = job.latitude != null ? Number(job.latitude) : business?.latitude != null ? Number(business.latitude) : null
  const workLng = job.longitude != null ? Number(job.longitude) : business?.longitude != null ? Number(business.longitude) : null
  const hasDistance = homeLat != null && homeLng != null && workLat != null && workLng != null
  const distanceKm = hasDistance ? haversineKm(homeLat!, homeLng!, workLat!, workLng!) : null
  const withinPreference = distanceKm != null && seeker.max_travel_km != null ? distanceKm <= Number(seeker.max_travel_km) : null

  const breakdown = calculateMatch(matchInput(seeker, { ...job, latitude: workLat, longitude: workLng }))
  const rate = (rateResult.data || {}) as any
  const dailyRemaining = Number(rate.daily_remaining ?? DAILY_LIMIT)
  const hourlyRemaining = Number(rate.hourly_remaining ?? HOURLY_LIMIT)
  let blockedMessage: string | null = null
  if (rateResult.error) blockedMessage = `Run the Awasar v9 Supabase migration first. Database message: ${rateResult.error.message}`
  else if (rate.blocked_daily) blockedMessage = `You've used all ${DAILY_LIMIT} applications for today. Your daily limit resets at ${formatReset(rate.daily_reset_at)}.`
  else if (rate.blocked_hourly) blockedMessage = `You've applied to ${HOURLY_LIMIT} jobs recently. You can apply again after ${formatReset(rate.hourly_reset_at)}.`

  return (
    <section className="narrow applyPreviewPage">
      <span className="eyebrow">Confirm application</span>
      <h1>{job.title}</h1>
      <p className="muted">{business?.business_name || 'Local employer'} · {locationLabel(job)}</p>
      {error && <p className="error">{error}</p>}

      {hasDistance ? (
        <>
          <div className={`distanceSummary card ${withinPreference ? 'within' : 'outside'}`}>
            <span className="distanceNumber">{distanceKm!.toFixed(1)} km</span>
            <div>
              <strong>from your saved home location</strong>
              <p className="muted">{withinPreference ? `Within your preferred ${Number(seeker.max_travel_km)} km travel radius.` : `Beyond your preferred ${Number(seeker.max_travel_km)} km travel radius.`}</p>
            </div>
          </div>

          <div className="card matchBeforeApply">
            <span className="muted">Current compatibility</span>
            <strong className="applyMatchScore">{breakdown.score}% match</strong>
            {breakdown.mismatches[0] && <p className="muted">Main mismatch: {breakdown.mismatches[0]}</p>}
          </div>

          <div className="card mapPreviewCard">
            <h3>Your route to {business?.business_name || 'the workplace'}</h3>
            <p className="muted">Straight-line distance, the same measure used in your match score. The green ring is your preferred travel radius.</p>
            <JourneyMap
              home={{ latitude: homeLat!, longitude: homeLng! }}
              work={{ latitude: workLat!, longitude: workLng! }}
              workLabel={business?.business_name || 'Workplace'}
              maxTravelKm={seeker.max_travel_km != null ? Number(seeker.max_travel_km) : null}
            />
          </div>

          <div className="applyConfirmActions applyGuardActions">
            <ApplyGuard
              action={confirmApply}
              jobId={job.id}
              matchScore={breakdown.score}
              dailyRemaining={dailyRemaining}
              hourlyRemaining={hourlyRemaining}
              blockedMessage={blockedMessage}
            />
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
