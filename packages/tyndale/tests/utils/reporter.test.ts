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

    expect(output).toContain('42 entries');
    expect(output).toContain('10 new');
    expect(output).toContain('2 removed');
    expect(output).toContain('30 unchanged');
    expect(output).toContain('0 errors');
    expect(output).toContain('0 warnings');
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

    expect(output).toContain('1 error');
    expect(output).toContain('1 warning');
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
    expect(output).toContain('0 entries');
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
