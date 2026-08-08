-- Awasar Feature Migration: Anonymous Skill Broadcasting + Map Distance
-- Run once in Supabase SQL Editor on your EXISTING Awasar database.

create extension if not exists pgcrypto;

alter table public.job_seeker_profiles
  add column if not exists show_availability_to_employers boolean not null default false;

alter table public.applications
  add column if not exists distance_km numeric(7,2)
  check (distance_km is null or distance_km >= 0);

create index if not exists idx_seeker_broadcast_enabled
  on public.job_seeker_profiles(show_availability_to_employers)
  where show_availability_to_employers = true;

create index if not exists idx_seeker_skills_gin
  on public.job_seeker_profiles using gin(skills);


-- Keep vacancy coordinates aligned with the business/workplace pin.
create or replace function public.sync_business_job_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
  set latitude = new.latitude, longitude = new.longitude, ward = new.ward
  where business_id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_business_location_to_jobs on public.businesses;
create trigger sync_business_location_to_jobs
after update of latitude, longitude, ward on public.businesses
for each row execute procedure public.sync_business_job_location();
revoke all on function public.sync_business_job_location() from public;

-- Backfill any existing vacancies from the current business pin.
update public.jobs j
set latitude = b.latitude, longitude = b.longitude, ward = b.ward
from public.businesses b
where j.business_id = b.id
  and b.latitude is not null and b.longitude is not null;

-- Server-side distance helper. Kept inside PostgreSQL for anonymous employer filtering.
create or replace function public.haversine_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
strict
set search_path = public
as $$
  select 6371.0 * 2.0 * asin(
    least(1.0, sqrt(
      power(sin(radians(lat2 - lat1) / 2.0), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lon2 - lon1) / 2.0), 2)
    ))
  )
$$;

-- Privacy boundary for reverse vacancy browsing.
-- Employers never receive candidate UUID, name, phone, precise coordinates,
-- education, or experience through this function.
create or replace function public.search_anonymous_candidates(
  p_skill text default null,
  p_salary_min integer default null,
  p_salary_max integer default null,
  p_available_at time default null,
  p_max_distance_km numeric default null,
  p_ward integer default null
)
returns table (
  anonymous_id text,
  ward smallint,
  city text,
  skills text[],
  expected_salary_min integer,
  expected_salary_max integer,
  available_from time,
  available_until time,
  max_travel_km numeric,
  employment_type text,
  distance_band text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  employer_lat double precision;
  employer_lng double precision;
begin
  if public.my_role() <> 'employer' then
    raise exception 'Only employers can browse anonymous availability signals';
  end if;

  select b.latitude, b.longitude
  into employer_lat, employer_lng
  from public.businesses b
  where b.user_id = auth.uid()
  limit 1;

  return query
  select
    left(encode(digest(s.user_id::text, 'sha256'), 'hex'), 12) as anonymous_id,
    s.ward,
    s.city,
    s.skills,
    s.expected_salary_min,
    s.expected_salary_max,
    s.available_from,
    s.available_until,
    s.max_travel_km,
    s.employment_type,
    case
      when employer_lat is null or employer_lng is null or s.latitude is null or s.longitude is null then null
      when public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= 2 then 'Within 2 km'
      when public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= 5 then '2–5 km'
      when public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= 10 then '5–10 km'
      else '10+ km'
    end as distance_band
  from public.job_seeker_profiles s
  where s.show_availability_to_employers = true
    and (p_skill is null or btrim(p_skill) = '' or exists (
      select 1 from unnest(s.skills) skill where lower(skill) = lower(btrim(p_skill))
    ))
    and (p_salary_min is null or s.expected_salary_max >= p_salary_min)
    and (p_salary_max is null or s.expected_salary_min <= p_salary_max)
    and (p_available_at is null or (s.available_from <= p_available_at and s.available_until >= p_available_at))
    and (p_ward is null or s.ward = p_ward)
    and (
      p_max_distance_km is null
      or (
        employer_lat is not null and employer_lng is not null
        and s.latitude is not null and s.longitude is not null
        and public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= p_max_distance_km
      )
    )
  order by s.ward, s.expected_salary_min;
end;
$$;

revoke all on function public.haversine_km(double precision,double precision,double precision,double precision) from public;
revoke all on function public.search_anonymous_candidates(text,integer,integer,time,numeric,integer) from public;
grant execute on function public.search_anonymous_candidates(text,integer,integer,time,numeric,integer) to authenticated;

-- The existing seeker table RLS remains private. DO NOT add a general employer
-- SELECT policy for job_seeker_profiles; the RPC above is the privacy boundary.
