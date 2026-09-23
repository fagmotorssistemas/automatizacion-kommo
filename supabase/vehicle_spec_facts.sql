-- Fichas técnicas ya investigadas, para no volver a llamar al modelo.
create table if not exists public.vehicle_spec_facts (
  model_key text not null,
  year integer not null default 0,
  topic text not null,
  seguro boolean not null,
  dato text not null,
  checked_at timestamptz not null default now(),
  primary key (model_key, year, topic)
);
