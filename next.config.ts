import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB, too small for image/media uploads (banner, chat media,
    // payment proofs, automation attachments) that go through Server Actions.
    serverActions: {
      bodySizeLimit: "200mb",
    },
    // src/proxy.ts runs on every non-static route (its matcher covers /api/*
    // and Server Action POSTs too), and Next.js buffers the whole request
    // body in the proxy layer with a 10MB default — silently truncating any
    // upload over that, which corrupts the multipart body and surfaces as
    // "Failed to parse body as FormData" server-side / a generic upload
    // error client-side. This must be >= nginx's client_max_body_size or
    // nginx would just reject bigger requests before this matters. Raised
    // to 200mb (from 25mb) because a raw phone video before transcoding is
    // routinely 80-200MB — the video gets compressed down to WhatsApp's
    // 16MB limit server-side (see video-transcode.ts), but the RAW upload
    // still needs to get through first.
    proxyClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
