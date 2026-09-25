import { asksForPhotos, shouldSendVehiclePhotos } from './should-send-photos';

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('shouldSendVehiclePhotos', () => {
  it('primera presentación: sí manda fotos', () => {
    expect(
      shouldSendVehiclePhotos({
        inventoryId: UUID,
        alreadyShown: false,
        wantsPhotos: false,
      }),
    ).toBe(true);
  });

  it('inventory_id en un follow-up (precio, visita) no manda fotos', () => {
    expect(
      shouldSendVehiclePhotos({
        inventoryId: UUID,
        alreadyShown: true,
        wantsPhotos: false,
      }),
    ).toBe(false);
  });

  it('si pide el valor y ya hay carro mostrado no manda fotos', () => {
    expect(
      shouldSendVehiclePhotos({
        inventoryId: UUID,
        alreadyShown: false,
        wantsPhotos: false,
        skipFirstShot: true,
      }),
    ).toBe(false);
  });

  it('si pide fotos, sí las manda aunque ya las vio', () => {
    expect(
      shouldSendVehiclePhotos({
        inventoryId: UUID,
        alreadyShown: true,
        wantsPhotos: true,
      }),
    ).toBe(true);
  });

  it('sin carro no manda fotos', () => {
    expect(
      shouldSendVehiclePhotos({
        inventoryId: '',
        alreadyShown: false,
        wantsPhotos: false,
      }),
    ).toBe(false);
  });

  it('aunque el analizador pida fotos, sin carro concreto no manda', () => {
    expect(
      shouldSendVehiclePhotos({
        inventoryId: '',
        alreadyShown: false,
        wantsPhotos: true,
      }),
    ).toBe(false);
  });
});

describe('asksForPhotos', () => {
  it('detecta pedido explícito', () => {
    expect(asksForPhotos('me manda las fotos')).toBe(true);
    expect(asksForPhotos('una foto')).toBe(true);
    expect(asksForPhotos('Qué precio?')).toBe(false);
    expect(asksForPhotos('Kia rio?')).toBe(false);
  });
});
