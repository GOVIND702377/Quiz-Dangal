-- Numeric Levels Migration (safe + idempotent)
-- Switch to integer-based levels 1..100 with cumulative coins_required thresholds.
-- Convert profiles.level to integer and update assign_level trigger/function.
-- Add helper function get_next_level_info(user_id) for FE popup.

begin;

-- 0) Prep: Drop dependent trigger and function if exist to avoid dependency errors
do $$ begin
  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_assign_level' and n.nspname = 'public' and c.relname = 'profiles'
  ) then
    execute 'drop trigger if exists trg_assign_level on public.profiles';
  end if;
  if exists (select 1 from pg_proc where proname = 'assign_level' and pg_function_is_visible(oid)) then
    execute 'drop function if exists public.assign_level()';
  end if;
end $$;

-- 1) Recreate levels table with new schema (level int, coins_required int)
-- We'll replace existing public.levels entirely to keep the name stable
drop table if exists public.levels cascade;

create table public.levels (
  level integer primary key,
  coins_required integer not null unique
);

-- RLS: readable to authenticated
alter table public.levels enable row level security;
drop policy if exists levels_read_auth on public.levels;
create policy levels_read_auth on public.levels for select to authenticated using (true);

-- 2) Insert thresholds (levels 1..100)
insert into public.levels(level, coins_required) values
 (1, 50),(2, 200),(3, 450),(4, 800),(5, 1250),(6, 1800),(7, 2450),(8, 3200),(9, 4050),(10, 5000),
 (11, 6050),(12, 7200),(13, 8450),(14, 9800),(15, 11250),(16, 12800),(17, 14450),(18, 16200),(19, 18050),(20, 20000),
 (21, 22050),(22, 24200),(23, 26450),(24, 28800),(25, 31250),(26, 33800),(27, 36450),(28, 39200),(29, 42050),(30, 45000),
 (31, 48050),(32, 51200),(33, 54450),(34, 57800),(35, 61250),(36, 64800),(37, 68450),(38, 72200),(39, 76050),(40, 80000),
 (41, 84050),(42, 88200),(43, 92450),(44, 96800),(45, 101250),(46, 105800),(47, 110450),(48, 115200),(49, 120050),(50, 125000),
 (51, 130050),(52, 135200),(53, 140450),(54, 145800),(55, 151250),(56, 156800),(57, 162450),(58, 168200),(59, 174050),(60, 180000),
 (61, 186050),(62, 192200),(63, 198450),(64, 204800),(65, 211250),(66, 217800),(67, 224450),(68, 231200),(69, 238050),(70, 245000),
 (71, 252050),(72, 259200),(73, 266450),(74, 273800),(75, 281250),(76, 288800),(77, 296450),(78, 304200),(79, 312050),(80, 320000),
 (81, 328050),(82, 336200),(83, 344450),(84, 352800),(85, 361250),(86, 369800),(87, 378450),(88, 387200),(89, 396050),(90, 405000),
 (91, 414050),(92, 423200),(93, 432450),(94, 441800),(95, 451250),(96, 460800),(97, 470450),(98, 480200),(99, 490050),(100, 500000)
 on conflict (level) do update set coins_required = excluded.coins_required;

-- 3) Ensure profiles.level is integer; migrate data based on total_coins
-- Add temp column if needed
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'level_int'
  ) then
    alter table public.profiles add column level_int integer default 0;
  end if;
end $$;

-- Compute numeric level from thresholds (0 if below level 1)
update public.profiles p
set level_int = coalesce((
  select max(l.level) from public.levels l
  where coalesce(p.total_coins,0) >= l.coins_required
), 0);

-- Drop old level column if text; then rename temp
do $$ begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'level'
  ) then
    -- Try to drop existing level column (regardless of type) and replace with integer column
    alter table public.profiles drop column level;
  end if;
end $$;

alter table public.profiles rename column level_int to level;
alter table public.profiles alter column level set not null;

-- 4) Recreate assign_level() function with numeric levels
create or replace function public.assign_level() returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  update public.profiles
  set level = coalesce((
    select max(l.level) from public.levels l
    where coalesce(new.total_coins,0) >= l.coins_required
  ), 0)
  where id = new.id;
  return new;
end;
$$;

-- 5) Recreate trigger on profiles for total_coins updates
create trigger trg_assign_level
after update of total_coins on public.profiles
for each row execute function public.assign_level();

-- 6) Helper function for FE: next level info
create or replace function public.get_next_level_info(p_user_id uuid)
returns table(
  current_level integer,
  next_level integer,
  coins_required_next integer,
  coins_have numeric,
  coins_remaining numeric
)
language sql
stable
as $$
  with me as (
    select level as curr, coalesce(total_coins,0) as have
    from public.profiles where id = p_user_id
  ), nxt as (
    select l.level, l.coins_required
    from public.levels l, me
    where l.level = case when me.curr >= 100 then 100 else me.curr + 1 end
  )
  select
    me.curr as current_level,
    case when me.curr >= 100 then 100 else me.curr + 1 end as next_level,
    coalesce(nxt.coins_required, (select max(coins_required) from public.levels)) as coins_required_next,
    me.have as coins_have,
    greatest(0, coalesce(nxt.coins_required, (select max(coins_required) from public.levels)) - me.have) as coins_remaining
  from me
  left join nxt on true;
$$;

commit;
