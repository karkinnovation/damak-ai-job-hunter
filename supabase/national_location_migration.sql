-- Awasar National Location Migration
-- Expands Damak-only location fields to all of Nepal.
-- Run once in Supabase SQL Editor.

-- Remove old Damak-only constraints where they exist.
alter table public.job_seeker_profiles drop constraint if exists job_seeker_profiles_city_check;
alter table public.job_seeker_profiles drop constraint if exists job_seeker_profiles_ward_check;
alter table public.businesses drop constraint if exists businesses_city_check;
alter table public.businesses drop constraint if exists businesses_ward_check;
alter table public.jobs drop constraint if exists jobs_city_check;
alter table public.jobs drop constraint if exists jobs_ward_check;

-- Administrative location fields.
alter table public.job_seeker_profiles
  add column if not exists district text,
  add column if not exists province text;

alter table public.businesses
  add column if not exists district text,
  add column if not exists province text;

alter table public.jobs
  add column if not exists district text,
  add column if not exists province text;

-- Stop forcing every row to Damak.
alter table public.job_seeker_profiles alter column city drop default;
alter table public.businesses alter column city drop default;
alter table public.jobs alter column city drop default;

-- Nepal wards vary by municipality; keep a broad practical range.
alter table public.job_seeker_profiles
  add constraint job_seeker_profiles_ward_check check (ward between 1 and 99);
alter table public.businesses
  add constraint businesses_ward_check check (ward between 1 and 99);
alter table public.jobs
  add constraint jobs_ward_check check (ward between 1 and 99);

-- Existing Damak records are in Jhapa, Koshi.
update public.job_seeker_profiles
set district = coalesce(district, 'Jhapa'),
    province = coalesce(province, 'Koshi Province')
where city = 'Damak';

update public.businesses
set district = coalesce(district, 'Jhapa'),
    province = coalesce(province, 'Koshi Province')
where city = 'Damak';

update public.jobs
set district = coalesce(district, 'Jhapa'),
    province = coalesce(province, 'Koshi Province')
where city = 'Damak';

-- Keep vacancy administrative location aligned with the business/workplace.
create or replace function public.sync_business_job_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
  set latitude = new.latitude,
      longitude = new.longitude,
      ward = new.ward,
      city = new.city,
      district = new.district,
      province = new.province
  where business_id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_business_location_to_jobs on public.businesses;
create trigger sync_business_location_to_jobs
after update of latitude, longitude, ward, city, district, province on public.businesses
for each row execute procedure public.sync_business_job_location();

revoke all on function public.sync_business_job_location() from public;

-- Backfill current vacancies from their business location.
update public.jobs j
set latitude = b.latitude,
    longitude = b.longitude,
    ward = b.ward,
    city = b.city,
    district = b.district,
    province = b.province
from public.businesses b
where j.business_id = b.id;

create index if not exists idx_jobs_national_location
  on public.jobs(province, district, city, status);

create index if not exists idx_businesses_national_location
  on public.businesses(province, district, city);

create index if not exists idx_seekers_national_location
  on public.job_seeker_profiles(province, district, city);

-- Update public business-column grant if your project uses column grants.
grant select (id, business_name, business_type, ward, city, district, province)
on public.businesses to anon;


-- National anonymous talent search.
drop function if exists public.search_anonymous_candidates(text,integer,integer,time,numeric,integer);

create or replace function public.search_anonymous_candidates(
  p_skill text default null,
  p_salary_min integer default null,
  p_salary_max integer default null,
  p_available_at time default null,
  p_max_distance_km numeric default null,
  p_ward integer default null,
  p_city text default null,
  p_district text default null,
  p_province text default null
)
returns table (
  anonymous_id text,
  ward smallint,
  city text,
  district text,
  province text,
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
set search_path = public, extensions
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
    left(encode(extensions.digest(s.user_id::text, 'sha256'), 'hex'), 12),
    s.ward,
    s.city,
    s.district,
    s.province,
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
    end
  from public.job_seeker_profiles s
  where s.show_availability_to_employers = true
    and (p_skill is null or btrim(p_skill) = '' or exists (
      select 1 from unnest(s.skills) skill where lower(skill) = lower(btrim(p_skill))
    ))
    and (p_salary_min is null or s.expected_salary_max >= p_salary_min)
    and (p_salary_max is null or s.expected_salary_min <= p_salary_max)
    and (p_available_at is null or (s.available_from <= p_available_at and s.available_until >= p_available_at))
    and (p_ward is null or s.ward = p_ward)
    and (p_city is null or btrim(p_city) = '' or lower(s.city) = lower(btrim(p_city)))
    and (p_district is null or btrim(p_district) = '' or lower(s.district) = lower(btrim(p_district)))
    and (p_province is null or btrim(p_province) = '' or lower(s.province) = lower(btrim(p_province)))
    and (
      p_max_distance_km is null
      or (
        employer_lat is not null and employer_lng is not null
        and s.latitude is not null and s.longitude is not null
        and public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= p_max_distance_km
      )
    )
  order by s.province, s.district, s.city, s.ward, s.expected_salary_min;
end;
$$;

revoke all on function public.search_anonymous_candidates(text,integer,integer,time,numeric,integer,text,text,text) from public;
grant execute on function public.search_anonymous_candidates(text,integer,integer,time,numeric,integer,text,text,text) to authenticated;
