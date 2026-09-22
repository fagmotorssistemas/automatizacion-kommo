-- Cédula del cliente. Solo se escribe cuando el mensaje trae 10 dígitos válidos.
-- Eso dispara leads.status = asesoria_financiamiento; pedir cuota no.
alter table public.leads
  add column if not exists cedula text;
