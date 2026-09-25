import {
  askWhichCarMessage,
  formatGreetingPedido,
  greetingForHour,
  shouldOfferGreeting,
} from './day-greeting';

describe('day-greeting', () => {
  it('usa la hora de Cuenca: no dice noches de día', () => {
    expect(greetingForHour(0)).toBe('Buenos días');
    expect(greetingForHour(3)).toBe('Buenos días');
    expect(greetingForHour(8)).toBe('Buenos días');
    expect(greetingForHour(11)).toBe('Buenos días');
    expect(greetingForHour(12)).toBe('Buenas tardes');
    expect(greetingForHour(18)).toBe('Buenas tardes');
    expect(greetingForHour(19)).toBe('Buenas noches');
    expect(greetingForHour(23)).toBe('Buenas noches');
  });

  it('saluda solo la primera vez o al volver después de días', () => {
    expect(
      shouldOfferGreeting({ lastSeenAt: null, hasHistory: false }),
    ).toBe(true);
    expect(
      shouldOfferGreeting({ lastSeenAt: null, hasHistory: true }),
    ).toBe(false);
    expect(
      shouldOfferGreeting({
        lastSeenAt: Date.parse('2026-09-23T11:00:00-05:00'),
        hasHistory: true,
        now: Date.parse('2026-09-23T16:00:00-05:00'),
      }),
    ).toBe(false);
    expect(
      shouldOfferGreeting({
        lastSeenAt: Date.parse('2026-09-20T11:00:00-05:00'),
        hasHistory: true,
        now: Date.parse('2026-09-23T11:00:00-05:00'),
      }),
    ).toBe(true);
  });

  it('arma el opener con respeto', () => {
    expect(askWhichCarMessage(true, 11)).toBe(
      'Buenos días, estimado. ¿Qué carro le interesa?',
    );
    expect(askWhichCarMessage(true, 20)).toBe(
      'Buenas noches, estimado. ¿Qué carro le interesa?',
    );
    expect(askWhichCarMessage(false, 11)).toBe(
      'Con gusto. ¿Qué carro le interesa?',
    );
    expect(formatGreetingPedido(true, 11)).toMatch(/Buenos días, estimado/);
    expect(formatGreetingPedido(false, 20)).toMatch(/SALUDO: no/);
    expect(formatGreetingPedido(false, 20)).not.toMatch(/Buenas noches/);
  });
});
