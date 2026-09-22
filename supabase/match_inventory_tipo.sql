-- La búsqueda por parecido devolvía un SUV (Yuan Pro) cuando el cliente
-- ya había pedido camioneta. filter.tipo limita la carrocería.
-- type_body en inventario: camioneta = doble cabina / cabina doble / cabina simple.
-- suv = jeep / suv (así está cargado el patio).

create or replace function public.match_inventoryoracle(
  query_embedding vector,
  match_count integer default 5,
  filter jsonb default '{}'::jsonb
)
returns table(id uuid, content text, metadata jsonb, similarity double precision)
language sql
stable
as $function$
select
  e.inventory_id as id,
  e.content,
  e.metadata,
  1 - (e.embedding <=> query_embedding) as similarity
from inventoryoracle_embeddings e
join inventoryoracle i on i.id = e.inventory_id
where
  i.status = 'disponible'
  and (
    coalesce(filter->>'marca', '') = ''
    or lower(i.brand) = lower(filter->>'marca')
  )
  and (
    coalesce(filter->>'tipo', '') = ''
    or (
      filter->>'tipo' = 'camioneta'
      and i.type_body in ('doble cabina', 'cabina doble', 'cabina simple')
    )
    or (
      filter->>'tipo' = 'suv'
      and i.type_body in ('jeep', 'suv')
    )
    or (
      filter->>'tipo' = 'sedan'
      and i.type_body = 'sedan'
    )
    or (
      filter->>'tipo' = 'hatchback'
      and i.type_body in ('hatchback', 'hatckback')
    )
  )
order by e.embedding <=> query_embedding
limit match_count;
$function$;
