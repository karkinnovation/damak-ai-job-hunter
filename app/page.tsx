import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JOB_CATEGORIES } from '@/lib/constants'

type SearchParams = Promise<{ q?: string; category?: string; ward?: string }>

function money(value: number) {
  return new Intl.NumberFormat('en-NP').format(value)
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const q = (params.q || '').trim().toLowerCase()
  const category = (params.category || '').trim()
  const ward = (params.ward || '').trim()

  const supabase = await createClient()
  const { data } = await supabase
    .from('jobs')
    .select('id,title,description,category,ward,salary_min,salary_max,employment_type,created_at,businesses(business_name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(60)

  const jobs = (data || []).filter((job: any) => {
    const haystack = `${job.title} ${job.description || ''} ${job.category} ${job.businesses?.business_name || ''}`.toLowerCase()
    const qOk = !q || haystack.includes(q)
    const categoryOk = !category || job.category === category
    const wardOk = !ward || String(job.ward) === ward
    return qOk && categoryOk && wardOk
  }).slice(0, 12)

  const isFiltering = Boolean(q || category || ward)

  return (
    <>
      <section className="jobHero">
        <div className="jobHeroInner">
          <div className="heroCopy">
            <span className="eyebrow">अवसर · Local jobs made easier</span>
            <h1>काम खोज्न सजिलो.<br/><span>Find the job that fits.</span></h1>
            <p>Search local vacancies first. When you want smarter recommendations, Awasar can rank jobs by your skills, salary, experience, availability and location.</p>
          </div>

          <form className="jobSearch" action="/" method="get">
            <div className="searchMain">
              <span className="searchIcon" aria-hidden="true">⌕</span>
              <input name="q" defaultValue={params.q || ''} placeholder="Job title, skill or company" aria-label="Search jobs" />
            </div>
            <select name="category" defaultValue={category} aria-label="Job category">
              <option value="">All categories</option>
              {JOB_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select name="ward" defaultValue={ward} aria-label="Damak ward">
              <option value="">Any ward</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>Damak-{n}</option>)}
            </select>
            <button className="button searchButton" type="submit">Search jobs</button>
          </form>

          <div className="quickCategories" aria-label="Popular job categories">
            <span>Popular:</span>
            {['Retail / Sales', 'Accounting / Finance', 'Computer Operator', 'IT / Software'].map(item => (
              <Link key={item} href={`/?category=${encodeURIComponent(item)}`}>{item}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container homeJobs">
        <div className="sectionHeader homeSectionHeader">
          <div>
            <span className="eyebrow">{isFiltering ? 'Search results' : 'Latest vacancies'}</span>
            <h2>{isFiltering ? `${jobs.length} matching job${jobs.length === 1 ? '' : 's'}` : 'Jobs you can apply for now'}</h2>
            <p className="muted">Browse normally, or create a profile to get compatibility-ranked recommendations.</p>
          </div>
          <div className="heroActions">
            {isFiltering && <Link className="button secondary" href="/">Clear search</Link>}
            <Link className="button" href="/seeker/hunt">✦ Find my best matches</Link>
          </div>
        </div>

        <div className="vacancyGrid">
          {jobs.length ? jobs.map((job: any) => (
            <article className="card vacancyCard" key={job.id}>
              <div className="vacancyTop">
                <span className="categoryPill">{job.category}</span>
                <span className="locationPill">Damak-{job.ward}</span>
              </div>
              <h3><Link href={`/jobs/${job.id}`}>{job.title}</Link></h3>
              <p className="companyName">{job.businesses?.business_name || 'Local employer'}</p>
              <div className="vacancyFacts">
                <span><b>NPR {money(job.salary_min)}–{money(job.salary_max)}</b></span>
                <span>{String(job.employment_type).replace('_', ' ')}</span>
              </div>
              <p className="vacancyDescription">{job.description}</p>
              <Link className="button secondary full" href={`/jobs/${job.id}`}>View vacancy</Link>
            </article>
          )) : (
            <div className="card empty vacancyEmpty">
              <h3>No jobs matched that search</h3>
              <p className="muted">Try a broader keyword, another category, or clear the filters.</p>
              <Link className="button" href="/">Show all vacancies</Link>
            </div>
          )}
        </div>

        <div className="finderCallout">
          <div>
            <span className="eyebrow">Smart matching</span>
            <h2>Too many jobs to compare?</h2>
            <p>Build one profile and let Awasar compare every vacancy against what actually matters to you—not just keywords.</p>
          </div>
          <div className="finderSteps">
            <span><b>01</b> Add your skills & preferences</span>
            <span><b>02</b> Get 0–100 compatibility scores</span>
            <span><b>03</b> Understand why each job fits</span>
          </div>
          <Link className="button" href="/auth?role=job_seeker">Create my profile</Link>
        </div>
      </section>
    </>
  )
}
