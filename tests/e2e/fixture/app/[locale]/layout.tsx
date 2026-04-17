import { TyndaleServerProvider } from 'tyndale-next';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <TyndaleServerProvider locale={locale}>
      {children}
    </TyndaleServerProvider>
  );
}
