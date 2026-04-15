import type { DocsFrameworkId, DocsProvider } from '../types';
import { StarlightProvider } from './starlight';
import { DocusaurusProvider } from './docusaurus';
import { VitePressProvider } from './vitepress';
import { MkDocsProvider } from './mkdocs';
import { NextraProvider } from './nextra';

export { walkDir } from './walk';

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
