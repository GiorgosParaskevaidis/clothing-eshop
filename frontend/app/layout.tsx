import type { Metadata } from 'next';
import { CartProvider, Footer, Header, SkipLink } from '@/components/cart';
import './globals.css';
import './application.css';
import { connection } from 'next/server';
import { LanguageProvider } from '@/lib/language';
import { serverLanguage, serverTranslator } from '@/lib/server-language';
export async function generateMetadata(): Promise<Metadata> {
  const t = await serverTranslator();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: { default: 'thesamenot — Drop 01', template: '%s — thesamenot' },
    description: t('Limited edition sweatshirts. Numbered pieces. Not the same. Not for everyone.'),
    icons: { icon: '/images/logo.png' },
    openGraph: {
      title: 'thesamenot — Drop 01',
      description: t('Limited edition sweatshirts. Numbered pieces. Never restocked.'),
      images: ['/images/hood_back.jpg'],
    },
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const language = await serverLanguage();
  return (
    <html lang={language}>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Fira+Sans:wght@400;500&family=Fira+Sans+Condensed:wght@600;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LanguageProvider initialLanguage={language}>
          <SkipLink />
          <CartProvider>
            <Header />
            {children}
            <Footer />
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
