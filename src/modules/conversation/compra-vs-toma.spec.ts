import { TEST_LEXICON } from './test-lexicon';
import { decideStayOnShown } from './otro-vehiculo';
import {
  banderasCompraQueSonDeToma,
  detectPedidoPatio,
  mismoVehiculoPorTokens,
  otroVehiculoEfectivo,
  respuestaIncompletaPrecio,
  unidadAAnclar,
} from './compra-vs-toma';
import { solicitudSinBanderas } from '../intelligence/parse-resumen';

const RESUMEN_20_12 = [
  'SOLICITUD ACTUAL:',
  'Cliente quiere información sobre el Hyundai Creta 2022 y menciona que tiene un jeptour x70 2022.',
  'Pide precio: no',
  'Otro vehículo: jeptour x70 2022',
  'Quiere comprar: Hyundai Creta 2022',
  'Su carro: jeptour x70 2022',
  'Color pedido: no',
  'Toma: no',
  'Toma ficha: no',
].join('\n');

const RESUMEN_12_05 = [
  'SOLICITUD ACTUAL:',
  'Cliente quiere el precio del Hyundai Creta 2022 y fotos de su Jetour X70 2022.',
  'Pide precio: sí',
  'Otro vehículo: no',
  'Quiere comprar: Hyundai Creta 2022',
  'Su carro: Jetour X70 2022',
  'Color pedido: blanco',
  'Tipo de patio: suv',
  'Toma: sí',
  'Toma ficha: Jetour X70 2022',
  'Toma ya: marca=Jetour; modelo=X70; color=no especificado; año=2022; km=no especificado',
].join('\n');

describe('compra vs toma', () => {
  it('jeptour y Jetour son el mismo carro a una letra', () => {
    expect(mismoVehiculoPorTokens('jeptour x70 2022', 'Jetour X70 2022')).toBe(
      true,
    );
    expect(
      mismoVehiculoPorTokens('Hyundai Creta 2022', 'jeptour x70 2022'),
    ).toBe(false);
  });

  it('Otro vehículo igual a Su carro se ignora', () => {
    expect(otroVehiculoEfectivo(RESUMEN_20_12)).toBeNull();
    expect(
      otroVehiculoEfectivo(
        'Otro vehículo: Santa Fe\nSu carro: jeptour x70 2022',
      ),
    ).toBe('Santa Fe');
  });

  it('Quiere comprar y Su carro no se mezclan en la solicitud', () => {
    expect(solicitudSinBanderas(RESUMEN_20_12)).not.toMatch(/Quiere comprar/i);
    expect(solicitudSinBanderas(RESUMEN_20_12)).not.toMatch(/Su carro/i);
  });

  it('20:12: el pedido de patio es el Creta, no el Jetour', () => {
    const asked = detectPedidoPatio({
      resumen: RESUMEN_20_12,
      customerText:
        'Hola. Me interesa el Hyundai Creta 2022\nTengo un jeptour x70 2022',
      lastAssistantText: '',
      lexicon: TEST_LEXICON,
    });
    expect(asked?.family).toMatch(/creta/i);
    expect(asked?.brand).toMatch(/hyundai/i);
    expect(asked?.family).not.toMatch(/x70/i);
  });

  it('12:05 Color pedido blanco del suyo se marca banderaDeToma', () => {
    const ignored = banderasCompraQueSonDeToma({
      resumen: RESUMEN_12_05,
      customerText:
        'Ayúdeme con el precio del Cretan. Yo voy a enviarle fotos de mi Yetul. Blanco mismo es.',
      lastAssistantText:
        'Estimado, tenemos un Hyundai Creta 2022 blanco. También un Jetour X70 II 2023.',
    });
    expect(ignored).toContain('color');
  });

  it('12:05 el pedido de patio sigue siendo el Creta', () => {
    const asked = detectPedidoPatio({
      resumen: RESUMEN_12_05,
      customerText: 'Ayúdeme con el precio del Cretan, por favor.',
      lastAssistantText:
        'Estimado, tenemos un Hyundai Creta AC 1.5 2022 blanco.',
      lexicon: TEST_LEXICON,
    });
    expect(asked?.family).toMatch(/creta/i);
  });

  it('sin unidad anclada, el Jetour de la toma no suelta a patio', () => {
    expect(
      decideStayOnShown({
        text: 'Tengo un jeptour x70 2022',
        resumen: RESUMEN_20_12,
        car: null,
      }),
    ).toEqual({ stay: false, motivo: 'es_toma' });
  });

  it('ancla la única Creta presentada aunque el contexto traiga Jetours', () => {
    const creta = {
      id: 'b7d3649a-c700-4070-b4e2-21289a45b330',
      brand: 'hyundai',
      model: 'creta ac 1.5 5p 4x2 tm',
      year: 2022,
      price: 22990,
      typeBody: 'jeep',
    };
    const jetour = {
      id: '11b5a9f7-da7d-4c9d-9fb4-3b8af3b4b12e',
      brand: 'jetour',
      model: 'x70 ii ac 1.5 5p 4x2 tm',
      year: 2023,
      price: 17990,
      typeBody: 'jeep',
    };
    expect(
      unidadAAnclar({
        family: 'creta',
        sendId: null,
        presented: [jetour, creta],
      }),
    ).toBe(creta.id);
  });

  it('control: Jetour de patio sin toma sí se pide', () => {
    const resumen = [
      'SOLICITUD ACTUAL:',
      'Cliente quiere un Jetour X70.',
      'Quiere comprar: Jetour X70',
      'Su carro: no',
      'Toma: no',
      'Otro vehículo: no',
    ].join('\n');
    const asked = detectPedidoPatio({
      resumen,
      customerText: 'Me interesa un Jetour X70',
      lastAssistantText: '',
      lexicon: TEST_LEXICON,
    });
    expect(asked?.family).toMatch(/x70/i);
    expect(asked?.brand).toMatch(/jetour/i);
  });

  it('el respaldo no toma un catálogo de varios años ni dos marcas', () => {
    expect(
      detectPedidoPatio({
        resumen: 'Falta vehículo: sí\nQuiere comprar: no\nSu carro: no',
        customerText:
          'Hola. ¿Puedo obtener más información sobre esto {Ranger 2026 Tracker 2022 Santa Fe 2018}',
        lastAssistantText: '',
        lexicon: TEST_LEXICON,
      }),
    ).toBeNull();
    expect(
      detectPedidoPatio({
        resumen: 'Cliente quiere 3 filas Nissan o Hyundai.\nQuiere comprar: no',
        customerText: 'Nissan, Hyunday. O cuales dosponen',
        lastAssistantText: '',
        lexicon: TEST_LEXICON,
      }),
    ).toBeNull();
  });

  it('el respaldo no copia el año de la solicitud si el cliente no lo dijo', () => {
    const asked = detectPedidoPatio({
      resumen: 'Cliente quiere el Prado 2015.\nQuiere comprar: no',
      customerText: 'Hola. Me interesa el Toyota Land Cruiser Prado',
      lastAssistantText: '',
      lexicon: TEST_LEXICON,
    });
    expect(asked?.family).toMatch(/prado/i);
    expect(asked?.year).toBeNull();
  });

  it('Pide precio: sí es incompleta si la respuesta no trae el $ (22,990 = 22.990 = 22990)', () => {
    expect(
      respuestaIncompletaPrecio({
        pidePrecio: true,
        mensaje: 'El Hyundai Creta 2022 está en $22,990.',
        precio: 22990,
      }),
    ).toBe(false);
    expect(
      respuestaIncompletaPrecio({
        pidePrecio: true,
        mensaje: 'El Hyundai Creta 2022 está en $22.990.',
        precio: 22990,
      }),
    ).toBe(false);
    expect(
      respuestaIncompletaPrecio({
        pidePrecio: true,
        mensaje: 'El Hyundai Creta 2022 está en 22990.',
        precio: 22990,
      }),
    ).toBe(false);
    expect(
      respuestaIncompletaPrecio({
        pidePrecio: true,
        mensaje: 'Estimado, no tenemos Jetour blanco. El precio no está cargado.',
        precio: 22990,
      }),
    ).toBe(true);
    expect(
      respuestaIncompletaPrecio({
        pidePrecio: false,
        mensaje: 'Tenemos el Creta 2022.',
        precio: 22990,
      }),
    ).toBe(false);
  });
});
