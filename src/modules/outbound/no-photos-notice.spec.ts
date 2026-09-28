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
});
