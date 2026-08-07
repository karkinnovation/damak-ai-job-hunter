import Link from 'next/link'

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="heroGrid">
          <div>
            <span className="eyebrow">AI-powered local job matching · Damak</span>
            <h1>Find jobs that actually fit you.</h1>
            <p>Discover local opportunities based on your skills, experience, salary expectations, availability and travel preference—not just keywords.</p>
            <div className="heroActions">
              <Link className="button" href="/auth?role=job_seeker">Find my jobs</Link>
              <Link className="button secondary" href="/auth?role=employer">Hire local talent</Link>
            </div>
          </div>
          <div className="card demoCard">
            <span className="eyebrow">Example recommendation</span>
            <div className="cardTop"><div><h3>Account Assistant</h3><p className="muted">Damak-6 · NPR 20,000–24,000</p></div><div className="score score4">94%<small>Strong</small></div></div>
            <p>Strong fit. Your Excel and accounting skills match, the salary range is compatible, and the workplace is within your preferred travel distance.</p>
            <p className="positive">✓ Skills and salary match</p><p className="positive">✓ Working hours compatible</p><p className="warning">⚠ Employer prefers 1 year experience</p>
          </div>
        </div>
      </section>
      <section className="featureGrid">
        <article className="card"><h3>Local first</h3><p>Designed around Damak wards, NPR salaries and common local employment categories.</p></article>
        <article className="card"><h3>Explainable matching</h3><p>Every score shows clear reasons, including important mismatches—not a mysterious AI number.</p></article>
        <article className="card"><h3>Two-sided ranking</h3><p>Job seekers get ranked jobs; employers get ranked applicants. AI assists but never makes the hiring decision.</p></article>
      </section>
    </>
  )
}
