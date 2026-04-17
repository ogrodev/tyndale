import { describe, expect, it } from 'bun:test';
import { __testing__ } from '../../src/commands/translate-docs';

const { validateTranslatedAstro } = __testing__;

const SOURCE_ASTRO = `---
import Layout from '../layouts/Main.astro';
import Card from '../components/Card.astro';

const title = 'Welcome';
---
<Layout>
  <h1>Welcome to Tyndale</h1>
  <Card client:load title="Overview" />
  <p>Translate <strong>confidently</strong>.</p>
</Layout>
`;

const VALID_TRANSLATION = `---
import Layout from '../layouts/Main.astro';
import Card from '../components/Card.astro';

const title = 'Bienvenido';
---
<Layout>
  <h1>Bienvenido a Tyndale</h1>
  <Card client:load title="Resumen" />
  <p>Traduce <strong>con confianza</strong>.</p>
</Layout>
`;

describe('validateTranslatedAstro', () => {
  it('returns null for a valid Astro translation that preserves imports and directives', () => {
    expect(validateTranslatedAstro(VALID_TRANSLATION, SOURCE_ASTRO)).toBeNull();
  });

  it('rejects output missing the closing frontmatter fence', () => {
    const broken = `---
import Layout from '../layouts/Main.astro';
import Card from '../components/Card.astro';

const title = 'Bienvenido';
<Layout>
  <h1>Bienvenido</h1>
</Layout>
`;
    const err = validateTranslatedAstro(broken, SOURCE_ASTRO);
    expect(err).not.toBeNull();
    expect(err!.toLowerCase()).toContain('unclosed frontmatter');
  });

  it('rejects output missing an import from the source', () => {
    const missingImport = `---
import Layout from '../layouts/Main.astro';

const title = 'Bienvenido';
---
<Layout>
  <h1>Bienvenido a Tyndale</h1>
  <Card client:load title="Resumen" />
</Layout>
`;
    const err = validateTranslatedAstro(missingImport, SOURCE_ASTRO);
    expect(err).not.toBeNull();
    expect(err!).toContain('Missing import statement:');
    expect(err!).toContain("import Card from '../components/Card.astro';");
  });

  it('rejects output missing an Astro directive that was in the source', () => {
    const missingDirective = `---
import Layout from '../layouts/Main.astro';
import Card from '../components/Card.astro';

const title = 'Bienvenido';
---
<Layout>
  <h1>Bienvenido a Tyndale</h1>
  <Card title="Resumen" />
</Layout>
`;
    const err = validateTranslatedAstro(missingDirective, SOURCE_ASTRO);
    expect(err).not.toBeNull();
    expect(err!).toBe('Missing Astro directive: client:load');
  });

  it('rejects output wrapped in a code fence', () => {
    const fenced = '```astro\n' + VALID_TRANSLATION + '```\n';
    const err = validateTranslatedAstro(fenced, SOURCE_ASTRO);
    expect(err).not.toBeNull();
    expect(err!.toLowerCase()).toContain('code fence');
  });

  it('rejects output whose template body is empty', () => {
    const emptyBody = `---
import Layout from '../layouts/Main.astro';
import Card from '../components/Card.astro';

const title = 'Bienvenido';
---
`;
    const err = validateTranslatedAstro(emptyBody, SOURCE_ASTRO);
    expect(err).not.toBeNull();
    expect(err!.toLowerCase()).toContain('empty');
  });

  it('rejects output with content before the opening fence', () => {
    const prelude = `garbage before fence
---
import Layout from '../layouts/Main.astro';
import Card from '../components/Card.astro';

const title = 'Bienvenido';
---
<Layout><Card client:load /></Layout>
`;
    const err = validateTranslatedAstro(prelude, SOURCE_ASTRO);
    expect(err).not.toBeNull();
    expect(err!.toLowerCase()).toContain("content before opening");
  });
});
