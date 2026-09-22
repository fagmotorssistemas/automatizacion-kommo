import { cancelReasonForFollowup } from './should-cancel-followup';

describe('cancelReasonForFollowup', () => {
  const base = {
    retoma: 1 as const,
    seguimiento: 'activo' as const,
    etapaMax: 3,
    objecionPrincipal: null as string | null,
    stop: false,
    botApagado: false,
    lastHumanAt: null as Date | null,
    scheduledAt: new Date('2026-09-20T12:00:00Z'),
  };

  it('cancela si el cliente escribió después', () => {
    expect(
      cancelReasonForFollowup({
        ...base,
        lastHumanAt: new Date('2026-09-20T13:00:00Z'),
      }),
    ).toBe('cliente_escribio');
  });

  it('cancela en etapa 6+', () => {
    expect(cancelReasonForFollowup({ ...base, etapaMax: 6 })).toBe(
      'etapa_visita',
    );
  });

  it('cancela si ya compró', () => {
    expect(
      cancelReasonForFollowup({ ...base, objecionPrincipal: 'ya_compro' }),
    ).toBe('objecion_ya_compro');
  });

  it('deja pasar si no hay motivo', () => {
    expect(cancelReasonForFollowup(base)).toBeNull();
  });
});
