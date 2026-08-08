/*
 * ---------------------------------------------------------------------------
 * SAMPLE HIRING DATA — NOT REAL AWASAR ACTIVITY
 * ---------------------------------------------------------------------------
 *
 * This module exists so the Market insights page has something to render
 * before Awasar has enough live applications to aggregate. Every number here
 * is invented for demonstration and layout purposes.
 *
 * It is deliberately kept in one file, and every surface that renders it is
 * required to show the "Sample data" label, because posting fabricated hiring
 * statistics as though they were measured would push job seekers toward real
 * decisions — which month to job-hunt, which field to retrain for — on the
 * basis of numbers nobody measured.
 *
 * TO GO LIVE: replace `getHiringInsights()` with a Supabase query aggregating
 * the `applications` and `jobs` tables, and set `isSample: false`. The shape
 * returned here is the shape the page expects, so no UI changes are needed.
 * Suggested source queries are noted against each field below.
 */

export type MonthPoint = { month: string; openings: number; applications: number }
export type CategoryRow = { category: string; openings: number; applicants: number }

export type HiringInsights = {
  isSample: boolean
  periodLabel: string

  // Headline counters.
  // Live source: count of applications where created_at >= date_trunc('month', now())
  applicationsThisMonth: number
  // Live source: count of jobs where status = 'open'
  openRolesNow: number
  // Live source: count of distinct businesses with >=1 open job
  hiringEmployers: number
  // Live source: median of (first employer status change - application created_at)
  medianEmployerReplyDays: number

  monthly: MonthPoint[]
  categories: CategoryRow[]
}

/*
 * The monthly curve is shaped around the Nepali hiring calendar rather than a
 * flat random spread, so the chart demonstrates a realistic-looking seasonal
 * story: a post-Dashain/Tihar lull in Oct–Nov, steady spring trading, and a
 * September peak as businesses staff up ahead of the festival season.
 */
const MONTHLY: MonthPoint[] = [
  { month: 'Jan', openings: 42, applications: 310 },
  { month: 'Feb', openings: 48, applications: 355 },
  { month: 'Mar', openings: 61, applications: 430 },
  { month: 'Apr', openings: 57, applications: 402 },
  { month: 'May', openings: 52, applications: 366 },
  { month: 'Jun', openings: 45, applications: 322 },
  { month: 'Jul', openings: 59, applications: 415 },
  { month: 'Aug', openings: 78, applications: 540 },
  { month: 'Sep', openings: 100, applications: 690 },
  { month: 'Oct', openings: 46, applications: 298 },
  { month: 'Nov', openings: 38, applications: 265 },
  { month: 'Dec', openings: 55, applications: 388 },
]

const CATEGORIES: CategoryRow[] = [
  { category: 'Reception / Front Desk', openings: 100, applicants: 250 },
  { category: 'Retail / Sales', openings: 86, applicants: 402 },
  { category: 'Accounting / Finance', openings: 64, applicants: 289 },
  { category: 'Computer Operator', openings: 58, applicants: 331 },
  { category: 'IT / Software', openings: 37, applicants: 214 },
  { category: 'Hospitality / Kitchen', openings: 44, applicants: 158 },
]

export function getHiringInsights(): HiringInsights {
  return {
    isSample: true,
    periodLabel: 'Last 12 months · Damak & Jhapa',
    applicationsThisMonth: 250,
    openRolesNow: 100,
    hiringEmployers: 34,
    medianEmployerReplyDays: 6,
    monthly: MONTHLY,
    categories: CATEGORIES,
  }
}

/* Convenience derivations used by the page copy. */
export function peakMonth(monthly: MonthPoint[]) {
  return monthly.reduce((best, row) => (row.openings > best.openings ? row : best), monthly[0])
}

export function quietestMonth(monthly: MonthPoint[]) {
  return monthly.reduce((worst, row) => (row.openings < worst.openings ? row : worst), monthly[0])
}

/*
 * Applicants per opening — the number that actually answers "how hard is this
 * to get?". A category with many openings is not necessarily a good bet if it
 * also attracts many more applicants.
 */
export function competitionRatio(row: CategoryRow) {
  return row.openings ? row.applicants / row.openings : 0
}
