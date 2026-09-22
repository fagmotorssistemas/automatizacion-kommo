import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ANALYSIS_BATCH_LIMIT,
  DEDUP_WINDOW_MINUTES,
} from './analysis.constants';
import { AnalysisLlmClient } from './analysis-llm.client';
import { AnalysisRepository } from './analysis.repository';
import { etapaParaGuardar } from './conversation-lifecycle';
import { evidenciaEsDelCliente } from './evidencia-del-cliente';
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
      const result = await this.analyzeSessions(sessions, options.purge !== false);
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
        const saved = await this.analyzeSession(sessionId);
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

  private async analyzeSession(sessionId: string): Promise<boolean> {
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

    await this.repository.save({
      sessionId: packet.sessionId,
      leadId: Number.isFinite(packet.leadId) ? packet.leadId : null,
      etapaMax: etapaParaGuardar(packet.etapaSql, reading.agendoVisita),
      vehiculos: packet.vehiculos,
      precioMax: Number.isFinite(packet.precioMax) ? packet.precioMax : null,
      objecion: reading.objecionPrincipal,
      objecionTexto: reading.objecionTexto,
      objecionEvidencia: reading.objecionEvidencia,
      resumen: reading.resumen,
      presupuesto: reading.presupuestoDeclarado,
      analizadoHasta: packet.cubiertoHasta,
      cerrada: packet.cerrar,
    });
    return true;
  }

  private async leerConCita(transcript: string): Promise<ConversationReading | null> {
    const first = await this.llm.read(transcript);
    if (first && evidenciaEsDelCliente(transcript, first.objecionEvidencia)) {
      return first;
    }

    const retry = await this.llm.read(
      `${transcript}\n\nCorrige: objecion_evidencia tiene que ser una frase copiada de una línea [cliente]. Preguntar precio, entrada o km no es objeción.`,
    );
    if (retry && evidenciaEsDelCliente(transcript, retry.objecionEvidencia)) {
      return retry;
    }
    return null;
  }
}
