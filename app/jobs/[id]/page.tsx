import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { ApplicationStatus } from '@/components/ApplicationStatus'

async function apply(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['job_seeker'])
  const jobId = String(formData.get('job_id') || '')
  const { data: seeker } = await supabase.from('job_seeker_profiles').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!seeker) redirect('/seeker/profile?error=' + encodeURIComponent('Complete your profile before applying.'))
  const { error } = await supabase.from('applications').insert({ job_id:jobId, job_seeker_id:user.id, status:'applied' })
  if (error && error.code !== '23505') redirect(`/jobs/${jobId}?error=` + encodeURIComponent(error.message))
  revalidatePath('/seeker/applications'); redirect('/seeker/applications')
}

export default async function JobDetails({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<{error?:string}> }) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: job } = await supabase.from('jobs').select('*,businesses(business_name,business_type)').eq('id',id).eq('status','open').maybeSingle()
  if (!job) notFound()
  const { data: { user } } = await supabase.auth.getUser()
  let profile:any = null, existingApplication:any = null
  if (user) {
    const p = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle(); profile = p.data
    if (profile?.role === 'job_seeker') { const a = await supabase.from('applications').select('id,status').eq('job_id',id).eq('job_seeker_id',user.id).maybeSingle(); existingApplication = a.data }
  }
  return <section className="narrow"><span className="eyebrow">{job.category} · Damak-{job.ward}</span><h1>{job.title}</h1><p className="muted">{job.businesses?.business_name} · NPR {job.salary_min.toLocaleString()}–{job.salary_max.toLocaleString()}</p>{error && <p className="error">{error}</p>}
    <div className="card"><div className="grid2"><div><span className="muted">Type</span><h3>{String(job.employment_type).split('_').map((word:string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</h3></div><div><span className="muted">Hours</span><h3>{String(job.working_start).slice(0,5)}–{String(job.working_end).slice(0,5)}</h3></div><div><span className="muted">Experience</span><h3>{job.experience_required_months ? `${job.experience_required_months} months` : 'Not required'}</h3></div><div><span className="muted">Openings</span><h3>{job.number_of_openings}</h3></div></div><hr style={{border:0,borderTop:'1px solid var(--line)',margin:'22px 0'}}/><h3>About the job</h3><p style={{whiteSpace:'pre-wrap',lineHeight:1.7}}>{job.description}</p><h3>Required skills</h3><p>{job.required_skills?.length ? job.required_skills.map((s:string)=><span className="pill" key={s} style={{marginRight:6}}>{s}</span>) : 'No specific required skills'}</p>{job.preferred_skills?.length > 0 && <><h3>Preferred skills</h3><p>{job.preferred_skills.map((s:string)=><span className="pill" key={s} style={{marginRight:6}}>{s}</span>)}</p></>}
      {!user && <a className="button" href="/auth">Login to apply</a>}{profile?.role === 'job_seeker' && (existingApplication ? <div className="existingApplication"><p className="muted">You already applied. Current status:</p><ApplicationStatus status={existingApplication.status} compact /><a className="button secondary small" href="/seeker/applications">Track application</a></div> : <form action={apply}><input type="hidden" name="job_id" value={job.id}/><button className="button">Apply now</button></form>)}
    </div>
  </section>
}
