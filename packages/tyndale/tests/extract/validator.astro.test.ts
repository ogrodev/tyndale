import { describe, expect, it } from 'bun:test';
import { parseAstro } from '../../src/astro/parser';
import { validateTFromAstro } from '../../src/extract/validator';

async function validate(source: string, filename = 'v.astro') {
  const file = await parseAstro(source, filename);
  return validateTFromAstro(file.templateRoot, filename);
}

describe('validateTFromAstro', () => {
  it('accepts <T> with only text content', async () => {
    const errors = await validate('---\n---\n<T>Hello world</T>\n');
    expect(errors).toEqual([]);
  });

  it('flags <slot> inside <T>', async () => {
    const errors = await validate('---\n---\n<T>Hi <slot /></T>\n');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('<slot> is not supported inside <T>');
    expect(errors[0].line).toBe(3);
  });

  it('flags <Fragment> inside <T>', async () => {
    const errors = await validate('---\n---\n<T>Hi <Fragment>x</Fragment></T>\n');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('<Fragment> is not supported inside <T>');
  });

  it('flags <style> and <script> inside <T>', async () => {
    const errStyle = await validate('---\n---\n<T>Hi <style>.x{}</style></T>\n');
    expect(errStyle.map((e) => e.message)).toContain('<style> is not supported inside <T>');
    const errScript = await validate('---\n---\n<T>Hi <script>foo</script></T>\n');
    expect(errScript.map((e) => e.message)).toContain('<script> is not supported inside <T>');
  });

  it('flags non-literal expression inside <T>', async () => {
    const errors = await validate('---\n---\n<T>Hello {user}</T>\n');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Unwrapped dynamic content inside <T>');
    expect(errors[0].line).toBe(3);
  });

  it('accepts string-literal expression inside <T>', async () => {
    const errors = await validate(`---\n---\n<T>{'Static'}</T>\n`);
    expect(errors).toEqual([]);
  });

  it('flags missing `name` attribute on <Var>', async () => {
    const errors = await validate('---\n---\n<T><Var /></T>\n');
    expect(errors.map((e) => e.message)).toContain(
      '<Var> requires a literal string `name` attribute',
    );
  });

  it('flags malformed <Plural> (no count)', async () => {
    const errors = await validate('---\n---\n<T><Plural other="x" /></T>\n');
    expect(errors.map((e) => e.message)).toContain('<Plural> requires a `count` attribute');
  });

  it('allows expressions inside variable components (<Var>, <Num>, etc.)', async () => {
    const errors = await validate(
      '---\n---\n<T>Hi <Var name="user">{user}</Var> you have <Num value={n}>{n}</Num></T>\n',
    );
    expect(errors).toEqual([]);
  });
});
