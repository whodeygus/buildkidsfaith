-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text unique not null,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'inactive', -- 'active' | 'past_due' | 'canceled' | 'inactive'
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;

-- Members can read only their own subscription row (used by the site to show/hide the members area).
create policy "subscribers_select_own"
  on public.subscribers for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies are defined for regular users on purpose:
-- all writes happen server-side via the service role key (Stripe webhook), which bypasses RLS.

create index if not exists subscribers_stripe_customer_id_idx on public.subscribers (stripe_customer_id);
