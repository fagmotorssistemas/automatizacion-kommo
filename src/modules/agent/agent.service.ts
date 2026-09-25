import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { ConversationService } from '../conversation/conversation.service';
import { getDealershipClock, hourInGuayaquil } from '../intelligence/dealership-hours';
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
  hasFacebookMoreInfoClick,
  isFacebookMoreInfoOpener,
} from '../inbox/first-touch';
import { intentsSystemPrompt } from './prompts/intents.prompt';
import { HANDOFF_SUMMARIZER_SYSTEM_PROMPT } from './prompts/handoff-summarizer.prompt';
import { RESUMEN_SYSTEM_PROMPT } from './prompts/resumen.prompt';
import { salesSystemPrompt } from './prompts/sales.prompt';
import {
  detectVehicleKind,
  formatPedidoVigente,
  formatSoloTipoPedido,
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
  formatOtherBrandGearboxList,
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
import {
  askWhichCarMessage,
  formatGreetingPedido,
  shouldOfferGreeting,
} from '../conversation/day-greeting';
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
import { DESPEDIDA_AMABLE, salesFollowHint } from '../conversation/polite-thanks';
import {
  askedOutsideListed,
  formatListedPhotoQueue,
  historyHasUnitList,
  lastListedUnits,
  looksLikeUnitList,
  pickListedUnit,
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
  resumenFaltaVehiculo,
  resumenTipoPatio,
  resumenTopeContado,
  resumenEsToma,
  resumenTomaFicha,
  stripTomaFacts,
  resumenAsksForLocation,
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
  carsFromYearOnward,
  carsShownInHistory,
  formatRevisionMarca,
  formatMissingNamedModel,
  formatNamedUnits,
  hasUsableFicha,
  preferCurrentYears,
  modelFamily,
  detectAskedDrive,
  kindFromStockFamily,
  pickClosestToMissingModel,
  pickShownByYear,
  unitDrive,
  shownThreadText,
  StockCar,
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
  turnAlsoWantsToBuy,
  turnIsSellingTheirCar,
} from './su-carro';
import {
  formatTomaPedido,
  mergeTomaChecklist,
  parseTomaChecklistFromResumen,
} from '../conversation/toma-checklist';

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
  photoQueue?: PhotoQueueItem[];
};

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
): StockCar[] {
  return cars.filter((car) => {
    if (yearAsk) {
      if (car.year == null) {
        return false;
      }
      if (yearOnward ? car.year < yearAsk : car.year !== yearAsk) {
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
    const lastSeenAt = await this.conversation.loadLastSeen(input.contactId);
    const offerGreeting = shouldOfferGreeting({
      lastSeenAt,
      hasHistory: history.length > 0,
    });
    const saludoHint = formatGreetingPedido(
      offerGreeting,
      hourInGuayaquil(),
    );
    const interested = await this.persistence.latestInterestedCar(
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

    const resumenInput = buildResumenInput({
      history,
      customerText: input.customerText,
      handoffBrief,
      tomaChecklist: rememberedToma,
      cashBudget: rememberedBudget,
    });
    const resumen =
      (await this.openai.complete(RESUMEN_SYSTEM_PROMPT, resumenInput)) ??
      input.customerText;
    const cajaCompra = resumenCajaCompra(resumen);
    if (resumenFaltaVehiculo(resumen) && !adVehicle) {
      return this.replyAskWhichCar(input.contactId, input.customerText);
    }
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
    );
    const topeNow = resumenTopeContado(resumen);
    const cashBudget = topeNow ?? rememberedBudget;
    if (topeNow) {
      await this.conversation.saveCashBudget(input.contactId, topeNow);
    }
    const esToma = resumenEsToma(resumen);
    const tomaChecklist = mergeTomaChecklist(
      rememberedToma,
      parseTomaChecklistFromResumen(resumen, lexicon),
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
      purchaseText,
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
    const aceptaVerSiAplica =
      resumenAceptaCredito(resumen) &&
      (historyAskedIfApplies(history) || historyHasShownCuota(history));
    const askedCredit =
      topeNow ||
      aceptaVerSiAplica ||
      resumenRechazaAplicar(resumen) ||
      resumenPrefiereContado(resumen)
        ? false
        : resumenAsksForCredit(resumen) || textAsksForCredit(input.customerText);
    const askedOtherColor =
      resumenAsksForOtherColor(resumen) ||
      textAsksForOtherColor(input.customerText);
    const lastAssistantText =
      [...history].reverse().find((item) => item.role === 'assistant')
        ?.content ?? '';
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
    const lastAssistantListed = looksLikeUnitList(
      [...history].reverse().find((item) => item.role === 'assistant')
        ?.content ?? '',
    );
    const stayOnShown = lastAssistantListed
      ? false
      : (isThreadAck(input.customerText) || resumenIsThreadAck(resumen)) &&
          !resumenPideOtras(resumen) &&
          !resumenTopeContado(resumen)
        ? true
        : followsShownCar({
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
                    brand: interested.brand ?? null,
                  }
                : null,
              lexicon,
              spaceAsk,
              askedOtherColor,
              resumen,
              cajaCompra,
              cashBudget,
            );
    if (closing) {
      revision = {
        text: DESPEDIDA_AMABLE,
        holdVehicle: true,
        sendId: interested?.inventoryId ?? revision.sendId,
      };
    }
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
      !closing &&
      (stayOnShown ||
        refersToInterestedCar(
          input.customerText,
          interested,
          lexicon,
          resumen,
        )) &&
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
              : topeNow
                ? 'PRESUPUESTO: lista las unidades que caben. El sistema pregunta si quieren crédito o contado. PROHIBIDO armar cuota. PROHIBIDO pregunta de visita en este turno.'
                : '';
    const anuncioHint = adVehicle
      ? `ANUNCIO DE FACEBOOK. El cliente pidió información del ${adVehicle}. Presenta ESA unidad del inventario. Si hay una, mándala (ficha, sin precio). Si hay varias de esa misma línea, nómbralas y pregunta cuál. PROHIBIDO preguntar qué carro le interesa. PROHIBIDO listar otras marcas.`
      : '';
    const pedidoVigente = (
      stayOnShown
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
              spaceAsk
                ? null
                : revision.switchedModel
                  ? (revision.vehicleKind ?? null)
                  : vehicleKind,
              detectBrand(input.customerText, lexicon) ||
                detectNamedModelAsk(input.customerText, lexicon)?.brand ||
                (cajaCompra === 'no' ? null : brand),
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
      revision.photoQueue.length > 1 &&
      historyHasUnitList(history)
    ) {
      const parsed: ParsedAgentOutput = {
        mensaje: 'Le mando las fotos de cada una, una por una.',
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
      return { reply: parsed, resumen, photoQueue: revision.photoQueue };
    }

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
          (canQuotePrice || askedPrice) && Boolean(revision.sendId),
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
        Boolean(topeNow) && revision.text.includes('PRESUPUESTO DE CONTADO');
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
    await this.conversation.saveLastSeen(input.contactId);

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
    const history = await this.recentDialogue(contactId);
    const lastSeenAt = await this.conversation.loadLastSeen(contactId);
    const mensaje = askWhichCarMessage(
      shouldOfferGreeting({
        lastSeenAt,
        hasHistory: history.length > 0,
      }),
      hourInGuayaquil(),
    );
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
    await this.conversation.saveLastSeen(contactId);
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
    tipoPatio: ReturnType<typeof resumenTipoPatio>,
  ): Promise<VehicleKind | null> {
    const remembered = await this.conversation.loadVehicleKind(contactId);
    const dropOldKind = tipoPatio === 'no';
    const kind = resolveVehicleKind({
      history,
      customerText,
      remembered,
      interestedKind: dropOldKind ? null : interestedKind,
      resumenKind: tipoPatio && tipoPatio !== 'no' ? tipoPatio : null,
      dropOldKind,
    });
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
    } | null,
    lexicon: VehicleLexicon,
    spaceAsk = false,
    askedOtherColor = false,
    resumen = '',
    cajaCompra: ReturnType<typeof resumenCajaCompra> = null,
    cashBudget: number | null = null,
  ): Promise<BrandReview> {
    const empty: BrandReview = { text: '', holdVehicle: false, sendId: null };
    const listedFollowUp = looksLikeUnitList(
      [...history].reverse().find((item) => item.role === 'assistant')
        ?.content ?? '',
    );
    const fromText = detectNamedModelAsk(customerText, lexicon);
    const fromSolicitud =
      cajaCompra === 'no'
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
    const pideOtras = resumenPideOtras(resumen);
    const cashBudgetEarly = asked ? null : cashBudget;
    const wantsListedPrices = /\bprecios?\b/i.test(customerText);
    const yearPick = yearSaidNow;
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
      !pideOtras &&
      !listedFollowUp
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
      !mightNameModel(customerText) &&
      !listedFollowUp
    ) {
      return empty;
    }
    const tipoAhora = resumenTipoPatio(resumen);
    const kindAhora =
      tipoAhora && tipoAhora !== 'no'
        ? tipoAhora
        : detectVehicleKind(customerText);
    if (pideOtras && !asked && !targetBrand && !reference && !kindAhora) {
      return empty;
    }

    const listed = targetBrand
      ? await this.catalog.listByBrand(targetBrand)
      : await this.catalog.listAvailableExcept('_');
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
        ? inferredKind
        : saidKind ??
          inferredKind ??
          (asked || namesBrandNow ? null : vehicleKind);
    const lastAssistantText =
      [...history].reverse().find((item) => item.role === 'assistant')
        ?.content ?? '';
    let listedPool = lastListedUnits(history, listed);
    if (listedPool.length < 2 && looksLikeUnitList(lastAssistantText)) {
      listedPool = lastListedUnits(
        history,
        await this.catalog.listAvailableExcept('_'),
      );
    }
    if (
      listedPool.length >= 2 &&
      !askedOutsideListed(asked?.family, listedPool)
    ) {
      const pool = cashBudget
        ? listedPool.filter((car) => carFitsBudget(car, cashBudget))
        : listedPool;
      if (cashBudget && pool.length === 0) {
        listedPool = [];
      } else {
      const picked = pickListedUnit(
        pool.length > 0 ? pool : listedPool,
        customerText,
        lexicon,
      );
      if (picked && (!cashBudget || carFitsBudget(picked, cashBudget))) {
        return {
          ...formatNamedUnits([picked], includePrice),
          switchedModel: true,
          vehicleKind: kindFromTypeBody(picked.typeBody),
        };
      }
      if (cashBudget && pool.length > 0) {
        listedPool = pool;
      }
      if (wantsPhotosOfListed(customerText)) {
        return formatListedPhotoQueue(listedPool);
      }
      return {
        text: `Ya le nombró ${listedPool.length} unidades. PROHIBIDO volver a listarlas. UNA línea: ¿cuál quiere ver? vehiculo null.`,
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
      };
      }
    }
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
    if (pideOtras && !asked && !kindForAsk && !targetBrand && !reference) {
      return empty;
    }
    if (pideOtras && !asked) {
      const patio = await this.catalog.listAvailableExcept('_');
      const exceptId = reference?.inventoryId;
      let pool = patio.filter((car) => car.id !== exceptId);
      if (kindForAsk) {
        const typed = pool.filter((car) =>
          matchesVehicleKind(car.typeBody, kindForAsk),
        );
        if (typed.length > 0) {
          pool = typed;
        }
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
    const yearAsk = yearSaidNow;
    const colorAsk = detectColorInText(customerText);
    const trimAsk = detectTrimInText(customerText);
    const priorUserTexts = history
      .filter((item) => item.role === 'user')
      .map((item) => item.content);
    const yearOnward =
      asksYearOnward(customerText) ||
      asksYearOnward(solicitud) ||
      priorUserTexts.some((text) => asksYearOnward(text));
    const wantsClosest =
      Boolean(asked) &&
      (asksClosestByFacts(customerText) ||
        yearOnward ||
        asksClosestByFacts(solicitud));
    const yearFromThread = asked
      ? yearSaidNow ??
        asked.year ??
        lastYearInUserTexts(priorUserTexts, lexicon)
      : (yearAsk ?? lastYearInUserTexts(priorUserTexts, lexicon));
    const threadBudget = cashBudget;
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
      const fromEmbed = this.filterByAskedYear(
        await this.lookupNamedByEmbedding(
          customerText,
          asked.family,
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
        yearOnward,
      );
      }
    }
    if (asked) {
      const floorYear = yearFromThread ?? asked.year;
      const fromEmbed = this.filterByAskedYear(
        await this.lookupNamedByEmbedding(
          customerText,
          asked.family,
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
          yearOnward ? null : asked.year,
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
        textMentionsModel(car.model, asked.family),
      );
      const yearOk = yearOnward && floorYear
        ? carsFromYearOnward(sameFamily, floorYear)
        : asked.year && sameFamily.length > 0
          ? carsNearYear(sameFamily, asked.year)
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
        yearOnward ? floorYear : asked.year,
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
    const leftoverShownBrand = Boolean(
      reference?.brand &&
        targetBrand &&
        reference.brand.trim().toLowerCase() !==
          targetBrand.trim().toLowerCase(),
    );
    if (gearbox && leftoverShownBrand) {
      const group = bodyGroupOf(kindForAsk);
      const inBrand = listed.filter(
        (car) =>
          gearboxOf(car) === gearbox &&
          (!kindForAsk || matchesVehicleKind(car.typeBody, kindForAsk)),
      );
      if (inBrand.length === 0) {
        const others = await this.catalog.listAvailableExcept(
          targetBrand || '_',
        );
        return {
          ...formatOtherBrandGearboxList({
            gearbox,
            askedBrand: targetBrand,
            cars: pickDiverseByBrand(
              [...listed, ...others],
              gearbox,
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
    } else if (gearbox && reference?.family && !askingOther) {
      const group = bodyGroupOf(kindForAsk);
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
    const byKind =
      gearbox && bodyGroupOf(kindForAsk) === 'chico'
        ? stock.filter((car) => carBodyGroup(car.typeBody) === 'chico')
        : kindForAsk
          ? stock.filter((car) => matchesVehicleKind(car.typeBody, kindForAsk))
          : stock;
    const askedDrive = detectAskedDrive(
      `${customerText}\n${concreteAsk ?? ''}\n${solicitud}`,
    );
    const byDrive = askedDrive
      ? byKind.filter((car) => unitDrive(car) === askedDrive)
      : byKind;
    const cars = byDrive.length > 0 ? byDrive : byKind;
    const missedDrive =
      askedDrive && byDrive.length === 0 && byKind.length > 0
        ? `No hay ${targetBrand ?? 'esa marca'} ${kindForAsk ?? ''} ${askedDrive} en patio. PRIMERO dilo. DESPUÉS ofrece la de abajo solo si es el mismo tipo. 4x2/4x4 es tracción, no el tipo. Prohibido un SUV o jeep si pidió camioneta.`
        : '';
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
        text: [missedDrive, `PEDIDO: ${concreteAsk}\nNo se pudo revisar el inventario. No afirmes que un carro cumple. vehiculo null.`]
          .filter(Boolean)
          .join('\n'),
        holdVehicle: true,
        sendId: null,
        switchedModel: true,
        vehicleKind: kindForAsk,
      };
    }

    const reviewed = [missedDrive, formatComplianceForAgent(concreteAsk, cars, review, includePrice), specNotes]
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

  private filterByAskedYear(
    cars: StockCar[],
    year: number | null | undefined,
    onward: boolean,
  ): StockCar[] {
    if (year == null) {
      return cars;
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
