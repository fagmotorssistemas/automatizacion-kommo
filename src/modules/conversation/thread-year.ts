import { modelFamily } from '../catalog/clasificar-filas';
import { asksYearOnward } from './concrete-ask';
import {
  detectNamedModelAsk,
  detectYearInText,
  detectYearSpan,
  isDriveFamily,
  type VehicleLexicon,
} from './vehicle-brand';

export type ThreadYear = {
  year: number | null;
  onward: boolean;
  span: { min: number; max: number } | null;
};

type Constraint = {
  year: number | null;
  family: string | null;
  /** Filtro de búsqueda (año suelto, en adelante, rango). Sigue al cambiar de modelo. */
  standalone: boolean;
  onward: boolean;
  span: { min: number; max: number } | null;
};

function familyInText(text: string, lexicon: VehicleLexicon): string | null {
  const named = detectNamedModelAsk(text, lexicon);
  if (!named || isDriveFamily(named.family)) {
    return null;
  }
  return modelFamily(named.family) || named.family;
}

function yearInText(text: string, lexicon: VehicleLexicon): number | null {
  const named = detectNamedModelAsk(text, lexicon);
  if (named) {
    return named.year;
  }
  return detectYearInText(text);
}

function applyTurn(
  state: Constraint,
  turn: {
    family: string | null;
    year: number | null;
    onward: boolean;
    span: { min: number; max: number } | null;
  },
): Constraint {
  const { family, year, onward, span } = turn;

  if (span && !family) {
    return {
      year: null,
      family: null,
      standalone: true,
      onward: false,
      span,
    };
  }

  if (span && family) {
    return {
      year: null,
      family,
      standalone: false,
      onward: false,
      span,
    };
  }

  if (year != null && family) {
    return {
      year,
      family,
      standalone: onward,
      onward,
      span: onward ? null : span,
    };
  }

  if (year != null && !family) {
    return {
      year,
      family: null,
      standalone: true,
      onward,
      span: null,
    };
  }

  if (family && year == null) {
    const boundToOther =
      state.year != null &&
      !state.standalone &&
      Boolean(state.family) &&
      state.family !== family;
    const boundSpanToOther =
      state.span != null &&
      !state.standalone &&
      Boolean(state.family) &&
      state.family !== family;
    if (boundToOther || boundSpanToOther) {
      return {
        year: null,
        family,
        standalone: false,
        onward: false,
        span: null,
      };
    }
    return {
      year: state.year,
      family,
      standalone: state.standalone,
      onward: state.onward,
      span: state.span,
    };
  }

  return state;
}

/** Año del hilo: de esta unidad, o filtro que sigue. No pega el año de otro carro. */
export function resolveThreadYear(input: {
  priorUserTexts: string[];
  currentText: string;
  lexicon: VehicleLexicon;
  yearSaidNow: number | null;
}): ThreadYear {
  let state: Constraint = {
    year: null,
    family: null,
    standalone: false,
    onward: false,
    span: null,
  };

  for (const text of input.priorUserTexts) {
    const family = familyInText(text, input.lexicon);
    state = applyTurn(state, {
      family,
      year: yearInText(text, input.lexicon),
      onward: asksYearOnward(text),
      span: detectYearSpan(text),
    });
  }

  const currentFamily = familyInText(input.currentText, input.lexicon);
  state = applyTurn(state, {
    family: currentFamily,
    year: input.yearSaidNow,
    onward: asksYearOnward(input.currentText),
    span: detectYearSpan(input.currentText),
  });

  return {
    year: state.year,
    onward: state.onward,
    span: state.span,
  };
}
