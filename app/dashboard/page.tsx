import Link from 'next/link'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const { supabase, user } = await requireUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return (
      <section className="narrow">
        <div className="card">
          <h1>Account setup problem</h1>
          <p>
            Your profile row is missing. Run the supplied Supabase migration
            and sign in again.
          </p>
        </div>
      </section>
    )
  }

  if (profile.role === 'job_seeker') {
    const [
      { data: seeker, error: seekerError },
      { count: applications },
    ] = await Promise.all([
      supabase
        .from('job_seeker_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle(),

      supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('job_seeker_id', user.id),
    ])

    const profileComplete = !seekerError && !!seeker

    return (
      <section className="container">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Job seeker dashboard</span>

            <h1>Hi, {profile.full_name}</h1>

            <p className="muted">
              Search local vacancies or let Awasar rank the best-fit jobs for you.
            </p>
          </div>

          <Link className="button" href="/seeker/hunt">
            ✦ Find My Best Matches
          </Link>
        </div>

        <div className="grid">
          <div className="card kpi">
            <span className="muted">Profile</span>

            <span className="stat">
              {seekerError
                ? 'Check setup'
                : profileComplete
                  ? 'Complete'
                  : 'Incomplete'}
            </span>

            <Link href="/seeker/profile">
              {profileComplete ? 'Edit profile →' : 'Complete profile →'}
            </Link>
          </div>

          <div className="card kpi">
            <span className="muted">Applications</span>

            <span className="stat">
              {applications || 0}
            </span>

            <Link href="/seeker/applications">
              View applications →
            </Link>
          </div>

          <div className="card kpi">
            <span className="muted">Local vacancies</span>

            <span className="stat">Damak</span>

            <Link href="/jobs">
              Browse jobs →
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (profile.role === 'employer') {
    const [
      { data: business },
      { count: jobs },
    ] = await Promise.all([
      supabase
        .from('businesses')
        .select('id, business_name')
        .eq('user_id', user.id)
        .maybeSingle(),

      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('employer_id', user.id),
    ])

    return (
      <section className="container">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Employer dashboard</span>

            <h1>
              {business?.business_name || profile.full_name}
            </h1>

            <p className="muted">
              Post local vacancies and review applicants ranked by compatibility.
            </p>
          </div>

          <Link className="button" href="/employer/jobs/new">
            Post vacancy
          </Link>
        </div>

        <div className="grid">
          <div className="card kpi">
            <span className="muted">Business profile</span>

            <span className="stat">
              {business ? 'Ready' : 'Incomplete'}
            </span>

            <Link href="/employer/profile">
              Edit profile →
            </Link>
          </div>

          <div className="card kpi">
            <span className="muted">Vacancies</span>

            <span className="stat">
              {jobs || 0}
            </span>

            <Link href="/employer/jobs">
              Manage vacancies →
            </Link>
          </div>

          <div className="card kpi">
            <span className="muted">Hiring</span>

            <span className="stat">
              AI-ranked
            </span>

            <span className="muted">
              Recommendations never auto-reject applicants.
            </span>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="container">
      <span className="eyebrow">Admin</span>

      <h1>Moderation</h1>

      <Link className="button" href="/admin">
        Open admin panel
      </Link>
    </section>
  )
}