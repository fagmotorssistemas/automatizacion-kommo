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
  cedulaFromThread,
  confirmCedulaReceived,
  extractCedula,
  replyAsksForCedula,
} from '../intelligence/extract-cedula';
import {
  assembleDynamicContext,
  buildIntentsInput,
  parseIntentsPayload,
  promptNamesFromIntents,
  toFetchPromptNames,
} from './assemble-dynamic-context';
import { OpenAiAgentClient } from './openai-agent.client';
import {
  AgentTurnResult,
  ParsedAgentOutput,
  parseAgentOutput,
  serializeAgentTurn,
} from './parse-agent-output';
import { formatHandoffTurnsForSummarizer } from '../persistence/format-handoff-turns';
import { PersistenceService } from '../persistence/persistence.service';
import { InterestedCarSnapshot } from '../persistence/lead.types';
import { isUuid } from '../persistence/is-uuid';
import { buildResumenInput } from '../conversation/build-resumen-input';
import { isRealCustomerText } from '../conversation/is-real-customer-text';
import {
  adLabelLooksLikeVehicle,
  facebookAdLabel,
  isBareConfirmation,
  isCtaAdLabel,
  isFacebookMoreInfoOpener,
} from '../inbox/first-touch';
import { intentsSystemPrompt } from './prompts/intents.prompt';
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
  isDriveFamily,
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
import {
  asksClosestByFacts,
  isConcreteAsk,
  resolveConcreteAsk,
} from '../conversation/concrete-ask';
import {
  appendUnloadedPrice,
  asksForPlate,
  messageLeaksPrice,
  stripUnsolicitedPriceAndPlate,
} from '../conversation/strip-unsolicited-price';
import {
  appendNegotiateInPerson,
  shouldSayNegotiateInPerson,
} from '../conversation/negotiate-in-person';
import { ungateLocationReply } from '../conversation/location-without-entrada';
import { ensureCashDeliveryConfirm } from '../conversation/cash-delivery';
import {
  CONTESTA_DUDA,
  isPoliteThanks,
  SEGUIR_VENTA,
} from '../conversation/polite-thanks';
import {
  historyAlreadyGaveCuota,
  historyHasListedPrice,
  isThreadAck,
  postponesBiggerDownPayment,
  resumenAceptaCredito,
  resumenPideNegociar,
  resumenPideOtras,
  resumenAsksForLocation,
  resumenPrefiereContado,
  resumenAsksForImmediateDelivery,
  resumenRechazaAplicar,
  resumenAsksForCredit,
  resumenAsksForListedPrice,
  resumenAsksForOtherColor,
  parseResumen,
  resumenHasPendingDoubt,
  resumenIsCourtesy,
  resumenIsThreadAck,
  resumenIsFarewell,
  resumenIsPriceObjection,
  textAsksForCredit,
  textAsksForImmediateDelivery,
  textAsksForListedPrice,
  textAsksForLocation,
  textAsksForOtherColor,
  textIsPriceObjection,
} from '../intelligence/parse-resumen';
import {
  ensureListedPrice,
  historySaidMileageCare,
  stripRepeatedMileageCare,
} from '../catalog/mileage';
import {
  followsShownCar,
  formatInterestedCar,
  historyPresentedFicha,
  refersToInterestedCar,
} from '../conversation/interested-car';
import {
  asksForLargePassengerSpace,
  formatLargePassengerPedido,
  formatLargePassengerRevision,
  pickLargePassengerCars,
} from '../conversation/large-passenger';
import {
  carsShownInHistory,
  formatRevisionMarca,
  formatMissingNamedModel,
  formatNamedUnits,
  hasUsableFicha,
  preferCurrentYears,
  modelFamily,
  pickClosestToMissingModel,
  pickShownByYear,
  shownThreadText,
  StockCar,
  textMentionsModel,
  userNamedModel,
} from '../catalog/clasificar-filas';
import {
  appendBudgetFinancingAsk,
  appendBudgetPickShown,
  carsInBudget,
  detectCashBudget,
  formatBudgetRevision,
  shouldAskBudgetFinancing,
  shouldAskWhichShown,
} from '../conversation/budget';
import {
  appendApplyAsk,
  appendFinancingDataAsk,
  appendFinancingDecline,
  gaveFinancingInputs,
  historyAskedFinancingData,
  historyAskedIfApplies,
  historyHasShownCuota,
  replyAsksFinancingData,
  replyShowsCuota,
  shouldAskFinancingData,
  shouldAskIfApplies,
  shouldEncourageAfterDecline,
  stripGestionarOffer,
  stripPrematureIdentityAsk,
} from '../conversation/financing-data';
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
  unitPrice?: number | null;
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

function lastYearInUserTexts(
  texts: string[],
  lexicon: VehicleLexicon,
): number | null {
  let year: number | null = null;
  for (const text of texts) {
    const asked = detectNamedModelAsk(text, lexicon);
    const found = asked ? asked.year : detectYearInText(text);
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

/** Título del anuncio si nombra un carro. Vacío si es solo el clic o un botón. */
function facebookOpenerVehicle(
  text: string,
  lexicon: VehicleLexicon,
): string | null {
  if (!isFacebookMoreInfoOpener(text)) {
    return null;
  }
  const label = facebookAdLabel(text);
  if (!label || isCtaAdLabel(label)) {
    return null;
  }
  if (
    detectNamedModelAsk(label, lexicon) ||
    detectBrand(label, lexicon) ||
    adLabelLooksLikeVehicle(label)
  ) {
    return label;
  }
  return null;
}

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

    const lexicon = await this.catalog.getLexicon();
    const adVehicle = facebookOpenerVehicle(input.customerText, lexicon);
    if (isFacebookMoreInfoOpener(input.customerText) && !adVehicle) {
      return this.replyAskWhichCar(input.contactId, input.customerText);
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
    const askedListedPrice = textAsksForListedPrice(input.customerText);
    const mentionsPrice =
      resumenAsksForListedPrice(resumen) || askedListedPrice;
    const firstTouchBareOk =
      isBareConfirmation(input.customerText) &&
      !historyPresentedFicha(history, interested?.model);
    const asksDeliveryNow =
      textAsksForImmediateDelivery(input.customerText) ||
      resumenAsksForImmediateDelivery(resumen);
    const confirmingCashOrDelivery =
      historyHasListedPrice(history) &&
      !askedListedPrice &&
      (resumenPrefiereContado(resumen) || asksDeliveryNow);
    const askedPrice =
      resumenPideNegociar(resumen) ||
      firstTouchBareOk ||
      confirmingCashOrDelivery
        ? false
        : mentionsPrice;
    const cashBudget = detectCashBudget(input.customerText);
    const aceptaVerSiAplica =
      resumenAceptaCredito(resumen) &&
      (historyAskedIfApplies(history) || historyHasShownCuota(history));
    const askedCredit =
      cashBudget ||
      aceptaVerSiAplica ||
      resumenRechazaAplicar(resumen) ||
      resumenPrefiereContado(resumen)
        ? false
        : resumenAsksForCredit(resumen) || textAsksForCredit(input.customerText);
    const askedOtherColor =
      resumenAsksForOtherColor(resumen) ||
      textAsksForOtherColor(input.customerText);
    const thanksHint = resumenHasPendingDoubt(resumen)
      ? CONTESTA_DUDA
      : (isPoliteThanks(input.customerText) || resumenIsCourtesy(resumen)) &&
          !resumenIsFarewell(resumen)
        ? SEGUIR_VENTA
        : '';

    const spaceText = `${input.customerText}\n${resumen}\n${history
      .filter((item) => item.role === 'user')
      .map((item) => item.content)
      .join('\n')}`;
    const spaceAsk = asksForLargePassengerSpace(spaceText);
    const stayOnShown = followsShownCar({
      text: input.customerText,
      resumen,
      history,
      car: interested,
      lexicon,
    });
    const fichaAlreadyGiven = historyPresentedFicha(
      history,
      interested?.model,
      resumen,
    );
    const priceObjection =
      resumenIsPriceObjection(resumen) ||
      textIsPriceObjection(input.customerText);
    const promptCatalog = await this.catalog.listAgentPromptNames();
    const intentsRaw =
      (await this.openai.complete(
        intentsSystemPrompt(promptCatalog),
        buildIntentsInput({
          resumen,
          stayOnShown,
          fichaAlreadyGiven,
          askedPrice,
          priceObjection,
        }),
      )) ?? '{}';
    let promptNames = promptNamesFromIntents(
      parseIntentsPayload(intentsRaw),
      promptCatalog,
    );
    const selling = turnIsSellingTheirCar(
      promptNames,
      resumen,
      input.customerText,
    );
    const buying = turnAlsoWantsToBuy(
      promptNames,
      resumen,
      input.customerText,
    );
    let revision =
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
                isMoneyNotVisit(input.customerText) &&
                !askedPrice &&
                !askedCredit,
              sendId:
                isMoneyNotVisit(input.customerText) &&
                !askedPrice &&
                !askedCredit
                  ? null
                  : interested.inventoryId,
              unitPrice:
                interested.price && interested.price > 0
                  ? Math.round(interested.price)
                  : null,
            }
          : await this.reviewBrand(
              history,
              input.customerText,
              selling ? detectBrand(input.customerText, lexicon) : brand,
              concreteAsk,
              askedPrice,
              vehicleKind,
              gearbox,
              interested
                ? {
                    price: interested.price,
                    family: modelFamily(interested.model),
                    color: interested.color ?? null,
                    inventoryId: interested.inventoryId,
                  }
                : null,
              lexicon,
              spaceAsk,
              askedOtherColor,
              resumen,
            );
    if (stayOnShown && interested && specTopic(input.customerText)) {
      const notes = await this.specNotesForShown(
        input.customerText,
        interested,
      );
      if (notes) {
        revision = {
          ...revision,
          text: `${revision.text}\n\n${notes}`,
        };
      }
    }
    const objectionOnShown =
      stayOnShown &&
      Boolean(interested) &&
      !askedPrice &&
      (priceObjection ||
        promptNames.some(
          (name) => name === 'objeciones' || name === 'presupuestocliente',
        ));
    const askingKmOnly =
      /\bkm\b|kilometr/i.test(input.customerText) &&
      !textAsksForListedPrice(input.customerText);
    const justifyPriceAfterFicha =
      stayOnShown &&
      Boolean(interested) &&
      askedPrice &&
      !askedCredit &&
      !askingKmOnly &&
      !objectionOnShown &&
      fichaAlreadyGiven;
    if (objectionOnShown) {
      promptNames = [
        ...new Set([...promptNames, 'objeciones', 'manejocaro']),
      ];
    } else if (justifyPriceAfterFicha) {
      promptNames = [...new Set([...promptNames, 'manejocaro'])];
    }
    const sections = await this.catalog.fetchAgentPrompts(
      toFetchPromptNames(promptNames, promptCatalog),
    );
    const shownOtherBox =
      gearbox &&
      interested &&
      gearboxOf(interested) !== null &&
      gearboxOf(interested) !== gearbox;
    const alreadyShown =
      Boolean(interested?.inventoryId) &&
      stayOnShown &&
      (!revision.sendId || revision.sendId === interested?.inventoryId) &&
      history.some((item) => item.role === 'assistant');
    const financingFollowUp =
      askedCredit &&
      alreadyShown &&
      historyHasListedPrice(history) &&
      !gaveFinancingInputs(input.customerText, resumen);
    const interestedText =
      interested &&
      (stayOnShown ||
        refersToInterestedCar(input.customerText, interested, lexicon)) &&
      !shownOtherBox
        ? formatInterestedCar(
            interested,
            (askedPrice || askedCredit) &&
              alreadyShown &&
              !objectionOnShown &&
              !financingFollowUp,
            {
              skipMileageCare:
                historySaidMileageCare(history) ||
                objectionOnShown ||
                justifyPriceAfterFicha ||
                financingFollowUp ||
                textAsksForListedPrice(input.customerText),
              slimAfterFicha: justifyPriceAfterFicha || financingFollowUp,
              creditFollowUp: financingFollowUp,
            },
          )
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
    const hasQuotedUnit = Boolean(
      revision.sendId ||
        (interested &&
          interested.price &&
          interested.price > 0 &&
          (stayOnShown ||
            refersToInterestedCar(input.customerText, interested, lexicon))),
    );
    const lastAssistantMsg = [...history]
      .reverse()
      .find((item) => item.role === 'assistant');
    const lastAssistantListedOther =
      askedPrice &&
      Boolean(
        lastAssistantMsg &&
          (!interested ||
            !textMentionsModel(lastAssistantMsg.content, interested.model)),
      );
    const creditQuote =
      askedCredit &&
      (hasQuotedUnit ||
        alreadyShown ||
        fichaAlreadyGiven ||
        historyHasListedPrice(history));
    const listedPriceKnown = revision.unitPrice !== undefined;
    const unitPrice =
      revision.unitPrice && revision.unitPrice > 0
        ? Math.round(revision.unitPrice)
        : interested?.price &&
            interested.price > 0 &&
            (!revision.sendId || revision.sendId === interested.inventoryId)
          ? Math.round(interested.price)
          : null;
    const askedThisUnitPrice =
      askedPrice && hasQuotedUnit && unitPrice != null;
    const canQuotePrice =
      creditQuote ||
      askedThisUnitPrice ||
      (!objectionOnShown &&
        ((hasQuotedUnit && alreadyShown && askedPrice) ||
          lastAssistantListedOther));
    const cuotaYaDicha =
      historyAlreadyGaveCuota(history) &&
      !aceptaVerSiAplica &&
      !resumenRechazaAplicar(resumen) &&
      (postponesBiggerDownPayment(input.customerText) ||
        ((isThreadAck(input.customerText) ||
          resumenIsThreadAck(resumen)) &&
          !historyAskedIfApplies(history)));
    const creditoHint = cuotaYaDicha
      ? `YA SE DIJO LA CUOTA. El resumen tiene que leer eso: no pidió otra proforma.
No repitas la ficha (modelo largo, color, km, caja) ni el precio, ni la entrada, ni la cuota.
Si va a juntar más entrada, una frase: cuando tenga el monto se recalcula.
Si cabe, UNA frase de garantía en documentos. Nada más.`
      : financingFollowUp
      ? 'YA hay ficha y precio de ESA unidad. Eligió el camino de financiamiento. PROHIBIDO repetir ficha, el $ ni “excelente estado / papeles / entrega”. Pregunta con cuánto de entrada y a qué plazo. No inventes cuota sin esos datos.'
      : askedCredit
      ? hasQuotedUnit && alreadyShown
        ? 'PIDIÓ CRÉDITO / FINANCIAMIENTO. Di el precio de contado de inventario, la entrada que indicó y la cuota de la herramienta. PROHIBIDO dejar huecos (“es de .”, “entrada de y”). No inventes una cuota si no hay entrada. En el turno de la cuota NO pidas cédula. El sistema pregunta si ayudamos a ver si aplica.'
        : hasQuotedUnit
          ? 'PIDIÓ CRÉDITO / FINANCIAMIENTO. En la primera ficha no digas el precio. Pregunta entrada y plazo. No inventes cuota.'
          : 'PIDIÓ CRÉDITO pero no hay unidad confirmada. Pregunta qué vehículo. PROHIBIDO inventar cuotas ni precios.'
      : '';
    const objecionHint = resumenPideNegociar(resumen)
      ? 'PIDIÓ NEGOCIAR / DESCUENTO (o ofreció un monto). Una frase de que el carro está bien (estado, km, documentos). PROHIBIDO descuento, rebaja o aceptar su oferta por este chat. El sistema pega que debe venir a hablarlo con un asesor. Si pidió ubicación, dila en ESTE turno. No vuelvas a mandar la ficha. No inventes un precio más bajo.'
      : objectionOnShown
      ? 'OBJECIÓN de la unidad que YA conoció. No vuelvas a mandar la ficha (color, caja, km, placa, “tenemos disponible”). Contesta la objeción: justifica el valor con estado, kilometraje y garantía en documentos (papeles/traspaso). No inventes garantía mecánica. No rebajes el precio. Usa las secciones OBJECIONES y MANEJOCARO del contexto.'
      : '';
    const locationAsk =
      textAsksForLocation(input.customerText) ||
      resumenAsksForLocation(resumen);
    const locationHint = locationAsk
      ? 'PIDIÓ UBICACIÓN / VISITA (o dudó si hay que pagar para que le den la dirección). Dale Av. España 6-73 y Sevilla, Cuenca AHORA. PROHIBIDO pedir entrada, depósito o confirmar valores para pasar la dirección u otra información. La visita no se condiciona a la entrada. Si preguntó si primero deposita, la respuesta es no.'
      : '';
    const cashDeliveryHint = confirmingCashOrDelivery
      ? 'YA le dijo el $. Ahora confirma lo que pidió: ese valor ES de contado y/o SÍ hay entrega inmediata. PROHIBIDO repetir ficha, km, color ni el $ como si no lo hubiera dicho. No abras crédito. Una o dos frases.'
      : '';
    const hasConfirmedUnit = Boolean(
      revision.sendId ||
        (interested &&
          (stayOnShown ||
            refersToInterestedCar(input.customerText, interested, lexicon))),
    );
    const priceUnloadedHint =
      askedPrice &&
      hasConfirmedUnit &&
      unitPrice == null &&
      listedPriceKnown
        ? 'PIDIÓ EL PRECIO pero en patio está 0 o vacío: AÚN NO CARGADO. Dilo así. PROHIBIDO $0 ni $00. No inventes un valor.'
        : '';
    const precioHint = cuotaYaDicha || financingFollowUp
      ? ''
      : objectionOnShown
      ? ''
      : priceUnloadedHint
        ? priceUnloadedHint
      : justifyPriceAfterFicha
        ? 'YA SE DIO LA FICHA (historial/resumen). Pidió el precio: di el $ de inventario primero. Si también pregunta la ciudad, contéstala en la misma respuesta, después del precio. PROHIBIDO cambiar el tema al kilometraje o al mecánico. PROHIBIDO repetir la ficha (color, caja, tracción, “tenemos disponible”, fotos). No inventes garantía mecánica. No rebajes. Prohibido placa, cuota, cédula si el hilo no las pidió. Usa MANEJOCARO.'
      : canQuotePrice
      ? askedCredit
        ? 'PIDIÓ PRECIO DE CONTADO Y CRÉDITO. Di el precio de inventario (contado) Y abre financiamiento (entrada y plazo) en ESTE turno.'
        : !alreadyShown && unitPrice != null
          ? `EL CLIENTE YA PIDIÓ EL PRECIO en este mensaje. Aunque sea la primera ficha, presenta la unidad y di el precio de inventario: $${unitPrice}. PROHIBIDO omitirlo y prohibido dejar la frase cortada en "y".`
          : 'PIDIÓ EL PRECIO de esta unidad: dilo ($…) SOLO el de inventario. Prohibido inventar. Prohibido placa, cuota, cédula si el hilo no las pidió. Si el resumen también pide cuota o visita, atiende eso.'
      : askedPrice && !hasConfirmedUnit
        ? 'PIDIÓ PRECIO PERO NO HAY UNIDAD CONFIRMADA. Pregunta qué vehículo le interesa. PROHIBIDO inventar un precio. Prohibido $15000 ni cualquier número que no esté en inventario.'
        : !alreadyShown
          ? 'PRIMERA PRESENTACIÓN. PROHIBIDO decir el precio, aunque el resumen lo pida. Presenta unidad, km, color, caja y fotos si toca. El precio solo cuando ya se mostró y lo vuelva a pedir.'
          : selling && !buying
            ? ''
            : 'Si el resumen no pide el precio, no lo digas. Placa solo en la primera presentación de ese carro o si la preguntó. Prohibido placa completa y chasis.';
    const colorHint = askedOtherColor
      ? 'PIDIÓ OTRO COLOR del mismo modelo. Presenta las otras unidades de patio. PROHIBIDO repetir la que ya mostraste. No inventes colores. No sueltes precio si no lo pidió.'
      : '';
    const sentCedulaNow = extractCedula(input.customerText);
    if (sentCedulaNow) {
      await this.persistence.saveLeadCedula(input.contactId, sentCedulaNow);
    }
    const storedCedula = sentCedulaNow
      ? sentCedulaNow
      : await this.persistence.loadLeadCedula(input.contactId);
    const hasCedula = Boolean(
      sentCedulaNow ||
        storedCedula ||
        cedulaFromThread(input.customerText, history),
    );
    const mileageCareHint = historySaidMileageCare(history)
      ? 'Ya dijiste lo del carro cuidado y el mecánico. PROHIBIDO repetirlo. No vuelvas a mencionar mecánico ni “km reales” de respaldo.'
      : '';
    const cedulaHint = sentCedulaNow
      ? 'YA ENVIÓ LA CÉDULA EN ESTE MENSAJE. PROHIBIDO pedirla otra vez. Confirma que un asesor revisa si califica. No repitas el número.'
      : hasCedula
        ? 'YA TENEMOS LA CÉDULA. PROHIBIDO pedirla otra vez.'
        : historyHasShownCuota(history) &&
            resumenAceptaCredito(resumen) &&
            !historyAskedFinancingData(history)
          ? 'El RESUMEN dice que acepta ver si aplica. El sistema pegará cédula, nombre y de dónde es. No adelantes esas preguntas. PROHIBIDO “gestionar esto”.'
          : resumenRechazaAplicar(resumen)
            ? 'El RESUMEN dice que no quiere ver si aplica. El sistema pega un mensaje para que no se vaya. Sigue con el carro. PROHIBIDO insistir con cédula.'
          : historyHasShownCuota(history)
            ? 'YA hubo cuota. Lee el RESUMEN: qué pide AHORA. No pidas cédula si no aceptó ver si aplica.'
            : resumenPrefiereContado(resumen) && !confirmingCashOrDelivery
              ? 'El RESUMEN dice que prefiere de contado. PROHIBIDO crédito, entrada o cuota. El sistema pregunta cuál de las unidades ya mostradas le gusta. Quédate en esas. No insistas con financiamiento.'
              : cashBudget
                ? 'PRESUPUESTO: lista las unidades que caben. El sistema pregunta si quieren crédito o contado. PROHIBIDO armar cuota. PROHIBIDO pregunta de visita en este turno.'
                : '';
    const anuncioHint = adVehicle
      ? `ANUNCIO DE FACEBOOK. El cliente pidió información del ${adVehicle}. Presenta ESA unidad del inventario. Si hay una, mándala (ficha, sin precio). Si hay varias de esa misma línea, nómbralas y pregunta cuál. PROHIBIDO preguntar qué carro le interesa. PROHIBIDO listar otras marcas.`
      : '';
    const pedidoVigente = (
      stayOnShown
        ? [
            anuncioHint,
            revision.text,
            interestedText,
            thanksHint,
            isMoneyNotVisit(input.customerText) &&
            !askedCredit &&
            !confirmingCashOrDelivery
              ? PRECIO_NO_HORARIO
              : '',
            formatVisitHourHint(input.customerText),
            spaceAsk ? formatLargePassengerPedido(spaceText) : '',
            creditoHint,
            colorHint,
            cedulaHint,
            mileageCareHint,
            objecionHint,
            locationHint,
            cashDeliveryHint,
            precioHint,
          ]
        : [
            anuncioHint,
            formatPedidoVigente(
              spaceAsk
                ? null
                : revision.switchedModel
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
            isMoneyNotVisit(input.customerText) &&
            !askedCredit &&
            !confirmingCashOrDelivery
              ? PRECIO_NO_HORARIO
              : '',
            formatVisitHourHint(input.customerText),
            selling ? SU_CARRO_NO_SE_OFRECE : '',
            spaceAsk ? formatLargePassengerPedido(spaceText) : '',
            creditoHint,
            colorHint,
            cedulaHint,
            mileageCareHint,
            objecionHint,
            locationHint,
            cashDeliveryHint,
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
          canQuotePrice || askedPrice,
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
    } else if (
      revision.holdVehicle ||
      (isMoneyNotVisit(input.customerText) && !askedCredit)
    ) {
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
        (!interested || replyId !== interested.inventoryId) &&
        !askedPrice;
      const listedPrice =
        askedPrice && unitPrice != null ? unitPrice : null;
      const cleaned = stripUnsolicitedPriceAndPlate(parsed.mensaje, {
        keepPrice:
          canQuotePrice || listedPrice != null || confirmingCashOrDelivery,
        keepPlateShort: askedPlate || firstPresentation,
      });
      if (cleaned !== parsed.mensaje || (!canQuotePrice && messageLeaksPrice(parsed.mensaje))) {
        this.logger.warn(
          `Se quitó dato no pedido contactId=${input.contactId}`,
        );
      }
      parsed.mensaje = historySaidMileageCare(history)
        ? stripRepeatedMileageCare(cleaned)
        : cleaned;
      parsed.mensaje = stripGestionarOffer(parsed.mensaje);
      const showedCuotaNow =
        parsed.meta.cuotaMostrada || replyShowsCuota(parsed.mensaje);
      if (showedCuotaNow) {
        parsed.mensaje = stripPrematureIdentityAsk(parsed.mensaje);
      }
      if (
        shouldAskIfApplies({
          showedCuotaNow,
          hasCedula,
          history,
          reply: parsed.mensaje,
        })
      ) {
        parsed.mensaje = appendApplyAsk(parsed.mensaje);
      } else if (
        shouldAskFinancingData({
          history,
          aceptaCredito: resumenAceptaCredito(resumen),
          hasCedula,
          reply: parsed.mensaje,
        })
      ) {
        parsed.mensaje = appendFinancingDataAsk(parsed.mensaje);
      } else if (
        shouldEncourageAfterDecline({
          history,
          rechazaAplicar: resumenRechazaAplicar(resumen),
          hasCedula,
          reply: parsed.mensaje,
        })
      ) {
        parsed.mensaje = appendFinancingDecline(parsed.mensaje);
      }
      const listedBudgetNow =
        Boolean(cashBudget) && revision.text.includes('PRESUPUESTO DE CONTADO');
      if (
        shouldAskBudgetFinancing({
          listedBudgetNow,
          history,
          reply: parsed.mensaje,
        })
      ) {
        parsed.mensaje = appendBudgetFinancingAsk(parsed.mensaje);
      } else if (
        shouldAskWhichShown({
          prefiereContado: resumenPrefiereContado(resumen),
          alreadyPicked: Boolean(
            detectNamedModelAsk(input.customerText, lexicon),
          ),
          history,
          reply: parsed.mensaje,
        })
      ) {
        parsed.mensaje = appendBudgetPickShown(parsed.mensaje);
      }
      if (
        shouldSayNegotiateInPerson({
          pideNegociar: resumenPideNegociar(resumen),
          history,
          reply: parsed.mensaje,
        })
      ) {
        parsed.mensaje = appendNegotiateInPerson(parsed.mensaje);
      }
      parsed.mensaje = ungateLocationReply(parsed.mensaje);
      if (confirmingCashOrDelivery) {
        parsed.mensaje = ensureCashDeliveryConfirm(
          parsed.mensaje,
          lastAssistantMsg?.content,
        );
      }
      if (listedPrice != null) {
        parsed.mensaje = ensureListedPrice(parsed.mensaje, listedPrice);
        parsed.meta.precioMostrado = true;
      } else if (
        askedPrice &&
        hasConfirmedUnit &&
        unitPrice == null &&
        listedPriceKnown
      ) {
        parsed.mensaje = appendUnloadedPrice(parsed.mensaje);
        parsed.meta.precioMostrado = false;
      }
      if (
        hasCedula &&
        (replyAsksForCedula(parsed.mensaje) ||
          replyAsksFinancingData(parsed.mensaje))
      ) {
        const carLabel = interested
          ? [interested.brand, interested.model, interested.year]
              .filter(Boolean)
              .join(' ')
          : '';
        parsed.mensaje = confirmCedulaReceived(carLabel);
        this.logger.warn(
          `Se evitó pedir cédula otra vez contactId=${input.contactId}`,
        );
      }
      if (!canQuotePrice && listedPrice == null) {
        parsed.meta.precioMostrado = false;
        if (parsed.meta.vehiculo && !parsed.meta.vehiculo.inventory_id) {
          parsed.meta.vehiculo = null;
        }
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

  /** Clic de Facebook sin carro en el título: una pregunta, sin listado. */
  private async replyAskWhichCar(
    contactId: string,
    customerText: string,
  ): Promise<AgentTurnResult> {
    const mensaje = 'Claro. ¿Qué carro le interesa?';
    const reply: ParsedAgentOutput = {
      mensaje,
      meta: {
        precioMostrado: false,
        cuotaMostrada: false,
        vehiculo: null,
      },
      img_prefix: '',
    };
    await this.conversation.appendMessage(contactId, {
      role: 'user',
      content: customerText,
    });
    await this.conversation.appendMessage(contactId, {
      role: 'assistant',
      content: mensaje,
    });
    await this.persistence.appendChatHistory({
      contactId,
      human: customerText,
      ai: serializeAgentTurn(reply),
    });
    return { reply, resumen: customerText };
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
    reference: {
      price: number | null;
      family: string | null;
      color?: string | null;
      inventoryId?: string | null;
    } | null,
    lexicon: VehicleLexicon,
    spaceAsk = false,
    askedOtherColor = false,
    resumen = '',
  ): Promise<BrandReview> {
    const empty: BrandReview = { text: '', holdVehicle: false, sendId: null };
    const fromText = detectNamedModelAsk(customerText, lexicon);
    const fromSolicitud = detectNamedModelAsk(
      parseResumen(resumen).solicitudActual ?? '',
      lexicon,
    );
    const asked =
      (fromText && !isDriveFamily(fromText.family) ? fromText : null) ??
      (fromSolicitud && !isDriveFamily(fromSolicitud.family)
        ? fromSolicitud
        : null);
    const pideOtras = resumenPideOtras(resumen);
    const cashBudgetEarly = asked ? null : detectCashBudget(customerText);
    const wantsListedPrices = /\bprecios?\b/i.test(customerText);
    const yearPick = asked?.year ?? detectYearInText(customerText);
    const colorPick = detectColorInText(customerText);
    const targetBrand = asked?.brand || brand;
    if (
      !targetBrand &&
      !asked &&
      !spaceAsk &&
      !askedOtherColor &&
      !cashBudgetEarly &&
      !wantsListedPrices &&
      !yearPick &&
      !colorPick &&
      !pideOtras
    ) {
      return empty;
    }

    const namesBrandNow = Boolean(detectBrand(customerText, lexicon));
    const maybeAsk =
      isConcreteAsk(customerText) ||
      (Boolean(concreteAsk) && namesBrandNow) ||
      spaceAsk ||
      askedOtherColor ||
      Boolean(cashBudgetEarly) ||
      wantsListedPrices ||
      pideOtras;
    if (
      !asked &&
      !maybeAsk &&
      !namesBrandNow &&
      !mightNameModel(customerText)
    ) {
      return empty;
    }

    const listed = targetBrand
      ? await this.catalog.listByBrand(targetBrand)
      : await this.catalog.listAvailableExcept('_');
    if (spaceAsk && !asked) {
      let pool = pickLargePassengerCars(listed);
      if (pool.length === 0) {
        const others = await this.catalog.listAvailableExcept(targetBrand || '_');
        pool = pickLargePassengerCars(others);
      }
      return {
        text: formatLargePassengerRevision(
          `${customerText}\n${concreteAsk ?? ''}`,
          pool,
          includePrice,
        ),
        holdVehicle: true,
        sendId: null,
      };
    }
    const cashBudget = asked ? null : detectCashBudget(customerText);
    if (cashBudget) {
      const patio = await this.catalog.listAvailableExcept('_');
      const hits = carsInBudget(patio, cashBudget, reference?.inventoryId);
      return {
        ...formatBudgetRevision({
          budget: cashBudget,
          cars: hits,
          over: reference
            ? { family: reference.family, price: reference.price }
            : undefined,
        }),
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(hits),
      };
    }
    if (pideOtras && !asked) {
      const patio = await this.catalog.listAvailableExcept('_');
      const exceptId = reference?.inventoryId;
      let pool = patio.filter((car) => car.id !== exceptId);
      if (vehicleKind) {
        const typed = pool.filter((car) =>
          matchesVehicleKind(car.typeBody, vehicleKind),
        );
        if (typed.length > 0) {
          pool = typed;
        }
      }
      const refPrice = reference?.price ?? 0;
      pool.sort(
        (a, b) =>
          Math.abs((a.price ?? 0) - refPrice) -
          Math.abs((b.price ?? 0) - refPrice),
      );
      if (pool.length === 0) {
        return {
          text: 'PIDIÓ OTRAS unidades. No hay otra en patio de ese tipo. Dilo. vehiculo null. PROHIBIDO volver a la que ya vio.',
          holdVehicle: true,
          sendId: null,
          switchedModel: true,
        };
      }
      const named = formatNamedUnits(
        pool.length > 6 ? pool.slice(0, 6) : pool,
        includePrice,
      );
      return {
        ...named,
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(pool),
        text: `${named.text}
PIDIÓ OTRAS, no la unidad que ya vio. Nombra ESTAS. PROHIBIDO volver a presentarla. No pidas permiso para mostrarlas.`,
      };
    }
    if (askedOtherColor && !detectColorInText(customerText) && reference?.family) {
      let pool = listed.filter((car) =>
        textMentionsModel(car.model, reference.family ?? ''),
      );
      if (pool.length === 0) {
        const others = await this.catalog.listAvailableExcept(
          targetBrand || '_',
        );
        pool = others.filter((car) =>
          textMentionsModel(car.model, reference.family ?? ''),
        );
      }
      const others = pool.filter((car) => {
        if (reference.inventoryId && car.id === reference.inventoryId) {
          return false;
        }
        if (
          reference.color &&
          car.color &&
          colorMatches(car.color, reference.color)
        ) {
          return false;
        }
        return true;
      });
      const shown = reference.color ? ` (${reference.color})` : '';
      const toName = preferCurrentYears(
        others,
        detectYearInText(customerText),
      );
      if (toName.length === 0) {
        return {
          text: `PIDIÓ OTRO COLOR del ${reference.family}. No hay otro color en patio. Dilo. No inventes colores. No vuelvas a presentar la misma unidad${shown}. No sueltes precio si no lo pidió.`,
          holdVehicle: true,
          sendId: null,
        };
      }
      const named = formatNamedUnits(toName, includePrice);
      return {
        ...named,
        switchedModel: false,
        vehicleKind: kindOfNamedUnits(toName),
        text: `${named.text}
PIDIÓ OTRO COLOR del ${reference.family}. Nombra ESTAS unidades (colores distintos a la que ya vio${shown}). PROHIBIDO repetir la misma unidad. No sueltes precio si no lo pidió.`,
      };
    }
    const yearAsk = asked ? asked.year : detectYearInText(customerText);
    const colorAsk = detectColorInText(customerText);
    const trimAsk = detectTrimInText(customerText);
    const wantsClosest = Boolean(asked) && asksClosestByFacts(customerText);
    const priorUserTexts = history
      .filter((item) => item.role === 'user')
      .map((item) => item.content);
    const yearFromThread = yearAsk ?? lastYearInUserTexts(priorUserTexts, lexicon);
    const threadText = shownThreadText(history, resumen);
    const alreadyOffered = carsShownInHistory(history, listed, resumen);
    if (!asked && wantsListedPrices && alreadyOffered.length > 0) {
      const named = formatNamedUnits(alreadyOffered, true);
      return {
        ...named,
        holdVehicle: alreadyOffered.length !== 1,
        sendId: alreadyOffered.length === 1 ? alreadyOffered[0].id : null,
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(alreadyOffered),
        text: `${named.text}
PIDIÓ LOS PRECIOS de las unidades que YA le mostró. Di el $ de inventario de CADA una. Prohibido placa si no la pidió. Prohibido inventar.`,
      };
    }
    if ((yearAsk || colorAsk || trimAsk) && !wantsClosest) {
      const offered = asked
        ? alreadyOffered.filter((car) =>
            textMentionsModel(car.model, asked.family),
          )
        : alreadyOffered;
      const fromOffer = yearAsk
        ? pickShownByYear(
            matchUnitFacts(offered, null, colorAsk, trimAsk),
            threadText,
            yearAsk,
          )
        : matchUnitFacts(offered, yearAsk, colorAsk, trimAsk);
      const known = fromOffer.filter((car) => hasUsableFicha(car));
      if (known.length === 1) {
        const named = formatNamedUnits(known, includePrice);
        return {
          ...named,
          text: `${named.text}
El cliente ELIGIÓ esta unidad de las que YA le mostramos en el hilo. Ya hay ficha: no busques de nuevo ni la presentes como otra. PROHIBIDO decir que no hay, que no tenemos o “lo más cercano”. Prohibido pedir entrada, plazo o cuota si el hilo no lo pidió. Prohibido meter otra línea.`,
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(known),
        };
      }
      if (known.length > 1) {
        const named = formatNamedUnits(known, includePrice);
        return {
          ...named,
          text: `${named.text}
El cliente eligió entre las unidades que YA le mostramos en el hilo. Nombra ESA selección. Prohibido decir que no hay ni reabrir patio.`,
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(known),
        };
      }
      const inferredFamily =
        detectNamedModelAsk(threadText, lexicon)?.family ||
        [...priorUserTexts]
          .reverse()
          .map((text) => detectNamedModelAsk(text, lexicon)?.family)
          .find(Boolean) ||
        reference?.family ||
        '';
      const threadFamily = asked?.family || inferredFamily;
      if (
        !asked ||
        (Boolean(inferredFamily) && asked.family === inferredFamily)
      ) {
        if (threadFamily && !trimAsk) {
          const inFamily = listed.filter((car) =>
            textMentionsModel(car.model, threadFamily),
          );
          const picked = matchUnitFacts(inFamily, yearAsk, colorAsk, null);
          if (picked.length === 1) {
            return this.namedModelFound(picked, includePrice, false, false, yearAsk);
          }
          if (picked.length > 1) {
            return {
              ...formatNamedUnits(
                preferCurrentYears(picked, yearAsk),
                includePrice,
              ),
              switchedModel: true,
              vehicleKind: kindOfNamedUnits(picked),
            };
          }
          if (yearAsk) {
            const missingYear = formatMissingNamedModel(
              threadFamily,
              yearAsk,
              carsNearYear(inFamily, yearAsk),
              includePrice,
            );
            return {
              ...missingYear,
              text: `${missingYear.text}
Pidió otro año del MISMO modelo. Solo esas unidades. PROHIBIDO otra línea de la marca.`,
              switchedModel: true,
              vehicleKind: kindOfNamedUnits(inFamily),
            };
          }
        }
        const byFacts = matchUnitFacts(listed, yearAsk, colorAsk, trimAsk);
        if (byFacts.length === 1) {
          return this.namedModelFound(byFacts, includePrice, false, false, yearAsk);
        }
        if (byFacts.length > 1) {
          return {
            ...formatNamedUnits(
              preferCurrentYears(byFacts, yearAsk),
              includePrice,
            ),
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
    }
    const saidBox = detectGearbox(customerText, lexicon);
    if (wantsClosest && asked) {
      const fromEmbed = await this.lookupNamedByEmbedding(
        customerText,
        asked.family,
        asked.brand || targetBrand || '',
        listed,
        includePrice,
      );
      if (fromEmbed.length > 0) {
        return this.namedModelFound(
          fromEmbed,
          includePrice,
          true,
          true,
          yearFromThread,
        );
      }
    }
    if (saidBox && alreadyOffered.length > 0 && !asked) {
      const offered = alreadyOffered;
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
      let offer = preferCurrentYears(
        boxed.length > 0 ? boxed : namedNow,
        yearFromThread,
      );
      if (wantsClosest) {
        return this.namedModelFound(
          offer,
          includePrice,
          false,
          true,
          yearFromThread,
        );
      }
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
            return this.namedModelFound(
              yearFromEmbed,
              includePrice,
              true,
              false,
              yearFromThread,
            );
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
              false,
              yearFromThread,
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
      return this.namedModelFound(
        offer,
        includePrice,
        false,
        false,
        yearFromThread,
      );
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
        return this.namedModelFound(
          fromEmbed,
          includePrice,
          true,
          false,
          asked.year,
        );
      }
      const elsewhere = await this.familyInOtherBrands(
        asked.family,
        asked.year,
        targetBrand,
      );
      if (elsewhere.length > 0) {
        return this.namedModelFound(
          elsewhere,
          includePrice,
          false,
          false,
          asked.year,
        );
      }
      const sameFamily = listed.filter((car) =>
        textMentionsModel(car.model, asked.family),
      );
      let alternatives =
        asked.year && sameFamily.length > 0
          ? carsNearYear(sameFamily, asked.year)
          : sameFamily;
      if (alternatives.length === 0) {
        const except = {
          inventoryId: reference?.inventoryId,
          family: reference?.family,
        };
        alternatives = pickClosestToMissingModel(
          listed,
          asked.family,
          except,
        );
        if (alternatives.length === 0) {
          const patio = await this.catalog.listAvailableExcept('_');
          alternatives = pickClosestToMissingModel(
            patio,
            asked.family,
            except,
          );
        }
      }
      alternatives = preferCurrentYears(alternatives, asked.year);
      const missing = formatMissingNamedModel(
        asked.family,
        asked.year,
        alternatives,
        includePrice,
      );
      return {
        ...missing,
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(alternatives) ?? vehicleKind,
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
        return formatNamedUnits(
          preferCurrentYears(namedNow, yearFromThread),
          includePrice,
        );
      }
      if (includePrice && cars.length > 0) {
        return formatNamedUnits(
          preferCurrentYears(cars, yearFromThread),
          includePrice,
        );
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

  /** Dato de ficha de la unidad ya mostrada: investiga ese modelo y año. */
  private async specNotesForShown(
    ask: string,
    car: InterestedCarSnapshot,
  ): Promise<string> {
    const topic = specTopic(ask);
    if (!topic) {
      return '';
    }
    const listed = car.brand
      ? await this.catalog.listByBrand(car.brand)
      : [];
    const fromPatio = listed.find((item) => item.id === car.inventoryId);
    const patioCapacity =
      (fromPatio?.passengerCapacity ?? car.passengerCapacity) != null &&
      String(fromPatio?.passengerCapacity ?? car.passengerCapacity).trim()
        ? String(fromPatio?.passengerCapacity ?? car.passengerCapacity)
        : '';
    const stock: StockCar = fromPatio ?? {
      id: car.inventoryId,
      brand: car.brand,
      model: car.model,
      year: car.year,
      price: car.price,
      typeBody: car.typeBody ?? null,
      color: car.color,
      mileage: car.mileage,
      transmission: car.transmission,
      passengerCapacity: patioCapacity || null,
      plateShort: car.plateShort,
    };
    const facts = await this.collectSpecFacts(ask, [stock]);
    const rule =
      topic === 'filas' && patioCapacity
        ? `El patio trae passenger_capacity=${patioCapacity}. Ese dato manda. 3p/4p/5p son PUERTAS, no filas. No inventes.`
        : `PREGUNTÓ UN DATO DE FICHA de ESTA unidad (${car.brand} ${car.model}${car.year ? ` ${car.year}` : ''}). Usa solo la investigación. 3p/4p/5p son PUERTAS, no filas ni equipo. Si no hay dato, dilo: no consta. PROHIBIDO inventar. PROHIBIDO rellenar con km, mecánico o “carro cuidado” si no lo pidió.`;
    return [formatSpecNotes(facts), rule].filter(Boolean).join('\n');
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
          vehiculos: carsForReview(pending),
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
    closest = false,
    askedYear?: number | null,
  ): BrandReview {
    const shown = preferCurrentYears(cars, askedYear);
    const named = formatNamedUnits(shown, includePrice);
    const via = fromEmbed ? ' (búsqueda por inventario)' : '';
    const rule = closest
      ? `Estas son las más cercanas del patio a lo que pidió${via}. Preséntalas. Dilo en qué se parecen y en qué no (tracción, combustible, año). PROHIBIDO decir que no hay, que no tienes unidad exacta o que no hay fotos si hay ficha. PROHIBIDO otra línea.`
      : `Este modelo SÍ está en patio${via}. Prohibido decir que no está disponible. No inventes que pidió automática/manual si no lo dijo ahora. No pases a otra marca. PROHIBIDO nombrar otra línea (otra pickup u otro modelo). Solo las unidades de arriba. Si ya hay año, manda ESA unidad; no listes las demás.`;
    return {
      ...named,
      text: `${named.text}
${rule}`,
      switchedModel: true,
      vehicleKind: kindOfNamedUnits(shown),
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
