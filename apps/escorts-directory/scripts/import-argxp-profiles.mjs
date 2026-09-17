import { execFileSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const limitArg = Number(process.argv.find((value) => value.startsWith('--limit='))?.split('=')[1] || 20);
const limit = Math.max(1, Math.min(100, Number.isFinite(limitArg) ? limitArg : 20));
const requestedProfile = process.argv.find((value) => value.startsWith('--profile='))?.split('=')[1] || '';
const dbName = 'escorts-directory-db';
const publicBucket = 'mansiondeseo-escorts-public';
const privateBucket = 'mansiondeseo-escorts-private';
const sourcePrefix = 'argxp-import-';

function sql(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

function run(args, options = {}) {
  return execFileSync('npx', ['wrangler', ...args], { cwd: root, encoding: 'utf8', ...options });
}

function parsePrice(text) {
  const match = String(text || '').match(/(\d[\d.,]*)\s*USD/i);
  if (!match) return 0;
  const value = Number(match[1].replace(/[.,]/g, ''));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function tierFor(price, text) {
  const upper = String(text || '').toUpperCase();
  if (price >= 1000 || upper.includes('DIAMOND')) return 'diamond';
  if (price >= 800 || upper.includes('PLATINUM')) return 'platinum';
  if (price >= 700 || upper.includes('SAPPHIRE')) return 'gold';
  if (price >= 600) return 'silver';
  if (price >= 500) return 'bronze';
  return 'basic';
}

function extensionFor(contentType) {
  if (/png/i.test(contentType)) return 'png';
  if (/jpeg|jpg/i.test(contentType)) return 'jpg';
  return 'webp';
}

function putR2(bucket, key, bytes, contentType, cacheControl) {
  const child = execFileSync('npx', [
    'wrangler', 'r2', 'object', 'put', `${bucket}/${key}`, '--pipe', '--remote', '-y',
    '--content-type', contentType, '--cache-control', cacheControl,
  ], { cwd: root, input: bytes, stdio: ['pipe', 'inherit', 'inherit'] });
  return child;
}

async function fetchImageAsBytes(page, source) {
  let captured = null;
  const handler = async (response) => {
    if (response.request().resourceType() !== 'image') return;
    const responseUrl = response.url();
    if (responseUrl !== source && !responseUrl.includes('imgproxy.argxp.com')) return;
    try {
      const bytes = await response.body();
      if (!captured || responseUrl === source) captured = { contentType: response.headers()['content-type'] || 'image/webp', bytes };
    } catch {}
  };
  page.on('response', handler);
  try {
    await page.reload({ waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(700);
  } finally {
    page.off('response', handler);
  }
  if (!captured) throw new Error(`No se pudo capturar la imagen ${source}`);
  return captured;
}

async function captureImages(page, sources) {
  const wanted = new Set(sources.map((source) => source.url));
  const captured = new Map();
  const pending = [];
  const handler = (response) => {
    if (!wanted.has(response.url()) || response.request().resourceType() !== 'image') return;
    pending.push((async () => {
      try {
        const bodyPromise = response.body();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 15000));
        const bytes = await Promise.race([bodyPromise, timeoutPromise]);
        if (!bytes) return;
        captured.set(response.url(), {
          contentType: response.headers()['content-type'] || 'image/webp',
          bytes,
        });
      } catch {}
    })());
  };
  page.on('response', handler);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.evaluate((urls) => {
      for (const url of urls) {
        const image = document.createElement('img');
        image.src = url;
        image.loading = 'eager';
        image.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;';
        document.body.appendChild(image);
      }
    }, [...wanted]);
    await page.waitForTimeout(3000);
    await Promise.allSettled(pending);
  } finally {
    page.off('response', handler);
  }
  return captured;
}

async function extractProfile(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(500);
  // El navegador reutilizado puede conservar abierto el visor de LightGallery
  // de la ficha anterior; cerrarlo evita que bloquee las pestañas del perfil.
  const galleryClose = page.locator('[role="dialog"] button[aria-label="Close gallery"]');
  if (await galleryClose.count()) await galleryClose.first().evaluate((element) => element.click()).catch(() => {});
  await page.waitForTimeout(150);
  const conocer = page.locator('button').filter({ hasText: 'Conocer más' });
  if (await conocer.count()) {
    await conocer.first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  // Las reseñas se encuentran en un panel con estado React; hay que activarlo
  // antes de leer el DOM y abrir el listado completo si está disponible.
  const reviewTab = page.getByRole('tab', { name: /reseñas/i });
  let reviewPanelId = '';
  if (await reviewTab.count()) {
    reviewPanelId = await reviewTab.first().getAttribute('aria-controls') || '';
    await reviewTab.first().click().catch(() => {});
    await page.waitForTimeout(350);
    // El botón tiene aria-label="Button" en el sitio de origen, por eso se
    // localiza por su texto visible y no por el nombre accesible.
    const moreReviews = page.locator('[role="tabpanel"][data-state="active"] button').filter({ hasText: /más reseñas/i });
    if (await moreReviews.count()) {
      await moreReviews.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  const data = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    let json = null;
    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || 'null');
        const candidate = Array.isArray(parsed) ? parsed.find((entry) => entry?.mainEntity) : parsed;
        if (candidate?.mainEntity) { json = candidate; break; }
      } catch {}
    }
    const entity = json?.mainEntity || {};
    const image = Array.isArray(entity.image) ? entity.image[0] : entity.image;
    const body = document.body?.innerText || '';
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const formatRichText = (node) => {
      if (!node) return '';
      const clone = node.cloneNode(true);
      clone.querySelectorAll('script,style').forEach((element) => element.remove());
      clone.querySelectorAll('br').forEach((element) => element.replaceWith('\n'));
      clone.querySelectorAll('div,p,li').forEach((element) => element.insertAdjacentText('afterend', '\n\n'));
      return String(clone.textContent || '')
        .replaceAll('\u00a0', ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };
    const attributes = {};
    for (const row of [...document.querySelectorAll('div.grid.grid-cols-2')]) {
      const cells = [...row.children].map((cell) => clean(cell.textContent));
      if (cells.length >= 2 && cells[0]) attributes[cells[0].replace(/:$/, '')] = cells.slice(1).join(' ').trim();
    }
    const availability = [...document.querySelectorAll('table')].map((table) => ({
      headers: [...table.querySelectorAll('thead th')].map((cell) => clean(cell.textContent)),
      rows: [...table.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('th,td')].map((cell) => clean(cell.textContent))),
    })).filter((table) => table.rows.length);
    const expandedBody = document.body?.innerText || body;
    const presentationHeading = [...document.querySelectorAll('h1,h2,h3,h4')]
      .find((heading) => /^presentación$/i.test(clean(heading.textContent)));
    const presentationNode = presentationHeading?.parentElement?.querySelector(':scope > .text-base') || presentationHeading?.parentElement;
    const presentation = formatRichText(presentationNode);
    const shortDescription = presentation.split(/\n\s*\n/).filter(Boolean).slice(0, 2).join('\n\n').slice(0, 700) || clean(entity.description);
    const locationReference = expandedBody.match(/Punto de referencia:\s*([^\n]+)/i)?.[1]?.trim() || '';
    const sectionLinks = (title) => {
      const heading = [...document.querySelectorAll('h2')].find((node) => clean(node.textContent) === title);
      return heading ? [...heading.parentElement.querySelectorAll('a')].map((node) => clean(node.textContent)).filter(Boolean) : [];
    };
    const mapLinks = [...document.querySelectorAll('a')].map((node) => ({ text: clean(node.textContent), href: node.href })).filter((item) => /map|street|como llegar|cómo llegar/i.test(`${item.text} ${item.href}`));
    const directionsUrl = mapLinks.find((item) => /como llegar|cómo llegar/i.test(item.text))?.href || '';
    const streetViewUrl = mapLinks.find((item) => /street view/i.test(item.text))?.href || '';
    const coordinates = (directionsUrl || streetViewUrl).match(/(?:q|viewpoint)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
    const photoUrls = [...document.images].flatMap((image) => [
      { url: image.currentSrc || image.src || '', naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight },
      ...(image.getAttribute('srcset') || '').split(',').map((candidate) => ({ url: candidate.trim().split(/\s+/)[0], naturalWidth: 0, naturalHeight: 0 })).filter((candidate) => candidate.url),
    ]);
    const photos = photoUrls.map(({ url, naturalWidth, naturalHeight }) => {
      const size = url.match(/rs:fill:(\d+):(\d+)/);
      // imgproxy splits the base64 source path into 16-character URL segments.
      const encoded = (url.split('/format:webp/')[1] || '').replaceAll('/', '');
      let original = encoded;
      try { original = atob(encoded.replace(/-/g, '+').replace(/_/g, '/')); } catch {}
      return { url, width: Number(size?.[1] || naturalWidth || 0), height: Number(size?.[2] || naturalHeight || 0), original };
    }).filter((photo) => photo.url.includes('imgproxy.argxp.com') && photo.url.includes('watermark_url:') && photo.width >= 300 && !/staticmaps/i.test(photo.original));
    const bestPhotos = new Map();
    for (const photo of photos) {
      const old = bestPhotos.get(photo.original);
      if (!old || photo.width * photo.height > old.width * old.height) bestPhotos.set(photo.original, photo);
    }
    const whatsapp = [...document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"], button')]
      .find((node) => /whatsapp/i.test(node.textContent || '') || /whatsapp|wa\.me/i.test(node.getAttribute('href') || ''));
    return {
      name: entity.name || document.querySelector('h1')?.textContent?.trim() || '',
      description: shortDescription,
      image: typeof image === 'string' ? image : '',
      city: entity.address?.addressLocality || '',
      body,
      details: {
        presentation, attributes,
        interests: sectionLinks('Intereses'), specialServices: sectionLinks('Servicios especiales'),
        availability, locationReference, expandedText: expandedBody,
        map: { directionsUrl, streetViewUrl, latitude: coordinates ? Number(coordinates[1]) : undefined, longitude: coordinates ? Number(coordinates[2]) : undefined },
      },
      reviews: [...document.querySelectorAll('[role="dialog"] div.py-5, [role="tabpanel"][data-state="active"] div.py-5')]
        .map((node) => ({
          authorName: clean(node.querySelector('h3')?.textContent),
          relativeDate: clean(node.querySelector('span')?.textContent),
          body: clean(node.querySelector('p')?.textContent),
        }))
        .filter((review) => review.authorName && review.body)
        .filter((review, index, all) => all.findIndex((candidate) => `${candidate.authorName}|${candidate.relativeDate}|${candidate.body}` === `${review.authorName}|${review.relativeDate}|${review.body}`) === index),
      photos: [...bestPhotos.values()],
      whatsappHref: whatsapp?.getAttribute('href') || '',
    };
  });
  const price = parsePrice(data.body);
  let contactUrl = data.whatsappHref || '';
  if (!contactUrl) {
    const before = new Set(page.context().pages());
    const button = page.getByRole('button', { name: /whatsapp/i }).last();
    if (await button.count()) {
      await button.click().catch(() => {});
      await page.waitForTimeout(500);
      const target = page.context().pages().find((candidate) => !before.has(candidate) && /whatsapp\.com/i.test(candidate.url()));
      contactUrl = target?.url() || '';
      await target?.close().catch(() => {});
    }
  }
  if (!data.image && !data.photos[0]?.url) throw new Error('No se encontró imagen');
  if (!data.name) throw new Error('No se encontró nombre');
  return { ...data, image: data.photos[0]?.url || data.image, sourceUrl, price, tier: tierFor(price, data.body), contactUrl };
}

const cleanup = requestedProfile ? [] : [
  `DELETE FROM escort_moderation_events WHERE profile_id LIKE ${sql(`${sourcePrefix}%`)};`,
  `DELETE FROM escort_reports WHERE profile_id LIKE ${sql(`${sourcePrefix}%`)};`,
  `DELETE FROM escort_promotions WHERE profile_id LIKE ${sql(`${sourcePrefix}%`)};`,
  `DELETE FROM escort_photos WHERE profile_id LIKE ${sql(`${sourcePrefix}%`)};`,
  `DELETE FROM escort_reviews WHERE profile_id LIKE ${sql(`${sourcePrefix}%`)};`,
  `DELETE FROM escort_profiles WHERE id LIKE ${sql(`${sourcePrefix}%`)};`,
  `DELETE FROM escort_accounts WHERE id LIKE ${sql(`${sourcePrefix}%`)};`,
];

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = context.pages().find((candidate) => candidate.url().startsWith('https://argxp.com/')) || await context.newPage();
const statements = [...cleanup];
try {
  await page.goto('https://argxp.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const links = await page.locator('a[href*="/ar-"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => new URL(node.getAttribute('href'), location.href).href))]);
  const urls = links.filter((url) => /^https:\/\/argxp\.com\/ar-[a-z0-9-]+$/i.test(url))
    .filter((url) => !requestedProfile || url.endsWith(`/${requestedProfile}`)).slice(0, limit);
  if (!urls.length) throw new Error('No se encontraron perfiles en la portada de ARGXP');
  console.log(`Perfiles encontrados: ${urls.length}. Importación autorizada en curso.`);
  for (const sourceUrl of urls) {
    try {
      const profile = await extractProfile(page, sourceUrl);
      const slug = `${slugify(profile.name)}-${slugify(profile.city) || 'argentina'}`;
      const profileId = `${sourcePrefix}${slug}`;
      const accountId = `${profileId}-account`;
      const photoId = `${profileId}-photo`;
      const promotionId = `${profileId}-promotion`;
      const eventId = `${profileId}-event`;
      if (requestedProfile) {
        statements.push(
          `DELETE FROM escort_moderation_events WHERE profile_id = ${sql(profileId)};`,
          `DELETE FROM escort_reports WHERE profile_id = ${sql(profileId)};`,
          `DELETE FROM escort_promotions WHERE profile_id = ${sql(profileId)};`,
          `DELETE FROM escort_photos WHERE profile_id = ${sql(profileId)};`,
          `DELETE FROM escort_reviews WHERE profile_id = ${sql(profileId)};`,
          `DELETE FROM escort_profiles WHERE id = ${sql(profileId)};`,
          `DELETE FROM escort_accounts WHERE id = ${sql(accountId)};`,
        );
      }
      const photoSources = profile.photos.length ? profile.photos : [{ url: profile.image, width: 696, height: 980 }];
      const captured = await captureImages(page, photoSources);
      const importedPhotos = [];
      for (let photoIndex = 0; photoIndex < photoSources.length; photoIndex += 1) {
        const source = photoSources[photoIndex];
        const image = captured.get(source.url) || (photoIndex === 0 ? await fetchImageAsBytes(page, source.url) : null);
        if (!image) { console.warn(`Foto omitida sin respuesta: ${source.url}`); continue; }
        const ext = extensionFor(image.contentType);
        const photoSlug = `${String(photoIndex + 1).padStart(2, '0')}`;
        const sourceKey = `source/argxp/${slug}/original-${photoSlug}.${ext}`;
        const cardKey = `profiles/argxp/${slug}/photo-${photoSlug}.${ext}`;
        putR2(privateBucket, sourceKey, image.bytes, image.contentType, 'private, max-age=0, no-cache');
        putR2(publicBucket, cardKey, image.bytes, image.contentType, 'public, max-age=31536000, immutable');
        importedPhotos.push({ sourceKey, cardKey, width: source.width || 696, height: source.height || 980, index: photoIndex });
      }
      if (!importedPhotos.length) throw new Error('No se pudo importar ninguna foto');
      const cardKey = importedPhotos[0].cardKey;
      const detailKey = importedPhotos[0].cardKey;
      const fallbackBio = `Perfil público de ${profile.name} en ${profile.city || 'Argentina'}. Contacto y disponibilidad a coordinar.`;
      statements.push(
        `INSERT INTO escort_accounts (id, email, password_hash, email_verified) VALUES (${sql(accountId)}, ${sql(`${slug}@imported.invalid`)}, 'imported:no-login', 1);`,
        `INSERT INTO escort_profiles (id, account_id, slug, display_name, city_slug, city_name, price_amount, currency, short_bio, details_json, contact_url, contact_label, status, review_note, reviewed_by, reviewed_at, published_at, is_demo) VALUES (${sql(profileId)}, ${sql(accountId)}, ${sql(slug)}, ${sql(profile.name)}, ${sql(slugify(profile.city) || 'argentina')}, ${sql(profile.city || 'Argentina')}, ${profile.price}, 'USD', ${sql(profile.description || fallbackBio)}, ${sql(JSON.stringify(profile.details))}, ${sql(profile.contactUrl)}, 'WhatsApp', 'published', ${sql(`Importado con autorización desde ${profile.sourceUrl}`)}, 'argxp-authorized-import', datetime('now'), datetime('now'), 0);`,
        ...importedPhotos.map((photo) => `INSERT INTO escort_photos (id, profile_id, source_key, card_key, detail_key, width, height, alt_text, sort_order, status, reviewed_at) VALUES (${sql(`${profileId}-photo-${photo.index + 1}`)}, ${sql(profileId)}, ${sql(photo.sourceKey)}, ${sql(photo.cardKey)}, ${sql(photo.cardKey)}, ${photo.width}, ${photo.height}, ${sql(`Foto ${photo.index + 1} de ${profile.name}, ${profile.city || 'Argentina'}`)}, ${photo.index}, 'approved', datetime('now'));`),
        `DELETE FROM escort_reviews WHERE profile_id = ${sql(profileId)};`,
        ...profile.reviews.map((review, reviewIndex) => `INSERT INTO escort_reviews (id, profile_id, author_name, relative_date, body, sort_order, source_url, status) VALUES (${sql(`${profileId}-review-${reviewIndex + 1}`)}, ${sql(profileId)}, ${sql(review.authorName)}, ${sql(review.relativeDate)}, ${sql(review.body)}, ${reviewIndex}, ${sql(profile.sourceUrl)}, 'approved');`),
        `INSERT INTO escort_promotions (id, profile_id, tier, status, rotation_seed) VALUES (${sql(promotionId)}, ${sql(profileId)}, ${sql(profile.tier)}, 'active', ${Math.floor(Math.random() * 100000)});`,
        `INSERT INTO escort_moderation_events (id, profile_id, actor_id, action, note) VALUES (${sql(eventId)}, ${sql(profileId)}, 'argxp-authorized-import', 'approved', ${sql(`Fuente autorizada: ${profile.sourceUrl}`)});`,
      );
      console.log(`OK ${profile.name} · ${profile.city || 'Argentina'} · ${profile.price || 'sin precio'} USD · ${profile.tier} · ${importedPhotos.length} fotos · ${Object.keys(profile.details.attributes).length} campos`);
    } catch (error) {
      console.warn(`OMITIDO ${sourceUrl}: ${error.message}`);
    }
  }
  const sqlPath = path.join(root, '.tmp-import-argxp.sql');
  writeFileSync(sqlPath, `${statements.join('\n')}\n`);
  try {
    run(['d1', 'execute', dbName, '--remote', '--file', sqlPath], { stdio: 'inherit' });
  } finally {
    try { unlinkSync(sqlPath); } catch {}
  }
} finally {
  await browser.close();
}

console.log('Importación terminada. Las fichas quedan públicas en staging y excluidas de Google por STAGING_NO_INDEX.');
