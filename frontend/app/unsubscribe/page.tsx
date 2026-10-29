import { NewsletterAction } from '@/components/newsletter-action';
export const metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default function Page() {
  return <NewsletterAction />;
}
