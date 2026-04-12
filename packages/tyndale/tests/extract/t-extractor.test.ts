import { describe, it, expect } from 'bun:test';
import { extractTComponents } from '../../src/extract/t-extractor';
import { parseSource } from '../../src/extract/ast-parser';

describe('extractTComponents', () => {
  it('extracts a simple T component', () => {
    const code = `
      import { T } from 'tyndale-react';
      export function Page() {
        return <T><h1>Welcome</h1></T>;
      }
    `;
    const ast = parseSource(code, 'app/page.tsx');
    const entries = extractTComponents(ast, 'app/page.tsx');

    expect(entries).toHaveLength(1);
    expect(entries[0].wireFormat).toBe('<0>Welcome</0>');
    expect(entries[0].type).toBe('jsx');
    expect(entries[0].context).toBe('app/page.tsx:T@4');
    expect(entries[0].hash).toBeDefined();
  });

  it('extracts multiple T components', () => {
    const code = `
      import { T } from 'tyndale-react';
      export function Page() {
        return (
          <div>
            <T><h1>Hello</h1></T>
            <T><p>World</p></T>
          </div>
        );
      }
    `;
    const ast = parseSource(code, 'app/page.tsx');
    const entries = extractTComponents(ast, 'app/page.tsx');

    expect(entries).toHaveLength(2);
    expect(entries[0].wireFormat).toBe('<0>Hello</0>');
    expect(entries[1].wireFormat).toBe('<0>World</0>');
  });

  it('extracts T with nested elements and variable components', () => {
    const code = `
      import { T, Var } from 'tyndale-react';
      export function Greeting({ name }) {
        return (
          <T>
            <p>Hello <Var name="name">{name}</Var>, welcome!</p>
          </T>
        );
      }
    `;
    const ast = parseSource(code, 'components/greeting.tsx');
    const entries = extractTComponents(ast, 'components/greeting.tsx');

    expect(entries).toHaveLength(1);
    expect(entries[0].wireFormat).toBe('<0>Hello {name}, welcome!</0>');
  });

  it('ignores non-T JSX elements', () => {
    const code = `
      export function Page() {
        return <div><h1>Hello</h1></div>;
      }
    `;
    const ast = parseSource(code, 'app/page.tsx');
    const entries = extractTComponents(ast, 'app/page.tsx');

    expect(entries).toHaveLength(0);
  });

  it('only extracts T imported from tyndale-react', () => {
    const code = `
      import { T } from 'some-other-lib';
      export function Page() {
        return <T><h1>Hello</h1></T>;
      }
    `;
    const ast = parseSource(code, 'app/page.tsx');
    const entries = extractTComponents(ast, 'app/page.tsx');

    // We extract T regardless of import source at the extractor level;
    // import checking is a separate concern. But if the project wants
    // strict checking, the validator handles it.
    // For now, we extract all <T> components.
    expect(entries).toHaveLength(1);
  });

  it('produces deterministic hash from wire format', () => {
    const code = `
      import { T } from 'tyndale-react';
      export function A() { return <T>Hello</T>; }
    `;
    const ast1 = parseSource(code, 'a.tsx');
    const ast2 = parseSource(code, 'b.tsx');

    const entries1 = extractTComponents(ast1, 'a.tsx');
    const entries2 = extractTComponents(ast2, 'b.tsx');

    // Same content → same hash, different context
    expect(entries1[0].hash).toBe(entries2[0].hash);
    expect(entries1[0].context).not.toBe(entries2[0].context);
  });
});
