/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  allowedDevOrigins: ["192.168.18.82"],
  async redirects() {
    return [
      {
        source: "/a/:address",
        destination: "/address/:address",
        permanent: true,
      },
      {
        source: "/b/:identifier",
        destination: "/block/:identifier",
        permanent: true,
      },
    ]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
