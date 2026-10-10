const { IMAGE_HOSTNAMES } = require("./src/lib/imageHosts.cjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: IMAGE_HOSTNAMES.map((hostname) => ({ protocol: "https", hostname })),
  },
};

module.exports = nextConfig;
