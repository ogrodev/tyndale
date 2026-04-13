import chalk from 'chalk';

const dim = chalk.hex('#aaa');
const muted = chalk.hex('#ccc');
const bar = chalk.hex('#7c6fe0');
const barBg = chalk.hex('#333');
const accent = chalk.hex('#a78bfa');
const success = chalk.hex('#4ade80');
const fail = chalk.hex('#f87171');

const BAR_WIDTH = 28;
const RENDER_INTERVAL_MS = 1000;

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m${rem.toString().padStart(2, '0')}s`;
}

export interface ProgressReporter {
  /** Call when a work unit completes (success or failure). */
  tick(label: string, ok: boolean): void;
  /** Print final summary and newline. */
  done(extra?: string): void;
}

/**
 * Creates a terminal progress reporter with a colored progress bar,
 * elapsed time, and ETA.
 *
 * The bar repaints every second even when no jobs complete so elapsed time
 * and ETA stay live instead of jumping only on completions.
 */
export function createProgress(total: number, noun: string): ProgressReporter {
  const startTime = Date.now();
  let completed = 0;
  let successes = 0;
  let failures = 0;
  let finished = false;

  function render(): void {
    if (finished) return;

    const elapsed = Date.now() - startTime;
    const pct = total > 0 ? completed / total : 1;
    const filled = Math.round(pct * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;

    const barStr =
      bar('█'.repeat(filled)) +
      barBg('░'.repeat(empty));

    const pctStr = accent(`${Math.round(pct * 100)}%`);
    const countStr = dim(`${completed}/${total}`);
    const elapsedStr = dim(formatTime(elapsed));

    let etaStr = '';
    if (completed > 0 && completed < total) {
      const rate = elapsed / completed;
      const remaining = rate * (total - completed);
      etaStr = dim(` eta ${formatTime(remaining)}`);
    }

    const failStr = failures > 0 ? fail(` ${failures} failed`) : '';

    const line = `  ${barStr} ${pctStr} ${countStr}  ${elapsedStr}${etaStr}${failStr}`;
    process.stdout.write(`\r\x1b[K${line}`);
  }

  // Initial render + live timer.
  render();
  const timer = setInterval(render, RENDER_INTERVAL_MS);
  timer.unref?.();

  return {
    tick(_label: string, ok: boolean) {
      completed++;
      if (ok) successes++;
      else failures++;
      render();
    },

    done(extra?: string) {
      if (finished) return;
      finished = true;
      clearInterval(timer);

      const elapsed = Date.now() - startTime;
      process.stdout.write('\r\x1b[K');

      const summary = failures > 0
        ? `  ${success(`${successes}`)} ${muted(noun)} ${muted('translated,')} ${fail(`${failures} failed`)} ${dim(`in ${formatTime(elapsed)}`)}`
        : `  ${success(`✓ ${successes}`)} ${muted(`${noun} translated`)} ${dim(`in ${formatTime(elapsed)}`)}`;

      console.log(summary);
      if (extra) console.log(extra);
    },
  };
}

// Styled log helpers that route through an injectable writer
export interface StyledLogger {
  step: (msg: string) => void;
  info: (msg: string) => void;
  item: (label: string) => void;
  fail: (label: string, err: string) => void;
  header: (msg: string) => void;
  warn: (msg: string) => void;
}

/**
 * Create a styled logger. When `write` is provided, output goes through it
 * (stripping ANSI for test capture). Otherwise writes to console.log.
 */
export function createStyledLogger(write?: (msg: string) => void): StyledLogger {
  const out = write ?? console.log.bind(console);
  return {
    step: (msg: string) => out(muted(msg)),
    info: (msg: string) => out(dim(msg)),
    item: (label: string) => out(`  ${success('✓')} ${muted(label)}`),
    fail: (label: string, err: string) => out(`  ${fail('✗')} ${muted(label)} ${dim(err)}`),
    header: (msg: string) => out(accent(msg)),
    warn: (msg: string) => out(chalk.hex('#fbbf24')(msg)),
  };
}

// Default instance for direct use
export const log = createStyledLogger();
