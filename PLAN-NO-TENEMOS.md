# Plan: decir “no tenemos”

Implementado. Un número que es el modelo (Peugeot 2008, ficha año 2022) no entra como año: el calce es exacto y no se abre con “no tenemos”. Si el año pedido es otro y no está (4Runner 2010 y en patio solo hay 2004), primero se dice que no está y después se ofrece el del mismo tipo.

Solo esta frase: cuándo el bot dice que no tiene el vehículo.

Soltar el carro es otra decisión. Está en `PLAN-SOLTAR-VEHICULO.md`. Esta frase depende de aquella: “no tenemos” solo puede salir después de buscar. Si el turno sigue en el carro guardado, esta frase no se arma.

## Antes qué hacía

Al empezar el turno ya se lee el último `interested_cars` de ese lead. Ahí está el carro: marca, modelo, año, precio, `inventory_id`.

Eso no decide la frase. Después el resumen y `stayOnShown` dicen si se sigue con ese carro o se suelta y se busca otra vez.

Si se sigue, la revisión dice: no busques, no digas “no está” ni “lo más cercano”. Se contesta el precio, el km o la ficha de ese `inventory_id`.

Si se suelta, se deja ese registro y se filtra de nuevo el nombre. Un Peugeot 2008 se lee mal: 2008 entra como año. En patio el año es 2022 y el modelo es `2008 fin`. El calce exacto falla.

Ahí corre `formatMissingNamedModel`. Aunque el único carro que va a mandar sea el que ya se conocía, el texto que arma es este:

1. Primero: “No hay X en patio. Dilo claro: no tenemos X.”
2. Después: “lo más cercano, y hay que mandarlo”, con el `inventory_id` de ese mismo carro.

El agente identifica el carro y, en el mismo turno, dice que no lo tiene. El embedding no es este camino. Tampoco un `SELECT` del texto “2008 peugeot”. El fallo es el filtro de año sobre un número que es el modelo, y el encabezado que obliga a negar la unidad antes de mandarla.

“No tenemos” también sale cuando el pedido sí es otro y no está (un 4Runner 2010 y en patio solo hay 2004). Eso sí es cierto. El error es decirlo del carro que ya estaba guardado.

## Cómo queda con soltar

Primero se decide si se suelta, como en el otro plan. Esta frase no vota esa decisión.

| El turno | Soltar | “No tenemos” |
|---|---|---|
| Precio, km o ficha del carro de `interested_cars` | No. Se presenta ese `inventory_id` | No se dice |
| El resumen nombra otro carro y ese está en patio | Sí. Se busca esa unidad | No se dice. Se presenta |
| El resumen nombra otro carro y ese no está | Sí. Se busca | Sí. Primero se dice que no está ese, después se ofrece otro del mismo tipo si hay |
| El número es el modelo de la ficha (Peugeot 2008, año 2022) | No, si es el carro guardado | No se dice. 2008 no se usa como año |

## Solución

“No tenemos” solo se dice si el carro pedido no es el guardado y tampoco está en patio.

Si el resumen pide el precio, el kilometraje o la ficha del carro de `interested_cars`, no se vuelve a filtrar y no se llama a `formatMissingNamedModel`. Se responde con ese `inventory_id`.

Si el único carro que esa función iba a mandar es ese mismo, el texto deja de abrir con “no tenemos”. Se presenta la unidad. Un número que es el modelo de la ficha no entra como año: el calce es exacto y no se arma ese encabezado.

La frase se queda solo para el pedido que de verdad no está: primero se dice que no hay ese, y después se ofrece otro del mismo tipo si hay uno.
