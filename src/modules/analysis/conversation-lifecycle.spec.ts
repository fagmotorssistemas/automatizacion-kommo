import { conversationLifecycle, etapaParaGuardar } from './conversation-lifecycle';

describe('conversationLifecycle', () => {
  const now = new Date('2026-09-21T20:00:00Z');

  it('menos de 2 horas queda abierta', () => {
    expect(conversationLifecycle(new Date('2026-09-21T18:30:00Z'), now)).toBe(
      'abierta',
    );
  });

  it('entre 2 horas y 7 días queda en reposo', () => {
    expect(conversationLifecycle(new Date('2026-09-20T20:00:00Z'), now)).toBe(
      'en_reposo',
    );
  });

  it('7 días o más queda cerrada', () => {
    expect(conversationLifecycle(new Date('2026-09-14T20:00:00Z'), now)).toBe(
      'cerrada',
    );
  });
});

describe('etapaParaGuardar', () => {
  it('sube a 5 si agendó visita', () => {
    expect(etapaParaGuardar(4, true)).toBe(5);
  });

  it('se queda en la etapa SQL si no agendó', () => {
    expect(etapaParaGuardar(3, false)).toBe(3);
  });

  it('no baja un 6 de patio', () => {
    expect(etapaParaGuardar(6, true)).toBe(6);
  });

  it('sin conversar no agenda', () => {
    expect(etapaParaGuardar(1, true)).toBe(1);
  });
});
