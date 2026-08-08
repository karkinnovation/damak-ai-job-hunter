import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

export async function Nav() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  let profile: { full_name: string; role: string } | null = null
  if (userId) {
    const result = await supabase
      .from('profiles')
      .select('full_name,role')
      .eq('id', userId)
      .maybeSingle()
    profile = result.data
  }

  const signedIn = Boolean(userId)

  return (
    <header className="nav">
      <Link
        className="brand"
        href="/"
        aria-label="Awasar home"
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '180px',
          height: '52px',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
<img
  src="/awasar.png"
  alt="Awasar"
  style={{
    width: '150px',
    height: '48px',
    objectFit: 'cover',
    objectPosition: 'center',
    display: 'block',
  }}
/>
      </Link>

      <nav className="navLinks" aria-label="Main navigation">
        <Link href="/jobs">Find Jobs</Link>
        <Link href="/insights">Insights</Link>

        {profile?.role === 'job_seeker' && (
          <>
            <Link href="/seeker/hunt">AI Match</Link>
            <Link href="/seeker/applications">Applications</Link>
            <Link href="/dashboard">Dashboard</Link>
          </>
        )}

        {profile?.role === 'employer' && (
          <>
            <Link href="/employer/jobs">Vacancies</Link>
            <Link href="/employer/jobs/new">Post Job</Link>
            <Link href="/employer/talent">Talent</Link>
            <Link href="/employer/profile">Business</Link>
            <Link href="/dashboard">Dashboard</Link>
          </>
        )}

        {profile?.role === 'admin' && (
          <>
            <Link href="/admin">Admin</Link>
            <Link href="/dashboard">Dashboard</Link>
          </>
        )}

        {signedIn && !profile && <Link href="/dashboard">Dashboard</Link>}

        {signedIn ? (
          <div className="navUser">
            <form action="/logout" method="post">
              <button className="button secondary small" type="submit">Logout</button>
            </form>
          </div>
        ) : (
          <Link className="button small" href="/auth">Login / Register</Link>
        )}
      </nav>
    </header>
  )
}
