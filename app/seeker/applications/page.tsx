import Link from 'next/link'
import { requireRole } from '@/lib/auth'

export default async function Applications() {
  const { supabase, user } = await requireRole(['job_seeker'])
  const { data: apps } = await supabase.from('applications').select('id,status,created_at,job_id,jobs(id,title,category,ward,salary_min,salary_max,businesses(business_name))').eq('job_seeker_id', user.id).order('created_at',{ascending:false})

  const rows = await Promise.all((apps || []).map(async (app:any) => {
    const { data: match } = await supabase.from('match_results').select('score,explanation').eq('job_id', app.job_id).eq('job_seeker_id', user.id).maybeSingle()
    return { ...app, match }
  }))

  return <section className="container"><span className="eyebrow">Job seeker</span><h1>My applications</h1><div className="list" style={{marginTop:22}}>{rows.length ? rows.map((a:any) => <article className="card jobRow" key={a.id}><div><h3>{a.jobs?.title}</h3><div className="meta"><span>{a.jobs?.businesses?.business_name}</span><span>Damak-{a.jobs?.ward}</span><span className="pill">{a.status}</span>{a.match?.score != null && <span className="pill">{a.match.score}% match</span>}</div>{a.match?.explanation && <p className="muted">{a.match.explanation}</p>}</div><Link className="button secondary" href={`/jobs/${a.jobs?.id}`}>View</Link></article>) : <div className="card empty"><h3>No applications yet</h3><p className="muted">Run AI Job Hunter and apply to a suitable vacancy.</p><Link className="button" href="/seeker/hunt">Hunt jobs</Link></div>}</div></section>
}
