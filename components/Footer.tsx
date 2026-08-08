import Link from 'next/link'

/*
 * The footer used to be a single sentence, which left every page ending
 * abruptly. This gives the site a proper base: a short statement of what
 * Awasar is, real navigation for people who scroll to the bottom looking
 * for it, and the AI disclosure kept where it belongs rather than buried
 * mid-sentence.
 */
export function Footer() {
  return (
    <footer className="siteFooter">
      <div className="footerInner">
        <div className="footerBrand">
          <p className="footerWordmark">अवसर <span>Awasar</span></p>
          <p className="footerTagline">सही काम, सही अवसर.</p>
          <p className="footerBlurb">
            Local vacancies across Damak and Jhapa, with compatibility matching
            that shows you why a job fits before you apply.
          </p>
        </div>

        <nav className="footerCol" aria-label="Job seeker links">
          <h2>For job seekers</h2>
          <Link href="/jobs">Browse vacancies</Link>
          <Link href="/seeker/hunt">Matched for you</Link>
          <Link href="/seeker/applications">My applications</Link>
          <Link href="/seeker/profile">My profile</Link>
        </nav>

        <nav className="footerCol" aria-label="Employer links">
          <h2>For employers</h2>
          <Link href="/employer/jobs/new">Post a vacancy</Link>
          <Link href="/employer/jobs">Manage vacancies</Link>
          <Link href="/employer/talent">Find talent</Link>
          <Link href="/employer/profile">Business profile</Link>
        </nav>
      </div>

      <div className="footerBase">
        <span>© {new Date().getFullYear()} Awasar · Damak, Jhapa</span>
        <span>Matching is AI-assisted. Employers make the final hiring decision.</span>
      </div>
    </footer>
  )
}
