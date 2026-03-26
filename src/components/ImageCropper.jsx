import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Check, X, Move } from 'lucide-react';

/**
 * Circular image cropper with drag + pinch/scroll zoom.
 * Accepts either a File (file prop) or a URL string (imageUrl prop).
 * Returns a cropped square File via onCrop(file).
 */
export default function ImageCropper({ file, imageUrl: externalUrl, onCrop, onCancel, cropSize = 400 }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Viewport size (the visible circle area in CSS px)
  const viewportSize = 280;

  useEffect(() => {
    if (externalUrl) {
      setImageUrl(externalUrl);
      return;
    }
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, externalUrl]);

  const handleImageLoad = useCallback((e) => {
    const { naturalWidth: w, naturalHeight: h } = e.target;
    setImgNatural({ w, h });
    // Fit so the shorter side fills the viewport
    const minDim = Math.min(w, h);
    const initialZoom = viewportSize / minDim;
    setZoom(initialZoom);
    // Center the image
    setOffset({
      x: (viewportSize - w * initialZoom) / 2,
      y: (viewportSize - h * initialZoom) / 2,
    });
  }, []);

  // Clamp offset so image always covers the viewport
  const clampOffset = useCallback((ox, oy, z) => {
    const scaledW = imgNatural.w * z;
    const scaledH = imgNatural.h * z;
    const maxX = 0;
    const minX = viewportSize - scaledW;
    const maxY = 0;
    const minY = viewportSize - scaledH;
    return {
      x: Math.min(maxX, Math.max(minX, ox)),
      y: Math.min(maxY, Math.max(minY, oy)),
    };
  }, [imgNatural]);

  // ── Mouse drag ──
  const onPointerDown = (e) => {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const nx = e.clientX - dragStart.x;
    const ny = e.clientY - dragStart.y;
    setOffset(clampOffset(nx, ny, zoom));
  };

  const onPointerUp = (e) => {
    setDragging(false);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  // ── Touch pinch zoom ──
  const lastTouchDist = useRef(null);

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && lastTouchDist.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / lastTouchDist.current;
      lastTouchDist.current = dist;

      setZoom((prev) => {
        const minZoom = viewportSize / Math.min(imgNatural.w, imgNatural.h);
        const newZ = Math.min(Math.max(prev * ratio, minZoom), minZoom * 5);
        // Re-center around viewport center
        const cx = viewportSize / 2;
        const cy = viewportSize / 2;
        const nx = cx - ((cx - offset.x) / prev) * newZ;
        const ny = cy - ((cy - offset.y) / prev) * newZ;
        setOffset(clampOffset(nx, ny, newZ));
        return newZ;
      });
    }
  };

  const onTouchEnd = () => {
    lastTouchDist.current = null;
  };

  // ── Scroll zoom ──
  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    setZoom((prev) => {
      const minZoom = viewportSize / Math.min(imgNatural.w, imgNatural.h);
      const newZ = Math.min(Math.max(prev * delta, minZoom), minZoom * 5);
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const nx = cx - ((cx - offset.x) / prev) * newZ;
      const ny = cy - ((cy - offset.y) / prev) * newZ;
      setOffset(clampOffset(nx, ny, newZ));
      return newZ;
    });
  };

  // ── Zoom buttons ──
  const adjustZoom = (direction) => {
    const factor = direction > 0 ? 1.15 : 0.87;
    setZoom((prev) => {
      const minZoom = viewportSize / Math.min(imgNatural.w, imgNatural.h);
      const newZ = Math.min(Math.max(prev * factor, minZoom), minZoom * 5);
      const cx = viewportSize / 2;
      const cy = viewportSize / 2;
      const nx = cx - ((cx - offset.x) / prev) * newZ;
      const ny = cy - ((cy - offset.y) / prev) * newZ;
      setOffset(clampOffset(nx, ny, newZ));
      return newZ;
    });
  };

  // ── Crop & output ──
  const handleCrop = () => {
    const canvas = document.createElement('canvas');
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext('2d');

    // Scale factor from viewport CSS px → output canvas px
    const scale = cropSize / viewportSize;

    // Source image coordinates
    const sx = -offset.x / zoom;
    const sy = -offset.y / zoom;
    const sWidth = viewportSize / zoom;
    const sHeight = viewportSize / zoom;

    ctx.drawImage(imgRef.current, sx, sy, sWidth, sHeight, 0, 0, cropSize, cropSize);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const croppedFile = new File([blob], file?.name || 'avatar.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          onCrop(croppedFile);
        }
      },
      'image/jpeg',
      0.9
    );
  };

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-white font-display text-lg font-bold">Ajustá tu foto</h3>
        <p className="text-white/50 text-xs flex items-center justify-center gap-1 mt-1">
          <Move className="w-3 h-3" /> Arrastrá para mover · Pellizcá para zoom
        </p>
      </div>

      {/* Crop viewport */}
      <div
        ref={containerRef}
        className="relative cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ width: viewportSize, height: viewportSize }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Image layer */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          crossOrigin="anonymous"
          onLoad={handleImageLoad}
          className="absolute pointer-events-none"
          style={{
            left: offset.x,
            top: offset.y,
            width: imgNatural.w * zoom,
            height: imgNatural.h * zoom,
            maxWidth: 'none',
          }}
          draggable={false}
        />

        {/* Circular mask overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            borderRadius: '50%',
          }}
        />

        {/* Circle border */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: '2px solid rgba(212, 175, 55, 0.6)',
          }}
        />
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-4 mt-4">
        <button
          type="button"
          onClick={() => adjustZoom(-1)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-mansion-gold rounded-full transition-all"
            style={{
              width: `${Math.min(((zoom / (viewportSize / Math.min(imgNatural.w || 1, imgNatural.h || 1))) - 1) / 4 * 100, 100)}%`,
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => adjustZoom(1)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleCrop}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-mansion-gold text-black text-sm font-bold hover:bg-mansion-gold-light transition-colors"
        >
          <Check className="w-4 h-4" />
          Confirmar
        </button>
      </div>
    </div>
  );
}
