-- Awasar Nepal — Supabase schema + security policies
-- Run this once in Supabase SQL Editor on a fresh project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  role text not null check (role in ('job_seeker','employer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.job_seeker_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ward smallint not null check (ward between 1 and 99),
  city text not null,
  district text,
  province text,
  education_level text not null,
  experience_months integer not null default 0 check (experience_months between 0 and 600),
  expected_salary_min integer not null check (expected_salary_min >= 0),
  expected_salary_max integer not null check (expected_salary_max >= expected_salary_min),
  employment_type text not null check (employment_type in ('full_time','part_time')),
  available_from time not null,
  available_until time not null,
  max_travel_km numeric(6,2) not null default 5 check (max_travel_km between 0.5 and 100),
  show_availability_to_employers boolean not null default false,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  preferred_categories text[] not null default '{}',
  skills text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 160),
  business_type text not null,
  ward smallint not null check (ward between 1 and 99),
  city text not null,
  district text,
  province text,
  phone text not null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null check (char_length(description) between 20 and 4000),
  category text not null,
  ward smallint not null check (ward between 1 and 99),
  city text not null,
  district text,
  province text,
  salary_min integer not null check (salary_min >= 0),
  salary_max integer not null check (salary_max >= salary_min),
  employment_type text not null check (employment_type in ('full_time','part_time')),
  experience_required_months integer not null default 0 check (experience_required_months between 0 and 600),
  education_requirement text,
  working_start time not null,
  working_end time not null,
  number_of_openings integer not null default 1 check (number_of_openings between 1 and 100),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  required_skills text[] not null default '{}',
  preferred_skills text[] not null default '{}',
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_seeker_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied','reviewed','shortlisted','rejected')),
  distance_km numeric(7,2) check (distance_km is null or distance_km >= 0),
  created_at timestamptz not null default now(),
  unique(job_id, job_seeker_id)
);

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_seeker_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  breakdown jsonb not null default '{}'::jsonb,
  explanation text not null,
  calculated_at timestamptz not null default now(),
  unique(job_id, job_seeker_id)
);

create index if not exists idx_jobs_status_created on public.jobs(status, created_at desc);
create index if not exists idx_jobs_employer on public.jobs(employer_id);
create index if not exists idx_applications_job on public.applications(job_id);
create index if not exists idx_applications_seeker on public.applications(job_seeker_id);
create index if not exists idx_match_job_score on public.match_results(job_id, score desc);
create index if not exists idx_match_seeker_score on public.match_results(job_seeker_id, score desc);
create index if not exists idx_seeker_broadcast_enabled on public.job_seeker_profiles(show_availability_to_employers) where show_availability_to_employers = true;
create index if not exists idx_seeker_skills_gin on public.job_seeker_profiles using gin(skills);


-- Keep vacancy coordinates aligned with the business/workplace pin.
create or replace function public.sync_business_job_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
  set latitude = new.latitude, longitude = new.longitude, ward = new.ward, city = new.city, district = new.district, province = new.province
  where business_id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_business_location_to_jobs on public.businesses;
create trigger sync_business_location_to_jobs
after update of latitude, longitude, ward, city, district, province on public.businesses
for each row execute procedure public.sync_business_job_location();
revoke all on function public.sync_business_job_location() from public;

-- Backfill any existing vacancies from the current business pin.
update public.jobs j
set latitude = b.latitude, longitude = b.longitude, ward = b.ward, city = b.city, district = b.district, province = b.province
from public.businesses b
where j.business_id = b.id
  and b.latitude is not null and b.longitude is not null;

-- Role helper functions are SECURITY DEFINER so RLS policies can safely check authorization
-- without recursive profile-policy evaluation.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.owns_job(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.jobs j where j.id = target_job and j.employer_id = auth.uid()) $$;

create or replace function public.employer_can_view_candidate(candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.job_seeker_id = candidate and j.employer_id = auth.uid()
  )
$$;

create or replace function public.employer_can_match(target_job uuid, candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.job_id = target_job and a.job_seeker_id = candidate and j.employer_id = auth.uid()
  )
$$;

revoke all on function public.my_role() from public;
revoke all on function public.owns_job(uuid) from public;
revoke all on function public.employer_can_view_candidate(uuid) from public;
revoke all on function public.employer_can_match(uuid, uuid) from public;
grant execute on function public.my_role() to authenticated;
grant execute on function public.owns_job(uuid) to authenticated;
grant execute on function public.employer_can_view_candidate(uuid) to authenticated;
grant execute on function public.employer_can_match(uuid, uuid) to authenticated;


-- Distance helper used for privacy-preserving anonymous employer filters.
create or replace function public.haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
returns double precision
language sql immutable strict
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

-- Privacy boundary for reverse-vacancy browsing. Employers receive only the
-- explicitly permitted anonymous fields; never candidate UUID/name/phone/coordinates.
create or replace function public.search_anonymous_candidates(
  p_skill text default null,
  p_salary_min integer default null,
  p_salary_max integer default null,
  p_available_at time default null,
  p_max_distance_km numeric default null,
  p_ward integer default null
)
returns table (
  anonymous_id text, ward smallint, city text, skills text[],
  expected_salary_min integer, expected_salary_max integer,
  available_from time, available_until time, max_travel_km numeric,
  employment_type text, distance_band text
)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  employer_lat double precision;
  employer_lng double precision;
begin
  if public.my_role() <> 'employer' then
    raise exception 'Only employers can browse anonymous availability signals';
  end if;

  select b.latitude, b.longitude into employer_lat, employer_lng
  from public.businesses b where b.user_id = auth.uid() limit 1;

  return query
  select
    left(encode(extensions.digest(s.user_id::text, 'sha256'), 'hex'), 12),
    s.ward, s.city, s.skills, s.expected_salary_min, s.expected_salary_max,
    s.available_from, s.available_until, s.max_travel_km, s.employment_type,
    case
      when employer_lat is null or employer_lng is null or s.latitude is null or s.longitude is null then null
      when public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= 2 then 'Within 2 km'
      when public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= 5 then '2–5 km'
      when public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= 10 then '5–10 km'
      else '10+ km'
    end
  from public.job_seeker_profiles s
  where s.show_availability_to_employers = true
    and (p_skill is null or btrim(p_skill) = '' or exists (select 1 from unnest(s.skills) skill where lower(skill) = lower(btrim(p_skill))))
    and (p_salary_min is null or s.expected_salary_max >= p_salary_min)
    and (p_salary_max is null or s.expected_salary_min <= p_salary_max)
    and (p_available_at is null or (s.available_from <= p_available_at and s.available_until >= p_available_at))
    and (p_ward is null or s.ward = p_ward)
    and (p_max_distance_km is null or (
      employer_lat is not null and employer_lng is not null and s.latitude is not null and s.longitude is not null
      and public.haversine_km(employer_lat, employer_lng, s.latitude, s.longitude) <= p_max_distance_km
    ))
  order by s.ward, s.expected_salary_min;
end;
$$;

revoke all on function public.haversine_km(double precision,double precision,double precision,double precision) from public;
revoke all on function public.search_anonymous_candidates(text,integer,integer,time,numeric,integer) from public;
grant execute on function public.search_anonymous_candidates(text,integer,integer,time,numeric,integer) to authenticated;

-- Automatically create a profile after sign-up. Users cannot sign themselves up as admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_name text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'job_seeker');
  if requested_role not in ('job_seeker','employer') then requested_role := 'job_seeker'; end if;
  safe_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 120);
  if char_length(safe_name) < 2 then safe_name := safe_name || ' User'; end if;
  insert into public.profiles(id, full_name, role) values(new.id, safe_name, requested_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Block client-side privilege escalation through profile updates.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'role changes are not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles for each row execute procedure public.prevent_role_change();

create or replace function public.prevent_application_reassignment()
returns trigger
language plpgsql
as $$
begin
  if (new.job_id is distinct from old.job_id or new.job_seeker_id is distinct from old.job_seeker_id)
     and current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'application identity fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_application_identity on public.applications;
create trigger protect_application_identity before update on public.applications for each row execute procedure public.prevent_application_reassignment();

alter table public.profiles enable row level security;
alter table public.job_seeker_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.match_results enable row level security;

-- profiles
create policy "profiles_select_authorized" on public.profiles for select to authenticated
using (id = auth.uid() or public.my_role() = 'admin' or public.employer_can_view_candidate(id));
create policy "profiles_update_self" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- job seeker details: private except self, admins, and employers who received an application.
create policy "seeker_select_authorized" on public.job_seeker_profiles for select to authenticated
using (user_id = auth.uid() or public.my_role() = 'admin' or public.employer_can_view_candidate(user_id));
create policy "seeker_insert_self" on public.job_seeker_profiles for insert to authenticated
with check (user_id = auth.uid() and public.my_role() = 'job_seeker');
create policy "seeker_update_self" on public.job_seeker_profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid() and public.my_role() = 'job_seeker');

-- businesses are intentionally public because they appear on public vacancy listings.
create policy "business_public_read" on public.businesses for select to anon, authenticated using (true);
create policy "business_insert_owner" on public.businesses for insert to authenticated
with check (user_id = auth.uid() and public.my_role() = 'employer');
create policy "business_update_owner" on public.businesses for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid() and public.my_role() = 'employer');

-- jobs: open vacancies are public; owners/admins can also see closed jobs.
create policy "jobs_public_or_owner_read" on public.jobs for select to anon, authenticated
using (status = 'open' or employer_id = auth.uid() or public.my_role() = 'admin');
create policy "jobs_insert_employer" on public.jobs for insert to authenticated
with check (
  employer_id = auth.uid() and public.my_role() = 'employer' and
  exists(select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
);
create policy "jobs_update_owner_admin" on public.jobs for update to authenticated
using (employer_id = auth.uid() or public.my_role() = 'admin')
with check (
  public.my_role() = 'admin' or (
    employer_id = auth.uid() and
    exists(select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  )
);

-- applications: candidates see their own; employer sees applications to their own jobs.
create policy "applications_select_authorized" on public.applications for select to authenticated
using (job_seeker_id = auth.uid() or public.owns_job(job_id) or public.my_role() = 'admin');
create policy "applications_insert_seeker" on public.applications for insert to authenticated
with check (
  job_seeker_id = auth.uid() and public.my_role() = 'job_seeker' and
  exists(select 1 from public.jobs j where j.id = job_id and j.status = 'open')
);
create policy "applications_update_employer_admin" on public.applications for update to authenticated
using (public.owns_job(job_id) or public.my_role() = 'admin')
with check (public.owns_job(job_id) or public.my_role() = 'admin');

-- match results can be generated/read by the seeker, the vacancy owner, or an admin.
create policy "matches_select_authorized" on public.match_results for select to authenticated
using (job_seeker_id = auth.uid() or public.employer_can_match(job_id, job_seeker_id) or public.my_role() = 'admin');
create policy "matches_insert_authorized" on public.match_results for insert to authenticated
with check (job_seeker_id = auth.uid() or public.employer_can_match(job_id, job_seeker_id) or public.my_role() = 'admin');
create policy "matches_update_authorized" on public.match_results for update to authenticated
using (job_seeker_id = auth.uid() or public.employer_can_match(job_id, job_seeker_id) or public.my_role() = 'admin')
with check (job_seeker_id = auth.uid() or public.employer_can_match(job_id, job_seeker_id) or public.my_role() = 'admin');

-- API privileges. RLS above still controls every row.
grant usage on schema public to anon, authenticated;
grant select on public.jobs to anon;
grant select (id, business_name, business_type, ward, city, district, province) on public.businesses to anon;
grant select, insert, update on public.profiles, public.job_seeker_profiles, public.businesses, public.jobs, public.applications, public.match_results to authenticated;

-- To create an admin after registering that account, run as the database owner in SQL Editor:
-- update public.profiles set role = 'admin' where id = '<ADMIN_USER_UUID>';


-- ============================================================
-- Awasar v9 application guardrails
-- ============================================================
-- Awasar v9 Feature Migration
-- Application Fatigue Signal + Application Rate Limiting
-- Run in Supabase SQL Editor on your EXISTING Awasar database.

alter table public.applications
  add column if not exists match_score integer
    check (match_score is null or (match_score between 0 and 100));

alter table public.applications
  add column if not exists mismatch_reasons text[] not null default '{}';

alter table public.applications
  add column if not exists mismatch_keys text[] not null default '{}';

create index if not exists idx_applications_seeker_created
  on public.applications(job_seeker_id, created_at desc);

create index if not exists idx_applications_mismatch_keys_gin
  on public.applications using gin(mismatch_keys);

create table if not exists public.application_nudge_dismissals (
  job_seeker_id uuid not null references public.profiles(id) on delete cascade,
  pattern_key text not null,
  dismissed_at timestamptz not null default now(),
  primary key(job_seeker_id, pattern_key)
);

create table if not exists public.application_rate_limit_hits (
  id bigint generated always as identity primary key,
  job_seeker_id uuid not null references public.profiles(id) on delete cascade,
  limit_type text not null check (limit_type in ('hourly','daily')),
  attempted_job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_hits_seeker_created
  on public.application_rate_limit_hits(job_seeker_id, created_at desc);

alter table public.application_nudge_dismissals enable row level security;
alter table public.application_rate_limit_hits enable row level security;

-- Users can only read/write their own nudge dismissal state.
drop policy if exists "nudge_dismissals_self_select" on public.application_nudge_dismissals;
create policy "nudge_dismissals_self_select"
on public.application_nudge_dismissals for select to authenticated
using (job_seeker_id = auth.uid());

drop policy if exists "nudge_dismissals_self_insert" on public.application_nudge_dismissals;
create policy "nudge_dismissals_self_insert"
on public.application_nudge_dismissals for insert to authenticated
with check (job_seeker_id = auth.uid() and public.my_role() = 'job_seeker');

drop policy if exists "nudge_dismissals_self_update" on public.application_nudge_dismissals;
create policy "nudge_dismissals_self_update"
on public.application_nudge_dismissals for update to authenticated
using (job_seeker_id = auth.uid())
with check (job_seeker_id = auth.uid() and public.my_role() = 'job_seeker');

-- Rate-limit hit logs are intentionally not readable by job seekers.
-- Admins can inspect them later if an admin view is added.
drop policy if exists "rate_hits_admin_select" on public.application_rate_limit_hits;
create policy "rate_hits_admin_select"
on public.application_rate_limit_hits for select to authenticated
using (public.my_role() = 'admin');

grant select, insert, update on public.application_nudge_dismissals to authenticated;
grant select on public.application_rate_limit_hits to authenticated;

-- Returns current usage + reset timestamps.
create or replace function public.application_rate_status(
  p_hourly_limit integer default 2,
  p_daily_limit integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_day_start timestamptz;
  v_day_reset timestamptz;
  v_hourly_count integer;
  v_daily_count integer;
  v_oldest_recent timestamptz;
  v_hourly_reset timestamptz;
begin
  if v_uid is null or public.my_role() <> 'job_seeker' then
    raise exception 'Only job seekers can read application limits';
  end if;

  -- Calendar day in Nepal time.
  v_day_start := date_trunc('day', v_now at time zone 'Asia/Kathmandu') at time zone 'Asia/Kathmandu';
  v_day_reset := (date_trunc('day', v_now at time zone 'Asia/Kathmandu') + interval '1 day') at time zone 'Asia/Kathmandu';

  select count(*)::integer
  into v_hourly_count
  from public.applications a
  where a.job_seeker_id = v_uid
    and a.created_at >= v_now - interval '1 hour';

  select count(*)::integer
  into v_daily_count
  from public.applications a
  where a.job_seeker_id = v_uid
    and a.created_at >= v_day_start;

  select min(a.created_at) + interval '1 hour'
  into v_oldest_recent
  from public.applications a
  where a.job_seeker_id = v_uid
    and a.created_at >= v_now - interval '1 hour';

  v_hourly_reset := coalesce(v_oldest_recent, v_now);

  return jsonb_build_object(
    'hourly_limit', p_hourly_limit,
    'daily_limit', p_daily_limit,
    'hourly_used', v_hourly_count,
    'daily_used', v_daily_count,
    'hourly_remaining', greatest(0, p_hourly_limit - v_hourly_count),
    'daily_remaining', greatest(0, p_daily_limit - v_daily_count),
    'hourly_reset_at', v_hourly_reset,
    'daily_reset_at', v_day_reset,
    'blocked_hourly', v_hourly_count >= p_hourly_limit,
    'blocked_daily', v_daily_count >= p_daily_limit
  );
end;
$$;

-- Atomic application submission. This is the actual anti-abuse enforcement.
-- The browser cannot bypass it because the application insert happens here.
create or replace function public.submit_application_guarded(
  p_job_id uuid,
  p_distance_km numeric,
  p_match_score integer,
  p_mismatch_reasons text[] default '{}',
  p_mismatch_keys text[] default '{}',
  p_hourly_limit integer default 2,
  p_daily_limit integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_day_start timestamptz;
  v_day_reset timestamptz;
  v_hourly_count integer;
  v_daily_count integer;
  v_hourly_reset timestamptz;
  v_application_id uuid;
begin
  if v_uid is null or public.my_role() <> 'job_seeker' then
    raise exception 'Only job seekers can apply';
  end if;

  if p_match_score < 0 or p_match_score > 100 then
    raise exception 'Invalid match score';
  end if;

  if not exists(select 1 from public.jobs j where j.id = p_job_id and j.status = 'open') then
    return jsonb_build_object('ok', false, 'code', 'JOB_CLOSED', 'message', 'This vacancy is no longer open.');
  end if;

  if exists(select 1 from public.applications a where a.job_id = p_job_id and a.job_seeker_id = v_uid) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'You already applied to this vacancy.');
  end if;

  -- Serialize submissions per seeker so parallel clicks cannot bypass counts.
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  v_day_start := date_trunc('day', v_now at time zone 'Asia/Kathmandu') at time zone 'Asia/Kathmandu';
  v_day_reset := (date_trunc('day', v_now at time zone 'Asia/Kathmandu') + interval '1 day') at time zone 'Asia/Kathmandu';

  select count(*)::integer, min(a.created_at) + interval '1 hour'
  into v_hourly_count, v_hourly_reset
  from public.applications a
  where a.job_seeker_id = v_uid
    and a.created_at >= v_now - interval '1 hour';

  select count(*)::integer
  into v_daily_count
  from public.applications a
  where a.job_seeker_id = v_uid
    and a.created_at >= v_day_start;

  if v_hourly_count >= p_hourly_limit then
    insert into public.application_rate_limit_hits(job_seeker_id, limit_type, attempted_job_id)
    values(v_uid, 'hourly', p_job_id);

    return jsonb_build_object(
      'ok', false,
      'code', 'HOURLY_LIMIT',
      'message', 'You have reached the short application cooldown.',
      'reset_at', coalesce(v_hourly_reset, v_now + interval '1 hour'),
      'daily_remaining', greatest(0, p_daily_limit - v_daily_count),
      'hourly_remaining', 0
    );
  end if;

  if v_daily_count >= p_daily_limit then
    insert into public.application_rate_limit_hits(job_seeker_id, limit_type, attempted_job_id)
    values(v_uid, 'daily', p_job_id);

    return jsonb_build_object(
      'ok', false,
      'code', 'DAILY_LIMIT',
      'message', 'You have used all applications available today.',
      'reset_at', v_day_reset,
      'daily_remaining', 0,
      'hourly_remaining', greatest(0, p_hourly_limit - v_hourly_count)
    );
  end if;

  insert into public.applications(
    job_id,
    job_seeker_id,
    status,
    distance_km,
    match_score,
    mismatch_reasons,
    mismatch_keys
  ) values (
    p_job_id,
    v_uid,
    'applied',
    p_distance_km,
    p_match_score,
    coalesce(p_mismatch_reasons, '{}'),
    coalesce(p_mismatch_keys, '{}')
  )
  returning id into v_application_id;

  return jsonb_build_object(
    'ok', true,
    'application_id', v_application_id,
    'daily_remaining', greatest(0, p_daily_limit - (v_daily_count + 1)),
    'hourly_remaining', greatest(0, p_hourly_limit - (v_hourly_count + 1))
  );
end;
$$;

-- Detect recurring mismatch patterns from recent applications.
create or replace function public.application_fatigue_signals(
  p_threshold integer default 4,
  p_cooldown_days integer default 7,
  p_recent_limit integer default 30
)
returns table(pattern_key text, occurrences bigint)
language sql
stable
security definer
set search_path = public
as $$
  with recent_apps as (
    select a.id, a.created_at, a.mismatch_keys
    from public.applications a
    where a.job_seeker_id = auth.uid()
    order by a.created_at desc
    limit greatest(1, least(p_recent_limit, 100))
  ), expanded as (
    select unnest(ra.mismatch_keys) as pattern_key
    from recent_apps ra
  ), grouped as (
    select e.pattern_key, count(*)::bigint as occurrences
    from expanded e
    where nullif(btrim(e.pattern_key), '') is not null
    group by e.pattern_key
    having count(*) >= greatest(2, p_threshold)
  )
  select g.pattern_key, g.occurrences
  from grouped g
  where not exists (
    select 1
    from public.application_nudge_dismissals d
    where d.job_seeker_id = auth.uid()
      and d.pattern_key = g.pattern_key
      and d.dismissed_at > now() - make_interval(days => greatest(1, p_cooldown_days))
  )
  order by g.occurrences desc, g.pattern_key
  limit 3;
$$;

revoke all on function public.application_rate_status(integer,integer) from public;
revoke all on function public.submit_application_guarded(uuid,numeric,integer,text[],text[],integer,integer) from public;
revoke all on function public.application_fatigue_signals(integer,integer,integer) from public;

grant execute on function public.application_rate_status(integer,integer) to authenticated;
grant execute on function public.submit_application_guarded(uuid,numeric,integer,text[],text[],integer,integer) to authenticated;
grant execute on function public.application_fatigue_signals(integer,integer,integer) to authenticated;
