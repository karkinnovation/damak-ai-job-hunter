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

  const signedIn = Boolean(userId)

  return (
    <header className="nav">
      <Link className="brand" href="/" aria-label="Awasar home">
        <div
  style={{
    width: '150px',
    height: '50px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
  }}
>
  <img
    src="/awasar.png"
    alt="Awasar"
    style={{
      width: '150px',
      height: '150px',
      objectFit: 'contain',
      transform: 'scale(2.5)',
      transformOrigin: 'left center',
    }}
  />
</div>
      </Link>
      <nav className="navLinks" aria-label="Main navigation">
        <Link href="/jobs">Find Jobs</Link>
        {profile?.role === 'job_seeker' && <>
          <Link href="/seeker/hunt">AI Match</Link>
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
        {signedIn && !profile && <Link href="/dashboard">Dashboard</Link>}
        {signedIn ? (
          <div className="navUser">
            <form action="/logout" method="post"><button className="button secondary small">Logout</button></form>
          </div>
        ) : <Link className="button small" href="/auth">Login / Register</Link>}
      </nav>
    </header>
  )
}
