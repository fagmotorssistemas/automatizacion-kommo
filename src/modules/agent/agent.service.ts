import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { ConversationService } from '../conversation/conversation.service';
import { getDealershipClock } from '../intelligence/dealership-hours';
import { formatVisitHourHint } from '../intelligence/visit-hours';
import {
  calcularFinanciamiento,
  calcularFinanciamientoBancario,
  FinanciamientoInput,
} from '../intelligence/financiamiento';
import {
  assembleDynamicContext,
  parseIntentsPayload,
  promptNamesFromIntents,
} from './assemble-dynamic-context';
import { OpenAiAgentClient } from './openai-agent.client';
import {
  AgentTurnResult,
  parseAgentOutput,
  serializeAgentTurn,
} from './parse-agent-output';
import { formatHandoffTurnsForSummarizer } from '../persistence/format-handoff-turns';
import { PersistenceService } from '../persistence/persistence.service';
import { isUuid } from '../persistence/is-uuid';
import { buildResumenInput } from '../conversation/build-resumen-input';
import { isRealCustomerText } from '../conversation/is-real-customer-text';
import { INTENTS_SYSTEM_PROMPT } from './prompts/intents.prompt';
import { HANDOFF_SUMMARIZER_SYSTEM_PROMPT } from './prompts/handoff-summarizer.prompt';
import { RESUMEN_SYSTEM_PROMPT } from './prompts/resumen.prompt';
import { salesSystemPrompt } from './prompts/sales.prompt';
import {
  formatPedidoVigente,
  parseVehicleKind,
  resolveVehicleKind,
  VehicleKind,
} from '../conversation/vehicle-kind';
import { detectBrand, resolveBrand } from '../conversation/vehicle-brand';
import { isConcreteAsk, resolveConcreteAsk } from '../conversation/concrete-ask';
import { asksForPrice } from '../conversation/asks-for-price';
import {
  messageLeaksPrice,
  stripUnsolicitedPriceAndPlate,
} from '../conversation/strip-unsolicited-price';
import { isPoliteThanks, SEGUIR_VENTA } from '../conversation/polite-thanks';
import {
  formatInterestedCar,
  refersToInterestedCar,
} from '../conversation/interested-car';
import {
  formatRevisionMarca,
  StockCar,
  textMentionsModel,
  userNamedModel,
} from '../catalog/clasificar-filas';
import {
  carsForReview,
  COMPLIANCE_SYSTEM_PROMPT,
  formatComplianceForAgent,
  idsToOffer,
  parseComplianceReview,
  vehicleToSend,
} from '../catalog/revisar-cumplimiento';

function namedOfferId(
  cars: StockCar[],
  offer: string[],
  userTexts: string[],
): string | null {
  const named = cars.filter(
    (car) =>
      offer.includes(car.id) &&
      userTexts.some((text) => textMentionsModel(text, car.model)),
  );
  return named.length === 1 ? named[0].id : null;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly openai: OpenAiAgentClient,
    private readonly catalog: CatalogService,
    private readonly conversation: ConversationService,
    private readonly persistence: PersistenceService,
  ) {}

  async handleTurn(input: {
    contactId: string;
    customerText: string;
  }): Promise<AgentTurnResult | null> {
    if (!isRealCustomerText(input.customerText)) {
      return null;
    }

    if (!this.openai.isReady()) {
      throw new Error('OPENAI_API_KEY vacío; no se llama al modelo');
    }

    const history = await this.recentDialogue(input.contactId);
    const vehicleKind = await this.rememberVehicleKind(
      input.contactId,
      history,
      input.customerText,
    );
    const brand = await this.rememberBrand(
      input.contactId,
      history,
      input.customerText,
    );
    const concreteAsk = await this.rememberConcreteAsk(
      input.contactId,
      history,
      input.customerText,
    );
    const showPrice = asksForPrice(input.customerText);
    const revision = await this.reviewBrand(
      history,
      input.customerText,
      brand,
      concreteAsk,
      showPrice,
    );
    const handoffBrief = await this.attachHandoffBrief(
      input.contactId,
      history,
    );
    await this.conversation.appendMessage(input.contactId, {
      role: 'user',
      content: input.customerText,
    });

    const resumenInput = buildResumenInput({
      history,
      customerText: input.customerText,
      handoffBrief,
    });
    const resumen =
      (await this.openai.complete(RESUMEN_SYSTEM_PROMPT, resumenInput)) ??
      input.customerText;

    const intentsRaw =
      (await this.openai.complete(INTENTS_SYSTEM_PROMPT, resumen)) ?? '{}';
    const promptNames = promptNamesFromIntents(parseIntentsPayload(intentsRaw));
    const sections = await this.catalog.fetchAgentPrompts(promptNames);
    const interested = await this.persistence.latestInterestedCar(
      input.contactId,
    );
    const interestedText =
      interested && refersToInterestedCar(input.customerText, interested)
        ? formatInterestedCar(interested, showPrice)
        : '';
    const pedidoVigente = [
      formatPedidoVigente(vehicleKind),
      revision.text,
      interestedText,
      isPoliteThanks(input.customerText) ? SEGUIR_VENTA : '',
      formatVisitHourHint(input.customerText),
      showPrice
        ? ''
        : 'EN ESTE TURNO el cliente NO pidió el precio: prohibido decir el valor del carro ($…, precio de…). Sí puedes decir plate_short (ej. "La placa es P7"). Prohibido placa completa y chasis.',
    ]
      .filter(Boolean)
      .join('\n\n');
    const system = salesSystemPrompt(
      getDealershipClock(),
      assembleDynamicContext(sections),
      pedidoVigente,
    );

    const raw = await this.openai.runSalesAgent({
      system,
      user: pedidoVigente ? `${resumen}\n\n${pedidoVigente}` : resumen,
      history,
      executeTool: (name, argsJson) =>
        this.executeTool(name, argsJson, vehicleKind, brand, showPrice),
    });

    if (!raw) {
      throw new Error('El agente de ventas no devolvió texto');
    }

    const parsed = parseAgentOutput(raw);
    if (revision.sendId) {
      parsed.meta.vehiculo = {
        ...(parsed.meta.vehiculo ?? {}),
        inventory_id: revision.sendId,
      };
      parsed.img_prefix = '';
    } else if (revision.holdVehicle) {
      parsed.meta.vehiculo = null;
      parsed.img_prefix = '';
    } else {
      // Sin carro confirmado por inventario: no dejar ids inventados ni img_prefix para fotos.
      const claimed = parsed.meta.vehiculo?.inventory_id;
      if (claimed && !isUuid(claimed)) {
        const precio = parsed.meta.vehiculo?.precio;
        parsed.meta.vehiculo =
          precio && precio > 0 ? { precio } : null;
      }
      parsed.img_prefix = '';
    }
    if (
      interested &&
      parsed.meta.vehiculo?.inventory_id === interested.inventoryId &&
      interested.price &&
      interested.price > 0 &&
      !parsed.meta.vehiculo.precio
    ) {
      parsed.meta.vehiculo.precio = Math.round(interested.price);
    }

    if (!showPrice && parsed.mensaje) {
      const cleaned = stripUnsolicitedPriceAndPlate(parsed.mensaje);
      if (cleaned !== parsed.mensaje || messageLeaksPrice(parsed.mensaje)) {
        this.logger.warn(
          `Se quitó precio no pedido contactId=${input.contactId}`,
        );
      }
      parsed.mensaje = cleaned;
      parsed.meta.precioMostrado = false;
    }

    if (parsed.mensaje) {
      await this.conversation.appendMessage(input.contactId, {
        role: 'assistant',
        content: parsed.mensaje,
      });
    }

    await this.persistence.appendChatHistory({
      contactId: input.contactId,
      human: input.customerText,
      ai: serializeAgentTurn(parsed),
    });

    this.logger.log(
      `Agente listo contactId=${input.contactId} inventory=${parsed.meta.vehiculo?.inventory_id ?? 'ninguno'}`,
    );

    return { reply: parsed, resumen };
  }

  private async recentDialogue(contactId: string) {
    const live = await this.conversation.recentMessages(contactId);
    if (live.length > 0) {
      return live;
    }
    return this.persistence.loadRecentChat(contactId);
  }

  private async rememberVehicleKind(
    contactId: string,
    history: { role: string; content: string }[],
    customerText: string,
  ): Promise<VehicleKind | null> {
    const remembered = await this.conversation.loadVehicleKind(contactId);
    const kind = resolveVehicleKind({ history, customerText, remembered });
    if (kind) {
      await this.conversation.saveVehicleKind(contactId, kind);
    }
    return kind;
  }

  private async rememberBrand(
    contactId: string,
    history: { role: string; content: string }[],
    customerText: string,
  ): Promise<string | null> {
    const remembered = await this.conversation.loadVehicleBrand(contactId);
    const brand = resolveBrand({ history, customerText, remembered });
    if (brand) {
      await this.conversation.saveVehicleBrand(contactId, brand);
    }
    return brand;
  }

  private async rememberConcreteAsk(
    contactId: string,
    history: { role: string; content: string }[],
    customerText: string,
  ): Promise<string | null> {
    const remembered = await this.conversation.loadConcreteAsk(contactId);
    const ask = resolveConcreteAsk({ history, customerText, remembered });
    if (ask) {
      await this.conversation.saveConcreteAsk(contactId, ask);
    }
    return ask;
  }

  private async reviewBrand(
    history: { role: string; content: string }[],
    customerText: string,
    brand: string | null,
    concreteAsk: string | null,
    includePrice: boolean,
  ): Promise<{ text: string; holdVehicle: boolean; sendId: string | null }> {
    const empty = { text: '', holdVehicle: false, sendId: null };
    if (!brand) {
      return empty;
    }

    const asksNow =
      isConcreteAsk(customerText) ||
      (Boolean(concreteAsk) && Boolean(detectBrand(customerText)));
    const namesBrandNow = Boolean(detectBrand(customerText));
    if (!asksNow && !namesBrandNow) {
      return empty;
    }

    const cars = await this.catalog.listByBrand(brand);
    if (cars.length === 0) {
      return empty;
    }

    const userTexts = [
      ...history
        .filter((item) => item.role === 'user')
        .map((item) => item.content),
      customerText,
    ];

    if (!asksNow) {
      if (userNamedModel(userTexts, cars)) {
        return empty;
      }
      return {
        text: formatRevisionMarca({
          marca: brand,
          cars,
          tresFilas: false,
          soloMarca: true,
          includePrice,
        }),
        holdVehicle: true,
        sendId: null,
      };
    }

    if (!concreteAsk) {
      return empty;
    }

    const raw = await this.openai.completeJson(
      COMPLIANCE_SYSTEM_PROMPT,
      JSON.stringify({
        pedido: concreteAsk,
        vehiculos: carsForReview(cars),
      }),
    );
    const review = parseComplianceReview(
      raw,
      cars.map((car) => car.id),
    );
    if (!review) {
      return {
        text: `PEDIDO: ${concreteAsk}\nNo se pudo revisar el inventario. No afirmes que un carro cumple. vehiculo null.`,
        holdVehicle: true,
        sendId: null,
      };
    }

    if (idsToOffer(review).length === 0) {
      // No saltar solo a otras marcas: primero similares de esta marca / ajustar pedido.
      return {
        text: formatComplianceForAgent(concreteAsk, cars, review, includePrice),
        holdVehicle: true,
        sendId: null,
      };
    }

    const namedId = namedOfferId(cars, idsToOffer(review), userTexts);
    return {
      text: formatComplianceForAgent(concreteAsk, cars, review, includePrice),
      holdVehicle: vehicleToSend(review, null) === null,
      sendId: vehicleToSend(review, namedId),
    };
  }

  private async executeTool(
    name: string,
    argsJson: string,
    vehicleKind: VehicleKind | null,
    brand: string | null,
    includePrice: boolean,
  ): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: true, mensaje: 'Argumentos inválidos' });
    }

    if (name === 'buscarvehiuclo') {
      const query = String(args.query ?? '').trim();
      const tipo = vehicleKind ?? parseVehicleKind(args.tipo);
      const fromTool = String(args.marca ?? '').trim();
      const marca = brand ?? (fromTool || null);
      const embedding = await this.openai.embed(query);
      return marca
        ? this.catalog.searchInventory(embedding ?? [], tipo, marca, includePrice)
        : this.catalog.searchInventory(embedding ?? [], tipo, null, includePrice);
    }

    if (name === 'calcular_financiamiento') {
      return calcularFinanciamiento(args as FinanciamientoInput);
    }

    if (name === 'calcular_financiamiento_bancario') {
      return calcularFinanciamientoBancario(args as FinanciamientoInput);
    }

    return JSON.stringify({ error: true, mensaje: `Tool desconocida: ${name}` });
  }

  private async attachHandoffBrief(
    contactId: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string | null> {
    const existing = history.find((item) =>
      item.content.startsWith('CONTEXTO ASESOR'),
    );
    if (existing) {
      return existing.content.replace(/^CONTEXTO ASESOR \(bot estuvo apagado\):\n?/, '');
    }

    const brief = await this.persistence.loadHandoffBrief(contactId);
    if (!brief) {
      return null;
    }

    const crudo = formatHandoffTurnsForSummarizer(brief.turns);
    let resumen =
      brief.resumen ??
      (await this.openai.complete(HANDOFF_SUMMARIZER_SYSTEM_PROMPT, crudo));
    if (!resumen) {
      resumen = crudo;
    }
    await this.persistence.saveHandoffResumen(brief.leadId, resumen);

    const content = `CONTEXTO ASESOR (bot estuvo apagado):\n${resumen}`;
    history.unshift({ role: 'assistant', content });
    await this.conversation.appendMessage(contactId, {
      role: 'assistant',
      content,
    });
    this.logger.log(`Handoff masticado contactId=${contactId}`);
    return resumen;
  }
}
