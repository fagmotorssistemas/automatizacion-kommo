-- Histórico de n8n: los "human" que empiezan con RESUMEN PREVIO: los escribió el bot.
-- Nest ya escribe esta tabla con human=cliente y ai=respuesta. Este filtro es para lo viejo.
create or replace view public.n8n_chat_histories_cliente as
select *
from public.n8n_chat_histories
where message->>'type' = 'human'
  and message->>'content' not like 'RESUMEN PREVIO:%';
