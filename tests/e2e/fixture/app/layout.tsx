import { headers } from 'next/headers';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Tyndale's middleware sets `x-tyndale-locale` on every matched request so
  // the root layout (which doesn't receive route params) can still declare the
  // correct `<html lang>`. Falling back to the configured default keeps the
  // markup valid on any un-matched path (error pages, etc).
  const h = await headers();
  const locale = h.get('x-tyndale-locale') ?? process.env.TYNDALE_DEFAULT_LOCALE ?? 'en';
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
