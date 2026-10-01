/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "pg-cloudflare",
    "redis",
  ],
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
    ],
  },
  outputFileTracingExcludes: {
    "**/*": [
      "./node_modules/prisma/**",
      "./node_modules/@prisma/dev/**",
      "./node_modules/@prisma/engines/**",
      "./node_modules/@prisma/studio-core/**",
      "./node_modules/@electric-sql/pglite/**",
    ],
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
