import { formatSseEvent } from '../server/lib/sse.js';

describe('formatSseEvent', () => {
  test('formats a named event with JSON data and double newline', () => {
    expect(formatSseEvent('token', { text: 'hi' })).toBe('event: token\ndata: {"text":"hi"}\n\n');
  });
  test('escapes newlines inside data by JSON-encoding', () => {
    const out = formatSseEvent('token', { text: 'a\nb' });
    expect(out).toContain('data: {"text":"a\\nb"}');
  });
});
