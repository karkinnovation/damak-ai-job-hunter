import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { calculateMatch, fallbackExplanation } from '@/lib/matching'
import { explainMatch } from '@/lib/ai'
import { MatchCard } from '@/components/MatchCard'

export const dynamic = 'force-dynamic'

export default async function HuntJobs() {
  const { supabase, user } = await requireRole(['job_seeker'])
  const { data: seeker } = await supabase.from('job_seeker_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (!seeker) redirect('/seeker/profile?error=' + encodeURIComponent('Complete your profile before hunting for jobs.'))

  const { data: jobs } = await supabase.from('jobs').select('*,businesses(business_name)').eq('status','open').limit(50)

  const scored = (jobs || []).map((job:any) => {
    const breakdown = calculateMatch({
      seeker: {
        skills: seeker.skills || [], experience_months: seeker.experience_months, education_level: seeker.education_level,
        expected_salary_min: seeker.expected_salary_min, expected_salary_max: seeker.expected_salary_max,
        employment_type: seeker.employment_type, available_from: String(seeker.available_from).slice(0,5), available_until: String(seeker.available_until).slice(0,5),
        max_travel_km: Number(seeker.max_travel_km), latitude: seeker.latitude, longitude: seeker.longitude, ward: seeker.ward,
        preferred_categories: seeker.preferred_categories || [],
      },
      job: {
        required_skills: job.required_skills || [], preferred_skills: job.preferred_skills || [], experience_required_months: job.experience_required_months,
        education_requirement: job.education_requirement, salary_min: job.salary_min, salary_max: job.salary_max, employment_type: job.employment_type,
        working_start: String(job.working_start).slice(0,5), working_end: String(job.working_end).slice(0,5), latitude: job.latitude, longitude: job.longitude, ward: job.ward, category: job.category,
      },
    })
    return { job, breakdown }
  }).sort((a,b) => b.breakdown.score - a.breakdown.score)

  // Keep AI usage bounded: explain only the top 10 with the model; deterministic explanations cover the rest.
  const results = await Promise.all(scored.map(async ({ job, breakdown }, index) => {
    const explanation = index < 10
      ? await explainMatch({
          score: breakdown.score, breakdown,
          seeker: { skills:seeker.skills, experience_months:seeker.experience_months, education_level:seeker.education_level, expected_salary:[seeker.expected_salary_min,seeker.expected_salary_max], employment_type:seeker.employment_type, availability:[seeker.available_from,seeker.available_until], max_travel_km:seeker.max_travel_km, preferred_categories:seeker.preferred_categories },
          job: { title:job.title, category:job.category, required_skills:job.required_skills, preferred_skills:job.preferred_skills, experience_required_months:job.experience_required_months, education_requirement:job.education_requirement, salary:[job.salary_min,job.salary_max], employment_type:job.employment_type, hours:[job.working_start,job.working_end], ward:job.ward },
        })
      : fallbackExplanation(breakdown.score, breakdown.positives, breakdown.mismatches)

    await supabase.from('match_results').upsert({ job_id:job.id, job_seeker_id:user.id, score:breakdown.score, breakdown, explanation, calculated_at:new Date().toISOString() }, { onConflict:'job_id,job_seeker_id' })
    return { job, breakdown, explanation }
  }))

  return <section className="container"><div className="sectionHeader"><div><span className="eyebrow">AI Job Hunter</span><h1>Your best local matches</h1><p className="muted">Ranked from real compatibility. The percentage is calculated by the matching engine; AI explains it.</p></div><a className="button secondary" href="/seeker/profile">Edit profile</a></div>
    <div className="list">{results.length ? results.map(({job,breakdown,explanation}) => <MatchCard key={job.id} job={{id:job.id,title:job.title,category:job.category,ward:job.ward,salary_min:job.salary_min,salary_max:job.salary_max,business_name:job.businesses?.business_name}} score={breakdown.score} explanation={explanation} positives={breakdown.positives} mismatches={breakdown.mismatches}/>) : <div className="card empty"><h3>No open vacancies</h3><p className="muted">Ask an employer account to post a vacancy first.</p></div>}</div>
  </section>
}
