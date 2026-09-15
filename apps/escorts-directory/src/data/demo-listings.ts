import type { EscortTier } from '../lib/tiers';

export type PublicListing = {
  slug: string;
  displayName: string;
  citySlug: string;
  cityName: string;
  tier: EscortTier;
  shortBio: string;
  photo: string;
};

// Local placeholders keep the starter fast and safe to deploy before approved media exists.
// Production data comes only from published D1 profiles and approved R2 derivatives.
export const demoListings: PublicListing[] = [
  { slug: 'perfil-demo-platino', displayName: 'Perfil destacado', citySlug: 'buenos-aires', cityName: 'Buenos Aires', tier: 'platinum', shortBio: 'Perfil de muestra para validar el diseño.', photo: '/placeholder-card.svg' },
  { slug: 'perfil-demo-oro', displayName: 'Perfil Oro', citySlug: 'buenos-aires', cityName: 'Buenos Aires', tier: 'gold', shortBio: 'Ejemplo de tarjeta de galería.', photo: '/placeholder-card.svg' },
  { slug: 'perfil-demo-plata', displayName: 'Perfil Plata', citySlug: 'cordoba', cityName: 'Córdoba', tier: 'silver', shortBio: 'Contenido de muestra sin perfil publicado.', photo: '/placeholder-card.svg' },
  { slug: 'perfil-demo-bronce', displayName: 'Perfil Bronce', citySlug: 'rosario', cityName: 'Rosario', tier: 'bronze', shortBio: 'La visibilidad se ordena por nivel y rotación.', photo: '/placeholder-card.svg' },
  { slug: 'perfil-demo-basico', displayName: 'Perfil Básico', citySlug: 'buenos-aires', cityName: 'Buenos Aires', tier: 'basic', shortBio: 'Los anuncios reales requieren aprobación manual.', photo: '/placeholder-card.svg' },
];

export const demoCities = [...new Map(demoListings.map((item) => [item.citySlug, item.cityName])).entries()]
  .map(([slug, name]) => ({ slug, name }));
