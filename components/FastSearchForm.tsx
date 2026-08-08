'use client'

import type { FormEvent, ReactNode } from 'react'

type Props = {
  action: string
  className?: string
  children: ReactNode
}

export default function FastSearchForm({ action, className, children }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const data = new FormData(form)
    const params = new URLSearchParams()

    for (const [key, raw] of data.entries()) {
      const value = String(raw).trim()
      if (value) params.set(key, value)
    }

    const query = params.toString()
    const target = query ? `${action}?${query}` : action

    // Full navigation is deliberate here. It avoids React/Next transition
    // timing issues and guarantees the server search receives the filters.
    window.location.assign(target)
  }

  return (
    <form className={className} action={action} method="get" onSubmit={submit}>
      {children}
    </form>
  )
}
