import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Hogwarts Studio CRM', short_name: 'Hogwarts CRM', description: 'Production workflow management for Hogwarts Studio.', display: 'standalone', start_url: '/dashboard', background_color: '#0d141b', theme_color: '#0d141b' };
}
