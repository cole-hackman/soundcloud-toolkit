/** Format a single Server-Sent Event frame. data is JSON-encoded. */
export function formatSseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
