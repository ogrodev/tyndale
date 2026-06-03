import { getTranslation } from 'tyndale-react/server';

export async function generateMetadata() {
  const t = await getTranslation({
    locale: 'fr',
    defaultLocale: 'en',
    outputPath: 'public/_tyndale',
  });

  return {
    title: t('Server metadata title'),
    description: t('Server metadata description'),
  };
}
