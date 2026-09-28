-- Postulaciones al anuncio de asesor comercial.
-- No es un lead de venta: no entra a public.leads ni a retomas.

create table if not exists public.ofertas_laborales (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  lead_id_kommo text not null,
  phone text,
  etiqueta text not null,
  assigned_to text not null
);

create unique index if not exists ofertas_laborales_lead_uidx
  on public.ofertas_laborales (lead_id_kommo);

comment on table public.ofertas_laborales is
  'Quien escribe por la vacante de asesor comercial. Una fila por lead de Kommo. No sigue el flujo de ventas.';

alter table public.ofertas_laborales enable row level security;
revoke all on table public.ofertas_laborales from anon, authenticated;
grant all on table public.ofertas_laborales to service_role;
grant usage, select on sequence public.ofertas_laborales_id_seq to service_role;
