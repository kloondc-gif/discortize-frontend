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
  description: "Accept Bitcoin, Ethereum, Litecoin, and Solana payments on Discord. Automate subscriptions, role management, and access control for your crypto community. Start earning in minutes.",
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: "Discortize - Monetize your Discord in seconds.",
    description: "Accept Bitcoin, Ethereum, Litecoin, and Solana payments on Discord. Automate subscriptions, role management, and access control. Built for crypto communities.",
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
    description: "Accept Bitcoin, Ethereum, Litecoin, and Solana payments on Discord. Automate subscriptions, role management, and access control. Built for crypto communities.",
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
          suppressHydrationWarning
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
