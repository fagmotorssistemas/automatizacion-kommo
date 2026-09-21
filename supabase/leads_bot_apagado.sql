-- Tramo con "atiende IA?" marcado: Nest no responde, pero guarda el hilo.
alter table public.leads
  add column if not exists bot_apagado boolean not null default false,
  add column if not exists bot_apagado_at timestamptz,
  add column if not exists ultimo_mensaje_ignorado text,
  add column if not exists handoff_transcript jsonb,
  add column if not exists handoff_resumen text;

comment on column public.leads.bot_apagado is
  'true si Kommo tiene atiende IA? y Nest no responde';
comment on column public.leads.bot_apagado_at is
  'Primera vez que se detectó el bot apagado en este tramo';
comment on column public.leads.ultimo_mensaje_ignorado is
  'Último texto del cliente mientras el bot estaba apagado';
comment on column public.leads.handoff_transcript is
  'Array JSON de turnos {role,name,text,at} cliente/asesor mientras el bot estuvo apagado';
comment on column public.leads.handoff_resumen is
  'Resumen masticado por IA del tramo cliente/asesor para el agente de ventas';

create index if not exists leads_bot_apagado_idx
  on public.leads (bot_apagado)
  where bot_apagado = true;
