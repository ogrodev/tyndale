import { createTerminalUi } from '../terminal/ui';
import type { ExtractionError } from '../extract/string-extractor';

export interface ExtractionReport {
  total: number;
  newEntries: number;
  removed: number;
  unchanged: number;
  errors: ExtractionError[];
  warnings: ExtractionError[];
}

export interface ExtractionReportFormatOptions {
  decorated?: boolean;
  ascii?: boolean;
}

/**
 * Formats the extraction report as a human-readable string for console output.
 */
export function formatExtractionReport(
  report: ExtractionReport,
  options?: ExtractionReportFormatOptions,
): string {
  const lines: string[] = [];
  const ui = createTerminalUi({
    write: (line) => lines.push(line),
    error: (line) => lines.push(line),
    decorated: options?.decorated ?? false,
    ascii: options?.ascii,
  });

  ui.summary('Extraction summary', [
    { label: 'entries', value: report.total },
    { label: 'new', value: report.newEntries, tone: report.newEntries > 0 ? 'accent' : 'muted' },
    { label: 'removed', value: report.removed, tone: report.removed > 0 ? 'warning' : 'muted' },
    { label: 'unchanged', value: report.unchanged },
    { label: 'errors', value: report.errors.length, tone: report.errors.length > 0 ? 'failure' : 'muted' },
    { label: 'warnings', value: report.warnings.length, tone: report.warnings.length > 0 ? 'warning' : 'muted' },
  ]);

  if (report.errors.length > 0) {
    ui.section(`Errors (${report.errors.length})`);
    for (const err of report.errors) {
      const loc = err.line > 0 ? `${err.file}:${err.line}` : err.file;
      ui.issue('failure', loc, err.message);
    }
  }

  if (report.warnings.length > 0) {
    ui.section(`Warnings (${report.warnings.length})`);
    for (const warn of report.warnings) {
      const loc = warn.line > 0 ? `${warn.file}:${warn.line}` : warn.file;
      ui.issue('warning', loc, warn.message);
    }
  }

  return lines.join('\n');
}

/**
 * Prints the extraction report to stdout/stderr.
 * Returns exit code: 0 if no errors, 1 if errors present.
 */
export function printExtractionReport(
  report: ExtractionReport,
  options?: ExtractionReportFormatOptions,
): number {
  const output = formatExtractionReport(report, options);

  if (report.errors.length > 0) {
    console.error(output);
    return 1;
  }

  console.log(output);
  return 0;
}
