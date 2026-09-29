# Plan: atar la unidad por `buscarvehiculo`

Cuando este turno pide un carro, la unidad es el `id` de `buscarvehiculo`: embedding OpenAI + `match_inventoryoracle`. No se elige por familia del léxico.

A72198 (Vinicio, Peugeot 3008): el texto fue el `3008n` y las fotos el 2008. El léxico reescribe `3008` → familia `2008` y ató ese UUID. El crédito después soltó o buscó de nuevo.

## Qué se bota

Eso elige mal el id. No se reusa como filtro ni para soltar.

- Fuzzy de modelos: `3008` → `2008`
- Filtrar el patio por esa familia (`namedNow`, `\b3008\b` dentro de `3008n`)
- Tirar el hit del RPC porque la familia no calza
- Soltar el hilo comparando esas familias (`2008` ≠ `3008n`)
- “No tenemos” armado sobre esa familia, ofreciendo el otro Peugeot
- Volver a buscar si el hilo ya tiene UUID y este turno es crédito, precio o fotos de esa (`Pide otras: no`)

## Qué queda

- `buscarvehiculo` para **atar** (igual que n8n: Embeddings OpenAI + `inventoryoracle_embeddings`)
- Seguir en el UUID: crédito, precio, ficha, fotos, `Pide otras: no`
- Marca, caja, color, tipo, `Pide otras: sí`
- Familia **de la fila** (Peugeot 2008 = modelo, no año)
- Listar sin modelo (“qué Kia”, SUV, otra caja)
- `detectNamedModelAsk` sigue existiendo para marca / “pidió un modelo”. Su `family` no pisa el `id` del RPC

## Flujo

1. El hilo ya tiene unidad y este turno no pide otra → no se llama al patio. `decideStayOnShown` / `leftShownCar`: crédito, precio o fotos + `Pide otras: no` no comparan familia del léxico.
2. Este turno pide unidad → se embebe el texto del pedido → RPC → hay hit: ese `id`. Cero hits: no tenemos. No hay segundo intento por familia.
3. `searchByQuery` / `lookupNamedByEmbedding` no filtran por familia del léxico. El primer hit (año del hilo si aplica) es la unidad.

Soltar (otro color, otra marca, catálogo, tope) sigue en `PLAN-SOLTAR-VEHICULO.md`. “No tenemos” de un año que no está sigue en `PLAN-NO-TENEMOS.md`. Esa frase no se arma con una familia fuzzy.
