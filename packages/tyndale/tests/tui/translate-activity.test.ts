import { describe, expect, it } from 'bun:test';
import { TranslateActivityModel } from '../../src/tui/translate-activity';

describe('translate activity model', () => {
  it('tracks batch lifecycle, retries, and recent-event bounds', () => {
    let now = 0;
    const model = new TranslateActivityModel({
      now: () => now,
      maxVisibleBatches: 3,
      maxRecentEvents: 3,
    });

    model.setOverview([
      { label: 'batches', value: 3 },
      { label: 'concurrency', value: '2 (configured)' },
    ]);
    model.registerBatches([
      { id: 'es:1', locale: 'es', batchIndex: 0, entryCount: 2 },
      { id: 'fr:1', locale: 'fr', batchIndex: 0, entryCount: 1 },
      { id: 'de:1', locale: 'de', batchIndex: 0, entryCount: 4 },
    ]);

    now = 1_000;
    model.startBatch('es:1');
    model.recordSessionEvent('es:1', { type: 'prompt_start', mode: 'text' });
    model.recordSessionEvent('es:1', { type: 'text_delta', delta: 'Hola', text: 'Hola mundo' });
    model.recordRetry('es:1', 1, 'provider timeout');

    now = 2_000;
    model.finishBatch('es:1', false, '1 failed validation');

    const snapshot = model.snapshot();
    expect(snapshot.overview).toEqual([
      { label: 'batches', value: 3 },
      { label: 'concurrency', value: '2 (configured)' },
    ]);
    expect(snapshot.totals).toEqual({
      total: 3,
      queued: 2,
      running: 0,
      success: 0,
      failure: 1,
    });
    expect(snapshot.batches[0]).toMatchObject({
      id: 'es:1',
      status: 'failure',
      preview: 'Hola mundo',
    });
    expect(snapshot.recentEvents).toHaveLength(2);
    expect(snapshot.recentEvents.map((event) => event.message)).toEqual([
      'es batch 1 retry 1 — provider timeout',
      'es batch 1 failed in 1s — 1 failed validation',
    ]);
  });

  it('keeps row ordering stable while prioritizing running batches ahead of completed and queued work', () => {
    let now = 0;
    const model = new TranslateActivityModel({
      now: () => now,
      maxVisibleBatches: 3,
    });

    model.registerBatches([
      { id: 'fr:1', locale: 'fr', batchIndex: 0 },
      { id: 'ja:1', locale: 'ja', batchIndex: 0 },
      { id: 'es:1', locale: 'es', batchIndex: 0 },
    ]);

    now = 1_000;
    model.startBatch('fr:1');
    model.startBatch('ja:1');
    model.recordSessionEvent('ja:1', {
      type: 'tool_start',
      toolCallId: 'tool-1',
      toolName: 'read',
      args: { path: 'src/ja.ts' },
    });

    now = 2_000;
    model.startBatch('es:1');
    model.finishBatch('es:1', true, '2 translated');
    model.recordSessionEvent('fr:1', {
      type: 'tool_update',
      toolCallId: 'tool-2',
      toolName: 'read',
      args: { path: 'src/fr.ts' },
      summary: 'still reading',
    });

    const snapshot = model.snapshot();
    expect(snapshot.batches.map((batch) => batch.id)).toEqual(['fr:1', 'ja:1', 'es:1']);
    expect(snapshot.batches[0].detail).toContain('still reading');
    expect(snapshot.batches[1].detail).toBe('tool read');
    expect(snapshot.totals).toEqual({
      total: 3,
      queued: 0,
      running: 2,
      success: 1,
      failure: 0,
    });
  });

  it('suppresses raw json previews and shows a compact completion summary for json sessions', () => {
    const model = new TranslateActivityModel();
    model.registerBatches([{ id: 'es:1', locale: 'es', batchIndex: 0, entryCount: 2 }]);
    model.startBatch('es:1');
    model.recordSessionEvent('es:1', { type: 'prompt_start', mode: 'json' });
    model.recordSessionEvent('es:1', {
      type: 'text_delta',
      delta: '{"translations":',
      text: '{"translations": {"a": "Hola"}}',
    });
    model.recordSessionEvent('es:1', {
      type: 'complete',
      mode: 'json',
      text: '{"translations": {"a": "Hola", "b": "Mundo"}}',
      response: { translations: { a: 'Hola', b: 'Mundo' } },
    });

    const snapshot = model.snapshot();
    expect(snapshot.batches[0]).toMatchObject({
      id: 'es:1',
      preview: '2 translations ready',
    });
  });

  it('uses explicit labels for non-batch work items', () => {
    const model = new TranslateActivityModel();
    model.registerBatches([{
      id: 'es/getting-started.mdx',
      locale: 'es',
      batchIndex: 0,
      label: 'es/getting-started.mdx',
    }]);
    model.startBatch('es/getting-started.mdx');
    model.finishBatch('es/getting-started.mdx', true, 'translated');

    const snapshot = model.snapshot();
    expect(snapshot.batches[0]).toMatchObject({
      id: 'es/getting-started.mdx',
      label: 'es/getting-started.mdx',
      detail: 'completed · translated',
    });
    expect(snapshot.recentEvents.map((event) => event.message)).toEqual([
      'es/getting-started.mdx completed in 0s — translated',
    ]);
  });

  it('surfaces validation phases and locale batch counts in row details', () => {
    const model = new TranslateActivityModel();
    model.registerBatches([
      { id: 'fr:1', locale: 'fr', batchIndex: 0, totalLocaleBatches: 2, entryCount: 40 },
      { id: 'fr:2', locale: 'fr', batchIndex: 1, totalLocaleBatches: 2, entryCount: 12 },
    ]);

    model.startBatch('fr:1');
    model.setBatchPhase('fr:1', 'validating 40 strings');

    const snapshot = model.snapshot();
    expect(snapshot.batches[0]).toMatchObject({
      id: 'fr:1',
      label: 'fr batch 1/2',
      detail: 'validating 40 strings · 40 strings',
    });
    expect(snapshot.batches[1]).toMatchObject({
      id: 'fr:2',
      label: 'fr batch 2/2',
      detail: 'queued · 12 strings',
    });
  });
});
