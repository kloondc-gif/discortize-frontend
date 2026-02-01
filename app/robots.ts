import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/verify-email/'],
      },
      {
        userAgent: '*',
        allow: ['/blogs/', '/blogs/*'],
      },
    ],
    sitemap: 'https://www.discortize.com/sitemap.xml',
  };
}
