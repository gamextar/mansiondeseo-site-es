import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
		image.src = src;
	});
}

async function cropToSquare(file, zoom) {
	const objectUrl = URL.createObjectURL(file);

	try {
		const image = await loadImage(objectUrl);
		const shortestSide = Math.min(image.width, image.height);
		const cropSize = shortestSide / zoom;
		const sourceX = (image.width - cropSize) / 2;
		const sourceY = (image.height - cropSize) / 2;
		const outputSize = 1080;
		const canvas = document.createElement('canvas');
		canvas.width = outputSize;
		canvas.height = outputSize;
		const context = canvas.getContext('2d');

		if (!context) {
			throw new Error('No se pudo inicializar el recorte.');
		}

		context.drawImage(
			image,
			sourceX,
			sourceY,
			cropSize,
			cropSize,
			0,
			0,
			outputSize,
			outputSize
		);

		const mimeType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';

		const blob = await new Promise((resolve, reject) => {
			canvas.toBlob((nextBlob) => {
				if (nextBlob) {
					resolve(nextBlob);
					return;
				}
				reject(new Error('No se pudo exportar la imagen recortada.'));
			}, mimeType, 0.92);
		});

		return new File([blob], file.name || 'avatar.jpg', {
			type: blob.type || mimeType,
			lastModified: Date.now(),
		});
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

export default function ImageCropper({ file, onCrop, onCancel }) {
	const [previewUrl, setPreviewUrl] = useState('');
	const [zoom, setZoom] = useState(1);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		const objectUrl = URL.createObjectURL(file);
		setPreviewUrl(objectUrl);

		return () => {
			URL.revokeObjectURL(objectUrl);
		};
	}, [file]);

	const imageScale = useMemo(() => 1 + (zoom - 1) * 0.35, [zoom]);

	const handleConfirm = async () => {
		setProcessing(true);
		setError('');

		try {
			const croppedFile = await cropToSquare(file, zoom);
			onCrop(croppedFile);
		} catch (nextError) {
			setError(nextError.message || 'No se pudo recortar la imagen.');
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
						<p className="mt-1 text-sm text-text-muted">Usaremos un recorte cuadrado centrado para el avatar.</p>
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
					<div className="relative h-72 w-72 overflow-hidden rounded-[1.75rem] border border-mansion-gold/20 bg-black/40">
						{previewUrl && (
							<img
								src={previewUrl}
								alt="Vista previa"
								className="h-full w-full object-cover transition-transform duration-200"
								style={{ transform: `scale(${imageScale})` }}
							/>
						)}
						<div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-2 ring-mansion-gold/60 ring-offset-0" />
						<div className="pointer-events-none absolute inset-4 rounded-[1.5rem] border border-white/30" />
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
						max="2.5"
						step="0.1"
						value={zoom}
						onChange={(event) => setZoom(Number(event.target.value))}
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
