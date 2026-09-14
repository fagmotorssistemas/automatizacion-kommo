import { classifyMessageKind } from './classify-message-kind';

describe('classifyMessageKind', () => {
  it('marca voice si el adjunto es voice', () => {
    expect(
      classifyMessageKind({ attachmentType: 'voice', messageType: 'voice' }),
    ).toBe('voice');
  });

  it('marca picture si el adjunto es picture', () => {
    expect(
      classifyMessageKind({
        attachmentType: 'picture',
        messageType: 'picture',
      }),
    ).toBe('picture');
  });

  it('marca text si no hay adjunto', () => {
    expect(
      classifyMessageKind({ attachmentType: '', messageType: 'text' }),
    ).toBe('text');
  });
});
