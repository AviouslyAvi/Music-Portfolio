import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/content/site';

const ROUTES = ['', '/work', '/services', '/premonition', '/about', '/contact'];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({ url: `${SITE_URL}${path}` }));
}
