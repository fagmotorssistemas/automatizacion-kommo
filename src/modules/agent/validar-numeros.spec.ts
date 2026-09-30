import {
  extraerNumeros,
  formatNumerosLog,
  intentarCargarHechos,
  validarNumeros,
  validarNumerosSoloRegistro,
} from './validar-numeros';

const ROJO_ID = '0fde055a-a72d-4f70-8210-37a404385462';
const PLATEADO_ID = 'f690857b-48e8-4ee4-92ff-a89e2d43c622';

const rojo = {
  id: ROJO_ID,
  label: 'kia Sportage 2019 rojo',
  km: 91096,
  precio: 22900,
};

const plateado = {
  id: PLATEADO_ID,
  label: 'kia Sportage 2019 plateado',
  km: 113170,
  precio: 22900,
};

describe('validarNumeros', () => {
  it('con 33900 km y meta = rojo (91096) → con 91.096 km', () => {
    expect(validarNumeros('con 33900 km', [rojo], ROJO_ID)).toEqual({
      texto: 'con 91.096 km',
      correcciones: [
        { tipo: 'km', dijo: 33900, correcto: 91096, id: ROJO_ID },
      ],
      requiereRegenerar: false,
    });
  });

  it('120000 km aproximados y meta = rojo → 91.096 km, sin aproximados', () => {
    expect(validarNumeros('120000 km aproximados', [rojo], ROJO_ID)).toEqual({
      texto: '91.096 km',
      correcciones: [
        { tipo: 'km', dijo: 120000, correcto: 91096, id: ROJO_ID },
      ],
      requiereRegenerar: false,
    });
  });

  it('91,096 km con meta = rojo → válido, sin cambios', () => {
    expect(validarNumeros('91,096 km', [rojo], ROJO_ID)).toEqual({
      texto: '91,096 km',
      correcciones: [],
      requiereRegenerar: false,
    });
  });

  it('lista con dos unidades y ambos km correctos → sin cambios', () => {
    const texto =
      'rojo con 91.096 km y plateado con 113.170 km';
    expect(validarNumeros(texto, [rojo, plateado], null)).toEqual({
      texto,
      correcciones: [],
      requiereRegenerar: false,
    });
  });

  it('lista con dos unidades, dice 80000 km, sin meta → requiereRegenerar', () => {
    expect(validarNumeros('con 80000 km', [rojo, plateado], null)).toEqual({
      texto: 'con 80000 km',
      correcciones: [],
      requiereRegenerar: true,
    });
  });

  it('cuota de $520.81 y entrada de $13,740 → no se tocan', () => {
    const texto = 'cuota de $520.81 y entrada de $13,740';
    expect(extraerNumeros(texto)).toEqual([]);
    expect(validarNumeros(texto, [rojo], ROJO_ID)).toEqual({
      texto,
      correcciones: [],
      requiereRegenerar: false,
    });
  });

  it('precio de $22,900 con meta de precio 22900 → válido', () => {
    expect(validarNumeros('precio de $22,900', [rojo], ROJO_ID)).toEqual({
      texto: 'precio de $22,900',
      correcciones: [],
      requiereRegenerar: false,
    });
  });

  it('precio de $26,990 con meta de precio 24500 → $24,500', () => {
    const barato = { ...rojo, precio: 24500 };
    expect(validarNumeros('precio de $26,990', [barato], ROJO_ID)).toEqual({
      texto: 'precio de $24,500',
      correcciones: [
        { tipo: 'precio', dijo: 26990, correcto: 24500, id: ROJO_ID },
      ],
      requiereRegenerar: false,
    });
  });

  it('respuesta sin números → sin cambios, revisados=0', () => {
    const texto = '¿Qué carro le interesa?';
    expect(extraerNumeros(texto)).toHaveLength(0);
    expect(validarNumeros(texto, [rojo], ROJO_ID)).toEqual({
      texto,
      correcciones: [],
      requiereRegenerar: false,
    });
    expect(
      formatNumerosLog({
        contactId: '1',
        revisados: 0,
        invalidos: 0,
        corregidos: 0,
        regenerado: false,
        detalle: [],
      }),
    ).toContain('revisados=0');
  });

  it('error al consultar la base → texto original y el log registra el error', async () => {
    const texto = 'con 33900 km';
    const carga = await intentarCargarHechos(async () => {
      throw new Error('GET inventoryoracle: timeout');
    });
    expect(carga.hechos).toEqual([]);
    expect(carga.error).toBe('GET inventoryoracle: timeout');
    expect(validarNumeros(texto, carga.hechos, ROJO_ID).texto).toBe(texto);
    expect(
      formatNumerosLog({
        contactId: '55040143',
        revisados: extraerNumeros(texto).length,
        invalidos: 0,
        corregidos: 0,
        regenerado: false,
        detalle: [],
        error: carga.error,
      }),
    ).toContain('error=GET inventoryoracle: timeout');
  });

  it('solo registro: detecta el km inválido, no cambia el texto, aplicado:false', () => {
    const texto = 'con 33900 km';
    const result = validarNumerosSoloRegistro(texto, [rojo], ROJO_ID);
    expect(result.texto).toBe(texto);
    expect(result.requiereRegenerar).toBe(false);
    expect(result.correcciones).toEqual([
      {
        tipo: 'km',
        dijo: 33900,
        correcto: 91096,
        id: ROJO_ID,
        aplicado: false,
      },
    ]);
    expect(
      formatNumerosLog({
        contactId: '1',
        revisados: extraerNumeros(texto).length,
        invalidos: 1,
        corregidos: 1,
        regenerado: false,
        aplicado: false,
        detalle: result.correcciones,
      }),
    ).toContain('aplicado=false');
  });
});
