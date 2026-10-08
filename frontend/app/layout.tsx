import type { Metadata } from 'next';
import { CartProvider,Footer,Header } from '@/components/cart';
import './globals.css';
import './application.css';
export const metadata:Metadata={
  metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000'),
  title:{default:'thesamenot — Drop 01',template:'%s — thesamenot'},
  description:'Limited edition sweatshirts. Numbered pieces. Not the same. Not for everyone.',
  icons:{icon:'/images/logo.png'},
  openGraph:{title:'thesamenot — Drop 01',description:'Limited edition sweatshirts. Numbered pieces. Never restocked.',images:['/images/hood_back.jpg']}
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Anton&family=Fira+Sans:wght@400;500&family=Fira+Sans+Condensed:wght@600;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/></head><body><a className="skip-link" href="#main-content">Skip to content</a><CartProvider><Header/>{children}<Footer/></CartProvider></body></html>;
}
