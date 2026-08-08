import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JOB_CATEGORIES } from '@/lib/constants'
import RefreshFilterReset from '@/components/RefreshFilterReset'

type SearchParams = Promise<{ q?: string; category?: string; skill?: string; salaryRange?: string }>

function money(value: number) {
  return new Intl.NumberFormat('en-NP').format(value)
}

function normalize(value?: string) {
  return (value || '').trim().toLowerCase()
}

function salaryMatches(job: any, salaryRange: string) {
  if (!salaryRange) return true
  const min = Number(job.salary_min || 0)
  const max = Number(job.salary_max || 0)

  if (salaryRange === 'below25') return min < 25000
  if (salaryRange === '25to75') return max >= 25000 && min < 75000
  if (salaryRange === '75plus') return max >= 75000
  return true
}

function employmentLabel(value: string) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default async function Jobs({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const q = normalize(params.q)
  const category = (params.category || '').trim()
  const skill = normalize(params.skill)
  const salaryRange = (params.salaryRange || '').trim()

  const supabase = await createClient()
  const { data } = await supabase
    .from('jobs')
    .select('id,title,description,category,ward,salary_min,salary_max,employment_type,working_start,working_end,required_skills,preferred_skills,businesses(business_name)')
    .eq('status','open')
    .order('created_at',{ascending:false})
    .limit(100)

  const jobs = (data || []).filter((job: any) => {
    const skills = [...(job.required_skills || []), ...(job.preferred_skills || [])]
    const haystack = `${job.title} ${job.description || ''} ${job.category} ${job.businesses?.business_name || ''} ${skills.join(' ')}`.toLowerCase()
    const skillHaystack = skills.join(' ').toLowerCase()
    return (
      (!q || haystack.includes(q)) &&
      (!category || job.category === category) &&
      (!skill || skillHaystack.includes(skill)) &&
      salaryMatches(job, salaryRange)
    )
  })

  return (
    <section className="container">
      <RefreshFilterReset basePath="/jobs" />
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Local vacancies</span>
          <h1>Find a job</h1>
          <p className="muted">Search by role, category, expected salary or skill.</p>
        </div>
        <p className="smartMatchText">✦ Complete your profile to get compatibility-ranked job recommendations.</p>
      </div>

      <form className="jobSearch compactSearch" action="/jobs" method="get">
        <div className="searchMain"><span className="searchIcon" aria-hidden="true">⌕</span><input name="q" defaultValue={params.q || ''} placeholder="Search title, skill or company" /></div>
        <select name="category" defaultValue={category}><option value="">All categories</option>{JOB_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select name="salaryRange" defaultValue={salaryRange} aria-label="Expected salary">
          <option value="">Expected salary</option>
          <option value="below25">Below NPR 25,000</option>
          <option value="25to75">NPR 25,000 – 75,000</option>
          <option value="75plus">NPR 75,000 and above</option>
        </select>
        <input name="skill" defaultValue={params.skill || ''} placeholder="Skill (optional), e.g. Excel" />
        <button className="button" type="submit">Find jobs</button>
      </form>

      {(q || category || skill || salaryRange) && <div className="filterSummary"><span>{jobs.length} result{jobs.length === 1 ? '' : 's'}</span><Link href="/jobs">Clear filters</Link></div>}

      <div className="list">
        {jobs.length ? jobs.map((j:any) => (
          <article className="card jobRow" key={j.id}>
            <div>
              <span className="eyebrow">{j.category}</span>
              <h3>{j.title}</h3>
              <div className="meta"><span>{j.businesses?.business_name || 'Local employer'}</span><span>Damak-{j.ward}</span><span>NPR {money(j.salary_min)}–{money(j.salary_max)}</span><span>{employmentLabel(j.employment_type)}</span></div>
              {j.required_skills?.length > 0 && <div className="skillPreview">{j.required_skills.slice(0, 4).map((s:string) => <span className="pill" key={s}>{s}</span>)}</div>}
            </div>
            <Link className="button secondary" href={`/jobs/${j.id}`}>View vacancy</Link>
          </article>
        )) : (
          <div className="card empty"><h3>No matching vacancies</h3><p className="muted">Try a broader search or clear the filters.</p><Link className="button" href="/jobs">Show all jobs</Link></div>
        )}
      </div>
    </section>
  )
}
