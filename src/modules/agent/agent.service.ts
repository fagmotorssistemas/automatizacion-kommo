import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { ConversationService } from '../conversation/conversation.service';
import { getDealershipClock } from '../intelligence/dealership-hours';
import { formatVisitHourHint, isMoneyNotVisit, PRECIO_NO_HORARIO } from '../intelligence/visit-hours';
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
  kindFromTypeBody,
  matchesVehicleKind,
  parseVehicleKind,
  resolveVehicleKind,
  VehicleKind,
} from '../conversation/vehicle-kind';
import { detectBrand, resolveBrand } from '../conversation/vehicle-brand';
import {
  bodyGroupOf,
  carBodyGroup,
  formatGearboxAlternatives,
  formatGearboxPedido,
  gearboxOf,
  Gearbox,
  pickGearboxAlternatives,
  resolveGearbox,
} from '../conversation/gearbox';
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
  formatNamedUnits,
  modelFamily,
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
import {
  carsForSpecLookup,
  factsFromResearch,
  formatSpecNotes,
  specCacheKey,
  SPEC_RESEARCH_PROMPT,
  specTopic,
  SpecFact,
} from '../catalog/ficha-tecnica';
import {
  SU_CARRO_NO_SE_OFRECE,
  turnAlsoWantsToBuy,
  turnIsSellingTheirCar,
} from './su-carro';

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
    const interested = await this.persistence.latestInterestedCar(
      input.contactId,
    );
    const vehicleKind = await this.rememberVehicleKind(
      input.contactId,
      history,
      input.customerText,
      kindFromTypeBody(interested?.typeBody),
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
    const gearbox = await this.rememberGearbox(
      input.contactId,
      history,
      input.customerText,
    );
    const showPrice = asksForPrice(input.customerText);
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
    const selling = turnIsSellingTheirCar(promptNames, resumen);
    const buying = turnAlsoWantsToBuy(promptNames, resumen);
    const revision =
      selling && !buying
        ? { text: '', holdVehicle: true, sendId: null }
        : await this.reviewBrand(
            history,
            input.customerText,
            selling ? detectBrand(input.customerText) : brand,
            concreteAsk,
            showPrice,
            vehicleKind,
            gearbox,
            interested
              ? {
                  price: interested.price,
                  family: modelFamily(interested.model),
                }
              : null,
          );
    const sections = await this.catalog.fetchAgentPrompts(promptNames);
    const shownOtherBox =
      gearbox &&
      interested &&
      gearboxOf(interested) !== null &&
      gearboxOf(interested) !== gearbox;
    const interestedText =
      interested &&
      refersToInterestedCar(input.customerText, interested) &&
      !shownOtherBox
        ? formatInterestedCar(interested, showPrice)
        : '';
    const pedidoVigente = [
      formatPedidoVigente(vehicleKind),
      formatGearboxPedido(gearbox),
      revision.text,
      interestedText,
      isPoliteThanks(input.customerText) ? SEGUIR_VENTA : '',
      isMoneyNotVisit(input.customerText) ? PRECIO_NO_HORARIO : '',
      formatVisitHourHint(input.customerText),
      selling ? SU_CARRO_NO_SE_OFRECE : '',
      showPrice || (selling && !buying)
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
        this.executeTool(
          name,
          argsJson,
          vehicleKind,
          selling && !buying ? null : brand,
          showPrice,
        ),
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
    } else if (revision.holdVehicle || isMoneyNotVisit(input.customerText)) {
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
    interestedKind: VehicleKind | null,
  ): Promise<VehicleKind | null> {
    const remembered = await this.conversation.loadVehicleKind(contactId);
    const kind = resolveVehicleKind({
      history,
      customerText,
      remembered,
      interestedKind,
    });
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

  private async rememberGearbox(
    contactId: string,
    history: { role: string; content: string }[],
    customerText: string,
  ): Promise<Gearbox | null> {
    const remembered = await this.conversation.loadGearbox(contactId);
    const gearbox = resolveGearbox({ history, customerText, remembered });
    if (gearbox && gearbox !== remembered) {
      await this.conversation.saveGearbox(contactId, gearbox);
    }
    return gearbox;
  }

  private async reviewBrand(
    history: { role: string; content: string }[],
    customerText: string,
    brand: string | null,
    concreteAsk: string | null,
    includePrice: boolean,
    vehicleKind: VehicleKind | null,
    gearbox: Gearbox | null,
    reference: { price: number | null; family: string | null } | null,
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

    const listed = await this.catalog.listByBrand(brand);
    let stock = listed;
    if (gearbox && reference?.family) {
      const group = bodyGroupOf(vehicleKind);
      const inBrand = pickGearboxAlternatives({
        cars: listed,
        gearbox,
        family: reference.family,
        group,
        referencePrice: reference.price,
      });
      if (inBrand?.sameModel) {
        stock = inBrand.cars;
      } else {
        const others = await this.catalog.listAvailableExcept(brand);
        const pick = pickGearboxAlternatives({
          cars: [...listed, ...others],
          gearbox,
          family: reference.family,
          group,
          referencePrice: reference.price,
        });
        if (pick) {
          return formatGearboxAlternatives({ gearbox, pick, includePrice });
        }
      }
    }
    if (gearbox) {
      const opposite = gearbox === 'manual' ? 'automatica' : 'manual';
      stock = stock.filter((car) => gearboxOf(car) !== opposite);
    }
    const cars =
      gearbox && bodyGroupOf(vehicleKind) === 'chico'
        ? stock.filter((car) => carBodyGroup(car.typeBody) === 'chico')
        : vehicleKind
          ? stock.filter((car) => matchesVehicleKind(car.typeBody, vehicleKind))
          : stock;
    if (vehicleKind && listed.length > 0 && cars.length === 0) {
      return {
        text: `De ${brand} no hay ${vehicleKind} disponible. No ofrezcas otro tipo. vehiculo null.`,
        holdVehicle: true,
        sendId: null,
      };
    }
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
      const namedNow = cars.filter((car) =>
        textMentionsModel(customerText, car.model),
      );
      if (namedNow.length > 0) {
        return formatNamedUnits(namedNow, includePrice);
      }
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

    const facts = await this.collectSpecFacts(concreteAsk, cars);
    const specNotes = formatSpecNotes(facts);

    const raw = await this.openai.completeJson(
      COMPLIANCE_SYSTEM_PROMPT,
      JSON.stringify({
        pedido: concreteAsk,
        vehiculos: carsForReview(cars),
        ...(facts.length > 0 ? { fichas_tecnicas: facts } : {}),
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

    const reviewed = [formatComplianceForAgent(concreteAsk, cars, review, includePrice), specNotes]
      .filter(Boolean)
      .join('\n');

    if (idsToOffer(review).length === 0) {
      return {
        text: reviewed,
        holdVehicle: true,
        sendId: null,
      };
    }

    const namedId = namedOfferId(cars, idsToOffer(review), userTexts);
    return {
      text: reviewed,
      holdVehicle: vehicleToSend(review, null) === null,
      sendId: vehicleToSend(review, namedId),
    };
  }

  /**
   * Primero las fichas ya guardadas. Lo que falta se investiga junto, se guarda,
   * y recién después sigue el turno. Un solo mensaje al cliente.
   */
  private async collectSpecFacts(
    ask: string,
    cars: StockCar[],
  ): Promise<SpecFact[]> {
    const topic = specTopic(ask);
    const targets = carsForSpecLookup(ask, cars);
    if (!topic || targets.length === 0) {
      return [];
    }

    const modelKeys = [
      ...new Set(
        targets.map((car) => car.model.toLowerCase().replace(/\s+/g, ' ').trim()),
      ),
    ];
    const stored = await this.persistence.loadVehicleSpecs(topic, modelKeys);
    const known = new Map(
      stored.map((row) => [
        `${row.modelKey}|${row.year}|${topic}`,
        { seguro: row.seguro, dato: row.dato },
      ]),
    );

    const pending: StockCar[] = [];
    const seen = new Set<string>();
    for (const car of targets) {
      const key = specCacheKey(car.model, car.year, topic);
      if (known.has(key) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      pending.push(car);
    }

    if (pending.length > 0) {
      const raw = await this.openai.researchSpecs(
        SPEC_RESEARCH_PROMPT,
        JSON.stringify({
          pedido: ask,
          vehiculos: carsForReview(pending).map((car) => ({
            id: car.id,
            marca: car.marca,
            modelo: car.modelo,
            anio: car.anio,
          })),
        }),
      );
      const found = factsFromResearch(
        raw,
        pending.map((car) => car.id),
      );
      if (found) {
        await this.persistence.saveVehicleSpecs(
          found.flatMap((fact) => {
            const car = pending.find((item) => item.id === fact.id);
            if (!car) {
              return [];
            }
            return [
              {
                modelKey: car.model.toLowerCase().replace(/\s+/g, ' ').trim(),
                year: car.year ?? 0,
                topic,
                seguro: fact.seguro,
                dato: fact.dato,
              },
            ];
          }),
        );
        for (const fact of found) {
          const car = pending.find((item) => item.id === fact.id);
          if (!car) {
            continue;
          }
          known.set(specCacheKey(car.model, car.year, topic), {
            seguro: fact.seguro,
            dato: fact.dato,
          });
        }
      }
    }

    const facts: SpecFact[] = [];
    for (const car of targets) {
      const hit = known.get(specCacheKey(car.model, car.year, topic));
      if (!hit) {
        continue;
      }
      facts.push({ id: car.id, seguro: hit.seguro, dato: hit.dato });
    }
    return facts;
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
