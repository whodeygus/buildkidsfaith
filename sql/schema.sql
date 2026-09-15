-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text unique not null,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'inactive', -- 'active' | 'past_due' | 'canceled' | 'inactive'
  plan text, -- 'monthly' | 'annual', from the Stripe price's billing interval
  months_unlocked integer not null default 1, -- monthly plan: content unlocks one month per billing cycle; annual plan gets full access regardless of this value
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to re-run: adds the columns above to a subscribers table that was
-- already created before plan/months_unlocked existed.
alter table public.subscribers add column if not exists plan text;
alter table public.subscribers add column if not exists months_unlocked integer not null default 1;

alter table public.subscribers enable row level security;

-- Members can read only their own subscription row (used by the site to show/hide the members area).
create policy "subscribers_select_own"
  on public.subscribers for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies are defined for regular users on purpose:
-- all writes happen server-side via the service role key (Stripe webhook), which bypasses RLS.

create index if not exists subscribers_stripe_customer_id_idx on public.subscribers (stripe_customer_id);

-- Single-row table the keep-alive GitHub Action writes to. A confirmed,
-- successful read via the anon key did NOT stop Supabase's free-tier
-- auto-pause clock (verified in practice), so the keep-alive workflow now
-- performs a real write here via the service role key instead - a write is
-- a stronger "this project is in real use" signal than a read, though even
-- this isn't guaranteed to be honored by Supabase's internal pause logic.
create table if not exists public.keepalive (
  id boolean primary key default true,
  pinged_at timestamptz not null default now(),
  constraint keepalive_singleton check (id)
);

insert into public.keepalive (id) values (true) on conflict (id) do nothing;

alter table public.keepalive enable row level security;
-- No policies defined on purpose: only the service role (which bypasses
-- RLS) ever touches this table. No one else needs read or write access.
