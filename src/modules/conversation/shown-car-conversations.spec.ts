import {
  followsShownCar,
  leftShownCar,
  type ShownCarContext,
} from './interested-car';
import { TEST_LEXICON } from './test-lexicon';
import { buildLexicon } from './fuzzy-vehicle-name';

const c300 = {
  inventoryId: 'c300-1',
  brand: 'mercedes-benz',
  model: 'c 300 amg line ac 2.0 4p 4x2 automatico',
  year: 2024,
  price: 61990,
  color: 'blanco',
  typeBody: 'sedan',
  transmission: 'automática',
};

const sportage = {
  inventoryId: 'plata-1',
  brand: 'kia',
  model: 'sportage r gti 2019 ta',
  year: 2019,
  price: 22900,
  color: 'plateado',
  typeBody: 'jeep',
  transmission: 'automática',
};

const mercedesLexicon = buildLexicon([
  { brand: 'mercedes-benz', model: c300.model },
]);

const fichaC300 = [
  {
    role: 'assistant' as const,
    content:
      'Estimado, el Mercedes Benz C 300 AMG Line AC 2.0 4p 4x2 automático 2024 blanco, con 25842 km, está en excelente estado. Su $61,990.',
  },
];

const fichaSportage = [
  {
    role: 'assistant' as const,
    content:
      'Estimado, tenemos disponible un Kia Sportage R GTI 2019 plateado, con 64000 km.',
  },
];

const conversations: {
  id: number;
  name: string;
  stay: boolean;
  input: ShownCarContext;
}[] = [
  {
    id: 1,
    name: 'C 300: audio “todavía lo tienen” + pedido largo del resumen',
    stay: true,
    input: {
      text: 'todavía lo tienen?',
      pedido: 'Mercedes C 300 AMG Line 2024',
      resumen:
        'SOLICITUD ACTUAL:\nCliente pregunta si todavía tienen el Mercedes C 300 AMG Line 2024.\nPide otras: no',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 2,
    name: 'C 300: nombra otra vez el mismo 2024',
    stay: true,
    input: {
      text: 'tienen el mercedes c 300 2024?',
      pedido: 'Mercedes Benz C 300 AMG Line 2024',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 3,
    name: 'C 300: solo “ok” después de la ficha',
    stay: true,
    input: { text: 'ok', history: fichaC300, car: c300, lexicon: mercedesLexicon },
  },
  {
    id: 4,
    name: 'C 300: pide el precio de esa',
    stay: true,
    input: {
      text: 'y el precio?',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 5,
    name: 'C 300: dónde verla',
    stay: true,
    input: {
      text: 'dónde queda para ir a verla?',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 6,
    name: 'C 300: crédito / si califica',
    stay: true,
    input: {
      text: 'me ayudan a ver si califico al crédito?',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 7,
    name: 'C 300: visita mañana',
    stay: true,
    input: {
      text: 'puedo ir mañana?',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 8,
    name: 'C 300: “me interesa ese”',
    stay: true,
    input: {
      text: 'me interesa ese',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 9,
    name: 'C 300: pregunta de ficha (cámara / estado)',
    stay: true,
    input: {
      text: 'está en buen estado? tiene cámara?',
      resumen:
        'SOLICITUD ACTUAL:\nCliente pregunta estado y cámara del C 300.\nPide otras: no',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 10,
    name: 'C 300: pedido con marca + AMG + año + color de la misma',
    stay: true,
    input: {
      text: 'sí, esa blanca',
      pedido: 'Mercedes Benz C 300 AMG Line 2024 blanco',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 11,
    name: 'Sportage: “ok gracias” sigue en esa',
    stay: true,
    input: {
      text: 'ok gracias',
      history: fichaSportage,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 12,
    name: 'Sportage: precio de este automático',
    stay: true,
    input: {
      text: 'Cual es el precio d este automático',
      history: fichaSportage,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 13,
    name: 'C 300 2025: otro año, se suelta',
    stay: false,
    input: {
      text: 'y el c 300 2025?',
      pedido: 'Mercedes C 300 2025',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 14,
    name: 'C 300 → Hilux: otro modelo',
    stay: false,
    input: {
      text: 'mejor una Hilux',
      history: fichaC300,
      car: c300,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 15,
    name: 'Sportage → Tucson: otra marca/modelo',
    stay: false,
    input: {
      text: 'tienen tucson?',
      history: fichaSportage,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 16,
    name: 'C 300: otro color (rojo)',
    stay: false,
    input: {
      text: 'lo tienen en rojo?',
      resumen: 'SOLICITUD ACTUAL:\nCliente pide otro color.\nOtro color: sí',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 17,
    name: 'C 300: pide manual (la mostrada es automática)',
    stay: false,
    input: {
      text: 'y en manual?',
      history: fichaC300,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 18,
    name: 'Sportage: pide otras',
    stay: false,
    input: {
      text: 'q otras tienen porfabor',
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere otras similares.\nPide otras: sí',
      history: fichaSportage,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 19,
    name: 'Sportage: presupuesto más bajo que el $',
    stay: false,
    input: {
      text: 'Dispongo de 10.000$',
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere ver qué cabe en 10000.\nTope de contado: 10000',
      history: fichaSportage,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 20,
    name: 'Sportage → Seltos: otra línea Kia',
    stay: false,
    input: {
      text: 'y el seltos?',
      history: fichaSportage,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
];

describe('20 conversaciones sobre la unidad ya mostrada', () => {
  it.each(conversations)('$id. $name', ({ stay, input }) => {
    expect(followsShownCar(input)).toBe(stay);
    expect(leftShownCar(input)).toBe(!stay);
  });
});
