import { turnAlsoWantsToBuy, turnIsSellingTheirCar } from './su-carro';

describe('su carro', () => {
  it('vender su seltos no es una compra', () => {
    const resumen =
      'SOLICITUD ACTUAL:\nCliente quiere vendernos su Kia Seltos 2020.';
    expect(turnIsSellingTheirCar(['rol', 'compra'], resumen)).toBe(true);
    expect(turnAlsoWantsToBuy(['rol', 'compra'], resumen)).toBe(false);
  });

  it('si además quiere ver otro carro, ese sí se puede buscar', () => {
    const resumen =
      'Cliente quiere vendernos su Kia Soul y quiere ver un Toyota.';
    expect(turnIsSellingTheirCar(['rol', 'venta'], resumen)).toBe(true);
    expect(turnAlsoWantsToBuy(['rol', 'venta'], resumen)).toBe(true);
  });

  it('una compra normal no es toma', () => {
    const resumen = 'Cliente quiere una hilux.';
    expect(turnIsSellingTheirCar(['rol', 'compra'], resumen)).toBe(false);
    expect(turnAlsoWantsToBuy(['rol', 'compra'], resumen)).toBe(true);
  });
});
