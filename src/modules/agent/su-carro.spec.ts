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

  it('vender su casa para pagar al contado no es toma', () => {
    const resumen =
      'SOLICITUD ACTUAL:\nCliente quiere vender su casa para comprar al contado.';
    const text =
      'Excelente pero estoy construyendo unas casa en Manta y espero vender para poder comprar al contado';
    expect(turnIsSellingTheirCar(['venta', 'tomavehicular'], resumen, text)).toBe(
      false,
    );
    expect(turnAlsoWantsToBuy(['venta'], resumen, text)).toBe(false);
    expect(turnAlsoWantsToBuy(['compra'], resumen, text)).toBe(true);
  });
});
