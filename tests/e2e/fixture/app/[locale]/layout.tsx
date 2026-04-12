import { TyndaleServerProvider } from 'tyndale-next';

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <TyndaleServerProvider locale={params.locale}>
      {children}
    </TyndaleServerProvider>
  );
}
