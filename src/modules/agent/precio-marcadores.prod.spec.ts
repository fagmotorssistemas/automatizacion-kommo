import { AgentService } from './agent.service';
import { TEST_LEXICON } from '../conversation/test-lexicon';
import { FRASE_PRECIO_PENDIENTE } from '../catalog/precio-marcador';
import type { StockCar } from '../catalog/clasificar-filas';

/**
 * 22 turnos reales (2026-09-30 → 2026-10-02) rotos por postprocesos de precio
 * y 5 donde el $ salió bien. El LLM del test escribe {{precio:uN}}; el código
 * pone el de patio. Viejo = mensaje que vio el cliente en producción.
 */
type Caso = {
  id: string;
  kind: 'roto' | 'bien';
  contactId: string;
  customerText: string;
  resumen: string;
  unit: StockCar;
  llm: string;
  oldMensaje: string;
  expectAmount?: number;
  expectPending?: boolean;
  neverAmounts?: number[];
};

const escape: StockCar = {
  id: 'b0030b86-759d-453a-b87e-64b774cb1baf',
  brand: 'ford',
  model: 'escape titanium ac 2.0 5p 4x2 ta',
  year: 2023,
  price: 32800,
  typeBody: 'jeep',
  color: 'vino',
};
const explorer: StockCar = {
  id: '479b66bd-350c-48c5-bf76-d480223572ae',
  brand: 'ford',
  model: 'explorer xlt ac 3.5 5p 4x4 ta',
  year: 2018,
  price: 33900,
  typeBody: 'jeep',
  color: 'blanco',
};
const fortuner: StockCar = {
  id: '4be35f43-a282-4b99-b95a-2626074fb8f8',
  brand: 'toyota',
  model: 'new fortuner ac 2.7 5p 4x4 ta',
  year: 2021,
  price: 44800,
  typeBody: 'jeep',
  color: 'negro',
};
const rav4: StockCar = {
  id: '381ac25f-c014-4bc4-adb7-ed04ffc0df0c',
  brand: 'toyota',
  model: 'new rav4 ac 2.5 5p 4x2 ta',
  year: 2015,
  price: 18900,
  typeBody: 'jeep',
  color: 'rojo',
};
const rangerXlt: StockCar = {
  id: 'ab7f5898-b04d-4d56-b757-f0c9dc217c9e',
  brand: 'ford',
  model: 'ranger xlt ac 2.0 cd 4x4 ta diesel',
  year: 2026,
  price: 68800,
  typeBody: 'doble cabina',
  color: 'plomo',
  mileage: 22868,
};
const qq3: StockCar = {
  id: '3cb90d8f-4e8a-4820-a93e-f647d9a195b4',
  brand: 'chery',
  model: 'qq3 1.1',
  year: 2012,
  price: 5800,
  typeBody: 'hatchback',
  color: 'plateado',
};
const fiat500: StockCar = {
  id: 'aa00fed0-3337-4274-9575-8cc3bc66718c',
  brand: 'fiat',
  model: '500 lounge ac 1.4 3p 4x2 tm',
  year: 2017,
  price: 13990,
  typeBody: 'hatckback',
  color: 'plomo',
};
const seltos: StockCar = {
  id: 'seltos-ex-2020',
  brand: 'kia',
  model: 'seltos ex ac 1.6 5p 4x2 ta',
  year: 2020,
  price: 19990,
  typeBody: 'jeep',
  color: 'plomo',
};
const runner: StockCar = {
  id: 'f5526c6e-4500-4aaf-af0e-be667203e0a0',
  brand: 'toyota',
  model: '4 runner 4x2 t/a',
  year: 2004,
  price: 21400,
  typeBody: 'jeep',
  color: 'rojo',
};
const x70plus: StockCar = {
  id: '70f0b727-15a0-4aa9-ad1e-1e8a5d203968',
  brand: 'jetour',
  model: 'x70 plus ii ac 1.5 4x2 tm',
  year: 2025,
  price: 22800,
  typeBody: 'jeep',
  color: 'plateado',
};
const vitara2015: StockCar = {
  id: 'd38ea60d-9b1e-490d-8b45-790a09e819ee',
  brand: 'suzuki',
  model: 'grand vitara sz next ac 2.0 5p 4x2',
  year: 2015,
  price: 13800,
  typeBody: 'jeep',
  color: 'blanco',
};
const dmaxCs: StockCar = {
  id: 'd8402fd7-203c-4213-a2d1-e9801586a4b9',
  brand: 'chevrolet',
  model: 'd-max crdi 2.5 cs 4x2 tm diesel',
  year: 2020,
  price: 24500,
  typeBody: 'camioneta',
  color: 'blanco',
};
const dmax2023: StockCar = {
  id: 'c110ef68-28b0-4a7b-84a8-e8619e4c2114',
  brand: 'chevrolet',
  model: 'd-max crdi 2.5 cd 4x2 tm diesel',
  year: 2023,
  price: 28990,
  typeBody: 'camioneta',
  color: 'plateado',
};
const hunter: StockCar = {
  id: '012630d0-3319-4e37-883c-51514d47eb38',
  brand: 'changan',
  model: 'hunter ac 2.4 cd 4x2 tm',
  year: 2023,
  price: 18500,
  typeBody: 'camioneta',
  color: 'blanco',
  mileage: 141048,
};
const xtrail: StockCar = {
  id: '62434e00-2a0e-4795-a4c9-fd544fe2c1af',
  brand: 'nissan',
  model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
  year: 2016,
  price: 16890,
  typeBody: 'jeep',
  color: 'azul',
  mileage: 144904,
};
const sportageBlanco: StockCar = {
  id: 'fc341cf2-2b4b-412f-9a5b-6a6297817e8f',
  brand: 'kia',
  model: 'sportage sl ac 2.0 5p 4x2 tm',
  year: 2019,
  price: 22990,
  typeBody: 'jeep',
  color: 'blanco',
  mileage: 93280,
};
const creta: StockCar = {
  id: 'b7d3649a-c700-4070-b4e2-21289a45b330',
  brand: 'hyundai',
  model: 'creta ac 1.5 5p 4x2 tm',
  year: 2022,
  price: 22990,
  typeBody: 'jeep',
  color: 'blanco',
};
const expedition: StockCar = {
  id: 'e2bda47c-1d46-4966-b717-5cad5192b529',
  brand: 'ford',
  model: 'expedition limited ac 3.5 5p 4x4 ta',
  year: 2021,
  price: 0,
  typeBody: 'jeep',
  color: 'blanco',
};
const hilux2026: StockCar = {
  id: '3344c7e5-1abd-4aa7-a2c4-7986d47e3241',
  brand: 'toyota',
  model: 'hilux 2.4 cd 4x4 tm diesel',
  year: 2026,
  price: 0,
  typeBody: 'doble cabina',
  color: 'plomo',
};
const optra: StockCar = {
  id: 'e9e226c9-36ca-4e61-ae3f-154b7de9d999',
  brand: 'chevrolet',
  model: 'optra advance 1.8l 4p tm',
  year: 2012,
  price: 10900,
  typeBody: 'sedan',
  color: 'vino',
};
const picanto: StockCar = {
  id: '8f5a0cd5-8365-4fb5-8a6b-88c5523ee9ee',
  brand: 'kia',
  model: 'picanto lx ac 1.2 4p 4x2 ta',
  year: 2023,
  price: 15990,
  typeBody: 'sedan',
  color: 'blanco',
};
const santaFe: StockCar = {
  id: '16c145ba-a4d0-4dbb-a3a2-af0ff64c9e0c',
  brand: 'hyundai',
  model: 'santa fe dm 7pas ac 2.4 5p 4x2',
  year: 2018,
  price: 22990,
  typeBody: 'jeep',
  color: 'azul',
};
const terralord: StockCar = {
  id: 'a644237c-9397-4b17-a800-b37e95ef83e5',
  brand: 'zx auto',
  model: 'terralord heavy duty ac 2.4 cd',
  year: 2023,
  price: 19900,
  typeBody: 'doble cabina',
  color: 'plateado',
  mileage: 64400,
};
const yuan: StockCar = {
  id: 'yuan-2026',
  brand: 'byd',
  model: 'yuan plus',
  year: 2026,
  price: 21990,
  typeBody: 'jeep',
  color: 'blanco',
};

const patio: StockCar[] = [
  escape,
  explorer,
  fortuner,
  rav4,
  rangerXlt,
  qq3,
  fiat500,
  seltos,
  runner,
  x70plus,
  vitara2015,
  dmaxCs,
  dmax2023,
  hunter,
  xtrail,
  sportageBlanco,
  creta,
  expedition,
  hilux2026,
  optra,
  picanto,
  santaFe,
  terralord,
  yuan,
];

function interestedOf(car: StockCar) {
  return {
    inventoryId: car.id,
    brand: car.brand,
    model: car.model,
    year: car.year,
    price: car.price,
    typeBody: car.typeBody,
    color: car.color,
    mileage: car.mileage ?? null,
  };
}

function resumenPrecio(linea: string): string {
  return [
    'SOLICITUD ACTUAL:',
    linea,
    'Pide precio: sí',
    'Pide crédito: no',
    'Pide otras: no',
  ].join('\n');
}

const rotos: Caso[] = [
  {
    id: '59805617 Escape $ de otra unidad',
    kind: 'roto',
    contactId: '59805617',
    customerText: 'Precio\nPrecio\nPrecio',
    resumen: resumenPrecio(
      'Cliente quiere el precio del Toyota Land Cruiser Prado VX T/M 2001.',
    ),
    unit: escape,
    llm: 'El Ford Escape 2023 está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $32,800. El Ford Escape Titanium AC 2.0 5P 4X2 TA Estamos en Cuenca, si desea puede visitarnos en nuestra concesionaria para verlo personalmente.',
    expectAmount: 32800,
    neverAmounts: [33900],
  },
  {
    id: '59805617 Fortuner hueco + $ Explorer',
    kind: 'roto',
    contactId: '59805617',
    customerText:
      'Igual del fortuner y el montero que sean 4x4 deme los precios gracias',
    resumen: resumenPrecio(
      'Cliente quiere los precios del fortuner y el montero que sean 4x4.',
    ),
    unit: fortuner,
    llm: 'El Toyota Fortuner 2021 4x4 está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $33,900. El Toyota Fortuner 2021 4x4 tiene un y el Mitsubishi Montero Sport 2022 4x4.',
    expectAmount: 44800,
    neverAmounts: [33900],
  },
  {
    id: '59822097 Rav4 hueco',
    kind: 'roto',
    contactId: '59822097',
    customerText: 'Que precio tiene',
    resumen: resumenPrecio(
      'Cliente quiere el precio del Toyota rava4 modelo 2015 automática.',
    ),
    unit: rav4,
    llm: 'El Toyota Rav4 2015 está en {{precio:u1}}. Está en Cuenca.',
    oldMensaje:
      'El precio es $18,900. El Toyota New Rav4 AC 2.5 5p 4x2 automática del 2015 tiene un en Cuenca.',
    expectAmount: 18900,
  },
  {
    id: '59819631 Ranger montos sueltos',
    kind: 'roto',
    contactId: '59819631',
    customerText:
      'Enséñeme la 4x4 Ranger del 2026: y solo por curiosidad dls',
    resumen: resumenPrecio(
      'Cliente quiere el precio de la Ford Ranger XLT 2026 4x4.',
    ),
    unit: rangerXlt,
    llm: 'La Ford Ranger XLT 2026 4x4 está en {{precio:u1}}.',
    oldMensaje:
      'La Ford Ranger XLT AC 2.0 CD 4x4 automática 2026 color plomo tiene un precio de $68,800. ¿Desea coordinar una visita para verla en la concesionaria? $44,590. $22,990. $34,990.',
    expectAmount: 68800,
    neverAmounts: [44590, 22990, 34990],
  },
  {
    id: '59822529 Fiat/Chery huecos',
    kind: 'roto',
    contactId: '59822529',
    customerText: 'Si cada uno con su precio',
    resumen: resumenPrecio(
      'Cliente quiere el precio de cada opción más económica.',
    ),
    unit: qq3,
    llm: 'El Chery QQ3 2012 está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $5,800. El Fiat 500 2017 está en  y el Chery QQ3 2012 en.',
    expectAmount: 5800,
    neverAmounts: [13990],
  },
  {
    id: '59822529 Seltos $ del Fiat',
    kind: 'roto',
    contactId: '59822529',
    customerText: 'Precio',
    resumen: resumenPrecio('Cliente quiere el precio del Kia Seltos EX 2020.'),
    unit: seltos,
    llm: 'El Kia Seltos EX 2020 está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $13,990. El Kia Seltos EX AC 1.6 2020 en nuestra concesionaria en Cuenca.',
    expectAmount: 19990,
    neverAmounts: [13990],
  },
  {
    id: '59752635 Expedition hueco + no cargado',
    kind: 'roto',
    contactId: '59752635',
    customerText:
      'Pero amigo, ¿cuál es el precio? Tengo 5.000 para darlo por delante. ¿Cuál es el precio? ¿Cuál es la cuota? A 5 años le estoy diciendo.',
    resumen: resumenPrecio(
      'Cliente quiere el precio de la Ford Expedition 2021 con entrada de 5 mil.',
    ),
    unit: expedition,
    llm: 'La Ford Expedition 2021 está en {{precio:u1}}.',
    oldMensaje:
      'La Ford Expedition Limited AC 3.5 automática 4x4 2021 color blanco tiene el precio aún no cargado en nuestro sistema. Para financiar con una entrada de  a 5 años',
    expectPending: true,
  },
  {
    id: '59822499 Golf $ del 4Runner',
    kind: 'roto',
    contactId: '59822499',
    customerText: 'Y precio del golf',
    resumen: resumenPrecio('Cliente quiere el precio del golf.'),
    unit: runner,
    llm: 'El Golf no está en nuestro inventario actual.',
    oldMensaje:
      'El precio es $21,400. El Golf no está en nuestro inventario actual, por favor indíquenos otro modelo o vehículo de su interés para ayudarle mejor.',
    neverAmounts: [21400],
  },
  {
    id: '59824615 Yuan/Creta/Sportage huecos',
    kind: 'roto',
    contactId: '59824615',
    customerText: 'Precios',
    resumen: resumenPrecio(
      'Cliente quiere los precios de las otras opciones mostradas.',
    ),
    unit: yuan,
    llm: 'El BYD Yuan 2026 está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $22,800. Byd Yuan 2026 está a. Hyundai Creta 2022 a. Kia Sportage 2019 desde  y Jetour X70 2025 a.',
    expectAmount: 21990,
    neverAmounts: [22800],
  },
  {
    id: '59326601 Vitara 2008 $ del 2015',
    kind: 'roto',
    contactId: '59326601',
    customerText: '¡Hola! Quiero más información\nPresio a credito',
    resumen: resumenPrecio(
      'Cliente quiere más información y el precio a crédito del Chevrolet Grand Vitara 2008.',
    ),
    unit: vitara2015,
    llm: 'La Suzuki Grand Vitara 2015 está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $13,800. Buenos días, estimado. Para seguir con el financiamiento de la Suzuki Grand Vitara 2015',
    expectAmount: 13800,
  },
  {
    id: '44666879 D-Max CS hueco + $ de otra',
    kind: 'roto',
    contactId: '44666879',
    customerText: 'Y la cabina censsilla precio',
    resumen: resumenPrecio(
      'Cliente quiere el precio de la Chevrolet D-Max CRDi 2.5 CS 2020.',
    ),
    unit: dmaxCs,
    llm: 'La Chevrolet D-Max CS 2020 está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $28,990. El  la Chevrolet D-Max CRDi 2.5 CS 4x2 TM diesel 2020 color blanco que consultó es.',
    expectAmount: 24500,
    neverAmounts: [28990],
  },
  {
    id: '59795449 Hunter no cargado con $ en patio',
    kind: 'roto',
    contactId: '59795449',
    customerText: 'Chévere, me indica y el precio tambien',
    resumen: resumenPrecio(
      'Cliente quiere el precio de la camioneta 4x4 cabina sencilla.',
    ),
    unit: hunter,
    llm: 'El Changan Hunter 2023 está en {{precio:u1}}.',
    oldMensaje:
      'Contamos con un Changan Hunter AC 2.4 cd 4x2 2023 color blanco, con 141,048 km, transmisión manual.\n\nEl precio de esta unidad aún no está cargado en patio. En un momento un asesor le confirma el valor.',
    expectAmount: 18500,
  },
  {
    id: '51118331 X-Trail no cargado con $ en patio',
    kind: 'roto',
    contactId: '51118331',
    customerText:
      'Ok Vera el Nissan el alto  el q están exhibiendo en el video ese me interesa',
    resumen: resumenPrecio(
      'Cliente quiere confirmar el precio del Nissan X-Trail 2016.',
    ),
    unit: xtrail,
    llm: 'El Nissan X-Trail 2016 está en {{precio:u1}}.',
    oldMensaje:
      'Estimado, no tenemos disponible el Nissan X-Trail 2016 azul con caja automática que menciona.\n\nEl precio de esta unidad aún no está cargado en patio. En un momento un asesor le confirma el valor.',
    expectAmount: 16890,
  },
  {
    id: '59822301 Sportage blanco no cargado con $ en patio',
    kind: 'roto',
    contactId: '59822301',
    customerText: 'Y disculpe el blanco en cuanto está?',
    resumen: resumenPrecio(
      'Cliente quiere saber el precio del Kia Sportage blanco.',
    ),
    unit: sportageBlanco,
    llm: 'El Kia Sportage 2019 blanco está en {{precio:u1}}.',
    oldMensaje:
      'No contamos con Kia Sportage blanco en este momento. Sin embargo, tenemos un Kia Sportage SL AC 2.0 5p 4x2 manual 2019 color blanco, con 93,280 km.\n\nEl precio de esta unidad aún no está cargado en patio.',
    expectAmount: 22990,
  },
  {
    id: '59822961 Creta no cargado con $ en patio',
    kind: 'roto',
    contactId: '59822961',
    customerText:
      '¿Cómo estás señorita? Buenos días. Ayúdeme con el precio del Cretan, por favor.',
    resumen: resumenPrecio('Cliente quiere el precio del Hyundai Creta 2022.'),
    unit: creta,
    llm: 'El Hyundai Creta 2022 está en {{precio:u1}}.',
    oldMensaje:
      'El precio de esta unidad aún no está cargado en patio. En un momento un asesor le confirma el valor.',
    expectAmount: 22990,
  },
  {
    id: '59836319 Hilux 2. + no cargado',
    kind: 'roto',
    contactId: '59836319',
    customerText: 'Las dos\nQué precio tiene',
    resumen: resumenPrecio(
      'Cliente quiere conocer el precio de las dos Toyota 4x4 diésel.',
    ),
    unit: hilux2026,
    llm: 'El Toyota Hilux 2026 está en {{precio:u1}}.',
    oldMensaje:
      'El precio del Toyota Hilux 2. Le confirmo que este vehículo es cuidado.\n\nEl precio de esta unidad aún no está cargado en patio.',
    expectPending: true,
  },
  {
    id: '59836319 Hilux entrada hueco',
    kind: 'roto',
    contactId: '59836319',
    customerText: 'Tiene fotos\nY como serían los pagos\nSi tengo entrada de 20 k',
    resumen: resumenPrecio(
      'Cliente quiere fotos y cómo serían los pagos con entrada de 20 k.',
    ),
    unit: hilux2026,
    llm: 'El Toyota Hilux 2026 está en {{precio:u1}}.',
    oldMensaje:
      'El precio del Toyota Hilux 2. Con una entrada de  puedo ayudarle a calcular la cuota.',
    expectPending: true,
  },
  {
    id: '59836319 Hilux otra unidad',
    kind: 'roto',
    contactId: '59836319',
    customerText: 'Y de la otra\nMe interesaría los precios',
    resumen: resumenPrecio(
      'Cliente quiere conocer el precio de la segunda Toyota 4x4 diésel.',
    ),
    unit: hilux2026,
    llm: 'El Toyota Hilux 2026 está en {{precio:u1}}.',
    oldMensaje:
      'El precio del Toyota Hilux 2. Cuando lo confirme un asesor, podrá coordinar la compra.\n\nEl precio de esta unidad aún no está cargado en patio.',
    expectPending: true,
  },
  {
    id: '59482965 Sail/Optra $ de otra',
    kind: 'roto',
    contactId: '59482965',
    customerText: 'Tengo 1000 a 1500 de entrada',
    resumen: resumenPrecio(
      'Cliente quiere financiar el Chevrolet Sail o el Optra.',
    ),
    unit: optra,
    llm: 'El Chevrolet Optra Advance está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $10,900. El precio de contado del Chevrolet Optra Advance 1.8L 4p tm es de $9800.',
    expectAmount: 10900,
    neverAmounts: [15990, 9800],
  },
  {
    id: '59482965 Sail $ Picanto',
    kind: 'roto',
    contactId: '59482965',
    customerText: '1500 de entrada\nPara unos 36 meses',
    resumen: resumenPrecio(
      'Cliente quiere cuota del Chevrolet Sail y del Kia Picanto.',
    ),
    unit: optra,
    llm: 'El Chevrolet Optra Advance está en {{precio:u1}}.',
    oldMensaje:
      'El precio es $15,990. El precio del Chevrolet Sail es $10,900 y del Kia Picanto $9,800',
    expectAmount: 10900,
    neverAmounts: [15990],
  },
  {
    id: '44666879 D-Max frase El  la',
    kind: 'roto',
    contactId: '44666879b',
    customerText: 'Y la cabina censsilla precio',
    resumen: resumenPrecio(
      'Cliente quiere el precio de la Chevrolet D-Max cabina sencilla.',
    ),
    unit: dmaxCs,
    llm: 'El precio de la Chevrolet D-Max CS 2020 es {{precio:u1}}.',
    oldMensaje:
      'El precio es $28,990. El  la Chevrolet D-Max CRDi 2.5 CS 4x2 TM diesel 2020 color blanco que consultó es.',
    expectAmount: 24500,
    neverAmounts: [28990],
  },
  {
    id: '59841541 Hilux 2023 no cargado real',
    kind: 'roto',
    contactId: '59841541',
    customerText: 'Precio de la Toyota Hilux 2023',
    resumen: resumenPrecio('Cliente quiere el precio de la Toyota Hilux 2023.'),
    unit: hilux2026,
    llm: 'El Hilux disponible es 2026. El precio es {{precio:u1}}.',
    oldMensaje:
      'Buenos días, estimado. No tenemos el Toyota Hilux 2023. El Hilux disponible es 2026, precio aún no cargado.\n\nEl precio de esta unidad aún no está cargado en patio.',
    expectPending: true,
  },
];

const buenos: Caso[] = [
  {
    id: '59822125 Picanto bien',
    kind: 'bien',
    contactId: '59822125',
    customerText: 'Qué precio está por favor',
    resumen: resumenPrecio('Cliente quiere el precio del Kia Picanto 2023.'),
    unit: picanto,
    llm: 'El Kia Picanto 2023 está en {{precio:u1}}.',
    oldMensaje: 'El Kia Picanto 2023 tiene un precio de $15,990.',
    expectAmount: 15990,
  },
  {
    id: '59824013 X-Trail bien',
    kind: 'bien',
    contactId: '59824013',
    customerText: 'El precio por favor, bendiciones',
    resumen: resumenPrecio('Cliente quiere el precio del Nissan X-Trail 2016.'),
    unit: xtrail,
    llm: 'El Nissan X-Trail 2016 está en {{precio:u1}}.',
    oldMensaje: 'Este Nissan X-trail 2016 tiene un precio de $16,890.',
    expectAmount: 16890,
  },
  {
    id: '59824615 Santa Fe bien',
    kind: 'bien',
    contactId: '59824615',
    customerText: 'Hola precio',
    resumen: resumenPrecio('Cliente quiere el precio del Hyundai Santa Fe 2018.'),
    unit: santaFe,
    llm: 'El Hyundai Santa Fe 2018 está en {{precio:u1}}.',
    oldMensaje: 'El Hyundai Santa Fe 2018 está a $22,990.',
    expectAmount: 22990,
  },
  {
    id: '59831723 Terralord bien',
    kind: 'bien',
    contactId: '59831723',
    customerText: 'Si ese mismo',
    resumen: resumenPrecio(
      'Cliente confirma la ZX Auto Terralord y pide el precio.',
    ),
    unit: terralord,
    llm: 'El ZX Auto Terralord 2023 está en {{precio:u1}}.',
    oldMensaje:
      'El ZX Auto Terralord Heavy Duty AC 2.4 CD 2023 color plateado con 64400 km y transmisión manual tiene un precio de $18900.',
    expectAmount: 19900,
  },
  {
    id: '49293427 Ranger 2026 bien',
    kind: 'bien',
    contactId: '49293427',
    customerText: 'hola precio de la Ford Ranger 2026',
    resumen: resumenPrecio(
      'Cliente quiere el precio de la Ford Ranger 2026.',
    ),
    unit: rangerXlt,
    llm: 'El precio de la Ford Ranger XLT 2026 es {{precio:u1}}.',
    oldMensaje:
      'Buenas noches, estimado. El precio de la Ford Ranger XLT AC 2.0 CD 4x4 TA diesel 2026 es $68,800.',
    expectAmount: 68800,
  },
];

describe('precio-marcadores producción', () => {
  const openai = {
    isReady: jest.fn(),
    complete: jest.fn(),
    completeJson: jest.fn(),
    researchSpecs: jest.fn(),
    embed: jest.fn(),
    runSalesAgent: jest.fn(),
  };
  const catalog = {
    fetchAgentPrompts: jest.fn(),
    listAgentPromptNames: jest.fn(),
    searchInventory: jest.fn(),
    searchByQuery: jest.fn(),
    listByBrand: jest.fn(),
    listAvailableExcept: jest.fn(),
    getLexicon: jest.fn(),
  };
  const conversation = {
    recentMessages: jest.fn(),
    appendMessage: jest.fn(),
    loadVehicleKind: jest.fn(),
    saveVehicleKind: jest.fn(),
    loadVehicleBrand: jest.fn(),
    saveVehicleBrand: jest.fn(),
    loadConcreteAsk: jest.fn(),
    saveConcreteAsk: jest.fn(),
    loadGearbox: jest.fn(),
    saveGearbox: jest.fn(),
    clearGearbox: jest.fn(),
    clearVehicleKind: jest.fn(),
    clearConcreteAsk: jest.fn(),
    loadLastSeen: jest.fn(),
    saveLastSeen: jest.fn(),
    loadTomaChecklist: jest.fn(),
    saveTomaChecklist: jest.fn(),
    loadCashBudget: jest.fn(),
    saveCashBudget: jest.fn(),
    loadPreviousResumen: jest.fn(),
    savePreviousResumen: jest.fn(),
    loadUnidadesPresentadas: jest.fn().mockResolvedValue([]),
    recordUnidadesPresentadas: jest.fn().mockResolvedValue([]),
  };
  const persistence = {
    loadHandoffBrief: jest.fn(),
    saveHandoffResumen: jest.fn(),
    appendChatHistory: jest.fn(),
    loadRecentChat: jest.fn(),
    latestInterestedCar: jest.fn(),
    loadLeadCedula: jest.fn(),
    saveLeadCedula: jest.fn(),
    loadVehicleSpecs: jest.fn(),
    saveVehicleSpecs: jest.fn(),
    saveChosenInterestedCar: jest.fn(),
  };
  const service = new AgentService(
    openai as never,
    catalog as never,
    conversation as never,
    persistence as never,
  );

  beforeEach(() => {
    openai.isReady.mockReturnValue(true);
    openai.complete.mockReset();
    openai.completeJson.mockReset();
    openai.completeJson.mockResolvedValue(null);
    openai.researchSpecs.mockReset();
    openai.researchSpecs.mockResolvedValue(null);
    openai.embed.mockReset();
    openai.embed.mockResolvedValue(null);
    openai.runSalesAgent.mockReset();
    catalog.fetchAgentPrompts.mockReset();
    catalog.fetchAgentPrompts.mockResolvedValue([
      { name: 'rol', content: 'sé cordial' },
    ]);
    catalog.listAgentPromptNames.mockReset();
    catalog.listAgentPromptNames.mockResolvedValue([]);
    catalog.searchInventory.mockReset();
    catalog.searchInventory.mockResolvedValue('[]');
    catalog.searchByQuery.mockReset();
    catalog.searchByQuery.mockResolvedValue('[]');
    catalog.listByBrand.mockReset();
    catalog.listByBrand.mockImplementation(async (brand: string) =>
      patio.filter((car) => car.brand === String(brand).toLowerCase()),
    );
    catalog.listAvailableExcept.mockReset();
    catalog.listAvailableExcept.mockResolvedValue(patio);
    catalog.getLexicon.mockReset();
    catalog.getLexicon.mockResolvedValue(TEST_LEXICON);
    conversation.recentMessages.mockReset();
    conversation.appendMessage.mockReset();
    conversation.loadVehicleKind.mockReset();
    conversation.loadVehicleKind.mockResolvedValue(null);
    conversation.saveVehicleKind.mockReset();
    conversation.loadVehicleBrand.mockReset();
    conversation.loadVehicleBrand.mockResolvedValue(null);
    conversation.saveVehicleBrand.mockReset();
    conversation.loadConcreteAsk.mockReset();
    conversation.loadConcreteAsk.mockResolvedValue(null);
    conversation.saveConcreteAsk.mockReset();
    conversation.loadGearbox.mockReset();
    conversation.loadGearbox.mockResolvedValue(null);
    conversation.saveGearbox.mockReset();
    conversation.clearGearbox.mockReset();
    conversation.clearVehicleKind.mockReset();
    conversation.clearConcreteAsk.mockReset();
    conversation.loadLastSeen.mockReset();
    conversation.loadLastSeen.mockResolvedValue(Date.now());
    conversation.saveLastSeen.mockReset();
    conversation.loadTomaChecklist.mockReset();
    conversation.loadTomaChecklist.mockResolvedValue(null);
    conversation.saveTomaChecklist.mockReset();
    conversation.loadCashBudget.mockReset();
    conversation.loadCashBudget.mockResolvedValue(null);
    conversation.saveCashBudget.mockReset();
    conversation.loadPreviousResumen.mockReset();
    conversation.loadPreviousResumen.mockResolvedValue(null);
    conversation.savePreviousResumen.mockReset();
    conversation.loadUnidadesPresentadas.mockReset();
    conversation.loadUnidadesPresentadas.mockResolvedValue([]);
    conversation.recordUnidadesPresentadas.mockReset();
    conversation.recordUnidadesPresentadas.mockResolvedValue([]);
    persistence.loadHandoffBrief.mockReset();
    persistence.loadHandoffBrief.mockResolvedValue(null);
    persistence.saveHandoffResumen.mockReset();
    persistence.appendChatHistory.mockReset();
    persistence.loadRecentChat.mockReset();
    persistence.loadRecentChat.mockResolvedValue([]);
    persistence.latestInterestedCar.mockReset();
    persistence.loadLeadCedula.mockReset();
    persistence.loadLeadCedula.mockResolvedValue(null);
    persistence.saveLeadCedula.mockReset();
    persistence.loadVehicleSpecs.mockReset();
    persistence.loadVehicleSpecs.mockResolvedValue([]);
    persistence.saveVehicleSpecs.mockReset();
    persistence.saveChosenInterestedCar.mockReset();
    persistence.saveChosenInterestedCar.mockResolvedValue(undefined);
  });

  async function runCaso(caso: Caso) {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content: `Estimado, tenemos disponible un ${caso.unit.brand} ${caso.unit.model} ${caso.unit.year}. Aquí tiene las fotos.`,
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue(interestedOf(caso.unit));
    conversation.loadVehicleBrand.mockResolvedValue(caso.unit.brand);
    openai.complete
      .mockResolvedValueOnce(caso.resumen)
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: caso.llm,
        meta: { vehiculo: { inventory_id: caso.unit.id } },
      }),
    );
    return service.handleTurn({
      contactId: caso.contactId,
      customerText: caso.customerText,
    });
  }

  function assertNuevo(caso: Caso, mensaje: string) {
    expect(mensaje).not.toContain('{{');
    expect(mensaje).not.toMatch(/tiene un y|tiene un en |está en  |está a\./i);
    expect(mensaje).not.toMatch(/\$\s*\d[\d.,]*\.\s*\$\s*\d/);
    expect(mensaje).not.toMatch(/El\s+la /);
    if (caso.expectAmount != null) {
      const raw = String(caso.expectAmount);
      expect(mensaje).toMatch(new RegExp(raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',?')));
      expect(mensaje).not.toMatch(/aún no está cargado en patio/i);
    }
    if (caso.expectPending) {
      expect(mensaje).toMatch(new RegExp(FRASE_PRECIO_PENDIENTE, 'i'));
    }
    for (const amount of caso.neverAmounts ?? []) {
      expect(mensaje).not.toMatch(new RegExp(String(amount)));
    }
  }

  it.each(rotos)('$id', async (caso) => {
    const result = await runCaso(caso);
    const mensaje = result?.reply.mensaje ?? '';
    assertNuevo(caso, mensaje);
    expect(caso.oldMensaje.length).toBeGreaterThan(20);
  });

  it.each(buenos)('$id sigue bien', async (caso) => {
    const result = await runCaso(caso);
    const mensaje = result?.reply.mensaje ?? '';
    assertNuevo(caso, mensaje);
  });

  it('los 22 rotos y los 5 buenos están cubiertos', () => {
    expect(rotos).toHaveLength(22);
    expect(buenos).toHaveLength(5);
  });
});
