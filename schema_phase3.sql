-- CricDeck Database Schema Update
-- Phase 3: Drag-and-Drop Overlay Layouts & Storage Policies

-- 1. Create custom_layouts Table
create table if not exists public.custom_layouts (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.matches(id) on delete cascade,
    layout_data jsonb not null default '{}'::jsonb,
    background_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    
    unique (match_id)
);

-- Enable Row Level Security (RLS)
alter table public.custom_layouts enable row level security;

-- 2. Define RLS Policies for custom_layouts
-- Public Read
create policy "Allow public read access to custom_layouts"
on public.custom_layouts for select
using (true);

-- Owner Insert
create policy "Allow match owners to insert custom_layouts"
on public.custom_layouts for insert
with check (
    exists (
        select 1 from public.matches
        where matches.id = custom_layouts.match_id
        and matches.owner_id = auth.uid()
    )
);

-- Owner Update
create policy "Allow match owners to update custom_layouts"
on public.custom_layouts for update
using (
    exists (
        select 1 from public.matches
        where matches.id = custom_layouts.match_id
        and matches.owner_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.matches
        where matches.id = custom_layouts.match_id
        and matches.owner_id = auth.uid()
    )
);

-- Owner Delete
create policy "Allow match owners to delete custom_layouts"
on public.custom_layouts for delete
using (
    exists (
        select 1 from public.matches
        where matches.id = custom_layouts.match_id
        and matches.owner_id = auth.uid()
    )
);


-- 3. Create Storage Bucket for Overlays (if not already existing)
insert into storage.buckets (id, name, public)
values ('overlays', 'overlays', true)
on conflict (id) do nothing;

-- 4. Define Storage Policies for overlays bucket
-- Allow public read access to uploaded graphic overlays
create policy "Allow public read access to overlays"
on storage.objects for select
using (bucket_id = 'overlays');

-- Allow authenticated match owners to upload overlays
create policy "Allow authenticated upload access to overlays"
on storage.objects for insert
with check (
    bucket_id = 'overlays'
    and auth.role() = 'authenticated'
);

-- Allow authenticated owners to delete overlays
create policy "Allow authenticated delete access to overlays"
on storage.objects for delete
using (
    bucket_id = 'overlays'
    and auth.role() = 'authenticated'
);
