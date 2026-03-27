import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, Download, Film, LoaderCircle, Play, Scissors, Upload, Wand2 } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const MAX_CLIP_SECONDS = 15;
const LANDSCAPE_WIDTH = 1280;
const LANDSCAPE_HEIGHT = 720;
const PORTRAIT_WIDTH = 720;
const PORTRAIT_HEIGHT = 1280;
const FFMPEG_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
const STORY_PRESET = {
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

function getFileStem(filename = 'clip') {
	return filename.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'clip';
}

function parseFfmpegTime(message) {
	const match = message.match(/time=(\d+):(\d+):([\d.]+)/);
	if (!match) return null;
	const [, hh, mm, ss] = match;
	return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

async function downloadBlobUrl(url, mimeType, onProgress) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`No se pudo descargar ${url}`);
	}

	const total = Number(response.headers.get('content-length') || 0);
	if (!response.body) {
		const buffer = await response.arrayBuffer();
		onProgress?.(1);
		return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
	}

	const reader = response.body.getReader();
	const chunks = [];
	let received = 0;

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
		chunks.push(value);
		received += value.length;
		if (total > 0) {
			onProgress?.(received / total);
		}
	}

	onProgress?.(1);
	return URL.createObjectURL(new Blob(chunks, { type: mimeType }));
}

export default function StoryUploadPage() {
	const ffmpegRef = useRef(null);
	const loadPromiseRef = useRef(null);
	const videoRef = useRef(null);
	const sourceUrlRef = useRef('');
	const resultUrlRef = useRef('');
	const activeSegmentDurationRef = useRef(0);
	const isTranscodingRef = useRef(false);
	const timerIntervalRef = useRef(null);
	const timerStartRef = useRef(0);
	const trimmerRef = useRef(null);
	const draggingRef = useRef(null);

	const [processingProgress, setProcessingProgress] = useState(0);
	const [sourceFile, setSourceFile] = useState(null);
	const [sourceUrl, setSourceUrl] = useState('');
	const [sourceDuration, setSourceDuration] = useState(0);
	const [sourceResolution, setSourceResolution] = useState(null);
	const [clipStart, setClipStart] = useState(0);
	const [clipEnd, setClipEnd] = useState(0);
	const [thumbnails, setThumbnails] = useState([]);
	const [processing, setProcessing] = useState(false);
	const [result, setResult] = useState(null);
	const [errorMessage, setErrorMessage] = useState('');
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [useCompactStoryTrimmer, setUseCompactStoryTrimmer] = useState(false);

	const selectedDuration = clipEnd > clipStart ? clipEnd - clipStart : 0;
	const segmentWidth = sourceDuration > 0 ? ((clipEnd - clipStart) / sourceDuration) * 100 : 0;
	const segmentOffset = sourceDuration > 0 ? (clipStart / sourceDuration) * 100 : 0;
	const outputProfile = getOutputProfile(sourceResolution);
	const storyStep = result?.url ? 'done' : sourceFile ? 'trim' : 'pick';
	const storyStepIndex = storyStep === 'pick' ? 0 : storyStep === 'trim' ? 1 : 2;
	const storySteps = [
		{ id: 'pick', label: 'Elegir' },
		{ id: 'trim', label: 'Recortar' },
		{ id: 'done', label: 'Lista' },
	];

	if (!ffmpegRef.current) {
		ffmpegRef.current = new FFmpeg();
	}

	useEffect(() => {
		const ffmpeg = ffmpegRef.current;

		const handleProgress = () => {};

		const handleLog = ({ message }) => {
			if (isTranscodingRef.current) {
				const elapsed = parseFfmpegTime(message);
				if (elapsed !== null && activeSegmentDurationRef.current > 0) {
					const pct = clamp(elapsed / activeSegmentDurationRef.current, 0, 0.99);
					setProcessingProgress(pct);
				}
			}
		};

		ffmpeg.on('progress', handleProgress);
		ffmpeg.on('log', handleLog);

		return () => {
			ffmpeg.off('progress', handleProgress);
			ffmpeg.off('log', handleLog);
			ffmpeg.terminate();
			if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
			if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
			clearInterval(timerIntervalRef.current);
		};
	}, []);

	useEffect(() => {
		sourceUrlRef.current = sourceUrl;
	}, [sourceUrl]);

	useEffect(() => {
		resultUrlRef.current = result?.url || '';
	}, [result]);

	useEffect(() => {
		if (typeof window === 'undefined') return undefined;

		const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
		const smallViewportQuery = window.matchMedia('(max-width: 767px)');
		const standaloneQuery = window.matchMedia('(display-mode: standalone)');

		const syncCompactStoryTrimmer = () => {
			setUseCompactStoryTrimmer(
				coarsePointerQuery.matches ||
				smallViewportQuery.matches ||
				standaloneQuery.matches ||
				window.navigator.standalone === true
			);
		};

		syncCompactStoryTrimmer();

		const subscribe = (query) => {
			if (typeof query.addEventListener === 'function') {
				query.addEventListener('change', syncCompactStoryTrimmer);
				return () => query.removeEventListener('change', syncCompactStoryTrimmer);
			}

			query.addListener(syncCompactStoryTrimmer);
			return () => query.removeListener(syncCompactStoryTrimmer);
		};

		const unsubscribers = [
			subscribe(coarsePointerQuery),
			subscribe(smallViewportQuery),
			subscribe(standaloneQuery),
		];

		return () => {
			unsubscribers.forEach((unsubscribe) => unsubscribe());
		};
	}, []);

	useEffect(() => {
		if (!sourceUrl || sourceDuration <= 0) {
			setThumbnails([]);
			return undefined;
		}

		let cancelled = false;
		const video = document.createElement('video');
		video.muted = true;
		video.preload = 'auto';
		video.src = sourceUrl;
		const count = Math.min(20, Math.max(10, Math.ceil(sourceDuration / 1.5)));
		const step = sourceDuration / count;
		const canvas = document.createElement('canvas');
		canvas.width = 80;
		canvas.height = 56;
		const ctx = canvas.getContext('2d');

		video.onloadeddata = async () => {
			if (!ctx) return;
			const thumbs = [];
			for (let index = 0; index < count; index += 1) {
				if (cancelled) return;
				video.currentTime = Math.min(index * step + 0.01, sourceDuration - 0.01);
				await new Promise((resolve) => {
					video.onseeked = resolve;
				});
				ctx.drawImage(video, 0, 0, 80, 56);
				thumbs.push(canvas.toDataURL('image/jpeg', 0.4));
			}
			if (!cancelled) setThumbnails(thumbs);
		};

		return () => {
			cancelled = true;
		};
	}, [sourceUrl, sourceDuration]);

	const ensureEngineLoaded = async () => {
		const ffmpeg = ffmpegRef.current;
		if (ffmpeg.loaded) return ffmpeg;
		if (loadPromiseRef.current) {
			await loadPromiseRef.current;
			return ffmpeg;
		}

		loadPromiseRef.current = (async () => {
			let coreJsProgress = 0;
			let wasmProgress = 0;

			const coreURL = await downloadBlobUrl(
				`${FFMPEG_BASE_URL}/ffmpeg-core.js`,
				'text/javascript',
				(progress) => {
					coreJsProgress = progress;
				}
			);

			const wasmURL = await downloadBlobUrl(
				`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`,
				'application/wasm',
				(progress) => {
					wasmProgress = progress;
				}
			);

			if (coreJsProgress >= 0 || wasmProgress >= 0) {
				await ffmpeg.load({ coreURL, wasmURL });
			}
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
		if (resultUrlRef.current) {
			URL.revokeObjectURL(resultUrlRef.current);
			resultUrlRef.current = '';
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
		setClipStart(0);
		setClipEnd(0);
		setThumbnails([]);
		setProcessingProgress(0);
		setErrorMessage('');
	};

	const handleFileChange = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;

		resetResult();
		setErrorMessage('');
		setClipStart(0);
		setClipEnd(0);
		setSourceDuration(0);
		setSourceResolution(null);
		setSourceFile(file);
		setProcessingProgress(0);

		const nextSourceUrl = URL.createObjectURL(file);
		if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
		setSourceUrl(nextSourceUrl);

		await ensureEngineLoaded().catch(() => {});
	};

	const handleLoadedMetadata = () => {
		const video = videoRef.current;
		if (!video) return;
		const duration = video.duration || 0;
		setSourceDuration(duration);
		setSourceResolution(video.videoWidth && video.videoHeight ? { width: video.videoWidth, height: video.videoHeight } : null);
		setClipStart(0);
		setClipEnd(Math.min(duration, MAX_CLIP_SECONDS));
	};

	const syncPreviewToSelection = (nextStart) => {
		const video = videoRef.current;
		if (!video) return;
		video.currentTime = nextStart;
	};

	const handleStartChange = (nextValue) => {
		const nextStart = clamp(Number(nextValue), 0, Math.max(0, sourceDuration - 1));
		const nextEnd = Math.min(sourceDuration, nextStart + MAX_CLIP_SECONDS);
		setClipStart(nextStart);
		setClipEnd(nextEnd);
		syncPreviewToSelection(nextStart);
	};

	const handleUseCurrentTime = () => {
		const video = videoRef.current;
		if (!video) return;
		handleStartChange(video.currentTime || 0);
	};

	const handlePreviewSegment = async () => {
		const video = videoRef.current;
		if (!video) return;
		video.currentTime = clipStart;
		try {
			await video.play();
		} catch {
			// Ignore autoplay restrictions.
		}
	};

	const handlePreviewTimeUpdate = () => {
		const video = videoRef.current;
		if (!video || clipEnd <= clipStart) return;
		if (video.currentTime >= clipEnd) {
			video.currentTime = clipStart;
			if (!video.paused) {
				video.play().catch(() => {});
			}
		}
	};

	const onHandlePointerDown = (event, handle) => {
		event.preventDefault();
		draggingRef.current = handle;
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onHandlePointerMove = (event) => {
		const handle = draggingRef.current;
		if (!handle) return;
		const element = trimmerRef.current;
		if (!element || sourceDuration <= 0) return;
		const rect = element.getBoundingClientRect();
		const frac = clamp((event.clientX - rect.left) / rect.width, 0, 1);
		const time = frac * sourceDuration;
		if (handle === 'left') {
			const minStart = Math.max(0, clipEnd - MAX_CLIP_SECONDS);
			const newStart = clamp(time, minStart, clipEnd - 0.5);
			setClipStart(newStart);
			syncPreviewToSelection(newStart);
			return;
		}

		const maxEnd = Math.min(sourceDuration, clipStart + MAX_CLIP_SECONDS);
		const newEnd = clamp(time, clipStart + 0.5, maxEnd);
		setClipEnd(newEnd);
		if (videoRef.current) videoRef.current.currentTime = newEnd;
	};

	const onHandlePointerUp = () => {
		draggingRef.current = null;
	};

	const transcodeVideo = async () => {
		if (!sourceFile) {
			setErrorMessage('Primero sube un video.');
			return;
		}

		try {
			const ffmpeg = await ensureEngineLoaded();
			resetResult();
			setErrorMessage('');
			setProcessing(true);
			isTranscodingRef.current = true;
			setProcessingProgress(0);
			setElapsedSeconds(0);
			timerStartRef.current = performance.now();
			timerIntervalRef.current = setInterval(() => {
				setElapsedSeconds(Math.floor((performance.now() - timerStartRef.current) / 1000));
			}, 500);

			const inputExtension = sourceFile.name.split('.').pop()?.toLowerCase() || 'mp4';
			const inputFileName = `input.${inputExtension}`;
			const outputFileName = `${getFileStem(sourceFile.name)}-720p-15s.mp4`;
			const segmentDuration = Math.max(0.1, clipEnd - clipStart);
			activeSegmentDurationRef.current = segmentDuration;

			try { await ffmpeg.deleteFile(inputFileName); } catch {}
			try { await ffmpeg.deleteFile(outputFileName); } catch {}

			const inputData = await fetchFile(sourceFile);
			await ffmpeg.writeFile(inputFileName, inputData);

			const sharedArgs = [
				'-ss', clipStart.toFixed(2),
				'-t', segmentDuration.toFixed(2),
				'-i', inputFileName,
				'-vf', `${outputProfile.scaleFilter},setsar=1`,
				'-movflags', '+faststart',
			];

			let exitCode = await ffmpeg.exec([
				...sharedArgs,
				'-c:v', 'libx264',
				'-threads', '4',
				'-x264-params', 'sliced-threads=1:threads=4',
				'-crf', STORY_PRESET.crf,
				'-maxrate', STORY_PRESET.maxrate,
				'-bufsize', STORY_PRESET.bufsize,
				'-preset', STORY_PRESET.preset,
				'-pix_fmt', 'yuv420p',
				'-c:a', 'aac',
				'-b:a', STORY_PRESET.audioBitrate,
				...(STORY_PRESET.audioMono ? ['-ac', '1'] : []),
				outputFileName,
			]);

			if (exitCode !== 0) {
				try { await ffmpeg.deleteFile(outputFileName); } catch {}
				exitCode = await ffmpeg.exec([
					...sharedArgs,
					'-c:v', 'mpeg4',
					'-q:v', '4',
					'-c:a', 'aac',
					'-b:a', STORY_PRESET.audioBitrate,
					...(STORY_PRESET.audioMono ? ['-ac', '1'] : []),
					outputFileName,
				]);
			}

			if (exitCode !== 0) {
				throw new Error('FFmpeg no pudo generar el MP4 final.');
			}

			const data = await ffmpeg.readFile(outputFileName);
			const outputBlob = new Blob([data], { type: 'video/mp4' });
			const outputUrl = URL.createObjectURL(outputBlob);
			const processingElapsedSeconds = (performance.now() - timerStartRef.current) / 1000;

			setProcessingProgress(1);
			setResult({
				url: outputUrl,
				fileName: outputFileName,
				sizeLabel: `${(outputBlob.size / (1024 * 1024)).toFixed(2)} MB`,
				duration: segmentDuration,
				processingTimeLabel: formatElapsedSeconds(processingElapsedSeconds),
			});

			try { await ffmpeg.deleteFile(inputFileName); } catch {}
			try { await ffmpeg.deleteFile(outputFileName); } catch {}
		} catch (error) {
			setErrorMessage(error?.message || 'No se pudo convertir el video.');
		} finally {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
			setProcessing(false);
			isTranscodingRef.current = false;
			activeSegmentDurationRef.current = 0;
		}
	};

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
											<div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-semibold transition-transform duration-300 ${active || complete ? 'bg-mansion-gold text-mansion-base border-mansion-gold scale-100' : 'bg-white/5 text-text-dim border-white/10 scale-95'}`}>
												{index + 1}
											</div>
											<span className={`text-xs uppercase tracking-[0.2em] ${active || complete ? 'text-mansion-gold' : 'text-text-dim'}`}>{step.label}</span>
											{index < storySteps.length - 1 && <div className={`w-8 sm:w-12 h-px ${storyStepIndex > index ? 'bg-mansion-gold/70' : 'bg-white/10'}`} />}
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
							<p className="text-text-muted mt-2 mb-4 max-w-sm">Por favor seleccioná tu video para crear una historia.</p>
							<p className="text-sm text-text-dim max-w-md mb-8">Después vas a poder elegir qué tramo de hasta 15 segundos querés publicar.</p>
							<label className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors cursor-pointer shadow-[0_12px_30px_rgba(212,175,55,0.18)]">
								<Upload className="w-5 h-5" />
								Seleccionar video
								<input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
							</label>
						</motion.section>
					)}

					{storyStep === 'trim' && (
						<motion.section
							key="trim"
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
									<h2 className="font-display text-2xl font-semibold text-text-primary">Ajustá tu historia</h2>
									<p className="text-sm text-text-muted mt-1">Elegí el tramo que querés publicar y después convertí.</p>
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
										onTimeUpdate={handlePreviewTimeUpdate}
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
									transition={{ delay: 0.08, duration: 0.28, ease: 'easeOut' }}
									style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
								>
									<div className="flex items-start justify-between gap-4 mb-4">
										<div className="flex items-start gap-2">
											<Scissors className="w-4 h-4 text-mansion-gold mt-0.5 shrink-0" />
											<p className="text-sm text-text-muted">
												Podés seleccionar la parte del video que deseas publicar <span className="text-text-dim">(opcional)</span>
											</p>
										</div>
										<button
											type="button"
											onClick={handlePreviewSegment}
											disabled={!sourceUrl}
											className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-text-primary hover:border-mansion-gold/30 disabled:opacity-50 transition-colors"
										>
											<Play className="w-4 h-4" />
											Ver
										</button>
									</div>

									{useCompactStoryTrimmer ? (
										<div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
											<div className="flex items-center justify-between gap-3 mb-3 text-xs">
												<span className="text-text-dim">Arrastrá para elegir el inicio</span>
												<button
													type="button"
													onClick={handleUseCurrentTime}
													disabled={!sourceUrl}
													className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-text-primary hover:border-mansion-gold/30 disabled:opacity-50 transition-colors"
												>
													<Scissors className="w-3.5 h-3.5" />
													Usar tiempo actual
												</button>
											</div>
											<input
												type="range"
												min="0"
												max={Math.max(0, sourceDuration - Math.min(MAX_CLIP_SECONDS, sourceDuration))}
												step="0.1"
												value={clipStart}
												onChange={(event) => handleStartChange(event.target.value)}
												className="w-full accent-mansion-gold"
											/>
											<div className="mt-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
												<div className="flex items-center justify-between gap-3 text-xs text-text-dim">
													<span>Inicio {formatTime(clipStart)}</span>
													<span>Fin {formatTime(clipEnd)}</span>
												</div>
												<div className="mt-3 h-2 rounded-full bg-black/30 overflow-hidden">
													<div
														className="h-full bg-gradient-to-r from-mansion-gold to-mansion-gold-light"
														style={{ marginLeft: `${segmentOffset}%`, width: `${Math.max(segmentWidth, 8)}%` }}
													/>
												</div>
											</div>
											<p className="text-xs text-text-dim mt-3">En móvil/PWA usamos un recorte compacto para evitar problemas con previews y thumbnails.</p>
										</div>
									) : (
										<div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-3">
											<div ref={trimmerRef} className="relative h-[64px] rounded-xl bg-black/40 overflow-hidden select-none touch-none">
												<div className="absolute inset-0 flex">
													{thumbnails.length > 0
														? thumbnails.map((src, index) => (
																<img key={src + index} src={src} alt="" className="h-full flex-1 object-cover" draggable={false} />
															))
														: sourceUrl && (
																<div className="flex-1 flex items-center justify-center text-text-dim text-xs">
																	<LoaderCircle className="w-4 h-4 animate-spin mr-2" />
																	Generando vista previa…
																</div>
															)}
												</div>
												<div className="absolute inset-y-0 left-0 bg-black/60 pointer-events-none" style={{ width: `${segmentOffset}%` }} />
												<div className="absolute inset-y-0 right-0 bg-black/60 pointer-events-none" style={{ width: `${Math.max(0, 100 - segmentOffset - segmentWidth)}%` }} />
												<div className="absolute inset-y-0 pointer-events-none" style={{ left: `${segmentOffset}%`, width: `${segmentWidth}%` }}>
													<div className="absolute top-0 left-3.5 right-3.5 h-[3px] bg-mansion-gold" />
													<div className="absolute bottom-0 left-3.5 right-3.5 h-[3px] bg-mansion-gold" />
												</div>
												<div
													className="absolute inset-y-0 z-10 cursor-ew-resize"
													style={{ left: `calc(${segmentOffset}% - 6px)`, width: '20px' }}
													onPointerDown={(event) => onHandlePointerDown(event, 'left')}
													onPointerMove={onHandlePointerMove}
													onPointerUp={onHandlePointerUp}
												>
													<div className="absolute inset-y-0 right-0 w-3.5 bg-mansion-gold rounded-l-lg flex items-center justify-center">
														<div className="w-[2px] h-5 rounded-full bg-mansion-base/40" />
													</div>
												</div>
												<div
													className="absolute inset-y-0 z-10 cursor-ew-resize"
													style={{ left: `calc(${segmentOffset + segmentWidth}% - 14px)`, width: '20px' }}
													onPointerDown={(event) => onHandlePointerDown(event, 'right')}
													onPointerMove={onHandlePointerMove}
													onPointerUp={onHandlePointerUp}
												>
													<div className="absolute inset-y-0 left-0 w-3.5 bg-mansion-gold rounded-r-lg flex items-center justify-center">
														<div className="w-[2px] h-5 rounded-full bg-mansion-base/40" />
													</div>
												</div>
											</div>
										</div>
									)}

									<div className="grid grid-cols-3 gap-3 mt-3 text-xs">
										<div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-left">
											<p className="text-[10px] uppercase tracking-[0.18em] text-text-dim">Inicio</p>
											<p className="text-text-primary mt-1">{formatTime(clipStart)}</p>
										</div>
										<div className="rounded-2xl bg-mansion-gold/10 border border-mansion-gold/20 px-3 py-2 text-center">
											<p className="text-[10px] uppercase tracking-[0.18em] text-mansion-gold/80">Clip</p>
											<p className="text-mansion-gold font-semibold mt-1">{selectedDuration > 0 ? `${selectedDuration.toFixed(1)}s` : '—'}</p>
										</div>
										<div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-right">
											<p className="text-[10px] uppercase tracking-[0.18em] text-text-dim">Fin</p>
											<p className="text-text-primary mt-1">{formatTime(clipEnd)}</p>
										</div>
									</div>
								</motion.div>

								<motion.div
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.14, duration: 0.28, ease: 'easeOut' }}
									style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
									className="mt-6"
								>
									{!processing ? (
										<div className="space-y-3">
											<button
												type="button"
												onClick={transcodeVideo}
												disabled={!selectedDuration}
												className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light disabled:opacity-60 transition-colors shadow-[0_12px_30px_rgba(212,175,55,0.18)]"
											>
												<Wand2 className="w-5 h-5" />
												Crear historia
											</button>
											<p className="text-xs text-text-dim text-center">La conversión ocurre en tu navegador. No se sube el video al servidor.</p>
										</div>
									) : (
										<div className="space-y-3 rounded-[1.5rem] border border-mansion-gold/15 bg-mansion-gold/[0.04] p-4">
											<div className="rounded-2xl bg-black/25 border border-white/10 overflow-hidden">
												<div className="h-3 bg-white/5">
													<div
														className="h-full bg-gradient-to-r from-mansion-gold to-mansion-gold-light transition-all duration-300"
														style={{ width: `${Math.round(processingProgress * 100)}%` }}
													/>
												</div>
											</div>
											<div className="flex items-center justify-between text-sm">
												<span className="text-text-muted">Creando tu historia…</span>
												<span className="font-semibold text-mansion-gold tabular-nums">{Math.round(processingProgress * 100)}%</span>
											</div>
											<p className="text-xs text-text-dim">Mientras se procesa mantenemos las animaciones al mínimo para no competir con el encode.</p>
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
							<div className="px-6 sm:px-8 pt-6 pb-4 border-b border-white/10 bg-white/[0.02]">
								<div className="flex items-center justify-center gap-2">
									{storySteps.map((step, index) => (
										<div key={step.id} className="flex items-center gap-2">
											<div className="w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-semibold bg-mansion-gold text-mansion-base border-mansion-gold">
												{index + 1}
											</div>
											{index < storySteps.length - 1 && <div className="w-8 sm:w-10 h-px bg-mansion-gold/70" />}
										</div>
									))}
								</div>
							</div>
							<div className="aspect-video bg-black">
								<video src={result.url} controls playsInline className="w-full h-full object-contain" />
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
								<h2 className="font-display text-2xl font-bold text-text-primary">¡Tu historia está lista!</h2>
								<p className="text-text-muted mt-1 mb-6 text-sm">
									{result.sizeLabel} · {result.duration.toFixed(1)}s · procesado en {result.processingTimeLabel}
								</p>

								<div className="flex flex-col gap-3">
									<a
										href={result.url}
										download={result.fileName}
										className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors shadow-[0_12px_30px_rgba(212,175,55,0.18)]"
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
								</div>
							</div>
						</motion.section>
					)}
				</AnimatePresence>
			</div>

			{processing && (
				<div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-black/88 border border-white/10 shadow-2xl">
					<Clock className="w-5 h-5 text-mansion-gold" />
					<div>
						<p className="text-[10px] uppercase tracking-[0.2em] text-text-dim">Tiempo de conversión</p>
						<p className="text-2xl font-display font-bold text-text-primary tabular-nums">
							{String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
						</p>
					</div>
					<div className="ml-2 text-right">
						<p className="text-lg font-bold text-mansion-gold tabular-nums">{Math.round(processingProgress * 100)}%</p>
					</div>
				</div>
			)}
		</div>
	);
}
