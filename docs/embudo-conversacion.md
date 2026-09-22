# Embudo y análisis de conversación

El chat en `n8n_chat_histories` es evidencia temporal: el cron lo borra a los 30 días.
`lead_conversation_analysis` es el hecho permanente: una fila por sesión.

Dos ejes en la misma fila, que no se reemplazan:

- **Etapa** — hasta dónde llegó el cliente.
- **Objeción** — por qué no siguió. Solo si se detuvo.

Fuente canónica: `supabase/lead_conversation_analysis.sql` y `src/modules/analysis/`.

---

## La lista de 8

### 6 — Resumen de conversación — hecho

El cron borraba los chats y se perdía la conversación.

Cada sesión deja una fila en `lead_conversation_analysis` con resumen, etapa, objeción, vehículos y plata. El chat se puede ir; eso no.

### 4 — Recomendaciones de vehículos — hecho

`vehiculos_consultados` guarda los `inventory_id` que el bot ofreció, cruzados con `inventoryoracle`.

### 1 y 5 — De dónde se cae / por cliente dónde cayó — hecho, falta soltar el bot

Antes no había embudo. Solo frío/tibio/caliente, y mal: `lead_temperature_history` guarda la **última** temperatura del mes, no la máxima. Un lead que se calentó y se enfrió aparecía frío.

El primer intento (9 etapas) no filtraba:

| Etapa vieja | Qué pasaba |
|---|---|
| Contactado | 99,98% — el bot siempre responde |
| Vehículo definido | 85% |
| Cotizado | 87% — el bot mandaba el precio en la ficha, sin que nadie lo pidiera |

Y el embudo **crecía**: 3.623 en la 3 contra 2.956 en la 2. Imposible.

Quedaron 8 etapas. Cada una es una decisión del cliente. Ver [embudo](#embudo-0-7).

**Falta:** soltar el bot nuevo (`precio_mostrado` / `cuota_mostrada`, ficha sin precio). Hasta entonces las etapas 3 y 4 quedan en cero. Los chats se borran a los 30 días: si el bot sale después de los booleanos, ese período no se recupera.

### 7 — High / low ticket — hecho, falta el bot

El dinero vivía en tres sitios y ninguno servía:

- `presupuesto_cliente` no es monto (“Primera interacción”).
- `leads.budget` mezcla presupuesto y entrada: 112 en `"0.00"` y valores como `"25%"`.
- Umbrales inventados (12k / 25k): “low” tenía 1 vehículo.

Los cortes reales salen de 132 vendidos con precio: p25 = 16.675, p75 = 32.892 → **17k / 33k**.

Dos preguntas, no una. Ver [ticket y presupuesto](#ticket-y-presupuesto).

**Falta:** el bot, para que exista `precio_max_mostrado` y se llene `segmento_ticket`.

### 8 — Nuevos vs antiguos — pendiente

Los datos están en `lead_temperature_history`. Falta la vista `v_lead_recorrido`. No depende del bot.

### 3 — Seguimiento a 2 y 30 días — no empezado

Último de la cadena. Espera embudo y ticket midiendo.

### 2 — De qué lugar nos hablan — sin base

Lo único que apareció: la etiqueta de plantilla separa quienes llegan por un carro concreto de quienes llegan por anuncio genérico.

### Etapa 7 (vendió) — después

El escalón existe en el enum (0–7). La fuente de contabilidad no está conectada.

---

## Embudo 0–7

| # | Etapa | Marca | Fuente |
|---|---|---|---|
| 0 | Entró | existe sesión | SQL |
| 1 | Respondió | 1+ mensaje propio, sin plantilla `{…}` | SQL |
| 2 | Conversó | 2+ mensajes propios | SQL |
| 3 | Pidió precio | `meta.precio_mostrado = true` | SQL (lo declara el bot) |
| 4 | Pidió financiamiento | `meta.cuota_mostrada = true` | SQL (lo declara el bot) |
| 5 | Visita agendada | el cliente aceptó día/hora concreto | LLM |
| 6 | Visitó | `showroom_visits` por últimos 9 dígitos del teléfono | CRM |
| 7 | Vendió | factura | Contabilidad — pendiente |

### Cuatro reglas

1. **La plantilla no cuenta.** `content !~ '\{.*\}'` — el texto del anuncio lo escribió Meta, no la persona.
2. **Cada etapa exige la anterior.** Sin esto el embudo crece. Quien pide cuota sin pedir precio salta a 4: está más avanzado, no menos.
3. **`etapa_max` nunca baja.** `GREATEST` + trigger. Corrige el bug de temperatura (máxima, no última).
4. **Etapa por booleano, no por texto.** `precio_mostrado` y `cuota_mostrada` los pone el bot. `meta.vehiculo.precio` es dato interno para el ticket: **no** sube etapa. Si no, pedir cuota disparaba la 3.

La ficha va **sin precio** salvo que el cliente lo pida. Si pide cuota, se dice la cuota y `precio_mostrado` queda en false.

---

## Objeciones

La etapa dice hasta dónde llegó. La objeción dice por qué no siguió.

Tres campos:

| Campo | Para qué |
|---|---|
| `objecion_principal` | enum, **nullable** — agrupar |
| `objecion_texto` | lo que pasó, en palabras |
| `objecion_evidencia` | cita literal de una línea `[cliente]` |

Si el lead sigue vivo, la objeción es `null`. Agendar visita no es objeción. Se puede agendar **y** haber objetado (retoma, modelo, equipamiento).

### Las 16

**Del cliente — algo concreto:**
`modelo`, `equipamiento`, `km`, `ubicacion` (mín. 2); `precio` (mín. 3); `entrada`, `rechaza_credito`, `retoma` (mín. 4).

**Del cliente — no hay venta:**
`solo_cotiza` (mín. 3), `ya_compro` (2), `numero_equivocado` (0), `fuera_territorio` (0).

**No son objeciones — falló otra cosa:**
`sin_conversacion` (solo plantilla), `no_responde` (escribió y desapareció), `sin_cierre` (llegó lejos y nadie lo siguió; mín. 3).

**Comodín:** `otro` (0). Si el LLM se adelanta a la etapa, se guarda `otro` + `[revisar:…]`.

`precio`, `entrada` y `km` exigen **rechazo**, no pregunta. “¿Cuánto cuesta?” es la etapa 3, no una objeción.

### Validaciones en código

- Evidencia con `{llaves}` del anuncio no pasa (mismo filtro que las etapas).
- Si agendó, no se guarda `sin_cierre` / `sin_conversacion` / `no_responde`.
- Si ya escribió, `sin_conversacion` pasa a `no_responde`.
- Si la objeción exige una etapa a la que no llegó, no entra.

Para reportar: las 8 del primer grupo se responden con inventario o precio. `sin_conversacion`, `no_responde` y `sin_cierre` se responden con proceso (`sin_cierre` es llamar). Aún no hay pantalla.

---

## Ticket y presupuesto

Dos preguntas distintas.

**¿En qué rango lo puso el bot?**  
`segmento_ticket` es columna **generada** sobre `precio_max_mostrado`:

- `high` ≥ 33.000
- `medio` ≥ 17.000
- `low` si hay precio menor

Los umbrales van a cambiar (80 vendidos tienen precio 0; `price` es lista, no venta). Al ser generada, se cambia la fórmula y se recalcula solo.

**¿Qué puede pagar?** Lo lee el LLM. El texto `presupuesto_declarado` se queda.

| Campo | Qué es | No es |
|---|---|---|
| `presupuesto_monto` | “tengo 12 mil para un carro” | la entrada |
| `entrada_disponible` | “doy 4 mil de entrada” | el presupuesto |
| `forma_pago` | `contado` o `credito` | retoma (es fuente de entrada) |

Si una relectura trae `null`, no borra un monto que ya estaba (`coalesce`).

Calificación CrediFAG cuando haya datos: entrada ≥ 60% del precio → `credifag`, si no `banco`.

---

## Lo que salió de paso

**Etapa 6.** `interactions` tenía 16 visitas en 9 meses. `showroom_visits` tiene ~1.840, y 586 cruzan con leads por teléfono. El 68% de quien visita nunca pasó por WhatsApp: el canal no es todo el patio.

**El generador.** Sesiones que no son clientes: un script manda nombres del inventario cada 2 segundos para que el bot escriba copys. Sigue corriendo. No deben entrar al embudo como leads.

**Mayo → junio.** Volumen −80%, calidad de 9% a 50%. Nadie sabe qué cambió. Es el hallazgo más grande y sigue sin tocarse.

---

## Qué falta, en orden

1. Soltar el bot (ficha sin precio + `precio_mostrado` / `cuota_mostrada`) **el mismo día** que este análisis.
2. Vista `v_lead_recorrido` (punto 8).
3. Seguimiento a 2 y 30 días (punto 3), cuando el embudo ya mida.
4. Etapa 7 cuando haya factura.
5. Origen / lugar (punto 2), cuando haya base.
