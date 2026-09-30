import { extraerNumeros, validarNumeros } from './validar-numeros';

const ROJO_ID = '0fde055a-a72d-4f70-8210-37a404385462';
const VITARA_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const rojo = {
  id: ROJO_ID,
  label: 'kia Sportage 2019 rojo',
  km: 91096,
  precio: 22900,
};

const sportage = {
  id: ROJO_ID,
  label: 'kia Sportage 2024',
  km: 79187,
  precio: 22900,
};

const vitara = {
  id: VITARA_ID,
  label: 'Suzuki Grand Vitara 2015',
  km: 207051,
  precio: 13800,
};

describe('casos reales de producción', () => {
  it('a) cuota aproximada no es precio', () => {
    const texto =
      'la cuota aproximada para el Suzuki Grand Vitara SZ Next AC 2.0 5p 4x2 2015 es $254.62';
    expect(extraerNumeros(texto).some((num) => num.tipo === 'precio')).toBe(
      false,
    );
    expect(validarNumeros(texto, [vitara], VITARA_ID).texto).toBe(texto);
  });

  it('b) 2024 no es km si hay otro número más cerca de km', () => {
    const texto = 'Este Kia Sportage 2024 tiene 79,187 km';
    const kms = extraerNumeros(texto).filter((num) => num.tipo === 'km');
    expect(kms.some((num) => num.valor === 2024)).toBe(false);
    expect(kms.map((num) => num.valor)).toEqual([79187]);
    expect(validarNumeros(texto, [sportage], ROJO_ID).texto).toBe(texto);
  });

  it('c) presupuesto hasta $15.000 dicho por el cliente es válido', () => {
    const texto = 'Con un presupuesto hasta $15.000 y caja manual';
    const ctx = {
      history: [
        { role: 'user' as const, content: 'Máximo de 15.000 dólares' },
      ],
    };
    expect(extraerNumeros(texto).some((num) => num.tipo === 'precio')).toBe(
      false,
    );
    expect(validarNumeros(texto, [rojo], ROJO_ID, ctx).texto).toBe(texto);
  });

  it('d) 3 puertas no es km y no se rompe la frase', () => {
    const texto =
      'motor 1.6, caja automática, 3 puertas, precio $21,900';
    expect(
      extraerNumeros(texto).some(
        (num) => num.tipo === 'km' && num.valor === 3,
      ),
    ).toBe(false);
    const unidad = { ...rojo, precio: 21900 };
    const result = validarNumeros(texto, [unidad], ROJO_ID);
    expect(result.texto).toBe(texto);
    expect(result.texto).toContain('3 puertas');
    expect(result.texto).toContain('motor 1.6');
  });
});
