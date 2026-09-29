import { appendNoPhotosNotice, stripUnsentPhotoClaim } from './no-photos-notice';

describe('appendNoPhotosNotice', () => {
  it('agrega el aviso una sola vez', () => {
    const once = appendNoPhotosNotice('Tenemos la Hilux.');
    expect(once).toContain('no tengo fotos');
    expect(appendNoPhotosNotice(once)).toBe(once);
  });

  it('quita “le envío también las fotos del interior” y deja un solo aviso', () => {
    const text = appendNoPhotosNotice(
      'Estimado, tenemos disponible un Kia Sportage SL AC 2.0 5p 4x2 manual año 2019 color blanco, con el kilometraje aún no cargado y transmisión manual. A continuación, le envío también las fotos del interior del vehículo. Por ahora no tengo fotos de este vehículo para enviarle. Si desea, le doy más detalles o coordinamos una visita.',
    );
    expect(text).not.toMatch(/le env[ií]o también las fotos/i);
    expect(text).not.toMatch(/fotos del interior/i);
    expect(text.match(/no tengo fotos de este vehículo/gi)).toHaveLength(1);
  });

  it('quita el "aquí tiene las fotos" si no hay fotos', () => {
    const text = appendNoPhotosNotice(
      'Estimado, tenemos disponible un Ford ranger XLT 2026 color plomo, con 0 km, transmisión automática y diesel. La placa es P8. Aquí tiene también las fotos del vehículo.',
    );
    expect(text).not.toMatch(/aqu[ií] tiene tambi[eé]n las fotos/i);
    expect(text).toContain('Ford ranger XLT 2026');
    expect(text).toContain('La placa es P8.');
    expect(text).toContain('no tengo fotos de este vehículo');
  });
});

describe('stripUnsentPhotoClaim', () => {
  it('quita la promesa de fotos y deja la ficha', () => {
    expect(
      stripUnsentPhotoClaim(
        'Estimado, tenemos disponible un Chevrolet Dmax CRDI 2.5 CD 4x4 manual diesel 2022 color vino, con 87687 km. Aquí tiene también las fotos del vehículo para que pueda verlo mejor.',
      ),
    ).toBe(
      'Estimado, tenemos disponible un Chevrolet Dmax CRDI 2.5 CD 4x4 manual diesel 2022 color vino, con 87687 km.',
    );
  });

  it('A76424 no se come la ficha si va pegada a las fotos', () => {
    const clean = stripUnsentPhotoClaim(
      'Buenas noches, estimado. Tenemos disponible una Chevrolet D-max crdi 2.5 cs 4x2 año 2020 color blanco, con 93787 km, transmisión manual y Aquí tiene también las fotos del vehículo.',
    );
    expect(clean).toMatch(/D-max/i);
    expect(clean).toMatch(/93787/);
    expect(clean).not.toMatch(/fotos/i);
    expect(clean).not.toBe('Buenas noches, estimado.');
  });

  it('42074953: la ficha del Montero no se va con “aquí tiene las fotos de…”', () => {
    const clean = stripUnsentPhotoClaim(
      'Buenas noches, estimado. Aquí tiene las fotos del Montero Sport GLS 2022 negro, 75.258 km.',
    );
    expect(clean).toMatch(/Montero Sport GLS 2022/i);
    expect(clean).toMatch(/75\.258 km/i);
    expect(clean).not.toMatch(/fotos/i);
    expect(clean).not.toBe('Buenas noches, estimado.');
  });

  it('42074953: varios Monteros, la lista no se recorta con el saludo', () => {
    const clean = stripUnsentPhotoClaim(
      'Buenas noches, estimado. Aquí tiene las fotos de los Monteros: Montero Sport GLS 2022 negro, 75.258 km, y Montero 2016 plomo.',
    );
    expect(clean).toMatch(/Montero Sport GLS 2022/i);
    expect(clean).toMatch(/75\.258 km/i);
    expect(clean).toMatch(/Montero 2016/i);
    expect(clean).not.toMatch(/fotos/i);
    expect(clean).not.toBe('Buenas noches, estimado.');
  });
});
