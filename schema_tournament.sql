-- CricDeck Tournament Management Schema Addition
-- Enables multi-team tournament setups, roster management, and ICC statistical tracking

-- 1. Tournaments Table
create table if not exists public.tournaments (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    format text not null check (format in ('T20', 'ODI', '10-Overs', 'Custom')),
    overs_quota integer not null default 20 check (overs_quota > 0),
    rules jsonb not null default '{}'::jsonb,
    status text not null default 'active' check (status in ('active', 'completed')),
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

-- 2. Teams Table (associated with a tournament)
create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    name text not null,
    logo_data text, -- base64 data url or public image url
    created_at timestamptz not null default now()
);

-- 3. Players Table (associated with a team)
create table if not exists public.players (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    name text not null,
    role text not null check (role in ('Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper')),
    photo_data text, -- base64 data url or public profile photo url
    created_at timestamptz not null default now()
);

-- 4. Alter matches table to tie to tournament and teams
-- Note: In a live database environment, these would be applied as ALTER statements if tables already exist.
-- Here we document the full schema additions for tournament integrations:
alter table public.matches add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
alter table public.matches add column if not exists team_a_id uuid references public.teams(id);
alter table public.matches add column if not exists team_b_id uuid references public.teams(id);
alter table public.matches add column if not exists winner_id uuid references public.teams(id);

-- Enable RLS
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;

-- Define Policies

-- Tournaments Policies
create policy "Allow public read access to tournaments"
on public.tournaments for select using (true);

create policy "Allow authenticated tournament creation"
on public.tournaments for insert with check (auth.uid() = owner_id);

create policy "Allow owners to update tournaments"
on public.tournaments for update using (auth.uid() = owner_id);

create policy "Allow owners to delete tournaments"
on public.tournaments for delete using (auth.uid() = owner_id);

-- Teams Policies
create policy "Allow public read access to teams"
on public.teams for select using (true);

create policy "Allow owners to insert teams"
on public.teams for insert with check (
    exists (
        select 1 from public.tournaments
        where id = tournament_id and owner_id = auth.uid()
    )
);

create policy "Allow owners to update teams"
on public.teams for update using (
    exists (
        select 1 from public.tournaments
        where id = tournament_id and owner_id = auth.uid()
    )
);

create policy "Allow owners to delete teams"
on public.teams for delete using (
    exists (
        select 1 from public.tournaments
        where id = tournament_id and owner_id = auth.uid()
    )
);

-- Players Policies
create policy "Allow public read access to players"
on public.players for select using (true);

create policy "Allow owners to insert players"
on public.players for insert with check (
    exists (
        select 1 from public.teams t
        join public.tournaments tour on t.tournament_id = tour.id
        where t.id = team_id and tour.owner_id = auth.uid()
    )
);

create policy "Allow owners to update players"
on public.players for update using (
    exists (
        select 1 from public.teams t
        join public.tournaments tour on t.tournament_id = tour.id
        where t.id = team_id and tour.owner_id = auth.uid()
    )
);

create policy "Allow owners to delete players"
on public.players for delete using (
    exists (
        select 1 from public.teams t
        join public.tournaments tour on t.tournament_id = tour.id
        where t.id = team_id and tour.owner_id = auth.uid()
    )
);
