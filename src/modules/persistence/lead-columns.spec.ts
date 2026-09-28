import {
  isMissingLeadIdentityColumn,
  LEAD_COLUMNS,
  omitLeadIdentityFields,
} from './lead-columns';

describe('lead-columns', () => {
  it('incluye nombre_cedula y origen', () => {
    expect(LEAD_COLUMNS).toContain('nombre_cedula');
    expect(LEAD_COLUMNS).toContain('origen');
  });
    expect(
      isMissingLeadIdentityColumn(
        'column leads.nombre_cedula does not exist',
      ),
    ).toBe(true);
    expect(
      isMissingLeadIdentityColumn('column leads.origen does not exist'),
    ).toBe(true);
    expect(isMissingLeadIdentityColumn('duplicate key')).toBe(false);
  });

  it('saca nombre_cedula y origen y deja el resto', () => {
    expect(
      omitLeadIdentityFields({
        cedula: '0102030405',
        nombre_cedula: 'JUAN PEREZ',
        origen: 'QUITO',
        status: 'asesoria_financiamiento',
      }),
    ).toEqual({
      cedula: '0102030405',
      status: 'asesoria_financiamiento',
    });
  });
});
