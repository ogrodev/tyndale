import { describe, expect, it } from 'bun:test';
import { __testing__ } from '../../src/commands/translate-docs';

const { buildDocTranslationPrompt, buildDocCorrectionPrompt } = __testing__;

const SAMPLE_ASTRO = `---
import Layout from '../layouts/Main.astro';
---
<Layout>
  <h1>Hello</h1>
</Layout>
`;

const SAMPLE_MDX = `---
title: Getting started
---
# Hello
`;

const BROKEN = `# [es] Hola`;

describe('buildDocTranslationPrompt', () => {
  it('.astro branch mentions Astro page, directive prefixes, translatable attributes, and no-code-fence rule', () => {
    const prompt = buildDocTranslationPrompt(
      SAMPLE_ASTRO,
      'Spanish',
      'es',
      'src/content/docs/intro.astro',
      '.astro',
    );

    // file-type marker
    expect(prompt).toContain('Astro page');

    // directive prefixes
    expect(prompt).toContain('client:');
    expect(prompt).toContain('server:');
    expect(prompt).toContain('set:html');
    expect(prompt).toContain('is:raw');
    expect(prompt).toContain('define:vars');
    expect(prompt).toContain('class:list');

    // translatable attributes
    expect(prompt).toContain('alt=');
    expect(prompt).toContain('title=');
    expect(prompt).toContain('aria-label=');
    expect(prompt).toContain('aria-description=');

    // no-code-fence rule (case-insensitive)
    expect(/do not wrap|no code fence/i.test(prompt)).toBe(true);

    // source content must be embedded
    expect(prompt).toContain(SAMPLE_ASTRO);

    // language + locale
    expect(prompt).toContain('Spanish');
    expect(prompt).toContain('es');
    expect(prompt).toContain('src/content/docs/intro.astro');
  });

  it('.md / .mdx branches remain byte-identical to each other and do not claim Astro-specific behavior', () => {
    const mdPrompt = buildDocTranslationPrompt(
      SAMPLE_MDX,
      'Spanish',
      'es',
      'src/content/docs/intro.md',
      '.md',
    );
    const mdxPrompt = buildDocTranslationPrompt(
      SAMPLE_MDX,
      'Spanish',
      'es',
      'src/content/docs/intro.mdx',
      '.mdx',
    );

    // Same path when only ext changes between .md and .mdx on same content.
    // Rebuild md-style prompt with matching filePath to isolate ext effect.
    const mdPromptB = buildDocTranslationPrompt(
      SAMPLE_MDX,
      'Spanish',
      'es',
      'src/content/docs/intro.mdx',
      '.md',
    );
    expect(mdxPrompt).toBe(mdPromptB);

    // Shape contract: mentions MDX and omits Astro-only directive tokens verbatim.
    expect(mdPrompt).toContain('MDX');
    expect(mdPrompt).not.toContain('client:');
    expect(mdPrompt).not.toContain('set:html');
  });
});

describe('buildDocCorrectionPrompt', () => {
  it('.astro branch mentions validation error and Astro-specific rules', () => {
    const prompt = buildDocCorrectionPrompt(
      SAMPLE_ASTRO,
      BROKEN,
      'Missing Astro directive: client:load',
      'Spanish',
      'es',
      'src/content/docs/intro.astro',
      '.astro',
    );

    expect(prompt.toLowerCase()).toContain('validation error');
    expect(prompt).toContain('Astro page');
    expect(prompt).toContain('client:');
    expect(prompt).toContain('server:');
    expect(prompt).toContain('set:html');
    expect(prompt).toContain('is:raw');
    expect(prompt).toContain('define:vars');
    expect(prompt).toContain('class:list');
    expect(prompt).toContain('alt=');
    expect(prompt).toContain('title=');
    expect(prompt).toContain('aria-label=');
    expect(prompt).toContain('aria-description=');
    expect(/do not wrap|no code fence/i.test(prompt)).toBe(true);

    // Context fields embedded
    expect(prompt).toContain(BROKEN);
    expect(prompt).toContain(SAMPLE_ASTRO);
    expect(prompt).toContain('Missing Astro directive: client:load');
  });

  it('.md / .mdx branches preserve MDX behavior and do not emit Astro-only phrases', () => {
    const mdPrompt = buildDocCorrectionPrompt(
      SAMPLE_MDX,
      BROKEN,
      'Missing frontmatter',
      'Spanish',
      'es',
      'src/content/docs/intro.md',
      '.md',
    );
    const mdxPrompt = buildDocCorrectionPrompt(
      SAMPLE_MDX,
      BROKEN,
      'Missing frontmatter',
      'Spanish',
      'es',
      'src/content/docs/intro.md',
      '.mdx',
    );
    expect(mdxPrompt).toBe(mdPrompt);

    expect(mdPrompt).toContain('MDX');
    expect(mdPrompt).not.toContain('client:');
    expect(mdPrompt).not.toContain('set:html');
  });
});
