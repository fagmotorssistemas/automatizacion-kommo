import {
  StayDecisionStore,
  stayFieldsForRunLog,
  type StayFila1Decision,
} from './otro-vehiculo';

const stayA: StayFila1Decision = {
  stay: false,
  motivo: 'otro_anio_version_color',
  otroVehiculo: 'Premiere 2020',
  sospecha: null,
  verificado: null,
};

const stayB: StayFila1Decision = {
  stay: true,
  motivo: 'sigue',
  otroVehiculo: null,
  sospecha: null,
  verificado: null,
};

describe('StayDecisionStore', () => {
  it('dos turnos concurrentes de contactos distintos: cada runLog registra la suya', async () => {
    const store = new StayDecisionStore();
    let releaseA!: () => void;
    const holdA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const flush = async (contactId: string) => {
      if (contactId === 'A') {
        await holdA;
      }
      const stay = store.take(contactId);
      return { contactId, detail: stayFieldsForRunLog(stay) };
    };

    store.save('A', stayA);
    const runLogA = flush('A');
    store.save('B', stayB);
    const runLogB = flush('B');
    releaseA();
    const [a, b] = await Promise.all([runLogA, runLogB]);

    expect(a.detail).toEqual({
      stay: false,
      motivo: 'otro_anio_version_color',
      otroVehiculo: 'Premiere 2020',
      sospecha: null,
      verificado: null,
    });
    expect(b.detail).toEqual({
      stay: true,
      motivo: 'sigue',
      otroVehiculo: null,
      sospecha: null,
      verificado: null,
    });
    expect(store.take('A')).toBeNull();
    expect(store.take('B')).toBeNull();
  });

  it('si no hay entrada, stay queda null', () => {
    expect(stayFieldsForRunLog(new StayDecisionStore().take('nadie'))).toEqual({
      stay: null,
      motivo: null,
      otroVehiculo: null,
      sospecha: null,
      verificado: null,
    });
  });

  it('una entrada vieja no se reutiliza', () => {
    const store = new StayDecisionStore();
    store.save('c1', stayA, 1);
    expect(store.take('c1', 1 + 11 * 60 * 1000)).toBeNull();
  });

  it('el siguiente turno del mismo contacto descarta la no leída', () => {
    const store = new StayDecisionStore();
    store.save('c1', stayA);
    store.discard('c1');
    store.save('c1', stayB);
    expect(store.take('c1')).toEqual(stayB);
  });
});
