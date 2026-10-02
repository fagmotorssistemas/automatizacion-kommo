import {
  FRASE_PRECIO_PENDIENTE,
  asignarClavesPrecio,
  cerrarMarcadores,
  detectarPrecioCrudo,
  etiquetaPrecioFicha,
  formatPrecioUsd,
  lexicalizarPrecio,
  marcarPreciosEnToolJson,
  unirPrecioClaves,
} from './precio-marcador';

describe('precio-marcador', () => {
  const claves = asignarClavesPrecio([
    { id: 'a', price: 22990 },
    { id: 'b', price: 0 },
  ]);

  it('asigna u1, u2 y reusa el id', () => {
    expect(claves).toEqual([
      { clave: 'u1', inventoryId: 'a', price: 22990 },
      { clave: 'u2', inventoryId: 'b', price: null },
    ]);
    expect(
      asignarClavesPrecio(
        [
          { id: 'a', price: 1 },
          { id: 'a', price: 2 },
        ],
        3,
      ),
    ).toEqual([{ clave: 'u3', inventoryId: 'a', price: 1 }]);
  });

  it('la ficha muestra el marcador y el $ solo como pista', () => {
    expect(etiquetaPrecioFicha('u1', 22990)).toBe(
      'precio={{precio:u1}} ($22990)',
    );
    expect(etiquetaPrecioFicha('u2', 0)).toBe(
      'precio={{precio:u2}} (aún no cargado)',
    );
  });

  it('lexicaliza el marcador con el $ de patio o la frase pendiente', () => {
    expect(formatPrecioUsd(22990)).toBe('$22,990');
    expect(lexicalizarPrecio('El valor es {{precio:u1}}.', claves)).toBe(
      'El valor es $22,990.',
    );
    expect(lexicalizarPrecio('El valor es {{precio:u2}}.', claves)).toBe(
      `El valor es ${FRASE_PRECIO_PENDIENTE}.`,
    );
    expect(lexicalizarPrecio('{{ precio:U1 }}', claves)).toBe('$22,990');
  });

  it('nunca deja {{ al cliente', () => {
    expect(cerrarMarcadores('listo {{otro}} y {{')).toBe(
      `listo ${FRASE_PRECIO_PENDIENTE} y `,
    );
  });

  it('detecta un monto de contado escrito a mano y deja la cuota', () => {
    expect(
      detectarPrecioCrudo('El Hilux queda en $22,990.', 'hilux'),
    ).toEqual({ dijo: '$22,990', unidad: 'hilux' });
    expect(
      detectarPrecioCrudo('La cuota es $450 al mes.', 'hilux'),
    ).toBeNull();
  });

  it('el JSON de la tool cambia price por el marcador', () => {
    const marked = marcarPreciosEnToolJson(
      JSON.stringify([
        { id: 'a', price: 22990, model: 'creta' },
        { id: 'b', price: 0, model: 'hunter' },
      ]),
    );
    const rows = JSON.parse(marked.json) as Array<Record<string, unknown>>;
    expect(rows[0].precio).toBe('precio={{precio:u1}} ($22990)');
    expect(rows[0].price).toBeUndefined();
    expect(rows[1].precio).toBe('precio={{precio:u2}} (aún no cargado)');
    expect(marked.claves).toHaveLength(2);
    const reuse = marcarPreciosEnToolJson(
      JSON.stringify([{ id: 'c', price: 10000 }]),
      marked.claves,
    );
    expect(JSON.parse(reuse.json)[0].precio).toBe(
      'precio={{precio:u3}} ($10000)',
    );
    expect(unirPrecioClaves(marked.claves, reuse.claves)).toHaveLength(3);
  });
});
