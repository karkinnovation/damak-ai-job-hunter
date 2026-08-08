import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JOB_CATEGORIES } from '@/lib/constants'
import RefreshFilterReset from '@/components/RefreshFilterReset'

type SearchParams = Promise<{ q?: string; category?: string; skill?: string; minSalary?: string }>

function money(value: number) {
  return new Intl.NumberFormat('en-NP').format(value)
}

function normalize(value?: string) {
  return (value || '').trim().toLowerCase()
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const q = normalize(params.q)
  const category = (params.category || '').trim()
  const skill = normalize(params.skill)
  const minSalary = Number(params.minSalary || 0) || 0

  const supabase = await createClient()
  const { data } = await supabase
    .from('jobs')
    .select('id,title,description,category,ward,salary_min,salary_max,employment_type,required_skills,preferred_skills,created_at,businesses(business_name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(80)

  const jobs = (data || []).filter((job: any) => {
    const skills = [...(job.required_skills || []), ...(job.preferred_skills || [])]
    const haystack = `${job.title} ${job.description || ''} ${job.category} ${job.businesses?.business_name || ''} ${skills.join(' ')}`.toLowerCase()
    const skillHaystack = skills.join(' ').toLowerCase()

    return (
      (!q || haystack.includes(q)) &&
      (!category || job.category === category) &&
      (!skill || skillHaystack.includes(skill)) &&
      (!minSalary || Number(job.salary_max) >= minSalary)
    )
  }).slice(0, 12)

  const isFiltering = Boolean(q || category || skill || minSalary)
  const popular = ['Retail / Sales', 'Accounting / Finance', 'Computer Operator', 'IT / Software']

  return (
    <>
      <RefreshFilterReset basePath="/" />
      <section className="jobHero">
        <div className="jobHeroInner">
          <div className="heroCopy">
            <span className="eyebrow">अवसर · Local jobs made easier</span>
            <h1>काम खोज्न सजिलो.<br/><span>Find the job that fits.</span></h1>
            <p>Search local vacancies first. When you want smarter recommendations, Awasar can rank jobs by your skills, salary, experience, availability and location.</p>
          </div>

          <form className="jobSearch jobSearchHome" action="/" method="get">
            <div className="searchMain">
              <span className="searchIcon" aria-hidden="true">⌕</span>
              <input name="q" defaultValue={params.q || ''} placeholder="Job title, skill or company" aria-label="Search jobs" />
            </div>
            <select name="category" defaultValue={category} aria-label="Job category">
              <option value="">All categories</option>
              {JOB_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select name="minSalary" defaultValue={params.minSalary || ''} aria-label="Expected salary">
              <option value="">Expected salary</option>
              <option value="15000">At least NPR 15,000</option>
              <option value="20000">At least NPR 20,000</option>
              <option value="25000">At least NPR 25,000</option>
              <option value="30000">At least NPR 30,000</option>
              <option value="40000">At least NPR 40,000</option>
            </select>
            <input name="skill" defaultValue={params.skill || ''} placeholder="Skill (optional), e.g. Excel" aria-label="Required skill" />
            <button className="button searchButton" type="submit">Find jobs</button>
          </form>

          <div className="quickCategories" aria-label="Popular job categories">
            <span>Popular:</span>
            {popular.map(item => (
              <Link
                className={category === item ? 'active' : ''}
                key={item}
                href={`/?category=${encodeURIComponent(item)}#vacancies`}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container homeJobs" id="vacancies">
        <div className="sectionHeader homeSectionHeader">
          <div>
            <span className="eyebrow">{isFiltering ? 'Search results' : 'Latest vacancies'}</span>
            <h2>{isFiltering ? `${jobs.length} matching job${jobs.length === 1 ? '' : 's'}` : 'Jobs you can apply for now'}</h2>
            <p className="muted">Search by role, category, expected salary or skill — or create a profile for compatibility-ranked recommendations.</p>
          </div>
          <div className="heroActions">
            {isFiltering && <Link className="button secondary" href="/#vacancies">Clear filters</Link>}
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
              {job.required_skills?.length > 0 && <div className="skillPreview">{job.required_skills.slice(0, 3).map((s: string) => <span className="pill" key={s}>{s}</span>)}</div>}
              <p className="vacancyDescription">{job.description}</p>
              <Link className="button secondary full" href={`/jobs/${job.id}`}>View vacancy</Link>
            </article>
          )) : (
            <div className="card empty vacancyEmpty">
              <h3>No jobs matched those filters</h3>
              <p className="muted">Try a broader keyword, another category, a different skill, or lower the salary filter.</p>
              <Link className="button" href="/#vacancies">Show all vacancies</Link>
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
