import Link from 'next/link'
import type { ReactNode } from 'react'

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
        <div>
          <span className="eyebrow">{job.category} · Damak-{job.ward}</span>
          <h3>{job.title}</h3>
          <p className="muted">{job.business_name || 'Local employer'} · NPR {job.salary_min.toLocaleString()}–{job.salary_max.toLocaleString()}</p>
        </div>
        <div className={`score score${Math.min(4, Math.floor(score / 20))}`}>{score}%<small>{label}</small></div>
      </div>
      {explanation}
      <div className="reasonGrid">
        <div>{positives.slice(0, 3).map((p, i) => <p className="positive" key={i}>✓ {p}</p>)}</div>
        <div>{mismatches.slice(0, 2).map((p, i) => <p className="warning" key={i}>⚠ {p}</p>)}</div>
      </div>
      <Link className="button" href={`/jobs/${job.id}`}>View job</Link>
    </article>
  )
}
