-- Entregable D. Chat temporal en n8n_chat_histories; esta fila no se borra.
-- No toca el bot, Kommo ni SHADOW_MODE de WhatsApp.
--
-- Dedup: 10 minutos es el punto de partida, no un valor medido.
-- Los duplicados vistos caían en el mismo minuto. 10 es conservador y puede
-- juntar repeticiones legítimas cercanas. Se ajusta en el argumento
-- p_dedup_minutes cuando el backfill lo muestre; no es una columna.
--
-- Embudo de esta tabla: etapas 0 a 5. Visita real, negociación y venta no viven aquí.
--
-- Reversible:
--   drop function if exists public.fn_purge_analyzed_chats();
--   drop function if exists public.fn_save_conversation_analysis(text, bigint, smallint, text[], numeric, public.objecion_tipo, text, text, text, text, timestamptz, boolean);
--   drop function if exists public.fn_conversation_packet(text, integer);
--   drop function if exists public.fn_list_conversation_batch(integer);
--   drop function if exists public.fn_release_analysis_lock(uuid);
--   drop function if exists public.fn_claim_analysis_lock(uuid);
--   drop function if exists public.fn_conversation_sql_self_check();
--   drop function if exists public.chat_max_price(text);
--   drop function if exists public.chat_try_jsonb(text);
--   drop table if exists public.analysis_job_lock;
--   drop trigger if exists lead_conversation_analysis_keep_max_etapa on public.lead_conversation_analysis;
--   drop function if exists public.lead_conversation_analysis_keep_max_etapa();
--   drop table if exists public.lead_conversation_analysis;
--   drop type if exists public.objecion_tipo;

create type public.objecion_tipo as enum (
  'precio',
  'entrada',
  'rechaza_credito',
  'retoma',
  'modelo',
  'equipamiento',
  'km',
  'solo_cotiza',
  'ubicacion',
  'ya_compro',
  'sin_conversacion',
  'no_responde',
  'sin_cierre',
  'numero_equivocado',
  'fuera_territorio',
  'otro'
);

create table if not exists public.lead_conversation_analysis (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  session_id text not null,
  lead_id bigint references public.leads (id) on delete set null,
  etapa_max smallint not null default 0,
  constraint lead_conversation_analysis_etapa_max_chk
    check (etapa_max between 0 and 5),
  vehiculos_consultados text[] not null default '{}',
  precio_max_mostrado numeric,
  objecion_principal public.objecion_tipo,
  objecion_texto text,
  objecion_evidencia text,
  resumen text,
  presupuesto_declarado text,
  analizado_hasta timestamptz,
  cerrada boolean not null default false,
  cerrada_at timestamptz,
  constraint lead_conversation_analysis_session_id_key unique (session_id)
);

comment on table public.lead_conversation_analysis is
  'Hecho permanente de una conversación. n8n_chat_histories es la evidencia temporal.';
comment on column public.lead_conversation_analysis.etapa_max is
  'Máxima etapa 0-5. Nunca disminuye. 6-8 no se guardan aquí.';
comment on column public.lead_conversation_analysis.analizado_hasta is
  'Último mensaje de la fuente ya incluido. La actualización manda el resumen y lo posterior.';
comment on column public.lead_conversation_analysis.cerrada is
  'Análisis final (7+ días). El cron no la vuelve a tocar.';
comment on column public.lead_conversation_analysis.lead_id is
  'Nullable. Sesiones sin match en leads siguen en los reportes agregados.';

create index if not exists lead_conversation_analysis_objecion_idx
  on public.lead_conversation_analysis (objecion_principal);
create index if not exists lead_conversation_analysis_etapa_max_idx
  on public.lead_conversation_analysis (etapa_max);
create index if not exists lead_conversation_analysis_lead_id_idx
  on public.lead_conversation_analysis (lead_id)
  where lead_id is not null;
create index if not exists lead_conversation_analysis_vehiculos_idx
  on public.lead_conversation_analysis using gin (vehiculos_consultados);
create index if not exists lead_conversation_analysis_abiertas_idx
  on public.lead_conversation_analysis (analizado_hasta)
  where cerrada = false;
create index if not exists leads_contact_id_idx
  on public.leads (contact_id);

alter table public.lead_conversation_analysis enable row level security;
revoke all on table public.lead_conversation_analysis from anon, authenticated;

create or replace function public.lead_conversation_analysis_keep_max_etapa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.etapa_max < old.etapa_max then
    new.etapa_max := old.etapa_max;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lead_conversation_analysis_keep_max_etapa
  on public.lead_conversation_analysis;

create trigger lead_conversation_analysis_keep_max_etapa
  before update on public.lead_conversation_analysis
  for each row
  execute function public.lead_conversation_analysis_keep_max_etapa();

create table if not exists public.analysis_job_lock (
  id integer primary key,
  locked_until timestamptz not null,
  locked_by uuid not null
);

insert into public.analysis_job_lock (id, locked_until, locked_by)
values (1, '-infinity', '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

alter table public.analysis_job_lock enable row level security;
revoke all on table public.analysis_job_lock from anon, authenticated;

create or replace function public.chat_try_jsonb(raw text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
begin
  if raw is null or left(btrim(raw), 1) <> '{' then
    return null;
  end if;
  return raw::jsonb;
exception when others then
  return null;
end;
$$;

create or replace function public.chat_max_price(raw text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  spoken text;
  token text;
  amount numeric;
  best numeric := null;
begin
  spoken := raw;
  if left(btrim(coalesce(raw, '')), 1) = '{' then
    spoken := coalesce(public.chat_try_jsonb(raw)->>'respuesta_cliente', raw);
  end if;

  if spoken is null then
    return null;
  end if;

  for token in
    select (regexp_matches(spoken, '\$\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+)', 'g'))[1]
  loop
    if token ~ '^[0-9]{1,3}([.,][0-9]{3})+$' then
      amount := replace(replace(token, '.', ''), ',', '')::numeric;
    else
      amount := token::numeric;
    end if;
    if best is null or amount > best then
      best := amount;
    end if;
  end loop;

  return best;
end;
$$;

-- PM2 en cluster puede disparar el cron varias veces.
-- pg_try_advisory_xact_lock cubre esta transacción.
-- El pooler de Supabase no mantiene un advisory lock de sesión entre llamadas,
-- así que el candado que dura el trabajo del modelo es la fila analysis_job_lock.
create or replace function public.fn_claim_analysis_lock(p_owner uuid)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if not pg_try_advisory_xact_lock(84218421) then
    return false;
  end if;

  update public.analysis_job_lock
  set locked_until = now() + interval '30 minutes',
      locked_by = p_owner
  where id = 1
    and (locked_until < now() or locked_by = p_owner);

  return found;
end;
$$;

create or replace function public.fn_release_analysis_lock(p_owner uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.analysis_job_lock
  set locked_until = '-infinity',
      locked_by = '00000000-0000-0000-0000-000000000000'
  where id = 1
    and locked_by = p_owner;
end;
$$;

create or replace function public.fn_list_conversation_batch(p_limit integer)
returns table (session_id text)
language sql
stable
set search_path = public
as $$
  with sessions as (
    select h.session_id, max(h.created_at) as last_at
    from public.n8n_chat_histories h
    where h.session_id ~ '^\d+$'
    group by h.session_id
    having max(h.created_at) <= now() - interval '2 hours'
  )
  select s.session_id
  from sessions s
  left join public.lead_conversation_analysis a on a.session_id = s.session_id
  where coalesce(a.cerrada, false) = false
    and (
      a.session_id is null
      or a.analizado_hasta is null
      or s.last_at > a.analizado_hasta
    )
  order by s.last_at desc
  limit greatest(p_limit, 0);
$$;

create or replace function public.fn_conversation_packet(
  p_session_id text,
  p_dedup_minutes integer
)
returns table (
  session_id text,
  lead_id bigint,
  etapa_sql smallint,
  vehiculos text[],
  precio_max numeric,
  segmentos integer,
  cubierto_hasta timestamptz,
  cerrar boolean,
  resumen_previo text,
  transcript text
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_minutes integer := greatest(coalesce(p_dedup_minutes, 10), 0);
begin
  return query
  with bounds as (
    select
      coalesce(a.analizado_hasta, '-infinity'::timestamptz) as since,
      a.resumen as resumen_previo
    from (select p_session_id as session_id) seed
    left join public.lead_conversation_analysis a on a.session_id = seed.session_id
  ),
  source as (
    select h.id, h.created_at, h.message
    from public.n8n_chat_histories h
    where h.session_id = p_session_id
      and h.session_id ~ '^\d+$'
      and not (
        h.message->>'type' = 'human'
        and coalesce(h.message->>'content', '') like 'RESUMEN PREVIO:%'
      )
  ),
  humans as (
    select
      s.id,
      s.created_at,
      seg.ordinality::integer as ord,
      btrim(seg.segment) as content
    from source s
    cross join lateral regexp_split_to_table(
      replace(coalesce(s.message->>'content', ''), E'\r', ''),
      E'\n'
    ) with ordinality as seg(segment, ordinality)
    where s.message->>'type' = 'human'
      and btrim(seg.segment) <> ''
  ),
  kept_humans as (
    select h.*
    from humans h
    where not exists (
      select 1
      from humans prev
      where prev.content = h.content
        and (prev.created_at, prev.id, prev.ord) < (h.created_at, h.id, h.ord)
        and h.created_at <= prev.created_at + make_interval(mins => v_minutes)
    )
  ),
  ai as (
    select
      s.id,
      s.created_at,
      coalesce(
        nullif(btrim(public.chat_try_jsonb(s.message->>'content')->>'respuesta_cliente'), ''),
        nullif(btrim(s.message->>'content'), '')
      ) as spoken,
      nullif(
        btrim(public.chat_try_jsonb(s.message->>'content') #>> '{meta,vehiculo,inventory_id}'),
        ''
      ) as inventory_id,
      public.chat_max_price(s.message->>'content') as price
    from source s
    where s.message->>'type' = 'ai'
  ),
  facts as (
    select
      (select count(*)::integer from kept_humans) as segmentos,
      (select max(s.created_at) from source s) as cubierto_hasta,
      coalesce(
        (
          select array_agg(distinct a.inventory_id)
          from ai a
          where a.inventory_id is not null
        ),
        '{}'::text[]
      ) as vehiculos,
      (select max(a.price) from ai a) as precio_max,
      exists (select 1 from ai a where a.spoken is not null) as hubo_ai
    from (select 1) one
  ),
  delta_humans as (
    select h.*
    from humans h
    cross join bounds b
    where h.created_at > b.since
  ),
  kept_delta_humans as (
    select h.*
    from delta_humans h
    where not exists (
      select 1
      from delta_humans prev
      where prev.content = h.content
        and (prev.created_at, prev.id, prev.ord) < (h.created_at, h.id, h.ord)
        and h.created_at <= prev.created_at + make_interval(mins => v_minutes)
    )
  ),
  kept_delta_ai as (
    select a.*
    from ai a
    cross join bounds b
    where a.created_at > b.since
      and a.spoken is not null
      and not exists (
        select 1
        from ai prev
        where prev.spoken = a.spoken
          and prev.created_at > b.since
          and (prev.created_at, prev.id) < (a.created_at, a.id)
          and a.created_at <= prev.created_at + make_interval(mins => v_minutes)
      )
  ),
  lines as (
    select created_at, id, ord, '[cliente] ' || content as line
    from kept_delta_humans
    union all
    select created_at, id, 0, '[bot] ' || spoken
    from kept_delta_ai
  ),
  body as (
    select coalesce(string_agg(line, E'\n' order by created_at, id, ord), '') as transcript
    from lines
  )
  select
    p_session_id,
    (
      select l.id
      from public.leads l
      where p_session_id ~ '^\d+$'
        and l.contact_id = p_session_id::bigint
      limit 1
    ),
    greatest(
      0,
      case when f.hubo_ai then 1 else 0 end,
      case when f.segmentos >= 2 then 2 else 0 end,
      case when cardinality(f.vehiculos) > 0 then 3 else 0 end,
      case when f.precio_max is not null then 4 else 0 end
    )::smallint,
    f.vehiculos,
    f.precio_max,
    f.segmentos,
    f.cubierto_hasta,
    coalesce(f.cubierto_hasta <= now() - interval '7 days', false),
    b.resumen_previo,
    case
      when b.since > '-infinity'::timestamptz
        and b.resumen_previo is not null
        and btrim(body.transcript) <> '' then
        'RESUMEN PREVIO:' || E'\n' || b.resumen_previo || E'\n\nMENSAJES NUEVOS:' || E'\n' || body.transcript
      else body.transcript
    end
  from facts f
  cross join bounds b
  cross join body
  where f.cubierto_hasta is not null;
end;
$$;

create or replace function public.fn_save_conversation_analysis(
  p_session_id text,
  p_lead_id bigint,
  p_etapa_max smallint,
  p_vehiculos text[],
  p_precio numeric,
  p_objecion public.objecion_tipo,
  p_objecion_texto text,
  p_objecion_evidencia text,
  p_resumen text,
  p_presupuesto text,
  p_analizado_hasta timestamptz,
  p_cerrada boolean
)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into public.lead_conversation_analysis (
    session_id,
    lead_id,
    etapa_max,
    vehiculos_consultados,
    precio_max_mostrado,
    objecion_principal,
    objecion_texto,
    objecion_evidencia,
    resumen,
    presupuesto_declarado,
    analizado_hasta,
    cerrada,
    cerrada_at
  )
  values (
    p_session_id,
    p_lead_id,
    least(greatest(p_etapa_max, 0), 5),
    coalesce(p_vehiculos, '{}'),
    p_precio,
    p_objecion,
    p_objecion_texto,
    p_objecion_evidencia,
    p_resumen,
    nullif(btrim(coalesce(p_presupuesto, '')), ''),
    p_analizado_hasta,
    p_cerrada,
    case when p_cerrada then now() else null end
  )
  on conflict (session_id) do update set
    lead_id = coalesce(excluded.lead_id, lead_conversation_analysis.lead_id),
    etapa_max = greatest(lead_conversation_analysis.etapa_max, excluded.etapa_max),
    vehiculos_consultados = (
      select coalesce(array_agg(distinct item), '{}')
      from unnest(
        lead_conversation_analysis.vehiculos_consultados || excluded.vehiculos_consultados
      ) as item
      where item is not null and btrim(item) <> ''
    ),
    precio_max_mostrado = case
      when lead_conversation_analysis.precio_max_mostrado is null then excluded.precio_max_mostrado
      when excluded.precio_max_mostrado is null then lead_conversation_analysis.precio_max_mostrado
      else greatest(lead_conversation_analysis.precio_max_mostrado, excluded.precio_max_mostrado)
    end,
    objecion_principal = excluded.objecion_principal,
    objecion_texto = excluded.objecion_texto,
    objecion_evidencia = excluded.objecion_evidencia,
    resumen = excluded.resumen,
    presupuesto_declarado = excluded.presupuesto_declarado,
    analizado_hasta = greatest(
      coalesce(lead_conversation_analysis.analizado_hasta, excluded.analizado_hasta),
      coalesce(excluded.analizado_hasta, lead_conversation_analysis.analizado_hasta)
    ),
    cerrada = lead_conversation_analysis.cerrada or excluded.cerrada,
    cerrada_at = case
      when lead_conversation_analysis.cerrada then lead_conversation_analysis.cerrada_at
      when excluded.cerrada then now()
      else lead_conversation_analysis.cerrada_at
    end;
end;
$$;

create or replace function public.fn_purge_analyzed_chats()
returns integer
language plpgsql
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.n8n_chat_histories
  where created_at < now() - interval '30 days'
    and session_id in (
      select a.session_id from public.lead_conversation_analysis a
    );
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.fn_conversation_sql_self_check()
returns void
language plpgsql
set search_path = public
as $$
declare
  kept integer;
begin
  if public.chat_max_price('precio de $9.800 y otro de $12000') <> 12000 then
    raise exception 'precio con miles no dio 12000';
  end if;
  if public.chat_max_price('{"respuesta_cliente":"precio de $9800"}') <> 9800 then
    raise exception 'precio dentro del JSON no dio 9800';
  end if;
  if public.chat_max_price('tiene 276968 km') is not null then
    raise exception 'el kilometraje se contó como precio';
  end if;

  with segs as (
    select *
    from (
      values
        ('Sí, por favor'::text, timestamptz '2026-01-01 00:00+00', 1::bigint, 1),
        ('Sí, por favor', timestamptz '2026-01-01 00:03+00', 2, 1),
        ('Sí, por favor', timestamptz '2026-01-01 02:00+00', 3, 1),
        ('Mi pregunta', timestamptz '2026-01-01 00:00+00', 4, 1),
        ('Otra consulta', timestamptz '2026-01-01 00:00+00', 4, 2)
    ) as t(content, created_at, id, ord)
  ),
  kept_rows as (
    select s.content, s.id, s.ord
    from segs s
    where not exists (
      select 1
      from segs prev
      where prev.content = s.content
        and (prev.created_at, prev.id, prev.ord) < (s.created_at, s.id, s.ord)
        and s.created_at <= prev.created_at + interval '10 minutes'
    )
  )
  select count(*) into kept from kept_rows;

  if kept <> 4 then
    raise exception 'dedupe de 10 minutos conservó % filas, se esperaban 4', kept;
  end if;
end;
$$;

revoke all on function public.chat_try_jsonb(text) from public, anon, authenticated;
revoke all on function public.chat_max_price(text) from public, anon, authenticated;
revoke all on function public.fn_claim_analysis_lock(uuid) from public, anon, authenticated;
revoke all on function public.fn_release_analysis_lock(uuid) from public, anon, authenticated;
revoke all on function public.fn_list_conversation_batch(integer) from public, anon, authenticated;
revoke all on function public.fn_conversation_packet(text, integer) from public, anon, authenticated;
revoke all on function public.fn_save_conversation_analysis(text, bigint, smallint, text[], numeric, public.objecion_tipo, text, text, text, text, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.fn_purge_analyzed_chats() from public, anon, authenticated;
revoke all on function public.fn_conversation_sql_self_check() from public, anon, authenticated;
revoke all on function public.lead_conversation_analysis_keep_max_etapa() from public, anon, authenticated;
grant execute on function public.lead_conversation_analysis_keep_max_etapa() to service_role;

grant execute on function public.chat_try_jsonb(text) to service_role;
grant execute on function public.chat_max_price(text) to service_role;
grant execute on function public.fn_claim_analysis_lock(uuid) to service_role;
grant execute on function public.fn_release_analysis_lock(uuid) to service_role;
grant execute on function public.fn_list_conversation_batch(integer) to service_role;
grant execute on function public.fn_conversation_packet(text, integer) to service_role;
grant execute on function public.fn_save_conversation_analysis(text, bigint, smallint, text[], numeric, public.objecion_tipo, text, text, text, text, timestamptz, boolean) to service_role;
grant execute on function public.fn_purge_analyzed_chats() to service_role;
grant execute on function public.fn_conversation_sql_self_check() to service_role;
