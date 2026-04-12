// packages/tyndale/tests/package-exports.test.ts
import { describe, it, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../..');

async function readPkg(pkgDir: string) {
  const raw = await readFile(join(ROOT, 'packages', pkgDir, 'package.json'), 'utf-8');
  return JSON.parse(raw);
}

describe('package.json exports', () => {
  it('tyndale-react has correct exports', async () => {
    const pkg = await readPkg('tyndale-react');
    expect(pkg.name).toBe('tyndale-react');
    expect(pkg.main).toBeDefined();
    expect(pkg.types).toBeDefined();
    expect(pkg.exports).toBeDefined();
    expect(pkg.exports['.']).toBeDefined();
    expect(pkg.exports['.'].import).toBeDefined();
    expect(pkg.exports['.'].types).toBeDefined();

    // Peer deps
    expect(pkg.peerDependencies?.react).toBeDefined();
  });

  it('tyndale-next has correct exports', async () => {
    const pkg = await readPkg('tyndale-next');
    expect(pkg.name).toBe('tyndale-next');
    expect(pkg.exports).toBeDefined();
    expect(pkg.exports['.']).toBeDefined();
    expect(pkg.exports['.'].import).toBeDefined();
    expect(pkg.exports['.'].types).toBeDefined();

    // Middleware subpath export
    expect(pkg.exports['./middleware']).toBeDefined();
    expect(pkg.exports['./middleware'].import).toBeDefined();
    expect(pkg.exports['./middleware'].types).toBeDefined();

    // Peer deps
    expect(pkg.peerDependencies?.next).toBeDefined();
    expect(pkg.peerDependencies?.react).toBeDefined();
    expect(pkg.dependencies?.['tyndale-react']).toBeDefined();
  });

  it('tyndale CLI has correct bin entry', async () => {
    const pkg = await readPkg('tyndale');
    expect(pkg.name).toBe('tyndale');
    expect(pkg.bin).toBeDefined();

    // bin can be a string or { tyndale: string }
    if (typeof pkg.bin === 'string') {
      expect(pkg.bin).toContain('cli');
    } else {
      expect(pkg.bin.tyndale).toBeDefined();
      expect(pkg.bin.tyndale).toContain('cli');
    }

    // Should have no exports for "." that conflict with bin
    expect(pkg.main).toBeDefined();
    expect(pkg.types).toBeDefined();
  });
});
