import {
  adLabelLooksLikeVehicle,
  facebookAdLabel,
  isBareConfirmation,
  isCtaAdLabel,
  isFacebookMoreInfoOpener,
} from './first-touch';

describe('first-touch', () => {
  it('reconoce el clic de Facebook y no un pedido concreto', () => {
    expect(
      isFacebookMoreInfoOpener(
        '¡Hola! Me gustaría conseguir más información sobre esto.',
      ),
    ).toBe(true);
    expect(
      isFacebookMoreInfoOpener(
        '¡Hola! Me gustaría conseguir más información sobre esto {KIA SPORTAGE R 2019}',
      ),
    ).toBe(true);
    expect(
      isFacebookMoreInfoOpener('Hola. ¿Puedo obtener más información sobre esto?'),
    ).toBe(true);
    expect(
      isFacebookMoreInfoOpener(
        'Hola. Quiero más información sobre el Kia Sportage 2019',
      ),
    ).toBe(false);
    expect(
      isFacebookMoreInfoOpener(
        '¡Hola! Me gustaría conseguir más información sobre esto.\nSí, por favor',
      ),
    ).toBe(false);
  });

  it('el título del anuncio es un carro o un botón', () => {
    expect(
      facebookAdLabel(
        'Hola. ¿Puedo obtener más información sobre esto {Fiat 500 2017}',
      ),
    ).toBe('Fiat 500 2017');
    expect(adLabelLooksLikeVehicle('Fiat 500 2017')).toBe(true);
    expect(adLabelLooksLikeVehicle('Grand Vitara')).toBe(true);
    expect(isCtaAdLabel('Chatea con nosotros')).toBe(true);
    expect(adLabelLooksLikeVehicle('Chatea con nosotros')).toBe(false);
    expect(isCtaAdLabel('K-SI Nuevos.')).toBe(true);
    expect(facebookAdLabel('¡Hola! Quiero más información')).toBeNull();
  });

  it('sí/ok suelto no es elegir un carro', () => {
    expect(isBareConfirmation('Sí, por favor')).toBe(true);
    expect(isBareConfirmation('ok')).toBe(true);
    expect(isBareConfirmation('El GTI rojo')).toBe(false);
    expect(isBareConfirmation('Sí, el plateado')).toBe(false);
  });
});
