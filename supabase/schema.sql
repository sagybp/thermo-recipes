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

-- ---------------------------------------------------------------------------------------------
-- Tips: short improvements members write for a recipe. One per person per recipe, shown to everyone
-- WITHOUT the author. The owner can hide a tip (hidden = true) with a single update from the server.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.tmx_tips (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  recipe_id  text        not null,
  body       text        not null,
  hidden     boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recipe_id),
  constraint tmx_tips_len  check (char_length(btrim(body)) between 3 and 280),
  constraint tmx_tips_nolinks check (body !~* '(https?:|www\.|[a-z0-9]\.(com|net|org|co|io|il|ru|me|ly)\M)')
);

alter table public.tmx_tips enable row level security;

drop policy if exists "tmx_tips: read own"   on public.tmx_tips;
drop policy if exists "tmx_tips: insert own" on public.tmx_tips;
drop policy if exists "tmx_tips: update own" on public.tmx_tips;
drop policy if exists "tmx_tips: delete own" on public.tmx_tips;
create policy "tmx_tips: read own"   on public.tmx_tips for select to authenticated using (auth.uid() = user_id);
create policy "tmx_tips: insert own" on public.tmx_tips for insert to authenticated with check (auth.uid() = user_id);
create policy "tmx_tips: update own" on public.tmx_tips for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tmx_tips: delete own" on public.tmx_tips for delete to authenticated using (auth.uid() = user_id);

-- What everyone sees: the text and the date, never who wrote it. Hidden tips are left out.
create or replace view public.tmx_recipe_tips as
  select recipe_id, body, created_at
  from public.tmx_tips
  where not hidden
  order by created_at;

-- A person may have at most 100 tips in total (a guard against someone flooding the site).
create or replace function public.tmx_tips_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.tmx_tips where user_id = new.user_id) >= 100 then
    raise exception 'too many tips';
  end if;
  return new;
end $$;
drop trigger if exists tmx_tips_cap on public.tmx_tips;
create trigger tmx_tips_cap before insert on public.tmx_tips for each row execute function public.tmx_tips_cap();

-- ---------------------------------------------------------------------------------------------
-- Suggestions: a member asks for a recipe to be added. Only the owner reads them (from the server).
-- status: new | added | rejected
-- ---------------------------------------------------------------------------------------------
create table if not exists public.tmx_suggestions (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  url        text        not null,
  note       text,
  status     text        not null default 'new' check (status in ('new', 'added', 'rejected')),
  created_at timestamptz not null default now(),
  constraint tmx_sug_url  check (url ~* '^https://cookidoo\.[a-z.]+/[^ ]*r[0-9]+' and char_length(url) <= 300),
  constraint tmx_sug_note check (note is null or char_length(note) <= 200)
);

alter table public.tmx_suggestions enable row level security;

drop policy if exists "tmx_suggestions: insert own" on public.tmx_suggestions;
create policy "tmx_suggestions: insert own" on public.tmx_suggestions for insert to authenticated with check (auth.uid() = user_id);

-- At most 5 requests per person per day.
create or replace function public.tmx_sug_cap() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.tmx_suggestions where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many requests';
  end if;
  return new;
end $$;
drop trigger if exists tmx_sug_cap on public.tmx_suggestions;
create trigger tmx_sug_cap before insert on public.tmx_suggestions for each row execute function public.tmx_sug_cap();

revoke all on public.tmx_tips, public.tmx_recipe_tips, public.tmx_suggestions from anon, authenticated;
grant select on public.tmx_recipe_tips to anon, authenticated;
grant select, delete on public.tmx_tips to authenticated;
grant insert (user_id, recipe_id, body) on public.tmx_tips to authenticated;
grant update (body, updated_at) on public.tmx_tips to authenticated;
grant insert (user_id, url, note) on public.tmx_suggestions to authenticated;

-- Make PostgREST pick up the new tables right away.
notify pgrst, 'reload schema';
