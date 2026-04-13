import { createInterface } from 'readline';

/**
 * Reads a single line from stdin.
 * Uses Node's readline module which properly handles terminal state,
 * including after a TUI's ProcessTerminal has toggled raw mode.
 */
export function readLine(prompt?: string): Promise<string> {
  if (prompt) {
    process.stdout.write(prompt);
  }

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin });
    let resolved = false;

    rl.once('line', (line) => {
      if (resolved) return;
      resolved = true;
      rl.close();
      resolve(line);
    });

    rl.once('close', () => {
      if (resolved) return;
      resolved = true;
      resolve('');
    });
  });
}
