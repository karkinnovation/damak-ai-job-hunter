import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { calculateMatch, fallbackExplanation } from '@/lib/matching'
import { MatchCard } from '@/components/MatchCard'
import { AIExplanation } from '@/components/AIExplanation'

export const dynamic = 'force-dynamic'

export default async function HuntJobs() {
  const { supabase, user } = await requireRole(['job_seeker'])

  const [{ data: seeker }, { data: jobs }] = await Promise.all([
    supabase
      .from('job_seeker_profiles')
      .select('skills,experience_months,education_level,expected_salary_min,expected_salary_max,employment_type,available_from,available_until,max_travel_km,latitude,longitude,ward,city,district,province,preferred_categories')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('jobs')
      .select('id,title,category,ward,city,district,province,salary_min,salary_max,employment_type,required_skills,preferred_skills,experience_required_months,education_requirement,working_start,working_end,latitude,longitude,businesses(business_name)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  if (!seeker) redirect('/seeker/profile?error=' + encodeURIComponent('Complete your profile before hunting for jobs.'))

  const scored = (jobs || []).map((job: any) => {
    const breakdown = calculateMatch({
      seeker: {
        skills: seeker.skills || [], experience_months: seeker.experience_months, education_level: seeker.education_level,
        expected_salary_min: seeker.expected_salary_min, expected_salary_max: seeker.expected_salary_max,
        employment_type: seeker.employment_type, available_from: String(seeker.available_from).slice(0, 5), available_until: String(seeker.available_until).slice(0, 5),
        max_travel_km: Number(seeker.max_travel_km), latitude: seeker.latitude, longitude: seeker.longitude, ward: seeker.ward, city: seeker.city, district: seeker.district, province: seeker.province,
        preferred_categories: seeker.preferred_categories || [],
      },
      job: {
        required_skills: job.required_skills || [], preferred_skills: job.preferred_skills || [], experience_required_months: job.experience_required_months,
        education_requirement: job.education_requirement, salary_min: job.salary_min, salary_max: job.salary_max, employment_type: job.employment_type,
        working_start: String(job.working_start).slice(0, 5), working_end: String(job.working_end).slice(0, 5), latitude: job.latitude, longitude: job.longitude, ward: job.ward, city: job.city, district: job.district, province: job.province, category: job.category,
      },
    })
    return { job, breakdown }
  }).sort((a, b) => b.breakdown.score - a.breakdown.score)

  const strongCount = scored.filter(({ breakdown }) => breakdown.score >= 70).length

  return (
    <section className="container huntPage">
      <div className="sectionHeader huntHeader">
        <div>
          <span className="eyebrow">AI Job Match</span>
          <h1>Your best local matches</h1>
          <p className="muted">Scores load instantly from your profile. AI explanations load separately, so Gemini never blocks the results page.</p>
        </div>
        <Link className="button secondary" href="/seeker/profile">Edit profile</Link>
      </div>

      <div className="matchSummary">
        <div className="card compactStat"><span className="muted">Jobs checked</span><strong>{scored.length}</strong></div>
        <div className="card compactStat"><span className="muted">Strong matches</span><strong>{strongCount}</strong></div>
        <div className="card compactStat"><span className="muted">Best match</span><strong>{scored[0]?.breakdown.score ?? 0}%</strong></div>
      </div>

      <div className="matchList">
        {scored.length ? scored.map(({ job, breakdown }, index) => {
          const fallback = fallbackExplanation(breakdown.score, breakdown.positives, breakdown.mismatches)
          return (
            <MatchCard
              key={job.id}
              job={{ id: job.id, title: job.title, category: job.category, ward: job.ward, city: job.city, district: job.district, province: job.province, salary_min: job.salary_min, salary_max: job.salary_max, business_name: job.businesses?.business_name }}
              score={breakdown.score}
              explanation={<AIExplanation jobId={job.id} fallback={fallback} auto={index < 2} />}
              positives={breakdown.positives}
              mismatches={breakdown.mismatches}
            />
          )
        }) : (
          <div className="card empty"><h3>No open vacancies</h3><p className="muted">New local vacancies will appear here when employers post them.</p><Link className="button secondary" href="/jobs">Browse jobs</Link></div>
        )}
      </div>
    </section>
  )
}
