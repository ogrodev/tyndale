import type { ExtractionError } from '../extract/string-extractor';

export interface ExtractionReport {
  total: number;
  newEntries: number;
  removed: number;
  unchanged: number;
  errors: ExtractionError[];
  warnings: ExtractionError[];
}

/**
 * Formats the extraction report as a human-readable string for console output.
 */
export function formatExtractionReport(report: ExtractionReport): string {
  const lines: string[] = [];

  lines.push(
    `Extracted ${report.total} entries (${report.newEntries} new, ${report.removed} removed, ${report.unchanged} unchanged)`,
  );

  if (report.errors.length > 0) {
    lines.push('');
    lines.push(`Errors (${report.errors.length}):`);
    for (const err of report.errors) {
      const loc = err.line > 0 ? `${err.file}:${err.line}` : err.file;
      lines.push(`  ✗ ${loc} — ${err.message}`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push('');
    lines.push(`Warnings (${report.warnings.length}):`);
    for (const warn of report.warnings) {
      const loc = warn.line > 0 ? `${warn.file}:${warn.line}` : warn.file;
      lines.push(`  ⚠ ${loc} — ${warn.message}`);
    }
  }

  const errorCount = report.errors.length;
  const warningCount = report.warnings.length;
  lines.push(`${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`);

  return lines.join('\n');
}

/**
 * Prints the extraction report to stdout/stderr.
 * Returns exit code: 0 if no errors, 1 if errors present.
 */
export function printExtractionReport(report: ExtractionReport): number {
  const output = formatExtractionReport(report);

  if (report.errors.length > 0) {
    console.error(output);
    return 1;
  }

  console.log(output);
  return 0;
}
