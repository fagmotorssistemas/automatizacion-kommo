-- Seguimiento (retomas 1/2/3). Independiente del recovery 2d/7d/15d/30d de n8n.

alter table public.lead_conversation_analysis
  add column if not exists seguimiento text not null default 'activo';

alter table public.lead_conversation_analysis
  drop constraint if exists lead_conversation_analysis_seguimiento_chk;

alter table public.lead_conversation_analysis
  add constraint lead_conversation_analysis_seguimiento_chk
  check (seguimiento in ('activo', 'aplazado', 'cerrado'));

comment on column public.lead_conversation_analysis.seguimiento is
  'activo=retomas 1-2-3; aplazado=solo 3; cerrado=ninguna. "Gracias/ok" no es cerrado.';

create table if not exists public.lead_followup (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  lead_id bigint references public.leads (id) on delete set null,
  session_id text not null,
  retoma smallint not null,
  constraint lead_followup_retoma_chk check (retoma in (1, 2, 3)),
  programada timestamptz not null,
  enviada timestamptz,
  mensaje text,
  respondio boolean not null default false,
  cancelada text
);

-- Solo una pendiente por (sesión, retoma); permite reprogramar tras cancelar/enviar.
create unique index if not exists lead_followup_pending_uidx
  on public.lead_followup (session_id, retoma)
  where enviada is null and cancelada is null;

comment on table public.lead_followup is
  'Una fila por retoma programada. Histórico libre; solo una pendiente por (session, retoma).';

create index if not exists lead_followup_due_idx
  on public.lead_followup (programada)
  where enviada is null and cancelada is null;

create index if not exists lead_followup_session_idx
  on public.lead_followup (session_id);

create index if not exists lead_followup_lead_idx
  on public.lead_followup (lead_id)
  where lead_id is not null;

alter table public.lead_followup enable row level security;
revoke all on table public.lead_followup from anon, authenticated;
grant all on table public.lead_followup to service_role;
grant usage, select on sequence public.lead_followup_id_seq to service_role;

drop function if exists public.fn_list_due_followups(integer);

-- Candidatas a enviar: no compara días exactos; usa programada <= now().
create or replace function public.fn_list_due_followups(p_limit integer default 20)
returns table (
  id bigint,
  lead_id bigint,
  session_id text,
  retoma smallint,
  programada timestamptz,
  created_at timestamptz,
  lead_id_kommo bigint,
  seguimiento text,
  etapa_max smallint,
  objecion_principal public.objecion_tipo,
  resumen text,
  vehiculos_consultados text[],
  objecion_texto text,
  objecion_evidencia text,
  presupuesto_declarado text,
  stop boolean,
  bot_apagado boolean,
  last_human_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    f.id,
    f.lead_id,
    f.session_id,
    f.retoma,
    f.programada,
    f.created_at,
    l.lead_id_kommo,
    coalesce(a.seguimiento, 'activo') as seguimiento,
    coalesce(a.etapa_max, 0)::smallint as etapa_max,
    a.objecion_principal,
    a.resumen,
    coalesce(a.vehiculos_consultados, '{}') as vehiculos_consultados,
    a.objecion_texto,
    a.objecion_evidencia,
    a.presupuesto_declarado,
    coalesce(r.stop, false) as stop,
    coalesce(l.bot_apagado, false) as bot_apagado,
    (
      select max(h.created_at)
      from public.n8n_chat_histories h
      where h.session_id = f.session_id
        and coalesce(h.message->>'type', '') = 'human'
    ) as last_human_at
  from public.lead_followup f
  left join public.leads l on l.id = f.lead_id
  left join public.lead_conversation_analysis a on a.session_id = f.session_id
  left join public.lead_recovery r on r.lead_id = f.lead_id
  where f.enviada is null
    and f.cancelada is null
    and f.programada <= now()
  order by f.programada asc
  limit greatest(coalesce(p_limit, 20), 1);
$$;

revoke all on function public.fn_list_due_followups(integer) from public, anon, authenticated;
grant execute on function public.fn_list_due_followups(integer) to service_role;
