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
