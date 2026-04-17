import { visibleWidth, type Component } from '@mariozechner/pi-tui';
import type { TerminalRow, TerminalTone } from '../terminal/ui.js';
import { createTerminalTheme } from '../terminal/ui.js';
import type { TranslationSessionActivityEvent } from '../translate/pi-session.js';

const PREVIEW_LIMIT = 88;
const DETAIL_LIMIT = 104;
const DEFAULT_MAX_VISIBLE_BATCHES = 8;
const DEFAULT_MAX_RECENT_EVENTS = 8;

type BatchStatus = 'queued' | 'running' | 'success' | 'failure';

export interface TranslateActivityBatchDescriptor {
  id: string;
  locale: string;
  batchIndex: number;
  totalLocaleBatches?: number;
  label?: string;
  entryCount?: number;
}

interface TranslateActivityLogEntry {
  tone: TerminalTone;
  message: string;
  at: number;
}

interface TranslateActivityBatchState extends TranslateActivityBatchDescriptor {
  order: number;
  status: BatchStatus;
  startedAt?: number;
  updatedAt: number;
  finishedAt?: number;
  retries: number;
  responseMode?: 'json' | 'text';
  preview?: string;
  phase?: string;
  activeTool?: string;
  toolSummary?: string;
  error?: string;
}
export interface TranslateActivitySnapshot {
  title: string;
  overview: TerminalRow[];
  totals: {
    total: number;
    queued: number;
    running: number;
    success: number;
    failure: number;
  };
  batches: Array<{
    id: string;
    locale: string;
    batchIndex: number;
    label: string;
    status: BatchStatus;
    detail: string;
    preview?: string;
  }>;
  recentEvents: TranslateActivityLogEntry[];
  footer?: string;
  elapsedMs: number;
}

export interface TranslateActivityController {
  root: Component;
  setOverview(rows: TerminalRow[]): void;
  registerBatches(batches: TranslateActivityBatchDescriptor[]): void;
  startBatch(batchId: string): void;
  setBatchPhase(batchId: string, phase?: string): void;
  recordRetry(batchId: string, attempt: number, message: string): void;
  recordSessionEvent(batchId: string, event: TranslationSessionActivityEvent): void;
  finishBatch(batchId: string, ok: boolean, detail?: string): void;
  finish(footer?: string): void;
  snapshot(): TranslateActivitySnapshot;
}

export interface TranslateActivityOptions {
  title?: string;
  decorated?: boolean;
  ascii?: boolean;
  maxVisibleBatches?: number;
  maxRecentEvents?: number;
  activitySectionTitle?: string;
  idleActivityMessage?: string;
}

interface TranslateActivityRenderControls {
  requestRender(force?: boolean): void;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m${remainder.toString().padStart(2, '0')}s`;
}

function collapseText(text: string, limit: number): string | undefined {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return undefined;
  return collapsed.length > limit ? `${collapsed.slice(0, limit - 1)}…` : collapsed;
}


function truncatePlain(text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (visibleWidth(text) <= maxWidth) return text;
  if (maxWidth === 1) return '…';
  return `${text.slice(0, maxWidth - 1)}…`;
}

export class TranslateActivityModel {
  private readonly now: () => number;
  private readonly maxVisibleBatches: number;
  private readonly maxRecentEvents: number;
  private readonly title: string;
  private overview: TerminalRow[] = [];
  private readonly batches = new Map<string, TranslateActivityBatchState>();
  private readonly recentEvents: TranslateActivityLogEntry[] = [];
  private footer?: string;
  private readonly createdAt: number;
  private nextBatchOrder = 0;

  constructor(options?: Pick<TranslateActivityOptions, 'title' | 'maxVisibleBatches' | 'maxRecentEvents'> & { now?: () => number }) {
    this.now = options?.now ?? Date.now;
    this.maxVisibleBatches = options?.maxVisibleBatches ?? DEFAULT_MAX_VISIBLE_BATCHES;
    this.maxRecentEvents = options?.maxRecentEvents ?? DEFAULT_MAX_RECENT_EVENTS;
    this.title = options?.title ?? 'LIVE TRANSLATE ACTIVITY';
    this.createdAt = this.now();
  }

  setOverview(rows: TerminalRow[]): void {
    this.overview = [...rows];
  }

  registerBatches(batches: TranslateActivityBatchDescriptor[]): void {
    for (const batch of batches) {
      if (this.batches.has(batch.id)) continue;
      this.batches.set(batch.id, {
        ...batch,
        order: this.nextBatchOrder++,
        status: 'queued',
        retries: 0,
        updatedAt: this.now(),
      });
    }
  }

  startBatch(batchId: string): void {
    const batch = this.requireBatch(batchId);
    const now = this.now();
    batch.status = 'running';
    batch.startedAt ??= now;
    batch.updatedAt = now;
    batch.finishedAt = undefined;
    batch.error = undefined;
    batch.phase = 'awaiting response';
  }

  setBatchPhase(batchId: string, phase?: string): void {
    const batch = this.requireBatch(batchId);
    batch.phase = phase;
    batch.updatedAt = this.now();
  }

  recordRetry(batchId: string, attempt: number, message: string): void {
    const batch = this.requireBatch(batchId);
    batch.retries = Math.max(batch.retries, attempt);
    batch.updatedAt = this.now();
    batch.error = collapseText(message, DETAIL_LIMIT);
    this.pushEvent('warning', `${this.batchLabel(batch)} retry ${attempt} — ${collapseText(message, 72) ?? 'retry scheduled'}`);
  }

  recordSessionEvent(batchId: string, event: TranslationSessionActivityEvent): void {
    const batch = this.requireBatch(batchId);
    batch.updatedAt = this.now();

    switch (event.type) {
      case 'prompt_start':
        batch.responseMode = event.mode;
        batch.phase = 'awaiting response';
        return;
      case 'turn_start':
        return;
      case 'text_delta': {
        if (batch.responseMode === 'json') return;
        const preview = collapseText(event.text, PREVIEW_LIMIT);
        if (preview) {
          batch.preview = preview;
        }
        return;
      }
      case 'tool_start':
        batch.activeTool = event.toolName;
        batch.toolSummary = collapseText(event.summary ?? '', DETAIL_LIMIT);
        batch.phase = `tool ${event.toolName}`;
        return;
      case 'tool_update':
        batch.activeTool = event.toolName;
        if (event.summary) {
          batch.toolSummary = collapseText(event.summary, DETAIL_LIMIT);
        }
        batch.phase = `tool ${event.toolName}`;
        return;
      case 'tool_end':
        batch.activeTool = event.isError ? event.toolName : undefined;
        batch.toolSummary = collapseText(
          event.summary ?? (event.isError ? 'tool reported an error' : ''),
          DETAIL_LIMIT,
        );
        batch.phase = event.isError ? `tool ${event.toolName}` : 'response received';
        if (event.isError) {
          batch.error = batch.toolSummary;
        }
        return;
      case 'complete':
        batch.phase = 'validating';
        if (event.mode === 'text') {
          if (!batch.preview) {
            batch.preview = collapseText(event.text, PREVIEW_LIMIT);
          }
          return;
        }

        if (event.response && typeof event.response === 'object') {
          const translations = (event.response as { translations?: unknown }).translations;
          if (translations && typeof translations === 'object' && !Array.isArray(translations)) {
            const count = Object.keys(translations as Record<string, unknown>).length;
            batch.preview = count > 0 ? `${count} translations ready` : undefined;
          }
        }
        return;
      case 'error':
        batch.error = collapseText(event.message, DETAIL_LIMIT);
        return;
    }
  }

  finishBatch(batchId: string, ok: boolean, detail?: string): void {
    const batch = this.requireBatch(batchId);
    const now = this.now();
    batch.status = ok ? 'success' : 'failure';
    batch.finishedAt = now;
    batch.updatedAt = now;
    batch.activeTool = undefined;
    batch.phase = undefined;
    batch.toolSummary = detail ? collapseText(detail, DETAIL_LIMIT) : batch.toolSummary;
    if (!ok && detail) {
      batch.error = collapseText(detail, DETAIL_LIMIT);
    }

    const duration = batch.startedAt ? formatDuration(now - batch.startedAt) : '0s';
    const outcome = ok ? 'completed' : 'failed';
    const detailSuffix = detail ? ` — ${collapseText(detail, 72)}` : '';
    this.pushEvent(ok ? 'success' : 'failure', `${this.batchLabel(batch)} ${outcome} in ${duration}${detailSuffix}`);
  }

  finish(footer?: string): void {
    this.footer = footer;
  }

  snapshot(): TranslateActivitySnapshot {
    const totals = {
      total: this.batches.size,
      queued: 0,
      running: 0,
      success: 0,
      failure: 0,
    };

    for (const batch of this.batches.values()) {
      totals[batch.status]++;
    }

    const batches = [...this.batches.values()]
      .sort((left, right) => {
        const rank = (status: BatchStatus) => {
          switch (status) {
            case 'running':
              return 0;
            case 'failure':
              return 1;
            case 'success':
              return 2;
            case 'queued':
              return 3;
          }
        };

        const rankDiff = rank(left.status) - rank(right.status);
        if (rankDiff !== 0) return rankDiff;
        return left.order - right.order;
      })
      .slice(0, this.maxVisibleBatches)
      .map((batch) => ({
        id: batch.id,
        locale: batch.locale,
        batchIndex: batch.batchIndex,
        label: this.batchLabel(batch),
        status: batch.status,
        detail: this.describeBatch(batch),
        preview: batch.preview,
      }));

    return {
      title: this.title,
      overview: [...this.overview],
      totals,
      batches,
      recentEvents: [...this.recentEvents],
      footer: this.footer,
      elapsedMs: this.now() - this.createdAt,
    };
  }

  private batchLabel(batch: TranslateActivityBatchState): string {
    if (batch.label) return batch.label;
    const batchNumber = batch.totalLocaleBatches && batch.totalLocaleBatches > 1
      ? `${batch.batchIndex + 1}/${batch.totalLocaleBatches}`
      : String(batch.batchIndex + 1);
    return `${batch.locale} batch ${batchNumber}`;
  }

  private describeBatch(batch: TranslateActivityBatchState): string {
    const parts: string[] = [];

    if (batch.status === 'running') {
      parts.push(batch.phase ?? 'running');
    } else if (batch.status === 'queued') {
      parts.push('queued');
    } else if (batch.status === 'success') {
      parts.push('completed');
    } else {
      parts.push('failed');
    }

    if (batch.entryCount !== undefined) {
      parts.push(`${batch.entryCount} strings`);
    }

    const phaseAlreadyNamesTool = batch.activeTool
      && batch.phase === `tool ${batch.activeTool}`;
    if (batch.activeTool && !phaseAlreadyNamesTool) {
      parts.push(`tool ${batch.activeTool}`);
    }

    if (batch.toolSummary) {
      parts.push(batch.toolSummary);
    }

    if (batch.retries > 0) {
      parts.push(`${batch.retries} retr${batch.retries === 1 ? 'y' : 'ies'}`);
    }

    if (batch.status === 'failure' && batch.error) {
      parts.push(batch.error);
    }

    return collapseText(parts.join(' · '), DETAIL_LIMIT) ?? 'idle';
  }

  private pushEvent(tone: TerminalTone, message: string): void {
    this.recentEvents.push({ tone, message, at: this.now() });
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.splice(0, this.recentEvents.length - this.maxRecentEvents);
    }
  }

  private requireBatch(batchId: string): TranslateActivityBatchState {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Unknown translate activity batch: ${batchId}`);
    }
    return batch;
  }
}

class TranslateActivityView implements Component {
  constructor(
    private readonly model: TranslateActivityModel,
    private readonly options?: Pick<TranslateActivityOptions, 'decorated' | 'ascii' | 'activitySectionTitle' | 'idleActivityMessage'>,
  ) {}

  invalidate(): void {
    // The view is stateless; callers request re-renders explicitly.
  }

  render(width: number): string[] {
    const snapshot = this.model.snapshot();
    const theme = createTerminalTheme(this.options);
    const lines: string[] = [];
    const availableWidth = Math.max(40, width);

    const statusParts = [
      `${snapshot.totals.success}/${snapshot.totals.total} done`,
      `${snapshot.totals.running} running`,
      `${snapshot.totals.queued} queued`,
    ];
    if (snapshot.totals.failure > 0) {
      statusParts.push(`${snapshot.totals.failure} failed`);
    }
    statusParts.push(formatDuration(snapshot.elapsedMs));

    lines.push(theme.accentBold(`${theme.glyphs.header} ${snapshot.title}`));
    lines.push(`  ${theme.dim(statusParts.join('   '))}`);

    if (snapshot.overview.length > 0) {
      lines.push('');
      lines.push(theme.accent(`${theme.glyphs.section} Context`));
      const rowWidth = snapshot.overview.reduce((max, row) => Math.max(max, row.label.length), 12);
      for (const row of snapshot.overview) {
        lines.push(`  ${theme.dim(row.label.padEnd(rowWidth, ' '))} ${theme.tone(row.tone ?? 'muted', String(row.value))}`);
      }
    }

    lines.push('');
    lines.push(theme.accent(`${theme.glyphs.section} ${this.options?.activitySectionTitle ?? 'Batch activity'}`));
    if (snapshot.batches.length === 0) {
      lines.push(`  ${theme.dim(this.options?.idleActivityMessage ?? 'Waiting for translation batches to start…')}`);
    } else {
      for (const batch of snapshot.batches) {
        const statusSymbol = batch.status === 'running'
          ? theme.accent(theme.glyphs.header)
          : batch.status === 'success'
            ? theme.success(theme.glyphs.success)
            : batch.status === 'failure'
              ? theme.failure(theme.glyphs.failure)
              : theme.dim(theme.glyphs.bullet);
        lines.push(`  ${statusSymbol} ${theme.muted(batch.label)} ${theme.dim('—')} ${theme.dim(batch.detail)}`);
        if (batch.preview) {
          lines.push(`    ${theme.muted(truncatePlain(batch.preview, availableWidth - 4))}`);
        }
      }
    }

    lines.push('');
    lines.push(theme.accent(`${theme.glyphs.section} Notable events`));
    if (snapshot.recentEvents.length === 0) {
      lines.push(`  ${theme.dim('No notable events yet.')}`);
    } else {
      for (const event of snapshot.recentEvents) {
        lines.push(`  ${theme.glyphs.bullet} ${theme.tone(event.tone, truncatePlain(event.message, availableWidth - 4))}`);
      }
    }

    if (snapshot.footer) {
      lines.push('');
      lines.push(`  ${theme.dim(snapshot.footer)}`);
    }

    return lines;
  }
}

export function createTranslateActivityTui(
  controls: TranslateActivityRenderControls,
  options?: TranslateActivityOptions,
): TranslateActivityController {
  const model = new TranslateActivityModel(options);
  const root = new TranslateActivityView(model, options);

  const rerender = () => controls.requestRender(true);

  return {
    root,
    setOverview(rows) {
      model.setOverview(rows);
      rerender();
    },
    registerBatches(batches) {
      model.registerBatches(batches);
      rerender();
    },
    startBatch(batchId) {
      model.startBatch(batchId);
      rerender();
    },
    setBatchPhase(batchId, phase) {
      model.setBatchPhase(batchId, phase);
      rerender();
    },
    recordRetry(batchId, attempt, message) {
      model.recordRetry(batchId, attempt, message);
      rerender();
    },
    recordSessionEvent(batchId, event) {
      model.recordSessionEvent(batchId, event);
      rerender();
    },
    finishBatch(batchId, ok, detail) {
      model.finishBatch(batchId, ok, detail);
      rerender();
    },
    finish(footer) {
      model.finish(footer);
      rerender();
    },
    snapshot() {
      return model.snapshot();
    },
  };
}
