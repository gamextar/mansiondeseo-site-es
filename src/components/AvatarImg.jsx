/**
 * Avatar image with optional crop positioning.
 * crop: { x: number (%), y: number (%), s: number (scale) } | null
 */
export default function AvatarImg({ src, crop, className = '', alt = '' }) {
  if (!src) return null;

  const style = crop
    ? {
        objectFit: 'cover',
        objectPosition: `${crop.x}% ${crop.y}%`,
        transform: `scale(${crop.s})`,
        transformOrigin: `${crop.x}% ${crop.y}%`,
      }
    : undefined;

  return (
    <img
      src={src}
      alt={alt}
      className={`${className}${crop ? '' : ' object-cover'}`}
      style={style}
    />
  );
}
