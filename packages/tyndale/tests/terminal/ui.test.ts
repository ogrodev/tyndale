import { describe, expect, it } from 'bun:test';
import { createProgress, createTerminalUi } from '../../src/terminal/ui';

describe('terminal ui', () => {
  it('renders headers, sections, and rows without ANSI when decoration is disabled', () => {
    const output: string[] = [];
    const ui = createTerminalUi({
      write: (line) => output.push(line),
      error: (line) => output.push(`ERR:${line}`),
      decorated: false,
      ascii: true,
    });

    ui.header('Translate strings', 'Modern operator console');
    ui.section('Preflight');
    ui.rows([
      { label: 'locales', value: 'es, fr' },
      { label: 'token budget', value: '50,000' },
    ]);
    ui.item('Generated translation brief');
    ui.warn('1 locale needs retry');
    ui.fail('1 batch failed');

    expect(output).toEqual([
      '* Translate strings',
      '  Modern operator console',
      '',
      '> Preflight',
      '  locales        es, fr',
      '  token budget   50,000',
      '  ok Generated translation brief',
      '  ! 1 locale needs retry',
      'ERR:  x 1 batch failed',
    ]);
  });

  it('renders issue summaries with separate warning and failure channels', () => {
    const out: string[] = [];
    const err: string[] = [];
    const ui = createTerminalUi({
      write: (line) => out.push(line),
      error: (line) => err.push(line),
      decorated: false,
      ascii: true,
    });

    ui.summary('Extraction summary', [
      { label: 'entries', value: 42 },
      { label: 'errors', value: 1, tone: 'failure' },
      { label: 'warnings', value: 2, tone: 'warning' },
    ]);
    ui.issue('warning', 'en.json', 'stale hash');
    ui.issue('failure', 'src/page.tsx:10', 'dynamic content');

    expect(out).toEqual([
      'Extraction summary',
      '  entries        42',
      '  errors         1',
      '  warnings       2',
      '  ! en.json — stale hash',
    ]);
    expect(err).toEqual([
      '  x src/page.tsx:10 — dynamic content',
    ]);
  });

  it('keeps progress logging capture-safe in non-interactive mode', () => {
    const output: string[] = [];
    const progress = createProgress({
      total: 2,
      noun: 'entries',
      writeLine: (line) => output.push(line),
      interactive: false,
      decorated: false,
      ascii: true,
    });

    progress.tick('es batch 1', true);
    progress.tick('fr batch 1', false);
    progress.done();

    expect(output).toEqual([
      '  ! completed 2/2 entries 1 failed in 0s',
    ]);
  });
});
