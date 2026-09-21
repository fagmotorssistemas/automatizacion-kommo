import {
  DEFAULT_ASSIGNEE,
  assigneeForKommoUser,
  extractResponsibleUserId,
} from './seller-map';

describe('seller-map', () => {
  it('mapea a Vanessa', () => {
    expect(assigneeForKommoUser(13895303)).toBe(
      '16a2bf26-6cba-4aa6-8ede-6c0a87a5443c',
    );
  });

  it('usa el default si Kommo no manda responsable', () => {
    expect(assigneeForKommoUser(null)).toBe(DEFAULT_ASSIGNEE);
    expect(extractResponsibleUserId({ id: 1 })).toBeNull();
  });

  it('lee responsible_user_id del lead', () => {
    expect(extractResponsibleUserId({ responsible_user_id: 15528168 })).toBe(
      15528168,
    );
  });
});
