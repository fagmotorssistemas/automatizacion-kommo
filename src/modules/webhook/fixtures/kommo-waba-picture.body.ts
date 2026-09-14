/**
 * Payload real de Kommo: foto.
 * El dump llegó cortado: no traía id ni account.
 * account se copia del mismo chat (prueba2). Si tienes el UUID del mensaje, reemplázalo.
 */
export const kommoWabaPictureBody = {
  'account[subdomain]': 'marketingfagmotorsurfacom',
  'account[id]': '35199648',
  'account[_links][self]': 'https://marketingfagmotorsurfacom.amocrm.com',
  'message[add][0][id]': 'DUMP-SIN-ID',
  'message[add][0][chat_id]': '605555d7-5091-49f3-b018-31ad0ccf72c5',
  'message[add][0][talk_id]': '66363',
  'message[add][0][contact_id]': '57444397',
  'message[add][0][text]': '',
  'message[add][0][created_at]': '1789344316',
  'message[add][0][message_type]': 'picture',
  'message[add][0][attachment][type]': 'picture',
  'message[add][0][attachment][link]':
    'https://amojo.kommo.com/v2/1fd0768e-b507-41c2-997d-e87466587813/attachments/7bcb6a07-bd92-48d2-ae6d-42a26fd85b58/file.jpeg',
  'message[add][0][attachment][file_name]': 'file.jpeg',
  'message[add][0][element_type]': '2',
  'message[add][0][entity_type]': 'lead',
  'message[add][0][element_id]': '41423821',
  'message[add][0][entity_id]': '41423821',
  'message[add][0][type]': 'incoming',
  'message[add][0][author][id]': '43d5eb2d-cd5a-4091-8b86-ed83ba8a271f',
  'message[add][0][author][type]': 'external',
  'message[add][0][author][name]': 'prueba2',
  'message[add][0][origin]': 'waba',
} as const;
