import {
  isLatestMessage,
  itemsForContact,
  joinBufferedTexts,
  parseBufferedItems,
  serializeBufferedMessage,
} from './debounce.buffer';

describe('debounce.buffer', () => {
  it('serializa y parsea el item de la lista', () => {
    const raw = serializeBufferedMessage({
      contactId: 'c1',
      messageId: 'a',
      text: 'hola',
    });

    expect(parseBufferedItems([raw])).toEqual([
      { contactId: 'c1', messageId: 'a', text: 'hola' },
    ]);
  });

  it('el último gana por messageId, no por texto', () => {
    const items = [
      { contactId: 'c1', messageId: '1', text: 'hola' },
      { contactId: 'c1', messageId: '2', text: 'hola' },
    ];

    expect(isLatestMessage(items, '1')).toBe(false);
    expect(isLatestMessage(items, '2')).toBe(true);
  });

  it('sin items, nadie gana', () => {
    expect(isLatestMessage([], '1')).toBe(false);
  });

  it('junta los textos como n8n Edit Fields4', () => {
    expect(
      joinBufferedTexts([
        { contactId: 'c1', messageId: '1', text: 'hola' },
        { contactId: 'c1', messageId: '2', text: 'hilux' },
      ]),
    ).toBe('hola\nhilux');
  });

  it('no mezcla items de otro contacto', () => {
    expect(
      itemsForContact(
        [
          { contactId: 'c1', messageId: '1', text: 'rosa' },
          { contactId: 'c2', messageId: '2', text: 'otro' },
        ],
        'c1',
      ),
    ).toEqual([{ contactId: 'c1', messageId: '1', text: 'rosa' }]);
  });
});
