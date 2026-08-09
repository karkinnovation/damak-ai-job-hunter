import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JOB_CATEGORIES } from '@/lib/constants'
import { locationLabel } from '@/lib/location'
import RefreshFilterReset from '@/components/RefreshFilterReset'
import SearchSubmitButton from '@/components/SearchSubmitButton'
import FastSearchForm from '@/components/FastSearchForm'
import { CompanyMark } from '@/components/CompanyMark'
import { IconSearch, IconMapPin, IconBriefcase, IconArrowRight } from '@/components/Icon'

type SearchParams = Promise<{ q?: string; category?: string; skill?: string; salaryRange?: string; location?: string }>

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


function businessName(job: any) {
  const business = Array.isArray(job.businesses) ? job.businesses[0] : job.businesses
  return business?.business_name || ''
}

function employmentLabel(value: string) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const q = normalize(params.q)
  const category = (params.category || '').trim()
  const skill = normalize(params.skill)
  const salaryRange = (params.salaryRange || '').trim()
  const location = normalize(params.location)
  const isFiltering = Boolean(q || category || skill || salaryRange || location)

  const supabase = await createClient()
  let jobsQuery = supabase
    .from('jobs')
    .select('id,title,description,category,city,district,province,ward,salary_min,salary_max,employment_type,required_skills,preferred_skills,created_at,businesses(business_name)')
    .eq('status', 'open')

  if (category) jobsQuery = jobsQuery.eq('category', category)
  if (salaryRange === 'below25') jobsQuery = jobsQuery.lt('salary_min', 25000)
  if (salaryRange === '25to75') jobsQuery = jobsQuery.gte('salary_max', 25000).lt('salary_min', 75000)
  if (salaryRange === '75plus') jobsQuery = jobsQuery.gte('salary_max', 75000)

  const { data } = await jobsQuery
    .order('created_at', { ascending: false })
    .limit(isFiltering ? 100 : 50)

  const jobs = (data || []).filter((job: any) => {
    const skills = [...(job.required_skills || []), ...(job.preferred_skills || [])]
    const haystack = `${job.title} ${job.description || ''} ${job.category} ${businessName(job)} ${job.city || ''} ${job.district || ''} ${job.province || ''} ${skills.join(' ')}`.toLowerCase()
    const locationHaystack = `${job.city || ''} ${job.district || ''} ${job.province || ''}`.toLowerCase()
    const skillHaystack = skills.join(' ').toLowerCase()

    return (
      (!q || haystack.includes(q)) &&
      (!category || job.category === category) &&
      (!skill || skillHaystack.includes(skill)) &&
      (!location || locationHaystack.includes(location)) &&
      salaryMatches(job, salaryRange)
    )
  }).slice(0, 12)

  const popular = ['Retail / Sales', 'Accounting / Finance', 'Computer Operator', 'IT / Software']

  return (
    <>
      <RefreshFilterReset basePath="/" />
      <section className="jobHero">
        <div className="jobHeroInner">
          <div className="heroCopy">
            <span className="eyebrow">अवसर · Job search made easier</span>
            <h1>Find your dream job.</h1>
            <p className="heroOneLiner">
              Real vacancies from employers across Nepal — with a match score that tells you where you actually stand.
            </p>
          </div>

          <FastSearchForm className="jobSearch jobSearchHome" action="/">
            <div className="searchMain">
              <span className="searchIcon"><IconSearch size={19} /></span>
              <input name="q" defaultValue={params.q || ''} placeholder="Job title, skill or company" aria-label="Search jobs" />
            </div>
            <select name="category" defaultValue={category} aria-label="Job category">
              <option value="">All categories</option>
              {JOB_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select name="salaryRange" defaultValue={salaryRange} aria-label="Expected salary">
              <option value="">Expected salary</option>
              <option value="below25">Below NPR 25,000</option>
              <option value="25to75">NPR 25,000 – 75,000</option>
              <option value="75plus">NPR 75,000 and above</option>
            </select>
            <input name="skill" defaultValue={params.skill || ''} placeholder="Skill (optional), e.g. Excel" aria-label="Required skill" />
            <input name="location" defaultValue={params.location || ''} placeholder="City, district or province" aria-label="Job location" />
            <SearchSubmitButton />
          </FastSearchForm>

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
            {!isFiltering && <p className="homeJobsSecondary">Search across Nepal · Smart recommendations · Easy search</p>}
          </div>
          {isFiltering && <Link className="button secondary" href="/#vacancies">Clear filters</Link>}
        </div>

        <div className="vacancyGrid">
          {jobs.length ? jobs.map((job: any) => (
            <article className="card vacancyCard" key={job.id}>
              <div className="vacancyHead">
                <CompanyMark name={businessName(job)} />
                <div className="vacancyHeadText">
                  <h3><Link href={`/jobs/${job.id}`}>{job.title}</Link></h3>
                  <p className="companyName">{businessName(job) || 'Local employer'}</p>
                </div>
              </div>

              <div className="vacancyTags">
                <span className="categoryPill">{job.category}</span>
                <span className="locationPill"><IconMapPin size={12} /> {locationLabel(job)}</span>
              </div>

              <p className="vacancyDescription">{job.description}</p>

              {job.required_skills?.length > 0 && (
                <div className="skillPreview">
                  {job.required_skills.slice(0, 3).map((s: string) => <span className="pill" key={s}>{s}</span>)}
                  {job.required_skills.length > 3 && <span className="pill pillMore">+{job.required_skills.length - 3}</span>}
                </div>
              )}

              <div className="vacancyFooter">
                <div className="vacancyPay">
                  <span className="payLabel">Monthly salary</span>
                  <strong>NPR {money(job.salary_min)}–{money(job.salary_max)}</strong>
                  <span className="payType"><IconBriefcase size={12} /> {employmentLabel(job.employment_type)}</span>
                </div>
                <Link className="button secondary vacancyCta" href={`/jobs/${job.id}`}>
                  View <IconArrowRight size={15} />
                </Link>
              </div>
            </article>
          )) : (
            <div className="card empty vacancyEmpty">
              <h3>No jobs matched those filters</h3>
              <p className="muted">Try a broader keyword, another category, a different skill, or another salary range.</p>
              <Link className="button" href="/#vacancies">Show all vacancies</Link>
            </div>
          )}
        </div>

        <div className="finderCallout">
          <div>
            <span className="eyebrow">Smart matching</span>
            <h2>Build your job profile and find the best match.</h2>
            <p>Add your skills &amp; preferences.<br />Let Awasar find the best job for you.</p>
          </div>
          <div className="finderSteps">
            <span><b>01</b> Add your skills & preferences</span>
            <span><b>02</b> Get 0–100 compatibility scores</span>
            <span><b>03</b> Find the best job</span>
          </div>
          <Link className="button" href="/auth?role=job_seeker">Create Profile Now</Link>
        </div>
      </section>
    </>
  )
}
