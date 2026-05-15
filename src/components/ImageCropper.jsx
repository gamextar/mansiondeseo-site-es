import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { buildOptimizedImageName, exportCanvasImage } from '../lib/imageOptimize';

const DEFAULT_CIRCLE_SIZE = 280;
const OUTPUT_SIZE = 1080;
const THUMB_SIZE = 480;
const EXPORT_QUALITY = 0.88;
const THUMB_QUALITY = 0.78;

function getResponsiveCropSize() {
	if (typeof window === 'undefined') return DEFAULT_CIRCLE_SIZE;
	const viewportWidth = window.innerWidth || 390;
	const viewportHeight = window.innerHeight || 780;
	const widthBound = viewportWidth - 88;
	const heightBound = Math.floor(viewportHeight * 0.36);
	return Math.max(220, Math.min(DEFAULT_CIRCLE_SIZE, widthBound, heightBound));
}

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
		img.src = src;
	});
}

async function cropCircle(file, image, zoom, offsetX, offsetY, containerW, containerH, circleSize) {
	const radius = circleSize / 2;
	const centerX = containerW / 2;
	const centerY = containerH / 2;

	const scale = Math.max(containerW / image.width, containerH / image.height) * zoom;
	const drawW = image.width * scale;
	const drawH = image.height * scale;
	const imgX = (containerW - drawW) / 2 + offsetX;
	const imgY = (containerH - drawH) / 2 + offsetY;

	const srcX = (centerX - radius - imgX) / scale;
	const srcY = (centerY - radius - imgY) / scale;
	const srcSize = circleSize / scale;

	const canvas = document.createElement('canvas');
	canvas.width = OUTPUT_SIZE;
	canvas.height = OUTPUT_SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No se pudo inicializar el recorte.');

	ctx.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

	const thumbCanvas = document.createElement('canvas');
	thumbCanvas.width = THUMB_SIZE;
	thumbCanvas.height = THUMB_SIZE;
	const thumbCtx = thumbCanvas.getContext('2d');
	if (!thumbCtx) throw new Error('No se pudo inicializar la miniatura.');
	thumbCtx.drawImage(canvas, 0, 0, THUMB_SIZE, THUMB_SIZE);

	const [blob, thumbBlob] = await Promise.all([
		exportCanvasImage(canvas, { quality: EXPORT_QUALITY }),
		exportCanvasImage(thumbCanvas, { quality: THUMB_QUALITY, fallbackQuality: 0.82 }),
	]);

	return {
		file: new File([blob], buildOptimizedImageName(file.name, '', blob.type), { type: blob.type, lastModified: Date.now() }),
		thumbnailFile: new File([thumbBlob], buildOptimizedImageName(file.name, '-thumb', thumbBlob.type), { type: thumbBlob.type, lastModified: Date.now() }),
	};
}

function clampOffset(ox, oy, zoom, imgW, imgH, containerW, containerH, circleSize) {
	const radius = circleSize / 2;
	const totalScale = Math.max(containerW / imgW, containerH / imgH) * zoom;
	const drawW = imgW * totalScale;
	const drawH = imgH * totalScale;

	const maxX = Math.max(0, drawW / 2 - radius);
	const maxY = Math.max(0, drawH / 2 - radius);

	return {
		x: Math.min(maxX, Math.max(-maxX, ox)),
		y: Math.min(maxY, Math.max(-maxY, oy)),
	};
}

export default function ImageCropper({ file, onCrop, onCancel }) {
	const [previewUrl, setPreviewUrl] = useState('');
	const [imgNatural, setImgNatural] = useState(null);
	const [zoom, setZoom] = useState(1);
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState('');
	const [circleSize, setCircleSize] = useState(() => getResponsiveCropSize());

	const containerRef = useRef(null);
	const dragging = useRef(false);
	const dragStart = useRef({ x: 0, y: 0 });
	const offsetStart = useRef({ x: 0, y: 0 });
	const lastPinchDist = useRef(null);

	useEffect(() => {
		if (!file) return;
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		const img = new Image();
		img.onload = () => setImgNatural({ w: img.width, h: img.height });
		img.src = url;
		return () => URL.revokeObjectURL(url);
	}, [file]);

	useEffect(() => {
		const handleResize = () => setCircleSize(getResponsiveCropSize());
		handleResize();
		window.addEventListener('resize', handleResize);
		window.addEventListener('orientationchange', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('orientationchange', handleResize);
		};
	}, []);

	// If no file provided, render nothing (prevents crash from legacy positionOnly usage)
	if (!file) return null;

	const framePadding = circleSize < DEFAULT_CIRCLE_SIZE ? 24 : 40;
	const containerW = circleSize + framePadding;
	const containerH = circleSize + framePadding;

	const clamp = useCallback(
		(ox, oy, z) => {
			if (!imgNatural) return { x: ox, y: oy };
			return clampOffset(ox, oy, z, imgNatural.w, imgNatural.h, containerW, containerH, circleSize);
		},
		[imgNatural, containerW, containerH, circleSize],
	);

	useEffect(() => {
		setOffset((o) => clamp(o.x, o.y, zoom));
	}, [zoom, clamp]);

	const onPointerDown = (e) => {
		if (e.button && e.button !== 0) return;
		dragging.current = true;
		dragStart.current = { x: e.clientX, y: e.clientY };
		offsetStart.current = { ...offset };
		e.currentTarget.setPointerCapture(e.pointerId);
	};

	const onPointerMove = (e) => {
		if (!dragging.current) return;
		const dx = e.clientX - dragStart.current.x;
		const dy = e.clientY - dragStart.current.y;
		const next = clamp(offsetStart.current.x + dx, offsetStart.current.y + dy, zoom);
		setOffset(next);
	};

	const onPointerUp = () => {
		dragging.current = false;
	};

	const onTouchStart = (e) => {
		if (e.touches.length === 2) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			lastPinchDist.current = Math.hypot(dx, dy);
		}
	};

	const onTouchMove = (e) => {
		if (e.touches.length === 2) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.hypot(dx, dy);
			if (lastPinchDist.current) {
				const scale = dist / lastPinchDist.current;
				setZoom((z) => Math.min(3, Math.max(1, z * scale)));
			}
			lastPinchDist.current = dist;
			e.preventDefault();
		}
	};

	const onTouchEnd = () => {
		lastPinchDist.current = null;
	};

	const onWheel = (e) => {
		e.preventDefault();
		setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY * 0.002)));
	};

	const imgStyle = imgNatural
		? (() => {
				const totalScale = Math.max(containerW / imgNatural.w, containerH / imgNatural.h) * zoom;
				const tx = (containerW - imgNatural.w * totalScale) / 2 + offset.x;
				const ty = (containerH - imgNatural.h * totalScale) / 2 + offset.y;
				return {
					width: imgNatural.w,
					height: imgNatural.h,
					transformOrigin: '0 0',
					transform: `translate(${tx}px, ${ty}px) scale(${totalScale})`,
					willChange: 'transform',
				};
			})()
		: {};

	const handleConfirm = async () => {
		if (processing) return;
		setProcessing(true);
		setError('');
		try {
			const objectUrl = URL.createObjectURL(file);
			const image = await loadImage(objectUrl);
			URL.revokeObjectURL(objectUrl);
			const { file: cropped, thumbnailFile } = await cropCircle(file, image, zoom, offset.x, offset.y, containerW, containerH, circleSize);
			onCrop(cropped, { thumbnailFile });
		} catch (err) {
			setError(err.message || 'No se pudo recortar la imagen.');
		} finally {
			setProcessing(false);
		}
	};

	const modal = (
		<div className="fixed inset-0 z-[10000] overflow-y-auto overflow-x-hidden bg-black/85 px-3 py-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+16px)] backdrop-blur-sm">
			<div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-28px)] items-start justify-center sm:items-center">
			<motion.div
				initial={{ opacity: 0, scale: 0.96, y: 12 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.96, y: 12 }}
				transition={{ duration: 0.2, ease: 'easeOut' }}
				className="w-full max-w-[28rem] overflow-hidden rounded-[1.5rem] border border-white/10 bg-mansion-card shadow-2xl sm:rounded-[2rem]"
			>
				<div className="flex items-start justify-between gap-4 p-4 pb-0 sm:p-5 sm:pb-0">
					<div>
						<h3 className="font-display text-lg text-text-primary sm:text-xl">Ajusta tu foto</h3>
						<p className="mt-1 text-xs text-text-muted sm:text-sm">Arrastrá la imagen para centrarla.</p>
					</div>
					<button
						type="button"
						onClick={onCancel}
						className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-primary transition-colors hover:bg-white/10"
						aria-label="Cerrar"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="mt-4 flex justify-center px-4 sm:mt-5 sm:px-5">
					<div
						ref={containerRef}
						className="relative max-w-full cursor-grab overflow-hidden rounded-2xl bg-black/60 select-none active:cursor-grabbing"
						style={{ width: containerW, height: containerH, touchAction: 'none' }}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onPointerCancel={onPointerUp}
						onTouchStart={onTouchStart}
						onTouchMove={onTouchMove}
						onTouchEnd={onTouchEnd}
						onWheel={onWheel}
					>
						{previewUrl && (
							<img
								src={previewUrl}
								alt="Vista previa"
								className="absolute max-w-none pointer-events-none"
								draggable={false}
								style={imgStyle}
							/>
						)}

						{/* Dark overlay with circular cutout */}
						<svg
							className="pointer-events-none absolute inset-0"
							width={containerW}
							height={containerH}
						>
							<defs>
								<mask id="circle-mask">
									<rect width="100%" height="100%" fill="white" />
									<circle
										cx={containerW / 2}
										cy={containerH / 2}
										r={circleSize / 2}
										fill="black"
									/>
								</mask>
							</defs>
							<rect
								width="100%"
								height="100%"
								fill="rgba(0,0,0,0.6)"
								mask="url(#circle-mask)"
							/>
							<circle
								cx={containerW / 2}
								cy={containerH / 2}
								r={circleSize / 2}
								fill="none"
								stroke="rgba(212,175,55,0.6)"
								strokeWidth="2"
							/>
						</svg>
					</div>
				</div>

				<div className="mt-4 px-4 sm:mt-5 sm:px-5">
					<div className="mb-2 flex items-center justify-between text-xs text-text-dim">
						<span>Zoom</span>
						<span>{zoom.toFixed(1)}x</span>
					</div>
					<input
						type="range"
						min="1"
						max="3"
						step="0.05"
						value={zoom}
						onChange={(e) => setZoom(Number(e.target.value))}
						className="w-full accent-mansion-gold"
					/>
				</div>

				{error && (
					<div className="mx-4 mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 sm:mx-5">
						{error}
					</div>
				)}

				<div className="sticky bottom-0 mt-4 grid grid-cols-2 gap-3 border-t border-white/5 bg-mansion-card/95 p-4 backdrop-blur sm:mt-5 sm:p-5">
					<button
						type="button"
						onClick={onCancel}
						className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-white/10 sm:px-4 sm:text-base"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={handleConfirm}
						disabled={processing}
						className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mansion-gold px-3 py-3 text-sm font-semibold text-mansion-base transition-colors hover:bg-mansion-gold-light disabled:opacity-60 sm:px-4 sm:text-base"
					>
						<Check className="h-4 w-4" />
						{processing ? 'Recortando...' : 'Usar foto'}
					</button>
				</div>
			</motion.div>
			</div>
		</div>
	);

	if (typeof document === 'undefined') return modal;
	return createPortal(modal, document.body);
}
