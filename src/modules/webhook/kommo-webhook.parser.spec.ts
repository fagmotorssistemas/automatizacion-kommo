import { describe, expect, it } from '@jest/globals';
import { kommoWabaPictureBody } from './fixtures/kommo-waba-picture.body';
import { kommoWabaTextBody } from './fixtures/kommo-waba-text.body';
import { kommoWabaVoiceBody } from './fixtures/kommo-waba-voice.body';
import { extractKommoMessageCandidate } from './kommo-webhook.parser';

describe('extractKommoMessageCandidate', () => {
  it('lee el payload real de Kommo (claves planas)', () => {
    expect(extractKommoMessageCandidate(kommoWabaTextBody)).toEqual({
      messageId: 'ae7243c7-e973-4aa5-ad43-ae3a95d74233',
      leadId: '41807269',
      chatId: '059977cf-fd0f-45c2-a43e-1523bb8a314a',
      talkId: '71302',
      contactId: '59458509',
      text: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
      createdAt: '1789340833',
      messageType: 'text',
      direction: 'incoming',
      entityType: 'lead',
      authorId: 'd306c506-7819-4704-a0e1-996af2195d32',
      authorType: 'external',
      authorName: 'Rosa Gonzalez',
      origin: 'waba',
      attachmentType: undefined,
      attachmentLink: undefined,
      attachmentFileName: undefined,
    });
  });

  it('lee el payload real de nota de voz', () => {
    expect(extractKommoMessageCandidate(kommoWabaVoiceBody)).toEqual({
      messageId: 'ff41b03f-510e-4349-aefb-a53a8a8dfef6',
      leadId: '41423821',
      chatId: '605555d7-5091-49f3-b018-31ad0ccf72c5',
      talkId: '66363',
      contactId: '57444397',
      text: '',
      createdAt: '1789341666',
      messageType: 'voice',
      direction: 'incoming',
      entityType: 'lead',
      authorId: '43d5eb2d-cd5a-4091-8b86-ed83ba8a271f',
      authorType: 'external',
      authorName: 'prueba2',
      origin: 'waba',
      attachmentType: 'voice',
      attachmentLink:
        'https://amojo.kommo.com/v2/1fd0768e-b507-41c2-997d-e87466587813/attachments/dd39a094-601c-4b10-9ee9-d5e5a19757ff/file.ogg',
      attachmentFileName: 'file.ogg',
    });
  });

  it('lee el payload real de foto', () => {
    expect(extractKommoMessageCandidate(kommoWabaPictureBody)).toEqual({
      messageId: 'DUMP-SIN-ID',
      leadId: '41423821',
      chatId: '605555d7-5091-49f3-b018-31ad0ccf72c5',
      talkId: '66363',
      contactId: '57444397',
      text: '',
      createdAt: '1789344316',
      messageType: 'picture',
      direction: 'incoming',
      entityType: 'lead',
      authorId: '43d5eb2d-cd5a-4091-8b86-ed83ba8a271f',
      authorType: 'external',
      authorName: 'prueba2',
      origin: 'waba',
      attachmentType: 'picture',
      attachmentLink:
        'https://amojo.kommo.com/v2/1fd0768e-b507-41c2-997d-e87466587813/attachments/7bcb6a07-bd92-48d2-ae6d-42a26fd85b58/file.jpeg',
      attachmentFileName: 'file.jpeg',
    });
  });

  it('lee el body anidado que arma Express con qs', () => {
    const body = {
      message: {
        add: [
          {
            id: 88,
            entity_id: 30290002,
            contact_id: 9002,
            text: '',
            type: 'incoming',
            origin: 'waba',
            author: { type: 'external', name: 'Ana' },
            attachment: {
              type: 'picture',
              link: 'https://example.com/foto.jpg',
            },
          },
        ],
      },
    };

    expect(extractKommoMessageCandidate(body)).toMatchObject({
      messageId: '88',
      leadId: '30290002',
      contactId: '9002',
      direction: 'incoming',
      authorType: 'external',
      attachmentType: 'picture',
      attachmentLink: 'https://example.com/foto.jpg',
    });
  });

  it('usa element_id si no viene entity_id', () => {
    expect(
      extractKommoMessageCandidate({
        'message[add][0][id]': 'msg-1',
        'message[add][0][element_id]': '41807269',
      }),
    ).toMatchObject({
      leadId: '41807269',
    });
  });

  it('ignora un evento que no es message add', () => {
    expect(
      extractKommoMessageCandidate({
        leads: { status: [{ id: 1 }] },
      }),
    ).toBeNull();
  });
});
