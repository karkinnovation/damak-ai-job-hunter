export type MatchInput = {
  seeker: {
    skills: string[]
    experience_months: number
    education_level: string
    expected_salary_min: number
    expected_salary_max: number
    employment_type: string
    available_from: string
    available_until: string
    max_travel_km: number
    latitude?: number | null
    longitude?: number | null
    ward: number
    city?: string | null
    district?: string | null
    province?: string | null
    preferred_categories?: string[]
  }
  job: {
    required_skills: string[]
    preferred_skills: string[]
    experience_required_months: number
    education_requirement?: string | null
    salary_min: number
    salary_max: number
    employment_type: string
    working_start: string
    working_end: string
    latitude?: number | null
    longitude?: number | null
    ward: number
    city?: string | null
    district?: string | null
    province?: string | null
    category: string
  }
}

export type MatchBreakdown = {
  score: number
  skills: number
  availability: number
  salary: number
  experience: number
  location: number
  employmentType: number
  education: number
  category: number
  distanceKm: number | null
  positives: string[]
  mismatches: string[]
}

const normalize = (s: string) => s.trim().toLowerCase()

function overlapScore(aMin: number, aMax: number, bMin: number, bMax: number) {
  const overlap = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin))
  if (overlap > 0 || (aMin === aMax && aMin >= bMin && aMin <= bMax)) return 100
  const gap = Math.max(bMin - aMax, aMin - bMax, 0)
  const base = Math.max(1, Math.max(aMax, bMax))
  return Math.max(0, Math.round(100 - (gap / base) * 200))
}

function minutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function scheduleScore(userStart: string, userEnd: string, jobStart: string, jobEnd: string) {
  const us = minutes(userStart), ue = minutes(userEnd), js = minutes(jobStart), je = minutes(jobEnd)
  if (us <= js && ue >= je) return 100
  const overlap = Math.max(0, Math.min(ue, je) - Math.max(us, js))
  const duration = Math.max(1, je - js)
  return Math.round(Math.min(100, (overlap / duration) * 100))
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const toRad = (x: number) => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function calculateMatch({ seeker, job }: MatchInput): MatchBreakdown {
  const positives: string[] = []
  const mismatches: string[] = []
  const seekerSkills = new Set(seeker.skills.map(normalize))
  const required = job.required_skills.map(normalize)
  const preferred = job.preferred_skills.map(normalize)
  const requiredMatches = required.filter(s => seekerSkills.has(s))
  const preferredMatches = preferred.filter(s => seekerSkills.has(s))
  const requiredRatio = required.length ? requiredMatches.length / required.length : 1
  const preferredRatio = preferred.length ? preferredMatches.length / preferred.length : 1
  const skillsRaw = Math.round((requiredRatio * 0.8 + preferredRatio * 0.2) * 100)

  if (requiredMatches.length) positives.push(`Matches ${requiredMatches.length}/${required.length || requiredMatches.length} required skills`)
  const missingRequired = required.filter(s => !seekerSkills.has(s))
  if (missingRequired.length) mismatches.push(`Missing required skills: ${missingRequired.slice(0, 3).join(', ')}`)

  let experienceRaw = 100
  if (job.experience_required_months > 0) {
    experienceRaw = Math.min(100, Math.round((seeker.experience_months / job.experience_required_months) * 100))
    if (experienceRaw >= 100) positives.push('Meets the experience requirement')
    else mismatches.push(`Requires ${job.experience_required_months} months experience; profile has ${seeker.experience_months}`)
  } else positives.push('No prior experience is required')

  const salaryRaw = overlapScore(seeker.expected_salary_min, seeker.expected_salary_max, job.salary_min, job.salary_max)
  if (salaryRaw >= 80) positives.push('Salary ranges are compatible')
  else mismatches.push('Salary expectations do not strongly overlap')

  const availabilityRaw = scheduleScore(seeker.available_from, seeker.available_until, job.working_start, job.working_end)
  if (availabilityRaw >= 90) positives.push('Working hours fit your availability')
  else mismatches.push('Working hours only partly fit your availability')

  const typeRaw = seeker.employment_type === job.employment_type ? 100 : 25
  if (typeRaw === 100) positives.push('Employment type matches your preference')
  else mismatches.push('Employment type differs from your preference')

  let distanceKm: number | null = null
  let locationRaw = 60
  if (
    seeker.latitude != null && seeker.longitude != null &&
    job.latitude != null && job.longitude != null
  ) {
    distanceKm = haversineKm(seeker.latitude, seeker.longitude, job.latitude, job.longitude)
    const ratio = distanceKm / Math.max(0.5, seeker.max_travel_km)
    locationRaw = ratio <= 0.25 ? 100 : ratio <= 0.5 ? 90 : ratio <= 0.75 ? 75 : ratio <= 1 ? 60 : Math.max(0, Math.round(40 - (ratio - 1) * 30))
    if (distanceKm <= seeker.max_travel_km) positives.push(`${distanceKm.toFixed(1)} km away, within your travel preference`)
    else mismatches.push(`${distanceKm.toFixed(1)} km away, beyond your preferred ${seeker.max_travel_km} km`)
  } else {
    const seekerCity = normalize(seeker.city || '')
    const jobCity = normalize(job.city || '')
    const seekerDistrict = normalize(seeker.district || '')
    const jobDistrict = normalize(job.district || '')
    const seekerProvince = normalize(seeker.province || '')
    const jobProvince = normalize(job.province || '')

    if (seekerCity && jobCity && seekerCity === jobCity) {
      locationRaw = seeker.ward === job.ward ? 100 : 85
      positives.push(seeker.ward === job.ward ? 'Workplace is in the same ward' : 'Workplace is in the same city / municipality')
    } else if (seekerDistrict && jobDistrict && seekerDistrict === jobDistrict) {
      locationRaw = 70
      positives.push('Workplace is in the same district')
    } else if (seekerProvince && jobProvince && seekerProvince === jobProvince) {
      locationRaw = 50
    } else {
      locationRaw = 25
    }
  }

  const categoryRaw = !seeker.preferred_categories?.length ? 100 : seeker.preferred_categories.map(normalize).includes(normalize(job.category)) ? 100 : 20
  if (categoryRaw === 100 && seeker.preferred_categories?.length) positives.push('Job category matches your preference')
  else if (categoryRaw < 100) mismatches.push('Job category is outside your selected preferences')

  let educationRaw = 100
  if (job.education_requirement?.trim()) {
    const req = normalize(job.education_requirement)
    const have = normalize(seeker.education_level)
    educationRaw = have.includes(req) || req.includes(have) ? 100 : 65
    if (educationRaw < 100) mismatches.push('Education requirement may need employer review')
  }

  // Skills 25, availability 15, salary 15, experience 15, location 15, type 5, education 5, category 5
  const skills = skillsRaw * 0.25
  const availability = availabilityRaw * 0.15
  const salary = salaryRaw * 0.15
  const experience = experienceRaw * 0.15
  const location = locationRaw * 0.15
  const employmentType = typeRaw * 0.05
  const education = educationRaw * 0.05
  const category = categoryRaw * 0.05
  const score = Math.round(skills + availability + salary + experience + location + employmentType + education + category)

  return { score, skills, availability, salary, experience, location, employmentType, education, category, distanceKm, positives, mismatches }
}

export function fallbackExplanation(score: number, positives: string[], mismatches: string[]) {
  const band = score >= 85 ? 'Strong match' : score >= 70 ? 'Good match' : score >= 50 ? 'Possible match' : 'Low match'
  const good = positives.slice(0, 3).join('. ')
  const bad = mismatches.slice(0, 2).join('. ')
  return `${band}. ${good || 'Some profile details align with this vacancy'}.${bad ? ` Main mismatch: ${bad}.` : ''}`
}


/** Convert seeker-facing matching copy into employer-facing copy.
 * The score stays identical; only pronouns/context change so employers are
 * never described as if they were the applicant.
 */
export function employerReason(reason: string) {
  return reason
    .replace(/\byour\b/gi, "the candidate's")
    .replace(/\bprofile has\b/gi, 'candidate has')
}

export function employerFallbackExplanation(score: number, positives: string[], mismatches: string[]) {
  const band = score >= 85 ? 'Strong candidate match' : score >= 70 ? 'Good candidate match' : score >= 50 ? 'Possible candidate match' : 'Low candidate match'
  const good = positives.map(employerReason).slice(0, 3).join('. ')
  const bad = mismatches.map(employerReason).slice(0, 2).join('. ')
  return `${band}. ${good || 'Some candidate details align with this vacancy'}.${bad ? ` Main mismatch: ${bad}.` : ''}`
}
