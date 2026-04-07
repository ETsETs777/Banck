import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@spektors/chat-ui", "@spektors/api-client"],
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/globe.svg",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
