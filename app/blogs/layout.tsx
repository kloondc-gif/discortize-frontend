import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discord Monetization Blog | Discortize',
  description: 'Learn how to monetize your Discord community, build recurring revenue, and grow your subscription business with expert guides and tutorials.',
  alternates: {
    canonical: 'https://discortize.com/blogs',
  },
  openGraph: {
    title: 'Discord Monetization Blog | Discortize',
    description: 'Learn how to monetize your Discord community, build recurring revenue, and grow your subscription business.',
    url: 'https://discortize.com/blogs',
    siteName: 'Discortize',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discord Monetization Blog | Discortize',
    description: 'Learn how to monetize your Discord community, build recurring revenue, and grow your subscription business.',
  },
};

export default function BlogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
