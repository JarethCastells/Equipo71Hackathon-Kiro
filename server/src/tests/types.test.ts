import { describe, expect, it } from 'vitest';
import {
  toPublicConversation,
  toPublicMessage,
  type Conversation,
  type ConversationRow,
  type Message,
  type MessageRow,
} from '../types.js';

// ─── toPublicConversation ────────────────────────────────────────────────────

describe('toPublicConversation', () => {
  const row: ConversationRow = {
    id: 'conv-uuid-1',
    createdBy: 'user-uuid-1',
    isGroup: 0,
    title: null,
    dmKey: 'user-uuid-1:user-uuid-2', // clave interna
    lastMessageAt: '2024-01-15T10:00:00',
    createdAt: '2024-01-01T00:00:00',
  };

  it('devuelve todos los campos públicos esperados', () => {
    const result: Conversation = toPublicConversation(row);

    expect(result.id).toBe('conv-uuid-1');
    expect(result.createdBy).toBe('user-uuid-1');
    expect(result.isGroup).toBe(false);
    expect(result.title).toBeNull();
    expect(result.lastMessageAt).toBe('2024-01-15T10:00:00');
    expect(result.createdAt).toBe('2024-01-01T00:00:00');
  });

  it('NO expone dmKey', () => {
    const result = toPublicConversation(row) as unknown as Record<string, unknown>;
    expect(result).not.toHaveProperty('dmKey');
    expect(result).not.toHaveProperty('dm_key');
  });

  it('NO expone isGroup como número crudo (lo convierte a boolean)', () => {
    const result = toPublicConversation(row);
    expect(typeof result.isGroup).toBe('boolean');
    expect(result.isGroup).toBe(false);
  });

  it('convierte isGroup=1 a true', () => {
    const groupRow: ConversationRow = { ...row, isGroup: 1, dmKey: null, title: 'Equipo' };
    const result = toPublicConversation(groupRow);
    expect(result.isGroup).toBe(true);
  });

  it('el resultado contiene exactamente los campos del tipo Conversation', () => {
    const result = toPublicConversation(row);
    const keys = Object.keys(result).sort();
    const expected = ['id', 'createdBy', 'isGroup', 'title', 'lastMessageAt', 'createdAt'].sort();
    expect(keys).toEqual(expected);
  });
});

// ─── toPublicMessage ─────────────────────────────────────────────────────────

describe('toPublicMessage', () => {
  const row: MessageRow = {
    id: 'msg-uuid-1',
    conversationId: 'conv-uuid-1',
    senderId: 'user-uuid-1',
    body: 'Hola, ¿cómo estás?',
    createdAt: '2024-01-15T10:05:00',
  };

  it('devuelve todos los campos públicos esperados', () => {
    const result: Message = toPublicMessage(row);

    expect(result.id).toBe('msg-uuid-1');
    expect(result.conversationId).toBe('conv-uuid-1');
    expect(result.senderId).toBe('user-uuid-1');
    expect(result.body).toBe('Hola, ¿cómo estás?');
    expect(result.createdAt).toBe('2024-01-15T10:05:00');
  });

  it('el resultado contiene exactamente los campos del tipo Message', () => {
    const result = toPublicMessage(row);
    const keys = Object.keys(result).sort();
    const expected = ['id', 'conversationId', 'senderId', 'body', 'createdAt'].sort();
    expect(keys).toEqual(expected);
  });

  it('NO contiene campos internos inesperados', () => {
    const result = toPublicMessage(row) as unknown as Record<string, unknown>;
    // No hay campos de la tabla conversation_members en mensajes
    expect(result).not.toHaveProperty('lastReadAt');
    expect(result).not.toHaveProperty('lastEmailAt');
    expect(result).not.toHaveProperty('joinedAt');
  });

  it('preserva el cuerpo del mensaje íntegro', () => {
    const longBody = 'a'.repeat(2000);
    const result = toPublicMessage({ ...row, body: longBody });
    expect(result.body).toBe(longBody);
    expect(result.body.length).toBe(2000);
  });
});
