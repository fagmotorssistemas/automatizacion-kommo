import { AnalysisLlmClient } from './analysis-llm.client';
import { AnalysisRepository } from './analysis.repository';
import { AnalysisService } from './analysis.service';

describe('AnalysisService', () => {
  const packet = {
    sessionId: '100',
    leadId: 7,
    etapaSql: 4,
    vehiculos: ['inv-1'],
    precioMax: 9800,
    segmentos: 3,
    cubiertoHasta: '2026-09-01T00:00:00Z',
    cerrar: true,
    resumenPrevio: null,
    transcript: '[cliente] Solo tienen auitomatico ?',
  };

  function service(overrides?: {
    claimed?: boolean;
    reading?: Record<string, unknown> | null;
  }) {
    const repository = {
      isReady: () => true,
      claimLock: jest.fn().mockResolvedValue(overrides?.claimed !== false),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      listBatch: jest.fn().mockResolvedValue(['100']),
      packet: jest.fn().mockResolvedValue(packet),
      save: jest.fn().mockResolvedValue(undefined),
      purgeAnalyzedChats: jest.fn().mockResolvedValue(0),
    };
    const llm = {
      isReady: () => true,
      read: jest.fn().mockResolvedValue(
        overrides && 'reading' in overrides
          ? overrides.reading
          : {
              objecionPrincipal: 'equipamiento',
              objecionTexto: 'Quiere manual',
              objecionEvidencia: 'Solo tienen auitomatico ?',
              agendoVisita: true,
              resumen: 'Pidió manual.\nSe apagó.',
              presupuestoDeclarado: null,
            },
      ),
    };

    return {
      repository,
      llm,
      run: new AnalysisService(
        repository as unknown as AnalysisRepository,
        llm as unknown as AnalysisLlmClient,
      ),
    };
  }

  it('no inserta si otro proceso tiene el candado', async () => {
    const { repository, run } = service({ claimed: false });
    const result = await run.runOnce(1, { purge: false });
    expect(result.claimed).toBe(false);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.releaseLock).not.toHaveBeenCalled();
  });

  it('guarda etapa 5 y suelta el candado', async () => {
    const { repository, run } = service();
    const result = await run.runOnce(1, { purge: false });
    expect(result).toMatchObject({ claimed: true, saved: 1, failed: 0, purged: 0 });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ etapaMax: 5, objecion: 'equipamiento' }),
    );
    expect(repository.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('si el modelo no lee, no inserta y el chat sigue', async () => {
    const { repository, run } = service({ reading: null });
    const result = await run.runOnce(1, { purge: false });
    expect(result.skipped).toBe(1);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('no guarda una cita del bot y usa el reintento del cliente', async () => {
    const { repository, llm, run } = service();
    llm.read
      .mockResolvedValueOnce({
        objecionPrincipal: 'precio',
        objecionTexto: 'Preguntó el precio',
        objecionEvidencia: '¿Le queda bien esta semana para pasarse al patio?',
        agendoVisita: false,
        resumen: 'Pidió precio.',
        presupuestoDeclarado: null,
      })
      .mockResolvedValueOnce({
        objecionPrincipal: 'no_responde',
        objecionTexto: 'Preguntó y no siguió',
        objecionEvidencia: 'Solo tienen auitomatico ?',
        agendoVisita: false,
        resumen: 'Preguntó transmisión.\nNo siguió.',
        presupuestoDeclarado: null,
      });

    const result = await run.runOnce(1, { purge: false });
    expect(result.saved).toBe(1);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ objecion: 'no_responde' }),
    );
  });
});
