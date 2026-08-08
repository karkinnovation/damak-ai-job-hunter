import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { COMMON_SKILLS } from '@/lib/constants'

function money(value: number) {
  return Number(value || 0).toLocaleString('en-IN')
}

function employmentLabel(value: string) {
  return value === 'part_time' ? 'Part Time' : 'Full Time'
}

type CandidateSignal = {
  anonymous_id: string
  ward: number
  city: string
  skills: string[]
  expected_salary_min: number
  expected_salary_max: number
  available_from: string
  available_until: string
  max_travel_km: number
  employment_type: string
  distance_band: string | null
}

export default async function TalentPool({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, user } = await requireRole(['employer'])
  const params = await searchParams
  const { data: business } = await supabase.from('businesses').select('business_name,ward,latitude,longitude').eq('user_id', user.id).maybeSingle()

  const skill = (params.skill || '').trim()
  const salaryMin = params.salaryMin ? Number(params.salaryMin) : null
  const salaryMax = params.salaryMax ? Number(params.salaryMax) : null
  const availableAt = params.availableAt || null
  const distance = params.distance ? Number(params.distance) : null
  const ward = params.ward ? Number(params.ward) : null

  const { data, error } = await supabase.rpc('search_anonymous_candidates', {
    p_skill: skill || null,
    p_salary_min: Number.isFinite(salaryMin) ? salaryMin : null,
    p_salary_max: Number.isFinite(salaryMax) ? salaryMax : null,
    p_available_at: availableAt,
    p_max_distance_km: Number.isFinite(distance) ? distance : null,
    p_ward: Number.isFinite(ward) ? ward : null,
  })

  const candidates = (data || []) as CandidateSignal[]
  const areaText = ward ? `Damak-${ward}` : business?.ward ? `near Damak-${business.ward}` : 'near your business'
  const skillText = skill ? ` matching ${skill}` : ''

  return (
    <section className="container">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Reverse vacancy · anonymous talent</span>
          <h1>Available local talent</h1>
          <p className="muted">Browse opt-in availability signals before you post a vacancy. Identity and exact home location stay private.</p>
        </div>
        <Link className="button secondary" href="/employer/jobs/new">Post a vacancy</Link>
      </div>

      {!business && <p className="notice">Complete your <Link href="/employer/profile"><b>business profile</b></Link> before filtering candidates by distance.</p>}
      {error && <p className="error">Run the supplied Supabase feature migration first. Database message: {error.message}</p>}

      <div className="talentCount card">
        <span className="stat">{candidates.length}</span>
        <div>
          <strong>anonymous candidate{candidates.length === 1 ? '' : 's'} {areaText}{skillText}</strong>
          <p className="muted">Only candidates who explicitly enabled “Show my availability to employers” appear here.</p>
        </div>
      </div>

      <form className="card talentFilters" method="get">
        <div className="field"><label>Skill</label><select name="skill" defaultValue={skill}><option value="">Any skill</option>{COMMON_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div className="field"><label>Salary min (NPR)</label><input name="salaryMin" type="number" min="0" defaultValue={params.salaryMin || ''} placeholder="e.g. 18000" /></div>
        <div className="field"><label>Salary max (NPR)</label><input name="salaryMax" type="number" min="0" defaultValue={params.salaryMax || ''} placeholder="e.g. 30000" /></div>
        <div className="field"><label>Available at</label><input name="availableAt" type="time" defaultValue={params.availableAt || ''} /></div>
        <div className="field"><label>Distance</label><select name="distance" defaultValue={params.distance || ''}><option value="">Any distance</option><option value="2">Within 2 km</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option></select></div>
        <div className="field"><label>Damak ward</label><select name="ward" defaultValue={params.ward || ''}><option value="">Any ward</option>{Array.from({ length: 10 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Damak-{w}</option>)}</select></div>
        <div className="talentFilterActions"><button className="button">Filter talent</button><Link className="button secondary" href="/employer/talent">Reset</Link></div>
      </form>

      <div className="talentGrid">
        {candidates.map(candidate => (
          <article className="card anonymousCandidateCard" key={candidate.anonymous_id}>
            <div className="anonymousCandidateTop">
              <div>
                <span className="eyebrow">Anonymous candidate · #{candidate.anonymous_id.slice(0, 6).toUpperCase()}</span>
                <h3>{candidate.city}-{candidate.ward}</h3>
              </div>
              {candidate.distance_band && <span className="pill">{candidate.distance_band}</span>}
            </div>
            <div className="skillPreview">{candidate.skills.map(skillName => <span className="pill" key={skillName}>{skillName}</span>)}</div>
            <dl className="anonymousFacts">
              <div><dt>Expected salary</dt><dd>NPR {money(candidate.expected_salary_min)}–{money(candidate.expected_salary_max)}</dd></div>
              <div><dt>Availability</dt><dd>{String(candidate.available_from).slice(0,5)}–{String(candidate.available_until).slice(0,5)}</dd></div>
              <div><dt>Preference</dt><dd>{employmentLabel(candidate.employment_type)}</dd></div>
              <div><dt>Travel radius</dt><dd>Up to {Number(candidate.max_travel_km)} km</dd></div>
            </dl>
            <p className="privacyNote">🔒 Name, phone and exact home location are hidden. Identity becomes available through the normal application flow.</p>
          </article>
        ))}
        {!candidates.length && !error && <div className="card empty talentEmpty"><h3>No matching availability signals</h3><p className="muted">Try removing a filter or wait for more job seekers to opt in.</p></div>}
      </div>
    </section>
  )
}
