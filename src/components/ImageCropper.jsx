import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const CIRCLE_SIZE = 280;
const OUTPUT_SIZE = 1080;

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
		img.src = src;
	});
}

async function cropCircle(file, image, zoom, offsetX, offsetY, containerW, containerH) {
	const radius = CIRCLE_SIZE / 2;
	const centerX = containerW / 2;
	const centerY = containerH / 2;

	const scale = Math.max(containerW / image.width, containerH / image.height) * zoom;
	const drawW = image.width * scale;
	const drawH = image.height * scale;
	const imgX = (containerW - drawW) / 2 + offsetX;
	const imgY = (containerH - drawH) / 2 + offsetY;

	const srcX = (centerX - radius - imgX) / scale;
	const srcY = (centerY - radius - imgY) / scale;
	const srcSize = CIRCLE_SIZE / scale;

	const canvas = document.createElement('canvas');
	canvas.width = OUTPUT_SIZE;
	canvas.height = OUTPUT_SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No se pudo inicializar el recorte.');

	ctx.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

	const mimeType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
	const blob = await new Promise((resolve, reject) => {
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('No se pudo exportar la imagen.'))),
			mimeType,
			0.92,
		);
	});
	return new File([blob], file.name || 'avatar.jpg', { type: blob.type || mimeType, lastModified: Date.now() });
}

function clampOffset(ox, oy, zoom, imgW, imgH, containerW, containerH) {
	const radius = CIRCLE_SIZE / 2;
	const scale = Math.max(containerW / imgW, containerH / imgH) * zoom;
	const drawW = imgW * scale;
	const drawH = imgH * scale;

	const minX = containerW / 2 + radius - (containerW + drawW) / 2;
	const maxX = (containerW + drawW) / 2 - containerW / 2 - radius;
	const minY = containerH / 2 + radius - (containerH + drawH) / 2;
	const maxY = (containerH + drawH) / 2 - containerH / 2 - radius;

	return {
		x: Math.min(maxX, Math.max(minX, ox)),
		y: Math.min(maxY, Math.max(minY, oy)),
	};
}

export default function ImageCropper({ file, onCrop, onCancel }) {
	const [previewUrl, setPreviewUrl] = useState('');
	const [imgNatural, setImgNatural] = useState(null);
	const [zoom, setZoom] = useState(1);
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState('');

	const containerRef = useRef(null);
	const dragging = useRef(false);
	const dragStart = useRef({ x: 0, y: 0 });
	const offsetStart = useRef({ x: 0, y: 0 });
	const lastPinchDist = useRef(null);

	useEffect(() => {
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		const img = new Image();
		img.onload = () => setImgNatural({ w: img.width, h: img.height });
		img.src = url;
		return () => URL.revokeObjectURL(url);
	}, [file]);

	const containerW = CIRCLE_SIZE + 40;
	const containerH = CIRCLE_SIZE + 40;

	const clamp = useCallback(
		(ox, oy, z) => {
			if (!imgNatural) return { x: ox, y: oy };
			return clampOffset(ox, oy, z, imgNatural.w, imgNatural.h, containerW, containerH);
		},
		[imgNatural, containerW, containerH],
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
				const scale = Math.max(containerW / imgNatural.w, containerH / imgNatural.h) * zoom;
				return {
					width: imgNatural.w * scale,
					height: imgNatural.h * scale,
					left: (containerW - imgNatural.w * scale) / 2 + offset.x,
					top: (containerH - imgNatural.h * scale) / 2 + offset.y,
				};
			})()
		: {};

	const handleConfirm = async () => {
		setProcessing(true);
		setError('');
		try {
			const objectUrl = URL.createObjectURL(file);
			const image = await loadImage(objectUrl);
			URL.revokeObjectURL(objectUrl);
			const cropped = await cropCircle(file, image, zoom, offset.x, offset.y, containerW, containerH);
			onCrop(cropped);
		} catch (err) {
			setError(err.message || 'No se pudo recortar la imagen.');
		} finally {
			setProcessing(false);
		}
	};

	return (
		<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
			<motion.div
				initial={{ opacity: 0, scale: 0.96, y: 12 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.96, y: 12 }}
				transition={{ duration: 0.2, ease: 'easeOut' }}
				className="w-full max-w-md rounded-[2rem] border border-white/10 bg-mansion-card p-5 shadow-2xl"
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="font-display text-xl text-text-primary">Ajusta tu foto</h3>
						<p className="mt-1 text-sm text-text-muted">Arrastrá la imagen para centrarla.</p>
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

				<div className="mt-5 flex justify-center">
					<div
						ref={containerRef}
						className="relative cursor-grab overflow-hidden rounded-2xl bg-black/60 select-none active:cursor-grabbing"
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
								className="absolute pointer-events-none"
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
										r={CIRCLE_SIZE / 2}
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
								r={CIRCLE_SIZE / 2}
								fill="none"
								stroke="rgba(212,175,55,0.6)"
								strokeWidth="2"
							/>
						</svg>
					</div>
				</div>

				<div className="mt-5">
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
					<div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
						{error}
					</div>
				)}

				<div className="mt-5 flex gap-3">
					<button
						type="button"
						onClick={onCancel}
						className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-text-primary transition-colors hover:bg-white/10"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={handleConfirm}
						disabled={processing}
						className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-mansion-gold px-4 py-3 font-semibold text-mansion-base transition-colors hover:bg-mansion-gold-light disabled:opacity-60"
					>
						<Check className="h-4 w-4" />
						{processing ? 'Recortando...' : 'Usar foto'}
					</button>
				</div>
			</motion.div>
		</div>
	);
}
