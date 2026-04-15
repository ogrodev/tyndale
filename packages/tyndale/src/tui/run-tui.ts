// packages/tyndale/src/tui/run-tui.ts

import { ProcessTerminal, TUI, Container, type Component } from '@mariozechner/pi-tui';

/**
 * A Container that receives keyboard input via the TUI focus system.
 */
export class InteractiveContainer extends Container {
  handleInput(_data: string): void {
    // Override at instance level
  }
}

export interface RunTuiControls<T> {
  resolve(value: T | null): void;
  requestRender(force?: boolean): void;
}

export interface RunTuiOptions {
  /**
   * Clear the screen after the TUI exits so any follow-up console output starts
   * from a clean terminal instead of appending below the last rendered frame.
   */
  clearOnExit?: boolean;
  /**
   * Restore the terminal and then re-emit SIGINT/SIGTERM so the process exits
   * with the original signal. Use this for long-running screens that should not
   * swallow cancellation.
   */
  rethrowSignals?: boolean;
  /**
   * Request a redraw on an interval while the TUI is running. Useful for live
   * dashboards whose visible state (elapsed time, spinners) should continue to
   * advance even when no new events arrive.
   */
  renderIntervalMs?: number;
}

/**
 * Runs a TUI component full-screen and returns a Promise that resolves
 * when the component signals completion via the provided controls.
 *
 * Terminal raw mode is always restored — even on SIGINT or uncaught errors.
 */
export function runTui<T>(
  build: (controls: RunTuiControls<T>) => Component,
  options?: RunTuiOptions,
): Promise<T | null> {
  return new Promise((promiseResolve) => {
    const terminal = new ProcessTerminal();
    const tui = new TUI(terminal);

    let settled = false;
    let removeInterruptListener: (() => void) | undefined;
    let renderInterval: ReturnType<typeof setInterval> | undefined;

    const cleanup = () => {
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
      removeInterruptListener?.();
      removeInterruptListener = undefined;
      if (renderInterval) {
        clearInterval(renderInterval);
        renderInterval = undefined;
      }
    };

    const settle = (value: T | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      tui.stop();
      if (options?.clearOnExit) {
        terminal.clearScreen();
      }
      // ProcessTerminal.stop() pauses stdin. Resume it so subsequent
      // readline/input operations (OAuth callbacks, API key prompt) work.
      process.stdin.resume();
      promiseResolve(value);
    };

    const handleSignal = (signal: NodeJS.Signals) => {
      settle(null);
      if (options?.rethrowSignals) {
        setImmediate(() => process.kill(process.pid, signal));
      }
    };

    const onSigint = () => handleSignal('SIGINT');
    const onSigterm = () => handleSignal('SIGTERM');
    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);

    if (options?.rethrowSignals) {
      removeInterruptListener = tui.addInputListener((data) => {
        if (data === '\u0003') {
          handleSignal('SIGINT');
          return { consume: true };
        }
        return undefined;
      });
    }

    const root = build({
      resolve: settle,
      requestRender: (force?: boolean) => tui.requestRender(force),
    });
    tui.addChild(root);
    tui.start();
    tui.setFocus(root); // Route keyboard input to the root component
    tui.requestRender(true);

    const renderIntervalMs = options?.renderIntervalMs ?? 0;
    if (renderIntervalMs > 0) {
      renderInterval = setInterval(() => {
        if (!settled) {
          tui.requestRender(false);
        }
      }, renderIntervalMs);
    }
  });
}