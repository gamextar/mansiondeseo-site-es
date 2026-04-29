const PREFERRED_MIME = 'image/webp';
const FALLBACK_MIME = 'image/jpeg';

function imageExtension(mimeType) {
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/png') return 'png';
  return 'jpg';
}

export function buildOptimizedImageName(fileName, suffix = '', mimeType = PREFERRED_MIME) {
  const base = String(fileName || 'image')
    .replace(/\.[^.]+$/, '')
    .trim() || 'image';
  return `${base}${suffix}.${imageExtension(mimeType)}`;
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen.'))),
      mimeType,
      quality,
    );
  });
}

function useHighQualityResize(ctx) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}

let webpCanvasSupport;

function supportsCanvasWebp() {
  if (webpCanvasSupport !== undefined) return webpCanvasSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpCanvasSupport = canvas.toDataURL(PREFERRED_MIME).startsWith(`data:${PREFERRED_MIME}`);
  } catch {
    webpCanvasSupport = false;
  }
  return webpCanvasSupport;
}

function dataUrlToBlob(dataUrl, mimeType) {
  const [meta, data] = String(dataUrl || '').split(',');
  if (!meta || !data) throw new Error('No se pudo exportar la imagen.');

  const isBase64 = /;base64/i.test(meta);
  const binary = isBase64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function canvasToWebpBlob(canvas, quality) {
  const dataUrl = canvas.toDataURL(PREFERRED_MIME, quality);
  if (!dataUrl.startsWith(`data:${PREFERRED_MIME}`)) {
    throw new Error('El navegador no exportó WebP.');
  }
  return dataUrlToBlob(dataUrl, PREFERRED_MIME);
}

async function canvasToWasmWebpBlob(canvas, quality) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen para WebP.');

  const { default: encodeWebp } = await import('@jsquash/webp/encode');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const encoded = await encodeWebp(imageData, {
    quality: Math.round(Math.max(0, Math.min(1, quality)) * 100),
    method: 4,
    lossless: 0,
  });
  return new Blob([encoded], { type: PREFERRED_MIME });
}

export async function exportCanvasImage(canvas, {
  preferredMime = PREFERRED_MIME,
  quality = 0.86,
  fallbackMime = FALLBACK_MIME,
  fallbackQuality = 0.86,
} = {}) {
  if (preferredMime === PREFERRED_MIME) {
    try {
      if (supportsCanvasWebp()) return canvasToWebpBlob(canvas, quality);
      return await canvasToWasmWebpBlob(canvas, quality);
    } catch (err) {
      console.warn('WebP export failed, falling back to JPEG:', err);
    }
  }

  const preferredBlob = await canvasToBlob(canvas, preferredMime, quality);
  if (preferredBlob.type === preferredMime) return preferredBlob;

  const fallbackBlob = await canvasToBlob(canvas, fallbackMime, fallbackQuality);
  return fallbackBlob.type === fallbackMime ? fallbackBlob : preferredBlob;
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen.'));
    };
    image.src = url;
  });
}

export async function optimizePhotoFile(file, {
  maxSize = 1600,
  quality = 0.84,
  suffix = '',
} = {}) {
  if (!file || !String(file.type || '').startsWith('image/')) return file;

  const image = await loadImageFile(file);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo optimizar la imagen.');
  useHighQualityResize(ctx);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await exportCanvasImage(canvas, {
    quality,
    fallbackQuality: Math.min(0.9, quality + 0.02),
  });

  return new File([blob], buildOptimizedImageName(file.name, suffix, blob.type), {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export async function optimizeGalleryPhotoFile(file, {
  maxSize = 1800,
  thumbSize = 512,
  quality = 0.84,
  thumbQuality = 0.9,
} = {}) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    return { file, thumbnailFile: null };
  }

  const image = await loadImageFile(file);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo optimizar la imagen.');
  useHighQualityResize(ctx);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const thumbScale = Math.min(1, thumbSize / Math.max(width, height));
  const thumbWidth = Math.max(1, Math.round(width * thumbScale));
  const thumbHeight = Math.max(1, Math.round(height * thumbScale));
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbWidth;
  thumbCanvas.height = thumbHeight;

  const thumbCtx = thumbCanvas.getContext('2d');
  if (!thumbCtx) throw new Error('No se pudo optimizar la miniatura.');
  useHighQualityResize(thumbCtx);
  thumbCtx.fillStyle = '#000';
  thumbCtx.fillRect(0, 0, thumbWidth, thumbHeight);
  thumbCtx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);

  const [blob, thumbBlob] = await Promise.all([
    exportCanvasImage(canvas, {
      quality,
      fallbackQuality: Math.min(0.9, quality + 0.02),
    }),
    exportCanvasImage(thumbCanvas, {
      quality: thumbQuality,
      fallbackQuality: Math.min(0.92, thumbQuality + 0.02),
    }),
  ]);

  return {
    file: new File([blob], buildOptimizedImageName(file.name, '', blob.type), {
      type: blob.type,
      lastModified: Date.now(),
    }),
    thumbnailFile: new File([thumbBlob], buildOptimizedImageName(file.name, '-thumb', thumbBlob.type), {
      type: thumbBlob.type,
      lastModified: Date.now(),
    }),
  };
}

export async function optimizeChatAttachmentFile(file, {
  maxSize = 1800,
  thumbSize = 328,
  quality = 0.84,
  thumbQuality = 0.9,
} = {}) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    return { file, thumbnailFile: null };
  }

  const image = await loadImageFile(file);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo optimizar la imagen.');
  useHighQualityResize(ctx);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const cropSize = Math.min(width, height);
  const sourceX = Math.max(0, Math.round((width - cropSize) / 2));
  const sourceY = Math.max(0, Math.round((height - cropSize) / 2));
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbSize;
  thumbCanvas.height = thumbSize;

  const thumbCtx = thumbCanvas.getContext('2d');
  if (!thumbCtx) throw new Error('No se pudo optimizar la miniatura.');
  useHighQualityResize(thumbCtx);
  thumbCtx.fillStyle = '#000';
  thumbCtx.fillRect(0, 0, thumbSize, thumbSize);
  thumbCtx.drawImage(canvas, sourceX, sourceY, cropSize, cropSize, 0, 0, thumbSize, thumbSize);

  const [blob, thumbBlob] = await Promise.all([
    exportCanvasImage(canvas, {
      quality,
      fallbackQuality: Math.min(0.9, quality + 0.02),
    }),
    exportCanvasImage(thumbCanvas, {
      quality: thumbQuality,
      fallbackQuality: Math.min(0.92, thumbQuality + 0.02),
    }),
  ]);

  return {
    file: new File([blob], buildOptimizedImageName(file.name, '', blob.type), {
      type: blob.type,
      lastModified: Date.now(),
    }),
    thumbnailFile: new File([thumbBlob], buildOptimizedImageName(file.name, '-chat-thumb', thumbBlob.type), {
      type: thumbBlob.type,
      lastModified: Date.now(),
    }),
  };
}

export async function optimizeGalleryThumbnailFromUrl(url, {
  thumbSize = 512,
  quality = 0.9,
  fileName = 'gallery-thumb',
} = {}) {
  const response = await fetch(url, { mode: 'cors', cache: 'reload' });
  if (!response.ok) throw new Error('No se pudo descargar la foto.');
  const sourceBlob = await response.blob();
  const sourceFile = new File([sourceBlob], fileName, {
    type: sourceBlob.type || 'image/jpeg',
    lastModified: Date.now(),
  });
  const image = await loadImageFile(sourceFile);
  const scale = Math.min(1, thumbSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo generar la miniatura.');
  useHighQualityResize(ctx);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await exportCanvasImage(canvas, {
    quality,
    fallbackQuality: Math.min(0.92, quality + 0.02),
  });

  return new File([blob], buildOptimizedImageName(fileName, '-thumb', blob.type), {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export async function optimizeAvatarThumbnailFromUrl(url, {
  size = 480,
  quality = 0.78,
  fileName = 'avatar-thumb',
} = {}) {
  const response = await fetch(url, { mode: 'cors', cache: 'reload' });
  if (!response.ok) throw new Error('No se pudo descargar el avatar.');
  const sourceBlob = await response.blob();
  const sourceFile = new File([sourceBlob], fileName, {
    type: sourceBlob.type || 'image/jpeg',
    lastModified: Date.now(),
  });
  const image = await loadImageFile(sourceFile);
  const cropSize = Math.min(image.width, image.height);
  const srcX = Math.max(0, Math.round((image.width - cropSize) / 2));
  const srcY = Math.max(0, Math.round((image.height - cropSize) / 2));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo generar la miniatura del avatar.');
  useHighQualityResize(ctx);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, srcX, srcY, cropSize, cropSize, 0, 0, size, size);

  const blob = await exportCanvasImage(canvas, {
    quality,
    fallbackQuality: Math.min(0.86, quality + 0.04),
  });

  return new File([blob], buildOptimizedImageName(fileName, '-thumb', blob.type), {
    type: blob.type,
    lastModified: Date.now(),
  });
}
