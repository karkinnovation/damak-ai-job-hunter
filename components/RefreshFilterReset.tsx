'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RefreshFilterReset({ basePath, anchor = '' }: { basePath: string; anchor?: string }) {
  const router = useRouter()

  useEffect(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const hasFilters = window.location.search.length > 1

    if (navigation?.type === 'reload' && hasFilters) {
      router.replace(`${basePath}${anchor}`)
    }
  }, [anchor, basePath, router])

  return null
}
