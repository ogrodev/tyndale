import { describe, it, expect } from 'bun:test';
import { parseArgs, routeCommand } from '../src/cli';

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
