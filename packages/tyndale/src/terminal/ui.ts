import chalk from 'chalk';

export type TerminalTone = 'accent' | 'muted' | 'dim' | 'success' | 'warning' | 'failure';

export interface TerminalRow {
  label: string;
  value: string | number;
  tone?: TerminalTone;
}

export interface TerminalUiOptions {
  write?: (line: string) => void;
  error?: (line: string) => void;
  decorated?: boolean;
  ascii?: boolean;
}

export interface ProgressOptions {
  total: number;
  noun: string;
  writeLine?: (line: string) => void;
  stream?: NodeJS.WriteStream;
  interactive?: boolean;
  decorated?: boolean;
  ascii?: boolean;
}

export interface ProgressReporter {
  tick(label: string, ok: boolean): void;
  done(extra?: string): void;
}

const BAR_WIDTH = 28;
const RENDER_INTERVAL_MS = 1000;
const DEFAULT_ROW_LABEL_WIDTH = 14;

export interface Glyphs {
  header: string;
  section: string;
  success: string;
  warning: string;
  failure: string;
  bullet: string;
  barFill: string;
  barEmpty: string;
}

export interface TerminalTheme {
  decorated: boolean;
  glyphs: Glyphs;
  dim(text: string): string;
  muted(text: string): string;
  accent(text: string): string;
  accentBold(text: string): string;
  success(text: string): string;
  warning(text: string): string;
  failure(text: string): string;
  tone(tone: TerminalTone, text: string): string;
}

function shouldDecorate(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return process.stdout.isTTY === true && process.env.NO_COLOR == null;
}

function shouldUseAscii(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  if (process.env.TYNDALE_ASCII === '1') return true;
  return process.env.TERM === 'dumb';
}

export function createTerminalTheme(
  options?: Pick<TerminalUiOptions, 'decorated' | 'ascii'>,
): TerminalTheme {
  const decorated = shouldDecorate(options?.decorated);
  const ascii = shouldUseAscii(options?.ascii);
  const passthrough = (text: string) => text;

  const color = <T extends (text: string) => string>(fn: T) => (decorated ? fn : passthrough);

  const glyphs: Glyphs = ascii
    ? {
        header: '*',
        section: '>',
        success: 'ok',
        warning: '!',
        failure: 'x',
        bullet: '-',
        barFill: '#',
        barEmpty: '-',
      }
    : {
        header: '◆',
        section: '›',
        success: '✓',
        warning: '▲',
        failure: '✗',
        bullet: '•',
        barFill: '█',
        barEmpty: '░',
      };

  const dim = color(chalk.hex('#9ca3af'));
  const muted = color(chalk.hex('#d1d5db'));
  const accent = color(chalk.hex('#d1476e'));
  const accentBold = color(chalk.hex('#e2aaba').bold);
  const success = color(chalk.hex('#4ade80'));
  const warning = color(chalk.hex('#fbbf24'));
  const failure = color(chalk.hex('#f87171'));

  return {
    decorated,
    glyphs,
    dim,
    muted,
    accent,
    accentBold,
    success,
    warning,
    failure,
    tone(tone: TerminalTone, text: string): string {
      switch (tone) {
        case 'accent':
          return accent(text);
        case 'muted':
          return muted(text);
        case 'dim':
          return dim(text);
        case 'success':
          return success(text);
        case 'warning':
          return warning(text);
        case 'failure':
          return failure(text);
      }
    },
  };
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m${remainder.toString().padStart(2, '0')}s`;
}

function formatRow(theme: TerminalTheme, row: TerminalRow, width = DEFAULT_ROW_LABEL_WIDTH): string {
  const label = row.label.padEnd(width, ' ');
  return `  ${theme.dim(label)} ${theme.tone(row.tone ?? 'muted', String(row.value))}`;
}

function emit(out: (line: string) => void, line = ''): void {
  out(line);
}

export interface TerminalUi {
  header(title: string, subtitle?: string): void;
  section(title: string, detail?: string): void;
  rows(rows: TerminalRow[]): void;
  info(message: string): void;
  item(message: string): void;
  warn(message: string): void;
  fail(message: string): void;
  issue(level: 'warning' | 'failure', location: string, message: string): void;
  summary(title: string, rows: TerminalRow[], note?: string): void;
  blank(): void;
}

export function createTerminalUi(options?: TerminalUiOptions): TerminalUi {
  const theme = createTerminalTheme(options);
  const out = options?.write ?? console.log.bind(console);
  const err = options?.error ?? console.error.bind(console);
  let hasOutput = false;

  function maybeGap(): void {
    if (hasOutput) emit(out);
    hasOutput = true;
  }

  function write(line = ''): void {
    emit(out, line);
    hasOutput = true;
  }

  return {
    header(title: string, subtitle?: string) {
      maybeGap();
      write(theme.accentBold(`${theme.glyphs.header} ${title}`));
      if (subtitle) {
        write(`  ${theme.dim(subtitle)}`);
      }
    },

    section(title: string, detail?: string) {
      maybeGap();
      write(theme.accent(`${theme.glyphs.section} ${title}`));
      if (detail) {
        write(`  ${theme.dim(detail)}`);
      }
    },

    rows(rows: TerminalRow[]) {
      const width = rows.reduce(
        (max, row) => Math.max(max, row.label.length),
        DEFAULT_ROW_LABEL_WIDTH,
      );
      for (const row of rows) {
        write(formatRow(theme, row, width));
      }
    },

    info(message: string) {
      write(`  ${theme.dim(message)}`);
    },

    item(message: string) {
      write(`  ${theme.success(theme.glyphs.success)} ${theme.muted(message)}`);
    },

    warn(message: string) {
      write(`  ${theme.warning(theme.glyphs.warning)} ${theme.muted(message)}`);
    },

    fail(message: string) {
      emit(err, `  ${theme.failure(theme.glyphs.failure)} ${theme.muted(message)}`);
      hasOutput = true;
    },

    issue(level: 'warning' | 'failure', location: string, message: string) {
      const symbol = level === 'warning' ? theme.warning(theme.glyphs.warning) : theme.failure(theme.glyphs.failure);
      const line = `  ${symbol} ${theme.muted(location)} ${theme.dim('—')} ${theme.muted(message)}`;
      if (level === 'warning') {
        write(line);
      } else {
        emit(err, line);
        hasOutput = true;
      }
    },

    summary(title: string, rows: TerminalRow[], note?: string) {
      maybeGap();
      write(theme.accentBold(title));
      this.rows(rows);
      if (note) {
        write(`  ${theme.dim(note)}`);
      }
    },

    blank() {
      write();
    },
  };
}

export function createProgress(options: ProgressOptions): ProgressReporter {
  const theme = createTerminalTheme(options);
  const stream = options.stream ?? process.stdout;
  const writeLine = options.writeLine ?? console.log.bind(console);
  const interactive = options.interactive ?? (options.writeLine == null && stream.isTTY === true);
  const startTime = Date.now();
  let completed = 0;
  let successes = 0;
  let failures = 0;
  let finished = false;

  function buildSummary(elapsed: number): string {
    if (failures > 0) {
      return `  ${theme.warning(theme.glyphs.warning)} ${theme.muted(`completed ${completed}/${options.total} ${options.noun}`)} ${theme.failure(`${failures} failed`)} ${theme.dim(`in ${formatTime(elapsed)}`)}`;
    }
    return `  ${theme.success(theme.glyphs.success)} ${theme.muted(`completed ${completed}/${options.total} ${options.noun}`)} ${theme.dim(`in ${formatTime(elapsed)}`)}`;
  }

  function render(): void {
    if (finished || !interactive) return;

    const elapsed = Date.now() - startTime;
    const pct = options.total > 0 ? completed / options.total : 1;
    const filled = Math.round(pct * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    const bar =
      theme.accent(theme.glyphs.barFill.repeat(filled)) +
      theme.dim(theme.glyphs.barEmpty.repeat(empty));
    const count = theme.dim(`${completed}/${options.total}`);
    const percent = theme.accent(`${Math.round(pct * 100)}%`);
    const elapsedText = theme.dim(formatTime(elapsed));

    let etaText = '';
    if (completed > 0 && completed < options.total) {
      const rate = elapsed / completed;
      const remaining = rate * (options.total - completed);
      etaText = ` ${theme.dim(`eta ${formatTime(remaining)}`)}`;
    }

    const failureText = failures > 0 ? ` ${theme.failure(`${failures} failed`)}` : '';
    stream.write(`\r\x1b[K  ${bar} ${percent} ${count} ${elapsedText}${etaText}${failureText}`);
  }

  render();
  const timer = interactive ? setInterval(render, RENDER_INTERVAL_MS) : null;
  timer?.unref?.();

  return {
    tick(_label: string, ok: boolean) {
      completed++;
      if (ok) {
        successes++;
      } else {
        failures++;
      }
      render();
    },

    done(extra?: string) {
      if (finished) return;
      finished = true;
      timer && clearInterval(timer);
      const elapsed = Date.now() - startTime;

      if (interactive) {
        stream.write('\r\x1b[K');
      }

      writeLine(buildSummary(elapsed));
      if (extra) {
        writeLine(extra);
      }
    },
  };
}
