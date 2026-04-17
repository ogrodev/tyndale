import { describe, expect, it } from 'bun:test';
import type { TagLikeNode } from '@astrojs/compiler/types';
import { parseAstro } from '../../src/astro/parser';
import { serializeAstroT } from '../../src/astro/serializer';
import { parseSource } from '../../src/extract/ast-parser';
import { serializeJSXToWireFormat } from '../../src/extract/jsx-serializer';
import type { JSXElement, File as BabelFile } from '@babel/types';

async function serializeFirstT(source: string) {
  const file = await parseAstro(source, 'test.astro');
  const t = findFirstT(file.templateRoot as unknown as { children: unknown[] });
  if (!t) throw new Error('no <T> in fixture');
  return serializeAstroT(t);
}

function findFirstT(node: { type?: string; name?: string; children?: unknown[] }): TagLikeNode | null {
  if ((node.type === 'component' || node.type === 'element') && node.name === 'T') {
    return node as unknown as TagLikeNode;
  }
  for (const child of (node.children ?? []) as Array<{ type?: string; name?: string; children?: unknown[] }>) {
    const found = findFirstT(child);
    if (found) return found;
  }
  return null;
}

function serializeJSXFirstT(code: string): string {
  const ast: BabelFile = parseSource(code, 'test.tsx');
  let target: JSXElement | null = null;
  function walk(node: any) {
    if (!node) return;
    if (node.type === 'JSXElement') {
      const name = node.openingElement.name;
      if (name.type === 'JSXIdentifier' && name.name === 'T' && !target) {
        target = node;
        return;
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'tokens' || key === 'comments') continue;
      const val = (node as any)[key];
      if (Array.isArray(val)) val.forEach(walk);
      else if (val && typeof val === 'object' && val.type) walk(val);
    }
  }
  walk(ast);
  if (!target) throw new Error('no <T> in JSX fixture');
  return serializeJSXToWireFormat(target);
}

describe('serializeAstroT — spec mapping rows', () => {
  it('text: returns normalized text', async () => {
    const { wire, errors } = await serializeFirstT('---\n---\n<T>Hello world</T>\n');
    expect(wire).toBe('Hello world');
    expect(errors).toEqual([]);
  });

  it('expression: string literal emits escaped text', async () => {
    const { wire, errors } = await serializeFirstT(`---\n---\n<T>{'Bonjour'}</T>\n`);
    expect(wire).toBe('Bonjour');
    expect(errors).toEqual([]);
  });

  it('expression: non-literal pushes error and emits nothing for that child', async () => {
    const { wire, errors } = await serializeFirstT('---\n---\n<T>Hello {user}</T>\n');
    expect(wire).toBe('Hello');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('non-literal expression in <T>');
  });

  it('<Var name="..."> emits {name} placeholder', async () => {
    const { wire, errors } = await serializeFirstT(
      '---\n---\n<T>Hi <Var name="user">{user}</Var></T>\n',
    );
    expect(wire).toBe('Hi {user}');
    expect(errors).toEqual([]);
  });

  it('<Num value={count}> emits {count} placeholder', async () => {
    const { wire, errors } = await serializeFirstT(
      '---\n---\n<T>You have <Num value={count}>{count}</Num> items</T>\n',
    );
    expect(wire).toBe('You have {count} items');
    expect(errors).toEqual([]);
  });

  it('<Plural count={n} one="..." other="..."> emits ICU plural', async () => {
    const { wire, errors } = await serializeFirstT(
      '---\n---\n<T><Plural count={n} one="1 item" other="# items" /></T>\n',
    );
    expect(wire).toBe('{plural, n, one {1 item} other {# items}}');
    expect(errors).toEqual([]);
  });

  it('nested HTML emits indexed tag wrappers', async () => {
    const { wire, errors } = await serializeFirstT(
      '---\n---\n<T>Click <strong>here</strong> please</T>\n',
    );
    expect(wire).toBe('Click <0>here</0> please');
    expect(errors).toEqual([]);
  });

  it('<slot> inside <T> pushes an error', async () => {
    const { errors } = await serializeFirstT(
      '---\n---\n<T>Before <slot /> after</T>\n',
    );
    expect(errors.map((e) => e.message)).toContain('<slot> is not supported inside <T>');
  });

  it('<Fragment> inside <T> pushes an error', async () => {
    const { errors } = await serializeFirstT(
      '---\n---\n<T>Before <Fragment>hi</Fragment> after</T>\n',
    );
    expect(errors.map((e) => e.message)).toContain('<Fragment> is not supported inside <T>');
  });

  it('<style> inside <T> pushes an error', async () => {
    const { errors } = await serializeFirstT(
      '---\n---\n<T>Before <style>.x{}</style> after</T>\n',
    );
    expect(errors.map((e) => e.message)).toContain('<style> is not supported inside <T>');
  });

  it('<script> inside <T> pushes an error', async () => {
    const { errors } = await serializeFirstT(
      '---\n---\n<T>Before <script>foo</script> after</T>\n',
    );
    expect(errors.map((e) => e.message)).toContain('<script> is not supported inside <T>');
  });
});

describe('serializeAstroT — JSX parity', () => {
  const PARITY_CASES: Array<{ name: string; astroT: string; jsxCode: string; expect: string }> = [
    {
      name: 'plain text',
      astroT: '<T>Hello world</T>',
      jsxCode: 'const x = <T>Hello world</T>;',
      expect: 'Hello world',
    },
    {
      name: 'string literal expression',
      astroT: `<T>{'Bonjour'}</T>`,
      jsxCode: `const x = <T>{'Bonjour'}</T>;`,
      expect: 'Bonjour',
    },
    {
      name: '<Var>',
      astroT: '<T>Hi <Var name="user">{user}</Var></T>',
      jsxCode: 'const x = <T>Hi <Var name="user">{user}</Var></T>;',
      expect: 'Hi {user}',
    },
    {
      name: '<Num>',
      astroT: '<T>You have <Num value={count}>{count}</Num> items</T>',
      jsxCode: 'const x = <T>You have <Num value={count}>{count}</Num> items</T>;',
      expect: 'You have {count} items',
    },
    {
      name: '<Plural>',
      astroT: '<T><Plural count={n} one="1 item" other="# items" /></T>',
      jsxCode: 'const x = <T><Plural count={n} one="1 item" other="# items" /></T>;',
      expect: '{plural, n, one {1 item} other {# items}}',
    },
    {
      name: 'nested HTML',
      astroT: '<T>Click <strong>here</strong> please</T>',
      jsxCode: 'const x = <T>Click <strong>here</strong> please</T>;',
      expect: 'Click <0>here</0> please',
    },
  ];

  for (const tc of PARITY_CASES) {
    it(`${tc.name}: Astro wire matches JSX wire`, async () => {
      const { wire: astroWire } = await serializeFirstT(`---\n---\n${tc.astroT}\n`);
      const jsxWire = serializeJSXFirstT(tc.jsxCode);
      expect(astroWire).toBe(tc.expect);
      expect(jsxWire).toBe(tc.expect);
      expect(astroWire).toBe(jsxWire);
    });
  }
});
