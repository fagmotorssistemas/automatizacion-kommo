import {
  asksClosestByFacts,
  asksYearOnward,
  isConcreteAsk,
  resolveConcreteAsk,
} from './concrete-ask';

describe('pedido concreto', () => {
  it('detecta pasajeros, techo, automático y diésel', () => {
    expect(isConcreteAsk('Yo quiero uno de tres filas de 7 pasajeros')).toBe(
      true,
    );
    expect(isConcreteAsk('Necesito para 7 personas')).toBe(true);
    expect(isConcreteAsk('que tenga techo panorámico')).toBe(true);
    expect(isConcreteAsk('busco uno automático')).toBe(true);
    expect(isConcreteAsk('tiene que ser diésel')).toBe(true);
    expect(isConcreteAsk('transmisión manual')).toBe(true);
  });

  it('4x2, gasolina o 2023 en adelante piden lo más cercano, no el exacto', () => {
    expect(
      asksClosestByFacts(
        'Toyota Hilux cabina doble a gasolina, 4x2 año 2023 en adelante',
      ),
    ).toBe(true);
    expect(asksYearOnward('año 2023 en adelante')).toBe(true);
    expect(asksYearOnward('2012 en edelante')).toBe(true);
    expect(asksYearOnward('2012 en adelnte')).toBe(true);
    expect(asksClosestByFacts('tienen el Sportage?')).toBe(false);
  });

  it('no trata la marca ni un sí como pedido concreto', () => {
    expect(isConcreteAsk('Nissan')).toBe(false);
    expect(isConcreteAsk('Sí, por favor')).toBe(false);
    expect(isConcreteAsk('No muchas gracias yo necesito un Nissan')).toBe(
      false,
    );
  });

  it('conserva los 7 pasajeros cuando después solo insiste en la marca', () => {
    expect(
      resolveConcreteAsk({
        history: [
          { role: 'user', content: 'Nissan' },
          {
            role: 'user',
            content: 'Yo quiero uno de tres filas de 7 pasajeros',
          },
        ],
        customerText: 'No muchas gracias yo necesito un Nissan',
        remembered: null,
      }),
    ).toBe('Yo quiero uno de tres filas de 7 pasajeros');
  });

  it('usa el pedido guardado si ya no está en los mensajes', () => {
    expect(
      resolveConcreteAsk({
        history: [],
        customerText: 'ok',
        remembered: '7 pasajeros',
      }),
    ).toBe('7 pasajeros');
  });

  it('un pedido nuevo reemplaza al anterior', () => {
    expect(
      resolveConcreteAsk({
        history: [{ role: 'user', content: 'quiero 7 pasajeros' }],
        customerText: 'mejor que sea diésel',
        remembered: 'quiero 7 pasajeros',
      }),
    ).toBe('mejor que sea diésel');
  });
});
