import { InboxFlushRunner } from './inbox-flush.runner';
import { turnRetryFlushMessageId } from './inbox.constants';

const job = {
  contactId: '59649787',
  messageId: 'msg-cotiz',
  leadId: '41986297',
  name: 'Nattu',
  phone: '+593000',
  source: 'waba',
  createdAt: '1789340833',
  text: 'Me ayuda con las cotizaciones\nFinanciado y al contado',
};

function buildProcessor() {
  const inbox = {
    flushIfLatest: jest.fn().mockResolvedValue({
      status: 'won',
      text: job.text,
    }),
    hasOutboundSent: jest.fn().mockResolvedValue(false),
    claimTurn: jest.fn().mockResolvedValue(true),
    releaseTurn: jest.fn().mockResolvedValue(undefined),
    scheduleTurnRetry: jest.fn().mockResolvedValue('scheduled'),
    hasRecentOutbound: jest.fn().mockResolvedValue(false),
    markOutboundSent: jest.fn().mockResolvedValue(undefined),
    markRecentOutbound: jest.fn().mockResolvedValue(undefined),
  };
  const persistence = {
    syncInboundLead: jest.fn().mockResolvedValue({
      lead: { status: 'existing', lead: { id: 36253 } },
      ctwa: { matched: true },
    }),
    loadRecentChat: jest.fn().mockResolvedValue([]),
    latestInterestedCar: jest.fn().mockResolvedValue(null),
    hasShownCar: jest.fn().mockResolvedValue(false),
    assignLead: jest.fn(),
  };
  const conversation = {
    recentMessages: jest.fn().mockResolvedValue([]),
    resolveInboundText: jest.fn().mockReturnValue({
      message: job.text,
      source: 'buffer',
      vehicle: null,
      withinWindow: false,
    }),
    appendMessage: jest.fn(),
  };
  const agent = {
    handleTurn: jest.fn().mockResolvedValue({
      resumen: 'Pide crédito: sí\nPide precio: sí',
      reply: {
        mensaje: 'El contado es $29.200. Para crédito, ¿con cuánto entrada?',
        meta: { precioMostrado: true, cuotaMostrada: false, vehiculo: null },
        img_prefix: '',
      },
    }),
  };
  const outbound = {
    dispatch: jest.fn().mockResolvedValue({
      delivered: true,
      shadow: false,
      photoBots: [],
      missingPhotos: false,
    }),
  };
  const intelligence = {
    afterReply: jest.fn().mockResolvedValue({}),
  };
  const otherChannel = { handle: jest.fn() };
  const runLog = { record: jest.fn().mockResolvedValue(undefined) };

  const processor = new InboxFlushRunner(
    inbox as never,
    persistence as never,
    conversation as never,
    agent as never,
    outbound as never,
    intelligence as never,
    otherChannel as never,
    runLog as never,
  );

  return {
    processor,
    inbox,
    agent,
    outbound,
    intelligence,
    runLog,
  };
}

describe('InboxDebounceProcessor candado', () => {
  it('suelta el turno antes de intelligence', async () => {
    const { processor, inbox, intelligence } = buildProcessor();
    const order: string[] = [];
    inbox.releaseTurn.mockImplementation(async () => {
      order.push('release');
    });
    intelligence.afterReply.mockImplementation(async () => {
      order.push('intelligence');
    });

    await processor.run(job);
    await Promise.resolve();
    await Promise.resolve();

    expect(order[0]).toBe('release');
    expect(order).toContain('intelligence');
  });

  it('si el turno está ocupado, reencola y no llama al agente', async () => {
    const { processor, inbox, agent } = buildProcessor();
    inbox.claimTurn.mockResolvedValue(false);

    await processor.run(job);

    expect(agent.handleTurn).not.toHaveBeenCalled();
    expect(inbox.scheduleTurnRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: job.messageId,
        text: job.text,
      }),
    );
  });

  it('en reintento flusha con id sintético para no perder contra el primer flush', async () => {
    const { processor, inbox } = buildProcessor();

    await processor.run({ ...job, lockRetry: 1 });

    expect(inbox.flushIfLatest).toHaveBeenCalledWith(
      job.contactId,
      turnRetryFlushMessageId(job.messageId, 1),
      job.text,
    );
  });

  it('solicita fotos sin carro concreto no dispara fotos', async () => {
    const { processor, outbound, agent } = buildProcessor();
    agent.handleTurn.mockResolvedValue({
      resumen:
        'SOLICITUD ACTUAL:\nCliente pide información y solicita fotos.\nFalta vehículo: sí',
      reply: {
        mensaje: '¿Qué carro le interesa?',
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: null,
        },
        img_prefix: '',
      },
    });

    await processor.run({
      ...job,
      text: 'Hola. ¿Puedo obtener más información sobre esto?',
    });

    expect(outbound.dispatch).toHaveBeenCalledWith(
      job.leadId,
      expect.anything(),
      expect.objectContaining({ wantsPhotos: false }),
    );
  });

  it('si el resumen pide fotos, las dispara aunque el mensaje no diga foto', async () => {
    const { processor, outbound, agent } = buildProcessor();
    agent.handleTurn.mockResolvedValue({
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere que le envíen fotos o videos del Chevrolet Dmax 4x4 que mencionó.\nPide precio: no',
      reply: {
        mensaje:
          'Estimado, tenemos disponible un Chevrolet Dmax CRDI 2022 color vino. Aquí tiene también las fotos del vehículo.',
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: { inventory_id: '77228cd5-623b-4707-b01b-540e1b29bb48' },
        },
        img_prefix: '',
      },
    });

    await processor.run({ ...job, text: 'Le dige Dimax' });

    expect(outbound.dispatch).toHaveBeenCalledWith(
      job.leadId,
      expect.anything(),
      expect.objectContaining({ wantsPhotos: true }),
    );
  });

  it('si se agotan los reintentos, no llama al agente', async () => {
    const { processor, inbox, agent, runLog } = buildProcessor();
    inbox.claimTurn.mockResolvedValue(false);
    inbox.scheduleTurnRetry.mockResolvedValue('skipped');

    await processor.run({ ...job, lockRetry: 2 });

    expect(agent.handleTurn).not.toHaveBeenCalled();
    expect(runLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'outbound',
        status: 'skipped',
        reason: 'turno_ocupado_agotado',
      }),
    );
  });
});
