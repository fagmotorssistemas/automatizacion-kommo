import { TEST_LEXICON } from './test-lexicon';
import {
  formatTomaPedido,
  mergeTomaChecklist,
  missingTomaSlots,
  parseHaveFacts,
  parseTomaChecklistFromResumen,
} from './toma-checklist';

describe('toma-checklist', () => {
  it('lee ya / falta / pendiente del analizador', () => {
    const parsed = parseTomaChecklistFromResumen(
      `
SOLICITUD ACTUAL:
Cliente quiere dejar su Jetour como parte de pago y no tiene fotos.
Toma: sí
Toma ficha: Jetour rojo 2024 50 mil km
Toma ya: marca=Jetour; color=rojo; año=2024; km=50 mil
Toma falta: modelo, placa, monto
Toma pendiente: fotos
`,
      TEST_LEXICON,
    );
    expect(parsed?.have).toMatchObject({
      marca: 'Jetour',
      color: 'rojo',
      anio: '2024',
      km: '50 mil',
    });
    expect(parsed?.pending).toEqual(['fotos']);
    expect(missingTomaSlots(parsed!)).toEqual(['modelo', 'placa', 'monto']);
  });

  it('guarda la marca del suyo aunque no esté en patio', () => {
    expect(
      parseTomaChecklistFromResumen(
        'Toma ya: marca=Nativa; color=rojo; año=2018; km=80 mil',
      )?.have,
    ).toMatchObject({
      marca: 'Nativa',
      color: 'rojo',
      anio: '2018',
      km: '80 mil',
    });
    expect(
      parseTomaChecklistFromResumen(
        'Toma ya: marca=rojo; modelo=2024; color=rojo; año=2024',
      )?.have.marca,
    ).toBeUndefined();
    expect(
      parseTomaChecklistFromResumen(
        'Toma ya: marca=Jetour; modelo=T1; color=rojo; año=2024',
      )?.have,
    ).toMatchObject({
      marca: 'Jetour',
      modelo: 'T1',
      color: 'rojo',
      anio: '2024',
    });
    expect(
      parseHaveFacts('Hola me gusta el Jetour T1 rojo 2024', TEST_LEXICON),
    ).toMatchObject({
      marca: 'jetour',
      modelo: 't1',
      color: 'rojo',
      anio: '2024',
    });
  });

  it('sin etiquetas saca marca, color, año y km de la ficha', () => {
    expect(
      parseHaveFacts('Jetour color rojo año 2024 x50mil klmtrso', TEST_LEXICON),
    ).toMatchObject({
      marca: 'jetour',
      color: 'rojo',
      anio: '2024',
      km: '50 mil',
    });
  });

  it('fusiona y saca de pendiente lo que ya llegó', () => {
    const merged = mergeTomaChecklist(
      {
        have: { marca: 'Jetour', anio: '2024' },
        pending: ['fotos'],
      },
      {
        have: { color: 'rojo', km: '50 mil' },
        pending: ['fotos', 'placa'],
      },
    );
    expect(merged?.have).toMatchObject({
      marca: 'Jetour',
      anio: '2024',
      color: 'rojo',
      km: '50 mil',
    });
    expect(merged?.pending).toEqual(['fotos', 'placa']);
  });

  it('el pedido solo pide huecos y no recita la ficha', () => {
    const text = formatTomaPedido({
      have: {
        marca: 'Jetour',
        color: 'rojo',
        anio: '2024',
        km: '50 mil',
      },
      pending: ['fotos'],
    });
    expect(text).toMatch(/YA.*marca=Jetour/);
    expect(text).toMatch(/PENDIENTE.*fotos/i);
    expect(text).toMatch(/máximo 2: modelo exacto, primera letra de la placa/);
    expect(text).not.toMatch(/Pide solo los datos que falten de ESE carro \(marca, modelo, año/);
  });
});
