import { readLeadTags, vacanteLeadBody } from './vacante-lead-body';

describe('vacanteLeadBody', () => {
  it('conserva las etiquetas y suma la de vacante y el responsable', () => {
    const raw = {
      _embedded: {
        tags: [
          { id: 10, name: 'waba' },
          { id: 11, name: 'vacante_asesor_comercial' },
        ],
      },
    };

    expect(readLeadTags(raw)).toEqual([
      { id: 10, name: 'waba' },
      { id: 11, name: 'vacante_asesor_comercial' },
    ]);
    expect(
      vacanteLeadBody({
        leadId: 99,
        tagName: 'vacante_asesor_comercial',
        responsibleUserId: 42,
        tags: readLeadTags(raw),
      }),
    ).toEqual({
      id: 99,
      responsible_user_id: 42,
      _embedded: { tags: [{ id: 10 }, { id: 11 }] },
    });
  });

  it('si el GET no trajo tags no las manda, para no borrarlas', () => {
    expect(readLeadTags({ id: 1 })).toBeNull();
    expect(
      vacanteLeadBody({
        leadId: 99,
        tagName: 'vacante_asesor_comercial',
        responsibleUserId: 42,
        tags: null,
      }),
    ).toEqual({ id: 99, responsible_user_id: 42 });
  });
});
