import { z } from 'zod';

const optionalText = z.string().optional().default('');

export const kommoInboundMessageSchema = z.object({
  messageId: z.string().min(1),
  leadId: z.string().min(1),
  chatId: optionalText,
  talkId: optionalText,
  contactId: optionalText,
  text: optionalText,
  createdAt: optionalText,
  messageType: optionalText,
  direction: optionalText,
  entityType: optionalText,
  authorId: optionalText,
  authorType: optionalText,
  authorName: optionalText,
  origin: optionalText,
  attachmentType: optionalText,
  attachmentFileName: optionalText,
  attachmentLink: z
    .union([z.url(), z.literal('')])
    .optional()
    .default(''),
});

export type KommoInboundMessage = z.infer<typeof kommoInboundMessageSchema>;

export function isCustomerInbound(message: KommoInboundMessage): boolean {
  return message.direction === 'incoming' && message.authorType === 'external';
}
