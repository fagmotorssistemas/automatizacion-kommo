import { MediaService } from './media.service';
import { OpenAiMediaClient } from './openai-media.client';
import * as download from './download-attachment';

describe('MediaService', () => {
  const openai = {
    transcribe: jest.fn(),
    analyzeVehicleImage: jest.fn(),
    classifyInboundImage: jest.fn(),
    readCedulaImage: jest.fn(),
  };
  const service = new MediaService(openai as unknown as OpenAiMediaClient);

  beforeEach(() => {
    openai.transcribe.mockReset();
    openai.analyzeVehicleImage.mockReset();
    openai.classifyInboundImage.mockReset();
    openai.classifyInboundImage.mockResolvedValue('vehiculo');
    openai.readCedulaImage.mockReset();
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
    expect(openai.readCedulaImage).not.toHaveBeenCalled();
  });

  it('una foto de cédula no pasa por el análisis del carro', async () => {
    openai.classifyInboundImage.mockResolvedValue('cedula');
    openai.readCedulaImage.mockResolvedValue(
      '{"numero":"1712345678","nombre":"JUAN PEREZ","origen":"QUITO"}',
    );

    await expect(
      service.toCustomerText({
        kind: 'picture',
        text: '',
        attachmentLink: 'https://example.com/cedula.jpg',
        attachmentFileName: 'cedula.jpg',
      }),
    ).resolves.toBe(
      'Envió foto de su cédula.\nNúmero: 1712345678\nNombre: JUAN PEREZ\nOrigen: QUITO',
    );
    expect(openai.analyzeVehicleImage).not.toHaveBeenCalled();
    expect(openai.readCedulaImage).toHaveBeenCalled();
  });

  it('si la clasificación falla, la foto sigue como vehículo', async () => {
    openai.classifyInboundImage.mockRejectedValue(new Error('timeout'));
    openai.analyzeVehicleImage.mockResolvedValue('{"marca":"toyota"}');

    await expect(
      service.toCustomerText({
        kind: 'picture',
        text: 'mira',
        attachmentLink: 'https://example.com/foto.jpg',
        attachmentFileName: 'foto.jpg',
      }),
    ).resolves.toBe('{"marca":"toyota"}');
    expect(openai.readCedulaImage).not.toHaveBeenCalled();
    expect(openai.analyzeVehicleImage).toHaveBeenCalled();
  });

  it('una cédula ilegible no se manda al análisis del carro', async () => {
    openai.classifyInboundImage.mockResolvedValue('cedula');
    openai.readCedulaImage.mockResolvedValue('{"numero":null,"nombre":"JUAN"}');

    await expect(
      service.toCustomerText({
        kind: 'picture',
        text: '',
        attachmentLink: 'https://example.com/cedula.jpg',
        attachmentFileName: 'cedula.jpg',
      }),
    ).resolves.toBe('Envió foto de su cédula. No se pudo leer el número.');
    expect(openai.analyzeVehicleImage).not.toHaveBeenCalled();
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
