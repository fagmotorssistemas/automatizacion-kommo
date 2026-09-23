import {
  isBareConfirmation,
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

  it('sí/ok suelto no es elegir un carro', () => {
    expect(isBareConfirmation('Sí, por favor')).toBe(true);
    expect(isBareConfirmation('ok')).toBe(true);
    expect(isBareConfirmation('El GTI rojo')).toBe(false);
    expect(isBareConfirmation('Sí, el plateado')).toBe(false);
  });
});
