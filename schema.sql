-- CricDeck Database Schema
-- Phase 1: Matches, Live Scores, and Ball-by-ball Ledger

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Matches Table
create table public.matches (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    team_a text not null,
    team_b text not null,
    toss_winner text,
    elected_to text check (elected_to in ('Bat', 'Bowl')),
    current_innings integer not null default 1 check (current_innings in (1, 2)),
    status text not null default 'live' check (status in ('scheduled', 'live', 'completed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Live Scores Table
create table public.live_scores (
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

-- 3. Ball by Ball Table (Ledger & Undo Stack)
create table public.ball_by_ball (
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
    wicket_type text check (wicket_type in ('bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'retired_hurt', 'obstructing_field', 'handled_ball')),
    dismissed_batter_name text,
    is_legal boolean not null default true,
    created_at timestamptz not null default now(),
    
    -- Ensure chronological order is unique per match
    unique (match_id, delivery_index)
);

-- 4. Enable Row Level Security (RLS) on all tables
alter table public.matches enable row level security;
alter table public.live_scores enable row level security;
alter table public.ball_by_ball enable row level security;

-- 5. Define RLS Policies

-- =========================================================================
-- Matches Table Policies
-- =========================================================================

-- Public Read
create policy "Allow public read access to matches"
on public.matches for select
using (true);

-- Authenticated Insert (creates match as owner)
create policy "Allow authenticated match creation"
on public.matches for insert
with check (auth.uid() = owner_id);

-- Owner Update
create policy "Allow match owners to update their matches"
on public.matches for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- Owner Delete
create policy "Allow match owners to delete their matches"
on public.matches for delete
using (auth.uid() = owner_id);

-- =========================================================================
-- Live Scores Table Policies
-- =========================================================================

-- Public Read
create policy "Allow public read access to live_scores"
on public.live_scores for select
using (true);

-- Owner Insert
create policy "Allow match owners to insert live_scores"
on public.live_scores for insert
with check (
    exists (
        select 1 from public.matches
        where matches.id = live_scores.match_id
        and matches.owner_id = auth.uid()
    )
);

-- Owner Update
create policy "Allow match owners to update live_scores"
on public.live_scores for update
using (
    exists (
        select 1 from public.matches
        where matches.id = live_scores.match_id
        and matches.owner_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.matches
        where matches.id = live_scores.match_id
        and matches.owner_id = auth.uid()
    )
);

-- Owner Delete
create policy "Allow match owners to delete live_scores"
on public.live_scores for delete
using (
    exists (
        select 1 from public.matches
        where matches.id = live_scores.match_id
        and matches.owner_id = auth.uid()
    )
);

-- =========================================================================
-- Ball-by-ball Table Policies
-- =========================================================================

-- Public Read
create policy "Allow public read access to ball_by_ball"
on public.ball_by_ball for select
using (true);

-- Owner Insert
create policy "Allow match owners to insert deliveries"
on public.ball_by_ball for insert
with check (
    exists (
        select 1 from public.matches
        where matches.id = ball_by_ball.match_id
        and matches.owner_id = auth.uid()
    )
);

-- Owner Update
create policy "Allow match owners to update deliveries"
on public.ball_by_ball for update
using (
    exists (
        select 1 from public.matches
        where matches.id = ball_by_ball.match_id
        and matches.owner_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.matches
        where matches.id = ball_by_ball.match_id
        and matches.owner_id = auth.uid()
    )
);

-- Owner Delete
create policy "Allow match owners to delete deliveries"
on public.ball_by_ball for delete
using (
    exists (
        select 1 from public.matches
        where matches.id = ball_by_ball.match_id
        and matches.owner_id = auth.uid()
    )
);
