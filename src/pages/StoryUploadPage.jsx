import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Film, Loader2, Play, Upload } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

/* -- Constants (same as VideoLabPage) -- */
const MAX_CLIP_SECONDS = 15;
const LANDSCAPE_WIDTH = 1280;
const LANDSCAPE_HEIGHT = 720;
const PORTRAIT_WIDTH = 720;
const PORTRAIT_HEIGHT = 1280;
const FFMPEG_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

/* Hardcoded "Normal Quality" preset -- identical to VideoLabPage default */
const activeParams = {
  crf: '29',
  maxrate: '2700k',
  bufsize: '8000k',
  audioBitrate: '64k',
  audioMono: true,
  preset: 'superfast',
};

/* -- Helpers (copied verbatim from VideoLabPage) -- */

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
      width: PORTRAIT_WIDTH,
      height: clampedHeight,
      label: `${PORTRAIT_WIDTH}x${clampedHeight}`,
      orientation: 'portrait',
      scaleFilter: `scale=${PORTRAIT_WIDTH}:-2:flags=bicubic`,
    };
  }

  const scaledWidth = roundToEven((safeWidth / safeHeight) * LANDSCAPE_HEIGHT);
  const clampedWidth = Math.min(Math.max(scaledWidth, LANDSCAPE_HEIGHT), LANDSCAPE_WIDTH);
  return {
    width: clampedWidth,
    height: LANDSCAPE_HEIGHT,
    label: `${clampedWidth}x${LANDSCAPE_HEIGHT}`,
    orientation: 'landscape',
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

/* -- Animations (pick & done steps only) -- */
const fadeSlide = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { animate: { transition: { staggerChildren: 0.1 } } };
const childFade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/* ====================================================================
   Component -- uses EXACT same engine / transcode logic as VideoLabPage
   ==================================================================== */
export default function StoryUploadPage() {
  /* -- Refs (same names as VideoLabPage) -- */
  const ffmpegRef = useRef(null);
  const loadPromiseRef = useRef(null);
  const videoRef = useRef(null);
  const resultUrlRef = useRef('');
  const activeSegmentDurationRef = useRef(0);
  const isTranscodingRef = useRef(false);
  const timerIntervalRef = useRef(null);
  const timerStartRef = useRef(0);

  /* -- State (engineState / processingProgress / statusText match VideoLabPage) -- */
  const [engineState, setEngineState] = useState('idle');
  const [engineProgress, setEngineProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [statusText, setStatusText] = useState('Listo para cargar FFmpeg.');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingResolution, setPendingResolution] = useState(null);
  const [pendingClipEnd, setPendingClipEnd] = useState(0);
  const [pendingSourceUrl, setPendingSourceUrl] = useState('');

  /* UI step for the simple flow */
  const [step, setStep] = useState('pick');

  const engineReady = engineState === 'ready';

  if (!ffmpegRef.current) {
    ffmpegRef.current = new FFmpeg();
  }

  /* -- FFmpeg event listeners (EXACT copy from VideoLabPage) -- */
  useEffect(() => {
    const ffmpeg = ffmpegRef.current;

    const handleProgress = () => {
      // We rely on log-based time= parsing for accurate progress
    };

    const handleLog = ({ message }) => {
      if (isTranscodingRef.current) {
        const elapsed = parseFfmpegTime(message);
        if (elapsed !== null && activeSegmentDurationRef.current > 0) {
          const pct = clamp(elapsed / activeSegmentDurationRef.current, 0, 0.99);
          setProcessingProgress(pct);
        }
      }
      setStatusText(message || 'Procesando...');
    };

    ffmpeg.on('progress', handleProgress);
    ffmpeg.on('log', handleLog);

    return () => {
      ffmpeg.off('progress', handleProgress);
      ffmpeg.off('log', handleLog);
      ffmpeg.terminate();
      if (pendingSourceUrl) URL.revokeObjectURL(pendingSourceUrl);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, [pendingSourceUrl]);

  useEffect(() => {
    resultUrlRef.current = result?.url || '';
  }, [result]);

  /* Preload engine on mount */
  useEffect(() => {
    ensureEngineLoaded().catch(() => {});
  }, []);

  /* -- ensureEngineLoaded (EXACT copy from VideoLabPage) -- */
  const ensureEngineLoaded = async () => {
    const ffmpeg = ffmpegRef.current;
    if (ffmpeg.loaded) return ffmpeg;
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return ffmpeg;
    }

    loadPromiseRef.current = (async () => {
      setErrorMessage('');
      setEngineState('loading');
      setEngineProgress(0.02);
      setStatusText('Descargando el motor de FFmpeg...');

      let coreJsProgress = 0;
      let wasmProgress = 0;

      const syncProgress = () => {
        setEngineProgress(clamp(coreJsProgress * 0.2 + wasmProgress * 0.8, 0.02, 0.92));
      };

      const coreURL = await downloadBlobUrl(
        `${FFMPEG_BASE_URL}/ffmpeg-core.js`,
        'text/javascript',
        (progress) => {
          coreJsProgress = progress;
          syncProgress();
        }
      );

      const wasmURL = await downloadBlobUrl(
        `${FFMPEG_BASE_URL}/ffmpeg-core.wasm`,
        'application/wasm',
        (progress) => {
          wasmProgress = progress;
          syncProgress();
        }
      );

      setStatusText('Inicializando WebAssembly...');
      await ffmpeg.load({ coreURL, wasmURL });
      setEngineProgress(1);
      setEngineState('ready');
      setStatusText('FFmpeg listo para convertir.');
    })();

    try {
      await loadPromiseRef.current;
    } catch (error) {
      setEngineState('error');
      setStatusText('No se pudo cargar FFmpeg.');
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

  const resetPendingSource = () => {
    if (pendingSourceUrl) {
      URL.revokeObjectURL(pendingSourceUrl);
    }
    setPendingSourceUrl('');
  };

  /* -- handleFileChange: pick file -> read metadata -> start transcode -- */
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    resetResult();
    resetPendingSource();
    setErrorMessage('');
    setProcessingProgress(0);
    setPendingFile(null);
    setPendingResolution(null);
    setPendingClipEnd(0);

    /* Read metadata via temp video element */
    const url = URL.createObjectURL(file);
    const tempVid = document.createElement('video');
    tempVid.muted = true;
    tempVid.preload = 'metadata';
    tempVid.src = url;
    const meta = await new Promise((resolve) => {
      tempVid.onloadedmetadata = () => {
        resolve({ duration: tempVid.duration || 0, width: tempVid.videoWidth || 0, height: tempVid.videoHeight || 0 });
      };
      tempVid.onerror = () => resolve({ duration: 0, width: 0, height: 0 });
    });
    tempVid.src = '';
    URL.revokeObjectURL(url);

    const sourceResolution = meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
    const clipEnd = Math.min(meta.duration || 0, MAX_CLIP_SECONDS);

    if (clipEnd <= 0) {
      setErrorMessage('No se pudo leer el video.');
      return;
    }

    setPendingFile(file);
    setPendingResolution(sourceResolution);
    setPendingClipEnd(clipEnd);
    setPendingSourceUrl(URL.createObjectURL(file));
    setStatusText('Archivo listo. Continúa para convertir.');
    setStep('ready');
  };

  const handleContinue = async () => {
    if (!pendingFile || pendingClipEnd <= 0) {
      setErrorMessage('Primero sube un video.');
      return;
    }

    await transcodeVideo(pendingFile, pendingResolution, 0, pendingClipEnd);
  };

  /* -- transcodeVideo (EXACT copy from VideoLabPage.transcodeVideo) -- */
  const transcodeVideo = async (sourceFile, sourceResolution, clipStart, clipEnd) => {
    if (!sourceFile) {
      setErrorMessage('Primero sube un video.');
      return;
    }

    setStep('encoding');
    const startedAt = performance.now();
    const outputProfile = getOutputProfile(sourceResolution);

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
      setStatusText('Preparando el clip...');

      const inputExtension = sourceFile.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inputFileName = `input.${inputExtension}`;
      const outputFileName = `${getFileStem(sourceFile.name)}-story.mp4`;
      const segmentDuration = Math.max(0.1, clipEnd - clipStart);
      activeSegmentDurationRef.current = segmentDuration;

      try { await ffmpeg.deleteFile(inputFileName); } catch {}
      try { await ffmpeg.deleteFile(outputFileName); } catch {}

      await ffmpeg.writeFile(inputFileName, await fetchFile(sourceFile));

      const sharedArgs = [
        '-ss', clipStart.toFixed(2),
        '-t', segmentDuration.toFixed(2),
        '-i', inputFileName,
        '-vf', `${outputProfile.scaleFilter},setsar=1`,
        '-movflags', '+faststart',
      ];

      setStatusText(`Convirtiendo (${outputProfile.label})...`);
      let exitCode = await ffmpeg.exec([
        ...sharedArgs,
        '-c:v', 'libx264',
        '-threads', '4',
        '-x264-params', 'sliced-threads=1:threads=4',
        '-crf', activeParams.crf,
        '-maxrate', activeParams.maxrate,
        '-bufsize', activeParams.bufsize,
        '-preset', activeParams.preset,
        '-pix_fmt', 'yuv420p',
        ...(activeParams.audioBitrate === 'none' ? ['-an'] : ['-c:a', 'aac', '-b:a', activeParams.audioBitrate, ...(activeParams.audioMono ? ['-ac', '1'] : [])]),
        outputFileName,
      ]);

      if (exitCode !== 0) {
        setStatusText('Fallback a codec compatible...');
        try { await ffmpeg.deleteFile(outputFileName); } catch {}
        exitCode = await ffmpeg.exec([
          ...sharedArgs,
          '-c:v', 'mpeg4',
          '-q:v', '4',
          ...(activeParams.audioBitrate === 'none' ? ['-an'] : ['-c:a', 'aac', '-b:a', activeParams.audioBitrate, ...(activeParams.audioMono ? ['-ac', '1'] : [])]),
          outputFileName,
        ]);
      }

      if (exitCode !== 0) {
        throw new Error('FFmpeg no pudo generar el MP4 final.');
      }

      const data = await ffmpeg.readFile(outputFileName);
      const outputBlob = new Blob([data], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(outputBlob);
      const processingElapsedSeconds = (performance.now() - startedAt) / 1000;

      setProcessingProgress(1);
      setStatusText('Clip listo para descargar.');
      setResult({
        url: outputUrl,
        fileName: outputFileName,
        sizeLabel: `${(outputBlob.size / (1024 * 1024)).toFixed(2)} MB`,
        duration: segmentDuration,
        processingTimeLabel: formatElapsedSeconds(processingElapsedSeconds),
      });

      try { await ffmpeg.deleteFile(inputFileName); } catch {}
      try { await ffmpeg.deleteFile(outputFileName); } catch {}

      await new Promise((r) => setTimeout(r, 400));
      setStep('done');
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo convertir el video.');
      setStatusText('Conversion interrumpida.');
      setStep('pick');
    } finally {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      setProcessing(false);
      isTranscodingRef.current = false;
      activeSegmentDurationRef.current = 0;
    }
  };

  const startOver = () => {
    resetResult();
    resetPendingSource();
    setProcessingProgress(0);
    setElapsedSeconds(0);
    setErrorMessage('');
    setStatusText('FFmpeg listo para convertir.');
    setPendingFile(null);
    setPendingResolution(null);
    setPendingClipEnd(0);
    setStep('pick');
  };

  /* ====================================================================
     Render -- simple 3-step UI, no trimmer / presets / sidebar
     ==================================================================== */
  return (
    <div className="min-h-screen bg-mansion-base text-text-primary flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-mansion-gold/[0.06] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-lg z-10">

        {/* -- PICK -- */}
        {step === 'pick' && (
          <motion.div {...fadeSlide} className="flex flex-col items-center text-center py-16">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
              className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-8"
            >
              <Film className="w-9 h-9 text-mansion-gold" />
            </motion.div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">Nueva Historia</h1>
            <p className="text-text-muted text-lg max-w-xs mb-10">
              Selecciona tu video para comenzar.
            </p>

            <label className={`inline-flex items-center gap-3 px-7 py-4 rounded-2xl font-semibold text-lg transition-colors ${
              engineReady
                ? 'bg-mansion-gold text-mansion-base cursor-pointer hover:bg-mansion-gold-light'
                : 'bg-white/[0.06] text-text-muted cursor-not-allowed'
            }`}>
              {engineReady ? (
                <><Upload className="w-5 h-5" />Elegir video</>
              ) : (
                <><Loader2 className="w-5 h-5 animate-spin" />Cargando motor...</>
              )}
              <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} disabled={!engineReady} />
            </label>

            {errorMessage && (
              <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
          </motion.div>
        )}

        {step === 'ready' && pendingFile && (
          <motion.div {...fadeSlide} className="flex flex-col items-center text-center py-16">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
              className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-8"
            >
              <Film className="w-9 h-9 text-mansion-gold" />
            </motion.div>

            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">Video listo</h2>
            <p className="text-text-muted text-lg max-w-sm mb-8">
              El motor ya está cargado y el archivo ya está preparado. Continúa para convertir con el mismo flujo de VideoLab.
            </p>

            <div className="w-full rounded-2xl bg-black/25 border border-white/10 px-4 py-4 mb-8 text-left">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Archivo</p>
              <p className="text-sm text-text-primary mt-1 truncate">{pendingFile.name}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim mt-4">Clip</p>
              <p className="text-sm text-text-primary mt-1">0.0s - {pendingClipEnd.toFixed(1)}s</p>
              {pendingResolution && (
                <>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim mt-4">Resolución</p>
                  <p className="text-sm text-text-primary mt-1">{pendingResolution.width}x{pendingResolution.height}</p>
                </>
              )}
            </div>

            {pendingSourceUrl && (
              <div className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
                <video
                  ref={videoRef}
                  src={pendingSourceUrl}
                  preload="auto"
                  muted
                  playsInline
                  onLoadedData={() => setStatusText('Video precargado. Continúa para convertir.')}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-mansion-crimson text-white font-semibold hover:bg-mansion-crimson-dark transition-colors"
              >
                <Play className="w-4 h-4" />
                Continuar
              </button>
              <button
                type="button"
                onClick={startOver}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-text-primary hover:bg-white/[0.1] transition-colors"
              >
                Elegir otro
              </button>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
          </motion.div>
        )}

        {/* -- ENCODING (plain divs -- zero Framer Motion overhead) -- */}
        {step === 'encoding' && (
          <div className="flex flex-col items-center text-center py-16">
            <h2 className="font-display text-2xl font-bold mb-2">Procesando tu historia...</h2>
            <p className="text-text-muted text-sm mb-6">Esto puede tomar unos segundos.</p>

            <div className="w-full max-w-xs rounded-2xl bg-black/25 border border-white/10 overflow-hidden">
              <div className="h-3 bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-mansion-crimson to-mansion-gold transition-all duration-300"
                  style={{ width: `${Math.round(processingProgress * 100)}%` }}
                />
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-text-muted tabular-nums">
                  {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
                </span>
                <span className="font-semibold text-text-primary tabular-nums">{Math.round(processingProgress * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* -- DONE -- */}
        {step === 'done' && result && (
          <motion.div {...fadeSlide} variants={stagger} initial="initial" animate="animate" className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 16 }}
              className="mb-6"
            >
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
            </motion.div>

            <motion.h2 variants={childFade} className="font-display text-3xl font-bold mb-2">
              Tu historia esta lista!
            </motion.h2>
            <motion.p variants={childFade} className="text-text-muted mb-6">
              Podes previsualizarla antes de publicar.
            </motion.p>

            <motion.div variants={childFade} className="grid grid-cols-3 gap-3 w-full mb-6">
              <div className="rounded-2xl bg-black/25 border border-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Tamano</p>
                <p className="text-sm text-text-primary mt-1">{result.sizeLabel}</p>
              </div>
              <div className="rounded-2xl bg-black/25 border border-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Clip</p>
                <p className="text-sm text-text-primary mt-1">{result.duration.toFixed(1)}s</p>
              </div>
              <div className="rounded-2xl bg-black/25 border border-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Tiempo</p>
                <p className="text-sm text-text-primary mt-1">{result.processingTimeLabel}</p>
              </div>
            </motion.div>

            {result.url && (
              <motion.div variants={childFade} className="w-full aspect-video rounded-2xl overflow-hidden bg-black/50 border border-white/10 mb-6">
                <video src={result.url} controls playsInline className="w-full h-full object-contain bg-black" />
              </motion.div>
            )}

            <motion.div variants={childFade} className="flex flex-wrap gap-3 justify-center">
              <a
                href={result.url}
                download={result.fileName}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-mansion-gold text-mansion-base font-semibold hover:bg-mansion-gold-light transition-colors"
              >
                <Play className="w-4 h-4" />
                Descargar
              </a>
              <button
                type="button"
                onClick={startOver}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-text-primary hover:bg-white/[0.1] transition-colors"
              >
                Subir otra
              </button>
            </motion.div>
          </motion.div>
        )}

      </div>

      {/* Timer overlay (same as VideoLabPage) */}
      {processing && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-black/80 backdrop-blur-lg border border-white/10 shadow-2xl">
          <Clock className="w-5 h-5 text-mansion-gold animate-pulse" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim">Tiempo de conversion</p>
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
