import { isUuid } from './is-uuid';

describe('isUuid', () => {
  it('acepta un uuid real', () => {
    expect(isUuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
  });

  it('rechaza slugs del LLM', () => {
    expect(isUuid('sentra')).toBe(false);
    expect(isUuid('exp-1')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});
