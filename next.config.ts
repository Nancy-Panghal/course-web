import type { NextConfig } from "next";

const nextConfig: any = {
  /* config options here */
  eslint: {
    // Left true deliberately — see comment below. This is NOT the same
    // situation as typescript.ignoreBuildErrors: ESLint itself currently
    // crashes outright on this project (an eslint@9 / eslint-config-next
    // compatibility issue, unrelated to actual code quality), so setting
    // this to false would fail every build, not just flag real issues.
    // Needs a proper fix (upgrading/pinning the right eslint-config-next
    // + @eslint/eslintrc versions) before this can safely be turned off.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;