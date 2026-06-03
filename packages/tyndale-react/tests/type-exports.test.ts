import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const PKG_ROOT = join(import.meta.dir, '..');
const TYPE_FIXTURE = join(import.meta.dir, '__fixtures__/translation-fn-type.ts');

describe('public type exports', () => {
  test('TranslationFn is usable from root and server entry points', async () => {
    const proc = Bun.spawn(
      [
        'bunx',
        'tsc',
        '--ignoreConfig',
        '--noEmit',
        '--module',
        'ESNext',
        '--moduleResolution',
        'bundler',
        '--target',
        'ESNext',
        '--jsx',
        'react-jsx',
        '--strict',
        '--skipLibCheck',
        '--types',
        'node,bun',
        TYPE_FIXTURE,
      ],
      { cwd: PKG_ROOT, stdout: 'pipe', stderr: 'pipe' },
    );

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode, `${stdout}${stderr}`).toBe(0);
  });
});
