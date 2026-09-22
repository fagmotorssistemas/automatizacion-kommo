import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FollowupService } from '../followup/followup.service';
import {
  ANALYSIS_BATCH_LIMIT,
  DEDUP_WINDOW_MINUTES,
} from './analysis.constants';
import { AnalysisLlmClient } from './analysis-llm.client';
import { AnalysisRepository } from './analysis.repository';
import { etapaParaGuardar } from './conversation-lifecycle';
import { evidenciaEsDelCliente } from './evidencia-del-cliente';
import { objecionParaGuardar } from './objecion';
import { ConversationReading } from './parse-analysis';

export type AnalysisRunResult = {
  claimed: boolean;
  examined: number;
  saved: number;
  skipped: number;
  failed: number;
  purged: number;
};

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private running = false;

  constructor(
    private readonly repository: AnalysisRepository,
    private readonly llm: AnalysisLlmClient,
    private readonly followup: FollowupService,
  ) {}

  async runOnce(
    limit = ANALYSIS_BATCH_LIMIT,
    options: { purge?: boolean } = {},
  ): Promise<AnalysisRunResult> {
    const empty: AnalysisRunResult = {
      claimed: false,
      examined: 0,
      saved: 0,
      skipped: 0,
      failed: 0,
      purged: 0,
    };

    if (this.running) {
      return empty;
    }
    if (!this.repository.isReady() || !this.llm.isReady()) {
      this.logger.warn('Análisis omitido: falta Supabase u OpenAI');
      return empty;
    }

    this.running = true;
    const owner = randomUUID();
    let claimed = false;
    try {
      claimed = await this.repository.claimLock(owner);
      if (!claimed) {
        this.logger.log('Otro proceso ya tiene el análisis');
        return empty;
      }

      const sessions = await this.repository.listBatch(limit);
      const result = await this.analyzeSessions(
        sessions,
        options.purge !== false,
      );
      return { ...result, claimed: true };
    } finally {
      if (claimed) {
        try {
          await this.repository.releaseLock(owner);
        } catch (error) {
          this.logger.error(
            `No se soltó el candado: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
      this.running = false;
    }
  }

  /** Vuelve a leer sesiones ya guardadas. El lote normal no las toca. */
  async reanalyze(
    sessionIds: string[],
    options: { purge?: boolean } = {},
  ): Promise<AnalysisRunResult> {
    const empty: AnalysisRunResult = {
      claimed: false,
      examined: 0,
      saved: 0,
      skipped: 0,
      failed: 0,
      purged: 0,
    };

    if (this.running || sessionIds.length === 0) {
      return empty;
    }
    if (!this.repository.isReady() || !this.llm.isReady()) {
      this.logger.warn('Análisis omitido: falta Supabase u OpenAI');
      return empty;
    }

    this.running = true;
    const owner = randomUUID();
    let claimed = false;
    try {
      claimed = await this.repository.claimLock(owner);
      if (!claimed) {
        this.logger.log('Otro proceso ya tiene el análisis');
        return empty;
      }
      const result = await this.analyzeSessions(
        sessionIds,
        options.purge === true,
        true,
      );
      return { ...result, claimed: true };
    } finally {
      if (claimed) {
        try {
          await this.repository.releaseLock(owner);
        } catch (error) {
          this.logger.error(
            `No se soltó el candado: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
      this.running = false;
    }
  }

  private async analyzeSessions(
    sessions: string[],
    purge: boolean,
    replay = false,
  ): Promise<AnalysisRunResult> {
    const result: AnalysisRunResult = {
      claimed: true,
      examined: 0,
      saved: 0,
      skipped: 0,
      failed: 0,
      purged: 0,
    };

    for (const sessionId of sessions) {
      result.examined += 1;
      try {
        const saved = await this.analyzeSession(sessionId, replay);
        if (saved) {
          result.saved += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.failed += 1;
        this.logger.error(
          `Sesión ${sessionId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (purge) {
      result.purged = await this.repository.purgeAnalyzedChats();
    }

    this.logger.log(
      `Análisis examined=${result.examined} saved=${result.saved} skipped=${result.skipped} failed=${result.failed} purged=${result.purged}`,
    );
    return result;
  }

  private async analyzeSession(
    sessionId: string,
    replay = false,
  ): Promise<boolean> {
    if (replay) {
      await this.repository.clearAnalizadoHasta(sessionId);
    }
    const packet = await this.repository.packet(
      sessionId,
      DEDUP_WINDOW_MINUTES,
    );
    if (!packet?.transcript.trim() || !packet.cubiertoHasta) {
      return false;
    }

    const reading = await this.leerConCita(packet.transcript);
    if (!reading) {
      return false;
    }

    const etapaMax = etapaParaGuardar(packet.etapaSql, reading.agendoVisita);
    const objecion = objecionParaGuardar(
      reading.objecionPrincipal,
      etapaMax,
      reading.objecionTexto,
      reading.agendoVisita,
    );

    await this.repository.save({
      sessionId: packet.sessionId,
      leadId: Number.isFinite(packet.leadId) ? packet.leadId : null,
      etapaMax,
      vehiculos: packet.vehiculos,
      precioMax: Number.isFinite(packet.precioMax) ? packet.precioMax : null,
      objecion: objecion.objecion,
      objecionTexto: objecion.texto,
      objecionEvidencia: reading.objecionEvidencia,
      resumen: reading.resumen,
      presupuesto: reading.presupuestoDeclarado,
      presupuestoMonto: reading.presupuestoMonto,
      entradaDisponible: reading.entradaDisponible,
      formaPago: reading.formaPago,
      analizadoHasta: packet.cubiertoHasta,
      cerrada: packet.cerrar,
      seguimiento: reading.seguimiento,
    });

    try {
      await this.followup.scheduleAfterAnalysis({
        sessionId: packet.sessionId,
        leadId: Number.isFinite(packet.leadId) ? packet.leadId : null,
        lastMessageAt: new Date(packet.cubiertoHasta),
        seguimiento: reading.seguimiento,
        cerrada: packet.cerrar,
      });
    } catch (error) {
      this.logger.warn(
        `No se programó followup ${packet.sessionId}: ${error instanceof Error ? error.message : error}`,
      );
    }

    return true;
  }

  private async leerConCita(transcript: string): Promise<ConversationReading | null> {
    const first = await this.llm.read(transcript);
    if (first && lecturaSostenida(transcript, first)) {
      return first;
    }

    const retry = await this.llm.read(
      `${transcript}\n\nCorrige: objecion_evidencia tiene que ser una frase copiada de una línea [cliente], sin {llaves} del anuncio. Preguntar precio, entrada o km no es objeción. Si no objetó, objecion_principal es null.`,
    );
    if (retry && lecturaSostenida(transcript, retry)) {
      return retry;
    }
    return null;
  }
}

function lecturaSostenida(
  transcript: string,
  reading: ConversationReading,
): boolean {
  if (!reading.objecionPrincipal) {
    return true;
  }
  return evidenciaEsDelCliente(transcript, reading.objecionEvidencia);
}
