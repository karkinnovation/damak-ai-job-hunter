import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { calculateMatch, fallbackExplanation } from '@/lib/matching'

export default async function Applications() {
  const { supabase, user } = await requireRole(['job_seeker'])
  const [{ data: apps }, { data: seeker }] = await Promise.all([
    supabase.from('applications').select('id,status,created_at,job_id,jobs(*)').eq('job_seeker_id', user.id).order('created_at', { ascending: false }),
    supabase.from('job_seeker_profiles').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  const jobIds = (apps || []).map((a: any) => a.job_id)
  const { data: matches } = jobIds.length
    ? await supabase.from('match_results').select('job_id,score,explanation').eq('job_seeker_id', user.id).in('job_id', jobIds)
    : { data: [] as any[] }
  const matchMap = new Map((matches || []).map((m: any) => [m.job_id, m]))

  const rows = (apps || []).map((app: any) => {
    const stored: any = matchMap.get(app.job_id)
    if (stored || !seeker || !app.jobs) return { ...app, match: stored || null }

    const job = app.jobs
    const breakdown = calculateMatch({
      seeker: {
        skills: seeker.skills || [], experience_months: seeker.experience_months, education_level: seeker.education_level,
        expected_salary_min: seeker.expected_salary_min, expected_salary_max: seeker.expected_salary_max, employment_type: seeker.employment_type,
        available_from: String(seeker.available_from).slice(0, 5), available_until: String(seeker.available_until).slice(0, 5), max_travel_km: Number(seeker.max_travel_km),
        latitude: seeker.latitude, longitude: seeker.longitude, ward: seeker.ward, preferred_categories: seeker.preferred_categories || [],
      },
      job: {
        required_skills: job.required_skills || [], preferred_skills: job.preferred_skills || [], experience_required_months: job.experience_required_months,
        education_requirement: job.education_requirement, salary_min: job.salary_min, salary_max: job.salary_max, employment_type: job.employment_type,
        working_start: String(job.working_start).slice(0, 5), working_end: String(job.working_end).slice(0, 5), latitude: job.latitude, longitude: job.longitude, ward: job.ward, category: job.category,
      },
    })
    return { ...app, match: { score: breakdown.score, explanation: fallbackExplanation(breakdown.score, breakdown.positives, breakdown.mismatches) } }
  })

  return <section className="container"><div className="sectionHeader"><div><span className="eyebrow">Job seeker</span><h1>My applications</h1><p className="muted">Track applications and revisit the compatibility behind each choice.</p></div><Link className="button" href="/seeker/hunt">AI Hunt</Link></div><div className="list">{rows.length ? rows.map((a: any) => <article className="card jobRow" key={a.id}><div><h3>{a.jobs?.title}</h3><div className="meta"><span>Damak-{a.jobs?.ward}</span><span className="pill">{a.status}</span>{a.match?.score != null && <span className="pill">{a.match.score}% match</span>}</div>{a.match?.explanation && <p className="muted applicationReason">{a.match.explanation}</p>}</div><Link className="button secondary" href={`/jobs/${a.jobs?.id}`}>View</Link></article>) : <div className="card empty"><h3>No applications yet</h3><p className="muted">Run AI Job Hunter and apply to a suitable vacancy.</p><Link className="button" href="/seeker/hunt">Hunt jobs</Link></div>}</div></section>
}
