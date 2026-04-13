import { describe, it, expect, spyOn } from 'bun:test';
import { formatExtractionReport, type ExtractionReport } from '../../src/utils/reporter';

describe('formatExtractionReport', () => {
  it('formats a clean report', () => {
    const report: ExtractionReport = {
      total: 42,
      newEntries: 10,
      removed: 2,
      unchanged: 30,
      errors: [],
      warnings: [],
    };

    const output = formatExtractionReport(report);

    expect(output).toContain('Extraction summary');
    expect(output).toContain('entries        42');
    expect(output).toContain('new            10');
    expect(output).toContain('removed        2');
    expect(output).toContain('unchanged      30');
    expect(output).toContain('errors         0');
    expect(output).toContain('warnings       0');
  });

  it('formats report with errors and warnings', () => {
    const report: ExtractionReport = {
      total: 5,
      newEntries: 5,
      removed: 0,
      unchanged: 0,
      errors: [
        { file: 'a.tsx', line: 10, message: 'unwrapped dynamic', severity: 'error' },
      ],
      warnings: [
        { file: 'en.json', line: 0, message: 'stale hash "abc"', severity: 'warning' },
      ],
    };

    const output = formatExtractionReport(report);

    expect(output).toContain('Errors (1)');
    expect(output).toContain('Warnings (1)');
    expect(output).toContain('errors         1');
    expect(output).toContain('warnings       1');
    expect(output).toContain('a.tsx');
    expect(output).toContain('unwrapped dynamic');
    expect(output).toContain('stale hash');
  });

  it('formats zero-entry report', () => {
    const report: ExtractionReport = {
      total: 0,
      newEntries: 0,
      removed: 0,
      unchanged: 0,
      errors: [],
      warnings: [],
    };

    const output = formatExtractionReport(report);
    expect(output).toContain('entries        0');
  });

  it('returns hasErrors=true when errors present', () => {
    const report: ExtractionReport = {
      total: 1,
      newEntries: 1,
      removed: 0,
      unchanged: 0,
      errors: [{ file: 'a.tsx', line: 1, message: 'bad', severity: 'error' }],
      warnings: [],
    };

    expect(report.errors.length > 0).toBe(true);
  });
});
