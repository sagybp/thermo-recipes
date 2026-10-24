-- Schema for ratings and synced personal marks of the recipes site.
-- All names start with tmx_ so they never collide with other apps that share the same Supabase instance.
-- Contains no secrets. Safe to re-run.

-- ---------------------------------------------------------------------------------------------
-- Ratings: one score (1-5) per user per recipe.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.tmx_ratings (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  recipe_id  text        not null,
  score      smallint    not null check (score between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, recipe_id)   -- this is what prevents double votes
);

alter table public.tmx_ratings enable row level security;

drop policy if exists "tmx_ratings: read own"   on public.tmx_ratings;
drop policy if exists "tmx_ratings: insert own" on public.tmx_ratings;
drop policy if exists "tmx_ratings: update own" on public.tmx_ratings;
drop policy if exists "tmx_ratings: delete own" on public.tmx_ratings;

create policy "tmx_ratings: read own"   on public.tmx_ratings for select to authenticated using (auth.uid() = user_id);
create policy "tmx_ratings: insert own" on public.tmx_ratings for insert to authenticated with check (auth.uid() = user_id);
create policy "tmx_ratings: update own" on public.tmx_ratings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tmx_ratings: delete own" on public.tmx_ratings for delete to authenticated using (auth.uid() = user_id);

-- Everyone (even logged out) can see the average and the number of votes per recipe, never who voted.
-- The view runs with its owner's rights on purpose (it must read all rows) but exposes only aggregates.
create or replace view public.tmx_recipe_stats as
  select recipe_id,
         round(avg(score)::numeric, 1) as avg_score,
         count(*)::int                 as votes
  from public.tmx_ratings
  group by recipe_id;

-- ---------------------------------------------------------------------------------------------
-- Personal marks (favorite / made it), so they follow the person across devices.
-- ts is signed like in the browser: positive = on since that time, negative = turned off at that time.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.tmx_user_marks (
  user_id   uuid   not null references auth.users (id) on delete cascade,
  kind      text   not null check (kind in ('fav', 'made')),
  recipe_id text   not null,
  ts        bigint not null,
  primary key (user_id, kind, recipe_id)
);

alter table public.tmx_user_marks enable row level security;

drop policy if exists "tmx_marks: own" on public.tmx_user_marks;
create policy "tmx_marks: own" on public.tmx_user_marks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- Privileges: the anonymous role only sees the aggregate view; signed-in users only touch their own rows (RLS above).
-- ---------------------------------------------------------------------------------------------
revoke all on public.tmx_ratings    from anon, authenticated;
revoke all on public.tmx_user_marks from anon, authenticated;
revoke all on public.tmx_recipe_stats from anon, authenticated;

grant select, insert, update, delete on public.tmx_ratings    to authenticated;
grant select, insert, update, delete on public.tmx_user_marks to authenticated;
grant select on public.tmx_recipe_stats to anon, authenticated;

-- Make PostgREST pick up the new tables right away.
notify pgrst, 'reload schema';
