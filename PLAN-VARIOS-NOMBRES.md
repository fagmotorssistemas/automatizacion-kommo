# Varios nombres en un pedido

Implementado. «Jetour o DFSK» no se niega entero. Cada nombre se busca en patio por marca y, si no hay filas, por modelo. El que tiene filas se lista. El que no tiene, «no tenemos» es solo de ese nombre.

Soltar, el filtro de patio, el precio y un solo modelo quedan como estaban.

## Qué pasaba

El pedido «Jetour y DFSK» entraba al `if (phrase)` de `reviewBrand`. Esa salida decía «ese modelo no está en patio» con el texto completo. El Jetour, que sí está, se negaba junto con el DFSK.

## Cómo queda

Esa salida sigue para un solo modelo (X70, un 4Runner 2010, un Peugeot 2008).

Si `nombresSeparados` saca dos o más nombres, no corre. Cada uno:

1. `listByBrand`. Si hay filas, esas.
2. Si no hay, el mismo nombre contra el modelo en las filas de patio.

Jetour se lista y se pregunta cuál. DFSK, sin filas por marca ni por modelo, se dice que no. Las dos van en la misma revisión.

Un rango de años («2021 o 2022»), la caja y la tracción no se parten. Siguen por sus funciones.
