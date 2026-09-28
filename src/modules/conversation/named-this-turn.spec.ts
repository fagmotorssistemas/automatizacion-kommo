import { resumenBrandFitsShown, textoQueNombra } from './named-this-turn';
import { TEST_LEXICON } from './test-lexicon';

const RESUMEN_SIGUE = [
  'Vehículo: Mitsubishi Montero Sport 2022',
  'SOLICITUD ACTUAL:',
  'Cliente quiere visitar la próxima semana esa unidad.',
  'Pide otras: no',
].join('\n');

describe('textoQueNombra', () => {
  it('sigue en la unidad y el resumen no ve la marca: no cuenta la palabra suelta', () => {
    expect(
      textoQueNombra(RESUMEN_SIGUE, 'Quiero un aveo', TEST_LEXICON),
    ).toBe('');
  });

  it('si el resumen también ve la marca, el texto queda', () => {
    const resumen = [
      'SOLICITUD ACTUAL:',
      'Cliente quiere un Chevrolet Aveo.',
      'Pide otras: no',
    ].join('\n');
    expect(textoQueNombra(resumen, 'Quiero un aveo', TEST_LEXICON)).toBe('Quiero un aveo');
  });

  it('si pide otras, el texto queda como está', () => {
    const resumen = 'SOLICITUD ACTUAL:\nCliente quiere otras.\nPide otras: sí';
    expect(textoQueNombra(resumen, 'Quiero un aveo', TEST_LEXICON)).toBe('Quiero un aveo');
  });

  it('sin marca en el texto no toca nada', () => {
    expect(textoQueNombra(RESUMEN_SIGUE, 'Gracias', TEST_LEXICON)).toBe('Gracias');
  });
});

describe('resumenBrandFitsShown', () => {
  it('sin marca en el resumen o con la del carro mostrado: sigue', () => {
    expect(resumenBrandFitsShown(RESUMEN_SIGUE.replace('Mitsubishi Montero Sport 2022', 'Montero'), 'mitsubishi', TEST_LEXICON)).toBe(true);
    expect(resumenBrandFitsShown('Vehículo: Chevrolet Aveo\nSOLICITUD ACTUAL:\nQuiere el precio.', 'Chevrolet', TEST_LEXICON)).toBe(true);
  });

  it('el resumen nombra otra marca: el cliente cambió de carro', () => {
    expect(resumenBrandFitsShown('SOLICITUD ACTUAL:\nCliente quiere el precio de un Nissan.', 'kia', TEST_LEXICON)).toBe(false);
  });
});
