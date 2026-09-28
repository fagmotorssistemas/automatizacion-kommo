import {
  HORARIO_REAL,
  replyInventsHoliday,
  stripInventedHoliday,
} from './strip-invented-holiday';

const FERIADO =
  'Le confirmo que por ser lunes y hasta el martes estamos en feriado, por lo que atenderemos desde el miércoles en adelante; con gusto le esperamos en la concesionaria en Av. España 6-73 y Sevilla, Cuenca.';

describe('stripInventedHoliday', () => {
  it('detecta feriado, puente, asueto y festivo', () => {
    expect(replyInventsHoliday(FERIADO)).toBe(true);
    expect(replyInventsHoliday('Hay puente el lunes y el martes.')).toBe(true);
    expect(replyInventsHoliday('Mañana es asueto.')).toBe(true);
    expect(replyInventsHoliday('El lunes es día festivo.')).toBe(true);
    expect(
      replyInventsHoliday('El lunes atendemos de 08:30 a 18:00.'),
    ).toBe(false);
  });

  it('borra el feriado inventado y deja el horario real y la dirección', () => {
    const out = stripInventedHoliday(FERIADO);
    expect(out).toMatch(/lunes a viernes de 08:30 a 18:00/);
    expect(out).toMatch(/Av\. España/i);
    expect(out).not.toMatch(/feriad/i);
    expect(out).not.toMatch(/miércoles/i);
    expect(out.startsWith(HORARIO_REAL)).toBe(true);
  });

  it('si todo el mensaje era el feriado, queda solo el horario', () => {
    expect(
      stripInventedHoliday(
        'Por ser lunes y martes estamos en feriado. Atendemos desde el miércoles.',
      ),
    ).toBe(HORARIO_REAL);
  });

  it('no toca un mensaje sin feriado', () => {
    const ok = 'Puede venir el lunes. Lo esperamos en Av. España 6-73 y Sevilla, Cuenca.';
    expect(stripInventedHoliday(ok)).toBe(ok);
  });
});
