const { sleep, SC_WRITE_PACING_MS } = await import('../server/lib/pacing.js');

test('sleep resolves after roughly the requested delay', async () => {
  const start = Date.now();
  await sleep(20);
  expect(Date.now() - start).toBeGreaterThanOrEqual(15);
});

test('standard SoundCloud write pacing is 300ms', () => {
  expect(SC_WRITE_PACING_MS).toBe(300);
});
