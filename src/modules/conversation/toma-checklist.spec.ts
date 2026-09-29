import { TEST_LEXICON } from './test-lexicon';
import {
  applyInboundTomaPhotos,
  formatTomaPedido,
  inboundTomaPhotosReceived,
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

  it('un | no del formato no inventa un segundo carro', () => {
    const parsed = parseTomaChecklistFromResumen(
      'Toma ya: marca=Jetour; color=rojo; año=2024; km=50 mil | no',
    );
    expect(parsed?.others).toBeUndefined();
    expect(parsed?.have.marca).toBe('Jetour');
  });

  it('el segundo carro que nos vende no pisa al primero', () => {
    const merged = mergeTomaChecklist(
      {
        have: {
          marca: 'Chevrolet',
          modelo: 'Captiva',
          anio: '2024',
          color: 'blanco',
        },
        pending: [],
      },
      {
        have: {
          marca: 'Dongfeng',
          modelo: 'SX5',
          anio: '2022',
          km: '105 mil',
        },
        pending: [],
      },
    );
    expect(merged?.have.marca).toBe('Chevrolet');
    expect(merged?.others?.[0].have).toMatchObject({
      marca: 'Dongfeng',
      modelo: 'SX5',
    });
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
    expect(text).toMatch(/máximo 2: modelo exacto del Jetour/);
    expect(text).toMatch(/PROHIBIDO placa, fotos o monto/);
    expect(text).not.toMatch(/Pide solo los datos que falten de ESE carro \(marca, modelo, año/);
  });

  it('dos carros que nos vende no se mezclan ni piden placa de una', () => {
    const parsed = parseTomaChecklistFromResumen(
      `
Toma: sí
Toma ficha: Chevrolet Captiva 2024 blanco 112 mil km || Dongfeng SX5 2022 105 mil km
Toma ya: marca=Chevrolet; modelo=Captiva; año=2024; km=112 mil; color=blanco || marca=Dongfeng; modelo=SX5; año=2022; km=105 mil
Toma falta: no || color
Toma pendiente: no
`,
    );
    expect(parsed?.have).toMatchObject({
      marca: 'Chevrolet',
      modelo: 'Captiva',
      anio: '2024',
      color: 'blanco',
    });
    expect(parsed?.others?.[0].have).toMatchObject({
      marca: 'Dongfeng',
      modelo: 'SX5',
      anio: '2022',
      km: '105 mil',
    });
    const text = formatTomaPedido(parsed);
    expect(text).toMatch(/2 carros/);
    expect(text).toMatch(/color del Dongfeng SX5/);
    expect(text).not.toMatch(/máximo 2:.*primera letra/);
    expect(text).toMatch(/PROHIBIDO placa, fotos o monto/);
  });

  it('el JSON de visión cuenta como fotos recibidas', () => {
    const vision =
      '{ "marca": "Hyundai", "modelo": "no identificado", "tipo": "SUV", "color": "negro", "placa": "YCA841AT", "intencion": "VENDER", "confianza_marca": "alta", "razonamiento": "El cliente desea vender su vehículo, y se ha analizado la foto enviada sin necesidad de solicitar más imágenes." }';
    expect(inboundTomaPhotosReceived(vision)).toBe(true);
    expect(inboundTomaPhotosReceived('Cañajo')).toBe(false);
    expect(
      inboundTomaPhotosReceived(
        'Unable to open this message. Ask the contact to send it in a supported WhatsApp format.',
      ),
    ).toBe(false);
    const marked = applyInboundTomaPhotos(
      {
        have: {
          marca: 'Hyundai',
          modelo: 'Santa Fe',
          anio: '2007',
          km: 'sin dato',
          color: 'azul',
        },
        pending: ['fotos'],
      },
      vision,
    );
    expect(marked?.have.fotos).toBe('recibidas');
    expect(marked?.pending).toEqual([]);
  });

  it('con identidad lista pide fotos solo si aún no llegaron', () => {
    const identity = {
      marca: 'Hyundai',
      modelo: 'Santa Fe',
      anio: '2007',
      km: 'sin dato',
      color: 'azul',
    };
    const sinFotos = formatTomaPedido({ have: identity, pending: [] });
    expect(sinFotos).toMatch(/mandar fotos/);
    expect(sinFotos).not.toMatch(/fotos YA recibidas/);

    const conFotos = formatTomaPedido({
      have: { ...identity, fotos: 'recibidas' },
      pending: [],
    });
    expect(conFotos).toMatch(/fotos YA recibidas/);
    expect(conFotos).toMatch(/PROHIBIDO pedir más fotos/);
    expect(conFotos).not.toMatch(/mandar fotos/);
  });
});
