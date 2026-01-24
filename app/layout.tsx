import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Discortize - Monetize your Discord in seconds.",
  description: "Discortize makes it possible to launch your paid Discord community, to generate consistent income. Manage access, subscriptions, payments, affiliates — all done for you.",
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: "Discortize - Monetize your Discord in seconds.",
    description: "Launch paid Discord communities, manage subscriptions, automate access, accept payments, and grow recurring revenue.",
    url: 'https://discortize.com',
    siteName: 'Discortize',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Discortize Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Discortize - Monetize your Discord in seconds.",
    description: "Launch paid Discord communities, manage subscriptions, automate access, accept payments, and grow recurring revenue.",
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-JH0W21QV96"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-JH0W21QV96');
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
