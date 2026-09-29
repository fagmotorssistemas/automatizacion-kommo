# Plan: no repetir crédito

Implementado. Tras “¿aplica?” el bot no vuelve a soltar la misma cuota. Si acepta, pide los 3 datos. Si se va, cierra y no pega visita encima.

No entra horario, ubicación, catálogo, soltar unidad ni la primera letra. Esos caminos no se tocan.

## Qué fallaba (A66076)

Ya había cuota y la pregunta de si aplica. El cliente dijo “Sí”. El resumen marcó `Acepta crédito: sí`. El código no lo usó: buscaba entrada/plazo también en la solicitud, y ahí seguían los $5000 y los 5 años del hilo. Creyó que pedía otra proforma, rearmó la letra y volvió a preguntar si aplica.

“Gracias ya no” marcó `Rechaza aplicar` y despedida. El agente cerró y el sistema le pegó debajo el texto de “¿le cuento más o viene a verlo?”.

## Qué no choca

| Camino | Por qué sigue igual |
|---|---|
| Horario / ubicación / otras / soltar | No se lee ni se escribe |
| Primera cuota (entrada y plazo ahora) | Este mensaje sí trae el dato: se arma la letra |
| 48 meses con entrada previa (A72955) | El mensaje de ahora trae el plazo: cuota, no cédula |
| Elegir banco / CrediFAG | Aún no hubo cuota ni “ver si aplica” en el hilo |
| “No” a aplicar, sin irse | Sigue el texto de ánimo con el carro |
| `gaveFinancingInputs` con resumen | Se queda para el hint de “pregunta entrada y plazo” cuando eligió camino |

## Solución

`Acepta crédito: sí` gana. La solicitud no vota si “dio datos ahora”.

1. `financingInputsNow` mira solo este mensaje. Si no trae entrada o plazo nuevo y el resumen acepta, no se reinyecta la cuota. El sistema pega cédula, nombre y de dónde es.
2. Si el agente igual reimprime la letra, se quita y no tapa los 3 datos.
3. Si ya es cierre / despedida, no se pega `FINANCING_DECLINE`.

No hay lista de “sí / ok / dale”. El sentido lo marca la bandera. Un número de entrada o plazo en **este** mensaje sigue siendo cuota.
