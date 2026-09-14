import { BUSCAR_VEHICULO_TOOL_DESCRIPTION } from './prompts/sales.prompt';

export const SALES_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'buscarvehiuclo',
      description: BUSCAR_VEHICULO_TOOL_DESCRIPTION,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query limpio de búsqueda' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calcular_financiamiento',
      description:
        'Calcula la cuota mensual aproximada de CrediFAG (crédito directo a 36 meses) o determina si el cliente debe ir por financiamiento bancario. Úsala siempre que el cliente pida el valor de la cuota mensual del crédito directo, nunca calcules el monto manualmente.',
      parameters: {
        type: 'object',
        properties: {
          precio: { type: 'number' },
          entrada_cliente: { type: ['number', 'null'] },
          entrada_porcentaje: { type: ['number', 'null'] },
        },
        required: ['precio'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calcular_financiamiento_bancario',
      description:
        'Calcula la cuota mensual aproximada para financiamiento bancario o cooperativa (cuando la entrada del cliente es MENOR al 60% del valor del vehículo). Úsala siempre que el cliente indique a cuántos años desea financiar, nunca calcules el monto manualmente.',
      parameters: {
        type: 'object',
        properties: {
          precio: { type: 'number' },
          entrada_cliente: { type: ['number', 'null'] },
          entrada_porcentaje: { type: ['number', 'null'] },
          anos: { type: 'number' },
        },
        required: ['precio', 'anos'],
      },
    },
  },
];
