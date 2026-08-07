-- Damak AI Job Hunter — Supabase schema + security policies
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
  ward smallint not null check (ward between 1 and 10),
  city text not null default 'Damak' check (city = 'Damak'),
  education_level text not null,
  experience_months integer not null default 0 check (experience_months between 0 and 600),
  expected_salary_min integer not null check (expected_salary_min >= 0),
  expected_salary_max integer not null check (expected_salary_max >= expected_salary_min),
  employment_type text not null check (employment_type in ('full_time','part_time')),
  available_from time not null,
  available_until time not null,
  max_travel_km numeric(6,2) not null default 5 check (max_travel_km between 0.5 and 100),
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
  ward smallint not null check (ward between 1 and 10),
  city text not null default 'Damak' check (city = 'Damak'),
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
  ward smallint not null check (ward between 1 and 10),
  city text not null default 'Damak' check (city = 'Damak'),
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
grant select (id, business_name, business_type, ward, city) on public.businesses to anon;
grant select, insert, update on public.profiles, public.job_seeker_profiles, public.businesses, public.jobs, public.applications, public.match_results to authenticated;

-- To create an admin after registering that account, run as the database owner in SQL Editor:
-- update public.profiles set role = 'admin' where id = '<ADMIN_USER_UUID>';
