import { evidenciaEsDelCliente } from './evidencia-del-cliente';

const transcript = [
  '[cliente] Precio por favor',
  '[bot] La Hilux 2023 está en $32000. ¿Le queda bien esta semana para pasarse al patio?',
].join('\n');

describe('evidenciaEsDelCliente', () => {
  it('acepta una cita literal del cliente', () => {
    expect(evidenciaEsDelCliente(transcript, 'Precio por favor')).toBe(true);
  });

  it('rechaza una frase del bot', () => {
    expect(
      evidenciaEsDelCliente(
        transcript,
        '¿Le queda bien esta semana para pasarse al patio?',
      ),
    ).toBe(false);
  });

  it('rechaza un parafraseo que el cliente no dijo', () => {
    expect(evidenciaEsDelCliente(transcript, 'solicita información de precio')).toBe(
      false,
    );
  });

  it('rechaza la plantilla del anuncio aunque esté en una línea del cliente', () => {
    const conPlantilla = [
      '[cliente] Precio por favor {K-SI Nuevos.}',
      '[bot] La Hilux 2023 está en $32000.',
    ].join('\n');
    expect(
      evidenciaEsDelCliente(conPlantilla, 'Precio por favor {K-SI Nuevos.}'),
    ).toBe(false);
  });
});
