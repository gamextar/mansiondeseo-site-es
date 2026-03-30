import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Download, Eye, Film, Gift, Heart, LayoutDashboard, Send, Upload, Volume2, VolumeX, Wand2, X } from 'lucide-react';
import { useAuth } from '../App';
import AvatarImg from '../components/AvatarImg';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { uploadStory } from '../lib/api';

const LANDSCAPE_WIDTH = 1280;
const LANDSCAPE_HEIGHT = 720;
const PORTRAIT_WIDTH = 720;
const PORTRAIT_HEIGHT = 1280;
const FFMPEG_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
const ENCODER_DEFAULTS = {
	crf: '29',
	maxrate: '2700k',
	bufsize: '8000k',
	audioBitrate: '64k',
	audioMono: true,
	preset: 'superfast',
};

function formatTime(totalSeconds) {
	const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
	const minutes = Math.floor(safeSeconds / 60);
	const seconds = safeSeconds - minutes * 60;
	return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function formatElapsedSeconds(totalSeconds) {
	const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
	return `${safeSeconds.toFixed(1)}s`;
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function roundToEven(value) {
	const rounded = Math.round(value);
	return rounded % 2 === 0 ? rounded : rounded + 1;
}

function getOutputProfile(sourceResolution) {
	const safeWidth = sourceResolution?.width || LANDSCAPE_WIDTH;
	const safeHeight = sourceResolution?.height || LANDSCAPE_HEIGHT;
	const isPortrait = safeHeight > safeWidth;

	if (isPortrait) {
		const scaledHeight = roundToEven((safeHeight / safeWidth) * PORTRAIT_WIDTH);
		const clampedHeight = Math.min(Math.max(scaledHeight, PORTRAIT_WIDTH), PORTRAIT_HEIGHT);
		return {
			label: `${PORTRAIT_WIDTH}x${clampedHeight}`,
			scaleFilter: `scale=${PORTRAIT_WIDTH}:-2:flags=bicubic`,
		};
	}

	const scaledWidth = roundToEven((safeWidth / safeHeight) * LANDSCAPE_HEIGHT);
	const clampedWidth = Math.min(Math.max(scaledWidth, LANDSCAPE_HEIGHT), LANDSCAPE_WIDTH);
	return {
		label: `${clampedWidth}x${LANDSCAPE_HEIGHT}`,
		scaleFilter: `scale=-2:${LANDSCAPE_HEIGHT}:flags=bicubic`,
	};
}

function getFileStem(filename = 'story') {
	return filename.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'story';
}

function parseFfmpegTime(message) {
	const match = message.match(/time=(\d+):(\d+):([\d.]+)/);
	if (!match) return null;
	const [, hh, mm, ss] = match;
	return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

async function downloadBlobUrl(url, mimeType) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`No se pudo descargar ${url}`);
	}

	const buffer = await response.arrayBuffer();
	return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}

// ── Feed-style fullscreen story preview ─────────────────────────────────────
function StoryPreview({ videoUrl, caption, user, onClose }) {
	const videoRef = useRef(null);
	const progressRef = useRef(null);
	const rafRef = useRef(null);
	const [isMuted, setIsMuted] = useState(true);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		video.play().catch(() => {});

		const tick = () => {
			if (progressRef.current && video.duration) {
				progressRef.current.style.width = `${(video.currentTime / video.duration) * 100}%`;
			}
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	const avatarSize = 48;

	return (
		<div className="fixed inset-0 z-[100] bg-black">
			{/* Video */}
			<video
				ref={videoRef}
				src={videoUrl}
				className="absolute inset-0 w-full h-full object-cover"
				loop
				playsInline
				muted={isMuted}
				autoPlay
			/>

			{/* Top gradient */}
			<div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />

			{/* Bottom gradient */}
			<div
				className="absolute inset-x-0 bottom-0 pointer-events-none"
				style={{ height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.04), transparent)' }}
			/>

			{/* Close button — top-right, inside PWA safe area */}
			<button
				type="button"
				onClick={onClose}
				className="absolute z-20 w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
				style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', right: 16 }}
			>
				<X className="w-5 h-5 text-white" />
			</button>

			{/* Right-side action icons (visual only, matching feed) */}
			<div className="pointer-events-none absolute right-3 flex flex-col items-center gap-6 z-20" style={{ bottom: 28 }}>
				<div className="flex flex-col items-center">
					<div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
						<Heart className="w-6 h-6 text-white" />
					</div>
					<span className="text-white text-[11px] font-semibold mt-1 drop-shadow tabular-nums">0</span>
				</div>
				<div className="flex flex-col items-center">
					<div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
						<Send className="w-6 h-6 text-white" />
					</div>
				</div>
				<div className="flex flex-col items-center">
					<div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
						<Gift className="w-6 h-6 text-mansion-gold" />
					</div>
				</div>
				<div className="flex flex-col items-center" onClick={() => setIsMuted(m => !m)} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
					<div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
						{isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
					</div>
				</div>
			</div>

			{/* User info + caption overlay (bottom-left, feed-style) */}
			<div className="absolute left-4 right-20 z-20" style={{ bottom: 20 }}>
				<div className="flex flex-col items-start gap-2.5 mb-1">
					<div
						className="rounded-full border-2 border-white/80 overflow-hidden bg-mansion-elevated shadow-lg"
						style={{ width: avatarSize, height: avatarSize }}
					>
						{user?.avatar_url ? (
							<AvatarImg src={user.avatar_url} crop={user.avatar_crop} alt={user.username} className="w-full h-full" />
						) : (
							<div className="w-full h-full flex items-center justify-center text-white/60 text-base font-bold">{(user?.username || '?')[0]}</div>
						)}
					</div>
					<p className="text-white font-bold text-[16px] leading-tight drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.5)' }}>@{user?.username || 'usuario'}</p>
				</div>
				{caption && (
					<p className="text-white/90 text-sm leading-relaxed line-clamp-3 drop-shadow" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{caption}</p>
				)}
				<p className="text-white/40 text-[11px] mt-1.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>Ahora</p>
			</div>

			{/* Progress bar (bottom) */}
			<div className="absolute bottom-0 left-0 right-0 h-[3px] z-30 bg-white/10">
				<div ref={progressRef} className="h-full bg-mansion-gold" style={{ width: '0%' }} />
			</div>
		</div>
	);
}

export default function StoryUploadPage() {
	const navigate = useNavigate();
	const { user, siteSettings } = useAuth();
	const encoderParams = {
		crf: siteSettings?.encoderCrf || ENCODER_DEFAULTS.crf,
		maxrate: siteSettings?.encoderMaxrate || ENCODER_DEFAULTS.maxrate,
		bufsize: siteSettings?.encoderBufsize || ENCODER_DEFAULTS.bufsize,
		audioBitrate: siteSettings?.encoderAudioBitrate || ENCODER_DEFAULTS.audioBitrate,
		audioMono: siteSettings?.encoderAudioMono ?? ENCODER_DEFAULTS.audioMono,
		preset: siteSettings?.encoderPreset || ENCODER_DEFAULTS.preset,
	};
	const ffmpegRef = useRef(null);
	const loadPromiseRef = useRef(null);
	const videoRef = useRef(null);
	const sourceUrlRef = useRef('');
	const resultPreviewUrlRef = useRef('');
	const activeEncodeDurationRef = useRef(0);
	const isTranscodingRef = useRef(false);
	const timerIntervalRef = useRef(null);
	const timerStartRef = useRef(0);

	const [encodingProgress, setEncodingProgress] = useState(0);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [phase, setPhase] = useState('idle');
	const [sourceFile, setSourceFile] = useState(null);
	const [sourceUrl, setSourceUrl] = useState('');
	const [sourceDuration, setSourceDuration] = useState(0);
	const [sourceResolution, setSourceResolution] = useState(null);
	const [processing, setProcessing] = useState(false);
	const [result, setResult] = useState(null);
	const [errorMessage, setErrorMessage] = useState('');
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [showPreview, setShowPreview] = useState(false);

	const outputProfile = getOutputProfile(sourceResolution);
	const storyStep = result?.id ? 'done' : sourceFile ? 'process' : 'pick';
	const storyStepIndex = storyStep === 'pick' ? 0 : storyStep === 'process' ? 1 : 2;
	const storySteps = [
		{ id: 'pick', label: 'Elegir' },
		{ id: 'process', label: 'Procesar' },
		{ id: 'done', label: 'Lista' },
	];

	if (!ffmpegRef.current) {
		ffmpegRef.current = new FFmpeg();
	}

	useEffect(() => {
		const ffmpeg = ffmpegRef.current;

		const handleLog = ({ message }) => {
			if (!isTranscodingRef.current) return;
			const elapsed = parseFfmpegTime(message);
			if (elapsed === null || activeEncodeDurationRef.current <= 0) return;
			setEncodingProgress(clamp(elapsed / activeEncodeDurationRef.current, 0, 0.99));
		};

		ffmpeg.on('log', handleLog);

		return () => {
			ffmpeg.off('log', handleLog);
			ffmpeg.terminate();
			if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
			if (resultPreviewUrlRef.current) URL.revokeObjectURL(resultPreviewUrlRef.current);
			clearInterval(timerIntervalRef.current);
		};
	}, []);

	useEffect(() => {
		sourceUrlRef.current = sourceUrl;
	}, [sourceUrl]);

	const ensureEngineLoaded = async () => {
		const ffmpeg = ffmpegRef.current;
		if (ffmpeg.loaded) return ffmpeg;
		if (loadPromiseRef.current) {
			await loadPromiseRef.current;
			return ffmpeg;
		}

		loadPromiseRef.current = (async () => {
			const coreURL = await downloadBlobUrl(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
			const wasmURL = await downloadBlobUrl(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');
			await ffmpeg.load({ coreURL, wasmURL });
		})();

		try {
			await loadPromiseRef.current;
		} catch (error) {
			setErrorMessage(error?.message || 'Error al cargar FFmpeg.');
			throw error;
		} finally {
			loadPromiseRef.current = null;
		}

		return ffmpeg;
	};

	const resetResult = () => {
		if (resultPreviewUrlRef.current) {
			URL.revokeObjectURL(resultPreviewUrlRef.current);
			resultPreviewUrlRef.current = '';
		}
		setResult(null);
	};

	const resetStoryFlow = () => {
		resetResult();
		if (sourceUrlRef.current) {
			URL.revokeObjectURL(sourceUrlRef.current);
			sourceUrlRef.current = '';
		}
		setSourceFile(null);
		setSourceUrl('');
		setSourceDuration(0);
		setSourceResolution(null);
		setEncodingProgress(0);
		setUploadProgress(0);
		setPhase('idle');
		setErrorMessage('');
	};

	const handleFileChange = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;

		resetResult();
		setErrorMessage('');
		setSourceDuration(0);
		setSourceResolution(null);
		setSourceFile(file);
		setEncodingProgress(0);
		setUploadProgress(0);
		setPhase('idle');

		const nextSourceUrl = URL.createObjectURL(file);
		if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
		setSourceUrl(nextSourceUrl);

		await ensureEngineLoaded().catch(() => {});
	};

	const handleLoadedMetadata = () => {
		const video = videoRef.current;
		if (!video) return;
		setSourceDuration(video.duration || 0);
		setSourceResolution(video.videoWidth && video.videoHeight ? { width: video.videoWidth, height: video.videoHeight } : null);
	};

	const encodeStoryVideo = async () => {
		const ffmpeg = await ensureEngineLoaded();
		const inputExtension = sourceFile.name.split('.').pop()?.toLowerCase() || 'mp4';
		const inputFileName = `input.${inputExtension}`;
		const outputFileName = `${getFileStem(sourceFile.name)}-story.mp4`;
		const safeDuration = Math.max(0.1, sourceDuration || 0.1);

		activeEncodeDurationRef.current = safeDuration;

		try { await ffmpeg.deleteFile(inputFileName); } catch {}
		try { await ffmpeg.deleteFile(outputFileName); } catch {}

		const inputData = await fetchFile(sourceFile);
		await ffmpeg.writeFile(inputFileName, inputData);

		const sharedArgs = [
			'-i', inputFileName,
			'-vf', `${outputProfile.scaleFilter},setsar=1`,
			'-movflags', '+faststart',
		];

		let exitCode = await ffmpeg.exec([
			...sharedArgs,
			'-c:v', 'libx264',
			'-threads', '4',
			'-x264-params', 'sliced-threads=1:threads=4',
			'-crf', encoderParams.crf,
			'-maxrate', encoderParams.maxrate,
			'-bufsize', encoderParams.bufsize,
			'-preset', encoderParams.preset,
			'-pix_fmt', 'yuv420p',
			'-c:a', 'aac',
			'-b:a', encoderParams.audioBitrate,
			...(encoderParams.audioMono ? ['-ac', '1'] : []),
			outputFileName,
		]);

		if (exitCode !== 0) {
			try { await ffmpeg.deleteFile(outputFileName); } catch {}
			exitCode = await ffmpeg.exec([
				...sharedArgs,
				'-c:v', 'mpeg4',
				'-q:v', '4',
				'-c:a', 'aac',
				'-b:a', encoderParams.audioBitrate,
				...(encoderParams.audioMono ? ['-ac', '1'] : []),
				outputFileName,
			]);
		}

		if (exitCode !== 0) {
			throw new Error('FFmpeg no pudo generar el MP4 final.');
		}

		const data = await ffmpeg.readFile(outputFileName);
		const outputBlob = new Blob([data], { type: 'video/mp4' });
		const previewUrl = URL.createObjectURL(outputBlob);
		const encodedFile = new File([outputBlob], outputFileName, { type: 'video/mp4' });

		try { await ffmpeg.deleteFile(inputFileName); } catch {}
		try { await ffmpeg.deleteFile(outputFileName); } catch {}

		return {
			file: encodedFile,
			previewUrl,
			fileName: outputFileName,
			sizeLabel: `${(outputBlob.size / (1024 * 1024)).toFixed(2)} MB`,
			duration: sourceDuration || 0,
		};
	};

	const processAndUploadStory = async () => {
		if (!sourceFile) {
			setErrorMessage('Primero sube un video.');
			return;
		}

		try {
			resetResult();
			setErrorMessage('');
			setProcessing(true);
			setPhase('encoding');
			isTranscodingRef.current = true;
			setEncodingProgress(0);
			setUploadProgress(0);
			setElapsedSeconds(0);
			timerStartRef.current = performance.now();
			timerIntervalRef.current = setInterval(() => {
				setElapsedSeconds(Math.floor((performance.now() - timerStartRef.current) / 1000));
			}, 500);

			const encoded = await encodeStoryVideo();
			const processingElapsedSeconds = (performance.now() - timerStartRef.current) / 1000;

			resultPreviewUrlRef.current = encoded.previewUrl;
			setEncodingProgress(1);
			setPhase('uploading');

			const story = await uploadStory(encoded.file, {
				onProgress: (progress) => setUploadProgress(clamp(progress, 0, 1)),
			});

			setUploadProgress(1);
			setPhase('done');
			setResult({
				...story,
				previewUrl: encoded.previewUrl,
				fileName: encoded.fileName,
				sizeLabel: encoded.sizeLabel,
				originalSizeLabel: sourceFile ? `${(sourceFile.size / (1024 * 1024)).toFixed(2)} MB` : null,
				duration: encoded.duration,
				processingTimeLabel: formatElapsedSeconds(processingElapsedSeconds),
			});
		} catch (error) {
			setErrorMessage(error?.message || 'No se pudo publicar la historia.');
			setPhase('idle');
		} finally {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
			setProcessing(false);
			isTranscodingRef.current = false;
			activeEncodeDurationRef.current = 0;
		}
	};

	const progressValue = phase === 'uploading' ? uploadProgress : encodingProgress;
	const progressLabel = phase === 'uploading' ? 'Verificando historia' : 'Cargando Historia';

	return (
		<div className="min-h-screen bg-mansion-base text-text-primary relative overflow-hidden">
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-mansion-crimson/10 blur-3xl" />
				<div className="absolute bottom-[-12%] left-[-6%] w-[460px] h-[460px] rounded-full bg-mansion-gold/10 blur-3xl" />
			</div>

			<div className="relative max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-10 min-h-screen flex items-center justify-center">
				<AnimatePresence mode="wait">
					{storyStep === 'pick' && (
						<motion.section
							key="pick"
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							transition={{ duration: 0.28, ease: 'easeOut' }}
							style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
							className="w-full glass-elevated rounded-[2rem] border border-mansion-border/20 p-8 sm:p-10 flex flex-col items-center text-center"
						>
							<div className="w-full flex items-center justify-center gap-2 mb-8">
								{storySteps.map((step, index) => {
									const active = storyStepIndex === index;
									const complete = storyStepIndex > index;

									return (
										<div key={step.id} className="flex items-center gap-2">
											<div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-semibold transition-transform duration-300 ${active || complete ? 'bg-mansion-gold text-mansion-base border-mansion-gold scale-100' : 'bg-white/5 text-text-dim border-white/10 scale-95'}`}>
												{index + 1}
											</div>
											{index < storySteps.length - 1 && <div className={`w-6 sm:w-10 h-px ${storyStepIndex > index ? 'bg-mansion-gold/70' : 'bg-white/10'}`} />}
										</div>
									);
								})}
							</div>

							<motion.div
								initial={{ scale: 0.8, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								transition={{ delay: 0.08, duration: 0.28, ease: 'easeOut' }}
								style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
								className="w-20 h-20 rounded-[1.25rem] bg-mansion-gold/10 border border-mansion-gold/20 flex items-center justify-center mb-6 shadow-[0_0_0_1px_rgba(212,175,55,0.06)]"
							>
								<Film className="w-9 h-9 text-mansion-gold" />
							</motion.div>
							<h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary">Nueva Historia</h1>
							<p className="text-text-muted mt-2 mb-8 max-w-sm">Seleccioná tu video para publicarlo como historia.</p>
							<label className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors cursor-pointer shadow-[0_12px_30px_rgba(212,175,55,0.18)]">
								<Upload className="w-5 h-5" />
								Seleccionar video
								<input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
							</label>
						</motion.section>
					)}

					{storyStep === 'process' && (
						<motion.section
							key="process"
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							transition={{ duration: 0.28, ease: 'easeOut' }}
							style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
							className="w-full glass-elevated rounded-[2rem] border border-mansion-border/20 overflow-hidden"
						>
							<div className="px-6 sm:px-8 pt-6 sm:pt-7 pb-4 border-b border-white/10 bg-white/[0.02]">
								<div className="flex items-center justify-center gap-2 mb-5">
									{storySteps.map((step, index) => {
										const active = storyStepIndex === index;
										const complete = storyStepIndex > index;

										return (
											<div key={step.id} className="flex items-center gap-2">
												<div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-semibold ${active || complete ? 'bg-mansion-gold text-mansion-base border-mansion-gold' : 'bg-white/5 text-text-dim border-white/10'}`}>
													{index + 1}
												</div>
												{index < storySteps.length - 1 && <div className={`w-8 sm:w-10 h-px ${storyStepIndex > index ? 'bg-mansion-gold/70' : 'bg-white/10'}`} />}
											</div>
										);
									})}
								</div>
								<div className="text-center">
									<h2 className="font-display text-2xl font-semibold text-text-primary">Prepará tu historia</h2>
									<p className="text-sm text-text-muted mt-1">Se va a procesar el video completo y luego se publicará en tu feed de historias.</p>
								</div>
							</div>

							<div className="aspect-video bg-black relative">
								{sourceUrl && (
									<video
										ref={videoRef}
										src={sourceUrl}
										controls
										playsInline
										preload="metadata"
										className="w-full h-full object-contain"
										onLoadedMetadata={handleLoadedMetadata}
									/>
								)}
								<div className="absolute left-4 bottom-4 right-4 flex items-center justify-between gap-3 pointer-events-none">
									<div className="px-3 py-2 rounded-2xl bg-black/55 border border-white/10 text-left">
										<p className="text-[10px] uppercase tracking-[0.18em] text-text-dim">Video</p>
										<p className="text-sm text-text-primary truncate max-w-[180px] sm:max-w-[260px]">{sourceFile?.name || 'Sin archivo'}</p>
									</div>
									<div className="px-3 py-2 rounded-2xl bg-black/55 border border-white/10 text-right shrink-0">
										<p className="text-[10px] uppercase tracking-[0.18em] text-text-dim">Duración</p>
										<p className="text-sm text-mansion-gold font-semibold">{sourceDuration ? formatTime(sourceDuration) : '—'}</p>
									</div>
								</div>
							</div>

							<div className="p-6 sm:p-8">
								<motion.div
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.12, duration: 0.28, ease: 'easeOut' }}
									style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
									className="mt-6"
								>
									{!processing ? (
										<div className="space-y-3">
											<button
												type="button"
												onClick={processAndUploadStory}
												className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors shadow-[0_12px_30px_rgba(212,175,55,0.18)]"
											>
												<Wand2 className="w-5 h-5" />
												Cargar historia
											</button>
											<p className="text-xs text-text-dim text-center">Primero optimizamos el video en el navegador y después lo subimos a tu historia con progreso real.</p>
										</div>
									) : (
										<div className="space-y-4 rounded-[1.5rem] border border-mansion-gold/15 bg-mansion-gold/[0.04] p-4">
											<div className="space-y-2">
												<div className="flex items-center justify-between text-sm">
													<span className="text-text-muted">Cargando Historia</span>
													<span className="font-semibold text-mansion-gold tabular-nums">{Math.round(encodingProgress * 100)}%</span>
												</div>
												<div className="rounded-2xl bg-black/25 border border-white/10 overflow-hidden">
													<div className="h-3 bg-white/5">
														<div className="h-full bg-gradient-to-r from-mansion-gold to-mansion-gold-light transition-all duration-300" style={{ width: `${Math.round(encodingProgress * 100)}%` }} />
													</div>
												</div>
											</div>

											{phase !== 'encoding' && (
												<div className="space-y-2">
													<div className="flex items-center justify-between text-sm">
														<span className="text-text-muted">Verificando historia</span>
														<span className="font-semibold text-mansion-gold tabular-nums">{Math.round(uploadProgress * 100)}%</span>
													</div>
													<div className="rounded-2xl bg-black/25 border border-white/10 overflow-hidden">
														<div className="h-3 bg-white/5">
															<div className="h-full bg-gradient-to-r from-mansion-crimson to-mansion-gold transition-all duration-300" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
														</div>
													</div>
												</div>
											)}

											<p className="text-xs text-text-dim">
												{phase === 'encoding'
													? 'Optimizando el video para la historia.'
													: 'Subiendo y verificando la historia.'}
											</p>
										</div>
									)}
								</motion.div>

								{errorMessage && !processing && (
									<div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
										{errorMessage}
									</div>
								)}
							</div>
						</motion.section>
					)}

					{storyStep === 'done' && (
						<motion.section
							key="done"
							initial={{ opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, y: -20 }}
							transition={{ duration: 0.3, ease: 'easeOut' }}
							style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
							className="w-full glass-elevated rounded-[2rem] border border-mansion-border/20 overflow-hidden"
						>
							<div className="px-6 sm:px-8 pt-6 pb-4 border-b border-white/10 bg-white/[0.02] relative flex items-center justify-center">
								<div className="flex items-center gap-2">
									{storySteps.map((step, index) => (
										<div key={step.id} className="flex items-center gap-2">
											<div className="w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-semibold bg-mansion-gold text-mansion-base border-mansion-gold">
												{index + 1}
											</div>
											{index < storySteps.length - 1 && <div className="w-8 sm:w-10 h-px bg-mansion-gold/70" />}
										</div>
									))}
								</div>
								<button
									type="button"
									onClick={() => navigate('/perfil')}
									className="absolute right-4 sm:right-6 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
									aria-label="Volver al panel de control"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
							<div className="p-6 sm:p-8 text-center">
								<motion.div
									initial={{ scale: 0.5, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									transition={{ delay: 0.08, duration: 0.24, ease: 'easeOut' }}
									style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
									className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4"
								>
									<CheckCircle2 className="w-7 h-7 text-green-400" />
								</motion.div>
								<h2 className="font-display text-2xl font-bold text-text-primary">¡Tu historia fue publicada!</h2>
								<p className="text-text-muted mt-1 text-sm">El encoding ha finalizado correctamente</p>

								{/* Encoding summary */}
								<div className="mt-4 mb-6 grid grid-cols-2 gap-2 text-left">
									<div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
										<p className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Tamaño original</p>
										<p className="text-base font-semibold text-text-primary tabular-nums">{result.originalSizeLabel ?? '—'}</p>
									</div>
									<div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
										<p className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Tamaño final</p>
										<p className="text-base font-semibold text-mansion-gold tabular-nums">{result.sizeLabel}</p>
									</div>
									<div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
										<p className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Duración</p>
										<p className="text-base font-semibold text-text-primary tabular-nums">{result.duration > 0 ? `${result.duration.toFixed(1)}s` : '—'}</p>
									</div>
									<div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
										<p className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Tiempo de encoding</p>
										<p className="text-base font-semibold text-text-primary tabular-nums">{result.processingTimeLabel}</p>
									</div>
								</div>

								<div className="flex flex-col gap-3">
									<button
										type="button"
										onClick={() => setShowPreview(true)}
										className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors shadow-[0_12px_30px_rgba(212,175,55,0.18)]"
									>
										<Eye className="w-5 h-5" />
										Previsualizar historia
									</button>
									<a
										href={result.previewUrl}
										download={result.fileName || 'historia.mp4'}
										className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-text-primary font-medium hover:bg-white/10 transition-colors"
									>
										<Download className="w-5 h-5" />
										Descargar historia
									</a>
									<button
										type="button"
										onClick={resetStoryFlow}
										className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-text-primary font-medium hover:bg-white/10 transition-colors"
									>
										<Upload className="w-5 h-5" />
										Subir otra historia
									</button>
									<button
										type="button"
										onClick={() => navigate('/perfil')}
										className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-text-muted font-medium hover:bg-white/10 transition-colors"
									>
										<LayoutDashboard className="w-5 h-5" />
										Ir al panel de control
									</button>
								</div>
							</div>
						</motion.section>
					)}
				</AnimatePresence>
			</div>

			{showPreview && result && (
				<StoryPreview
					videoUrl={result.video_url || result.previewUrl}
					caption={result.caption}
					user={user}
					onClose={() => setShowPreview(false)}
				/>
			)}

			{processing && (
				<div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-black/88 border border-white/10 shadow-2xl">
					<Clock className="w-5 h-5 text-mansion-gold" />
					<div>
						<p className="text-[10px] uppercase tracking-[0.2em] text-text-dim">{progressLabel}</p>
						<p className="text-2xl font-display font-bold text-text-primary tabular-nums">
							{String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
						</p>
					</div>
					<div className="ml-2 text-right">
						<p className="text-lg font-bold text-mansion-gold tabular-nums">{Math.round(progressValue * 100)}%</p>
					</div>
				</div>
			)}
		</div>
	);
}
