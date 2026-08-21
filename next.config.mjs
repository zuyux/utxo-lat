/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  allowedDevOrigins: ["192.168.18.82"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
