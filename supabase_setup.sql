-- =========================================================================
-- CRICDECK UNIFIED DATABASE SCHEMA & STORAGE SETUP
-- Run this entire script inside your Supabase SQL Editor.
-- =========================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =========================================================================
-- 1. Tournaments Table
-- =========================================================================
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

-- =========================================================================
-- 2. Teams Table
-- =========================================================================
create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    name text not null,
    logo_data text, -- base64 data url or public image url
    created_at timestamptz not null default now()
);

-- =========================================================================
-- 3. Players Table
-- =========================================================================
create table if not exists public.players (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    name text not null,
    role text not null check (role in ('Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper')),
    photo_data text, -- base64 data url or public profile photo url
    created_at timestamptz not null default now()
);

-- =========================================================================
-- 4. Matches Table
-- =========================================================================
create table if not exists public.matches (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    team_a text not null,
    team_b text not null,
    toss_winner text,
    elected_to text check (elected_to in ('Bat', 'Bowl')),
    current_innings integer not null default 1 check (current_innings in (1, 2)),
    status text not null default 'live' check (status in ('scheduled', 'live', 'completed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    tournament_id uuid references public.tournaments(id) on delete cascade,
    team_a_id uuid references public.teams(id),
    team_b_id uuid references public.teams(id),
    winner_id uuid references public.teams(id)
);

-- =========================================================================
-- 5. Live Scores Table
-- =========================================================================
create table if not exists public.live_scores (
    match_id uuid primary key references public.matches(id) on delete cascade,
    total_runs integer not null default 0 check (total_runs >= 0),
    wickets integer not null default 0 check (wickets between 0 and 10),
    overs integer not null default 0 check (overs >= 0),
    balls_in_over integer not null default 0 check (balls_in_over between 0 and 5),
    run_rate numeric(4, 2) not null default 0.00 check (run_rate >= 0),
    striker_stats jsonb not null default '{}'::jsonb,
    non_striker_stats jsonb not null default '{}'::jsonb,
    current_bowler_stats jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

-- =========================================================================
-- 6. Ball by Ball Table (Ledger & Undo Stack)
-- =========================================================================
create table if not exists public.ball_by_ball (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.matches(id) on delete cascade,
    delivery_index integer not null check (delivery_index >= 0),
    over_number integer not null check (over_number >= 1),
    ball_number integer not null check (ball_number between 1 and 6),
    striker_name text not null,
    non_striker_name text not null,
    bowler_name text not null,
    runs_batter integer not null default 0 check (runs_batter >= 0),
    runs_extras integer not null default 0 check (runs_extras >= 0),
    extra_type text check (extra_type in ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty')),
    wicket_type text check (wicket_type in ('bowled', 'caught', 'caught_behind', 'lbw', 'stumped', 'run_out', 'run_out_wide', 'run_out_noball', 'retired_hurt')),
    dismissed_batter_name text,
    fielder_name text,
    keeper_name text,
    is_legal boolean not null default true,
    innings integer not null default 1,
    created_at timestamptz not null default now(),
    
    unique (match_id, delivery_index)
);

-- =========================================================================
-- 7. Custom Graphic Layouts Table
-- =========================================================================
create table if not exists public.custom_layouts (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.matches(id) on delete cascade,
    layout_data jsonb not null default '{}'::jsonb,
    background_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    
    unique (match_id)
);

-- =========================================================================
-- 8. Enable Row Level Security (RLS) on all tables
-- =========================================================================
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.live_scores enable row level security;
alter table public.ball_by_ball enable row level security;
alter table public.custom_layouts enable row level security;

-- =========================================================================
-- 9. Define RLS Policies
-- =========================================================================

-- Tournaments Policies
create policy "Allow public read access to tournaments" on public.tournaments for select using (true);
create policy "Allow authenticated tournament creation" on public.tournaments for insert with check (auth.uid() = owner_id);
create policy "Allow owners to update tournaments" on public.tournaments for update using (auth.uid() = owner_id);
create policy "Allow owners to delete tournaments" on public.tournaments for delete using (auth.uid() = owner_id);

-- Teams Policies
create policy "Allow public read access to teams" on public.teams for select using (true);
create policy "Allow owners to insert teams" on public.teams for insert with check (
    exists (select 1 from public.tournaments where id = tournament_id and owner_id = auth.uid())
);
create policy "Allow owners to update teams" on public.teams for update using (
    exists (select 1 from public.tournaments where id = tournament_id and owner_id = auth.uid())
);
create policy "Allow owners to delete teams" on public.teams for delete using (
    exists (select 1 from public.tournaments where id = tournament_id and owner_id = auth.uid())
);

-- Players Policies
create policy "Allow public read access to players" on public.players for select using (true);
create policy "Allow owners to insert players" on public.players for insert with check (
    exists (select 1 from public.teams t join public.tournaments tour on t.tournament_id = tour.id where t.id = team_id and tour.owner_id = auth.uid())
);
create policy "Allow owners to update players" on public.players for update using (
    exists (select 1 from public.teams t join public.tournaments tour on t.tournament_id = tour.id where t.id = team_id and tour.owner_id = auth.uid())
);
create policy "Allow owners to delete players" on public.players for delete using (
    exists (select 1 from public.teams t join public.tournaments tour on t.tournament_id = tour.id where t.id = team_id and tour.owner_id = auth.uid())
);

-- Matches Policies
create policy "Allow public read access to matches" on public.matches for select using (true);
create policy "Allow authenticated match creation" on public.matches for insert with check (auth.uid() = owner_id);
create policy "Allow match owners to update matches" on public.matches for update using (auth.uid() = owner_id);
create policy "Allow match owners to delete matches" on public.matches for delete using (auth.uid() = owner_id);

-- Live Scores Policies
create policy "Allow public read access to live_scores" on public.live_scores for select using (true);
create policy "Allow match owners to insert live_scores" on public.live_scores for insert with check (
    exists (select 1 from public.matches where matches.id = live_scores.match_id and matches.owner_id = auth.uid())
);
create policy "Allow match owners to update live_scores" on public.live_scores for update using (
    exists (select 1 from public.matches where matches.id = live_scores.match_id and matches.owner_id = auth.uid())
);
create policy "Allow match owners to delete live_scores" on public.live_scores for delete using (
    exists (select 1 from public.matches where matches.id = live_scores.match_id and matches.owner_id = auth.uid())
);

-- Ball-by-ball Policies
create policy "Allow public read access to ball_by_ball" on public.ball_by_ball for select using (true);
create policy "Allow match owners to insert deliveries" on public.ball_by_ball for insert with check (
    exists (select 1 from public.matches where matches.id = ball_by_ball.match_id and matches.owner_id = auth.uid())
);
create policy "Allow match owners to update deliveries" on public.ball_by_ball for update using (
    exists (select 1 from public.matches where matches.id = ball_by_ball.match_id and matches.owner_id = auth.uid())
);
create policy "Allow match owners to delete deliveries" on public.ball_by_ball for delete using (
    exists (select 1 from public.matches where matches.id = ball_by_ball.match_id and matches.owner_id = auth.uid())
);

-- Custom Layouts Policies
create policy "Allow public read access to custom_layouts" on public.custom_layouts for select using (true);
create policy "Allow match owners to insert custom_layouts" on public.custom_layouts for insert with check (
    exists (select 1 from public.matches where matches.id = custom_layouts.match_id and matches.owner_id = auth.uid())
);
create policy "Allow match owners to update custom_layouts" on public.custom_layouts for update using (
    exists (select 1 from public.matches where matches.id = custom_layouts.match_id and matches.owner_id = auth.uid())
);
create policy "Allow match owners to delete custom_layouts" on public.custom_layouts for delete using (
    exists (select 1 from public.matches where matches.id = custom_layouts.match_id and matches.owner_id = auth.uid())
);

-- =========================================================================
-- 10. Storage Bucket Setup for Overlays
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('overlays', 'overlays', true)
on conflict (id) do nothing;

create policy "Allow public read access to overlays" on storage.objects for select using (bucket_id = 'overlays');
create policy "Allow authenticated upload access to overlays" on storage.objects for insert with check (bucket_id = 'overlays' and auth.role() = 'authenticated');
create policy "Allow authenticated delete access to overlays" on storage.objects for delete using (bucket_id = 'overlays' and auth.role() = 'authenticated');
