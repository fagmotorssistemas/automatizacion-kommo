import { buildLexicon, type VehicleLexicon } from './fuzzy-vehicle-name';

/** Solo tests: filas tipo patio, no es la lista de producción. */
export const TEST_LEXICON: VehicleLexicon = buildLexicon([
  { brand: 'chevrolet', model: 'grand vitara 3p tm ac sport' },
  { brand: 'chevrolet', model: 'd-max crdi 2.5 cd 4x4 tm diesel' },
  { brand: 'chevrolet', model: 'aveo ls ac 1.6' },
  { brand: 'chevrolet', model: 'optra advance 1.8l' },
  { brand: 'suzuki', model: 'grand vitara sz ac 2.0' },
  { brand: 'jetour', model: 'x70 ii ac 1.5' },
  { brand: 'kia', model: 'sportage r gti' },
  { brand: 'kia', model: 'seltos ex' },
  { brand: 'kia', model: 'rio lx' },
  { brand: 'toyota', model: 'hilux 2.4 cd' },
  { brand: 'toyota', model: 'prado txl' },
  { brand: 'nissan', model: 'x-trail sense' },
  { brand: 'nissan', model: 'sentra exclusive' },
  { brand: 'hyundai', model: 'tucson gl' },
  { brand: 'hyundai', model: 'kona gl' },
  { brand: 'ford', model: 'explorer xlt' },
  { brand: 'ford', model: 'f-150' },
  { brand: 'volkswagen', model: 't-cross' },
  { brand: 'great wall', model: 'poer 2.0' },
  { brand: 'peugeot', model: '2008 fin' },
  { brand: 'peugeot', model: '3008n' },
]);
