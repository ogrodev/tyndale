import { describe, it, expect } from 'bun:test';
import { parseSource } from '../../src/extract/ast-parser';

describe('parseSource', () => {
  it('parses a TSX file with JSX', () => {
    const code = `
      import { T } from 'tyndale-react';
      export function Page() {
        return <T><h1>Hello</h1></T>;
      }
    `;
    const ast = parseSource(code, 'page.tsx');
    expect(ast.type).toBe('File');
    expect(ast.program.body.length).toBeGreaterThan(0);
  });

  it('parses a plain TS file', () => {
    const code = `
      const x: number = 42;
      export function add(a: number, b: number): number {
        return a + b;
      }
    `;
    const ast = parseSource(code, 'utils.ts');
    expect(ast.type).toBe('File');
  });

  it('parses JSX file', () => {
    const code = `
      export function Button() {
        return <button onClick={() => alert('hi')}>Click</button>;
      }
    `;
    const ast = parseSource(code, 'button.jsx');
    expect(ast.type).toBe('File');
  });

  it('throws on invalid syntax', () => {
    const code = `const x = {{{;`;
    expect(() => parseSource(code, 'bad.ts')).toThrow();
  });
});
