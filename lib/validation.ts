import { z } from 'zod'

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
const requiredCoordinate = (min: number, max: number) => z.preprocess(
  value => value === '' || value == null ? undefined : value,
  z.coerce.number().min(min).max(max)
)

export const seekerProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  ward: z.coerce.number().int().min(1).max(10),
  education_level: z.string().trim().min(1).max(80),
  experience_months: z.coerce.number().int().min(0).max(600),
  expected_salary_min: z.coerce.number().int().min(0).max(1_000_000),
  expected_salary_max: z.coerce.number().int().min(0).max(1_000_000),
  employment_type: z.enum(['full_time', 'part_time']),
  available_from: z.string().regex(timeRegex),
  available_until: z.string().regex(timeRegex),
  max_travel_km: z.coerce.number().min(0.5).max(100),
  latitude: requiredCoordinate(-90, 90),
  longitude: requiredCoordinate(-180, 180),
  show_availability_to_employers: z.boolean().default(false),
  preferred_categories: z.array(z.string().max(80)).max(8),
  skills: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
}).refine(v => v.expected_salary_max >= v.expected_salary_min, {
  message: 'Maximum salary must be at least minimum salary',
  path: ['expected_salary_max'],
})

export const employerProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  business_name: z.string().trim().min(2).max(120),
  business_type: z.string().trim().min(2).max(80),
  ward: z.coerce.number().int().min(1).max(10),
  phone: z.string().trim().min(7).max(20),
  latitude: requiredCoordinate(-90, 90),
  longitude: requiredCoordinate(-180, 180),
})

export const jobSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(4000),
  category: z.string().trim().min(2).max(80),
  ward: z.coerce.number().int().min(1).max(10),
  salary_min: z.coerce.number().int().min(0).max(1_000_000),
  salary_max: z.coerce.number().int().min(0).max(1_000_000),
  employment_type: z.enum(['full_time', 'part_time']),
  experience_required_months: z.coerce.number().int().min(0).max(600),
  education_requirement: z.string().trim().max(120).optional().default(''),
  working_start: z.string().regex(timeRegex),
  working_end: z.string().regex(timeRegex),
  number_of_openings: z.coerce.number().int().min(1).max(100),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  required_skills: z.array(z.string().trim().min(1).max(60)).max(20),
  preferred_skills: z.array(z.string().trim().min(1).max(60)).max(20),
}).refine(v => v.salary_max >= v.salary_min, {
  message: 'Maximum salary must be at least minimum salary',
  path: ['salary_max'],
})
