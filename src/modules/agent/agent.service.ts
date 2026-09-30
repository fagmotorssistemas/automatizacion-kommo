import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { ConversationService } from '../conversation/conversation.service';
import { getDealershipClock, hourInGuayaquil } from '../intelligence/dealership-hours';
import { formatHoursAskHint } from '../intelligence/dealership-hours';
import {
  entregadoEnHilo,
  formatEntregadoForPedido,
} from '../conversation/entregado-en-hilo';
import { formatVisitHourHint, isMoneyNotVisit, PRECIO_NO_HORARIO } from '../intelligence/visit-hours';
import {
  calcularFinanciamiento,
  calcularFinanciamientoBancario,
  FinanciamientoInput,
  formatFinancingQuote,
} from '../intelligence/financiamiento';
import {
  cedulaFromThread,
  cedulaIdentityFromText,
  confirmCedulaReceived,
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
  hasFacebookMoreInfoClick,
  isFacebookMoreInfoOpener,
} from '../inbox/first-touch';
import { intentsSystemPrompt } from './prompts/intents.prompt';
import { HANDOFF_SUMMARIZER_SYSTEM_PROMPT } from './prompts/handoff-summarizer.prompt';
import { RESUMEN_SYSTEM_PROMPT } from './prompts/resumen.prompt';
import { salesSystemPrompt } from './prompts/sales.prompt';
import {
  extraerNumeros,
  formatNumerosLog,
  hechoDesdeFila,
  idsDesdeToolJson,
  intentarCargarHechos,
  numerosInvalidos,
  reunirInventoryIds,
  validarNumerosSoloRegistro,
  type ContextoNumeros,
  type CorreccionNumero,
} from './validar-numeros';
import {
  armarUnidadesContexto,
  type UnidadContexto,
} from './unidades-contexto';
import {
  asksAnyBrand,
  detectVehicleKind,
  formatPedidoVigente,
  formatSoloTipoPedido,
  kindFromTypeBody,
  lastOfferedOtherOptions,
  matchesVehicleKind,
  parseVehicleKind,
  resolveVehicleKind,
  VehicleKind,
} from '../conversation/vehicle-kind';
import {
  colorMatches,
  detectBrand,
  detectBrands,
  detectColorInText,
  detectNamedModelAsk,
  detectTresFilas,
  resolveTresFilas,
  askedModelPhrase,
  carsMatchingName,
  nombresSeparados,
  detectTrimInText,
  detectYearInText,
  detectYearSpan,
  isDriveFamily,
  modelHasTrim,
  modelPhraseMatchesCar,
  resolveBrand,
  type VehicleLexicon,
} from '../conversation/vehicle-brand';
import {
  bodyGroupOf,
  carBodyGroup,
  detectGearbox,
  formatGearboxAlternatives,
  formatGearboxPedido,
  formatOtherBrandGearboxList,
  formatPatioKindList,
  gearboxOf,
  Gearbox,
  pickDiverseByBrand,
  pickGearboxAlternatives,
  resolveGearbox,
  stripGearboxWords,
} from '../conversation/gearbox';
import {
  asksClosestByFacts,
  asksYearOnward,
  isConcreteAsk,
  resolveConcreteAsk,
} from '../conversation/concrete-ask';
import { resolveThreadYear } from '../conversation/thread-year';
import {
  formatGreetingPedido,
  shouldOfferGreeting,
} from '../conversation/day-greeting';
import {
  appendUnloadedPrice,
  asksForPlate,
  ensureListedSetPrices,
  hasLoadedPrice,
  isStrippedReplyStub,
  type ListedSetUnit,
  parsePricedUnitsFromReview,
  stripShownUnitCashPrice,
  stripUnsolicitedPriceAndPlate,
} from '../conversation/strip-unsolicited-price';
import {
  appendNegotiateInPerson,
  shouldSayNegotiateInPerson,
} from '../conversation/negotiate-in-person';
import {
  appendMapLink,
  dropRepeatedAddress,
  dropUnsolicitedHours,
  hasDealershipAddress,
  ungateLocationReply,
} from '../conversation/location-without-entrada';
import { stripInventedHoliday } from '../conversation/strip-invented-holiday';
import { resumenBrandFitsShown, textoQueNombra } from '../conversation/named-this-turn';
import {
  buildTurnPlan,
  turnPlanLog,
  type LegacyPath,
  type TurnPlanInput,
  type TurnPlanLog,
} from '../intelligence/turn-plan';
import { ensureCashDeliveryConfirm } from '../conversation/cash-delivery';
import { DESPEDIDA_AMABLE, salesFollowHint } from '../conversation/polite-thanks';
import {
  askedOutsideListed,
  askedOtherBrandThanListed,
  formatListedPhotoQueue,
  formatOtrasOptionsMessage,
  historyHasUnitList,
  lastListedUnits,
  lastOfferAssistantText,
  lastOfferIsUnitList,
  lastSingleShownUnit,
  looksLikeUnitList,
  pickListedUnit,
  toPhotoQueue,
  wantsPhotosOfListed,
  type PhotoQueueItem,
} from '../conversation/listed-photos';
import {
  historyAlreadyGaveCuota,
  historyHasListedPrice,
  isThreadAck,
  postponesBiggerDownPayment,
  resumenAceptaCredito,
  resumenPideNegociar,
  resumenPideOtras,
  resumenCajaCompra,
  resumenCabina,
  mergeResumenForNext,
  resumenFaltaVehiculo,
  vehicleQueSigue,
  resumenOtroVehiculo,
  resumenPideHorario,
  resumenStaysOnShownUnit,
  resumenAsientos,
  resumenTresFilas,
  resumenTipoPatio,
  resumenTraccionPedida,
  resumenTopeContado,
  resumenPidePresupuesto,
  resumenEsToma,
  resumenTomaFicha,
  stripTomaFacts,
  resumenAsksForLocation,
  resumenPideFicha,
  resumenPrefiereContado,
  resumenAsksForImmediateDelivery,
  resumenRechazaAplicar,
  resumenAsksForCredit,
  resumenAsksForListedPrice,
  resumenAsksForOtherColor,
  solicitudSinBanderas,
  resumenHasPendingDoubt,
  resumenIsCourtesy,
  resumenIsThreadAck,
  resumenIsFarewell,
  resumenIsPriceObjection,
  textAsksForCredit,
  textAsksForImmediateDelivery,
  textAsksForOtherColor,
  textIsPriceObjection,
} from '../intelligence/parse-resumen';
import {
  otrasDiferidas,
  sanitizeInventedResumenFlags,
} from '../intelligence/sanitize-resumen-flags';
import {
  ensureListedPrice,
  historySaidMileageCare,
  stripRepeatedMileageCare,
} from '../catalog/mileage';
import {
  askedMatchesShownModel,
  formatInterestedCar,
  historyPresentedFicha,
  refersToInterestedCar,
  stayLeaveBandera,
  stayBanderaSinEvidencia,
  vehicleLabelFitsCar,
} from '../conversation/interested-car';
import {
  buildVerifOtroUser,
  consultarOtroEsLaMostrada,
  debeConsultarRpcOtro,
  decideStayOnShown,
  evidenciaReal,
  formatStayLog,
  mismaUnidadPorFila,
  parseVerifOtroJson,
  patioFamiliesCacheFresh,
  sospechaOtroVehiculo,
  StayDecisionStore,
  VERIF_OTRO_SYSTEM_PROMPT,
  VERIF_OTRO_TIMEOUT_MS,
  type StayFila1Decision,
} from '../conversation/otro-vehiculo';
import { respuestaAclaraAnioNoExiste } from './falta-aclarar-no-existe';
import { withTimeout } from '../inbox/with-timeout';
import { AGENT_TURN_TIMEOUT_MS } from '../inbox/inbox.constants';
import {
  asksForLargePassengerSpace,
  formatLargePassengerPedido,
  formatLargePassengerRevision,
  pickCarsWithMinSeats,
  pickLargePassengerCars,
  pickTresFilasCandidates,
  seatsFromDato,
  seatsOfCar,
} from '../conversation/large-passenger';
import {
  coincidenUnidad,
  contarHechos,
  hechosDesdeTexto,
} from '../catalog/coinciden-unidad';
import {
  carsFromYearOnward,
  carsInYearSpan,
  carsShownInHistory,
  formatRevisionMarca,
  formatMissingNamedModel,
  yearNamesTheModel,
  formatNamedUnits,
  hasUsableFicha,
  preferCurrentYears,
  prettyFamily,
  modelFamily,
  detectAskedCab,
  detectAskedDrive,
  kindFromStockFamily,
  pickCabDriveOffer,
  pickClosestToMissingModel,
  pickSpanAlternatives,
  pickShownByYear,
  unitDrive,
  shownThreadText,
  StockCar,
  normalizeModelText,
  rowMentionsFamily,
  textMentionsModel,
  userNamedModel,
} from '../catalog/clasificar-filas';
import {
  appendBudgetFinancingAsk,
  appendBudgetPickShown,
  carFitsBudget,
  carsInBudget,
  carsMatchingAskInBudget,
  formatBudgetRevision,
  shouldAskBudgetFinancing,
  shouldAskWhichShown,
} from '../conversation/budget';
import {
  appendApplyAsk,
  appendFinancingDataAsk,
  appendFinancingDecline,
  financingInputsFromThread,
  gaveFinancingInputs,
  historyAskedFinancingData,
  historyAskedIfApplies,
  historyHasShownCuota,
  mergeFinancingQuote,
  replyAsksFinancingData,
  replyShowsCuota,
  shouldAskFinancingData,
  shouldAskIfApplies,
  shouldEncourageAfterDecline,
  stripGestionarOffer,
  stripPrematureApplyAsk,
  stripPrematureIdentityAsk,
  stripRepeatedCuotaOnAccept,
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
  turnAlsoWantsToBuy,
  turnIsSellingTheirCar,
} from './su-carro';
import {
  applyInboundTomaPhotos,
  formatTomaPedido,
  mergeTomaChecklist,
  parseTomaChecklistFromResumen,
} from '../conversation/toma-checklist';

function unidadesParaTurno(
  unidades: UnidadContexto[],
): { unidadesContexto: UnidadContexto[] } | Record<string, never> {
  return unidades.length ? { unidadesContexto: unidades } : {};
}

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
  listedUnits?: StockCar[];
  switchedModel?: boolean;
  vehicleKind?: VehicleKind | null;
  photoQueue?: PhotoQueueItem[];
  choseFromShown?: boolean;
  contextOrigin?: 'alternativas_caja';
  contextIds?: string[];
  noCoincideAnio?: {
    pedido: string;
    ofrecido: string;
    anioPedido: number;
  };
};

function notaDistintoHechos(input: {
  distinto: string[];
  brand: string;
  model: string;
  yearPedido: number | null;
  yearOfrecido: number | null;
}): string {
  const familia = modelFamily(input.model) || input.model;
  const compact = familia.replace(/-/g, '');
  const bits: string[] = [];
  if (input.distinto.includes('año') && input.yearPedido != null) {
    bits.push(
      `El cliente pidió ${input.brand} ${familia} ${input.yearPedido}. Ese año NO está en patio. Di primero, en una frase, que no tenemos el ${familia} ${input.yearPedido}. Luego presenta la unidad que sí hay, diciendo su año. No digas que no tenemos el modelo: sí hay uno de otro año. No hay ${compact} ${input.yearPedido}. PROHIBIDO otra línea.`,
    );
  }
  if (input.distinto.includes('color')) {
    bits.push(
      `El cliente pidió ${input.brand} ${familia} en otro color. Ese color NO está en patio. Di primero, en una frase, que no tenemos ese color. Luego presenta la unidad que sí hay, diciendo su color. No digas que no tenemos el modelo: sí hay uno de otro color.`,
    );
  }
  if (input.distinto.includes('transmisión')) {
    bits.push(
      `El cliente pidió ${input.brand} ${familia} con otra versión. Esa versión NO está en patio. Di primero, en una frase, que no tenemos esa versión. Luego presenta la unidad que sí hay, diciendo su versión. No digas que no tenemos el modelo: sí hay uno de otra versión.`,
    );
  }
  if (bits.length === 0) {
    return `No coincide: ${input.distinto.join(', ')}. Di el dato de esta ficha. PROHIBIDO decir que no está el carro ni volver a otra unidad.`;
  }
  return bits.join(' ');
}

/** "La 2018" no es un Peugeot 2008: el año dicho no es esa familia. */
function familyIsOtherYear(text: string, family: string): boolean {
  if (!/^(?:19|20)\d{2}$/.test(family)) {
    return false;
  }
  const years = [...text.matchAll(/\b((?:19|20)\d{2})\b/g)].map(
    (match) => match[1],
  );
  return years.length > 0 && !years.includes(family);
}

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
  yearOnward = false,
  yearMax: number | null = null,
): StockCar[] {
  return cars.filter((car) => {
    if (yearAsk) {
      if (car.year == null) {
        return false;
      }
      if (yearMax != null) {
        if (car.year < yearAsk || car.year > yearMax) {
          return false;
        }
      } else if (yearOnward ? car.year < yearAsk : car.year !== yearAsk) {
        return false;
      }
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

/** Si pidió un año y no está, no ofrezcas uno 20 años más viejo. */
function carsNearYear(cars: StockCar[], year: number, delta = 3): StockCar[] {
  return cars.filter(
    (car) => car.year != null && Math.abs(car.year - year) <= delta,
  );
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

/** Dos años en el título = catálogo/carrusel, no una unidad. */
function adLabelIsCatalog(label: string): boolean {
  return (label.match(/\b(?:19|20)\d{2}\b/g) ?? []).length >= 2;
}

/** Título del anuncio si nombra UN carro. Vacío si es clic, botón o catálogo. */
function facebookOpenerVehicle(
  text: string,
  lexicon: VehicleLexicon,
): string | null {
  if (!hasFacebookMoreInfoClick(text)) {
    return null;
  }
  const label = facebookAdLabel(text);
  if (!label || isCtaAdLabel(label) || adLabelIsCatalog(label)) {
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

/**
 * Palabras gramaticales: no se tratan como nombre de modelo.
 * Si el cliente pide el valor u otra cosa, lo decide el resumen, no esta lista.
 */
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
  private readonly stayDecisions = new StayDecisionStore();

  constructor(
    private readonly openai: OpenAiAgentClient,
    private readonly catalog: CatalogService,
    private readonly conversation: ConversationService,
    private readonly persistence: PersistenceService,
  ) {}

  takeStayDecision(contactId: string): StayFila1Decision | null {
    return this.stayDecisions.take(contactId);
  }

  async handleTurn(input: {
    contactId: string;
    customerText: string;
  }): Promise<AgentTurnResult | null> {
    if (!isRealCustomerText(input.customerText)) {
      this.stayDecisions.discard(input.contactId);
      return null;
    }
    this.stayDecisions.discard(input.contactId);

    const lexicon = await this.catalog.getLexicon();
    const adVehicle = facebookOpenerVehicle(input.customerText, lexicon);
    const bareMoreInfo =
      isFacebookMoreInfoOpener(input.customerText) && !adVehicle;

    if (!this.openai.isReady()) {
      throw new Error('OPENAI_API_KEY vacío; no se llama al modelo');
    }
    const history = await this.recentDialogue(input.contactId);
    const lastSeenAt = await this.conversation.loadLastSeen(input.contactId);
    const offerGreeting = shouldOfferGreeting({
      lastSeenAt,
      hasHistory: history.length > 0,
    });
    const saludoHint = formatGreetingPedido(
      offerGreeting,
      hourInGuayaquil(),
    );
    let interested = await this.persistence.latestInterestedCar(
      input.contactId,
    );
    const handoffBrief = await this.attachHandoffBrief(
      input.contactId,
      history,
    );
    const rememberedToma = await this.conversation.loadTomaChecklist(
      input.contactId,
    );
    const rememberedBudget = await this.conversation.loadCashBudget(
      input.contactId,
    );
    const previousResumen = await this.conversation.loadPreviousResumen(
      input.contactId,
    );

    // Registro de lo que el bot ya entregó (texto del bot, no del cliente).
    const entregado = entregadoEnHilo(history, {
      unitPrice:
        interested?.price && interested.price > 0
          ? Math.round(interested.price)
          : null,
    });
    const resumenInput = buildResumenInput({
      history,
      customerText: input.customerText,
      handoffBrief,
      tomaChecklist: rememberedToma,
      cashBudget: rememberedBudget,
      previousResumen,
      entregado,
    });
    const lastAssistantForFlags =
      [...history].reverse().find((item) => item.role === 'assistant')
        ?.content ?? '';
    const resumen = sanitizeInventedResumenFlags(
      (await this.openai.complete(RESUMEN_SYSTEM_PROMPT, resumenInput)) ??
        input.customerText,
      input.customerText,
      lastAssistantForFlags,
    );
    const nombra = textoQueNombra(resumen, input.customerText, lexicon);
    const brandSaidNow = detectBrand(nombra, lexicon);
    let pedido = detectNamedModelAsk(nombra, lexicon)
      ? null
      : vehicleQueSigue(resumen, previousResumen);
    if (pedido && brandSaidNow) {
      const pedidoBrand = detectBrand(pedido, lexicon);
      if (pedidoBrand && pedidoBrand !== brandSaidNow) {
        pedido = null;
      }
    }
    const nextResumen = mergeResumenForNext(resumen, previousResumen);
    if (nextResumen) {
      await this.conversation.savePreviousResumen(input.contactId, nextResumen);
    }
    const cajaCompra = resumenCajaCompra(resumen);
    // Ya no hay salida rápida de «¿qué carro?»: siempre responde el agente, que
    // contesta todo lo pedido y cierra preguntando el carro (faltaCarroHint).
    await this.conversation.appendMessage(input.contactId, {
      role: 'user',
      content: input.customerText,
    });
    const vehicleKind = await this.rememberVehicleKind(
      input.contactId,
      history,
      input.customerText,
      kindFromTypeBody(interested?.typeBody),
      resumenTipoPatio(resumen),
      resumenPideOtras(resumen),
    );
    const topeNow = resumenTopeContado(resumen);
    const pidePresupuesto = resumenPidePresupuesto(resumen);
    const cashBudget = topeNow ?? rememberedBudget;
    if (pidePresupuesto && topeNow) {
      await this.conversation.saveCashBudget(input.contactId, topeNow);
    }
    const esToma = resumenEsToma(resumen);
    const tomaChecklist = applyInboundTomaPhotos(
      mergeTomaChecklist(
        rememberedToma,
        parseTomaChecklistFromResumen(resumen, lexicon),
      ),
      input.customerText,
    );
    if (tomaChecklist && esToma) {
      await this.conversation.saveTomaChecklist(
        input.contactId,
        tomaChecklist,
      );
    }
    const purchaseText = esToma
      ? stripTomaFacts(input.customerText, resumenTomaFicha(resumen))
      : input.customerText;
    const brand = await this.rememberBrand(
      input.contactId,
      history,
      esToma ? purchaseText : nombra,
      lexicon,
    );
    let concreteAsk = await this.rememberConcreteAsk(
      input.contactId,
      history,
      esToma ? '' : purchaseText,
    );
    const gearbox = await this.rememberGearbox(
      input.contactId,
      history,
      input.customerText,
      lexicon,
      cajaCompra,
    );
    if (cajaCompra === 'no' && concreteAsk) {
      const cleaned = stripGearboxWords(concreteAsk);
      if (cleaned && cleaned !== concreteAsk) {
        concreteAsk = cleaned;
        await this.conversation.saveConcreteAsk(input.contactId, cleaned);
      }
    }
    const mentionsPrice = resumenAsksForListedPrice(resumen);
    const firstTouchBareOk =
      isBareConfirmation(input.customerText) &&
      !historyPresentedFicha(history, interested?.model);
    const asksDeliveryNow =
      textAsksForImmediateDelivery(input.customerText) ||
      resumenAsksForImmediateDelivery(resumen);
    const confirmingCashOrDelivery =
      historyHasListedPrice(history) &&
      (resumenPrefiereContado(resumen) || asksDeliveryNow);
    const askedPrice =
      resumenPideNegociar(resumen) ||
      firstTouchBareOk ||
      confirmingCashOrDelivery
        ? false
        : mentionsPrice;
    const financingInputsNow = gaveFinancingInputs(input.customerText);
    const aceptaVerSiAplica =
      resumenAceptaCredito(resumen) &&
      (historyAskedIfApplies(history) || historyHasShownCuota(history)) &&
      !financingInputsNow;
    const askedCredit =
      pidePresupuesto ||
      aceptaVerSiAplica ||
      resumenRechazaAplicar(resumen) ||
      resumenPrefiereContado(resumen)
        ? false
        : resumenAsksForCredit(resumen) || textAsksForCredit(input.customerText);
    const askedOtherColor =
      resumenAsksForOtherColor(resumen) ||
      textAsksForOtherColor(input.customerText);
    const textosBot = history
      .filter((item) => item.role === 'assistant')
      .map((item) => item.content);
    const lastAssistantText = textosBot.at(-1) ?? '';
    const ultimosBot = textosBot.slice(-3);
    const closing =
      resumenIsFarewell(resumen) && !resumenHasPendingDoubt(resumen);
    const thanksHint = salesFollowHint({
      customerText: input.customerText,
      lastAssistant: lastAssistantText,
      hasDoubt: resumenHasPendingDoubt(resumen),
      isFarewell: closing,
      isCourtesy: resumenIsCourtesy(resumen),
    });

    const spaceText = `${input.customerText}\n${resumen}\n${history
      .filter((item) => item.role === 'user')
      .map((item) => item.content)
      .join('\n')}`;
    const spaceAsk = asksForLargePassengerSpace(spaceText);
    const pideHorario =
      bareMoreInfo ? false : resumenPideHorario(resumen);
    const tresFilas =
      !esToma &&
      (resumenTresFilas(resumen) ||
        resolveTresFilas({
          history,
          customerText: input.customerText,
          remembered: detectTresFilas(concreteAsk ?? ''),
        }));
    const asientos = resumenAsientos(resumen);
    const asientosRevision =
      asientos != null
        ? await this.reviewAsientos(interested, asientos, askedPrice)
        : null;
    const lastOfferText = lastOfferAssistantText(history);
    const lastAssistantListed = lastOfferIsUnitList(lastOfferText);
    const askedLocation = bareMoreInfo
      ? false
      : resumenAsksForLocation(resumen);
    const hasShownDoubt = resumenHasPendingDoubt(resumen);
    const shownBrandEarly = interested?.brand.trim().toLowerCase() ?? '';
    const otherBrandNow = Boolean(
      brandSaidNow && shownBrandEarly && brandSaidNow !== shownBrandEarly,
    );
    const stayFollowUp =
      (askedPrice ||
        askedLocation ||
        hasShownDoubt ||
        resumenPideFicha(resumen)) &&
      !lastAssistantListed &&
      !resumenPideOtras(resumen) &&
      !otherBrandNow;
    let patioDisponible: StockCar[] | null = null;
    if (stayFollowUp && !pideHorario) {
      patioDisponible = await this.catalog.listAvailableExcept('_');
      const shown = lastSingleShownUnit(history, patioDisponible);
      if (shown) {
        interested = {
          inventoryId: shown.id,
          brand: shown.brand,
          model: shown.model,
          year: shown.year,
          price: shown.price,
          typeBody: shown.typeBody,
          mileage: shown.mileage,
          color: shown.color,
          plateShort: shown.plateShort,
          transmission: shown.transmission,
          passengerCapacity: shown.passengerCapacity,
        };
      }
    }
    const fichaAlreadyGiven = historyPresentedFicha(
      history,
      interested?.model,
      resumen,
    );
    const replayFicha = Boolean(interested) && resumenPideFicha(resumen);
    // Un «gracias» no acepta «le busco otra opción» si el resumen dice Pide otras: no.
    const acceptedOtherOffer =
      (resumenPideOtras(resumen) ||
        (!resumenStaysOnShownUnit(resumen) &&
          (isThreadAck(input.customerText) || resumenIsThreadAck(resumen)))) &&
      lastOfferedOtherOptions(lastOfferText);
    const stayInput = {
      text: input.customerText,
      resumen,
      history,
      car: interested,
      lexicon,
      pedido,
      lastListed: lastAssistantListed,
      lastOfferText,
    };
    let otro = resumenOtroVehiculo(resumen);
    let otroOverride: string | null = null;
    let sospecha: string | null = null;
    let verificado: string | null = null;
    if (interested && !otro) {
      try {
        let patio = patioDisponible;
        if (!patio) {
          patio = patioFamiliesCacheFresh()
            ? []
            : await this.catalog.listAvailableExcept('_');
        }
        sospecha = sospechaOtroVehiculo(
          input.customerText,
          interested,
          patio,
          lexicon,
          pedido,
        );
        if (sospecha) {
          try {
            const raw = await withTimeout(
              this.openai.completeJson(
                VERIF_OTRO_SYSTEM_PROMPT,
                buildVerifOtroUser({
                  car: interested,
                  lastAssistantText,
                  customerText: input.customerText,
                }),
              ),
              VERIF_OTRO_TIMEOUT_MS,
              'verif-otro',
            );
            const parsed = parseVerifOtroJson(raw);
            if (!parsed.ok) {
              verificado = 'error';
            } else if (parsed.otro) {
              otro = parsed.otro;
              otroOverride = parsed.otro;
              verificado = parsed.otro;
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : '';
            verificado = /tardó más de/.test(msg) ? 'timeout' : 'error';
          }
        }
      } catch {
        sospecha = sospecha ?? null;
        verificado = verificado ?? 'error';
      }
    }
    const evidencia = Boolean(
      otro &&
        interested &&
        evidenciaReal(otro, input.customerText, ultimosBot, interested),
    );
    const mismaPorFila = Boolean(
      otro && interested && mismaUnidadPorFila(otro, interested),
    );
    let otroEsLaMostrada: boolean | null = null;
    let rpcRank1: string | null = null;
    let rpcSim1: number | null = null;
    let rpcSim2: number | null = null;
    if (debeConsultarRpcOtro(interested, otro, evidencia, mismaPorFila)) {
      const rpc = await consultarOtroEsLaMostrada({
        otro: otro as string,
        inventoryId: interested!.inventoryId,
        embed: (text) => this.openai.embed(text),
        match: async (embedding, topK) => {
          const raw = await this.catalog.searchInventory(
            embedding,
            undefined,
            undefined,
            true,
            topK,
          );
          try {
            return JSON.parse(typeof raw === 'string' ? raw : '[]');
          } catch {
            return [];
          }
        },
      });
      otroEsLaMostrada = rpc.otroEsLaMostrada;
      rpcRank1 = rpc.rank1Id;
      rpcSim1 = rpc.sim1;
      rpcSim2 = rpc.sim2;
    }
    const decided = decideStayOnShown({
      ...stayInput,
      lastAssistantText: ultimosBot,
      otroEsLaMostrada,
      otroOverride,
    });
    const stayOnShown = decided.stay;
    const motivo = decided.motivo;
    this.stayDecisions.save(input.contactId, {
      stay: stayOnShown,
      motivo,
      otroVehiculo: otro,
      sospecha,
      verificado,
    });
    this.logger.log(
      formatStayLog({
        contactId: input.contactId,
        inventory: interested?.inventoryId ?? null,
        stay: stayOnShown,
        motivo,
        bandera: stayLeaveBandera(stayInput, motivo),
        banderaSinEvidencia: stayBanderaSinEvidencia(stayInput),
        otro,
        evidencia: otro ? (evidencia ? 'ok' : 'falla') : 'n/a',
        rpcRank1,
        rpcSim1,
        rpcSim2,
        sospecha,
        verificado,
      }),
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
    // Plan en sombra: solo se registra, no cambia la respuesta.
    const caminoViejo: LegacyPath = closing
      ? 'CIERRE'
      : pideHorario
        ? 'HORARIO'
        : asientosRevision
          ? 'ASIENTOS'
          : selling && !buying
            ? 'VENTA_PROPIA'
            : stayOnShown && interested
              ? 'SEGUIR_UNIDAD'
              : 'REVIEW_BRAND';
    const planLog = this.shadowPlan(
      {
        resumen,
        previousResumen,
        lexicon,
        unidad: interested,
        history,
        ultimoBotListo: lastAssistantListed,
        ventaPropia: selling && !buying,
      },
      caminoViejo,
    );
    let revision: BrandReview;
    if (pideHorario) {
      revision = {
        text: formatHoursAskHint(
          new Date(),
          `${input.customerText}\n${resumen}`,
        ),
        holdVehicle: true,
        sendId: null,
      };
    } else if (asientosRevision) {
      revision = asientosRevision;
    } else if (selling && !buying) {
      revision = { text: '', holdVehicle: true, sendId: null };
    } else if (stayOnShown && interested) {
      revision = {
        text: `EL HILO SIGUE CON EL VEHÍCULO QUE YA MOSTRAMOS (${interested.brand} ${interested.model}).
inventory_id=${interested.inventoryId}
Lee el RESUMEN y el HISTORIAL: eso dice qué quiere ahora. Contesta eso sobre ESTA unidad.
${replayFicha ? 'PIDIÓ DE NUEVO LA INFORMACIÓN de ESA unidad. Vuelve a dar la ficha completa (año, color, km, caja, tracción). Tono de asesor que retoma: claro, cercano, vendedor. PROHIBIDO “tenemos disponible”, “estimado”, abrir como primer contacto. PROHIBIDO responder solo con km y mecánico. PROHIBIDO precio salvo que el resumen lo pida.' : fichaAlreadyGiven ? 'La ficha YA se presentó. PROHIBIDO volver a abrir con “tenemos disponible” ni repetir color, caja, tracción o placa. Responde solo lo que pregunta ahora.' : ''}
No reabras inventario ni uses buscarvehiuclo. No digas "no está" ni "lo más cercano".
No rellenes con placa, visita, papeles, cuota o cédula si el hilo no lo pidió.`,
        holdVehicle: false,
        sendId: interested.inventoryId,
        unitPrice:
          interested.price && interested.price > 0
            ? Math.round(interested.price)
            : null,
      };
    } else {
      const anyBrandThread =
        asksAnyBrand(input.customerText) ||
        acceptedOtherOffer ||
        history.some(
          (item) => item.role === 'user' && asksAnyBrand(item.content),
        );
      revision = await this.reviewBrand(
        history,
        input.customerText,
        selling || anyBrandThread
          ? detectBrand(input.customerText, lexicon)
          : brand,
        concreteAsk,
        askedPrice,
        vehicleKind,
        detectGearbox(input.customerText, lexicon) ??
          (acceptedOtherOffer
            ? detectGearbox(lastOfferText, lexicon)
            : null) ??
          (askedPrice && fichaAlreadyGiven ? null : gearbox),
        interested
          ? {
              price: interested.price,
              family: modelFamily(interested.model),
              color: interested.color ?? null,
              inventoryId: interested.inventoryId,
              brand: interested.brand ?? null,
              typeBody: interested.typeBody ?? null,
            }
          : null,
        lexicon,
        spaceAsk,
        askedOtherColor,
        resumen,
        cajaCompra,
        cashBudget,
        pedido,
        tresFilas,
        stayOnShown ? null : motivo,
      );
    }
    if (revision.choseFromShown && revision.sendId) {
      await this.persistence.saveChosenInterestedCar(
        input.contactId,
        revision.sendId,
      );
    }
    if (closing) {
      revision = {
        text: DESPEDIDA_AMABLE,
        holdVehicle: true,
        sendId: interested?.inventoryId ?? revision.sendId,
      };
    }
    if (
      stayOnShown &&
      interested &&
      specTopic(input.customerText) &&
      !asientosRevision
    ) {
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
      /\bkm\b|kilometr/i.test(input.customerText) && !askedPrice;
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
      !closing &&
      !pideHorario &&
      !(
        asientosRevision &&
        asientosRevision.sendId !== interested.inventoryId
      ) &&
      (stayOnShown ||
        refersToInterestedCar(
          input.customerText,
          interested,
          lexicon,
          resumen,
        )) &&
      !shownOtherBox &&
      !(
        pedido &&
        askedModelPhrase(pedido, lexicon) &&
        !modelPhraseMatchesCar(askedModelPhrase(pedido, lexicon), interested.model)
      )
        ? formatInterestedCar(
            interested,
            (askedPrice || askedCredit) &&
              alreadyShown &&
              !objectionOnShown &&
              !financingFollowUp,
            {
              skipMileageCare:
                replayFicha ||
                historySaidMileageCare(history) ||
                objectionOnShown ||
                justifyPriceAfterFicha ||
                financingFollowUp ||
                askedPrice,
              slimAfterFicha:
                !replayFicha &&
                (justifyPriceAfterFicha ||
                  financingFollowUp ||
                  (stayOnShown && fichaAlreadyGiven)),
              replayFicha,
              creditFollowUp: financingFollowUp,
              afterFicha:
                askedPrice && askedLocation
                  ? 'both'
                  : askedLocation
                    ? 'location'
                    : hasShownDoubt && !askedPrice
                      ? 'doubt'
                      : askedPrice
                        ? 'price'
                        : 'facts',
            },
          )
        : '';
    const saidBoxNow =
      cajaCompra === 'no'
        ? null
        : cajaCompra === 'manual' || cajaCompra === 'automatica'
          ? cajaCompra
          : detectGearbox(input.customerText, lexicon);
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
            refersToInterestedCar(
              input.customerText,
              interested,
              lexicon,
              resumen,
            ))),
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
    const sameShownUnit =
      !revision.sendId ||
      revision.sendId === interested?.inventoryId;
    const unitPrice =
      revision.unitPrice && revision.unitPrice > 0
        ? Math.round(revision.unitPrice)
        : interested?.price &&
            interested.price > 0 &&
            sameShownUnit &&
            (stayOnShown || Boolean(revision.sendId) || askedCredit)
          ? Math.round(interested.price)
          : null;
    const askedThisUnitPrice =
      askedPrice && hasQuotedUnit && unitPrice != null;
    // El bot ya dijo el monto de contado de ESTA unidad en el hilo.
    const priceAlreadySaid =
      unitPrice != null &&
      entregadoEnHilo(history, { unitPrice }).precio != null;
    const toListedUnit = (car: StockCar): ListedSetUnit => ({
      year: car.year,
      color: car.color,
      mileage: car.mileage,
      price: Math.round(car.price as number),
    });
    let listedSet: ListedSetUnit[] = (revision.listedUnits ?? [])
      .filter((car) => hasLoadedPrice(car.price))
      .map(toListedUnit);
    if (listedSet.length === 0) {
      listedSet = parsePricedUnitsFromReview(revision.text);
    }
    const quotingListedSet =
      askedPrice && revision.sendId == null && listedSet.length > 1;
    const canQuotePrice =
      quotingListedSet ||
      (unitPrice != null &&
        (creditQuote ||
          askedThisUnitPrice ||
          (!objectionOnShown &&
            ((hasQuotedUnit && alreadyShown && askedPrice) ||
              lastAssistantListedOther))));
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
        ? priceAlreadySaid
          ? 'PIDIÓ CRÉDITO / FINANCIAMIENTO. El precio de contado YA se dijo en el hilo: PROHIBIDO repetirlo. Di la entrada que indicó y la cuota de la herramienta en una frase completa (“Con una entrada de $X y a N años la cuota aproximada es $Y”). No inventes una cuota si falta entrada o plazo: pregunta lo que falta. En el turno de la cuota NO pidas cédula ni preguntes si aplica: el sistema lo pregunta.'
          : 'PIDIÓ CRÉDITO / FINANCIAMIENTO. Di el precio de contado de inventario, la entrada que indicó y la cuota de la herramienta. PROHIBIDO dejar huecos (“es de .”, “entrada de y”). No inventes una cuota si no hay entrada. En el turno de la cuota NO pidas cédula. El sistema pregunta si ayudamos a ver si aplica.'
        : hasQuotedUnit
          ? 'PIDIÓ CRÉDITO / FINANCIAMIENTO. En la primera ficha no digas el precio. Pregunta entrada y plazo. No inventes cuota.'
          : 'PIDIÓ CRÉDITO pero no hay unidad confirmada. Pregunta qué vehículo. PROHIBIDO inventar cuotas ni precios.'
      : '';
    const objecionHint = resumenPideNegociar(resumen)
      ? 'PIDIÓ NEGOCIAR / DESCUENTO (o ofreció un monto). Una frase de que el carro está bien (estado, km, documentos). PROHIBIDO descuento, rebaja o aceptar su oferta por este chat. El sistema pega que debe venir a hablarlo con un asesor. Si pidió ubicación, dila en ESTE turno. No vuelvas a mandar la ficha. No inventes un precio más bajo.'
      : objectionOnShown
      ? 'OBJECIÓN de la unidad que YA conoció. No vuelvas a mandar la ficha (color, caja, km, placa, “tenemos disponible”). Contesta la objeción: justifica el valor con estado, kilometraje y garantía en documentos (papeles/traspaso). No inventes garantía mecánica. No rebajes el precio. Usa las secciones OBJECIONES y MANEJOCARO del contexto.'
      : '';
    const locationAsk = askedLocation;
    const locationHint = locationAsk
      ? 'PIDIÓ UBICACIÓN / VISITA. Dale Av. España 6-73 y Sevilla, Cuenca AHORA. Solo la dirección. El sistema pega el link del mapa: PROHIBIDO escribir tú un link o URL. PROHIBIDO pedir entrada, depósito o confirmar valores. PROHIBIDO decir que no hace falta depósito o entrada: esa frase no va en la respuesta.'
      : '';
    const noRepetirHint = formatEntregadoForPedido(
      entregadoEnHilo(history, { unitPrice }),
    );
    const faltaCarroHint =
      (resumenFaltaVehiculo(resumen) || bareMoreInfo) &&
      !adVehicle &&
      !hasQuotedUnit &&
      !brandSaidNow &&
      !pedido &&
      !detectVehicleKind(input.customerText) &&
      !asksAnyBrand(input.customerText)
        ? bareMoreInfo
          ? 'NO HAY CARRO DEFINIDO: pidió información pero no dijo de qué vehículo. Solo UNA pregunta: qué carro le interesa. PROHIBIDO dirección, mapa, horario, visita, ficha, precio o fotos. PROHIBIDO inventar una unidad.'
          : 'NO HAY CARRO DEFINIDO: el cliente aún no dijo cuál quiere. Contesta TODO lo que pidió que no dependa del carro (con tus filas: ubicación, horario, toma…). Lo que depende del carro (precio, fotos, cuota) queda pendiente: dile que se lo pasas apenas diga cuál. Termina con UNA sola pregunta: qué carro le interesa. PROHIBIDO inventar una unidad, precio o ficha. PROHIBIDO cerrar con otra pregunta (visita, agendar).'
        : '';
    const cashDeliveryHint = confirmingCashOrDelivery
      ? 'YA le dijo el $. Ahora confirma lo que pidió: ese valor ES de contado y/o SÍ hay entrega inmediata. PROHIBIDO repetir ficha, km, color ni el $ como si no lo hubiera dicho. No abras crédito. Una o dos frases.'
      : '';
    const hasConfirmedUnit = Boolean(
      revision.sendId ||
        (interested &&
          (stayOnShown ||
            refersToInterestedCar(
              input.customerText,
              interested,
              lexicon,
              resumen,
            ))),
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
    const identity = cedulaIdentityFromText(input.customerText);
    const sentCedulaNow = identity?.cedula ?? null;
    if (identity) {
      if (identity.nombre || identity.origen) {
        await this.persistence.saveLeadCedula(input.contactId, identity.cedula, {
          nombre: identity.nombre,
          origen: identity.origen,
        });
      } else {
        await this.persistence.saveLeadCedula(input.contactId, identity.cedula);
      }
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
      ? `YA ENVIÓ LA CÉDULA EN ESTE MENSAJE${identity?.nombre ? ` a nombre de ${identity.nombre}` : ''}${identity?.origen ? `, de ${identity.origen}` : ''}. PROHIBIDO pedir cédula, nombre o de dónde es otra vez. Confirma que un asesor revisa si califica. No repitas el número.`
      : hasCedula
        ? 'YA TENEMOS LA CÉDULA. PROHIBIDO pedirla otra vez.'
        : historyHasShownCuota(history) &&
            resumenAceptaCredito(resumen) &&
            !historyAskedFinancingData(history) &&
            !financingInputsNow
          ? 'El RESUMEN dice que acepta ver si aplica. El sistema pegará cédula, nombre y de dónde es. No adelantes esas preguntas. PROHIBIDO “gestionar esto”.'
          : resumenRechazaAplicar(resumen)
            ? 'El RESUMEN dice que no quiere ver si aplica. El sistema pega un mensaje para que no se vaya. Sigue con el carro. PROHIBIDO insistir con cédula.'
          : historyHasShownCuota(history)
            ? 'YA hubo cuota. Lee el RESUMEN: qué pide AHORA. No pidas cédula si no aceptó ver si aplica.'
            : resumenPrefiereContado(resumen) && !confirmingCashOrDelivery
              ? 'El RESUMEN dice que prefiere de contado. PROHIBIDO crédito, entrada o cuota. El sistema pregunta cuál de las unidades ya mostradas le gusta. Quédate en esas. No insistas con financiamiento.'
            : pidePresupuesto && !stayOnShown
                ? 'PRESUPUESTO: lista las unidades que caben. El sistema pregunta si quieren crédito o contado. PROHIBIDO armar cuota. PROHIBIDO pregunta de visita en este turno.'
                : '';
    const anuncioHint = adVehicle
      ? `ANUNCIO DE FACEBOOK. El cliente pidió información del ${adVehicle}. Presenta ESA unidad del inventario. Si hay una, mándala (ficha, sin precio). Si hay varias de esa misma línea, nómbralas y pregunta cuál. PROHIBIDO preguntar qué carro le interesa. PROHIBIDO listar otras marcas.`
      : '';
    const pedidoVigente = (
      stayOnShown || pideHorario || asientos != null
        ? [
            saludoHint,
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
            noRepetirHint,
            faltaCarroHint,
            cashDeliveryHint,
            precioHint,
            selling ? formatTomaPedido(tomaChecklist) : '',
          ]
        : [
            saludoHint,
            anuncioHint,
            formatPedidoVigente(
              spaceAsk
                ? null
                : revision.switchedModel
                  ? (revision.vehicleKind ?? null)
                  : vehicleKind,
            ),
            formatSoloTipoPedido(
              spaceAsk || /CABINA\/TRACCIÓN/.test(revision.text)
                ? null
                : revision.switchedModel
                  ? (revision.vehicleKind ?? null)
                  : vehicleKind,
              detectBrand(input.customerText, lexicon) ||
                detectNamedModelAsk(input.customerText, lexicon)?.brand ||
                (cajaCompra === 'no' ? null : brand),
              asksAnyBrand(input.customerText) ||
                acceptedOtherOffer ||
                history.some(
                  (item) => item.role === 'user' && asksAnyBrand(item.content),
                ) ||
                (revision.holdVehicle && /inventory_id=/.test(revision.text)),
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
            selling ? formatTomaPedido(tomaChecklist) : '',
            spaceAsk ? formatLargePassengerPedido(spaceText) : '',
            creditoHint,
            colorHint,
            cedulaHint,
            mileageCareHint,
            objecionHint,
            locationHint,
            noRepetirHint,
            faltaCarroHint,
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

    if (
      revision.photoQueue &&
      revision.photoQueue.length > 1
    ) {
      const parsed: ParsedAgentOutput = {
        mensaje: historyHasUnitList(history)
          ? 'Le mando las fotos de cada una, una por una.'
          : revision.text,
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: null,
        },
        img_prefix: '',
      };
      await this.conversation.appendMessage(input.contactId, {
        role: 'assistant',
        content: parsed.mensaje,
      });
      await this.persistence.appendChatHistory({
        contactId: input.contactId,
        human: input.customerText,
        ai: serializeAgentTurn(parsed),
      });
      this.logger.log(
        `Agente listo contactId=${input.contactId} inventory=cola:${revision.photoQueue.length}`,
      );
      return {
        reply: parsed,
        resumen,
        photoQueue: revision.photoQueue,
        alreadyShownInThread: false,
        plan: planLog,
        ...unidadesParaTurno(
          armarUnidadesContexto({
            interestedText,
            interestedId: interested?.inventoryId,
            sendId: revision.sendId,
            listedIds: (revision.listedUnits ?? []).map((car) => car.id),
            contextOrigin: revision.contextOrigin,
            contextIds: revision.contextIds,
          }),
        ),
      };
    }

    const toolInventoryIds: string[] = [];
    const executeTurnTool = async (name: string, argsJson: string) => {
      const out = await this.executeTool(
        name,
        argsJson,
        revision.switchedModel ? (revision.vehicleKind ?? null) : vehicleKind,
        selling && !buying ? null : brand,
        Boolean(revision.sendId),
        lexicon,
      );
      if (name === 'buscarvehiuclo') {
        toolInventoryIds.push(...idsDesdeToolJson(out));
      }
      return out;
    };
    const agentUser = pedidoVigente ? `${resumen}\n\n${pedidoVigente}` : resumen;
    const raw = await this.openai.runSalesAgent({
      system,
      user: agentUser,
      history,
      executeTool: executeTurnTool,
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
      !stayOnShown &&
      (revision.holdVehicle ||
        (isMoneyNotVisit(input.customerText) && !askedCredit))
    ) {
      const claimed = parsed.meta.vehiculo?.inventory_id?.trim() ?? '';
      const listedIds = new Set(
        (revision.listedUnits ?? []).map((car) => car.id),
      );
      if (claimed && isUuid(claimed) && listedIds.has(claimed)) {
        parsed.meta.vehiculo = {
          ...(parsed.meta.vehiculo ?? {}),
          inventory_id: claimed,
        };
      } else {
        parsed.meta.vehiculo = null;
        parsed.img_prefix = '';
      }
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
    if (parsed.meta.vehiculo) {
      if (unitPrice != null) {
        parsed.meta.vehiculo.precio = unitPrice;
      } else {
        delete parsed.meta.vehiculo.precio;
      }
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
      const firstFichaSinPrecio =
        !alreadyShown && Boolean(replyId) && !askedPrice;
      const withoutPlate = stripUnsolicitedPriceAndPlate(parsed.mensaje, {
        keepPrice: true,
        keepPlateShort: askedPlate || firstPresentation,
      });
      const cleaned =
        firstFichaSinPrecio && unitPrice != null
          ? stripShownUnitCashPrice(withoutPlate, unitPrice)
          : withoutPlate;
      if (cleaned !== parsed.mensaje) {
        this.logger.warn(
          `Se quitó dato no pedido contactId=${input.contactId}`,
        );
      }
      parsed.mensaje = historySaidMileageCare(history)
        ? stripRepeatedMileageCare(cleaned)
        : cleaned;
      parsed.mensaje = stripGestionarOffer(parsed.mensaje);
      const quoteBits = financingInputsFromThread(
        input.customerText,
        resumen,
        history,
      );
      if (
        askedCredit &&
        unitPrice != null &&
        quoteBits.entrada != null &&
        quoteBits.anos != null &&
        !replyShowsCuota(parsed.mensaje)
      ) {
        const quote = formatFinancingQuote({
          precio: unitPrice,
          entrada: quoteBits.entrada,
          anos: quoteBits.anos,
        });
        if (quote) {
          parsed.mensaje = mergeFinancingQuote(parsed.mensaje, quote);
          parsed.meta.cuotaMostrada = true;
        }
      }
      if (!hasCedula) {
        parsed.mensaje = stripPrematureIdentityAsk(parsed.mensaje);
      }
      if (!replyShowsCuota(parsed.mensaje) && !parsed.meta.cuotaMostrada) {
        parsed.mensaje = stripPrematureApplyAsk(parsed.mensaje);
      }
      if (aceptaVerSiAplica) {
        parsed.mensaje = stripRepeatedCuotaOnAccept(parsed.mensaje);
      }
      const showedCuotaNow =
        parsed.meta.cuotaMostrada || replyShowsCuota(parsed.mensaje);
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
          showedCuotaNow,
          financingInputsNow,
        })
      ) {
        parsed.mensaje = appendFinancingDataAsk(parsed.mensaje);
      } else if (
        shouldEncourageAfterDecline({
          history,
          rechazaAplicar: resumenRechazaAplicar(resumen),
          hasCedula,
          reply: parsed.mensaje,
          closing: closing || thanksHint === DESPEDIDA_AMABLE,
        })
      ) {
        parsed.mensaje = appendFinancingDecline(parsed.mensaje);
      }
      const listedBudgetNow =
        pidePresupuesto &&
        !stayOnShown &&
        revision.text.includes('PRESUPUESTO DE CONTADO');
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
        unitPrice != null &&
        isStrippedReplyStub(parsed.mensaje)
      ) {
        parsed.mensaje = ensureListedPrice(parsed.mensaje, unitPrice);
        parsed.meta.precioMostrado = true;
      } else if (quotingListedSet) {
        parsed.mensaje = ensureListedSetPrices(parsed.mensaje, listedSet);
        parsed.meta.precioMostrado = true;
      } else if (
        askedPrice &&
        hasConfirmedUnit &&
        unitPrice == null &&
        !quotingListedSet
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
      const withoutHoliday = stripInventedHoliday(parsed.mensaje);
      if (withoutHoliday !== parsed.mensaje) {
        this.logger.warn(
          `Se quitó feriado inventado contactId=${input.contactId}`,
        );
        parsed.mensaje = withoutHoliday;
      }
      // Donde va la dirección va el mapa (lo pega el sistema, no el modelo).
      // Si ya se entregó y el resumen no la volvió a pedir, se quita.
      // Clic “más información” sin pedir casa: no se manda dirección ni horario.
      if (bareMoreInfo) {
        parsed.mensaje = dropUnsolicitedHours(
          dropRepeatedAddress(parsed.mensaje),
        );
        if (
          !parsed.mensaje.trim() ||
          hasDealershipAddress(parsed.mensaje)
        ) {
          parsed.mensaje = '¿Qué carro le interesa?';
        }
      } else if (entregado.direccion && !askedLocation) {
        parsed.mensaje = dropRepeatedAddress(parsed.mensaje);
      } else {
        parsed.mensaje = appendMapLink(parsed.mensaje);
      }
    }

    const numeros = await this.validarNumerosDeRespuesta({
      contactId: input.contactId,
      mensaje: parsed.mensaje,
      system,
      user: agentUser,
      history,
      customerText: input.customerText,
      resumen,
      executeTool: executeTurnTool,
      ids: reunirInventoryIds({
        metaId: parsed.meta.vehiculo?.inventory_id,
        interestedId: interested?.inventoryId,
        sendId: revision.sendId,
        listedIds: (revision.listedUnits ?? []).map((car) => car.id),
        photoIds: (revision.photoQueue ?? []).map((item) => item.inventoryId),
        toolIds: toolInventoryIds,
        revisionText: revision.text,
      }),
      metaId: parsed.meta.vehiculo?.inventory_id ?? null,
    });
    parsed.mensaje = numeros.mensaje;

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
    await this.conversation.saveLastSeen(input.contactId);

    this.logger.log(
      `Agente listo contactId=${input.contactId} inventory=${parsed.meta.vehiculo?.inventory_id ?? 'ninguno'}`,
    );

    const faltaAclararNoExiste =
      revision.noCoincideAnio &&
      !respuestaAclaraAnioNoExiste(
        parsed.mensaje,
        revision.noCoincideAnio.anioPedido,
      )
        ? {
            pedido: revision.noCoincideAnio.pedido,
            ofrecido: revision.noCoincideAnio.ofrecido,
          }
        : undefined;
    if (faltaAclararNoExiste) {
      this.logger.log(
        `faltaAclararNoExiste contactId=${input.contactId} pedido=${faltaAclararNoExiste.pedido} ofrecido=${faltaAclararNoExiste.ofrecido}`,
      );
    }

    return {
      reply: parsed,
      resumen,
      alreadyShownInThread:
        fichaAlreadyGiven &&
        stayOnShown &&
        Boolean(interested?.inventoryId) &&
        (!parsed.meta.vehiculo?.inventory_id ||
          parsed.meta.vehiculo.inventory_id === interested?.inventoryId),
      plan: planLog,
      entregado,
      ...(numeros.correcciones.length
        ? { numerosCorregidos: numeros.correcciones }
        : {}),
      ...(numeros.regenerado ? { regenerado: true } : {}),
      ...(numeros.hechos.length ? { hechos: numeros.hechos } : {}),
      ...unidadesParaTurno(
        armarUnidadesContexto({
          interestedText,
          interestedId: interested?.inventoryId,
          sendId: revision.sendId,
          listedIds: (revision.listedUnits ?? []).map((car) => car.id),
          contextOrigin: revision.contextOrigin,
          contextIds: revision.contextIds,
          toolIds: toolInventoryIds,
        }),
      ),
      ...(faltaAclararNoExiste ? { faltaAclararNoExiste } : {}),
    };
  }

  private async validarNumerosDeRespuesta(input: {
    contactId: string;
    mensaje: string;
    system: string;
    user: string;
    history: { role: 'user' | 'assistant'; content: string }[];
    customerText?: string;
    resumen?: string;
    executeTool: (name: string, argsJson: string) => Promise<string>;
    ids: string[];
    metaId: string | null;
  }): Promise<{
    mensaje: string;
    correcciones: CorreccionNumero[];
    regenerado: boolean;
    hechos: Array<{ id: string; km: number | null; precio: number | null }>;
  }> {
    const vacio = {
      mensaje: input.mensaje,
      correcciones: [] as CorreccionNumero[],
      regenerado: false,
      hechos: [] as Array<{ id: string; km: number | null; precio: number | null }>,
    };
    if (!input.mensaje) {
      return vacio;
    }
    try {
      const carga = await intentarCargarHechos(async () => {
        if (
          input.ids.length === 0 ||
          typeof this.persistence.loadInventoryFacts !== 'function'
        ) {
          return [];
        }
        const rows = await this.persistence.loadInventoryFacts(input.ids);
        return rows.map(hechoDesdeFila);
      });
      if (carga.error) {
        this.logger.warn(
          formatNumerosLog({
            contactId: input.contactId,
            revisados: extraerNumeros(input.mensaje).length,
            invalidos: 0,
            corregidos: 0,
            regenerado: false,
            aplicado: false,
            detalle: [],
            error: carga.error,
          }),
        );
        return vacio;
      }
      const hechos = carga.hechos;
      const ctxNumeros: ContextoNumeros = {
        history: [
          ...input.history,
          ...(input.customerText
            ? [{ role: 'user' as const, content: input.customerText }]
            : []),
        ],
        resumen: input.resumen,
      };
      const hechosLog = hechos.map((hecho) => ({
        id: hecho.id,
        km: hecho.km,
        precio: hecho.precio,
      }));
      if (hechos.length === 0) {
        this.logger.log(
          formatNumerosLog({
            contactId: input.contactId,
            revisados: extraerNumeros(input.mensaje).length,
            invalidos: 0,
            corregidos: 0,
            regenerado: false,
            aplicado: false,
            detalle: [],
          }),
        );
        return { ...vacio, hechos: hechosLog };
      }
      const invalidosIniciales = numerosInvalidos(
        input.mensaje,
        hechos,
        ctxNumeros,
      );
      const result = validarNumerosSoloRegistro(
        input.mensaje,
        hechos,
        input.metaId,
        ctxNumeros,
      );
      this.logger.log(
        formatNumerosLog({
          contactId: input.contactId,
          revisados: extraerNumeros(input.mensaje).length,
          invalidos: invalidosIniciales.length,
          corregidos: result.correcciones.filter((row) => row.correcto != null)
            .length,
          regenerado: false,
          aplicado: false,
          detalle: result.correcciones,
        }),
      );
      return {
        mensaje: input.mensaje,
        correcciones: result.correcciones,
        regenerado: false,
        hechos: hechosLog,
      };
    } catch (error) {
      this.logger.warn(
        formatNumerosLog({
          contactId: input.contactId,
          revisados: extraerNumeros(input.mensaje).length,
          invalidos: 0,
          corregidos: 0,
          regenerado: false,
          aplicado: false,
          detalle: [],
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return vacio;
    }
  }

  /**
   * Calcula el plan del turno y lo compara con el camino viejo.
   * Nunca lanza: si el plan falla, el turno sigue igual y solo no se registra.
   */
  private shadowPlan(
    input: TurnPlanInput,
    caminoViejo: LegacyPath,
  ): TurnPlanLog | undefined {
    try {
      return turnPlanLog(buildTurnPlan(input), caminoViejo);
    } catch (error) {
      this.logger.warn(
        `Plan en sombra falló: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
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
    tipoPatio: ReturnType<typeof resumenTipoPatio>,
    pideOtras = false,
  ): Promise<VehicleKind | null> {
    const remembered = await this.conversation.loadVehicleKind(contactId);
    const dropOldKind = tipoPatio === 'no' && !pideOtras;
    let kind = resolveVehicleKind({
      history,
      customerText,
      remembered,
      interestedKind: dropOldKind ? null : interestedKind,
      resumenKind: tipoPatio && tipoPatio !== 'no' ? tipoPatio : null,
      dropOldKind,
    });
    if (!kind) {
      const similarText = [
        customerText,
        ...[...history].reverse().map((item) => item.content),
      ].find((text) => /\b(?:similar|parecid\w*)\b/i.test(text));
      if (similarText) {
        const lexicon = await this.catalog.getLexicon();
        const named = detectNamedModelAsk(similarText, lexicon);
        if (named) {
          const stock = named.brand
            ? await this.catalog.listByBrand(named.brand)
            : await this.catalog.listAvailableExcept('_');
          kind = kindFromStockFamily(stock, named.family);
        }
      }
    }
    if (kind) {
      await this.conversation.saveVehicleKind(contactId, kind);
    } else if (dropOldKind) {
      await this.conversation.clearVehicleKind(contactId);
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
    cajaCompra: ReturnType<typeof resumenCajaCompra>,
  ): Promise<Gearbox | null> {
    const remembered = await this.conversation.loadGearbox(contactId);
    if (cajaCompra === 'no') {
      const said = detectGearbox(customerText, lexicon);
      if (said && remembered === said) {
        await this.conversation.clearGearbox(contactId);
        return null;
      }
      return remembered;
    }
    const gearbox = resolveGearbox({
      history,
      customerText,
      remembered,
      lexicon,
      cajaCompra,
    });
    if (gearbox && gearbox !== remembered) {
      await this.conversation.saveGearbox(contactId, gearbox);
    }
    return gearbox;
  }

  /**
   * Varios datos de la misma unidad. Corre si las mostradas no eligieron una.
   * Un solo dato (la 2018) sigue filtrando igual.
   */
  private revisionPorCoincidencia(input: {
    text: string;
    cars: StockCar[];
    lexicon: VehicleLexicon;
    year: number | null;
    includePrice: boolean;
    yearSpan: boolean;
    otroColor: boolean;
  }): BrandReview | null {
    if (input.yearSpan || input.otroColor) {
      return null;
    }
    const hechos = hechosDesdeTexto(input.text, input.year, input.lexicon);
    if (contarHechos(hechos) < 2) {
      return null;
    }
    const hit = coincidenUnidad(input.cars, hechos);
    if (!hit) {
      return null;
    }
    const named = formatNamedUnits(hit.cars, input.includePrice);
    const offered = hit.cars[0];
    const nota =
      hit.distinto.length > 0
        ? notaDistintoHechos({
            distinto: hit.distinto,
            brand: offered?.brand ?? '',
            model: offered?.model ?? '',
            yearPedido: input.year,
            yearOfrecido: offered?.year ?? null,
          })
        : 'Los datos que dijo coinciden con esta unidad. Preséntala. PROHIBIDO decir que no está.';
    const yearPedido = input.year;
    const noCoincideAnio =
      hit.distinto.includes('año') && yearPedido != null && offered
        ? {
            pedido: `${modelFamily(offered.model) || offered.model} ${yearPedido}`,
            ofrecido: `${modelFamily(offered.model) || offered.model} ${offered.year ?? ''}`.trim(),
            anioPedido: yearPedido,
          }
        : undefined;
    return {
      ...named,
      text: `${named.text}\n${nota}`,
      ...(noCoincideAnio ? { noCoincideAnio } : {}),
      switchedModel: true,
      vehicleKind: kindOfNamedUnits(hit.cars),
      choseFromShown: hit.cars.length === 1,
    };
  }

  /** Cada nombre se busca por marca y, si no hay filas, por modelo. */
  private async revisionPorNombres(
    pedido: string,
    names: string[],
  ): Promise<BrandReview> {
    let patio: StockCar[] | null = null;
    const lines: string[] = [];
    for (const name of names) {
      let cars = await this.catalog.listByBrand(name);
      if (cars.length === 0) {
        patio ??= await this.catalog.listAvailableExcept('_');
        cars = carsMatchingName(patio, name);
      }
      if (cars.length === 0) {
        lines.push(
          `${name} no está en patio. Di que no tenemos ${name}. Prohibido presentarlo como otra marca de esta lista.`,
        );
        continue;
      }
      const lineas = [
        ...new Set(cars.map((car) => prettyFamily(car.model)).filter(Boolean)),
      ];
      lines.push(
        `${name} SÍ está en patio. Líneas: ${lineas.join(', ')}. Pregunta cuál le interesa. No elijas una. PROHIBIDO decir que no tenemos ${name}.`,
      );
    }
    return {
      text: `PEDIDO: ${pedido}\n${lines.join('\n')}\nvehiculo null.`,
      holdVehicle: true,
      sendId: null,
      switchedModel: true,
    };
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
      brand?: string | null;
      typeBody?: string | null;
    } | null,
    lexicon: VehicleLexicon,
    spaceAsk = false,
    askedOtherColor = false,
    resumen = '',
    cajaCompra: ReturnType<typeof resumenCajaCompra> = null,
    cashBudget: number | null = null,
    pedido: string | null = null,
    tresFilas = false,
    stayMotivo: string | null = null,
  ): Promise<BrandReview> {
    const empty: BrandReview = { text: '', holdVehicle: false, sendId: null };
    const lastAsst = lastOfferAssistantText(history);
    const listedFollowUp = lastOfferIsUnitList(lastAsst);
    const staysOnShown = resumenStaysOnShownUnit(resumen);
    const nombraAhora = textoQueNombra(resumen, customerText, lexicon);
    const brandSaidInTurn = detectBrand(nombraAhora, lexicon);
    const namesBrandNow = Boolean(brandSaidInTurn);
    const detectedAsk = detectNamedModelAsk(nombraAhora, lexicon);
    const stillOnShownAsk =
      staysOnShown &&
      Boolean(reference?.inventoryId || reference?.family) &&
      resumenBrandFitsShown(resumen, reference?.brand, lexicon) &&
      (!detectedAsk?.family ||
        !reference?.family ||
        detectedAsk.family === reference.family);
    const fromText = stillOnShownAsk ? null : detectedAsk;
    const fromSolicitud =
      cajaCompra === 'no' || (namesBrandNow && !fromText)
        ? null
        : detectNamedModelAsk(solicitudSinBanderas(resumen), lexicon);
    const named =
      (fromText &&
      !isDriveFamily(fromText.family) &&
      !familyIsOtherYear(customerText, fromText.family)
        ? fromText
        : null) ??
      (fromSolicitud && !isDriveFamily(fromSolicitud.family)
        ? fromSolicitud
        : null);
    const rawYear = detectYearInText(customerText);
    const yearSaidNow =
      cajaCompra === 'no' && !named
        ? null
        : named && rawYear && String(rawYear) === named.family
          ? null
          : rawYear;
    const asked = named
      ? { ...named, year: yearSaidNow ?? named.year }
      : null;
    const phrase = pedido ? askedModelPhrase(pedido, lexicon) : '';
    const pideOtras =
      resumenPideOtras(resumen) && !otrasDiferidas(customerText);
    const cashBudgetEarly =
      asked || staysOnShown || !resumenPidePresupuesto(resumen)
        ? null
        : cashBudget;
    const wantsListedPrices = includePrice && listedFollowUp;
    const yearPick = yearSaidNow;
    const colorPick = detectColorInText(customerText);
    const targetBrand = asked?.brand || brandSaidInTurn || brand;
    const cabDriveText = `${solicitudSinBanderas(resumen)}\n${concreteAsk ?? ''}\n${customerText}`;
    const askedCab = resumenCabina(resumen) ?? detectAskedCab(cabDriveText);
    const traccionPedida = resumenTraccionPedida(resumen);
    const askedDriveEarly =
      stayMotivo === 'traccion' &&
      (traccionPedida === '4x2' || traccionPedida === '4x4')
        ? traccionPedida
        : detectAskedDrive(cabDriveText);
    const anyBrandPedido =
      asksAnyBrand(customerText) ||
      history.some(
        (item) => item.role === 'user' && asksAnyBrand(item.content),
      );
    const acceptedOther =
      lastOfferedOtherOptions(lastAsst) &&
      (pideOtras || (!staysOnShown && isThreadAck(customerText)));
    const tipoAhoraEarly = resumenTipoPatio(resumen);
    const kindAhoraEarly =
      tipoAhoraEarly && tipoAhoraEarly !== 'no'
        ? tipoAhoraEarly
        : detectVehicleKind(customerText);
    const kindForPatio =
      kindAhoraEarly ||
      (anyBrandPedido || acceptedOther ? vehicleKind : null);
    const listAnyOfKind =
      !asked &&
      !listedFollowUp &&
      !wantsListedPrices &&
      !spaceAsk &&
      !askedOtherColor &&
      !askedCab &&
      !tresFilas &&
      !resumenAsientos(resumen) &&
      Boolean(kindForPatio) &&
      (anyBrandPedido || acceptedOther);
    if (listAnyOfKind && kindForPatio) {
      const box =
        gearbox ??
        (acceptedOther ? detectGearbox(lastAsst, lexicon) : null);
      return this.reviewAnyKindPatio({
        kind: kindForPatio,
        gearbox: box,
        includePrice,
        exceptId:
          box || acceptedOther || pideOtras
            ? (reference?.inventoryId ?? null)
            : null,
      });
    }
    if (
      !targetBrand &&
      !asked &&
      !spaceAsk &&
      !askedOtherColor &&
      !cashBudgetEarly &&
      !wantsListedPrices &&
      !yearPick &&
      !colorPick &&
      !pideOtras &&
      !listedFollowUp &&
      !askedCab &&
      !askedDriveEarly &&
      !phrase &&
      !tresFilas &&
      !detectYearSpan(customerText)
    ) {
      return empty;
    }

    const shownBrandNow = reference?.brand?.trim().toLowerCase() ?? '';
    const switchedBrand = Boolean(
      targetBrand &&
        namesBrandNow &&
        shownBrandNow &&
        targetBrand !== shownBrandNow,
    );
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
      !(mightNameModel(customerText) && !staysOnShown) &&
      !listedFollowUp &&
      !detectYearSpan(customerText)
    ) {
      return empty;
    }
    const tipoAhora = resumenTipoPatio(resumen);
    const kindAhora =
      tipoAhora && tipoAhora !== 'no'
        ? tipoAhora
        : detectVehicleKind(customerText);
    if (
      pideOtras &&
      !asked &&
      !targetBrand &&
      !reference &&
      !kindAhora &&
      !cashBudgetEarly &&
      !tresFilas
    ) {
      return empty;
    }

    const brandsNow = detectBrands(nombraAhora, lexicon);
    const anyTresFilasBrand =
      tresFilas &&
      this.acceptsAnyTresFilasBrand({
        resumen,
        history,
        namedBrand: brandsNow.length > 0 || Boolean(targetBrand),
        namedModel: Boolean(asked),
      });
    if (tresFilas && !asked && brandsNow.length === 0 && !targetBrand && !anyTresFilasBrand) {
      return {
        text: `El cliente pidió 3 filas de asientos. Aún no dijo marca. UNA pregunta: si tiene alguna marca en mente. PROHIBIDO decir que no hay. PROHIBIDO listar SUV a ciegas. vehiculo null.`,
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
      };
    }
    let listed = targetBrand
      ? await this.catalog.listByBrand(targetBrand)
      : await this.catalog.listAvailableExcept('_');
    if (brandsNow.length > 1 && (!asked || tresFilas)) {
      const merged: StockCar[] = [];
      const seen = new Set<string>();
      for (const item of brandsNow) {
        for (const car of await this.catalog.listByBrand(item)) {
          if (seen.has(car.id)) {
            continue;
          }
          seen.add(car.id);
          merged.push(car);
        }
      }
      listed = merged;
    } else if (tresFilas && !asked && brandsNow.length === 0 && !targetBrand && anyTresFilasBrand) {
      listed = pickTresFilasCandidates(
        await this.catalog.listAvailableExcept('_'),
      );
    }
    let pedidoPinned = false;
    if (phrase) {
      const strict = listed.filter((car) =>
        vehicleLabelFitsCar(pedido ?? '', car, lexicon),
      );
      const hits =
        strict.length > 0
          ? strict
          : listed.filter((car) => modelPhraseMatchesCar(phrase, car.model));
      pedidoPinned = strict.length > 0;
      if (hits.length === 0) {
        if (!listedFollowUp && !asked) {
          const names = nombresSeparados(pedido ?? '');
          if (names.length >= 2) {
            return this.revisionPorNombres(pedido ?? '', names);
          }
          return {
            text: `PEDIDO: ${pedido}
Ese modelo no está en patio. Di primero que no lo tenemos, con el nombre que pidió.
PROHIBIDO presentarlo como otra línea parecida de la misma marca.
vehiculo null.`,
            holdVehicle: true,
            sendId: null,
            switchedModel: true,
          };
        }
      } else {
        listed = hits;
      }
    }
    const offerCars = lastListedUnits(
      history,
      await this.catalog.listAvailableExcept('_'),
    );
    const rememberedBrand = brand?.trim().toLowerCase() ?? '';
    const leftListedBrand =
      askedOtherBrandThanListed(brandSaidInTurn, offerCars) ||
      (Boolean(brandSaidInTurn) &&
        Boolean(shownBrandNow) &&
        brandSaidInTurn !== shownBrandNow) ||
      (Boolean(brandSaidInTurn) &&
        Boolean(rememberedBrand) &&
        brandSaidInTurn !== rememberedBrand);
    if (
      targetBrand &&
      namesBrandNow &&
      !asked &&
      !(listedFollowUp && !leftListedBrand) &&
      !gearbox &&
      !askedCab &&
      !askedDriveEarly &&
      !spaceAsk &&
      !yearPick &&
      !colorPick &&
      (!pideOtras || switchedBrand || leftListedBrand) &&
      !cashBudgetEarly &&
      !isConcreteAsk(customerText) &&
      !detectVehicleKind(customerText) &&
      !tresFilas
    ) {
      const lineas = new Set(
        listed.map((car) => modelFamily(car.model)).filter(Boolean),
      );
      if (includePrice && lineas.size === 1 && listed.length > 0) {
        return formatNamedUnits(listed, includePrice);
      }
      return {
        text: formatRevisionMarca({
          marca: targetBrand,
          cars: listed,
          tresFilas: false,
          soloMarca: true,
          includePrice: false,
        }),
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
        vehicleKind: null,
      };
    }
    const solicitud = solicitudSinBanderas(resumen);
    const tipoPatio = resumenTipoPatio(resumen);
    const saidKind =
      (tipoPatio && tipoPatio !== 'no' ? tipoPatio : null) ||
      detectVehicleKind(customerText) ||
      detectVehicleKind(solicitud) ||
      detectVehicleKind(concreteAsk ?? '');
    const inferredKind = asked
      ? kindFromStockFamily(listed, asked.family)
      : null;
    const kindForAsk =
      tipoPatio === 'no'
        ? inferredKind ??
          (pideOtras && !asked && !namesBrandNow ? vehicleKind : null)
        : saidKind ??
          inferredKind ??
          (asked || namesBrandNow ? null : vehicleKind);
    const lastAssistantText =
      [...history].reverse().find((item) => item.role === 'assistant')
        ?.content ?? '';
    let listedPool = lastListedUnits(history, listed);
    if (
      listedPool.length < 2 &&
      looksLikeUnitList(lastAssistantText) &&
      !leftListedBrand
    ) {
      listedPool = lastListedUnits(
        history,
        await this.catalog.listAvailableExcept('_'),
      );
    }
    if (
      listedPool.length >= 2 &&
      !askedOutsideListed(asked?.family, listedPool) &&
      !askedOtherBrandThanListed(brandSaidInTurn, listedPool)
    ) {
      const pool = cashBudget
        ? listedPool.filter((car) => carFitsBudget(car, cashBudget))
        : listedPool;
      if (cashBudget && pool.length === 0) {
        listedPool = [];
      } else {
        if (wantsPhotosOfListed(customerText)) {
          return formatListedPhotoQueue(pool.length > 0 ? pool : listedPool);
        }
        const picked = pickListedUnit(
          pool.length > 0 ? pool : listedPool,
          customerText,
          lexicon,
          { cab: askedCab },
        );
        if (picked && (!cashBudget || carFitsBudget(picked, cashBudget))) {
          const named = formatNamedUnits([picked], includePrice);
          return {
            ...named,
            text: `${named.text}
El cliente ELIGIÓ esta unidad de las que YA le mostramos en el hilo. Ya hay ficha: no busques de nuevo ni la presentes como otra. PROHIBIDO decir que no hay, que no tenemos o “lo más cercano”. Prohibido pedir entrada, plazo o cuota si el hilo no lo pidió. Prohibido meter otra línea.`,
            switchedModel: true,
            vehicleKind: kindFromTypeBody(picked.typeBody),
            choseFromShown: true,
          };
        }
        if (cashBudget && pool.length > 0) {
          listedPool = pool;
        }
        const quotePool = pool.length > 0 ? pool : listedPool;
        if (wantsListedPrices && quotePool.length > 0) {
          const named = formatNamedUnits(quotePool, true);
          const one = quotePool.length === 1;
          return {
            ...named,
            holdVehicle: !one,
            sendId: one ? quotePool[0].id : null,
            switchedModel: true,
            vehicleKind: kindOfNamedUnits(quotePool),
            text: one
              ? `${named.text}
El resumen ya tiene esta unidad. Di su precio. PROHIBIDO otra versión, otro color u otra caja.`
              : `${named.text}
PIDIÓ LOS PRECIOS de las unidades que YA le mostró. Di el $ de inventario de CADA una. Prohibido placa si no la pidió. Prohibido inventar.`,
          };
        }
        return {
          text: `Ya le nombró ${listedPool.length} unidades. PROHIBIDO volver a listarlas. UNA línea: ¿cuál quiere ver? vehiculo null.`,
          holdVehicle: true,
          sendId: null,
          switchedModel: true,
          listedUnits: listedPool,
        };
      }
    }
    if (spaceAsk && !asked && !tresFilas) {
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
    if (cashBudgetEarly) {
      const patio = await this.catalog.listAvailableExcept('_');
      const tight = carsMatchingAskInBudget(patio, cashBudgetEarly, {
        exceptId: reference?.inventoryId,
        kind: kindForAsk,
        gearbox,
      });
      const hits =
        tight.length > 0
          ? preferCurrentYears(tight.slice(0, 6))
          : carsInBudget(patio, cashBudgetEarly, reference?.inventoryId);
      const missAsk =
        tight.length === 0 && (kindForAsk || gearbox)
          ? `No hay ${kindForAsk ?? 'unidad'}${gearbox ? ` ${gearbox}` : ''} en ese tope. No ofrezcas más caras. `
          : '';
      const revision = formatBudgetRevision({
        budget: cashBudgetEarly,
        cars: hits,
        over: reference
          ? { family: reference.family, price: reference.price }
          : undefined,
      });
      return {
        ...revision,
        text: `${missAsk}${revision.text}`,
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(hits) ?? kindForAsk,
      };
    }
    if (
      pideOtras &&
      !asked &&
      !kindForAsk &&
      !targetBrand &&
      !reference &&
      !resumenAsientos(resumen) &&
      !tresFilas
    ) {
      return empty;
    }
    if (
      pideOtras &&
      !asked &&
      !resumenAsientos(resumen) &&
      !tresFilas &&
      !switchedBrand
    ) {
      const patio = await this.catalog.listAvailableExcept('_');
      const exceptId = reference?.inventoryId;
      let pool = patio.filter((car) => car.id !== exceptId);
      const kindPool =
        kindForAsk ?? kindFromTypeBody(reference?.typeBody ?? null);
      if (kindPool) {
        pool = pool.filter((car) =>
          matchesVehicleKind(car.typeBody, kindPool),
        );
      }
      if (askedCab || askedDriveEarly) {
        pool = pickCabDriveOffer(pool, askedCab, askedDriveEarly).cars;
      }
      if (cashBudget) {
        pool = pool.filter((car) => carFitsBudget(car, cashBudget));
      }
      const refPrice = reference?.price ?? 0;
      pool.sort(
        (a, b) =>
          Math.abs((a.price ?? 0) - refPrice) -
          Math.abs((b.price ?? 0) - refPrice),
      );
      if (pool.length === 0) {
        return {
          text: 'PIDIÓ OTRAS unidades. No hay otra en patio de ese tipo. Dilo. vehiculo null. PROHIBIDO volver a la que ya vio. PROHIBIDO mezclar camioneta con SUV.',
          holdVehicle: true,
          sendId: null,
          switchedModel: true,
          vehicleKind: kindPool,
        };
      }
      const shown = pool.length > 6 ? pool.slice(0, 6) : pool;
      if (askedCab || askedDriveEarly) {
        const offer = pickCabDriveOffer(
          shown,
          askedCab,
          askedDriveEarly,
        );
        const named = formatNamedUnits(offer.cars, includePrice);
        return {
          ...named,
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(offer.cars) ?? kindPool,
          text: `${offer.hint}\n${named.text}
PIDIÓ OTRAS, no la unidad que ya vio. Nombra ESTAS. PROHIBIDO volver a presentarla. No pidas permiso para mostrarlas.`,
        };
      }
      if (shown.length === 1) {
        return {
          ...formatNamedUnits(shown, includePrice),
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(shown) ?? kindPool,
        };
      }
      return {
        text: formatOtrasOptionsMessage(shown),
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(shown) ?? kindPool,
        listedUnits: shown,
        photoQueue: toPhotoQueue(shown, 'ficha'),
      };
    }
    if (askedOtherColor && !detectColorInText(customerText) && reference?.family) {
      let pool = listed.filter((car) =>
        rowMentionsFamily(car.model, reference.family ?? ''),
      );
      if (pool.length === 0) {
        const others = await this.catalog.listAvailableExcept(
          targetBrand || '_',
        );
        pool = others.filter((car) =>
          rowMentionsFamily(car.model, reference.family ?? ''),
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
    const yearAsk = yearSaidNow;
    const colorAsk = detectColorInText(customerText);
    const trimAsk = detectTrimInText(customerText);
    const priorUserTexts = history
      .filter((item) => item.role === 'user')
      .map((item) => item.content);
    const threadYear = resolveThreadYear({
      priorUserTexts,
      currentText: customerText,
      lexicon,
      yearSaidNow,
    });
    const yearOnward =
      threadYear.onward || asksYearOnward(solicitud);
    const wantsClosest =
      Boolean(asked) &&
      (asksClosestByFacts(customerText) ||
        yearOnward ||
        asksClosestByFacts(solicitud));
    const yearFromThread = yearNamesTheModel(threadYear.year, asked?.family ?? '')
      ? null
      : threadYear.year;
    const yearSpan =
      detectYearSpan(customerText) ||
      detectYearSpan(solicitud) ||
      threadYear.span;
    const searchingNewPatio =
      !asked &&
      (Boolean(askedCab) ||
        brandsNow.length > 1 ||
        Boolean(namesBrandNow && switchedBrand) ||
        Boolean(
          kindAhora &&
            detectVehicleKind(customerText) === kindAhora &&
            reference?.family,
        ));
    const threadBudget = cashBudget;
    const threadText = shownThreadText(history, resumen);
    const alreadyOffered = carsShownInHistory(history, listed, resumen);
    const pricePool =
      pedidoPinned && listed.length > 0 ? listed : alreadyOffered;
    if (!asked && wantsListedPrices && pricePool.length > 0) {
      const named = formatNamedUnits(pricePool, true);
      const one = pricePool.length === 1;
      return {
        ...named,
        holdVehicle: !one,
        sendId: one ? pricePool[0].id : null,
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(pricePool),
        text: one
          ? `${named.text}
El resumen ya tiene esta unidad. Di su precio. PROHIBIDO otra versión, otro color u otra caja.`
          : `${named.text}
PIDIÓ LOS PRECIOS de las unidades que YA le mostró. Di el $ de inventario de CADA una. Prohibido placa si no la pidió. Prohibido inventar.`,
      };
    }
    let namedRpcEmpty = false;
    const refineFacts =
      Boolean(askedCab) ||
      Boolean(askedDriveEarly) ||
      Boolean(yearAsk) ||
      Boolean(colorAsk) ||
      Boolean(trimAsk) ||
      Boolean(yearSpan);
    if (
      asked &&
      !listedFollowUp &&
      !spaceAsk &&
      !tresFilas &&
      (!refineFacts || wantsClosest)
    ) {
      const searchQuery = [customerText, solicitud]
        .filter((part) => part.trim())
        .join('\n');
      const ranked = this.filterByAskedYear(
        await this.lookupNamedByEmbedding(
          searchQuery || customerText,
          targetBrand || asked.brand || '',
          listed,
          includePrice,
        ),
        yearFromThread,
        yearOnward,
      );
      if (ranked[0]) {
        return this.namedModelFound(
          [ranked[0]],
          includePrice,
          true,
          wantsClosest,
          yearFromThread,
          yearOnward,
        );
      }
      if (!refineFacts) {
        const queryTokens = normalizeModelText(searchQuery || customerText)
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length >= 3);
        const fromListed = this.filterByAskedYear(
          listed.filter((car) =>
            queryTokens.some((token) =>
              askedMatchesShownModel(token, car.model),
            ),
          ),
          yearFromThread,
          yearOnward,
        );
        if (fromListed[0]) {
          return this.namedModelFound(
            fromListed,
            includePrice,
            true,
            wantsClosest,
            yearFromThread,
            yearOnward,
          );
        }
      }
      namedRpcEmpty = true;
    }
    const skipShownYearAsSameModel =
      searchingNewPatio && Boolean(yearAsk) && !colorAsk && !trimAsk;
    if (
      (yearAsk || colorAsk || trimAsk) &&
      !wantsClosest &&
      !skipShownYearAsSameModel
    ) {
      const offered = asked
        ? alreadyOffered.filter((car) =>
            rowMentionsFamily(car.model, asked.family),
          )
        : alreadyOffered;
      const fromOffer = yearSpan
        ? matchUnitFacts(
            offered,
            yearSpan.min,
            colorAsk,
            trimAsk,
            false,
            yearSpan.max,
          )
        : yearAsk
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
          choseFromShown: true,
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
      const porCoincidencia = this.revisionPorCoincidencia({
        text: `${customerText}\n${solicitud}`,
        cars: listed,
        lexicon,
        year: yearAsk,
        includePrice,
        yearSpan: Boolean(yearSpan),
        otroColor: askedOtherColor,
      });
      if (porCoincidencia) {
        return porCoincidencia;
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
            rowMentionsFamily(car.model, threadFamily),
          );
          const picked = matchUnitFacts(
            inFamily,
            yearSpan?.min ?? yearAsk,
            colorAsk,
            null,
            yearOnward && !yearSpan,
            yearSpan?.max ?? null,
          );
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
          if (yearSpan) {
            return await this.missingYearSpanReview(
              threadFamily,
              yearSpan,
              listed,
              includePrice,
              kindForAsk,
            );
          }
          if (yearAsk) {
            const missingYear = formatMissingNamedModel(
              threadFamily,
              yearAsk,
              inFamily,
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
        const byFacts = matchUnitFacts(
          listed,
          yearSpan?.min ?? yearAsk,
          colorAsk,
          trimAsk,
          yearOnward && !yearSpan,
          yearSpan?.max ?? null,
        );
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
    if (wantsClosest && asked && !tresFilas) {
      const fromEmbed = namedRpcEmpty
        ? []
        : this.filterByAskedYear(
            await this.lookupNamedByEmbedding(
              customerText,
              asked.brand || targetBrand || '',
              listed,
              includePrice,
            ),
            yearFromThread,
            yearOnward,
          );
      if (fromEmbed.length > 0) {
        return this.namedModelFound(
          fromEmbed,
          includePrice,
          true,
          true,
          yearFromThread,
          yearOnward,
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
          choseFromShown: boxed.length === 1,
        };
      }
    }
    const namedNow = listed.filter((car) => {
      if (asked?.family) {
        return rowMentionsFamily(car.model, asked.family);
      }
      return textMentionsModel(customerText, car.model);
    });
    const referenceFamily = reference?.family ?? '';
    if (namedNow.length > 0) {
      const boxed = saidBox
        ? namedNow.filter((car) => gearboxOf(car) === saidBox)
        : namedNow;
      const pool = boxed.length > 0 ? boxed : namedNow;
      const cabPick =
        askedCab || askedDriveEarly
          ? pickCabDriveOffer(pool, askedCab, askedDriveEarly)
          : null;
      if (cabPick && cabPick.cars.length === 0 && askedCab && !askedDriveEarly) {
        return {
          text: cabPick.hint,
          holdVehicle: true,
          sendId: null,
          switchedModel: true,
          vehicleKind: kindOfNamedUnits(pool),
        };
      }
      if (yearSpan) {
        const inSpan = carsInYearSpan(pool, yearSpan.min, yearSpan.max);
        if (inSpan.length > 0) {
          return this.namedModelFound(
            inSpan,
            includePrice,
            false,
            false,
            null,
            false,
          );
        }
        const family =
          asked?.family || modelFamily(pool[0]?.model ?? '') || 'unidad';
        return await this.missingYearSpanReview(
          family,
          yearSpan,
          listed,
          includePrice,
          kindForAsk ?? kindOfNamedUnits(pool),
        );
      }
      let offer = preferCurrentYears(
        cabPick && cabPick.cars.length > 0 ? cabPick.cars : pool,
        yearFromThread,
        yearOnward,
      );
      if (!(yearOnward && offer.length === 0)) {
      if (wantsClosest) {
        return this.namedModelFound(
          offer,
          includePrice,
          false,
          true,
          yearFromThread,
          yearOnward,
        );
      }
      if (yearFromThread && !yearOnward) {
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
            offer,
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
        yearOnward,
      );
      }
    }
    if (asked && !tresFilas) {
      if (yearSpan) {
        const fromEmbed = namedRpcEmpty
          ? []
          : this.filterByAskedYear(
              await this.lookupNamedByEmbedding(
                customerText,
                asked.brand,
                listed,
                includePrice,
              ),
              yearSpan.min,
              false,
              yearSpan.max,
            );
        if (fromEmbed.length > 0) {
          return this.namedModelFound(
            fromEmbed,
            includePrice,
            true,
            false,
            null,
            false,
          );
        }
        return await this.missingYearSpanReview(
          asked.family,
          yearSpan,
          listed,
          includePrice,
          kindForAsk,
        );
      }
      const floorYear = yearFromThread;
      const fromEmbed = namedRpcEmpty
        ? []
        : this.filterByAskedYear(
            await this.lookupNamedByEmbedding(
              customerText,
              asked.brand,
              listed,
              includePrice,
            ),
            floorYear,
            yearOnward,
          );
      if (fromEmbed.length > 0) {
        return this.namedModelFound(
          fromEmbed,
          includePrice,
          true,
          false,
          floorYear,
          yearOnward,
        );
      }
      const elsewhere = this.filterByAskedYear(
        await this.familyInOtherBrands(
          asked.family,
          yearOnward ? null : yearFromThread,
          targetBrand,
        ),
        floorYear,
        yearOnward,
      );
      if (elsewhere.length > 0) {
        const fit = threadBudget
          ? elsewhere.filter((car) => carFitsBudget(car, threadBudget))
          : elsewhere;
        if (fit.length > 0) {
          return this.namedModelFound(
            fit,
            includePrice,
            false,
            false,
            floorYear,
            yearOnward,
          );
        }
      }
      const sameFamily = listed.filter((car) =>
        rowMentionsFamily(car.model, asked.family),
      );
      const yearOk = yearOnward && floorYear
        ? carsFromYearOnward(sameFamily, floorYear)
        : yearFromThread && sameFamily.length > 0
          ? carsNearYear(sameFamily, yearFromThread)
          : sameFamily;
      const inBudget = threadBudget
        ? yearOk.filter((car) => carFitsBudget(car, threadBudget))
        : yearOk;
      if (yearOnward && inBudget.length > 0) {
        return this.namedModelFound(
          inBudget,
          includePrice,
          false,
          true,
          floorYear,
          true,
        );
      }
      let alternatives = yearOnward ? [] : inBudget;
      if (alternatives.length === 0) {
        const except = {
          inventoryId: reference?.inventoryId,
          family: reference?.family,
          ids: alreadyOffered.map((car) => car.id),
        };
        const pickOpts = {
          minYear: yearOnward ? floorYear : null,
          budget: threadBudget,
          kind: kindForAsk,
        };
        alternatives = pickClosestToMissingModel(
          listed,
          asked.family,
          except,
          pickOpts,
        );
        if (alternatives.length === 0) {
          const patio = await this.catalog.listAvailableExcept('_');
          const shownPatio = carsShownInHistory(history, patio, resumen);
          alternatives = pickClosestToMissingModel(
            patio,
            asked.family,
            {
              ...except,
              ids: shownPatio.map((car) => car.id),
            },
            pickOpts,
          );
        }
      }
      alternatives = preferCurrentYears(
        alternatives,
        floorYear,
        yearOnward,
      );
      const missing = formatMissingNamedModel(
        asked.family,
        yearOnward ? floorYear : yearFromThread,
        alternatives,
        includePrice,
        yearOnward,
        kindForAsk,
      );
      return {
        ...missing,
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(alternatives) ?? kindForAsk,
      };
    }

    const mentionsReference = Boolean(
      referenceFamily && textMentionsModel(customerText, referenceFamily),
    );
    const askingOther =
      Boolean(referenceFamily) &&
      !mentionsReference &&
      Boolean(detectBrand(nombraAhora, lexicon));
    const leaveByCaja =
      stayMotivo === 'caja' &&
      (cajaCompra === 'manual' || cajaCompra === 'automatica');
    const skipGearboxAlts =
      stayMotivo === 'cabina' || stayMotivo === 'traccion';
    const box: Gearbox | null = leaveByCaja ? cajaCompra : gearbox;

    const asksNow =
      isConcreteAsk(customerText) ||
      (Boolean(concreteAsk) && namesBrandNow && !askingOther) ||
      (namesBrandNow && leftListedBrand) ||
      (tresFilas &&
        (brandsNow.length > 0 || Boolean(targetBrand) || anyTresFilasBrand));
    if (!leaveByCaja && !asksNow && !namesBrandNow) {
      return empty;
    }
    if (!leaveByCaja && askingOther && !asksNow && !leftListedBrand) {
      return {
        text: '',
        holdVehicle: false,
        sendId: null,
        switchedModel: true,
        vehicleKind: null,
      };
    }

    let stock = listed;
    const leftoverShownBrand = Boolean(
      reference?.brand &&
        targetBrand &&
        reference.brand.trim().toLowerCase() !==
          targetBrand.trim().toLowerCase(),
    );
    if (!skipGearboxAlts && box && leftoverShownBrand) {
      const group = bodyGroupOf(kindForAsk);
      const inBrand = listed.filter(
        (car) =>
          gearboxOf(car) === box &&
          (!kindForAsk || matchesVehicleKind(car.typeBody, kindForAsk)),
      );
      if (inBrand.length === 0) {
        const others = await this.catalog.listAvailableExcept(
          targetBrand || '_',
        );
        return {
          ...formatOtherBrandGearboxList({
            gearbox: box,
            askedBrand: targetBrand,
            cars: pickDiverseByBrand(
              [...listed, ...others],
              box,
              group,
              3,
            ),
            includePrice,
          }),
          switchedModel: true,
          vehicleKind: kindForAsk,
        };
      }
      stock = inBrand;
    } else if (
      !skipGearboxAlts &&
      box &&
      reference?.family &&
      (leaveByCaja || !askingOther)
    ) {
      const group = bodyGroupOf(kindForAsk);
      const inBrand = pickGearboxAlternatives({
        cars: listed,
        gearbox: box,
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
          gearbox: box,
          family: reference.family,
          group,
          referencePrice: reference.price,
        });
        if (pick) {
          return {
            ...formatGearboxAlternatives({ gearbox: box, pick, includePrice }),
            contextOrigin: 'alternativas_caja' as const,
            contextIds: pick.cars.map((car) => car.id),
          };
        }
      }
    }
    if (box) {
      const opposite = box === 'manual' ? 'automatica' : 'manual';
      stock = stock.filter((car) => gearboxOf(car) !== opposite);
    }
    const byKind =
      box && bodyGroupOf(kindForAsk) === 'chico'
        ? stock.filter((car) => carBodyGroup(car.typeBody) === 'chico')
        : kindForAsk
          ? stock.filter((car) => matchesVehicleKind(car.typeBody, kindForAsk))
          : stock;
    const askedDrive = askedDriveEarly ?? detectAskedDrive(cabDriveText);
    const cabDriveOffer =
      askedCab || askedDrive
        ? pickCabDriveOffer(byKind, askedCab, askedDrive)
        : { cars: byKind, hint: '' };
    if ((askedCab || askedDrive) && !asked) {
      const offerCars = yearSpan
        ? carsInYearSpan(
            cabDriveOffer.cars,
            yearSpan.min,
            yearSpan.max,
          )
        : preferCurrentYears(
            cabDriveOffer.cars,
            yearFromThread,
            yearOnward,
          );
      if (offerCars.length === 0 && yearSpan) {
        const sameType = preferCurrentYears(cabDriveOffer.cars);
        const brandsLabel = brandsNow.join(', ') || targetBrand || 'esas marcas';
        const missing = formatMissingNamedModel(
          brandsLabel,
          yearSpan.min,
          sameType,
          includePrice,
          false,
          kindForAsk,
          yearSpan.max,
        );
        return {
          ...missing,
          text: `No hay ${kindForAsk ?? 'unidad'}${askedCab === 'cd' ? ' doble cabina' : ''} de ${brandsLabel} ${yearSpan.min} a ${yearSpan.max} en patio. PRIMERO dilo. DESPUÉS, si hay de abajo, ofrece ESA solo si es el mismo tipo. PROHIBIDO cambiar de tipo (camioneta no es SUV, sedán no es hatch).
${missing.text}`,
          switchedModel: true,
          vehicleKind: kindForAsk,
        };
      }
      if (offerCars.length === 0) {
        return {
          text: cabDriveOffer.hint,
          holdVehicle: true,
          sendId: null,
          switchedModel: true,
          vehicleKind: kindForAsk,
        };
      }
      const named = formatNamedUnits(offerCars, includePrice);
      return {
        ...named,
        switchedModel: true,
        vehicleKind: kindOfNamedUnits(offerCars) ?? kindForAsk,
        text: `${cabDriveOffer.hint}\n${named.text}`,
      };
    }
    const byDrive = askedDrive
      ? byKind.filter((car) => unitDrive(car) === askedDrive)
      : byKind;
    let cars =
      cabDriveOffer.cars.length > 0 && (askedCab || askedDrive)
        ? cabDriveOffer.cars
        : byDrive.length > 0
          ? byDrive
          : byKind;
    if (yearSpan) {
      const inSpan = carsInYearSpan(cars, yearSpan.min, yearSpan.max);
      if (inSpan.length > 0) {
        cars = inSpan;
      } else if (kindForAsk && cars.length > 0) {
        const brandsLabel =
          brandsNow.join(', ') || targetBrand || 'esas marcas';
        const missing = formatMissingNamedModel(
          brandsLabel,
          yearSpan.min,
          preferCurrentYears(cars),
          includePrice,
          false,
          kindForAsk,
          yearSpan.max,
        );
        return {
          ...missing,
          text: `No hay ${kindForAsk} de ${brandsLabel} ${yearSpan.min} a ${yearSpan.max} en patio. PRIMERO dilo. DESPUÉS, si hay de abajo, ofrece ESA solo si es el mismo tipo. PROHIBIDO cambiar de tipo (camioneta no es SUV, sedán no es hatch).
${missing.text}`,
          switchedModel: true,
          vehicleKind: kindForAsk,
        };
      } else {
        const family = asked?.family || targetBrand || 'unidad';
        const alts = pickSpanAlternatives(
          cars.length > 0 ? cars : listed,
          family,
          kindForAsk,
          yearSpan,
        );
        if (alts.length > 0) {
          const missing = formatMissingNamedModel(
            family,
            yearSpan.min,
            alts,
            includePrice,
            false,
            kindForAsk,
            yearSpan.max,
          );
          return {
            ...missing,
            switchedModel: true,
            vehicleKind: kindForAsk ?? kindOfNamedUnits(alts),
          };
        }
        cars = inSpan;
      }
    }
    const missedDrive =
      cabDriveOffer.hint ||
      (askedDrive && byDrive.length === 0 && byKind.length > 0
        ? `No hay ${targetBrand ?? 'esa marca'} ${kindForAsk ?? ''} ${askedDrive} en patio. PRIMERO dilo. DESPUÉS ofrece la de abajo solo si es el mismo tipo. 4x2/4x4 es tracción, no el tipo. Prohibido un SUV o jeep si pidió camioneta.`
        : '');
    if (kindForAsk && listed.length > 0 && cars.length === 0) {
      return {
        text: `De ${targetBrand} no hay ${kindForAsk} disponible. PRIMERO dilo. No ofrezcas otro tipo (camioneta no es SUV, sedán no es hatch). 4x2/4x4 es tracción, no el tipo. vehiculo null.`,
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
        vehicleKind: kindForAsk,
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
          preferCurrentYears(namedNow, yearFromThread, yearOnward),
          includePrice,
        );
      }
      const lineas = new Set(
        cars.map((car) => modelFamily(car.model)).filter(Boolean),
      );
      if (includePrice && lineas.size === 1 && cars.length > 0) {
        return formatNamedUnits(
          preferCurrentYears(cars, yearFromThread, yearOnward),
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
          includePrice: false,
        }),
        holdVehicle: true,
        sendId: null,
      };
    }

    const filasAsk =
      concreteAsk ||
      (tresFilas ? customerText.trim() || '3 filas de asientos' : null);
    if (!filasAsk) {
      return empty;
    }

    const facts = await this.collectSpecFacts(filasAsk, cars);
    const specNotes = formatSpecNotes(facts);

    const raw = await this.openai.completeJson(
      COMPLIANCE_SYSTEM_PROMPT,
      JSON.stringify({
        pedido: filasAsk,
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
        text: [missedDrive, `PEDIDO: ${filasAsk}\nNo se pudo revisar el inventario. No afirmes que un carro cumple. vehiculo null.`]
          .filter(Boolean)
          .join('\n'),
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
        vehicleKind: kindForAsk,
      };
    }

    const reviewed = [missedDrive, formatComplianceForAgent(filasAsk, cars, review, includePrice), specNotes]
      .filter(Boolean)
      .join('\n');

    if (idsToOffer(review).length === 0) {
      return {
        text: reviewed,
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
        vehicleKind: kindForAsk,
      };
    }

    const namedId = namedOfferId(cars, idsToOffer(review), userTexts);
    return {
      text: reviewed,
      holdVehicle: vehicleToSend(review, null) === null,
      sendId: vehicleToSend(review, namedId),
      switchedModel: Boolean(kindForAsk && kindForAsk !== vehicleKind),
      vehicleKind: kindForAsk,
    };
  }

  /** Tipo sin marca (cualquiera / auto): listar patio de ese grupo, no clavar una unidad. */
  private async reviewAnyKindPatio(input: {
    kind: VehicleKind;
    gearbox: Gearbox | null;
    includePrice: boolean;
    exceptId?: string | null;
  }): Promise<BrandReview> {
    const patio = (await this.catalog.listAvailableExcept('_')).filter(
      (car) => car.id !== input.exceptId,
    );
    const group = bodyGroupOf(input.kind);
    let cars = pickDiverseByBrand(patio, input.gearbox, group, 3);
    if (cars.length < 3 && group === 'chico') {
      for (const extra of pickDiverseByBrand(
        patio,
        input.gearbox,
        'suv',
        3,
      )) {
        if (!cars.some((row) => row.id === extra.id)) {
          cars.push(extra);
        }
        if (cars.length >= 3) {
          break;
        }
      }
    }
    if (cars.length === 0) {
      return {
        text: 'PIDIÓ OTRAS unidades. No hay otra en patio de ese tipo. Dilo. vehiculo null. PROHIBIDO volver a la que ya vio. PROHIBIDO mezclar camioneta con SUV.',
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
        vehicleKind: input.kind,
      };
    }
    if (cars.length > 1 && input.exceptId) {
      return {
        text: formatOtrasOptionsMessage(cars),
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
        vehicleKind: input.kind,
        listedUnits: cars,
        photoQueue: toPhotoQueue(cars, 'ficha'),
      };
    }
    return {
      ...formatPatioKindList({
        cars,
        includePrice: input.includePrice,
        gearbox: input.gearbox,
      }),
      switchedModel: true,
      vehicleKind: input.kind,
    };
  }

  /** Lo decide el resumen o que ya preguntamos marca. No una frase fija del cliente. */
  private acceptsAnyTresFilasBrand(input: {
    resumen: string;
    history: { role: string; content: string }[];
    namedBrand: boolean;
    namedModel: boolean;
  }): boolean {
    if (input.namedBrand || input.namedModel) {
      return false;
    }
    if (resumenPideOtras(input.resumen)) {
      return true;
    }
    const last =
      [...input.history]
        .reverse()
        .find((item) => item.role === 'assistant' && item.content)?.content ??
      '';
    return /marca|en mente/i.test(last);
  }

  /**
   * El analizador pidió N plazas: primero la ficha de la unidad del hilo.
   * 5p son puertas. Sin dato de ficha se dice no consta; no se inventa.
   */
  private async reviewAsientos(
    interested: InterestedCarSnapshot | null,
    min: number,
    includePrice: boolean,
  ): Promise<BrandReview> {
    const doorsRule =
      '3p/4p/5p del modelo son PUERTAS, no plazas. PROHIBIDO decir 5 plazas por un 5p. Si no hay ficha: "no consta". No afirmes capacidad sin ficha.';
    if (!interested) {
      return {
        text: `ASIENTOS: pidió ${min} plazas. No hay unidad del hilo para investigar. Pregunta de cuál carro. ${doorsRule} vehiculo null.`,
        holdVehicle: true,
        sendId: null,
      };
    }
    const looked = await this.seatsLookupOfShown(interested);
    const sendId =
      looked.stock.id && looked.stock.id !== 'shown'
        ? looked.stock.id
        : interested.inventoryId || null;
    const label = `${interested.brand} ${interested.model}`;
    const unitPrice =
      interested.price && interested.price > 0
        ? Math.round(interested.price)
        : null;
    if (looked.seats != null && looked.seats >= min) {
      return {
        text: `ASIENTOS: la unidad ya mostrada (${label}) SÍ tiene ${looked.seats} plazas (pidió ${min}).${looked.dato ? ` Dato de ficha: ${looked.dato}.` : ''} Dilo. Quédate en ESTA. PROHIBIDO listar otras. ${doorsRule} inventory_id=${sendId ?? interested.inventoryId}`,
        holdVehicle: true,
        sendId,
        unitPrice,
      };
    }
    if (looked.seats != null && looked.seats < min) {
      const patio = await this.catalog.listAvailableExcept('_');
      const pool = pickCarsWithMinSeats(
        patio.filter((car) => car.id !== looked.stock.id),
        min,
      );
      const shownLine = `ASIENTOS: la mostrada (${label}) tiene ${looked.seats} plazas, NO las ${min} que pidió.${looked.dato ? ` Ficha: ${looked.dato}.` : ''} Dilo primero. ${doorsRule}`;
      if (pool.length === 0) {
        return {
          text: `${shownLine}
No hay otra en patio con ${min}+ plazas en ficha. No inventes. ${doorsRule}`,
          holdVehicle: true,
          sendId,
          unitPrice,
        };
      }
      const named = formatNamedUnits(
        pool.length > 6 ? pool.slice(0, 6) : pool,
        includePrice,
      );
      return {
        ...named,
        switchedModel: true,
        text: `${shownLine}
Después nombra SOLO estas, que SÍ traen ${min}+ plazas en patio. Di las plazas. PROHIBIDO pickup/camioneta. PROHIBIDO listar una sin ese dato.
${named.text}`,
      };
    }
    const missing = looked.dato
      ? `ASIENTOS: se investigó la ficha de ${label}. ${looked.dato}. Dilo: no consta. ${doorsRule}`
      : `ASIENTOS: se investigó la ficha de ${label} y no hay dato de plazas. Dilo: no consta en ficha. ${doorsRule}`;
    return {
      text: `${missing}
inventory_id=${sendId ?? interested.inventoryId ?? 'null'}`,
      holdVehicle: true,
      sendId,
      unitPrice,
    };
  }

  private async resolveShownStock(
    car: InterestedCarSnapshot,
  ): Promise<StockCar> {
    const listed = car.brand
      ? await this.catalog.listByBrand(car.brand)
      : [];
    if (car.inventoryId) {
      const byId = listed.find((item) => item.id === car.inventoryId);
      if (byId) {
        return byId;
      }
    }
    const family = modelFamily(car.model);
    const sameLine = listed.filter((item) => {
      const itemFam = modelFamily(item.model);
      const same =
        (family && itemFam === family) ||
        rowMentionsFamily(item.model, car.model);
      if (!same) {
        return false;
      }
      if (car.year != null && item.year != null) {
        return item.year === car.year;
      }
      return true;
    });
    const current = preferCurrentYears(sameLine, car.year);
    if (current[0]) {
      return current[0];
    }
    return {
      id: car.inventoryId || 'shown',
      brand: car.brand,
      model: car.model,
      year: car.year,
      price: car.price,
      typeBody: car.typeBody ?? null,
      color: car.color,
      mileage: car.mileage,
      transmission: car.transmission,
      passengerCapacity: car.passengerCapacity
        ? String(car.passengerCapacity)
        : null,
      plateShort: car.plateShort,
    };
  }

  private async seatsLookupOfShown(car: InterestedCarSnapshot): Promise<{
    seats: number | null;
    dato: string | null;
    stock: StockCar;
  }> {
    const stock = await this.resolveShownStock(car);
    const fromField = seatsOfCar(
      stock.passengerCapacity ?? car.passengerCapacity,
    );
    if (fromField != null) {
      return { seats: fromField, dato: null, stock };
    }
    const facts = await this.collectSpecFacts('asientos', [stock]);
    const hit =
      facts.find((fact) => fact.id === stock.id) ??
      facts.find((fact) => fact.id === car.inventoryId) ??
      facts[0];
    if (!hit) {
      return { seats: null, dato: null, stock };
    }
    if (!hit.seguro) {
      return { seats: null, dato: hit.dato || 'no consta', stock };
    }
    return { seats: seatsFromDato(hit.dato), dato: hit.dato, stock };
  }

  private async seatsOfShown(
    car: InterestedCarSnapshot,
  ): Promise<number | null> {
    return (await this.seatsLookupOfShown(car)).seats;
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

  private async missingYearSpanReview(
    family: string,
    span: { min: number; max: number },
    listed: StockCar[],
    includePrice: boolean,
    kind: VehicleKind | null,
  ): Promise<BrandReview> {
    let alts = pickSpanAlternatives(listed, family, kind, span);
    if (alts.length === 0) {
      const patio = await this.catalog.listAvailableExcept('_');
      alts = pickSpanAlternatives(patio, family, kind, span);
    }
    const missing = formatMissingNamedModel(
      family,
      span.min,
      alts,
      includePrice,
      false,
      kind,
      span.max,
    );
    return {
      ...missing,
      switchedModel: true,
      vehicleKind: kind ?? kindOfNamedUnits(alts),
    };
  }

  private filterByAskedYear(
    cars: StockCar[],
    year: number | null | undefined,
    onward: boolean,
    yearMax: number | null = null,
  ): StockCar[] {
    if (year == null) {
      return cars;
    }
    if (yearMax != null) {
      return carsInYearSpan(cars, year, yearMax);
    }
    return onward
      ? carsFromYearOnward(cars, year)
      : cars.filter((car) => car.year === year);
  }

  private namedModelFound(
    cars: StockCar[],
    includePrice: boolean,
    fromEmbed: boolean,
    closest = false,
    askedYear?: number | null,
    onward = false,
  ): BrandReview {
    const shown = preferCurrentYears(cars, askedYear, onward);
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
      choseFromShown: !closest && Boolean(named.sendId),
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
        rowMentionsFamily(car.model, family) &&
        (year == null || car.year === year),
    );
  }

  private async lookupNamedByEmbedding(
    query: string,
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
    const hits = carsFromMatchJson(raw);
    if (hits.length === 0) {
      this.logger.log(`Embedding no halló unidad (marca=${brand})`);
      return [];
    }
    this.logger.log(
      `Embedding halló: ${hits.map((car) => car.id).join(',')}`,
    );
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
