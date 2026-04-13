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

/**
 * Runs a TUI component full-screen and returns a Promise that resolves
 * when the component signals completion via the provided `resolve` callback.
 *
 * Terminal raw mode is always restored — even on SIGINT or uncaught errors.
 */
export function runTui<T>(
  build: (resolve: (value: T | null) => void) => Component,
): Promise<T | null> {
  return new Promise((promiseResolve) => {
    const terminal = new ProcessTerminal();
    const tui = new TUI(terminal);

    let settled = false;
    const resolve = (value: T | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      tui.stop();
      // ProcessTerminal.stop() pauses stdin. Resume it so subsequent
      // readline/input operations (OAuth callbacks, API key prompt) work.
      process.stdin.resume();
      promiseResolve(value);
    };

    // Ensure terminal is restored on any exit path
    const onSignal = () => resolve(null);
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    function cleanup() {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
    }

    const root = build(resolve);
    tui.addChild(root);
    tui.start();
    tui.setFocus(root); // Route keyboard input to the root component
    tui.requestRender(true);
  });
}
