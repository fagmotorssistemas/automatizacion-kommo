import { objecionParaGuardar } from './objecion';

describe('objecionParaGuardar', () => {
  it('deja null si no objetó', () => {
    expect(objecionParaGuardar(null, 5, '')).toEqual({
      objecion: null,
      texto: '',
    });
  });

  it('precio en etapa 2 cae a otro para revisar', () => {
    expect(objecionParaGuardar('precio', 2, 'Está caro')).toEqual({
      objecion: 'otro',
      texto: '[revisar:precio] Está caro',
    });
  });

  it('modelo en etapa 2 se queda', () => {
    expect(objecionParaGuardar('modelo', 2, 'Quería una Swift')).toEqual({
      objecion: 'modelo',
      texto: 'Quería una Swift',
    });
  });

  it('retoma sin haber hablado de plata cae a otro', () => {
    expect(objecionParaGuardar('retoma', 2, 'Tiene un Spark')).toEqual({
      objecion: 'otro',
      texto: '[revisar:retoma] Tiene un Spark',
    });
  });

  it('si agendó, sin_cierre no se guarda', () => {
    expect(objecionParaGuardar('sin_cierre', 5, 'Nadie lo siguió', true)).toEqual({
      objecion: null,
      texto: '',
    });
  });

  it('si ya escribió, sin_conversacion pasa a no_responde', () => {
    expect(objecionParaGuardar('sin_conversacion', 2, 'Solo la plantilla')).toEqual({
      objecion: 'no_responde',
      texto: 'Solo la plantilla',
    });
  });
});
