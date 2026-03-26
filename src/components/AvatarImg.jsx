/**
 * Avatar image with optional crop positioning.
 * crop: { x: number (%), y: number (%), s: number (scale), r: number (aspect ratio w/h) } | null
 */
export default function AvatarImg({ src, crop, className = '', alt = '' }) {
  if (!src) return null;

  if (!crop || !crop.r) {
    return <img src={src} alt={alt} className={`${className} object-cover`} />;
  }

  const { x, y, s, r } = crop;
  const isLandscape = r >= 1;
  const w = isLandscape ? s * r * 100 : s * 100;
  const h = isLandscape ? s * 100 : (s / r) * 100;
  const left = 50 - (x / 100) * w;
  const top = 50 - (y / 100) * h;

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      <img
        src={src}
        alt={alt}
        style={{
          position: 'absolute',
          width: `${w}%`,
          height: `${h}%`,
          left: `${left}%`,
          top: `${top}%`,
        }}
      />
    </div>
  );
}
