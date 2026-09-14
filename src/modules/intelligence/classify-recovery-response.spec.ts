import {
  classifyRecoveryResponse,
  latestRecoveryStep,
  planRecoveryWrite,
} from './classify-recovery-response';

describe('classifyRecoveryResponse', () => {
  it('vacío es no_hubo_respuesta', () => {
    expect(classifyRecoveryResponse(' ')).toMatchObject({
      value: 'no_hubo_respuesta',
      stop: false,
    });
  });

  it('detecta no_molesten y stop', () => {
    expect(classifyRecoveryResponse('No me escribas más')).toMatchObject({
      value: 'no_molesten',
      stop: true,
    });
  });

  it('detecta ya_compro', () => {
    expect(classifyRecoveryResponse('Ya compré en otro lado')).toMatchObject({
      value: 'ya_compro',
      stop: true,
    });
  });

  it('pospone como continua_conversacion', () => {
    expect(classifyRecoveryResponse('Mañana te llamo')).toMatchObject({
      value: 'continua_conversacion',
      matched: ['pospone_luego'],
    });
  });

  it('no_le_interesa', () => {
    expect(classifyRecoveryResponse('No gracias')).toMatchObject({
      value: 'no_le_interesa',
    });
  });
});

describe('planRecoveryWrite', () => {
  it('sin 2d/7d/15d/30d no escribe', () => {
    expect(planRecoveryWrite({ mensajesEnviados: [], message: 'ok' })).toBeNull();
  });

  it('toma el último paso, también 7d (n8n solo cableó 2d y 30d)', () => {
    const write = planRecoveryWrite({
      mensajesEnviados: ['2d', '7d'],
      message: 'ok',
    });
    expect(write?.step).toBe('7d');
    expect(latestRecoveryStep(['2d', '30d'])).toBe('30d');
  });
});
