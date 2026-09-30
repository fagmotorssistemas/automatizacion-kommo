import { unitCaja } from '../catalog/clasificar-filas';
import { gearboxOf } from './gearbox';

describe('t/a y t/m en el modelo', () => {
  it('bronco xlt 4x4 t/a es automática', () => {
    const car = { model: 'bronco xlt 4x4 t/a', transmission: null };
    expect(gearboxOf(car)).toBe('automatica');
    expect(unitCaja(car)).toBe('automática');
  });

  it('x t/m es manual', () => {
    const car = { model: 'x t/m', transmission: null };
    expect(gearboxOf(car)).toBe('manual');
    expect(unitCaja(car)).toBe('manual');
  });

  it('ta y tm sin barra siguen igual', () => {
    expect(gearboxOf({ model: 'picanto lx ac 1.2 4p 4x2 ta' })).toBe(
      'automatica',
    );
    expect(gearboxOf({ model: '500 lounge ac 1.4 3p 4x2 tm' })).toBe('manual');
    expect(
      unitCaja({ model: 'sentra exclusive ac 1.8 4p 4x2 ta' }),
    ).toBe('automática');
    expect(unitCaja({ model: 'sportage sl ac 2.0 5p 4x2 tm' })).toBe('manual');
  });
});
