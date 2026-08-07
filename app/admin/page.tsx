import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'

async function moderateJob(formData: FormData) {
  'use server'
  const { supabase } = await requireRole(['admin'])
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')
  if (!['open','closed'].includes(status)) return
  await supabase.from('jobs').update({status}).eq('id',id)
  revalidatePath('/admin'); revalidatePath('/jobs')
}

export default async function Admin() {
  const { supabase } = await requireRole(['admin'])
  const [{ data: jobs }, { count: users }, { count: applications }] = await Promise.all([
    supabase.from('jobs').select('id,title,status,ward,created_at,businesses(business_name)').order('created_at',{ascending:false}).limit(30),
    supabase.from('profiles').select('*',{count:'exact',head:true}),
    supabase.from('applications').select('*',{count:'exact',head:true}),
  ])
  return <section className="container"><span className="eyebrow">Minimal admin</span><h1>Moderation</h1><div className="grid" style={{margin:'24px 0'}}><div className="card"><span className="muted">Users</span><div className="stat">{users || 0}</div></div><div className="card"><span className="muted">Applications</span><div className="stat">{applications || 0}</div></div><div className="card"><span className="muted">Purpose</span><div className="stat">Moderate</div></div></div><div className="card tableWrap"><table className="table"><thead><tr><th>Vacancy</th><th>Employer</th><th>Status</th><th>Action</th></tr></thead><tbody>{jobs?.map((j:any)=><tr key={j.id}><td>{j.title}<br/><span className="muted">Damak-{j.ward}</span></td><td>{j.businesses?.business_name}</td><td>{j.status}</td><td><form action={moderateJob}><input type="hidden" name="id" value={j.id}/><input type="hidden" name="status" value={j.status === 'open' ? 'closed' : 'open'}/><button className="button small secondary">{j.status === 'open' ? 'Close' : 'Reopen'}</button></form></td></tr>)}</tbody></table></div></section>
}
