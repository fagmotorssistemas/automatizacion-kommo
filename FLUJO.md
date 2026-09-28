# Flujo completo del bot

Esto es lo que hace el servicio, en el orden en que ocurre. Un mensaje de WhatsApp entra por Kommo, espera 30 segundos, el agente arma la respuesta, se manda por WhatsApp y después se guardan las señales. En paralelo hay tres relojes que escriben solos cuando el cliente ya no responde.

---

## Arranque

Al prender el proceso, Nest escucha el puerto (por defecto 3000). Quedan vivos tres relojes:

1. **Seguimiento** cada 1 minuto. Manda las retomas de 8 horas hábiles, 2 días y 7 días.
2. **Post-fotos** cada 1 minuto. Manda los mensajes de después de las fotos (40 min, 3 h, 6 h, ajustados a horario laboral).
3. **Análisis** cada 4 horas. Lee chats en reposo, guarda etapa, objeción y resumen, y con eso programa el seguimiento.

`GET /health` solo dice si el proceso está vivo. No entra en la conversación.

---

## 1. Llega el mensaje

WhatsApp llega a Kommo. Kommo hace `POST /webhooks/kommo` con el cuerpo en form-urlencoded (`message[add][0][…]`) o anidado.

El controlador responde **200 enseguida**. Kommo no espera los 30 segundos. Si no devolvemos 200, Kommo reintenta.

El parser saca el primer `message[add]`. Si no hay mensaje, se anota `not_a_message_event` y se corta.

Zod valida id, lead, contacto, texto, origen, tipo, autor y adjunto. Si no pasa, se anota `invalid_message` y se corta.

El contacto es `contactId`. Si viene vacío, se usa el `leadId`.

---

## 2. Filtros, antes de hacer nada

1. **Lead excluido.** Si el lead está en la lista de exclusión, se corta (`excluded_lead`).
2. **Quién escribió.** Solo siguen dos casos: el cliente (`incoming` + autor externo) o una nota del asesor (`outgoing`). Cualquier otra cosa se corta (`ignored_not_inbound`).
3. **Duplicado.** Redis pone la llave `inbox:msg:{contacto}:{mensaje}` con `NX` y vida de 5 horas. Si ya existía, es el mismo webhook repetido y se corta (`duplicate`). Si Redis no responde, se corta (`inbox_unavailable`).

---

## 3. Vacante

Antes del bot de ventas se mira si esto es una postulación a la vacante de asesor comercial.

- Si ese lead **ya está** en `ofertas_laborales`, se calla (`silent`). No entra al bot.
- Si el texto **no** es la plantilla de la vacante, sigue el flujo normal (`pass`).
- Si la base no responde y el texto sí parece vacante, se retiene (`held`) para no tratarlo como venta.
- Si es la primera vez y el texto sí es la vacante:
  1. Se guarda en `ofertas_laborales` con teléfono, etiqueta y asignado a FAG Motors.
  2. Se manda **una sola** respuesta, el texto del prompt `vacante` en `agent_prompts` (campo Respuesta IA + salesbot de texto).
  3. En Kommo se etiqueta el lead y se reasigna al usuario que se llama FAG Motors.
  4. Ahí termina. No hay debounce ni agente de ventas.

---

## 4. WhatsApp o otro canal

`origin === waba` es WhatsApp. Cualquier otro origen (Instagram, etc.) es **otro canal**.

Si es WhatsApp, se lee el lead en Kommo:

- El checkbox **atiende IA?** (campo **2991942**) en true significa que un humano atiende. El bot se apaga.
- Se guarda quién está asignado en Kommo (`assignedTo`).
- Se pide el teléfono del contacto.

---

## 5. Bot apagado (humano atendiendo)

Si el checkbox está marcado, **no se encola** el mensaje.

- Se convierte el mensaje a texto (igual que un mensaje normal: voz o foto si aplica, pero solo si escribió el cliente).
- Se guarda el turno en el lead: rol cliente o asesor, texto, y se marca `bot_apagado`.
- Motivo: `bot_stopped` si escribió el cliente, `handoff_note` si escribió el asesor.
- Cuando después destildan el checkbox y el cliente vuelve a escribir, esos turnos se sueltan (`consumeHandoffTurns`) y el agente los resume como “contexto del asesor” para no arrancar en blanco.

Si el bot **no** está apagado y el mensaje no es del cliente (es nota del asesor), se ignora.

Si el bot está encendido y el origen es WhatsApp, se consumen los turnos del handoff (si había) y se sigue.

---

## 6. El mensaje se vuelve texto

Se clasifica el tipo:

| Tipo | Qué se hace |
|------|-------------|
| Texto | Se usa tal cual. |
| Voz | Se baja el archivo y Whisper lo transcribe. Si falla, queda el texto que ya traía. |
| Foto | Se baja el archivo. Otra llamada dice si es **cédula** o **vehículo**. |
| Cédula | Se lee número, nombre y origen. Si no se lee, queda un texto fijo de “no se pudo leer”. |
| Vehículo | Visión describe la foto para que el agente sepa qué mandó el cliente. |

Ese texto es el que entra al buffer.

---

## 7. Espera de 30 segundos

Se empuja el mensaje a la lista Redis `inbox:buf:{contacto}` (vida 120 s).

Se agenda un job BullMQ `inbox-flush:{contacto}:{mensaje}` con **30 s** de delay y **1 intento**.

A la vez se pone un timer en el mismo proceso. Redis Cloud a veces se come las llaves de los jobs demorados; el timer local sí corre. El flush decide el ganador para no mandar dos veces.

Si llegan “hola” y “hilux” del **mismo** contacto en esos 30 s, se juntan. Otro contacto no se mezcla: todo va por `contactId`.

---

## 8. El flush elige al ganador

Cuando corre el job (BullMQ o el timer local):

1. Reclama `inbox:flush:{contacto}:{mensaje}` con `NX` (5 min). Si otro flush ya lo tomó, este pierde y se va.
2. Lee la lista del contacto.
3. Gana el **último messageId** de esa lista, no el último texto suelto. Junta todos los textos, borra la lista y sigue con ese párrafo.
4. Si Redis ya vació la lista pero este job trae texto de respaldo, igual gana con ese texto.
5. Si no es el último mensaje, pierde y **no borra** la lista. El último job es el que junta todo.

Se anota `ganador` o `lost`.

---

## 9. Si no es WhatsApp

El ganador de otro canal **no** llama al agente de ventas.

1. Busca un celular ecuatoriano en el texto.
2. Si no hay número, manda un texto pidiendo el WhatsApp (mismo camino: campo Respuesta IA + salesbot de texto **157134**).
3. Si hay número y ya existe un contacto con ese teléfono, busca el lead y dispara el salesbot de alta **187553** sobre ese lead.
4. Si no existe, crea contacto, crea lead en el pipeline de nuevos, copia el responsable si lo había, y dispara el mismo salesbot de alta.

Ahí se acaba ese mensaje. No hay resumen, ni inventario, ni señales.

---

## 10. Lead y anuncio (solo WhatsApp)

`syncInboundLead`:

1. Busca el lead en Supabase por `contact_id`.
2. Si existe y Kommo trae asignado y el lead no lo tenía, se lo pone.
3. Si no existe, lo crea (nombre, teléfono, origen, lead de Kommo, asignado).
4. Con un teléfono usable llama al RPC `fn_match_lead_to_ctwa_click` (clic de anuncio de Facebook).

El texto del cliente se arma así:

- Si no hay match de anuncio, o el clic y el mensaje están a más de **60 segundos**, el texto es solo lo que juntó el debounce.
- El título del anuncio se pega **solo** en el primer mensaje, **solo** si es la plantilla de Facebook (“más información sobre esto”), el título parece un vehículo, no es un botón genérico y no trae dos años. Entonces “esto” pasa a “esto {vehículo}”.
- Si el cliente ya nombró el carro, o ya había conversación, el texto se queda como llegó.

Si después de eso no queda texto, se corta (`sin_texto`).

---

## 11. Candado de un turno a la vez

1. Si ya se marcó `inbox:out:{contacto}:{mensaje}`, este par ya se envió. Se corta (`ya_enviado`).
2. Toma el candado `inbox:turn:{contacto}` (3 minutos, `NX`).
3. Si otro turno de ese contacto lo tiene, reencola a los **12 s**, hasta **2** reintentos. El texto juntado viaja en el job para no perderlo. Si se agotan los reintentos, se anota `turno_ocupado_agotado` y no se manda.
4. Con el candado tomado corre el agente. Al terminar, suelta el candado **aunque** el agente falle.
5. El agente tiene tope de **45 s**. Si se pasa, se anota timeout y no se manda nada.
6. La inteligencia corre **después** de soltar el candado, con tope de **15 s**, para no trabar el siguiente mensaje.

---

## 12. El agente, en orden

`handleTurn` recibe solo ese contacto y el texto ya juntado. No guarda “el cliente actual” en la instancia.

### 12.1 Corta si no es texto de cliente

Si el texto no es un mensaje real del cliente, devuelve vacío y no hay respuesta.

### 12.2 Léxico y anuncio de Facebook

Carga el léxico de marcas y modelos del catálogo.

Si el texto es el clic “más información” **y** el título nombra un carro, ese carro queda como anuncio y más adelante se presenta esa unidad.

Si es el clic **y no** se reconoce el carro, responde de una: pregunta cuál carro le interesa. No llama al modelo de ventas. Guarda el turno en Redis y en `n8n_chat_histories`. Fin de este turno.

### 12.3 Memoria de este contacto

Lee, solo de este `contactId`:

- Historial reciente (Redis; si está vacío, el chat durable de Supabase).
- Cuándo se vio por última vez (para saludar o no).
- Último carro de interés (`interested_cars`).
- Brief del asesor, si el bot estuvo apagado (lo resume una vez y lo mete al historial como “CONTEXTO ASESOR”).
- Checklist de toma (si el cliente quiere vender su carro).
- Presupuesto de contado recordado.
- Resumen anterior.

### 12.4 Primera llamada a OpenAI: el resumen

Arma el input con historial, texto de ahora, brief, toma, presupuesto y resumen previo.

El modelo de resumen dice **qué quiere ahora** (precio, crédito, color, toma, horario, despedida, etc.). Si el modelo no responde, se usa el texto crudo del cliente.

De ese resumen se saca el “pedido vigente” (el vehículo que sigue). Si en este mensaje nombró otra marca, ese pedido se anula.

El resumen se mezcla con el anterior y se guarda para el próximo turno.

Si el resumen dice que **falta el vehículo** y no hay anuncio, ni pedido, ni marca, ni tipo, ni “cualquier marca”, responde de una preguntando cuál carro (y si pidió precio, la pregunta lo menciona). No llama al agente de ventas.

### 12.5 Se guarda lo que dijo el cliente

El texto entra al historial Redis como mensaje del usuario. A partir de aquí el turno ya quedó anotado aunque después falle el modelo de ventas.

Se recuerdan y se guardan, si aplican:

- Tipo de vehículo (camioneta, suv, sedan, hatchback), también el que diga el resumen.
- Tope de contado. Si hay uno nuevo, reemplaza el recordado.
- Si es toma (quiere vender su carro): checklist de marca, modelo, año, etc.
- Marca.
- Pedido concreto (“la Hilux 2022 blanca”).
- Caja (manual / automática). Si dijo que la caja no le importa, se limpia del pedido.

### 12.6 Banderas de este turno

Del resumen y del texto se marcan, entre otras:

- Pidió precio de lista. Se apaga si está negociando, si es un “sí” pelado en el primer toque, o si ya le dijeron el precio y ahora confirma contado o entrega inmediata.
- Acepta ver si aplica a crédito (ya hubo pregunta de “¿vemos si aplica?” o ya se mostró cuota).
- Pidió crédito. Se apaga si acaba de dar tope, acepta aplicar, rechaza aplicar o prefiere contado.
- Pidió otro color.
- Despedida, sin duda pendiente.
- Cortesía / agradecimiento (pista de seguimiento de ventas, no cierra sola).
- Espacio para muchos pasajeros.
- Pidió horario del local.
- Tres filas / cantidad de asientos.
- Objeción de precio.
- Ubicación.
- Duda pendiente.

### 12.7 ¿Seguimos con el carro ya mostrado?

Si pide precio, ubicación o tiene una duda, y el último mensaje del bot no fue una lista, se intenta quedar en la última unidad que se ofreció (se rellena `interested` desde el patio).

`stayOnShown` queda en verdadero cuando el hilo sigue esa unidad (un “ok”, “esa”, el resumen dice que sigue ahí, el año y el color calzan con la lista). Queda en falso si aceptó “otras opciones”, pidió cualquier marca, o pidió otra caja.

Si pide asientos y no es tres filas, se revisa si la unidad mostrada cumple. Eso puede cambiar la unidad o frenar el envío.

### 12.8 Segunda llamada a OpenAI: intenciones

Con el catálogo de nombres de `agent_prompts`, el modelo de intenciones dice **qué secciones** cargar (objeciones, financiamiento, manejo del carro, etc.).

De ahí sale si este turno es **venta de su carro** (toma), **compra**, o las dos.

### 12.9 Revisión de patio (sin el modelo de ventas todavía)

Según el caso, `revision` es un bloque de instrucciones que el vendedor tiene que obedecer:

| Caso | Qué hace |
|------|----------|
| Pidió horario | Texto con el horario del local. No manda carro. |
| Pidió asientos | El resultado de la revisión de asientos. |
| Solo quiere vender su carro | No busca unidad para venderle. |
| El hilo sigue la unidad ya mostrada | Ordena contestar sobre **esa** unidad, con su `inventory_id`. Prohíbe reabrir inventario y, si la ficha ya se dio, prohíbe repetirla. |
| Cualquier otro caso | `reviewBrand`: busca en el patio por marca, modelo, año, color, caja, tipo, presupuesto, tres filas, otro color, anuncio. Devuelve el texto de lo que hay (una unidad, una lista, “no está”, lo más cercano), el `inventory_id` a mandar, o una cola de fotos si hay que mandar varias. |

Si eligió una de las que ya se habían listado, se guarda ese carro como el elegido.

Si es despedida, la revisión pasa a una despedida amable y no busca otro carro.

Si sigue en la unidad mostrada y pregunta un dato técnico (km, ficha), se agregan las notas de esa unidad.

Si hay objeción sobre la unidad ya vista, se fuerzan las secciones `objeciones` y `manejocaro`. Si pide el precio después de la ficha, se fuerza `manejocaro`.

Se cargan de Supabase los textos de `agent_prompts` que tocaron las intenciones.

### 12.10 Pistas que se le pegan al vendedor

Se arma un bloque (`pedidoVigente`) con las reglas de **este** turno. El modelo de ventas las ve junto con el resumen. Entran solo las que aplican:

- Saludo, si corresponde a la hora de Guayaquil y hace rato que no hablan.
- Anuncio de Facebook: presenta **esa** unidad, sin preguntar “qué carro” y sin listar otras marcas.
- Tipo, marca y caja que hay que respetar.
- Cambio de modelo: prohibido volver al carro anterior.
- Texto de la revisión de patio.
- Ficha del carro de interés, completa o recortada si ya se dio.
- Crédito: precio de contado + entrada y plazo, o solo preguntar entrada y plazo, o preguntar qué vehículo si no hay unidad. Si la cuota ya se dijo, no repetirla.
- Objeción o negociación: no hay descuento por chat; si negocia, el sistema después pega que lo hable en persona.
- Ubicación: Av. España 6-73 y Sevilla, Cuenca, solo la dirección.
- Contado o entrega inmediata, si ya le dijeron el precio.
- Precio: se dice solo si ya toca (ya se mostró y lo pidió, o lo pidió en este mismo mensaje con unidad confirmada). En la primera ficha, si no lo pidió, no se dice. Si el precio en patio está en 0, se dice que aún no está cargado. Prohibido inventar un número.
- Otro color: otras unidades del mismo modelo, sin repetir la ya mostrada.
- Cédula: si ya la mandó, no pedirla otra vez.
- Toma: los datos que faltan del carro que quiere vender.
- Espacio / muchos pasajeros.
- Aviso de que un monto no es una visita.

Si en este mensaje hay número de cédula (o la foto ya se leyó como cédula), se guarda en el lead.

### 12.11 Atajo de varias fotos

Si la revisión trae **más de una** unidad en cola de fotos y el historial ya listó unidades, no se llama al modelo de ventas. La respuesta fija es “Le mando las fotos de cada una, una por una.” Se guarda el turno y se devuelve la cola. El envío manda un paquete por unidad.

### 12.12 Tercera llamada a OpenAI: el vendedor

System prompt de ventas + reloj del concesionario + secciones de `agent_prompts` + el bloque de pistas.

El usuario del modelo es el resumen más esas pistas. El historial va aparte.

Puede llamar herramientas:

- `buscarvehiuclo` (el nombre va con la errata a propósito): embedding del query, filtro por tipo y marca, busca en el inventario vectorial. El precio entra en el resultado solo si este turno ya puede decirlo.
- `calcular_financiamiento`: cuota CrediFAG (directo, 36 meses).
- `calcular_financiamiento_bancario`: cuota de banco o cooperativa cuando la entrada es menor al 60 %.

Si el modelo no devuelve texto, el turno falla y no se manda nada.

### 12.13 Se limpia la respuesta

`parseAgentOutput` saca el mensaje y la meta (precio mostrado, cuota mostrada, vehículo, `img_prefix`).

Después el código corrige lo que el modelo no debe decidir solo:

- Si la revisión ya eligió un `inventory_id`, ese id se impone. Se borra el `img_prefix`.
- Si cambió de modelo y el modelo repitió el id viejo, se lo quita.
- Si no hay que mandar carro (hold, o habló de plata y no de crédito), se quita el vehículo.
- Un id que no es UUID se descarta (el modelo a veces inventa ids).
- El precio de la meta es el del inventario, o se borra.
- Se quitan precio y placa si no tocaba decirlos. La placa corta se queda en la primera presentación o si la preguntó.
- Se quita el “cuidado del km” si ya se dijo.
- Se quita el “podemos gestionar”.
- Si mostró cuota, se quita una pregunta de cédula adelantada.
- Si toca, el sistema **pega** una frase fija, sin pedirle al modelo que la redacte:
  - “¿Quiere que veamos si aplica?”
  - Pedido de cédula, nombre y de dónde es.
  - Mensaje para que no se vaya si rechazó ver si aplica.
  - Pregunta de crédito o contado después de listar por presupuesto.
  - “Cuál de las que ya vio” si prefiere contado.
  - Que la negociación es en persona con un asesor.
- Se confirma contado o entrega inmediata si ese era el pedido.
- Si pidió precio y hay monto, se asegura que el `$` esté en el texto.
- Si pidió precio y el valor no está cargado, se agrega esa frase.
- Si ya hay cédula y el modelo la volvió a pedir, se reemplaza por la confirmación de que un asesor revisa si califica.
- Se quita un feriado inventado.

### 12.14 Se guarda el turno del agente

El mensaje limpio entra al historial Redis (assistant) y a `n8n_chat_histories` (humano = cliente, ai = la respuesta serializada). Se actualiza “última vez visto”.

Devuelve: respuesta, resumen, si la ficha de esta unidad ya se había dado, y la cola de fotos si la hubo.

---

## 13. Envío a WhatsApp

Se mira si este `inventory_id` ya se mostró (último carro de interés, o el hilo, o `hasShownCar`).

Quiere fotos si hay cola, o si hay id y el cliente o el resumen pidieron fotos.

Si hay cola, el vehículo de la meta pasa a ser el último de la cola.

`dispatch`:

1. **Cola de varias unidades.** Por cada una: texto de esa unidad, pausa, salesbots de fotos de esa unidad. Entre paquetes hay una pausa. Si el id es UUID y no hay `bot_id` en `vehicle_salesbots`, el texto avisa que no hay fotos.
2. **Una unidad.** Se resuelven los bots de foto por `inventory_id`. Si tocaba foto, el id es UUID y no hay bot, se agrega el aviso de sin fotos. Si no toca foto, se borra del texto cualquier frase que diga que va a mandar fotos.
3. **Modo shadow.** No se escribe en Kommo. Solo se loguea el texto. No se marca como enviado, así un reintento real todavía puede salir.
4. **Envío real.** PATCH del campo **Respuesta IA (2991944)** con el texto. Después corre el salesbot de texto **157134**, que es el que suelta el WhatsApp. Si hay fotos, espera y corre cada salesbot de foto.

Si salió de verdad (no shadow), se marca `inbox:out` para no repetir ese par, y `inbox:recent` por 2 minutos (un “sí” suelto no vuelve a listar el arranque).

Si Kommo traía asignado y el lead de Supabase existe, se asigna.

El candado del turno se suelta aquí, antes de la inteligencia.

---

## 14. Inteligencia (después de que el WhatsApp ya salió)

Si esto falla, el mensaje **ya se fue**. Es a propósito.

`analyzeTurn` lee la respuesta, el resumen y el texto del cliente y saca señales: vehículo, falta de datos, atención de vendedor, asesor de financiamiento, cédula, presupuesto, fotos recién enviadas, si respondió después de las fotos, si quiere llamada.

Luego, en este orden:

1. Si hay vehículo e id de lead, inserta en `interested_cars` (insert, no pisa la misma unidad).
2. Si el lead ya tenía `mensajes_enviados` de recuperación (2, 7, 15 o 30 días), clasifica la respuesta y la guarda en `lead_recovery`. Puede marcar stop.
3. El cliente escribió: el seguimiento pendiente se marca como respondido y se cancela. Los post-fotos pendientes se cancelan (`cliente_escribio`).
4. Escribe en el lead las señales:
   - Fotos recién enviadas → `respondio_post_fotos = false` y `fotos_enviadas_at`.
   - El cliente escribió después de fotos → `respondio_post_fotos = true`.
   - Quiere llamada.
   - Falta un dato → status `datos_pedidos` y fila en `datos_solicitados_clientes`.
   - Asesor de financiamiento y hay cédula → status `asesoria_financiamiento`, cédula, nombre, origen, y fila en `asesoria_financiamiento`.
   - Límite de presupuesto.
5. Si este turno acaba de mandar fotos, programa el **paso 1** de post-fotos a +40 minutos (corrido a horario laboral). No duplica si ya hay uno pendiente.
6. **Cuarta llamada a OpenAI: analizador del lead.** Solo si hay lead y texto del cliente. Devuelve JSON (financiamiento, retoma, señales, visita). Se mezclan las señales de comportamiento y la temperatura. Si hay retoma, se inserta en `trade_in_cars`. Visita: día, hora y referencia en America/Guayaquil. Si esta llamada falla, se loguea y el WhatsApp no se toca.

---

## 15. Reloj de análisis (cada 4 horas)

Toma un candado en base para que dos procesos no analicen a la vez.

Lista sesiones cuyo chat ya está en reposo. Por cada una:

1. Arma el paquete: transcripción, vehículos, precio máximo, etapa que ya había, hasta dónde se había analizado. Ventana de dedup de 10 minutos.
2. El modelo lee la conversación y devuelve etapa, objeción, evidencia, resumen, presupuesto, entrada, forma de pago, si agendó visita, seguimiento (`activo`, `aplazado`, `cerrado`).
3. La evidencia de la objeción tiene que ser una frase del cliente. Si no, reintenta una vez. Si sigue mal, no guarda.
4. Ajusta etapa y objeción (una visita agendada cambia lo que se puede guardar).
5. Guarda la lectura y hasta qué mensaje quedó cubierto.
6. Programa el seguimiento:
   - Cerrado → cancela pendientes.
   - Ya hay pendientes → no duplica.
   - Activo → retomas 1, 2 y 3.
   - Aplazado → solo la retoma 3.
7. Al final purga chats ya analizados.

La retoma 1 se programa a **8 horas hábiles** desde el último mensaje. La 2 a **2 días**. La 3 a **7 días**.

---

## 16. Reloj de seguimiento (cada 1 minuto)

Lista retomas vencidas (lote de 20). Entre un envío y el siguiente espera un hueco para no disparar todo junto.

Cada retoma se cancela, sin mandar, si:

- La objeción es ya compró, número equivocado o fuera de territorio.
- El seguimiento está cerrado, el bot está apagado, o el cliente escribió después de programarla.
- No hay lead de Kommo.

Si sigue viva, el modelo redacta el texto con el resumen, los vehículos, la objeción y el presupuesto.

- Shadow: no sale a WhatsApp, pero se marca como enviada.
- Real: escribe el campo de seguimiento **3039029**. Si Kommo no lo escribe, se cancela para no reintentar. Si lo escribe, corre el salesbot **180011**.

---

## 17. Reloj de post-fotos (cada 1 minuto)

Lista pasos vencidos (lote de 5).

Se cancela si el cliente ya respondió después de las fotos, no hay lead de Kommo, el lead ya no existe, o el bot está apagado (en base o en el checkbox de Kommo).

El modelo redacta el paso (1, 2 o 3) con nombre y ficha del carro.

- Shadow: no sale, se marca enviado y se programa el siguiente paso.
- Real: campo Respuesta IA, espera 1,5 s, salesbot de texto **157134**.

Cuando sale:

- Paso 1 hecho → programa el 2 a **3 horas** (horario laboral).
- Paso 2 hecho → programa el 3 a **6 horas**.
- Paso 3 es el último.

El paso 1 se había programado a **40 minutos** de haber mandado las fotos, en la inteligencia del turno.

---

## Orden de un mensaje de WhatsApp que sí se contesta

1. Kommo pega el webhook.
2. Se valida, se descarta duplicado, vacante y bot apagado.
3. Voz o foto pasan a texto.
4. Se espera 30 segundos y se junta lo que escribió ese contacto.
5. Se crea o se encuentra el lead y, si toca, se anota el carro del anuncio.
6. Resumen → intenciones → revisión de patio → agente de ventas (con herramientas) → limpieza del texto.
7. Se escribe Respuesta IA y corre el salesbot. Si toca, las fotos.
8. Se suelta el candado.
9. Se guardan carro de interés, señales, cédula, presupuesto, post-fotos y el análisis del lead.

Otro contacto, en el mismo segundo, usa otras llaves de Redis y otro historial. No se mezclan.
