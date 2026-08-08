import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JOB_CATEGORIES } from '@/lib/constants'

type SearchParams = Promise<{ q?: string; category?: string; ward?: string }>

function money(value: number) {
  return new Intl.NumberFormat('en-NP').format(value)
}

export default async function Jobs({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const q = (params.q || '').trim().toLowerCase()
  const category = (params.category || '').trim()
  const ward = (params.ward || '').trim()

  const supabase = await createClient()
  const { data } = await supabase.from('jobs').select('id,title,description,category,ward,salary_min,salary_max,employment_type,working_start,working_end,businesses(business_name)').eq('status','open').order('created_at',{ascending:false}).limit(100)

  const jobs = (data || []).filter((job: any) => {
    const haystack = `${job.title} ${job.description || ''} ${job.category} ${job.businesses?.business_name || ''}`.toLowerCase()
    return (!q || haystack.includes(q)) && (!category || job.category === category) && (!ward || String(job.ward) === ward)
  })

  return <section className="container">
    <div className="sectionHeader"><div><span className="eyebrow">Local vacancies</span><h1>Find a job</h1><p className="muted">Search by job, category or ward. Sign in for compatibility-ranked matches.</p></div><Link className="button" href="/seeker/hunt">✦ Find my best matches</Link></div>

    <form className="jobSearch compactSearch" action="/jobs" method="get">
      <div className="searchMain"><span className="searchIcon" aria-hidden="true">⌕</span><input name="q" defaultValue={params.q || ''} placeholder="Search title, skill or company" /></div>
      <select name="category" defaultValue={category}><option value="">All categories</option>{JOB_CATEGORIES.map(item => <option key={item}>{item}</option>)}</select>
      <select name="ward" defaultValue={ward}><option value="">Any ward</option>{Array.from({length:10},(_,i)=>i+1).map(n=><option key={n} value={n}>Damak-{n}</option>)}</select>
      <button className="button" type="submit">Search</button>
    </form>

    {(q || category || ward) && <div className="filterSummary"><span>{jobs.length} result{jobs.length === 1 ? '' : 's'}</span><Link href="/jobs">Clear filters</Link></div>}

    <div className="list">{jobs.length ? jobs.map((j:any) => <article className="card jobRow" key={j.id}><div><span className="eyebrow">{j.category}</span><h3>{j.title}</h3><div className="meta"><span>{j.businesses?.business_name || 'Local employer'}</span><span>Damak-{j.ward}</span><span>NPR {money(j.salary_min)}–{money(j.salary_max)}</span><span>{j.employment_type.replace('_',' ')}</span></div></div><Link className="button secondary" href={`/jobs/${j.id}`}>View vacancy</Link></article>) : <div className="card empty"><h3>No matching vacancies</h3><p className="muted">Try a broader search or clear the filters.</p><Link className="button" href="/jobs">Show all jobs</Link></div>}</div>
  </section>
}
