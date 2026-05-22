import OpenAI from 'openai';

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const MODEL = process.env.CHAT_MODEL_REASONING || 'gpt-4o-mini';

/**
 * Create a streaming chat completion with tool calling.
 * Returns the async-iterable OpenAI stream. Provider is isolated here so it can
 * be swapped (e.g. Anthropic) without touching the route or the tool loop.
 */
export async function createChatStream({ messages, tools }) {
  return getClient().chat.completions.create({
    model: MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    stream: true,
  });
}
