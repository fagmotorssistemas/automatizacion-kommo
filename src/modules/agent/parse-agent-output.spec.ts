import { parseAgentOutput } from './parse-agent-output';

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
      meta: { vehiculo: { inventory_id: 'abc' } },
      img_prefix: 'hilux',
    });
  });

  it('si no hay JSON, usa el texto', () => {
    expect(parseAgentOutput('hola')).toEqual({
      mensaje: 'hola',
      meta: { vehiculo: null },
      img_prefix: '',
    });
  });
});
