/**
 * @type {import('next').NextConfig}
 */
const withPWA = require("next-pwa")({
  dest: "public",
  mode: "production",
  disable: process.env.NODE_ENV !== "production",
  reloadOnOnline: false,
  cacheOnFrontEndNav: true,
});
const nextConfig = {
  /* config options here */
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
