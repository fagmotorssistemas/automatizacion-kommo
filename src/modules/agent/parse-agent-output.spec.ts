import { parseAgentOutput, serializeAgentTurn } from './parse-agent-output';

describe('parseAgentOutput', () => {
  it('lee JSON puro del agente', () => {
    expect(
      parseAgentOutput(
        JSON.stringify({
          respuesta_cliente: 'Buenos días',
          meta: { vehiculo: { inventory_id: 'abc' } },
          img_prefix: 'hilux',
        }),
      ),
    ).toEqual({
      mensaje: 'Buenos días',
      meta: {
        precioMostrado: false,
        cuotaMostrada: false,
        vehiculo: { inventory_id: 'abc' },
      },
      img_prefix: 'hilux',
    });
  });

  it('declara si mostró precio o cuota, no el precio interno', () => {
    const parsed = parseAgentOutput(
      JSON.stringify({
        respuesta_cliente: 'La cuota queda en 280.',
        meta: {
          precio_mostrado: false,
          cuota_mostrada: true,
          vehiculo: { inventory_id: 'exp-1', precio: 33990 },
        },
      }),
    );
    expect(parsed.meta).toEqual({
      precioMostrado: false,
      cuotaMostrada: true,
      vehiculo: { inventory_id: 'exp-1', precio: 33990 },
    });
    expect(serializeAgentTurn(parsed)).toContain('"precio_mostrado":false');
    expect(serializeAgentTurn(parsed)).toContain('"cuota_mostrada":true');
  });

  it('si no hay JSON, usa el texto', () => {
    expect(parseAgentOutput('hola')).toEqual({
      mensaje: 'hola',
      meta: {
        precioMostrado: false,
        cuotaMostrada: false,
        vehiculo: null,
      },
      img_prefix: '',
    });
  });
});
