-- Reenganches post-fotos: paso 1 (40m), 2 (+3h desde último envío), 3 (+6h desde último envío).
create table if not exists public.lead_post_fotos (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  lead_id bigint references public.leads (id) on delete set null,
  session_id text not null,
  paso smallint not null,
  constraint lead_post_fotos_paso_chk check (paso in (1, 2, 3)),
  programada timestamptz not null,
  enviada timestamptz,
  mensaje text,
  cancelada text
);

create unique index if not exists lead_post_fotos_pending_uidx
  on public.lead_post_fotos (session_id, paso)
  where enviada is null and cancelada is null;

create index if not exists lead_post_fotos_due_idx
  on public.lead_post_fotos (programada)
  where enviada is null and cancelada is null;

create index if not exists lead_post_fotos_session_idx
  on public.lead_post_fotos (session_id);

alter table public.lead_post_fotos enable row level security;
revoke all on table public.lead_post_fotos from anon, authenticated;
grant all on table public.lead_post_fotos to service_role;
grant usage, select on sequence public.lead_post_fotos_id_seq to service_role;

create or replace function public.fn_list_due_post_fotos(p_limit integer default 10)
returns table (
  id bigint,
  lead_id bigint,
  session_id text,
  paso smallint,
  programada timestamptz,
  lead_id_kommo bigint,
  contact_id bigint,
  name text,
  brand text,
  model text,
  year integer,
  price double precision,
  mileage integer,
  fuel_type text,
  color text,
  bot_apagado boolean,
  respondio_post_fotos boolean
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.lead_id,
    p.session_id,
    p.paso,
    p.programada,
    l.lead_id_kommo,
    l.contact_id,
    l.name,
    i.brand,
    i.model,
    i.year,
    i.price,
    i.mileage,
    i.fuel_type,
    i.color,
    coalesce(l.bot_apagado, false) as bot_apagado,
    coalesce(l.respondio_post_fotos, false) as respondio_post_fotos
  from public.lead_post_fotos p
  left join public.leads l on l.id = p.lead_id
  left join lateral (
    select ic.inventory_id
    from public.interested_cars ic
    where ic.lead_id = l.id
    order by ic.id desc
    limit 1
  ) latest on true
  left join public.inventoryoracle i on i.id = latest.inventory_id
  where p.enviada is null
    and p.cancelada is null
    and p.programada <= now()
    and coalesce(l.respondio_post_fotos, false) = false
  order by p.programada asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke all on function public.fn_list_due_post_fotos(integer) from public;
grant execute on function public.fn_list_due_post_fotos(integer) to service_role;
