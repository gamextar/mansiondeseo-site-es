import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Clock, Film, Gift, Heart, Send, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import AvatarImg from '../components/AvatarImg';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { getToken, uploadStory } from '../lib/api';
import StoryPreviewOverlay from '../components/StoryPreviewOverlay';
import { removeViewedStoryUser } from '../lib/storyViews';

const LANDSCAPE_WIDTH = 1280;
const LANDSCAPE_HEIGHT = 720;
const PORTRAIT_WIDTH = 720;
const PORTRAIT_HEIGHT = 1280;
const STORY_POSTER_FRAME_TIME_SECONDS = 0;
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

function formatDebugTimer(totalSeconds) {
	const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
	const minutes = Math.floor(safeSeconds / 60);
	const seconds = Math.floor(safeSeconds % 60);
	const tenths = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 10);
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
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

function withTimeout(promise, timeoutMs, timeoutMessage) {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new Error(timeoutMessage));
		}, timeoutMs);

		promise
			.then((value) => {
				clearTimeout(timeoutId);
				resolve(value);
			})
			.catch((error) => {
				clearTimeout(timeoutId);
				reject(error);
			});
	});
}

async function loadVideoMetadata(fileUrl) {
	const video = document.createElement('video');
	video.preload = 'metadata';
	video.playsInline = true;
	video.muted = true;
	video.setAttribute('playsinline', 'true');
	video.setAttribute('webkit-playsinline', 'true');

	return new Promise((resolve, reject) => {
		let settled = false;

		const cleanup = () => {
			video.removeAttribute('src');
			video.load();
		};

		const succeed = (metadata) => {
			if (settled) return;
			settled = true;
			cleanup();
			resolve(metadata);
		};

		const fail = () => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(new Error('No se pudo leer el video seleccionado.'));
		};

		video.onloadedmetadata = () => {
			succeed({
				duration: video.duration || 0,
				resolution: video.videoWidth && video.videoHeight ? { width: video.videoWidth, height: video.videoHeight } : null,
			});
		};

		video.onerror = fail;

		video.src = fileUrl;
		video.load();
	});
}

async function captureVideoPoster(fileUrl, { maxWidth = 720, quality = 0.82 } = {}) {
	const video = document.createElement('video');
	video.preload = 'auto';
	video.muted = true;
	video.playsInline = true;
	video.setAttribute('playsinline', 'true');
	video.setAttribute('webkit-playsinline', 'true');

	return new Promise((resolve, reject) => {
		let settled = false;
		let captureRequested = false;

		const cleanup = () => {
			video.pause();
			video.removeAttribute('src');
			video.load();
		};

		const fail = () => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(new Error('No se pudo capturar la portada del video.'));
		};

		const captureFrame = () => {
			if (settled) return;
			requestAnimationFrame(() => {
				if (settled) return;
				try {
					const sourceWidth = video.videoWidth || 1;
					const sourceHeight = video.videoHeight || 1;
					const targetWidth = Math.min(sourceWidth, maxWidth);
					const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth));
					const canvas = document.createElement('canvas');
					canvas.width = targetWidth;
					canvas.height = targetHeight;
					const context = canvas.getContext('2d');
					if (!context) throw new Error('Canvas no disponible');
					context.drawImage(video, 0, 0, targetWidth, targetHeight);
					canvas.toBlob((blob) => {
						if (settled) return;
						cleanup();
						if (!blob) {
							settled = true;
							reject(new Error('No se pudo generar la portada del video.'));
							return;
						}
						settled = true;
						resolve(URL.createObjectURL(blob));
					}, 'image/jpeg', quality);
				} catch {
					fail();
				}
			});
		};

		video.onerror = fail;
		video.onloadeddata = captureFrame;
		video.onseeked = captureFrame;

		video.src = fileUrl;
		video.load();
	});
}

const STORY_STAGE_VIEWPORT_CLASS = 'fixed inset-0 z-10 flex items-center justify-center p-0 sm:p-3';
const STORY_STAGE_FRAME_CLASS = 'relative h-full w-full overflow-hidden rounded-none bg-black shadow-none transition-[max-width] duration-300 ease-out sm:rounded-[1.75rem] sm:shadow-[0_18px_60px_rgba(0,0,0,0.45)] lg:my-4 lg:h-[calc(100%-32px)]';
const STORY_STAGE_CLOSE_BUTTON_CLASS = 'absolute z-30 flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60';
const STORY_STAGE_CLOSE_BUTTON_STYLE = { top: 'max(env(safe-area-inset-top, 12px), 12px)', right: 16 };

function StoryStageHeader({
	steps,
	currentStepIndex,
	title,
	subtitle,
	onClose,
	closeLabel,
	showClose = false,
}) {
	return (
		<>
			{showClose && onClose && (
				<button
					type="button"
					onClick={onClose}
					className={STORY_STAGE_CLOSE_BUTTON_CLASS}
					style={STORY_STAGE_CLOSE_BUTTON_STYLE}
					aria-label={closeLabel}
				>
					<X className="h-7 w-7 text-white" />
				</button>
			)}
			<div
				className="absolute inset-x-0 top-0 z-20 px-5 sm:px-6"
				style={{ paddingTop: 'max(env(safe-area-inset-top, 12px), 14px)' }}
			>
				<div className="mx-auto flex max-w-[340px] flex-col items-center text-center">
					<div className="flex items-center justify-center gap-2">
						{steps.map((step, index) => {
							const active = currentStepIndex === index;
							const complete = currentStepIndex > index;

							return (
								<div key={step.id} className="flex items-center gap-2">
									<div className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold transition-transform duration-300 ${active || complete ? 'scale-100 border-mansion-gold bg-mansion-gold text-mansion-base' : 'scale-95 border-white/10 bg-white/5 text-white/55'}`}>
										{index + 1}
									</div>
									{index < steps.length - 1 && <div className={`h-px w-7 sm:w-10 ${currentStepIndex > index ? 'bg-mansion-gold/70' : 'bg-white/10'}`} />}
								</div>
							);
						})}
					</div>
					<div className="mt-4 space-y-1.5">
						<h1 className="font-display text-[1.8rem] font-bold text-white sm:text-3xl" style={{ textShadow: '0 3px 14px rgba(0,0,0,0.78)' }}>{title}</h1>
						<p className="text-sm text-white/74 sm:text-[15px]" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.68)' }}>{subtitle}</p>
					</div>
				</div>
			</div>
		</>
	);
}

function AnimatedPickBackground() {
	return (
		<div className="absolute inset-0 overflow-hidden" style={{ background: '#060311' }}>
			{/* ── Layer 1: Core aurora — centered, smaller so corners stay truly dark ── */}
			<motion.div
				className="absolute pointer-events-none"
				style={{
					width: '120%', height: '120%',
					top: '-10%', left: '-10%',
					background: 'conic-gradient(from 200deg at 50% 50%, #2e0e7a 0deg, #0e2880 60deg, #043858 120deg, #4a1080 180deg, #700e3a 240deg, #32107a 300deg, #2e0e7a 360deg)',
					filter: 'blur(72px)',
					borderRadius: '50%',
					opacity: 0.9,
					willChange: 'transform',
				}}
				animate={{ rotate: [0, 360] }}
				transition={{ duration: 65, repeat: Infinity, ease: 'linear' }}
			/>

			{/* ── Layer 2: Counter-rotating, tighter ring ── */}
			<motion.div
				className="absolute pointer-events-none"
				style={{
					width: '100%', height: '100%',
					top: '0%', left: '0%',
					background: 'conic-gradient(from 0deg at 50% 50%, #28086a 0deg, #023052 90deg, #580870 180deg, #0e1468 270deg, #28086a 360deg)',
					filter: 'blur(60px)',
					borderRadius: '50%',
					opacity: 0.5,
					willChange: 'transform',
				}}
				animate={{ rotate: [360, 0] }}
				transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
			/>

			{/* ── Layer 3: Edge vignette — kills any light reaching the corners ── */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 25%, rgba(6,3,17,0.55) 60%, rgba(6,3,17,0.93) 100%)',
				}}
			/>

			{/* ── Layer 4: Deep rose accent, bottom-right ── */}
			<motion.div
				className="absolute rounded-full pointer-events-none"
				style={{
					width: '38%', height: '32%',
					background: 'radial-gradient(circle, rgba(130,12,48,0.38) 0%, transparent 70%)',
					filter: 'blur(38px)',
					bottom: '14%', right: '8%',
				}}
				animate={{ x: [0, -18, 10, 0], y: [0, 10, -6, 0], opacity: [0.5, 0.75, 0.5, 0.5] }}
				transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
			/>

			{/* ── Layer 5: Violet accent, top-left ── */}
			<motion.div
				className="absolute rounded-full pointer-events-none"
				style={{
					width: '32%', height: '28%',
					background: 'radial-gradient(circle, rgba(50,10,120,0.42) 0%, transparent 70%)',
					filter: 'blur(32px)',
					top: '10%', left: '6%',
				}}
				animate={{ x: [0, 14, -8, 0], y: [0, -10, 6, 0], opacity: [0.4, 0.6, 0.4, 0.4] }}
				transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
			/>

			{/* ── Layer 6: Film-grain noise ── */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 512 512\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.04\'/%3E%3C/svg%3E")',
					backgroundSize: '200px 200px',
					opacity: 0.35,
					mixBlendMode: 'overlay',
				}}
			/>
		</div>
	);
}

function StoryStageShell({ backgroundImageUrl, children, variant = 'default', expanded = false }) {
	const shellOverlayClass = variant === 'pick' ? 'absolute inset-0 bg-black/10' : variant === 'preview' ? 'absolute inset-0 bg-black/14' : 'absolute inset-0 bg-black/28';
	const topGradientClass = variant === 'pick'
		? 'absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/12 via-black/4 to-transparent pointer-events-none rounded-t-[inherit]'
		: 'absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/32 to-transparent pointer-events-none rounded-t-[inherit]';
	const bottomGradientClass = variant === 'pick'
		? 'absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/24 via-black/8 to-transparent pointer-events-none rounded-b-[inherit]'
		: variant === 'preview'
			? 'absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/58 via-black/12 to-transparent pointer-events-none rounded-b-[inherit]'
			: 'absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/58 via-black/16 to-transparent pointer-events-none rounded-b-[inherit]';

	const useAnimatedBg = variant === 'pick' && !backgroundImageUrl;
	const frameWidthClass = variant === 'preview' && expanded ? 'lg:max-w-[900px] xl:max-w-[1040px]' : 'lg:max-w-[520px]';

	return (
		<div className={`${STORY_STAGE_FRAME_CLASS} ${frameWidthClass}`}>
			{useAnimatedBg ? (
				<AnimatedPickBackground />
			) : (
				<div
					className="absolute inset-0"
					style={{
						background: 'radial-gradient(circle at 20% 20%, rgba(212,175,55,0.12), transparent 32%), radial-gradient(circle at 82% 18%, rgba(120,16,42,0.16), transparent 28%), linear-gradient(180deg, rgba(10,10,16,0.98) 0%, rgba(17,17,24,0.96) 100%)',
					}}
				/>
			)}
			<AnimatePresence initial={false} mode="sync">
				{backgroundImageUrl && (
					<motion.img
						key={backgroundImageUrl}
						src={backgroundImageUrl}
						alt=""
						className="absolute inset-0 w-full h-full object-cover"
						initial={{ opacity: 0, scale: 1.065 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 1.015 }}
						transition={{ duration: 0.42, ease: 'easeOut' }}
					/>
				)}
			</AnimatePresence>
			<div className={shellOverlayClass} />
			<div className={topGradientClass} />
			<div className={bottomGradientClass} />
			<div className="relative z-10 flex h-full flex-col">{children}</div>
		</div>
	);
}

export default function StoryUploadPage() {
	const navigate = useNavigate();
	const { user, siteSettings, setUser } = useAuth();
	const maxStoryDurationSeconds = Math.max(1, Number(siteSettings?.storyMaxDurationSeconds || 15));
	const showProgressHud = siteSettings?.encoderShowProgressHud === true;
	const encoderThreads = Math.max(1, Number(siteSettings?.encoderThreads || 4));
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
	const uploadTokenRef = useRef('');
	const resultPreviewUrlRef = useRef('');
	const resultPosterUrlRef = useRef('');
	const encodedFileRef = useRef(null);
	const activeEncodeDurationRef = useRef(0);
	const isTranscodingRef = useRef(false);
	const timerIntervalRef = useRef(null);
	const timerStartRef = useRef(0);

	const [encodingProgress, setEncodingProgress] = useState(0);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [phase, setPhase] = useState('idle');
	const [sourceFile, setSourceFile] = useState(null);
	const [sourceDuration, setSourceDuration] = useState(0);
	const [sourceResolution, setSourceResolution] = useState(null);
	const [processing, setProcessing] = useState(false);
	const [result, setResult] = useState(null);
	const [errorMessage, setErrorMessage] = useState('');
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [showPreview, setShowPreview] = useState(false);
	const [previewConfirmed, setPreviewConfirmed] = useState(false);
	const [engineStatus, setEngineStatus] = useState('idle');
	const [storyBackdropUrl, setStoryBackdropUrl] = useState('');
	const [storyPreviewExpanded, setStoryPreviewExpanded] = useState(false);

	const outputProfile = getOutputProfile(sourceResolution);
	const storyStep = result ? (showPreview ? 'preview' : previewConfirmed ? 'done' : 'preview') : sourceFile ? 'process' : 'pick';
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
			if (resultPreviewUrlRef.current) URL.revokeObjectURL(resultPreviewUrlRef.current);
			if (resultPosterUrlRef.current) URL.revokeObjectURL(resultPosterUrlRef.current);
			clearInterval(timerIntervalRef.current);
		};
	}, []);

	useEffect(() => () => {
		if (storyBackdropUrl) {
			URL.revokeObjectURL(storyBackdropUrl);
		}
	}, [storyBackdropUrl]);

	const ensureEngineLoaded = async ({ suppressErrors = false } = {}) => {
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
			if (!suppressErrors) {
				setErrorMessage(error?.message || 'Error al cargar FFmpeg.');
			}
			throw error;
		} finally {
			loadPromiseRef.current = null;
		}

		return ffmpeg;
	};

	useEffect(() => {
		let cancelled = false;

		setEngineStatus(ffmpegRef.current?.loaded ? 'ready' : 'loading');

		ensureEngineLoaded({ suppressErrors: true })
			.then(() => {
				if (!cancelled) {
					setEngineStatus('ready');
				}
			})
			.catch(() => {
				if (!cancelled) {
					setEngineStatus('idle');
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const resetResult = () => {
		if (resultPreviewUrlRef.current) {
			URL.revokeObjectURL(resultPreviewUrlRef.current);
			resultPreviewUrlRef.current = '';
		}
		if (resultPosterUrlRef.current) {
			URL.revokeObjectURL(resultPosterUrlRef.current);
			resultPosterUrlRef.current = '';
		}
		setResult(null);
	};

	const resetStoryBackdrop = () => {
		if (storyBackdropUrl) {
			URL.revokeObjectURL(storyBackdropUrl);
		}
		setStoryBackdropUrl('');
	};

	const resetStoryFlow = () => {
		resetResult();
		resetStoryBackdrop();
		encodedFileRef.current = null;
		setSourceFile(null);
		setSourceDuration(0);
		setSourceResolution(null);
		setEncodingProgress(0);
		setUploadProgress(0);
		setElapsedSeconds(0);
		setShowPreview(false);
		setPreviewConfirmed(false);
		setStoryPreviewExpanded(false);
		setVipOnlyStory(false);
		uploadTokenRef.current = '';
		setPhase('idle');
		setErrorMessage('');
		clearInterval(timerIntervalRef.current);
		timerIntervalRef.current = null;
	};

	const startElapsedTimer = () => {
		setElapsedSeconds(0);
		clearInterval(timerIntervalRef.current);
		timerStartRef.current = performance.now();
		timerIntervalRef.current = setInterval(() => {
			setElapsedSeconds((performance.now() - timerStartRef.current) / 1000);
		}, 100);
	};

	const stopElapsedTimer = () => {
		clearInterval(timerIntervalRef.current);
		timerIntervalRef.current = null;
	};

	const handleFileChange = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;

		resetResult();
		resetStoryBackdrop();
		setErrorMessage('');
		setSourceDuration(0);
		setSourceResolution(null);
		setSourceFile(file);
		uploadTokenRef.current = getToken() || '';
		setEncodingProgress(0);
		setUploadProgress(0);
		setPhase('preparing');
		setProcessing(true);
		startElapsedTimer();

		const tempSourceUrl = URL.createObjectURL(file);

		try {
			const enginePromise = ensureEngineLoaded();
			const metadata = await withTimeout(
				loadVideoMetadata(tempSourceUrl),
				8000,
				'No se pudo leer el video seleccionado.'
			);
			const backdropUrl = await withTimeout(
				captureVideoPoster(tempSourceUrl),
				3500,
				'No se pudo capturar la portada del video.'
			).catch(() => '');
			await enginePromise;

			setSourceDuration(metadata.duration);
			setSourceResolution(metadata.resolution);
			if (backdropUrl) {
				setStoryBackdropUrl(backdropUrl);
			}
			await processAndUploadStory({
				file,
				duration: metadata.duration,
				resolution: metadata.resolution,
				skipSetup: true,
			});
		} catch (error) {
			setErrorMessage(error?.message || 'No se pudo preparar la historia.');
			setPhase('idle');
			setProcessing(false);
			stopElapsedTimer();
			isTranscodingRef.current = false;
			activeEncodeDurationRef.current = 0;
		} finally {
			URL.revokeObjectURL(tempSourceUrl);
		}
	};

	const encodeStoryVideo = async ({ file, duration, resolution }) => {
		const ffmpeg = await ensureEngineLoaded();
		const inputExtension = file.name.split('.').pop()?.toLowerCase() || 'mp4';
		const inputFileName = `input.${inputExtension}`;
		const outputFileName = `${getFileStem(file.name)}-story.mp4`;
		const safeDuration = Math.max(0.1, Math.min(duration || maxStoryDurationSeconds, maxStoryDurationSeconds));
		const outputProfile = getOutputProfile(resolution);

		activeEncodeDurationRef.current = safeDuration;

		try { await ffmpeg.deleteFile(inputFileName); } catch {}
		try { await ffmpeg.deleteFile(outputFileName); } catch {}

		const inputData = await fetchFile(file);
		await ffmpeg.writeFile(inputFileName, inputData);

		const sharedArgs = [
			'-i', inputFileName,
			'-t', safeDuration.toFixed(2),
			'-vf', `${outputProfile.scaleFilter},setsar=1`,
			'-movflags', '+faststart',
		];

		let exitCode = await ffmpeg.exec([
			...sharedArgs,
			'-c:v', 'libx264',
			'-threads', String(encoderThreads),
			'-x264-params', `sliced-threads=1:threads=${encoderThreads}`,
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
				'-threads', String(encoderThreads),
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
			duration: safeDuration,
		};
	};

	const processAndUploadStory = async ({ file = sourceFile, duration = sourceDuration, resolution = sourceResolution, skipSetup = false } = {}) => {
		if (!file) {
			setErrorMessage('Primero sube un video.');
			return;
		}

		try {
			resetResult();
			setErrorMessage('');
			if (!skipSetup) {
				setProcessing(true);
				startElapsedTimer();
			}
			setPhase('encoding');
			isTranscodingRef.current = true;
			setEncodingProgress(0);
			setUploadProgress(0);

			const encoded = await encodeStoryVideo({ file, duration, resolution });
			const processingElapsedSeconds = (performance.now() - timerStartRef.current) / 1000;
			const encodedPosterUrl = await withTimeout(
				captureVideoPoster(encoded.previewUrl),
				3500,
				'No se pudo capturar la portada final de la historia.'
			).catch(() => '');

			resultPreviewUrlRef.current = encoded.previewUrl;
			resultPosterUrlRef.current = encodedPosterUrl;
			encodedFileRef.current = encoded.file;
			setEncodingProgress(1);
			setPhase('encoded');
			setResult({
				previewUrl: encoded.previewUrl,
				posterUrl: encodedPosterUrl,
				fileName: encoded.fileName,
				sizeLabel: encoded.sizeLabel,
				originalSizeLabel: file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : null,
				duration: encoded.duration,
				processingTimeLabel: formatElapsedSeconds(processingElapsedSeconds),
			});
			setPreviewConfirmed(false);
			setShowPreview(true);
		} catch (error) {
			setErrorMessage(error?.message || 'No se pudo preparar la historia.');
			setPhase('idle');
		} finally {
			stopElapsedTimer();
			setProcessing(false);
			isTranscodingRef.current = false;
			activeEncodeDurationRef.current = 0;
		}
	};

	const handlePublish = async () => {
		if (!encodedFileRef.current) return;
		try {
			setPhase('uploading');
			setUploadProgress(0);
			const story = await uploadStory(encodedFileRef.current, {
				tokenOverride: uploadTokenRef.current || getToken() || undefined,
				vipOnly: false,
				onProgress: (progress) => setUploadProgress(clamp(progress, 0, 1)),
			});
			setUploadProgress(1);
			setPhase('done');
			setUser(prev => ({
				...prev,
				has_active_story: true,
				active_story_id: story?.id || null,
				active_story_url: story?.video_url || null,
			}));
			try {
				removeViewedStoryUser(user?.id, user?.id);
			} catch {}
			encodedFileRef.current = null;
			navigate(returnPath);
		} catch (error) {
			setErrorMessage(error?.message || 'No se pudo publicar la historia.');
			setPhase('encoded');
		}
	};

	const maskedEncodingProgress = clamp(encodingProgress, 0, 1);
	const loadingStoryProgress = phase === 'preparing'
		? 0
		: clamp(maskedEncodingProgress * 2, 0, 1);
	const loadingStoryPercent = Math.round(loadingStoryProgress * 100);
	const progressValue = loadingStoryProgress;
	const progressLabel = phase === 'preparing'
		? 'Iniciando historia'
		: 'Cargando historia';
	const debugProgressValue = phase === 'preparing'
		? 0
		: phase === 'encoding'
			? maskedEncodingProgress
			: phase === 'encoded' || phase === 'done'
				? 1
				: 0;
	const debugProgressLabel = phase === 'preparing'
		? 'Preparando motor'
		: phase === 'encoding'
			? 'Encoding real'
			: 'Completado';
	const shellVariant = storyStep === 'pick' ? 'pick' : storyStep === 'preview' ? 'preview' : 'default';
	const activeShellBackgroundUrl = storyBackdropUrl;
	const location = useLocation();
	const returnPath = location.state?.from || '/perfil';
	const closeStoryUpload = () => navigate(returnPath);

	const headerConfig = storyStep === 'pick'
		? {
			title: 'Nueva Historia',
			subtitle: 'Selecciona tu video para publicarlo como historia.',
			showClose: true,
			onClose: closeStoryUpload,
			closeLabel: 'Cerrar nueva historia',
		}
		: storyStep === 'process'
			? {
				title: 'Prepará tu historia',
				subtitle: 'En cuanto eliges el archivo, empezamos a prepararlo automáticamente.',
				showClose: true,
				onClose: closeStoryUpload,
				closeLabel: 'Cerrar',
			}
			: storyStep === 'preview'
				? {
					title: 'Revisá tu historia',
					subtitle: 'Confirmá la vista previa antes de publicarla.',
					showClose: true,
					onClose: closeStoryUpload,
					closeLabel: 'Cerrar vista previa de historia',
				}
				: {
					title: 'Historia publicada',
					subtitle: 'La historia ya está publicada.',
					showClose: true,
					onClose: () => navigate(returnPath),
					closeLabel: 'Volver al panel de control',
				};

	return (
		<div className="min-h-screen bg-mansion-base text-text-primary relative overflow-hidden">
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-mansion-crimson/10 blur-3xl" />
				<div className="absolute bottom-[-12%] left-[-6%] w-[460px] h-[460px] rounded-full bg-mansion-gold/10 blur-3xl" />
			</div>

			<div className="relative w-full h-[100dvh]">
				<div className={STORY_STAGE_VIEWPORT_CLASS}>
					<StoryStageShell backgroundImageUrl={activeShellBackgroundUrl} variant={shellVariant} expanded={storyPreviewExpanded}>
						{storyStep !== 'preview' && (
							<StoryStageHeader
								steps={storySteps}
								currentStepIndex={storyStepIndex}
								title={headerConfig.title}
								subtitle={headerConfig.subtitle}
								showClose={headerConfig.showClose}
								onClose={headerConfig.onClose}
								closeLabel={headerConfig.closeLabel}
							/>
						)}
						<AnimatePresence mode="sync" initial={false}>
							{storyStep === 'pick' && (
								<motion.section
							key="pick"
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							transition={{ duration: 0.28, ease: 'easeOut' }}
							style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
							className="absolute inset-0"
						>
									<div className="flex h-full flex-col items-center justify-center px-8 pb-10 pt-44 text-center sm:pt-48">
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.08, duration: 0.28, ease: 'easeOut' }}
										style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
										className="w-20 h-20 rounded-[1.25rem] bg-mansion-gold/10 border border-mansion-gold/20 flex items-center justify-center mb-6 shadow-[0_0_0_1px_rgba(212,175,55,0.06)]"
									>
										<Film className="w-9 h-9 text-mansion-gold" />
									</motion.div>
									<label className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors cursor-pointer shadow-[0_12px_30px_rgba(212,175,55,0.18)]">
										<Upload className="w-5 h-5" />
										Seleccionar video
										<input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
									</label>
									{showProgressHud && engineStatus === 'loading' && (
										<p className="text-xs text-white/56 mt-4" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>Preparando el motor de video para acelerar el siguiente paso...</p>
									)}
									{showProgressHud && engineStatus === 'ready' && (
										<p className="text-xs text-mansion-gold/95 mt-4" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>Motor de video listo. El procesamiento arrancará más rápido al elegir el archivo.</p>
									)}
								</div>
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
									className="absolute inset-0"
								>
									<div className="flex h-full flex-col px-6 pb-8 pt-44 sm:px-8 sm:pt-48">
										<div className="mt-auto mb-6 sm:mb-10">
											<motion.div
												initial={{ opacity: 0, y: 12 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ delay: 0.12, duration: 0.28, ease: 'easeOut' }}
												style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
											>
												{!processing ? (
													<div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-black/38 backdrop-blur-md p-5 sm:p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
														<p className="text-sm text-white font-medium">El archivo ya fue seleccionado.</p>
														<p className="text-xs text-white/65 mt-1">Si hubo un error, puedes elegir otro video para reintentar.</p>
														<label className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white/8 border border-white/10 text-white font-medium hover:bg-white/12 transition-colors cursor-pointer">
															<Upload className="w-5 h-5" />
															Elegir otro video
															<input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
														</label>
														{sourceDuration > maxStoryDurationSeconds && (
															<div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
																Se procesarán solo los primeros {maxStoryDurationSeconds}s de este video.
															</div>
														)}
													</div>
												) : (
													<div className="rounded-[1.75rem] border border-white/12 bg-black/45 backdrop-blur-md p-6 sm:p-7 shadow-[0_16px_48px_rgba(0,0,0,0.32)]">
														{/* Spinner + label */}
														<div className="flex items-center gap-5 mb-6">
															<div className="relative flex-shrink-0">
																<svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
																	<circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
																	<circle
																		cx="28" cy="28" r="23" fill="none"
																		stroke="url(#spinGrad)" strokeWidth="4"
																		strokeLinecap="round"
																		strokeDasharray={`${144.5 * loadingStoryProgress} 144.5`}
																		style={{ transition: 'stroke-dasharray 0.35s ease' }}
																	/>
																	<defs>
																		<linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
																			<stop offset="0%" stopColor="#d4af37" />
																			<stop offset="100%" stopColor="#f0d060" />
																		</linearGradient>
																	</defs>
																</svg>
																<span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-mansion-gold tabular-nums">{loadingStoryPercent}%</span>
															</div>
															<div className="flex-1 min-w-0">
																<p className="text-base font-semibold text-white leading-snug">
																	{phase === 'preparing' ? 'Preparando…' : 'Optimizando video…'}
																</p>
																<p className="text-sm text-white/50 mt-1 truncate">
																	{phase === 'preparing' ? 'Cargando motor de video' : 'Comprimiendo y optimizando'}
																</p>
															</div>
														</div>
														{/* Encoding progress bar */}
														<div className="space-y-2">
															<div className="flex items-center justify-between text-sm text-white/55">
																<span>Procesando</span>
																<span className="tabular-nums font-medium">{loadingStoryPercent}%</span>
															</div>
															<div className="h-2.5 w-full rounded-full bg-white/8 overflow-hidden">
																<div className="h-full rounded-full bg-gradient-to-r from-mansion-gold to-mansion-gold-light transition-all duration-300" style={{ width: `${loadingStoryPercent}%` }} />
															</div>
														</div>
													</div>
												)}
											</motion.div>
											{errorMessage && !processing && <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errorMessage}</div>}
										</div>
									</div>
								</motion.section>
							)}

							{storyStep === 'preview' && result && (
								<motion.section
									key="preview"
									initial={false}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.24, ease: 'easeOut' }}
									className="absolute inset-0"
								>
									<StoryPreviewOverlay
										videoUrl={result.previewUrl}
										caption={result.caption}
										user={user}
										avatarSize={siteSettings?.videoAvatarSize ?? 52}
										uploading={phase === 'uploading'}
										uploadProgress={uploadProgress}
										onClose={resetStoryFlow}
										onDismiss={() => { resetStoryFlow(); navigate(returnPath); }}
										onConfirm={handlePublish}
										landscapeExpanded={storyPreviewExpanded}
										onLandscapeExpandedChange={setStoryPreviewExpanded}
									/>
								</motion.section>
							)}
						</AnimatePresence>

					</StoryStageShell>
				</div>
			</div>

			{processing && showProgressHud && (
				<div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-black/88 border border-white/10 shadow-2xl">
					<Clock className="w-5 h-5 text-mansion-gold" />
					<div>
						<p className="text-[10px] uppercase tracking-[0.2em] text-text-dim">{debugProgressLabel}</p>
						<p className="text-2xl font-display font-bold text-text-primary tabular-nums">{formatDebugTimer(elapsedSeconds)}</p>
					</div>
					<div className="ml-2 text-right">
						<p className="text-lg font-bold text-mansion-gold tabular-nums">{Math.round(debugProgressValue * 100)}%</p>
					</div>
				</div>
			)}
		</div>
	);
}
