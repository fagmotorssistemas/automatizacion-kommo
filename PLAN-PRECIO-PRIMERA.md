# Plan: el precio solo se quita en la primera ficha

Implementado. El precio de patio entra en la primera llamada, como dato interno, para que el modelo copie ese número y no invente otro. Al cliente, en esa primera ficha, no se le dice. Del segundo mensaje en adelante el mensaje sale con sus montos.

## Qué chocaba

El prompt de ventas y el aviso de primera presentación dicen que no se suelte el `$` si el cliente no lo pidió.

Esa llamada no traía el precio: `includePrice` era “pidió el precio”, y la ficha del hilo tampoco lo ponía. Sin el número de patio, el modelo escribía uno.

Después `stripUnsolicitedPriceAndPlate` corría con `keepPrice` en falso en varios turnos y borraba cualquier `$`. `dropRepeatedListedPrice` borraba, en un turno de crédito, la oración que traía el precio de contado ya dicho. Ahí se iban la entrada, la cuota y “financiamiento”.

## Cómo queda

1. La unidad que se va a mandar trae `precio_interno` de patio en la ficha, sin el signo `$`, y la nota dice que no se escriba en la respuesta. Si el cliente pidió el precio, la ficha trae `precio=$` y dice que use ese número. En el hilo que ya tiene carro, ese dato ya está en `precio_interno` de `interested_cars`. La herramienta de esa unidad también devuelve el precio de patio.
2. Al cliente se le quita el precio solo en la primera ficha: todavía no hay un mensaje del bot con esa unidad, hay `inventory_id` en la respuesta y este turno no pidió el precio. Se quita solo el monto de contado de esa unidad. Entrada, cuota y financiamiento se quedan.
3. Si el mensaje trae entrada, cuota o financiamiento, sale entero. El agente de ventas ya lo escribió. Si falta el precio de contado de patio, se agrega “El precio es $X.” delante. No se le borran los montos ni las palabras.
4. Del segundo mensaje en adelante, con la unidad ya mostrada, no hay strip de montos.
5. `dropRepeatedListedPrice` se borró. No queda una función que recorte el precio en un turno de crédito.

Listas de varias unidades siguen sin precio si el cliente no lo pidió. El dato interno es de la unidad que se manda, no de un listado.
