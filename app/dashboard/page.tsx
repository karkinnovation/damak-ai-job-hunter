import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { ApplicationStatus } from '@/components/ApplicationStatus'
import { calculateMatch } from '@/lib/matching'
import { ApplicationFatigueNudge } from '@/components/ApplicationFatigueNudge'
import { fatigueNudgeCopy } from '@/lib/applicationInsights'

export const dynamic = 'force-dynamic'

function money(value: number) {
  return new Intl.NumberFormat('en-NP').format(value)
}

function employmentLabel(value: string) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default async function Dashboard() {
  const { supabase, user } = await requireUser()
  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()

  if (!profile) {
    return <section className="narrow"><div className="card"><h1>Account setup problem</h1><p>Your profile row is missing. Run the supplied Supabase migration and sign in again.</p></div></section>
  }

  if (profile.role === 'job_seeker') {
    const [
      { data: seeker, error: seekerError },
      { count: applications },
      { data: latestApplication },
      { data: openJobs },
      rateResult,
      fatigueResult,
    ] = await Promise.all([
      supabase
        .from('job_seeker_profiles')
        .select('user_id,skills,experience_months,education_level,expected_salary_min,expected_salary_max,employment_type,available_from,available_until,max_travel_km,latitude,longitude,ward,preferred_categories,show_availability_to_employers')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('applications').select('*', { count: 'exact', head: true }).eq('job_seeker_id', user.id),
      supabase.from('applications').select('id,status,created_at,jobs(title)').eq('job_seeker_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from('jobs')
        .select('id,title,category,ward,salary_min,salary_max,employment_type,required_skills,preferred_skills,experience_required_months,education_requirement,working_start,working_end,latitude,longitude,businesses(business_name)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.rpc('application_rate_status', { p_hourly_limit: 2, p_daily_limit: 5 }),
      supabase.rpc('application_fatigue_signals', { p_threshold: 4, p_cooldown_days: 7, p_recent_limit: 30 }),
    ])

    const rate = (rateResult.data || {}) as any
    const fatigueSignals = Array.isArray(fatigueResult.data) ? fatigueResult.data : []
    const fatigueSignal = fatigueSignals[0] as { pattern_key: string; occurrences: number } | undefined
    const fatigueCopy = fatigueSignal ? fatigueNudgeCopy(fatigueSignal.pattern_key, Number(fatigueSignal.occurrences)) : null

    const profileComplete = !seekerError && !!seeker && seeker.latitude != null && seeker.longitude != null

    const bestMatches = seeker
      ? (openJobs || [])
          .map((job: any) => {
            const breakdown = calculateMatch({
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
                category: job.category,
              },
            })
            return { job, breakdown }
          })
          .sort((a, b) => b.breakdown.score - a.breakdown.score)
          .slice(0, 2)
      : []

    return (
      <section className="container">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Job seeker dashboard</span>
            <h1>Hi, {profile.full_name}</h1>
            <p className="muted">Your applications and best-fit local jobs, all in one place.</p>
          </div>
          <Link className="button secondary" href="/jobs">Browse jobs</Link>
        </div>

        {fatigueSignal && fatigueCopy && (
          <ApplicationFatigueNudge
            patternKey={fatigueSignal.pattern_key}
            title={fatigueCopy.title}
            message={fatigueCopy.message}
            actionLabel={fatigueCopy.actionLabel}
            actionHref={fatigueCopy.actionHref}
          />
        )}

        <div className="grid">
          <div className="card kpi">
            <span className="muted">Profile</span>
            <span className="stat">{seekerError ? 'Check setup' : profileComplete ? 'Complete' : 'Incomplete'}</span>
            <Link href="/seeker/profile">{profileComplete ? 'Edit profile →' : 'Complete profile →'}</Link>
          </div>

          <div className="card kpi">
            <span className="muted">Applications</span>
            <span className="stat">{applications || 0}</span>
            <span className="muted">{rateResult.error ? 'Run v9 migration' : `${Number(rate.daily_remaining ?? 5)} remaining today`}</span>
            <Link href="/seeker/applications">View all applications →</Link>
          </div>

          <div className="card kpi">
            <span className="muted">Employer visibility</span>
            <span className="stat">{seeker?.show_availability_to_employers ? 'On' : 'Off'}</span>
            <Link href="/seeker/profile">Manage privacy →</Link>
          </div>

          <div className="card kpi latestStatusCard">
            <span className="muted">Latest application status</span>
            {latestApplication ? (
              <>
                <strong className="latestStatusJob">{(latestApplication.jobs as any)?.title || 'Application'}</strong>
                <ApplicationStatus status={latestApplication.status} compact />
                <Link href="/seeker/applications">Track status →</Link>
              </>
            ) : (
              <>
                <span className="stat">—</span>
                <Link href="/jobs">Browse jobs →</Link>
              </>
            )}
          </div>
        </div>

        {profileComplete ? (
          <section className="dashboardMatches" aria-labelledby="best-matches-heading">
            <div className="sectionHeader dashboardMatchHeader">
              <div>
                <span className="eyebrow">Best matches for you</span>
                <h2 id="best-matches-heading">Your top 2 jobs</h2>
                <p className="muted">Calculated instantly from your skills, salary, experience, availability and location.</p>
              </div>
              <Link className="button secondary" href="/seeker/hunt">View all matches</Link>
            </div>

            <div className="bestMatchGrid">
              {bestMatches.length ? bestMatches.map(({ job, breakdown }, index) => (
                <article className="card dashboardMatchCard" key={job.id}>
                  <div className="dashboardMatchTop">
                    <span className="matchRank">#{index + 1} Best match</span>
                    <span className={`matchScoreBadge matchScore${Math.min(4, Math.floor(breakdown.score / 20))}`}>{breakdown.score}% Match</span>
                  </div>

                  <span className="eyebrow">{job.category} · Damak-{job.ward}</span>
                  <h3><Link href={`/jobs/${job.id}`}>{job.title}</Link></h3>
                  <p className="companyName">{job.businesses?.business_name || 'Local employer'}</p>

                  <div className="vacancyFacts">
                    <span><b>NPR {money(job.salary_min)}–{money(job.salary_max)}</b></span>
                    <span>{employmentLabel(job.employment_type)}</span>
                  </div>

                  <div className="dashboardReasons">
                    {breakdown.positives.slice(0, 2).map((reason, i) => <p className="positive" key={i}>✓ {reason}</p>)}
                    {breakdown.mismatches.slice(0, 1).map((reason, i) => <p className="warning" key={i}>⚠ {reason}</p>)}
                  </div>

                  <Link className="button secondary full" href={`/jobs/${job.id}`}>View job</Link>
                </article>
              )) : (
                <div className="card empty bestMatchEmpty">
                  <h3>No open vacancies yet</h3>
                  <p className="muted">Your best matches will appear here as soon as employers post jobs.</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="finderCallout dashboardProfileCta">
            <div>
              <span className="eyebrow">Personalized matching</span>
              <h2>Build your job profile and find the best match.</h2>
              <p>Add your skills, expected salary, availability and preferences once.</p>
            </div>
            <Link className="button" href="/seeker/profile">Create profile now</Link>
          </div>
        )}
      </section>
    )
  }

  if (profile.role === 'employer') {
    const [{ data: business }, { count: jobs }, { data: anonymousSignals }] = await Promise.all([
      supabase.from('businesses').select('id, business_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('employer_id', user.id),
      supabase.rpc('search_anonymous_candidates', {
        p_skill: null,
        p_salary_min: null,
        p_salary_max: null,
        p_available_at: null,
        p_max_distance_km: null,
        p_ward: null,
      }),
    ])
    const talentCount = Array.isArray(anonymousSignals) ? anonymousSignals.length : 0

    return (
      <section className="container">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Employer dashboard</span>
            <h1>{business?.business_name || profile.full_name}</h1>
            <p className="muted">Post local vacancies and review applicants ranked by compatibility.</p>
          </div>
          <Link className="button" href="/employer/jobs/new">Post vacancy</Link>
        </div>
        <div className="grid">
          <div className="card kpi"><span className="muted">Business profile</span><span className="stat">{business ? 'Ready' : 'Incomplete'}</span><Link href="/employer/profile">Edit profile →</Link></div>
          <div className="card kpi"><span className="muted">Vacancies</span><span className="stat">{jobs || 0}</span><Link href="/employer/jobs">Manage vacancies →</Link></div>
          <div className="card kpi"><span className="muted">Available talent</span><span className="stat">{talentCount}</span><Link href="/employer/talent">Browse anonymous talent →</Link></div>
          <div className="card kpi"><span className="muted">Hiring</span><span className="stat">AI-ranked</span><span className="muted">Recommendations never auto-reject applicants.</span></div>
        </div>
      </section>
    )
  }

  return <section className="container"><span className="eyebrow">Admin</span><h1>Moderation</h1><Link className="button" href="/admin">Open admin panel</Link></section>
}
