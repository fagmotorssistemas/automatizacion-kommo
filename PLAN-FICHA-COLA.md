# Ficha en la cola de unidades nuevas

Implementado. Al presentar varias unidades nuevas, cada mensaje de WhatsApp es la ficha y después las fotos. La etiqueta corta queda para cuando ya vio esa ficha y pide las fotos.

El listado de recomendaciones sigue. Un «sí» a buscar otra caja puede decir que no hay esa manual y mandar otras unidades.

## Qué pasaba

`formatOtrasOptionsMessage` armaba las fichas y se escribía en «Respuesta IA». La cola pisaba ese campo con `shortUnitLabel` (`Creta 2022 blanco`) y disparaba el SalesBot. Si la unidad no tenía bot, el aviso fijo quedaba debajo del nombre. El Creta salía solo en fotos. El Sportage quedaba en el nombre más «Por ahora no tengo fotos».

## Cómo queda

Dos sitios pasan `toPhotoQueue(cars, 'ficha')`: el bloque de «pidió otras» y `reviewAnyKindPatio`. La etiqueta es `formatCustomerUnitSentence`: marca, modelo, año, color, caja y km si está cargado. En camioneta, esa frase ya trae puertas, tracción y cabina. El precio no entra.

El texto «Estas son otras opciones…» se sigue guardando en el hilo y en `reply.mensaje`. A WhatsApp no se escribe. `lastListedUnits` lo usa en el turno siguiente.

Cada paquete: la ficha y, si hay bot, las fotos. Si no hay bot, `appendNoPhotosNotice` queda debajo de la ficha.

## Qué no cambia

`shortUnitLabel` y `formatListedPhotoQueue`. Pedir las fotos de un listado ya visto sigue con «Le mando las fotos de cada una, una por una.» y la etiqueta corta. Un «sí» suelto no dispara esa cola.

Qué unidades entran, el tope de 6, saltarse el modelo cuando hay más de una, una sola unidad, patio, precio y la unidad guardada (la última de la cola) quedan como estaban.
