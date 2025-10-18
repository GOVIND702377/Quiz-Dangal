-- AI Quiz Automation schema
-- Creates settings, providers, jobs, and logs tables with admin-only RLS

begin;

-- Settings table (single-row config)
create table if not exists public.ai_settings (
  id smallint primary key default 1,
  is_enabled boolean not null default true,
  cadence_min integer not null default 10 check (cadence_min > 0 and cadence_min <= 60),
  live_window_min integer not null default 7 check (live_window_min > 0 and live_window_min <= 180),
  cleanup_days integer not null default 3 check (cleanup_days >= 1 and cleanup_days <= 30),
  categories text[] not null default array['opinion','gk','sports','movies']::text[],
  alert_emails text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Providers table (multiple providers with priority/failover)
create table if not exists public.ai_providers (
  id bigserial primary key,
  name text not null,
  api_key_enc text,
  priority integer not null default 1,
  enabled boolean not null default true,
  quota_exhausted boolean not null default false,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_providers_priority_idx on public.ai_providers (enabled desc, quota_exhausted asc, priority asc, id asc);

-- Jobs table (idempotency window per category + slot)
create table if not exists public.ai_generation_jobs (
  id bigserial primary key,
  category text not null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','skipped')),
  provider_name text,
  error text,
  quiz_id uuid references public.quizzes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, slot_start)
);

create index if not exists ai_generation_jobs_recent_idx on public.ai_generation_jobs (slot_start desc);

-- Logs table (verbose diagnostics)
create table if not exists public.ai_generation_logs (
  id bigserial primary key,
  job_id bigint references public.ai_generation_jobs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

-- Simple updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_ai_settings_updated_at'
  ) then
    create trigger trg_ai_settings_updated_at before update on public.ai_settings
    for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_ai_providers_updated_at'
  ) then
    create trigger trg_ai_providers_updated_at before update on public.ai_providers
    for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_ai_generation_jobs_updated_at'
  ) then
    create trigger trg_ai_generation_jobs_updated_at before update on public.ai_generation_jobs
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS: admin-only access via profiles.role = 'admin'
alter table public.ai_settings enable row level security;
alter table public.ai_providers enable row level security;
alter table public.ai_generation_jobs enable row level security;
alter table public.ai_generation_logs enable row level security;

-- helper policy predicate: is_admin via profiles table
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role,'')) = 'admin'
  );
$$;

-- Policies: only admins can select/modify
do $$ begin
  -- ai_settings
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_settings' and policyname='ai_settings_admin_all') then
    create policy ai_settings_admin_all on public.ai_settings
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
  -- ai_providers
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_providers' and policyname='ai_providers_admin_all') then
    create policy ai_providers_admin_all on public.ai_providers
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
  -- ai_generation_jobs
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_generation_jobs' and policyname='ai_generation_jobs_admin_all') then
    create policy ai_generation_jobs_admin_all on public.ai_generation_jobs
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
  -- ai_generation_logs
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_generation_logs' and policyname='ai_generation_logs_admin_all') then
    create policy ai_generation_logs_admin_all on public.ai_generation_logs
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- seed default settings row if missing
insert into public.ai_settings (id, alert_emails)
  values (1, array['quizdangalofficial@gmail.com']::text[])
on conflict (id) do nothing;

commit;

-- Add is_ai_generated column to quizzes for safe cleanup/filtering
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='is_ai_generated'
  ) then
    alter table public.quizzes add column is_ai_generated boolean not null default false;
  end if;
end $$;
