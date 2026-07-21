import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB, too small for image/media uploads (banner, chat media,
    // payment proofs, automation attachments) that go through Server Actions.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
