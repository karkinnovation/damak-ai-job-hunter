import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { locationLabel } from '@/lib/location'

async function closeJob(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['employer'])
  const id = String(formData.get('id') || '')
  await supabase.from('jobs').update({ status:'closed' }).eq('id', id).eq('employer_id', user.id)
  revalidatePath('/employer/jobs'); revalidatePath('/jobs')
}

export default async function EmployerJobs() {
  const { supabase, user } = await requireRole(['employer'])
  const { data: jobs } = await supabase.from('jobs').select('id,title,category,ward,city,district,province,salary_min,salary_max,status,created_at,applications(count)').eq('employer_id', user.id).order('created_at',{ascending:false})
  return <section className="container"><div className="sectionHeader"><div><span className="eyebrow">Employer</span><h1>Your vacancies</h1></div><Link className="button" href="/employer/jobs/new">Post vacancy</Link></div>
    <div className="list">{jobs?.length ? jobs.map((j:any) => <article className="card jobRow" key={j.id}><div><h3>{j.title}</h3><div className="meta"><span>{j.category}</span><span>{locationLabel(j)}</span><span>NPR {j.salary_min.toLocaleString()}–{j.salary_max.toLocaleString()}</span><span className="pill">{j.status}</span></div></div><div className="heroActions"><Link className="button secondary" href={`/employer/jobs/${j.id}/applicants`}>Applicants ({j.applications?.[0]?.count || 0})</Link>{j.status === 'open' && <form action={closeJob}><input type="hidden" name="id" value={j.id}/><button className="button danger">Close</button></form>}</div></article>) : <div className="card empty"><h3>No vacancies yet</h3><p className="muted">Post your first vacancy anywhere in Nepal.</p></div>}</div>
  </section>
}
