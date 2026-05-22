import defaultPrisma from './prisma.js';

const TITLE_LIMIT = 60;

/** Build a short title from the first user message. Returns null if empty. */
export function deriveTitleFromMessage(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= TITLE_LIMIT) return trimmed;
  return trimmed.slice(0, TITLE_LIMIT - 1).trimEnd() + '…';
}

/** List a user's conversations newest first. */
export async function listConversations(userId, { prisma = defaultPrisma } = {}) {
  return prisma.chatConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
}

/** Create a new (empty) conversation owned by the user. */
export async function createConversation(userId, { prisma = defaultPrisma, title = null } = {}) {
  return prisma.chatConversation.create({ data: { userId, title } });
}

/**
 * Load a conversation + ordered messages, scoped to the owning user.
 * Returns null if the conversation does not exist or belongs to someone else.
 */
export async function getConversation(id, userId, { prisma = defaultPrisma } = {}) {
  const conversation = await prisma.chatConversation.findFirst({ where: { id, userId } });
  if (!conversation) return null;
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });
  return { ...conversation, messages };
}

/** Append a user-role message; sets the auto-title if not already set. */
export async function appendUserMessage(conversationId, content, { prisma = defaultPrisma } = {}) {
  const msg = await prisma.chatMessage.create({
    data: { conversationId, role: 'user', content },
  });

  const existing = (await prisma.chatConversation.findMany({ where: { id: conversationId } }))[0];
  const updateData = {};
  if (existing && !existing.title) {
    const title = deriveTitleFromMessage(content);
    if (title) updateData.title = title;
  }
  await prisma.chatConversation.update({ where: { id: conversationId }, data: updateData });
  return msg;
}

/**
 * Persist an assistant turn: any tool calls (as `tool` rows), then the
 * final assistant text (if any). Updates the conversation's updatedAt.
 */
export async function appendAssistantTurn(
  conversationId,
  assistantText,
  toolCalls = [],
  { prisma = defaultPrisma } = {},
) {
  if (toolCalls.length) {
    await prisma.chatMessage.createMany({
      data: toolCalls.map((c) => ({
        conversationId,
        role: 'tool',
        content: null,
        toolName: c.toolName,
        toolArgs: c.toolArgs ?? null,
        toolResult: c.toolResult ?? null,
      })),
    });
  }
  if (assistantText && assistantText.trim()) {
    await prisma.chatMessage.create({
      data: { conversationId, role: 'assistant', content: assistantText },
    });
  }
  await prisma.chatConversation.update({ where: { id: conversationId }, data: {} });
}

/** Delete a conversation + cascade messages, scoped to its owner. */
export async function deleteConversation(id, userId, { prisma = defaultPrisma } = {}) {
  return prisma.chatConversation.deleteMany({ where: { id, userId } });
}
