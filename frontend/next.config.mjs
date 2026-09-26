/** @type {import('next').NextConfig} */
// 后端地址：构建时用 NEXT_PUBLIC_BACKEND_URL 注入，本地默认 localhost:8001
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001";

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
