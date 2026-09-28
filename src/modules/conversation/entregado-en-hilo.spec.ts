import { buildResumenInput } from './build-resumen-input';
import {
  entregadoEnHilo,
  formatEntregadoForResumen,
} from './entregado-en-hilo';
import { MAP_URL } from './location-without-entrada';

const bot = (content: string) => ({ role: 'assistant', content });
const cliente = (content: string) => ({ role: 'user', content });

describe('entregadoEnHilo', () => {
  it('sin historial no hay nada entregado', () => {
    expect(entregadoEnHilo([], { unitPrice: 22900 })).toEqual({
      direccion: false,
      precio: null,
      horario: false,
      preguntaAplica: false,
    });
    expect(formatEntregadoForResumen(entregadoEnHilo(undefined))).toBeNull();
  });

  it('detecta la dirección con o sin mapa', () => {
    expect(
      entregadoEnHilo([bot('Estamos en Av. España 6-73 y Sevilla, Cuenca.')])
        .direccion,
    ).toBe(true);
    expect(entregadoEnHilo([bot(`Aquí el mapa: ${MAP_URL}`)]).direccion).toBe(
      true,
    );
  });

  it('solo cuenta lo que dijo el bot, no el cliente', () => {
    expect(
      entregadoEnHilo([cliente('Están en Av. España 6-73? cuesta $22,900')], {
        unitPrice: 22900,
      }),
    ).toMatchObject({ direccion: false, precio: null });
  });

  it('ignora el contexto del asesor humano', () => {
    expect(
      entregadoEnHilo([
        bot('CONTEXTO ASESOR (bot estuvo apagado):\nEstamos en Av. España'),
      ]).direccion,
    ).toBe(false);
  });

  it('detecta el precio de contado de la unidad, no otro monto', () => {
    const history = [bot('El Kia Sportage cuesta $22,900.')];
    expect(entregadoEnHilo(history, { unitPrice: 22900 }).precio).toBe(22900);
    expect(entregadoEnHilo(history, { unitPrice: 19900 }).precio).toBeNull();
    expect(entregadoEnHilo(history).precio).toBeNull();
  });

  it('detecta el horario y la pregunta de si aplica', () => {
    const e = entregadoEnHilo([
      bot('Atendemos L-V 08:30–18:00 y sábado 09:30–13:30.'),
      bot('¿Le ayudamos a ver si aplica al crédito?'),
    ]);
    expect(e.horario).toBe(true);
    expect(e.preguntaAplica).toBe(true);
  });

  it('arma la sección para el resumen solo con lo entregado', () => {
    const text = formatEntregadoForResumen(
      entregadoEnHilo(
        [bot('Av. España 6-73. El precio es $22,900.')],
        { unitPrice: 22900 },
      ),
    );
    expect(text).toContain('dirección');
    expect(text).toContain('$22900');
    expect(text).not.toContain('horario');
  });
});

describe('buildResumenInput con lo entregado', () => {
  it('pone YA ENTREGADO EN EL HILO antes del HISTORIAL', () => {
    const history = [bot('Estamos en Av. España 6-73.')];
    const input = buildResumenInput({
      history: history as never,
      customerText: 'Voy el sábado',
      entregado: entregadoEnHilo(history),
    });
    const entregadoAt = input.indexOf('YA ENTREGADO EN EL HILO');
    expect(entregadoAt).toBeGreaterThanOrEqual(0);
    expect(entregadoAt).toBeLessThan(input.indexOf('HISTORIAL:'));
  });

  it('sin nada entregado no agrega la sección', () => {
    const input = buildResumenInput({
      history: [],
      customerText: 'Hola',
      entregado: entregadoEnHilo([]),
    });
    expect(input).not.toContain('YA ENTREGADO');
  });
});
