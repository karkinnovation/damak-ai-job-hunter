export type ApplicationMismatchSnapshot = {
  reasons: string[]
  keys: string[]
}

const clean = (value: string) => value.trim().replace(/\s+/g, ' ')
const slug = (value: string) => clean(value).toLowerCase().replace(/[^a-z0-9+.#-]+/g, '_').replace(/^_+|_+$/g, '')

/**
 * Convert the matching engine's human-readable mismatch copy into stable keys
 * that can be grouped across applications. We keep the original reasons too,
 * so the UI can still explain what happened.
 */
export function snapshotMismatchPatterns(reasons: string[]): ApplicationMismatchSnapshot {
  const keys = new Set<string>()
  const expandedReasons: string[] = []

  for (const raw of reasons) {
    const reason = clean(raw)
    if (!reason) continue

    if (/^missing required skills:/i.test(reason)) {
      const skillList = reason.replace(/^missing required skills:/i, '').split(',').map(clean).filter(Boolean)
      if (skillList.length) {
        for (const skill of skillList) {
          keys.add(`skill:${slug(skill)}`)
          expandedReasons.push(`Missing required skill: ${skill}`)
        }
        continue
      }
    }

    if (/working hours|availability/i.test(reason)) keys.add('availability')
    else if (/experience/i.test(reason)) keys.add('experience')
    else if (/salary/i.test(reason)) keys.add('salary')
    else if (/employment type/i.test(reason)) keys.add('employment_type')
    else if (/km away|travel|distance/i.test(reason)) keys.add('distance')
    else if (/education/i.test(reason)) keys.add('education')
    else if (/category/i.test(reason)) keys.add('category')
    else keys.add(`other:${slug(reason).slice(0, 80)}`)

    expandedReasons.push(reason)
  }

  return { reasons: expandedReasons, keys: Array.from(keys) }
}

export function fatigueNudgeCopy(patternKey: string, count: number) {
  if (patternKey.startsWith('skill:')) {
    const skill = patternKey.slice('skill:'.length).replace(/_/g, ' ')
    return {
      title: `A skill gap keeps appearing`,
      message: `Missing “${skill}” has appeared in ${count} of your recent applications. You can focus on jobs that do not require it, or add it to your learning plan.`,
      actionLabel: 'Browse better-fit jobs',
      actionHref: '/seeker/hunt',
    }
  }

  const copy: Record<string, { title: string; message: string; actionLabel: string; actionHref: string }> = {
    availability: {
      title: 'Your availability may be limiting matches',
      message: `Working-hour mismatch has appeared in ${count} of your recent applications. Try prioritizing jobs that fit your available hours.`,
      actionLabel: 'See better-fit jobs',
      actionHref: '/seeker/hunt',
    },
    experience: {
      title: 'Experience requirements keep coming up',
      message: `Experience mismatch has appeared in ${count} of your recent applications. Consider jobs with lower experience requirements first.`,
      actionLabel: 'See better-fit jobs',
      actionHref: '/seeker/hunt',
    },
    salary: {
      title: 'Salary expectations may be narrowing your options',
      message: `Salary mismatch has appeared in ${count} of your recent applications. Review jobs whose salary range overlaps your expectations.`,
      actionLabel: 'Browse matching salaries',
      actionHref: '/jobs',
    },
    employment_type: {
      title: 'Employment type keeps mismatching',
      message: `Full-time/part-time preference mismatch has appeared in ${count} recent applications.`,
      actionLabel: 'Review profile',
      actionHref: '/seeker/profile',
    },
    distance: {
      title: 'Travel distance keeps reducing your match',
      message: `Distance has been a mismatch in ${count} recent applications. Try closer vacancies or adjust your preferred travel radius.`,
      actionLabel: 'Find closer jobs',
      actionHref: '/seeker/hunt',
    },
    education: {
      title: 'Education requirements keep appearing',
      message: `Education requirement mismatch has appeared in ${count} recent applications.`,
      actionLabel: 'See better-fit jobs',
      actionHref: '/seeker/hunt',
    },
    category: {
      title: 'Your preferred categories may not match what you apply to',
      message: `Category mismatch has appeared in ${count} recent applications.`,
      actionLabel: 'Review preferences',
      actionHref: '/seeker/profile',
    },
  }

  return copy[patternKey] || {
    title: 'A recurring mismatch is showing up',
    message: `The same compatibility issue has appeared in ${count} recent applications. Awasar can help you focus on stronger matches.`,
    actionLabel: 'See better-fit jobs',
    actionHref: '/seeker/hunt',
  }
}
