import Link from 'next/link'
import { getHiringInsights, peakMonth, quietestMonth, competitionRatio } from '@/lib/demoInsights'
import { OpeningsChart } from '@/components/OpeningsChart'
import { IconUsers, IconBriefcase, IconClock, IconArrowRight } from '@/components/Icon'

export const metadata = {
  title: 'Market insights · Awasar',
  description: 'When employers in Nepal hire, which roles open most, and how much competition to expect.',
}

export default function Insights() {
  const data = getHiringInsights()
  const peak = peakMonth(data.monthly)
  const quiet = quietestMonth(data.monthly)

  // Sorted by how contested each field is — the number that answers
  // "how hard is this to actually get?"
  const byCompetition = [...data.categories].sort((a, b) => competitionRatio(a) - competitionRatio(b))
  const easiest = byCompetition[0]
  const hardest = byCompetition[byCompetition.length - 1]
  const maxRatio = competitionRatio(hardest)

  return (
    <section className="container insightsPage">
      {data.isSample && (
        <p className="sampleBanner">
          <strong>Sample data.</strong> These figures are illustrative examples, not measured Awasar
          activity. They show how this page will look once there are enough live applications to
          aggregate — don&rsquo;t plan around the numbers yet.
        </p>
      )}

      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Market insights</span>
          <h1>When Nepal hires</h1>
          <p className="muted">{data.periodLabel}</p>
        </div>
        <Link className="button secondary" href="/jobs">Browse vacancies <IconArrowRight size={15} /></Link>
      </div>

      {/* Headline counters */}
      <div className="statGrid">
        <article className="card statCard">
          <span className="statIcon"><IconUsers size={18} /></span>
          <span className="statValue">{data.applicationsThisMonth}</span>
          <span className="statLabel">Applications this month</span>
          <p className="muted">Across every vacancy in Nepal.</p>
        </article>

        <article className="card statCard">
          <span className="statIcon"><IconBriefcase size={18} /></span>
          <span className="statValue">{data.openRolesNow}</span>
          <span className="statLabel">Reception roles open</span>
          <p className="muted">The single largest category open right now.</p>
        </article>

        <article className="card statCard">
          <span className="statIcon"><IconBriefcase size={18} /></span>
          <span className="statValue">{data.hiringEmployers}</span>
          <span className="statLabel">Employers hiring</span>
          <p className="muted">Businesses with at least one open vacancy.</p>
        </article>

        <article className="card statCard">
          <span className="statIcon"><IconClock size={18} /></span>
          <span className="statValue">{data.medianEmployerReplyDays}<small>days</small></span>
          <span className="statLabel">Typical reply time</span>
          <p className="muted">Median wait before an employer updates your status.</p>
        </article>
      </div>

      {/* Seasonality */}
      <div className="card insightBlock">
        <div className="insightHead">
          <div>
            <span className="eyebrow">Seasonality</span>
            <h2>{peak.month} is the busiest hiring month</h2>
          </div>
        </div>

        <p className="insightLede">
          Employers post <strong>{peak.openings} vacancies in {peak.month}</strong> — more than double
          the {quiet.openings} posted in {quiet.month}, the quietest month. The run-up starts in August
          and collapses immediately after, so the practical advice is simple: have your profile
          finished and your skills listed <strong>before</strong> {peak.month} starts, not during it.
        </p>

        <OpeningsChart data={data.monthly} />

        <div className="insightTakeaways">
          <div>
            <span className="takeawayLabel">Best months to apply</span>
            <strong>Aug – Sep</strong>
            <p className="muted">Most openings, so the most choice — but also the most competition.</p>
          </div>
          <div>
            <span className="takeawayLabel">Quietest month</span>
            <strong>{quiet.month}</strong>
            <p className="muted">Fewest postings, though each one draws a smaller applicant pool.</p>
          </div>
          <div>
            <span className="takeawayLabel">Steady all year</span>
            <strong>Retail &amp; Accounting</strong>
            <p className="muted">These categories post consistently rather than in bursts.</p>
          </div>
        </div>
      </div>

      {/* Competition */}
      <div className="card insightBlock">
        <div className="insightHead">
          <div>
            <span className="eyebrow">Competition</span>
            <h2>How many people you&rsquo;re up against</h2>
          </div>
        </div>

        <p className="insightLede">
          Openings alone don&rsquo;t tell you much — what matters is applicants <em>per</em> opening.
          <strong> {hardest.category}</strong> is the most contested at{' '}
          {competitionRatio(hardest).toFixed(1)} applicants per role, while{' '}
          <strong>{easiest.category}</strong> is the most winnable at{' '}
          {competitionRatio(easiest).toFixed(1)}.
        </p>

        <ul className="competitionList">
          {byCompetition.map(row => {
            const ratio = competitionRatio(row)
            return (
              <li key={row.category}>
                <div className="competitionTop">
                  <strong>{row.category}</strong>
                  <span className="competitionRatio">{ratio.toFixed(1)} per opening</span>
                </div>
                <div className="competitionBar">
                  <span style={{ width: `${(ratio / maxRatio) * 100}%` }} />
                </div>
                <div className="competitionMeta muted">
                  {row.openings} openings · {row.applicants} applicants
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="finderCallout">
        <div>
          <span className="eyebrow">Put it to use</span>
          <h2>See where you stand before {peak.month}.</h2>
          <p>Add your skills and Awasar scores every vacancy against your profile.</p>
        </div>
        <div className="finderSteps">
          <span><b>01</b> Complete your profile</span>
          <span><b>02</b> Get 0–100 compatibility scores</span>
          <span><b>03</b> Apply where you rank highest</span>
        </div>
        <Link className="button" href="/seeker/profile">Complete my profile</Link>
      </div>
    </section>
  )
}
