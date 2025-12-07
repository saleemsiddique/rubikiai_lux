import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'rubikiailux.lt',
          },
        ],
        destination: 'https://www.rubikiailux.lt/:path*',
        permanent: true, // 301 redirect
      },
    ];
  },
};

export default withNextIntl(nextConfig);
