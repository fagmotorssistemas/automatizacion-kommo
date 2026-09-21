-- Traza de cada paso del bot: ok / skipped / error.
create table if not exists public.automation_run_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_id text,
  lead_id text,
  message_id text,
  step text not null,
  status text not null,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  error text
);

create index if not exists automation_run_logs_created_at_idx
  on public.automation_run_logs (created_at desc);

alter table public.automation_run_logs enable row level security;

revoke all on table public.automation_run_logs from anon, authenticated;
