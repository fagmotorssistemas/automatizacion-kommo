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
import {
  colorMatches,
  detectBrand,
  detectColorInText,
  detectNamedModelAsk,
  detectTrimInText,
  detectYearInText,
  modelHasTrim,
  resolveBrand,
  type VehicleLexicon,
} from '../conversation/vehicle-brand';
import {
  bodyGroupOf,
  carBodyGroup,
  detectGearbox,
  formatGearboxAlternatives,
  formatGearboxPedido,
  gearboxOf,
  Gearbox,
  pickGearboxAlternatives,
  resolveGearbox,
} from '../conversation/gearbox';
import { isConcreteAsk, resolveConcreteAsk } from '../conversation/concrete-ask';
import {
  asksForPlate,
  messageLeaksPrice,
  stripUnsolicitedPriceAndPlate,
} from '../conversation/strip-unsolicited-price';
import {
  CONTESTA_DUDA,
  isPoliteThanks,
  SEGUIR_VENTA,
} from '../conversation/polite-thanks';
import {
  resumenAsksForListedPrice,
  resumenHasPendingDoubt,
} from '../intelligence/parse-resumen';
import {
  followsShownCar,
  formatInterestedCar,
  refersToInterestedCar,
} from '../conversation/interested-car';
import {
  formatRevisionMarca,
  formatMissingNamedModel,
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
  carsFromMatchJson,
  inventorySearchPlan,
} from '../catalog/inventory-search-plan';
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

type BrandReview = {
  text: string;
  holdVehicle: boolean;
  sendId: string | null;
  switchedModel?: boolean;
  vehicleKind?: VehicleKind | null;
};

function kindOfNamedUnits(cars: StockCar[]): VehicleKind | null {
  const kinds = [
    ...new Set(
      cars
        .map((car) => kindFromTypeBody(car.typeBody))
        .filter((kind): kind is VehicleKind => Boolean(kind)),
    ),
  ];
  return kinds.length === 1 ? kinds[0] : null;
}

function matchUnitFacts(
  cars: StockCar[],
  yearAsk: number | null,
  colorAsk: string | null,
  trimAsk: string | null,
): StockCar[] {
  return cars.filter((car) => {
    if (yearAsk && car.year !== yearAsk) {
      return false;
    }
    if (colorAsk && car.color && !colorMatches(car.color, colorAsk)) {
      return false;
    }
    if (trimAsk && !modelHasTrim(car.model, trimAsk)) {
      return false;
    }
    return true;
  });
}

function lastYearInUserTexts(texts: string[]): number | null {
  let year: number | null = null;
  for (const text of texts) {
    const found = detectYearInText(text);
    if (found) {
      year = found;
    }
  }
  return year;
}

/** Si pidió un año y no está, no ofrezcas uno 20 años más viejo. */
function carsNearYear(cars: StockCar[], year: number, delta = 3): StockCar[] {
  const near = cars.filter(
    (car) => car.year != null && Math.abs(car.year - year) <= delta,
  );
  return near.length > 0 ? near : cars;
}

const MODEL_STOP = new Set([
  'que',
  'precio',
  'vale',
  'cuesta',
  'este',
  'esta',
  'eso',
  'ese',
  'mismo',
  'hola',
  'okey',
  'por',
  'favor',
  'una',
  'uno',
  'los',
  'las',
  'con',
  'para',
  'tiene',
  'hay',
]);

/** Palabra que puede ser un modelo (rio, seltos), no "ok" ni "precio". */
function mightNameModel(text: string): boolean {
  return text.split(/[^\p{L}0-9]+/u).some((word) => {
    const token = word
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return token.length >= 3 && !MODEL_STOP.has(token);
  });
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

    const lexicon = await this.catalog.getLexicon();
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
      lexicon,
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
      lexicon,
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
    const showPrice = resumenAsksForListedPrice(resumen);
    const thanksHint = resumenHasPendingDoubt(resumen)
      ? CONTESTA_DUDA
      : isPoliteThanks(input.customerText)
        ? SEGUIR_VENTA
        : '';

    const intentsRaw =
      (await this.openai.complete(INTENTS_SYSTEM_PROMPT, resumen)) ?? '{}';
    const promptNames = promptNamesFromIntents(parseIntentsPayload(intentsRaw));
    const selling = turnIsSellingTheirCar(promptNames, resumen);
    const buying = turnAlsoWantsToBuy(promptNames, resumen);
    const stayOnShown = followsShownCar({
      text: input.customerText,
      resumen,
      history,
      car: interested,
      lexicon,
    });
    const revision =
      selling && !buying
        ? { text: '', holdVehicle: true, sendId: null }
        : stayOnShown && interested
          ? {
              text: `EL HILO SIGUE CON EL VEHÍCULO QUE YA MOSTRAMOS (${interested.brand} ${interested.model}).
inventory_id=${interested.inventoryId}
Lee el RESUMEN y el HISTORIAL: eso dice qué quiere ahora. Contesta eso sobre ESTA unidad.
No reabras inventario ni uses buscarvehiuclo. No digas "no está" ni "lo más cercano".
No rellenes con placa, visita, papeles, cuota o cédula si el hilo no lo pidió.`,
              holdVehicle:
                isMoneyNotVisit(input.customerText) && !showPrice,
              sendId:
                isMoneyNotVisit(input.customerText) && !showPrice
                  ? null
                  : interested.inventoryId,
            }
          : await this.reviewBrand(
              history,
              input.customerText,
              selling ? detectBrand(input.customerText, lexicon) : brand,
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
              lexicon,
            );
    const sections = await this.catalog.fetchAgentPrompts(promptNames);
    const shownOtherBox =
      gearbox &&
      interested &&
      gearboxOf(interested) !== null &&
      gearboxOf(interested) !== gearbox;
    const interestedText =
      interested &&
      (stayOnShown ||
        refersToInterestedCar(input.customerText, interested, lexicon)) &&
      !shownOtherBox
        ? formatInterestedCar(interested, showPrice)
        : '';
    const saidBoxNow = detectGearbox(input.customerText, lexicon);
    if (revision.switchedModel) {
      if (!saidBoxNow) {
        await this.conversation.clearGearbox(input.contactId);
      }
      await this.conversation.clearConcreteAsk(input.contactId);
      if (revision.vehicleKind) {
        await this.conversation.saveVehicleKind(
          input.contactId,
          revision.vehicleKind,
        );
      }
    }
    const cambioModelo =
      revision.switchedModel && interested
        ? `CAMBIO DE MODELO: el cliente ya no habla del ${interested.brand} ${interested.model}. Prohibido volver a ofrecerlo ni poner su inventory_id. Habla solo del que pidió ahora.`
        : '';
    const precioHint = showPrice
      ? 'PIDIÓ EL PRECIO de esta unidad: dilo ($…). Prohibido placa, cuota, cédula si el hilo no las pidió. Si el resumen también pide cuota o visita, atiende eso.'
      : selling && !buying
        ? ''
        : 'Si el resumen no pide el precio, no lo digas. Placa solo en la primera presentación de ese carro o si la preguntó. Prohibido placa completa y chasis.';
    const pedidoVigente = (
      stayOnShown
        ? [
            revision.text,
            interestedText,
            thanksHint,
            isMoneyNotVisit(input.customerText) ? PRECIO_NO_HORARIO : '',
            formatVisitHourHint(input.customerText),
            precioHint,
          ]
        : [
            formatPedidoVigente(
              revision.switchedModel
                ? (revision.vehicleKind ?? null)
                : vehicleKind,
            ),
            formatGearboxPedido(
              revision.switchedModel && !saidBoxNow ? null : gearbox,
            ),
            cambioModelo,
            revision.text,
            interestedText,
            thanksHint,
            isMoneyNotVisit(input.customerText) ? PRECIO_NO_HORARIO : '',
            formatVisitHourHint(input.customerText),
            selling ? SU_CARRO_NO_SE_OFRECE : '',
            precioHint,
          ]
    )
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
          revision.switchedModel ? (revision.vehicleKind ?? null) : vehicleKind,
          selling && !buying ? null : brand,
          showPrice,
          lexicon,
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
    } else if (
      revision.switchedModel &&
      interested &&
      parsed.meta.vehiculo?.inventory_id === interested.inventoryId
    ) {
      parsed.meta.vehiculo = null;
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

    if (parsed.mensaje) {
      const askedPlate = asksForPlate(input.customerText);
      const replyId = parsed.meta.vehiculo?.inventory_id;
      const firstPresentation =
        Boolean(replyId) &&
        (!interested || replyId !== interested.inventoryId);
      const cleaned = stripUnsolicitedPriceAndPlate(parsed.mensaje, {
        keepPrice: showPrice,
        keepPlateShort: askedPlate || firstPresentation,
      });
      if (cleaned !== parsed.mensaje || (!showPrice && messageLeaksPrice(parsed.mensaje))) {
        this.logger.warn(
          `Se quitó dato no pedido contactId=${input.contactId}`,
        );
      }
      parsed.mensaje = cleaned;
      if (!showPrice) {
        parsed.meta.precioMostrado = false;
      }
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
    lexicon: VehicleLexicon,
  ): Promise<string | null> {
    const remembered = await this.conversation.loadVehicleBrand(contactId);
    const brand = resolveBrand({ history, customerText, remembered, lexicon });
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
    lexicon: VehicleLexicon,
  ): Promise<Gearbox | null> {
    const remembered = await this.conversation.loadGearbox(contactId);
    const gearbox = resolveGearbox({
      history,
      customerText,
      remembered,
      lexicon,
    });
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
    lexicon: VehicleLexicon,
  ): Promise<BrandReview> {
    const empty: BrandReview = { text: '', holdVehicle: false, sendId: null };
    const asked = detectNamedModelAsk(customerText, lexicon);
    const targetBrand = asked?.brand || brand;
    if (!targetBrand && !asked) {
      return empty;
    }

    const namesBrandNow = Boolean(detectBrand(customerText, lexicon));
    const maybeAsk =
      isConcreteAsk(customerText) ||
      (Boolean(concreteAsk) && namesBrandNow);
    if (!maybeAsk && !namesBrandNow && !mightNameModel(customerText)) {
      return empty;
    }

    const listed = targetBrand
      ? await this.catalog.listByBrand(targetBrand)
      : await this.catalog.listAvailableExcept('_');
    const yearAsk = asked?.year ?? detectYearInText(customerText);
    const colorAsk = detectColorInText(customerText);
    const trimAsk = detectTrimInText(customerText);
    const lastAssistant = [...history]
      .reverse()
      .find((item) => item.role === 'assistant');
    const priorUserTexts = history
      .filter((item) => item.role === 'user')
      .map((item) => item.content);
    const yearFromThread = yearAsk ?? lastYearInUserTexts(priorUserTexts);
    if (!asked && (yearAsk || colorAsk || trimAsk)) {
      const offered = lastAssistant
        ? listed.filter((car) =>
            textMentionsModel(lastAssistant.content, car.model),
          )
        : [];
      const fromOffer = matchUnitFacts(offered, yearAsk, colorAsk, trimAsk);
      if (fromOffer.length === 1) {
        const named = formatNamedUnits(fromOffer, includePrice);
        return {
          ...named,
          text: `${named.text}
El cliente eligió entre las unidades que YA le mostramos. Manda ESA. Prohibido meter otra línea ni reabrir el año que ya descartó.`,
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(fromOffer),
        };
      }
      if (fromOffer.length > 1) {
        return {
          ...formatNamedUnits(fromOffer, includePrice),
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(fromOffer),
        };
      }
      const threadFamily =
        detectNamedModelAsk(lastAssistant?.content ?? '', lexicon)?.family ||
        [...priorUserTexts]
          .reverse()
          .map((text) => detectNamedModelAsk(text, lexicon)?.family)
          .find(Boolean) ||
        '';
      if (threadFamily && !trimAsk) {
        const inFamily = listed.filter((car) =>
          textMentionsModel(car.model, threadFamily),
        );
        const picked = matchUnitFacts(inFamily, yearAsk, colorAsk, null);
        if (picked.length === 1) {
          return this.namedModelFound(picked, includePrice, false);
        }
        if (picked.length > 1) {
          return {
            ...formatNamedUnits(picked, includePrice),
            switchedModel: true,
            vehicleKind: kindOfNamedUnits(picked),
          };
        }
        if (yearAsk) {
          return {
            ...formatMissingNamedModel(
              threadFamily,
              yearAsk,
              carsNearYear(inFamily, yearAsk),
              includePrice,
            ),
            switchedModel: true,
            vehicleKind: kindOfNamedUnits(inFamily),
          };
        }
      }
      const byFacts = matchUnitFacts(listed, yearAsk, colorAsk, trimAsk);
      if (byFacts.length === 1) {
        return this.namedModelFound(byFacts, includePrice, false);
      }
      if (byFacts.length > 1) {
        return {
          ...formatNamedUnits(byFacts, includePrice),
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(byFacts),
        };
      }
      if (trimAsk || yearAsk) {
        const close = listed.filter((car) =>
          yearAsk ? car.year === yearAsk : true,
        );
        return {
          ...formatMissingNamedModel(
            trimAsk || targetBrand || 'unidad',
            yearAsk,
            close,
            includePrice,
          ),
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(close),
        };
      }
    }
    const saidBox = detectGearbox(customerText, lexicon);
    if (saidBox && lastAssistant && !asked) {
      const offered = listed.filter((car) =>
        textMentionsModel(lastAssistant.content, car.model),
      );
      const boxed = offered.filter((car) => gearboxOf(car) === saidBox);
      if (boxed.length > 0) {
        const named = formatNamedUnits(boxed, includePrice);
        return {
          ...named,
          text: `${named.text}
El cliente eligió entre las unidades que YA le mostramos. Manda ESA. Prohibido decir que no está o "lo más cercano".`,
          switchedModel: false,
          vehicleKind: kindOfNamedUnits(boxed),
        };
      }
    }
    const namedNow = listed.filter(
      (car) =>
        textMentionsModel(customerText, car.model) ||
        (asked ? textMentionsModel(car.model, asked.family) : false),
    );
    const referenceFamily = reference?.family ?? '';
    if (namedNow.length > 0) {
      const boxed = saidBox
        ? namedNow.filter((car) => gearboxOf(car) === saidBox)
        : namedNow;
      let offer = boxed.length > 0 ? boxed : namedNow;
      if (yearFromThread) {
        const exactYear = offer.filter((car) => car.year === yearFromThread);
        if (exactYear.length > 0) {
          offer = exactYear;
        } else {
          const family =
            asked?.family || modelFamily(offer[0]?.model ?? '') || '';
          const yearFromEmbed = family
            ? (
                await this.lookupNamedByEmbedding(
                  customerText,
                  family,
                  asked?.brand || targetBrand || '',
                  listed,
                  includePrice,
                )
              ).filter((car) => car.year === yearFromThread)
            : [];
          if (yearFromEmbed.length > 0) {
            return this.namedModelFound(yearFromEmbed, includePrice, true);
          }
          const yearElsewhere = family
            ? await this.familyInOtherBrands(
                family,
                yearFromThread,
                targetBrand,
              )
            : [];
          if (yearElsewhere.length > 0) {
            return this.namedModelFound(
              carsNearYear(yearElsewhere, yearFromThread),
              includePrice,
              false,
            );
          }
          const missingYear = formatMissingNamedModel(
            family || 'unidad',
            yearFromThread,
            carsNearYear(offer, yearFromThread),
            includePrice,
          );
          return {
            ...missingYear,
            switchedModel: true,
            vehicleKind: kindOfNamedUnits(offer),
          };
        }
      }
      return this.namedModelFound(offer, includePrice, false);
    }
    if (asked) {
      const fromEmbed = await this.lookupNamedByEmbedding(
        customerText,
        asked.family,
        asked.brand,
        listed,
        includePrice,
      );
      if (fromEmbed.length > 0) {
        return this.namedModelFound(fromEmbed, includePrice, true);
      }
      const elsewhere = await this.familyInOtherBrands(
        asked.family,
        asked.year,
        targetBrand,
      );
      if (elsewhere.length > 0) {
        return this.namedModelFound(elsewhere, includePrice, false);
      }
      const missing = formatMissingNamedModel(
        asked.family,
        asked.year,
        asked.year
          ? carsNearYear(
              listed.filter((car) => textMentionsModel(car.model, asked.family)),
              asked.year,
            )
          : listed,
        includePrice,
      );
      return {
        ...missing,
        switchedModel: false,
        vehicleKind: kindOfNamedUnits(listed) ?? vehicleKind,
      };
    }

    const mentionsReference = Boolean(
      referenceFamily && textMentionsModel(customerText, referenceFamily),
    );
    const askingOther =
      Boolean(referenceFamily) &&
      !mentionsReference &&
      Boolean(detectBrand(customerText, lexicon));

    const asksNow =
      isConcreteAsk(customerText) ||
      (Boolean(concreteAsk) && namesBrandNow && !askingOther);
    if (!asksNow && !namesBrandNow) {
      return empty;
    }
    if (askingOther && !asksNow) {
      return {
        text: '',
        holdVehicle: false,
        sendId: null,
        switchedModel: true,
        vehicleKind: null,
      };
    }

    let stock = listed;
    if (gearbox && reference?.family && !askingOther) {
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
        const others = await this.catalog.listAvailableExcept(
          targetBrand || '_',
        );
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
        text: `De ${targetBrand} no hay ${vehicleKind} disponible. No ofrezcas otro tipo. vehiculo null.`,
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
      if (userNamedModel(userTexts, cars) || !targetBrand) {
        return empty;
      }
      return {
        text: formatRevisionMarca({
          marca: targetBrand,
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

  private namedModelFound(
    cars: StockCar[],
    includePrice: boolean,
    fromEmbed: boolean,
  ): BrandReview {
    const named = formatNamedUnits(cars, includePrice);
    const via = fromEmbed ? ' (búsqueda por inventario)' : '';
    return {
      ...named,
      text: `${named.text}
Este modelo SÍ está en patio${via}. Prohibido decir que no está disponible. No inventes que pidió automática/manual si no lo dijo ahora. No pases a otra marca.`,
      switchedModel: true,
      vehicleKind: kindOfNamedUnits(cars),
    };
  }

  /** El modelo/año puede estar en otra marca (Chevrolet Vitara vs Suzuki). */
  private async familyInOtherBrands(
    family: string,
    year: number | null,
    exceptBrand: string | null,
  ): Promise<StockCar[]> {
    if (!family) {
      return [];
    }
    const others = await this.catalog.listAvailableExcept(exceptBrand || '_');
    return others.filter(
      (car) =>
        textMentionsModel(car.model, family) &&
        (year == null || car.year === year),
    );
  }

  private async lookupNamedByEmbedding(
    query: string,
    family: string,
    brand: string,
    listed: StockCar[],
    includePrice: boolean,
  ): Promise<StockCar[]> {
    const embedding = await this.openai.embed(query);
    if (!embedding?.length) {
      return [];
    }
    const raw = await this.catalog.searchByQuery({
      embedding,
      query,
      tipo: null,
      marca: brand,
      includePrice,
    });
    const hits = carsFromMatchJson(raw).filter(
      (car) =>
        textMentionsModel(car.model, family) ||
        modelFamily(car.model) === family,
    );
    if (hits.length === 0) {
      this.logger.log(`Embedding no halló ${family} (marca=${brand})`);
      return [];
    }
    this.logger.log(`Embedding halló ${family}: ${hits.map((car) => car.id).join(',')}`);
    const listedById = new Map(listed.map((car) => [car.id, car]));
    return hits.map((car) => listedById.get(car.id) ?? car);
  }

  private async executeTool(
    name: string,
    argsJson: string,
    vehicleKind: VehicleKind | null,
    brand: string | null,
    includePrice: boolean,
    lexicon: VehicleLexicon,
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
      const plan = inventorySearchPlan(query, tipo, marca, lexicon);
      const embedding = await this.openai.embed(query);
      return this.catalog.searchByQuery({
        embedding: embedding ?? [],
        query,
        tipo: plan.tipo,
        marca: plan.marca,
        includePrice,
      });
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
