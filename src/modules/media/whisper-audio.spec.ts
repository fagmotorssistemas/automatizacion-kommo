import { looksLikeAudio, whisperFileName } from './whisper-audio';

describe('whisper-audio', () => {
  it('rechaza HTML o JSON', () => {
    expect(looksLikeAudio(Buffer.from('<html>no'))).toBe(false);
    expect(looksLikeAudio(Buffer.from('{"error":1}'))).toBe(false);
  });

  it('acepta un buffer con cabecera Ogg', () => {
    const ogg = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(looksLikeAudio(ogg)).toBe(true);
    expect(whisperFileName('file', '', ogg)).toBe('audio.ogg');
  });

  it('usa la extensión del link de Kommo', () => {
    expect(
      whisperFileName(
        'file',
        'https://amojo.kommo.com/x/file.ogg',
        Buffer.from('xxxxxxxxxx'),
      ),
    ).toBe('audio.ogg');
  });
});
