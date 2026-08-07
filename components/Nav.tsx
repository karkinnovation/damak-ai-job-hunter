import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function Nav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="nav">
      <Link className="brand" href="/">Damak Job Hunter</Link>
      <nav>
        <Link href="/jobs">Jobs</Link>
        {user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <form action="/logout" method="post"><button className="linkButton">Logout</button></form>
          </>
        ) : <Link className="button small" href="/auth">Login / Register</Link>}
      </nav>
    </header>
  )
}
