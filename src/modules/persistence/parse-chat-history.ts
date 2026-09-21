import { MemoryMessage } from '../conversation/conversation.service';
import {
  isRealCustomerText,
  isSyntheticCustomerText,
} from '../conversation/is-real-customer-text';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function spokenAiContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) {
    return content;
  }

  try {
    const parsed = JSON.parse(trimmed) as { respuesta_cliente?: unknown };
    if (typeof parsed.respuesta_cliente === 'string' && parsed.respuesta_cliente.trim()) {
      return parsed.respuesta_cliente.trim();
    }
  } catch {
    return content;
  }

  return content;
}

export function chatRowToMemoryMessage(message: unknown): MemoryMessage | null {
  const row = asRecord(message);
  if (!row) {
    return null;
  }

  const content = String(row.content ?? '');
  const type = String(row.type ?? '');

  if (type === 'human') {
    return isRealCustomerText(content) ? { role: 'user', content } : null;
  }

  if (type === 'ai') {
    if (!content.trim() || isSyntheticCustomerText(content)) {
      return null;
    }
    return { role: 'assistant', content: spokenAiContent(content) };
  }

  return null;
}
