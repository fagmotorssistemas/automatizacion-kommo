import {
  clasificarFilas,
  formatMissingNamedModel,
  formatNamedUnits,
  formatRevisionMarca,
  textMentionsModel,
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
      },
    ];
    const varias = formatNamedUnits(rangers, false);
    expect(varias.holdVehicle).toBe(true);
    expect(varias.sendId).toBeNull();
    expect(varias.text).toContain('Ranger XLT 2026');
    expect(varias.text).toContain('Ranger XL 2024');
    expect(varias.text).toContain('cuál le interesa');
    expect(varias.text).not.toContain('$');

    const una = formatNamedUnits([rangers[0]], false);
    expect(una.sendId).toBe('r2026');
    expect(una.holdVehicle).toBe(false);
  });
});
