import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Jobs() {
  const supabase = await createClient()
  const { data: jobs } = await supabase.from('jobs').select('id,title,category,ward,salary_min,salary_max,employment_type,working_start,working_end,businesses(business_name)').eq('status','open').order('created_at',{ascending:false}).limit(100)
  return <section className="container"><div className="sectionHeader"><div><span className="eyebrow">Damak vacancies</span><h1>Browse local jobs</h1><p className="muted">Or sign in as a job seeker and use AI Hunt to rank these for your profile.</p></div><Link className="button" href="/seeker/hunt">✨ Hunt Jobs For Me</Link></div>
    <div className="list">{jobs?.length ? jobs.map((j:any) => <article className="card jobRow" key={j.id}><div><span className="eyebrow">{j.category}</span><h3>{j.title}</h3><div className="meta"><span>{j.businesses?.business_name || 'Local employer'}</span><span>Damak-{j.ward}</span><span>NPR {j.salary_min.toLocaleString()}–{j.salary_max.toLocaleString()}</span><span>{j.employment_type.replace('_',' ')}</span></div></div><Link className="button secondary" href={`/jobs/${j.id}`}>View</Link></article>) : <div className="card empty"><h3>No open jobs yet</h3><p className="muted">Seed demo data or post a vacancy as an employer.</p></div>}</div>
  </section>
}
