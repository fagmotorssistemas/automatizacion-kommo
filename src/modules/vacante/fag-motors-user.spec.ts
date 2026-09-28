import { fagMotorsUserId } from './fag-motors-user';

describe('fagMotorsUserId', () => {
  it('elige el usuario FAG Motors', () => {
    expect(
      fagMotorsUserId([
        { id: 1, name: 'Vanessa' },
        { id: 42, name: 'FAG Motors' },
      ]),
    ).toBe(42);
  });

  it('acepta FAGMOTORS sin espacio', () => {
    expect(fagMotorsUserId([{ id: 7, name: 'FAGMOTORS' }])).toBe(7);
  });

  it('no adivina si no está o si hay dos', () => {
    expect(fagMotorsUserId([{ id: 1, name: 'Vanessa' }])).toBeNull();
    expect(
      fagMotorsUserId([
        { id: 1, name: 'FAG Motors' },
        { id: 2, name: 'Fag Motors' },
      ]),
    ).toBeNull();
  });
});
