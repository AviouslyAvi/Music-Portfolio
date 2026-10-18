/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: '/contact.html', destination: '/contact', permanent: true }];
  },
};

export default nextConfig;
