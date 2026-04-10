import { useEffect } from 'react';

function upsertMeta(name, content) {
  if (typeof document === 'undefined') return null;
  const attr = name.startsWith('property:') ? 'property' : 'name';
  const key = name.replace(/^(property:|name:)/, '');
  let el = document.head.querySelector(`meta[${attr}="${CSS.escape(key)}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

function upsertCanonical(canonical) {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', canonical);
  return el;
}

export function useSeoMeta({
  title,
  description,
  canonical,
  robots = 'index,follow',
  ogType = 'website',
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previousTitle = document.title;
    document.title = title;

    const previousCanonical = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    const previousRobots = document.head.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    const previousDescription = document.head.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const previousOgTitle = document.head.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const previousOgDescription = document.head.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    const previousOgType = document.head.querySelector('meta[property="og:type"]')?.getAttribute('content') || '';
    const previousTwitterTitle = document.head.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '';
    const previousTwitterDescription = document.head.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '';

    upsertMeta('description', description);
    upsertMeta('robots', robots);
    upsertMeta('property:og:title', title);
    upsertMeta('property:og:description', description);
    upsertMeta('property:og:type', ogType);
    upsertMeta('name:twitter:title', title);
    upsertMeta('name:twitter:description', description);
    if (canonical) upsertCanonical(canonical);

    return () => {
      document.title = previousTitle;
      upsertMeta('description', previousDescription);
      upsertMeta('robots', previousRobots);
      upsertMeta('property:og:title', previousOgTitle);
      upsertMeta('property:og:description', previousOgDescription);
      upsertMeta('property:og:type', previousOgType);
      upsertMeta('name:twitter:title', previousTwitterTitle);
      upsertMeta('name:twitter:description', previousTwitterDescription);

      const currentCanonical = document.head.querySelector('link[rel="canonical"]');
      if (currentCanonical && previousCanonical) {
        currentCanonical.setAttribute('href', previousCanonical);
      } else if (currentCanonical && !previousCanonical) {
        currentCanonical.remove();
      }
    };
  }, [title, description, canonical, robots, ogType]);
}

export function useStructuredData(data, id = 'structured-data') {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previous = document.head.querySelector(`script[data-seo-id="${CSS.escape(id)}"]`);
    if (previous) previous.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-id', id);
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [data, id]);
}
