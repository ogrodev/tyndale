import type { DocsFrameworkId, DocsProvider } from '../types.js';
import { StarlightProvider } from './starlight.js';
import { DocusaurusProvider } from './docusaurus.js';
import { VitePressProvider } from './vitepress.js';
import { MkDocsProvider } from './mkdocs.js';
import { NextraProvider } from './nextra.js';

export { walkDir } from './walk.js';

const providers: Record<DocsFrameworkId, DocsProvider> = {
  starlight: new StarlightProvider(),
  docusaurus: new DocusaurusProvider(),
  vitepress: new VitePressProvider(),
  mkdocs: new MkDocsProvider(),
  nextra: new NextraProvider(),
};

export function getDocsProvider(framework: DocsFrameworkId): DocsProvider {
  return providers[framework];
}
