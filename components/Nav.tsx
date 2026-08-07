import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function Nav() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  let profile: { full_name: string; role: string } | null = null
  if (userId) {
    const result = await supabase.from('profiles').select('full_name,role').eq('id', userId).maybeSingle()
    profile = result.data
  }

  return (
    <header className="nav">
      <Link className="brand" href="/">Damak <span>Job Hunter</span></Link>
      <nav className="navLinks" aria-label="Main navigation">
        {profile?.role === 'job_seeker' && <>
          <Link href="/jobs">Jobs</Link>
          <Link href="/seeker/hunt">AI Hunt</Link>
          <Link href="/seeker/applications">Applications</Link>
          <Link href="/dashboard">Dashboard</Link>
        </>}
        {profile?.role === 'employer' && <>
          <Link href="/employer/jobs">Vacancies</Link>
          <Link href="/employer/jobs/new">Post Job</Link>
          <Link href="/employer/profile">Business</Link>
          <Link href="/dashboard">Dashboard</Link>
        </>}
        {profile?.role === 'admin' && <>
          <Link href="/admin">Admin</Link>
          <Link href="/dashboard">Dashboard</Link>
        </>}
        {!profile && <Link href="/jobs">Jobs</Link>}
        {profile ? (
          <div className="navUser">
            <span className="navName">{profile.full_name}</span>
            <form action="/logout" method="post"><button className="button secondary small">Logout</button></form>
          </div>
        ) : <Link className="button small" href="/auth">Login / Register</Link>}
      </nav>
    </header>
  )
}
