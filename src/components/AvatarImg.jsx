import { resolveMediaUrl } from '../lib/media';

/**
 * Avatar image with optional crop positioning.
 * crop: { x: number (%), y: number (%), s: number (scale), r: number (aspect ratio w/h) } | null
 */
export default function AvatarImg({
  src,
  crop,
  cover = false,
  className = '',
  imgClassName = '',
  alt = '',
  style,
  imgStyle,
  ...imgProps
}) {
  if (!src) return null;

  const resolvedSrc = resolveMediaUrl(src);

  if (cover || !crop || !crop.r) {
    return <img src={resolvedSrc} alt={alt} referrerPolicy="no-referrer" draggable={false} className={`${className} ${imgClassName} object-cover`.trim()} style={imgStyle || style} {...imgProps} />;
  }

  const { x, y, s, r } = crop;
  const isLandscape = r >= 1;
  const w = isLandscape ? s * r * 100 : s * 100;
  const h = isLandscape ? s * 100 : (s / r) * 100;
  const left = 50 - (x / 100) * w;
  const top = 50 - (y / 100) * h;

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <img
        src={resolvedSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        draggable={false}
        className={imgClassName}
        style={{
          position: 'absolute',
          width: `${w}%`,
          height: `${h}%`,
          left: `${left}%`,
          top: `${top}%`,
          maxWidth: 'none',
          maxHeight: 'none',
          display: 'block',
          ...imgStyle,
        }}
        {...imgProps}
      />
    </div>
  );
}
