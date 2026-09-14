import { routeByOrigin } from './inbox.routing';

describe('routeByOrigin', () => {
  it('marca waba si el origin es waba', () => {
    expect(routeByOrigin('waba')).toBe('waba');
  });

  it('marca other si no es WhatsApp Cloud', () => {
    expect(routeByOrigin('instagram')).toBe('other');
    expect(routeByOrigin('')).toBe('other');
  });
});
