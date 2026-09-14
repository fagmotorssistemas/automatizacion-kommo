import { MediaService } from './media.service';
import { OpenAiMediaClient } from './openai-media.client';
import * as download from './download-attachment';

describe('MediaService', () => {
  const openai = { transcribe: jest.fn(), analyzeVehicleImage: jest.fn() };
  const service = new MediaService(openai as unknown as OpenAiMediaClient);

  beforeEach(() => {
    openai.transcribe.mockReset();
    openai.analyzeVehicleImage.mockReset();
    jest.spyOn(download, 'downloadAttachment').mockResolvedValue(Buffer.from('x'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('en texto no baja ni llama a OpenAI', async () => {
    await expect(
      service.toCustomerText({
        kind: 'text',
        text: 'Hola',
        attachmentLink: '',
        attachmentFileName: '',
      }),
    ).resolves.toBe('Hola');
    expect(openai.transcribe).not.toHaveBeenCalled();
  });

  it('en voz transcribe el archivo', async () => {
    openai.transcribe.mockResolvedValue('me interesa una hilux');

    await expect(
      service.toCustomerText({
        kind: 'voice',
        text: '',
        attachmentLink: 'https://example.com/file.ogg',
        attachmentFileName: 'file.ogg',
      }),
    ).resolves.toBe('me interesa una hilux');
    expect(openai.transcribe).toHaveBeenCalled();
    expect(openai.analyzeVehicleImage).not.toHaveBeenCalled();
  });

  it('en foto analiza la imagen y no transcribe', async () => {
    openai.analyzeVehicleImage.mockResolvedValue('{"marca":"toyota"}');

    await expect(
      service.toCustomerText({
        kind: 'picture',
        text: 'qué me ofrece por este',
        attachmentLink: 'https://example.com/foto.jpg',
        attachmentFileName: 'foto.jpg',
      }),
    ).resolves.toBe('{"marca":"toyota"}');
    expect(openai.analyzeVehicleImage).toHaveBeenCalledWith(
      Buffer.from('x'),
      'qué me ofrece por este',
    );
    expect(openai.transcribe).not.toHaveBeenCalled();
  });

  it('si no baja el adjunto, devuelve el texto original', async () => {
    jest.spyOn(download, 'downloadAttachment').mockResolvedValue(null);

    await expect(
      service.toCustomerText({
        kind: 'voice',
        text: '',
        attachmentLink: 'https://example.com/file.ogg',
        attachmentFileName: 'file.ogg',
      }),
    ).resolves.toBe('');
    expect(openai.transcribe).not.toHaveBeenCalled();
  });
});
