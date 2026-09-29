# Plan: soltar el vehículo

Implementado. Una sola decisión por turno: `decideStayOnShown`. Si `leftShownCar` suelta, se suelta. `stayOnShown` sale de ahí y no se vuelve a asignar.

¿Se suelta la unidad ya mostrada, o se sigue con ella?

No entra garantía, cuota, cédula ni el texto del horario. Esos temas se contestan después, sobre el carro que esta decisión ya eligió.

## La decisión

`decideStayOnShown` en `interested-car.ts` es la única puerta. `agent.service.ts` la llama una vez. El “sí”, el “ok” y el “gracias” no la saltan: el acuse sigue solo cuando el resumen no trae otro carro. “sí” + Premiere 2020 suelta la D-Max.

## Qué significa `Pide otras`

Un solo significado, en el prompt y en el código.

- `Pide otras: sí` = quiere catálogo (otra, similar, alternativas, cualquier marca). Se suelta y se lista.
- `Pide otras: no` = este turno no pide catálogo.

`Pide otras: no` no significa “quédate”. El precio, el km, la ficha, la ubicación, el horario y la cortesía siguen escribiendo `no`, porque no son catálogo. Esas frases del prompt se quedan.

El prompt del resumen usa `REGLA DE PIDE OTRAS`: la bandera es listado, y la unidad nombrada va en `Vehículo` y en la `SOLICITUD`. El de ventas no busca si el pedido vigente dice que el hilo sigue. Intenciones manda la unidad nombrada a compra, y el otro color a opciones.

Esas dos frases ya no están en el prompt del resumen:

- “Nombró otro modelo. `Pide otras: no`. Suelta la anterior.” Pasa a ser: el campo Vehículo es el que nombró, y `Pide otras: no` porque no es catálogo. El código suelta porque ese vehículo no cabe en la mostrada.
- “Solo sueltas ese vehículo si nombra otro.” Eso obliga al resumen a poner `no` cuando el cliente dice “otra” o “similar”.

`resumenStaysOnShownUnit` sigue siendo “la bandera es no”, y eso solo dice “no hay catálogo”. Seguir o soltar lo decide la función. El test de la bandera ya dice eso.

## Se suelta si cumple una

Se lee la solicitud y el vehículo de este turno, más las banderas de este turno. Basta una.

| Condición | Ejemplo que suelta | Ejemplo que no suelta |
|---|---|---|
| El vehículo de este turno no cabe (otra marca, modelo, año o versión) | “sí” y la solicitud dice Premiere 2020, con una D-Max 2022 mostrada. Santa Fe con `Pide otras: no` y una Sportage mostrada | “sí” y la solicitud dice “sigue con esta”. Peugeot 2008 sobre la unidad 2022 de ese modelo. “2000 de entrada” |
| `Pide otro color: sí`, o el color de este turno no es el de la mostrada | “uno blanco” y la mostrada es roja | Preguntar el color de esta |
| `Caja de compra` distinta de la mostrada | “¿y en manual?” y la mostrada es automática | `Caja de compra: no` porque la caja es del carro que nos vende. La mostrada ya es manual |
| `Cabina` distinta de la mostrada | “cabina simple” y la mostrada es doble | La mostrada ya es cabina simple |
| Pidió la otra tracción | “cabina simple pero 4x4” y la mostrada es 4x2 | “¿No era 4x4?” con duda pendiente: pregunta por esta |
| `Tipo de patio` distinto del de la mostrada | Pide SUV y la mostrada es camioneta | `Tipo de patio: no`, o el mismo tipo |
| Este turno pide ver qué cabe en un tope y el monto es menor que el precio | “qué hay por 10.000” y la mostrada vale 22.900 | Tope 10.000 copiado mientras pide el precio, el km, la ubicación o negociar esta |
| Pide furgoneta, van, o más plazas de las que esta tiene | Furgoneta con un hatch mostrado | “¿esta tiene 7 asientos?”: primero se valida esta |
| `Pide otras: sí` | “otra”, “similar”, acepta las alternativas que el bot ofreció | Rechazar el crédito o la visita |

Una palabra del texto que el resumen no aceptó no suelta. “Quiero un Aveo” con solicitud “visitar la próxima semana esta unidad” sigue en la mostrada: el resumen no vio el Aveo. Si la solicitud sí dice Aveo o Santa Fe, suelta, aunque `Pide otras` sea no.

Elegir una de la lista recién mostrada no suelta esa elección a otro catálogo. Sigue solo si año, color, caja, cabina y tracción calzan con la unidad señalada. Si señala otra (otra cabina, otro año), se suelta y se busca esa.

## Qué sigue

Ninguna fila de arriba, y hay unidad mostrada.

Precio, km, ficha, fotos, crédito de esta, negociar, ubicación, duda, visita, horario, cortesía, “ok”. También la simulación de la misma unidad y repetir la misma ficha (marca, versión y año).

Si el turno es solo horario, no se busca otro carro. Si la misma solicitud nombra otra unidad, esa unidad gana y el horario se contesta de la nueva. El horario no apaga el cambio de carro, y el cambio de carro no apaga el horario.

## Tope

`resumenPidePresupuesto` ya no devuelve falso solo porque `Pide otras` es no.

Suelta cuando la solicitud de este turno pide ver qué cabe y el monto es menor que el precio de la mostrada.

No suelta cuando el monto viene arrastrado y la solicitud es el precio, el km, la ubicación, negociar o “sigue con esta”. Esos casos ya están en `interested-car.spec.ts` y tienen que seguir igual.

## Cómo quedó cada pieza

`leftShownCar` lee la solicitud de este turno al final, después de la línea Vehículo. El modelo que el cliente pidió ahora gana sobre el carro del resumen previo. Si la solicitud dice Rio y Vehículo sigue siendo la Sportage, se suelta.

Si el turno es precio, ubicación, duda o ficha, no es un listado y no pide otras, el carro de la decisión es la última ficha mostrada en el hilo. Una fila vieja de `interested_cars` no pisa la unidad que acaba de elegir.

`textoQueNombra` no decide solo. Ignora una marca que el resumen no vio. Si el resumen la vio, suelta.

`resumenSigueEnUnidadMostrada` ya no es candado. Precio, km o visita dicen el tema de la respuesta cuando ya se decidió seguir.

`turn-plan` llama `leftShownCar`. Si suelta, el plan es OTRAS.

El pedido vigente lleva la orden que ya ganó:

- Seguir: no llames `buscarvehiuclo`. Contesta sobre esta unidad.
- Soltó porque nombró otra: busca esa.
- Soltó por catálogo, color, caja, cabina, tracción, tipo, tope o plazas: lista solo lo que cumple.

La ficha de interés ya no dice “si pidió otro modelo, busca en inventario”. Esa decisión se tomó antes de armar el prompt.

## Qué tiene que seguir igual

Sigue: km, precio de esta, ubicación del T1, simulación del Explorer, “¿No era 4x4?”, Peugeot 2008, repetir la ficha AMG, 2000 de entrada, tope viejo junto a precio, km, ubicación, negociar u “ok”.

Suelta: Hilux sobre Sportage, Santa Fe con `Pide otras: no`, Sonet sobre Picanto, “sí” + Premiere 2020 sobre D-Max 2022, Sportage 2014, manual sobre automática, cabina simple sobre Hilux doble, 4x4 sobre 4x2, otro color, “qué hay por 10.000” sobre un carro de 22.900, furgoneta sobre un carro chico, plateado automático sobre una GTI roja manual.

Cambia de significado un solo test: “`Pide otras: no` significa que sigue en la mostrada”. Pasa a “`Pide otras: no` significa que no hay catálogo”. Seguir se prueba con la función, no con la bandera sola.
