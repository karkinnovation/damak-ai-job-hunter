import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { calculateMatch, fallbackExplanation } from '@/lib/matching'
import { explainMatch } from '@/lib/ai'

async function setStatus(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['employer'])
  const applicationId = String(formData.get('application_id') || '')
  const jobId = String(formData.get('job_id') || '')
  const status = String(formData.get('status') || '')
  if (!['applied','reviewed','shortlisted','rejected'].includes(status)) return
  const { data: app } = await supabase.from('applications').select('id,jobs!inner(employer_id)').eq('id',applicationId).maybeSingle()
  if (!app || (app.jobs as any)?.employer_id !== user.id) return
  await supabase.from('applications').update({ status }).eq('id',applicationId)
  revalidatePath(`/employer/jobs/${jobId}/applicants`)
}

export const dynamic = 'force-dynamic'

export default async function Applicants({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params
  const { supabase, user } = await requireRole(['employer'])
  const { data: job } = await supabase.from('jobs').select('*').eq('id',id).eq('employer_id',user.id).maybeSingle()
  if (!job) notFound()
  const { data: apps } = await supabase.from('applications').select('id,job_seeker_id,status,created_at').eq('job_id',id).order('created_at',{ascending:true}).limit(50)

  const scored = (await Promise.all((apps || []).map(async app => {
    const [{ data: profile }, { data: seeker }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id',app.job_seeker_id).maybeSingle(),
      supabase.from('job_seeker_profiles').select('*').eq('user_id',app.job_seeker_id).maybeSingle(),
    ])
    if (!seeker) return null
    const breakdown = calculateMatch({
      seeker: { skills:seeker.skills || [], experience_months:seeker.experience_months, education_level:seeker.education_level, expected_salary_min:seeker.expected_salary_min, expected_salary_max:seeker.expected_salary_max, employment_type:seeker.employment_type, available_from:String(seeker.available_from).slice(0,5), available_until:String(seeker.available_until).slice(0,5), max_travel_km:Number(seeker.max_travel_km), latitude:seeker.latitude, longitude:seeker.longitude, ward:seeker.ward, preferred_categories:seeker.preferred_categories || [] },
      job: { required_skills:job.required_skills || [], preferred_skills:job.preferred_skills || [], experience_required_months:job.experience_required_months, education_requirement:job.education_requirement, salary_min:job.salary_min, salary_max:job.salary_max, employment_type:job.employment_type, working_start:String(job.working_start).slice(0,5), working_end:String(job.working_end).slice(0,5), latitude:job.latitude, longitude:job.longitude, ward:job.ward, category:job.category },
    })
    return { app, profile, seeker, breakdown }
  }))).filter(Boolean) as Array<{app:any;profile:any;seeker:any;breakdown:ReturnType<typeof calculateMatch>}>

  scored.sort((a,b)=>b.breakdown.score-a.breakdown.score)

  // Keep LLM cost bounded for larger applicant lists; deterministic reasons remain available for everyone.
  const clean = await Promise.all(scored.map(async (row, index) => {
    const explanation = index < 20
      ? await explainMatch({ score:row.breakdown.score, breakdown:row.breakdown, seeker:{skills:row.seeker.skills,experience_months:row.seeker.experience_months,education_level:row.seeker.education_level,expected_salary:[row.seeker.expected_salary_min,row.seeker.expected_salary_max],employment_type:row.seeker.employment_type,availability:[row.seeker.available_from,row.seeker.available_until]}, job:{title:job.title,required_skills:job.required_skills,preferred_skills:job.preferred_skills,experience_required_months:job.experience_required_months,salary:[job.salary_min,job.salary_max],employment_type:job.employment_type,hours:[job.working_start,job.working_end]} })
      : fallbackExplanation(row.breakdown.score, row.breakdown.positives, row.breakdown.mismatches)
    await supabase.from('match_results').upsert({job_id:id,job_seeker_id:row.app.job_seeker_id,score:row.breakdown.score,breakdown:row.breakdown,explanation,calculated_at:new Date().toISOString()},{onConflict:'job_id,job_seeker_id'})
    return { ...row, explanation }
  }))

  return <section className="container"><div className="sectionHeader"><div><span className="eyebrow">Employer · Candidate ranking</span><h1>{job.title}</h1><p className="muted">Ranked by job compatibility. Review every applicant yourself; AI never automatically rejects candidates.</p></div><a className="button secondary" href="/employer/jobs">Back to vacancies</a></div>
    <div className="list">{clean.length ? clean.map((r,index)=><article className="card" key={r.app.id}><div className="cardTop"><div><span className="eyebrow">#{index+1} recommendation</span><h3>{r.profile?.full_name || 'Applicant'}</h3><p className="muted">{r.seeker.experience_months} months experience · Damak-{r.seeker.ward}</p></div><div className={`score score${Math.min(4, Math.floor(r.breakdown.score/20))}`}>{r.breakdown.score}%<small>match</small></div></div><p>{r.explanation}</p><div className="reasonGrid"><div>{r.breakdown.positives.slice(0,3).map((x,i)=><p className="positive" key={i}>✓ {x}</p>)}</div><div>{r.breakdown.mismatches.slice(0,2).map((x,i)=><p className="warning" key={i}>⚠ {x}</p>)}</div></div><p><span className="pill">Current: {r.app.status}</span></p><div className="heroActions"><form action={setStatus}><input type="hidden" name="application_id" value={r.app.id}/><input type="hidden" name="job_id" value={id}/><input type="hidden" name="status" value="shortlisted"/><button className="button">Shortlist</button></form><form action={setStatus}><input type="hidden" name="application_id" value={r.app.id}/><input type="hidden" name="job_id" value={id}/><input type="hidden" name="status" value="reviewed"/><button className="button secondary">Mark reviewed</button></form><form action={setStatus}><input type="hidden" name="application_id" value={r.app.id}/><input type="hidden" name="job_id" value={id}/><input type="hidden" name="status" value="rejected"/><button className="button secondary">Reject manually</button></form></div></article>) : <div className="card empty"><h3>No applicants yet</h3><p className="muted">Ask your demo job-seeker account to apply.</p></div>}</div>
  </section>
}
