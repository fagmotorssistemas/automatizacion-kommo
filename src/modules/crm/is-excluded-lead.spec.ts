import { isExcludedLead } from './is-excluded-lead';

describe('isExcludedLead', () => {
  it('excluye el lead hardcodeado de n8n', () => {
    expect(isExcludedLead('30296877')).toBe(true);
  });

  it('deja pasar cualquier otro', () => {
    expect(isExcludedLead('41938171')).toBe(false);
  });
});
