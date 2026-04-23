import { describe, it, expect } from 'bun:test';
import { Writable } from 'node:stream';
import { drainStream, parseArgs, routeCommand } from '../src/cli';

class AsyncBufferedWritable extends Writable {
  constructor() {
    super({ highWaterMark: 64 * 1024 });
  }

  override _write(
    _chunk: string | Uint8Array,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    setTimeout(() => callback(), 5);
  }
}

describe('parseArgs', () => {
  it('parses subcommand from argv', () => {
    const result = parseArgs(['node', 'tyndale', 'extract']);
    expect(result.command).toBe('extract');
    expect(result.flags).toEqual({});
  });

  it('parses flags after subcommand', () => {
    const result = parseArgs(['node', 'tyndale', 'translate', '--locale', 'es', '--force']);
    expect(result.command).toBe('translate');
    expect(result.flags).toEqual({ locale: 'es', force: true });
  });

  it('returns help command when no subcommand given', () => {
    const result = parseArgs(['node', 'tyndale']);
    expect(result.command).toBe('help');
  });

  it('returns help for --help flag', () => {
    const result = parseArgs(['node', 'tyndale', '--help']);
    expect(result.command).toBe('help');
  });

  it('returns unknown command as-is', () => {
    const result = parseArgs(['node', 'tyndale', 'bogus']);
    expect(result.command).toBe('bogus');
  });
});

describe('routeCommand', () => {
  it('returns exit code 1 for unknown command', async () => {
    const result = await routeCommand('bogus', {});
    expect(result.exitCode).toBe(1);
  });

  it('returns exit code 0 for help', async () => {
    const result = await routeCommand('help', {});
    expect(result.exitCode).toBe(0);
  });
});

describe('drainStream', () => {
  it('flushes buffered writes even when backpressure never triggered', async () => {
    const stream = new AsyncBufferedWritable();
    const writeReturn = stream.write(Buffer.alloc(4096, 'a'));

    expect(writeReturn).toBe(true);
    expect(stream.writableLength).toBeGreaterThan(0);
    expect(stream.writableNeedDrain).toBe(false);

    let drainEventFired = false;
    const onDrain = () => {
      drainEventFired = true;
    };
    stream.on('drain', onDrain);

    await drainStream(stream);

    stream.off('drain', onDrain);
    expect(stream.writableLength).toBe(0);
    expect(drainEventFired).toBe(false);
    expect(stream.listenerCount('close')).toBe(0);
    expect(stream.listenerCount('error')).toBe(0);

    stream.destroy();
  });
});
