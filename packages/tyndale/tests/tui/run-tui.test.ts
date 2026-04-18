import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

let terminalInstances: FakeProcessTerminal[] = [];
let tuiInstances: FakeTUI[] = [];

class FakeProcessTerminal {
  stopCalls = 0;
  clearScreenCalls = 0;

  constructor() {
    terminalInstances.push(this);
  }

  start(_onInput: (data: string) => void, _onResize: () => void): void {}
  stop(): void {
    this.stopCalls += 1;
  }
  clearScreen(): void {
    this.clearScreenCalls += 1;
  }
}

class FakeTUI {
  private listener?: (data: string) => { consume?: boolean; data?: string } | undefined;
  requestRenderCalls = 0;

  constructor(public terminal: FakeProcessTerminal) {
    tuiInstances.push(this);
  }

  addChild(_component: unknown): void {}
  start(): void {}
  setFocus(_component: unknown): void {}
  requestRender(_force?: boolean): void {
    this.requestRenderCalls += 1;
  }
  stop(): void {
    this.terminal.stop();
  }
  addInputListener(listener: (data: string) => { consume?: boolean; data?: string } | undefined): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) {
        this.listener = undefined;
      }
    };
  }

  emitInput(data: string) {
    return this.listener?.(data);
  }
}

class FakeContainer {}

mock.module('@mariozechner/pi-tui', () => ({
  ProcessTerminal: FakeProcessTerminal,
  TUI: FakeTUI,
  Container: FakeContainer,
  visibleWidth: (text: string) => text.length,
}));

describe('runTui', () => {
  const originalResume = process.stdin.resume;
  const originalKill = process.kill;

  beforeEach(() => {
    terminalInstances = [];
    tuiInstances = [];
  });

  afterEach(() => {
    process.stdin.resume = originalResume;
    process.kill = originalKill;
  });

  it('clears the screen on exit when requested', async () => {
    const resumeCalls: number[] = [];
    process.stdin.resume = (() => {
      resumeCalls.push(1);
      return process.stdin;
    }) as typeof process.stdin.resume;

    const { runTui } = await import('../../src/tui/run-tui');
    const result = await runTui<string>(({ resolve }) => {
      queueMicrotask(() => resolve('done'));
      return {
        invalidate() {},
        render() {
          return [];
        },
      };
    }, { clearOnExit: true });

    expect(result).toBe('done');
    expect(terminalInstances).toHaveLength(1);
    expect(terminalInstances[0].stopCalls).toBe(1);
    expect(terminalInstances[0].clearScreenCalls).toBe(1);
    expect(resumeCalls).toHaveLength(1);
  });

  it('treats raw ctrl-c input as SIGINT when rethrowSignals is enabled', async () => {
    const killCalls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      killCalls.push({ pid, signal: signal as NodeJS.Signals });
      return true;
    }) as typeof process.kill;

    const { runTui } = await import('../../src/tui/run-tui');
    const resultPromise = runTui<string>(() => ({
      invalidate() {},
      render() {
        return [];
      },
    }), { rethrowSignals: true });

    expect(tuiInstances).toHaveLength(1);
    const listenerResult = tuiInstances[0].emitInput('\u0003');
    const result = await resultPromise;
    await new Promise((resolve) => setImmediate(resolve));

    expect(listenerResult).toEqual({ consume: true });
    expect(result).toBeNull();
    expect(killCalls).toEqual([{ pid: process.pid, signal: 'SIGINT' }]);
  });

  it('re-renders on an interval while the TUI is active', async () => {
    const { runTui } = await import('../../src/tui/run-tui');
    const result = await runTui<string>(({ resolve }) => {
      setTimeout(() => resolve('done'), 35);
      return {
        invalidate() {},
        render() {
          return [];
        },
      };
    }, { renderIntervalMs: 10 });

    expect(result).toBe('done');
    expect(tuiInstances).toHaveLength(1);
    expect(tuiInstances[0].requestRenderCalls).toBeGreaterThanOrEqual(3);
  });
});
