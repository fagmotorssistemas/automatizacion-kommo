import {
  carsShownInHistory,
  carsShownInText,
  clasificarFilas,
  describeUnit,
  formatMissingNamedModel,
  formatNamedUnits,
  formatRevisionMarca,
  pickClosestToMissingModel,
  pickShownByYear,
  textMentionsModel,
  unitCaja,
  unitDoors,
  unitDrive,
  userNamedModel,
} from './clasificar-filas';
import type { StockCar } from './clasificar-filas';

const nissans: StockCar[] = [
  {
    id: 'sentra',
    brand: 'nissan',
    model: 'sentra exclusive ac 1.8 4p 4x2 ta',
    year: 2014,
    price: 13800,
    typeBody: 'sedan',
  },
  {
    id: 'kicks',
    brand: 'nissan',
    model: 'kicks advance cvt ac 1.6 5p 4x2 ta',
    year: 2020,
    price: 18900,
    typeBody: 'jeep',
  },
  {
    id: 'frontier',
    brand: 'nissan',
    model: 'frontier s ac 2.5 cd 4x2 tm',
    year: 2021,
    price: 26590,
    typeBody: 'doble cabina',
  },
  {
    id: 'xtrail',
    brand: 'nissan',
    model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
    year: 2016,
    price: 16890,
    typeBody: 'jeep',
  },
];

describe('clasificar filas', () => {
  it('el sentra y la frontier no son de tres filas; la x-trail sí puede', () => {
    expect(clasificarFilas(nissans[0].model, nissans[0].typeBody)).toBe('no');
    expect(clasificarFilas(nissans[1].model, nissans[1].typeBody)).toBe('no');
    expect(clasificarFilas(nissans[2].model, nissans[2].typeBody)).toBe('no');
    expect(clasificarFilas(nissans[3].model, nissans[3].typeBody)).toBe(
      'posible',
    );
  });

  it('7pas en el nombre sí es tres filas', () => {
    expect(
      clasificarFilas('santa fe dm 7pas ac 2.4 5p 4x2', 'jeep'),
    ).toBe('tres_filas');
  });

  it('nissan solo no nombra un modelo', () => {
    expect(textMentionsModel('Nissan', nissans[0].model)).toBe(false);
    expect(userNamedModel(['Nissan'], nissans)).toBe(false);
    expect(userNamedModel(['quiero la x trail'], nissans)).toBe(true);
  });

  it('si no hay Tucson primero lo dice y después ofrece otra', () => {
    const text = formatMissingNamedModel(
      'tucson',
      null,
      [
        {
          id: 'kona-1',
          brand: 'hyundai',
          model: 'kona gls ac 1.6',
          year: 2022,
          price: 21990,
          typeBody: 'jeep',
        },
      ],
      false,
    );
    expect(text.text).toMatch(/no tenemos Tucson/i);
    expect(text.text).toContain('kona');
    expect(text.sendId).toBe('kona-1');
  });

  it('si no hay i10 elige un hatch, no el Kona ni el Sportage rechazado', () => {
    const close = pickClosestToMissingModel(
      [
        {
          id: 'kona-1',
          brand: 'hyundai',
          model: 'kona gls ac 1.6',
          year: 2022,
          price: 21990,
          typeBody: 'jeep',
        },
        {
          id: 'sportage-1',
          brand: 'kia',
          model: 'sportage r gti',
          year: 2019,
          price: 22900,
          typeBody: 'jeep',
        },
        {
          id: 'picanto-1',
          brand: 'kia',
          model: 'picanto lx ac 1.2',
          year: 2023,
          price: 15990,
          typeBody: 'hatchback',
        },
      ],
      'i10',
      { inventoryId: 'sportage-1', family: 'sportage' },
    );
    expect(close.map((car) => car.id)).toEqual(['picanto-1']);
  });

  it('X-Trail no se nombra X-Trail TRAIL', () => {
    const named = formatNamedUnits(
      [
        {
          id: 'xtrail-1',
          brand: 'nissan',
          model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
          year: 2016,
          price: 16890,
          typeBody: 'jeep',
        },
      ],
      false,
    );
    expect(named.text).toMatch(/x-trail sense/i);
    expect(named.text).toMatch(/2016/);
    expect(named.text).not.toMatch(/X-Trail TRAIL/i);
    expect(named.text).toMatch(/sin plate_short/i);
  });

  it('Land Cruiser Prado pega con prado del inventario', () => {
    expect(
      textMentionsModel(
        'Me interesa el Toyota Land Cruiser Prado',
        'prado txl ac 2.7 5p 4x4 ta',
      ),
    ).toBe(true);
  });

  it('Río con tilde pega con rio del inventario', () => {
    expect(textMentionsModel('Río ?', 'rio lx ac 1.4 4p')).toBe(true);
    expect(textMentionsModel('Kia rio', 'rio lx ac 1.4 4p')).toBe(true);
  });

  it('4runner pega con 4 runner del inventario', () => {
    expect(
      textMentionsModel('Me interesa el Toyota 4runner', '4 runner 4x2 t/a'),
    ).toBe(true);
    expect(
      userNamedModel(
        ['Hola. Me interesa el Toyota 4runner'],
        [{ model: '4 runner 4x2 t/a' }],
      ),
    ).toBe(true);
  });

  it('la revisión lista las líneas y ofrece la x-trail sin cerrar', () => {
    const text = formatRevisionMarca({
      marca: 'nissan',
      cars: nissans,
      tresFilas: true,
      soloMarca: true,
    });
    expect(text).toContain('Sentra, Kicks, Frontier, X-Trail');
    expect(text).toContain('X-Trail 2016');
    expect(text).not.toContain('$');
    expect(text).toContain('No ofrezcas otra marca');
    expect(text).toContain('vehiculo null');
  });

  it('varias unidades del mismo modelo se nombran y una sola se manda', () => {
    const rangers: StockCar[] = [
      {
        id: 'r2026',
        brand: 'ford',
        model: 'ranger xlt ac 2.0 cd 4x4 ta diesel',
        year: 2026,
        price: 65990,
        typeBody: 'doble cabina',
        color: 'plomo',
      },
      {
        id: 'r2024',
        brand: 'ford',
        model: 'ranger xl ac 2.0 cd 4x2 tm diesel',
        year: 2024,
        price: 44590,
        typeBody: 'doble cabina',
        color: 'plomo',
        mileage: 11061,
      },
    ];
    const varias = formatNamedUnits(rangers, false);
    expect(varias.holdVehicle).toBe(true);
    expect(varias.sendId).toBeNull();
    expect(varias.text).toMatch(/ranger xlt/i);
    expect(varias.text).toMatch(/2026/);
    expect(varias.text).toMatch(/ranger xl/i);
    expect(varias.text).toMatch(/2024/);
    expect(varias.text).toContain('km=11061');
    expect(varias.text).toContain('cuál le interesa');
    expect(varias.text).not.toContain('$');

    const una = formatNamedUnits([rangers[0]], false);
    expect(una.sendId).toBe('r2026');
    expect(una.holdVehicle).toBe(false);

    const sinKm = formatNamedUnits(
      [{ ...rangers[1], mileage: 0 }],
      false,
    );
    expect(sinKm.text).toMatch(/aún no cargado/i);
    expect(sinKm.text).not.toMatch(/, 0 km/);
  });

  it('4p es puertas y no se pasa como transmisión', () => {
    const golf: StockCar = {
      id: 'golf-p8',
      brand: 'volkswagen',
      model: 'golf comfortline 4p',
      year: 2005,
      price: 9800,
      typeBody: 'hatchback',
      color: 'azul',
      mileage: 276968,
      transmission: '4p',
      plateShort: 'P8',
    };
    expect(unitCaja(golf)).toBeNull();
    expect(unitDoors(golf)).toBe(4);
    expect(unitDrive(golf)).toBeNull();
    const text = describeUnit(golf, false);
    expect(text).toContain('modelo=golf comfortline 4p');
    expect(text).toContain('caja=sin dato');
    expect(text).toContain('puertas=4');
    expect(text).toContain('plate_short=P8');
    expect(text).toContain('km=276968');
    expect(text).not.toMatch(/caja=4p/i);
    expect(text).toMatch(/NUNCA "transmisión 4p"/i);
  });

  it('tm/ta y 4x2 salen como caja y tracción, no como 4p', () => {
    const sentra: StockCar = {
      id: 'sentra-1',
      brand: 'nissan',
      model: 'sentra exclusive ac 1.8 4p 4x2 ta',
      year: 2014,
      price: 13800,
      typeBody: 'sedan',
      transmission: '4x2',
    };
    expect(unitCaja(sentra)).toBe('automática');
    expect(unitDoors(sentra)).toBe(4);
    expect(unitDrive(sentra)).toBe('4x2');
    const text = describeUnit(sentra, false);
    expect(text).toContain('caja=automática');
    expect(text).toContain('tracción=4x2');
    expect(text).toContain('puertas=4');
    expect(text).not.toMatch(/caja=4x2/i);
  });

  it('la lista del bot se recorta a las unidades que nombró, no a toda la línea', () => {
    const dmax2022: StockCar = {
      id: 'dmax-2022',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cd 4x4 tm diesel',
      year: 2022,
      price: 26900,
      typeBody: 'camioneta',
      color: 'vino',
      mileage: 87687,
    };
    const dmax2023: StockCar = {
      id: 'dmax-2023',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cd 4x2 tm diesel',
      year: 2023,
      price: 28900,
      typeBody: 'camioneta',
      color: 'plateado',
      mileage: 77613,
    };
    const luv2006: StockCar = {
      id: 'luv-2006',
      brand: 'chevrolet',
      model: 'luv d-max 4x4 tm',
      year: 2006,
      price: 8900,
      typeBody: 'camioneta',
      color: 'blanco',
    };
    const listing =
      'Estimado, tenemos disponible un Chevrolet D-Max 4x4 manual 2022 color vino con 87687 km, y una Chevrolet Luv D-Max 4x4 manual 2006 color blanco con el kilometraje todavía no cargado.';
    const shown = carsShownInText(listing, [dmax2022, dmax2023, luv2006]);
    expect(shown.map((car) => car.id)).toEqual(['dmax-2022', 'luv-2006']);
    expect(pickShownByYear(shown, listing, 2022).map((car) => car.id)).toEqual([
      'dmax-2022',
    ]);
    const later = carsShownInHistory(
      [
        { role: 'user', content: 'Tienen D-max 4x4?' },
        { role: 'assistant', content: listing },
        { role: 'user', content: 'ok' },
        {
          role: 'assistant',
          content: '¿Le interesa ver financiamiento o prefiere ir a verla?',
        },
      ],
      [dmax2022, dmax2023, luv2006],
      'Vehículo: D-Max 2022 vino y Luv 2006',
    );
    expect(later.map((car) => car.id)).toEqual(['dmax-2022', 'luv-2006']);
    expect(
      pickShownByYear(later, `${listing}\nVehículo: D-Max 2022 vino`, 2022).map(
        (car) => car.id,
      ),
    ).toEqual(['dmax-2022']);
  });

  it('si el patio sí tiene ese año no dice que no hay', () => {
    const missing = formatMissingNamedModel(
      'dmax',
      2022,
      [
        {
          id: 'dmax-2022',
          brand: 'chevrolet',
          model: 'd-max crdi 2.5 cd 4x4 tm diesel',
          year: 2022,
          price: 26900,
          typeBody: 'camioneta',
          color: 'vino',
          mileage: 87687,
        },
      ],
      false,
    );
    expect(missing.text).not.toMatch(/no tenemos|No hay/i);
    expect(missing.sendId).toBe('dmax-2022');
    expect(missing.text).toMatch(/d-max crdi/i);
  });
});
