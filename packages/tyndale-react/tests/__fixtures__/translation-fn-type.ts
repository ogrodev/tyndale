import { useTranslation, type TranslationFn, type TranslationVariables } from '../../src/index';
import { getTranslation, type TranslationFn as ServerTranslationFn } from '../../src/server';

const vars: TranslationVariables = { name: 'Ada', count: 2 };

declare const explicitTranslator: TranslationFn;

const clientTranslator: TranslationFn = useTranslation();

async function loadServerTranslator(): Promise<ServerTranslationFn> {
  return getTranslation({
    locale: 'en',
    defaultLocale: 'en',
    outputPath: './public/_tyndale',
  });
}

explicitTranslator('Hello, {name}', vars);
clientTranslator('Hello, {name}', vars);
void loadServerTranslator;
