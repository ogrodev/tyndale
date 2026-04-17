import { test, expect } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPortability, formatIssues } from '../../../tests/portability/lib';

const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('tyndale: source + dist are portable across Node and Bun', async () => {
  const issues = await checkPortability({
    packageRoot: PKG_ROOT,
    binFile: 'dist/cli.js',
  });
  expect(issues, formatIssues(issues)).toEqual([]);
});
