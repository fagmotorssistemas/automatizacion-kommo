import { parseImgPrefixes } from './parse-img-prefixes';

describe('parseImgPrefixes', () => {
  it('acepta un string', () => {
    expect(parseImgPrefixes(' hilux_2022 ')).toEqual(['hilux_2022']);
  });

  it('acepta array y recorta a 4', () => {
    expect(
      parseImgPrefixes(['a', 'b', '', 'c', 'd', 'e']),
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('vacío queda sin fotos', () => {
    expect(parseImgPrefixes('')).toEqual([]);
    expect(parseImgPrefixes(null)).toEqual([]);
  });
});
