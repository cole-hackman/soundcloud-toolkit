import {
  listConversations,
  getConversation,
  createConversation,
  appendUserMessage,
  appendAssistantTurn,
  deleteConversation,
  deriveTitleFromMessage,
} from '../server/lib/chat-history.js';

function inMemoryPrisma() {
  const conversations = [];
  const messages = [];
  let convId = 0;
  let msgId = 0;
  const now = () => new Date();
  return {
    _state: { conversations, messages },
    chatConversation: {
      findMany: async ({ where = {}, orderBy, take }) => {
        let rows = conversations;
        if (where.userId) rows = rows.filter((c) => c.userId === where.userId);
        if (where.id) rows = rows.filter((c) => c.id === where.id);
        if (orderBy?.updatedAt === 'desc') rows = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
        return take ? rows.slice(0, take) : rows;
      },
      findFirst: async ({ where }) =>
        conversations.find((c) => c.id === where.id && c.userId === where.userId) || null,
      create: async ({ data }) => {
        const row = { id: `c${++convId}`, userId: data.userId, title: data.title ?? null, createdAt: now(), updatedAt: now() };
        conversations.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = conversations.find((c) => c.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: now() });
        return row;
      },
      deleteMany: async ({ where }) => {
        const before = conversations.length;
        for (let i = conversations.length - 1; i >= 0; i--) {
          if (conversations[i].id === where.id && conversations[i].userId === where.userId) conversations.splice(i, 1);
        }
        // cascade
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].conversationId === where.id) messages.splice(i, 1);
        }
        return { count: before - conversations.length };
      },
    },
    chatMessage: {
      findMany: async ({ where, orderBy }) => {
        let rows = messages.filter((m) => m.conversationId === where.conversationId);
        if (orderBy?.createdAt === 'asc') rows = [...rows].sort((a, b) => a.createdAt - b.createdAt);
        return rows;
      },
      create: async ({ data }) => {
        const row = { id: `m${++msgId}`, createdAt: now(), ...data };
        messages.push(row);
        return row;
      },
      createMany: async ({ data }) => {
        for (const d of data) {
          messages.push({ id: `m${++msgId}`, createdAt: now(), ...d });
        }
        return { count: data.length };
      },
    },
  };
}

describe('chat-history', () => {
  test('createConversation, append messages, getConversation reads them back', async () => {
    const prisma = inMemoryPrisma();
    const conv = await createConversation('u1', { prisma });
    await appendUserMessage(conv.id, 'Hello there', { prisma });
    await appendAssistantTurn(
      conv.id,
      'Hi!',
      [{ toolName: 'count_likes', toolArgs: { artist: 'X' }, toolResult: { count: 1 } }],
      { prisma },
    );

    const reloaded = await getConversation(conv.id, 'u1', { prisma });
    expect(reloaded.id).toBe(conv.id);
    expect(reloaded.messages).toHaveLength(3); // user + tool + assistant
    expect(reloaded.messages.map((m) => m.role)).toEqual(['user', 'tool', 'assistant']);
    expect(reloaded.title).toMatch(/Hello there/);
  });

  test('listConversations is scoped to the requesting user', async () => {
    const prisma = inMemoryPrisma();
    await createConversation('u1', { prisma });
    await createConversation('u2', { prisma });
    const u1 = await listConversations('u1', { prisma });
    const u2 = await listConversations('u2', { prisma });
    expect(u1).toHaveLength(1);
    expect(u2).toHaveLength(1);
    expect(u1[0].id).not.toBe(u2[0].id);
  });

  test('getConversation refuses cross-user access', async () => {
    const prisma = inMemoryPrisma();
    const conv = await createConversation('u1', { prisma });
    const result = await getConversation(conv.id, 'u2', { prisma });
    expect(result).toBeNull();
  });

  test('deleteConversation removes the conversation and its messages', async () => {
    const prisma = inMemoryPrisma();
    const conv = await createConversation('u1', { prisma });
    await appendUserMessage(conv.id, 'X', { prisma });
    await deleteConversation(conv.id, 'u1', { prisma });
    expect(prisma._state.conversations).toHaveLength(0);
    expect(prisma._state.messages).toHaveLength(0);
  });

  test('deriveTitleFromMessage truncates to ~60 chars', () => {
    expect(deriveTitleFromMessage('How many liked tracks by Riordan do I have?')).toMatch(/Riordan/);
    expect(deriveTitleFromMessage('x'.repeat(200)).length).toBeLessThanOrEqual(60);
    expect(deriveTitleFromMessage('')).toBeNull();
  });
});
