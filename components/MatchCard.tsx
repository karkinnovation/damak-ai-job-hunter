import Link from 'next/link'
import type { ReactNode } from 'react'
import { CompanyMark } from '@/components/CompanyMark'
import { IconCheck, IconAlert, IconArrowRight } from '@/components/Icon'

type Props = {
  job: { id: string; title: string; category: string; ward: number; salary_min: number; salary_max: number; business_name?: string }
  score: number
  explanation: ReactNode
  positives: string[]
  mismatches: string[]
}

export function MatchCard({ job, score, explanation, positives, mismatches }: Props) {
  const label = score >= 85 ? 'Strong' : score >= 70 ? 'Good' : score >= 50 ? 'Possible' : 'Low'
  return (
    <article className="card matchCard">
      <div className="cardTop">
        <div className="matchCardHead">
          <CompanyMark name={job.business_name} size={46} />
          <div>
            <span className="eyebrow">{job.category} · Damak-{job.ward}</span>
            <h3>{job.title}</h3>
            <p className="muted">{job.business_name || 'Local employer'} · NPR {job.salary_min.toLocaleString()}–{job.salary_max.toLocaleString()}</p>
          </div>
        </div>
        <div className={`score score${Math.min(4, Math.floor(score / 20))}`} style={{ ['--pct' as any]: score }}>
          <div className="scoreInner">{score}%<small>{label}</small></div>
        </div>
      </div>
      {explanation}
      <div className="reasonGrid">
        <div>{positives.slice(0, 3).map((p, i) => <p className="positive" key={i}><IconCheck size={14} /> <span>{p}</span></p>)}</div>
        <div>{mismatches.slice(0, 2).map((p, i) => <p className="warning" key={i}><IconAlert size={14} /> <span>{p}</span></p>)}</div>
      </div>
      <Link className="button" href={`/jobs/${job.id}`}>View job <IconArrowRight size={15} /></Link>
    </article>
  )
}
