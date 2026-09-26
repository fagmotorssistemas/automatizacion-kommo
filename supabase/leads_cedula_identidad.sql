-- Nombre y origen leídos de la foto de la cédula. El número sigue en leads.cedula.
alter table public.leads
  add column if not exists nombre_cedula text,
  add column if not exists origen text;
