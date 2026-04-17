import { test, expect } from 'bun:test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPortability, formatIssues } from '../../../tests/portability/lib';

const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('tyndale-react: source + dist are portable across Node and Bun', async () => {
  // No bin file for libraries — shebang check is skipped.
  const issues = await checkPortability({ packageRoot: PKG_ROOT });
  expect(issues, formatIssues(issues)).toEqual([]);
});
