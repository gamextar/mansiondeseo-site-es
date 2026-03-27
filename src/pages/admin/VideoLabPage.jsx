import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, ChevronUp, Clock, Download, Film, LoaderCircle, Play, RefreshCw, Scissors, SlidersHorizontal, Upload, Wand2 } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const MAX_CLIP_SECONDS = 15;
const LANDSCAPE_WIDTH = 1280;
const LANDSCAPE_HEIGHT = 720;
const PORTRAIT_WIDTH = 720;
const PORTRAIT_HEIGHT = 1280;
const FFMPEG_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
const VIDEO_PRESET_STORAGE_KEY = 'video-lab-selected-preset';
const VIDEO_PRESETS = [
  {
    id: 'normal',
    label: 'Normal Quality',
    description: 'CRF 29 + cap 2700k + superfast + buffer 8000k + audio mono 64k. Buen balance entre velocidad, tamaño y calidad.',
    statusLabel: 'modo normal',
    codecLabel: 'H.264 CRF 29 + cap 2.7M + AAC 64k mono',
    crf: '29',
    maxrate: '2700k',
    bufsize: '8000k',
    audioBitrate: '64k',
    audioMono: true,
    preset: 'superfast',
    estimatedVideoBitrate: '1.6M',
  },
];

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

function formatMs(value) {
  const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
  return `${Math.round(safeValue)} ms`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundToEven(value) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function parseBitrateToBps(value) {
  if (typeof value !== 'string') return 0;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)([kKmM])$/);
  if (!match) return Number(value) || 0;
  const [, amount, unit] = match;
  const multiplier = unit.toLowerCase() === 'm' ? 1_000_000 : 1_000;
  return Number(amount) * multiplier;
}

function getEstimatedOutputSizeLabel(seconds, preset) {
  const estimatedVideoBitrate = parseBitrateToBps(preset.estimatedVideoBitrate);
  const totalBitrate = estimatedVideoBitrate + parseBitrateToBps(preset.audioBitrate);
  const estimatedBytes = (totalBitrate / 8) * seconds;
  const estimatedMegabytes = estimatedBytes / (1024 * 1024);
  return `~${estimatedMegabytes.toFixed(1)} MB/${seconds}s`;
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

export default function VideoLabPage({ variant = 'admin' }) {
  const ffmpegRef = useRef(null);
  const loadPromiseRef = useRef(null);
  const videoRef = useRef(null);
  const metadataStartRef = useRef(0);
  const sourceUrlRef = useRef('');
  const resultUrlRef = useRef('');
  const activeSegmentDurationRef = useRef(0);
  const isTranscodingRef = useRef(false);

  const [engineState, setEngineState] = useState('idle');
  const [engineProgress, setEngineProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [statusText, setStatusText] = useState('Listo para cargar FFmpeg.');
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceDuration, setSourceDuration] = useState(0);
  const [sourceResolution, setSourceResolution] = useState(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [thumbnails, setThumbnails] = useState([]);
  const trimmerRef = useRef(null);
  const draggingRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef(null);
  const timerStartRef = useRef(0);
  const [selectedPresetId, setSelectedPresetId] = useState(() => {
    if (typeof window === 'undefined') return VIDEO_PRESETS[0].id;
    return window.localStorage.getItem(VIDEO_PRESET_STORAGE_KEY) || VIDEO_PRESETS[0].id;
  });
  const [showCustomParams, setShowCustomParams] = useState(false);
  const [customOverrides, setCustomOverrides] = useState({});
  const [profileTimings, setProfileTimings] = useState({ metadata: 0, fetchFile: 0, writeFile: 0, exec: 0, readFile: 0 });
  const [debugInfo, setDebugInfo] = useState(null);

  const selectedDuration = clipEnd > clipStart ? clipEnd - clipStart : 0;
  const segmentWidth = sourceDuration > 0 ? ((clipEnd - clipStart) / sourceDuration) * 100 : 0;
  const segmentOffset = sourceDuration > 0 ? (clipStart / sourceDuration) * 100 : 0;
  const isStoryVariant = variant === 'story';
  const engineReady = engineState === 'ready';
  const overallProgress = processing ? processingProgress : engineProgress;
  const outputProfile = getOutputProfile(sourceResolution);
  const selectedPreset = VIDEO_PRESETS.find((preset) => preset.id === selectedPresetId) || VIDEO_PRESETS[0];
  const hasProfileTimings = Object.values(profileTimings).some((value) => value > 0);
  // Merge preset with any user overrides
  const activeParams = {
    crf: customOverrides.crf ?? selectedPreset.crf,
    maxrate: customOverrides.maxrate ?? selectedPreset.maxrate,
    bufsize: customOverrides.bufsize ?? selectedPreset.bufsize,
    preset: customOverrides.preset ?? selectedPreset.preset,
    audioBitrate: customOverrides.audioBitrate ?? selectedPreset.audioBitrate,
    audioMono: customOverrides.audioMono ?? selectedPreset.audioMono ?? false,
    estimatedVideoBitrate: selectedPreset.estimatedVideoBitrate,
  };
  const outputEstimateLabel = getEstimatedOutputSizeLabel(MAX_CLIP_SECONDS, activeParams);

  const profilePanel = hasProfileTimings ? (
    <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim mb-3">Perfilado</p>
      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Metadata</p>
          <p className="text-sm text-text-primary mt-1">{formatMs(profileTimings.metadata)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">fetchFile</p>
          <p className="text-sm text-text-primary mt-1">{formatMs(profileTimings.fetchFile)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">writeFile</p>
          <p className="text-sm text-text-primary mt-1">{formatMs(profileTimings.writeFile)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">ff.exec</p>
          <p className="text-sm text-text-primary mt-1">{formatMs(profileTimings.exec)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">readFile</p>
          <p className="text-sm text-text-primary mt-1">{formatMs(profileTimings.readFile)}</p>
        </div>
      </div>
    </div>
  ) : null;

  const debugPanel = debugInfo ? (
    <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim mb-3">Diagnostico</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Clip</p>
          <p className="text-sm text-text-primary mt-1">{debugInfo.clipStart.toFixed(1)}s - {debugInfo.clipEnd.toFixed(1)}s</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Duracion</p>
          <p className="text-sm text-text-primary mt-1">{debugInfo.segmentDuration.toFixed(1)}s</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Origen</p>
          <p className="text-sm text-text-primary mt-1">{debugInfo.sourceResolution}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Salida</p>
          <p className="text-sm text-text-primary mt-1">{debugInfo.outputResolution}</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Parametros</p>
        <p className="text-sm text-text-primary mt-1">{debugInfo.params}</p>
      </div>
    </div>
  ) : null;

  if (!ffmpegRef.current) {
    ffmpegRef.current = new FFmpeg();
  }

  useEffect(() => {
    const ffmpeg = ffmpegRef.current;

    const handleProgress = () => {
      // We rely on log-based time= parsing for accurate progress — ignore the built-in progress event
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
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => {
    sourceUrlRef.current = sourceUrl;
  }, [sourceUrl]);

  useEffect(() => {
    resultUrlRef.current = result?.url || '';
  }, [result]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIDEO_PRESET_STORAGE_KEY, selectedPreset.id);
  }, [selectedPreset]);

  // Extract thumbnails for the filmstrip trimmer
  useEffect(() => {
    if (!sourceUrl || sourceDuration <= 0) {
      setThumbnails([]);
      return;
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
      const thumbs = [];
      for (let i = 0; i < count; i++) {
        if (cancelled) return;
        video.currentTime = Math.min(i * step + 0.01, sourceDuration - 0.01);
        await new Promise((r) => { video.onseeked = r; });
        ctx.drawImage(video, 0, 0, 80, 56);
        thumbs.push(canvas.toDataURL('image/jpeg', 0.4));
      }
      if (!cancelled) setThumbnails(thumbs);
    };
    return () => { cancelled = true; };
  }, [sourceUrl, sourceDuration]);

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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    resetResult();
    setErrorMessage('');
    setStatusText('Archivo cargado. Ajusta el inicio del clip.');
    setClipStart(0);
    setClipEnd(0);
    setSourceDuration(0);
    setSourceResolution(null);
    setSourceFile(file);
    setProcessingProgress(0);
    setProfileTimings({ metadata: 0, fetchFile: 0, writeFile: 0, exec: 0, readFile: 0 });
    setDebugInfo(null);
    metadataStartRef.current = performance.now();

    const nextSourceUrl = URL.createObjectURL(file);
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    setSourceUrl(nextSourceUrl);

    await ensureEngineLoaded().catch(() => {});
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    setSourceDuration(dur);
    setSourceResolution(video.videoWidth && video.videoHeight ? { width: video.videoWidth, height: video.videoHeight } : null);
    setClipStart(0);
    setClipEnd(Math.min(dur, MAX_CLIP_SECONDS));
    if (metadataStartRef.current > 0) {
      setProfileTimings((prev) => ({ ...prev, metadata: performance.now() - metadataStartRef.current }));
      metadataStartRef.current = 0;
    }
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
      // Ignore autoplay restrictions; controls remain available.
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

  const onHandlePointerDown = (e, handle) => {
    e.preventDefault();
    draggingRef.current = handle;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e) => {
    const handle = draggingRef.current;
    if (!handle) return;
    const el = trimmerRef.current;
    if (!el || sourceDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const time = frac * sourceDuration;
    if (handle === 'left') {
      const minStart = Math.max(0, clipEnd - MAX_CLIP_SECONDS);
      const newStart = clamp(time, minStart, clipEnd - 0.5);
      setClipStart(newStart);
      syncPreviewToSelection(newStart);
    } else {
      const maxEnd = Math.min(sourceDuration, clipStart + MAX_CLIP_SECONDS);
      const newEnd = clamp(time, clipStart + 0.5, maxEnd);
      setClipEnd(newEnd);
      if (videoRef.current) videoRef.current.currentTime = newEnd;
    }
  };

  const onHandlePointerUp = () => {
    draggingRef.current = null;
  };

  const transcodeVideo = async () => {
    if (!sourceFile) {
      setErrorMessage('Primero sube un video.');
      return;
    }

    const startedAt = performance.now();
    setDebugInfo({
      clipStart,
      clipEnd,
      segmentDuration: Math.max(0.1, clipEnd - clipStart),
      sourceResolution: sourceResolution ? `${sourceResolution.width}x${sourceResolution.height}` : '—',
      outputResolution: outputProfile.label,
      params: `CRF ${activeParams.crf} · ${activeParams.maxrate} · ${activeParams.bufsize} · ${activeParams.preset} · ${activeParams.audioBitrate === 'none' ? 'sin audio' : `AAC ${activeParams.audioBitrate}${activeParams.audioMono ? ' mono' : ''}`}`,
    });

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
      const outputFileName = `${getFileStem(sourceFile.name)}-720p-15s.mp4`;
      const segmentDuration = Math.max(0.1, clipEnd - clipStart);
      activeSegmentDurationRef.current = segmentDuration;

      try { await ffmpeg.deleteFile(inputFileName); } catch {}
      try { await ffmpeg.deleteFile(outputFileName); } catch {}

      const fetchFileStartedAt = performance.now();
      const inputData = await fetchFile(sourceFile);
      const fetchFileElapsed = performance.now() - fetchFileStartedAt;

      const writeFileStartedAt = performance.now();
      await ffmpeg.writeFile(inputFileName, inputData);
      const writeFileElapsed = performance.now() - writeFileStartedAt;

      const sharedArgs = [
        '-ss', clipStart.toFixed(2),
        '-t', segmentDuration.toFixed(2),
        '-i', inputFileName,
        '-vf', `${outputProfile.scaleFilter},setsar=1`,
        '-movflags', '+faststart',
      ];

      setStatusText(`Convirtiendo en ${selectedPreset.statusLabel} (${outputProfile.label})...`);
      const execStartedAt = performance.now();
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
        setStatusText('Fallback a códec compatible...');
        try { await ffmpeg.deleteFile(outputFileName); } catch {}
        exitCode = await ffmpeg.exec([
          ...sharedArgs,
          '-c:v', 'mpeg4',
          '-q:v', '4',
          ...(activeParams.audioBitrate === 'none' ? ['-an'] : ['-c:a', 'aac', '-b:a', activeParams.audioBitrate, ...(activeParams.audioMono ? ['-ac', '1'] : [])]),
          outputFileName,
        ]);
      }

      const execElapsed = performance.now() - execStartedAt;

      if (exitCode !== 0) {
        throw new Error('FFmpeg no pudo generar el MP4 final.');
      }

      const readFileStartedAt = performance.now();
      const data = await ffmpeg.readFile(outputFileName);
      const readFileElapsed = performance.now() - readFileStartedAt;
      const outputBlob = new Blob([data], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(outputBlob);
      const processingElapsedSeconds = (performance.now() - startedAt) / 1000;

      setProcessingProgress(1);
      setStatusText('Clip listo para descargar.');
      setProfileTimings((prev) => ({
        ...prev,
        fetchFile: fetchFileElapsed,
        writeFile: writeFileElapsed,
        exec: execElapsed,
        readFile: readFileElapsed,
      }));
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
      setStatusText('Conversión interrumpida.');
    } finally {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      setProcessing(false);
      isTranscodingRef.current = false;
      activeSegmentDurationRef.current = 0;
    }
  };

  if (isStoryVariant) {
    return (
      <div className="min-h-screen bg-mansion-base text-text-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-mansion-crimson/10 blur-3xl" />
          <div className="absolute bottom-[-12%] left-[-6%] w-[460px] h-[460px] rounded-full bg-mansion-gold/10 blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 min-h-screen flex items-center justify-center">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full glass-elevated rounded-[2rem] border border-mansion-border/20 overflow-hidden"
          >
            <div className="p-8 sm:p-10 flex flex-col items-center justify-center text-center min-h-[420px]">
              {sourceUrl && (
                <div className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
                  <video
                    ref={videoRef}
                    src={sourceUrl}
                    controls
                    playsInline
                    onLoadedMetadata={handleLoadedMetadata}
                  />
                </div>
              )}

              {!sourceFile && !processing && !result?.url && (
                <label className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-2xl bg-mansion-crimson text-white font-semibold text-lg hover:bg-mansion-crimson-dark transition-colors cursor-pointer min-w-[240px]">
                  <Upload className="w-5 h-5" />
                  SUBIR HISTORIA
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}

              {sourceFile && !processing && !result?.url && (
                <button
                  type="button"
                  onClick={transcodeVideo}
                  disabled={!selectedDuration}
                  className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-2xl bg-mansion-crimson text-white font-semibold text-lg hover:bg-mansion-crimson-dark disabled:opacity-60 transition-colors min-w-[240px]"
                >
                  <Wand2 className="w-5 h-5" />
                  SUBIR HISTORIA
                </button>
              )}

              {processing && (
                <div className="w-full max-w-md">
                  <div className="rounded-2xl bg-black/25 border border-white/10 overflow-hidden">
                    <div className="h-3 bg-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-mansion-crimson to-mansion-gold transition-all duration-300"
                        style={{ width: `${Math.round(overallProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!processing && result?.url && (
                <div className="flex flex-col items-center gap-4">
                  <a
                    href={result.url}
                    download={result.fileName}
                    className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors min-w-[240px]"
                  >
                    <Download className="w-5 h-5" />
                    DESCARGAR HISTORIA
                  </a>
                  <label className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-2xl bg-white/5 border border-white/10 text-text-primary font-semibold text-lg hover:bg-white/10 transition-colors cursor-pointer min-w-[240px]">
                    <Upload className="w-5 h-5" />
                    SUBIR OTRA
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              )}

              {errorMessage && !processing && (
                <div className="mt-6 w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}
            </div>
          </motion.section>
        </div>

        {processing && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-black/80 backdrop-blur-lg border border-white/10 shadow-2xl">
            <Clock className="w-5 h-5 text-mansion-gold animate-pulse" />
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

  return (
    <div className="min-h-screen bg-mansion-base text-text-primary relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-mansion-crimson/10 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[-6%] w-[460px] h-[460px] rounded-full bg-mansion-gold/10 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mansion-gold/10 border border-mansion-gold/20 text-mansion-gold text-xs font-semibold tracking-[0.18em] uppercase mb-3">
              <Film className="w-3.5 h-3.5" />
              Laboratorio
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">Video Lab FFmpeg.wasm</h1>
            <p className="text-text-muted mt-2 max-w-2xl">
              Prueba local para recortar un segmento de hasta 15 segundos y exportarlo a 720p en MP4, sin subir el archivo al servidor.
            </p>
          </div>
          <Link
            to="/admin/usuarios"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-mansion-card/70 border border-mansion-border/30 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-elevated rounded-[2rem] border border-mansion-border/20 overflow-hidden"
          >
            <div className="p-6 sm:p-7 border-b border-mansion-border/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-text-dim font-semibold">1. Carga local</p>
                  <h2 className="font-display text-2xl font-semibold mt-1">Sube un video de prueba</h2>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-mansion-crimson text-white font-medium hover:bg-mansion-crimson-dark transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Elegir archivo
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>

            <div className="p-6 sm:p-7">
              <div className="aspect-video rounded-[1.5rem] overflow-hidden bg-black/50 border border-white/10 relative">
                {sourceUrl ? (
                  <video
                    ref={videoRef}
                    src={sourceUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain bg-black"
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handlePreviewTimeUpdate}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                    <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Film className="w-7 h-7 text-mansion-gold" />
                    </div>
                    <div>
                      <p className="font-display text-xl text-text-primary">Arranca con cualquier MP4, MOV o WebM</p>
                      <p className="text-sm text-text-dim mt-1">La conversión ocurre en el navegador usando WebAssembly.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-dim">Archivo</p>
                  <p className="text-sm text-text-primary mt-1 truncate">{sourceFile?.name || 'Sin video cargado'}</p>
                </div>
                <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-dim">Duración</p>
                  <p className="text-sm text-text-primary mt-1">{sourceDuration ? formatTime(sourceDuration) : '—'}</p>
                </div>
                <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-dim">Resolución origen</p>
                  <p className="text-sm text-text-primary mt-1">
                    {sourceResolution ? `${sourceResolution.width}×${sourceResolution.height}` : '—'}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.75rem] border border-mansion-border/20 bg-mansion-card/40 p-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-text-dim font-semibold">Preset</p>
                    <h3 className="font-display text-xl mt-1">Elige un perfil de conversión</h3>
                    <p className="text-sm text-text-dim mt-1">{selectedPreset.description}</p>
                  </div>
                  <label className="block">
                    <span className="sr-only">Preset de conversión</span>
                    <select
                      value={selectedPreset.id}
                      onChange={(event) => { setSelectedPresetId(event.target.value); setCustomOverrides({}); }}
                      className="w-full rounded-2xl bg-mansion-elevated/85 border border-mansion-border/30 px-4 py-3 text-text-primary focus:outline-none focus:border-mansion-gold/40"
                    >
                      {VIDEO_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Custom parameter controls */}
                <button
                  type="button"
                  onClick={() => setShowCustomParams((v) => !v)}
                  className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-3"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Personalizar parámetros
                  {showCustomParams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {Object.keys(customOverrides).length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-mansion-gold/20 text-mansion-gold font-semibold">
                      {Object.keys(customOverrides).length} cambio{Object.keys(customOverrides).length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>

                {showCustomParams && (
                  <div className="rounded-2xl bg-black/20 border border-white/[0.06] p-4 mb-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* CRF */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] uppercase tracking-[0.18em] text-text-dim font-semibold">CRF</label>
                          <span className="text-sm font-semibold text-mansion-gold tabular-nums">{activeParams.crf}</span>
                        </div>
                        <input
                          type="range"
                          min="18"
                          max="32"
                          step="1"
                          value={activeParams.crf}
                          onChange={(e) => setCustomOverrides((prev) => ({ ...prev, crf: e.target.value }))}
                          className="w-full accent-mansion-gold"
                        />
                        <p className="text-[10px] text-text-dim mt-1">Calidad constante. Menor = más calidad y peso. 18–22 alta, 23–25 buena, 26+ liviana.</p>
                      </div>

                      {/* Maxrate */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] uppercase tracking-[0.18em] text-text-dim font-semibold">Cap (maxrate)</label>
                          <span className="text-sm font-semibold text-mansion-gold tabular-nums">{activeParams.maxrate}</span>
                        </div>
                        <select
                          value={activeParams.maxrate}
                          onChange={(e) => {
                            setCustomOverrides((prev) => ({ ...prev, maxrate: e.target.value }));
                          }}
                          className="w-full rounded-xl bg-mansion-elevated/85 border border-mansion-border/30 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-mansion-gold/40"
                        >
                          {['1500k', '2000k', '2500k', '2600k', '2700k', '2800k', '2900k', '3000k', '3100k', '3200k', '3300k', '3400k', '3500k', '4000k', '4500k', '5000k', '5500k', '6000k'].map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-text-dim mt-1">Techo de bitrate. Limita picos para controlar tamaño. Bufsize se ajusta auto a 2×.</p>
                      </div>

                      {/* Preset (speed) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] uppercase tracking-[0.18em] text-text-dim font-semibold">Velocidad (preset)</label>
                          <span className="text-sm font-semibold text-mansion-gold">{activeParams.preset}</span>
                        </div>
                        <select
                          value={activeParams.preset}
                          onChange={(e) => setCustomOverrides((prev) => ({ ...prev, preset: e.target.value }))}
                          className="w-full rounded-xl bg-mansion-elevated/85 border border-mansion-border/30 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-mansion-gold/40"
                        >
                          {['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'].map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-text-dim mt-1">Más rápido = encode más veloz pero peor compresión. ultrafast ideal para iPhone/WASM.</p>
                      </div>

                      {/* Audio bitrate */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] uppercase tracking-[0.18em] text-text-dim font-semibold">Audio bitrate</label>
                          <span className="text-sm font-semibold text-mansion-gold">{activeParams.audioBitrate}</span>
                        </div>
                        <select
                          value={activeParams.audioBitrate}
                          onChange={(e) => setCustomOverrides((prev) => ({ ...prev, audioBitrate: e.target.value }))}
                          className="w-full rounded-xl bg-mansion-elevated/85 border border-mansion-border/30 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-mansion-gold/40"
                        >
                          {['none', '16k', '24k', '32k', '48k', '64k', '96k', '128k'].map((v) => (
                            <option key={v} value={v}>{v === 'none' ? 'Sin audio' : v}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-text-dim mt-1">Para voces 32k basta. Para música 64k–128k.</p>
                        {activeParams.audioBitrate !== 'none' && (
                          <label className="flex items-center gap-2 mt-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeParams.audioMono}
                              onChange={(e) => setCustomOverrides((prev) => ({ ...prev, audioMono: e.target.checked }))}
                              className="w-4 h-4 rounded border-mansion-border/30 bg-mansion-elevated accent-mansion-gold"
                            />
                            <span className="text-xs text-text-muted">Mono (1 canal — más liviano)</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Bufsize */}
                    <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-white/[0.06]">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] uppercase tracking-[0.18em] text-text-dim font-semibold">Bufsize</label>
                          <span className="text-sm font-semibold text-mansion-gold tabular-nums">{activeParams.bufsize}</span>
                        </div>
                        <select
                          value={activeParams.bufsize}
                          onChange={(e) => setCustomOverrides((prev) => ({ ...prev, bufsize: e.target.value }))}
                          className="w-full rounded-xl bg-mansion-elevated/85 border border-mansion-border/30 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-mansion-gold/40"
                        >
                          {['3000k', '4000k', '5000k', '6000k', '7000k', '8000k', '9000k', '10000k', '12000k'].map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-text-dim mt-1">Ventana del rate control. Mayor = picos más altos pero promedio estable. Menor = bitrate más parejo frame a frame. Típico: 1.5× a 2× del maxrate.</p>
                      </div>
                      <div className="flex items-end">
                        {Object.keys(customOverrides).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setCustomOverrides({})}
                            className="text-xs text-mansion-crimson hover:text-mansion-crimson-dark transition-colors"
                          >
                            Restaurar preset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-text-dim font-semibold">2. Segmento</p>
                    <h3 className="font-display text-xl mt-1">Recorta hasta {MAX_CLIP_SECONDS}s</h3>
                    <p className="text-sm text-text-dim mt-1">Arrastra las manijas doradas para elegir el fragmento. Máximo {MAX_CLIP_SECONDS} segundos.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseCurrentTime}
                    disabled={!sourceUrl}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-mansion-elevated/80 border border-mansion-border/30 text-text-muted hover:text-text-primary disabled:opacity-50 transition-colors"
                  >
                    <Scissors className="w-4 h-4" />
                    Usar tiempo actual
                  </button>
                </div>

                {/* iPhone-style filmstrip trimmer */}
                <div ref={trimmerRef} className="relative h-[56px] rounded-xl bg-black/40 overflow-hidden select-none touch-none">
                  {/* Filmstrip thumbnails */}
                  <div className="absolute inset-0 flex">
                    {thumbnails.length > 0
                      ? thumbnails.map((src, i) => (
                          <img key={i} src={src} alt="" className="h-full flex-1 object-cover" draggable={false} />
                        ))
                      : sourceUrl && (
                          <div className="flex-1 flex items-center justify-center text-text-dim text-xs">
                            <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
                            Generando vista previa…
                          </div>
                        )}
                  </div>

                  {/* Left dimmed overlay */}
                  <div
                    className="absolute inset-y-0 left-0 bg-black/60 pointer-events-none"
                    style={{ width: `${segmentOffset}%` }}
                  />
                  {/* Right dimmed overlay */}
                  <div
                    className="absolute inset-y-0 right-0 bg-black/60 pointer-events-none"
                    style={{ width: `${Math.max(0, 100 - segmentOffset - segmentWidth)}%` }}
                  />

                  {/* Selection frame (top/bottom borders) */}
                  <div
                    className="absolute inset-y-0 pointer-events-none"
                    style={{ left: `${segmentOffset}%`, width: `${segmentWidth}%` }}
                  >
                    <div className="absolute top-0 left-3.5 right-3.5 h-[3px] bg-mansion-gold" />
                    <div className="absolute bottom-0 left-3.5 right-3.5 h-[3px] bg-mansion-gold" />
                  </div>

                  {/* Left handle */}
                  <div
                    className="absolute inset-y-0 z-10 cursor-ew-resize"
                    style={{ left: `calc(${segmentOffset}% - 6px)`, width: '20px' }}
                    onPointerDown={(e) => onHandlePointerDown(e, 'left')}
                    onPointerMove={onHandlePointerMove}
                    onPointerUp={onHandlePointerUp}
                  >
                    <div className="absolute inset-y-0 right-0 w-3.5 bg-mansion-gold rounded-l-lg flex items-center justify-center">
                      <div className="w-[2px] h-5 rounded-full bg-mansion-base/40" />
                    </div>
                  </div>

                  {/* Right handle */}
                  <div
                    className="absolute inset-y-0 z-10 cursor-ew-resize"
                    style={{ left: `calc(${segmentOffset + segmentWidth}% - 14px)`, width: '20px' }}
                    onPointerDown={(e) => onHandlePointerDown(e, 'right')}
                    onPointerMove={onHandlePointerMove}
                    onPointerUp={onHandlePointerUp}
                  >
                    <div className="absolute inset-y-0 left-0 w-3.5 bg-mansion-gold rounded-r-lg flex items-center justify-center">
                      <div className="w-[2px] h-5 rounded-full bg-mansion-base/40" />
                    </div>
                  </div>
                </div>

                {/* Time labels */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim">Inicio</span>
                    <span className="px-3 py-1.5 rounded-full bg-black/25 border border-white/10 font-medium">{formatTime(clipStart)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim">Fin</span>
                    <span className="px-3 py-1.5 rounded-full bg-black/25 border border-white/10 font-medium">{formatTime(clipEnd)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim">Duración</span>
                    <span className="px-3 py-1.5 rounded-full bg-mansion-gold/10 border border-mansion-gold/20 text-mansion-gold font-semibold">
                      {selectedDuration > 0 ? `${selectedDuration.toFixed(1)}s` : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-5">
                  <button
                    type="button"
                    onClick={handlePreviewSegment}
                    disabled={!sourceUrl}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-mansion-card/80 border border-mansion-border/30 text-text-primary hover:border-mansion-gold/30 disabled:opacity-50 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Previsualizar recorte
                  </button>
                  <button
                    type="button"
                    onClick={transcodeVideo}
                    disabled={!sourceFile || processing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-mansion-crimson text-white font-semibold hover:bg-mansion-crimson-dark disabled:opacity-60 transition-colors"
                  >
                    {processing ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Convertir a 720p
                  </button>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="space-y-6"
          >
            <section className="glass-elevated rounded-[2rem] border border-mansion-border/20 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-text-dim font-semibold">3. Progreso</p>
                  <h2 className="font-display text-xl mt-1">Carga y conversión</h2>
                </div>
                <button
                  type="button"
                  onClick={() => ensureEngineLoaded().catch(() => {})}
                  disabled={engineState === 'loading' || engineReady}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-mansion-card/70 border border-mansion-border/30 text-text-muted hover:text-text-primary disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${engineState === 'loading' ? 'animate-spin' : ''}`} />
                  {engineReady ? 'Listo' : 'Cargar motor'}
                </button>
              </div>

              <div className="mt-5 rounded-2xl bg-black/25 border border-white/10 overflow-hidden">
                <div className="h-3 bg-white/5">
                  <div
                    className={`h-full transition-all duration-300 ${processing ? 'bg-gradient-to-r from-mansion-crimson to-mansion-gold' : 'bg-gradient-to-r from-mansion-gold/70 to-mansion-gold-light/90'}`}
                    style={{ width: `${Math.round(overallProgress * 100)}%` }}
                  />
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-text-muted">{processing ? 'Procesando video...' : engineReady ? 'Motor cargado' : 'Preparando FFmpeg...'}</span>
                  <span className="font-semibold text-text-primary">{Math.round(overallProgress * 100)}%</span>
                </div>
              </div>

              <p className="text-sm text-text-dim mt-4 min-h-[2.75rem]">{statusText}</p>
              {errorMessage && (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}

              <div className="grid gap-3 mt-5 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Salida objetivo</p>
                  <p className="text-sm text-text-primary mt-1">{`MP4 · ${outputProfile.label} · CRF ${activeParams.crf} · ${activeParams.maxrate} cap · ${activeParams.preset} · ${outputEstimateLabel}`}</p>
                </div>
                <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Motor</p>
                  <p className="text-sm text-text-primary mt-1">`@ffmpeg/ffmpeg` 0.12.15</p>
                </div>
                {profilePanel}
                {debugPanel}
              </div>
            </section>

            <section className="glass-elevated rounded-[2rem] border border-mansion-border/20 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-text-dim font-semibold">4. Resultado</p>
                  <h2 className="font-display text-xl mt-1">Descarga el clip</h2>
                </div>
                {result?.url && (
                  <a
                    href={result.url}
                    download={result.fileName}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-mansion-gold text-mansion-base font-semibold hover:bg-mansion-gold-light transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                )}
              </div>

              {result?.url ? (
                <div className="mt-5 space-y-4">
                  <div className="aspect-video rounded-[1.5rem] overflow-hidden bg-black/50 border border-white/10">
                    <video src={result.url} controls playsInline className="w-full h-full object-contain bg-black" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Archivo</p>
                      <p className="text-sm text-text-primary mt-1 truncate">{result.fileName}</p>
                    </div>
                    <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Tamaño</p>
                      <p className="text-sm text-text-primary mt-1">{result.sizeLabel}</p>
                    </div>
                    <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Clip</p>
                      <p className="text-sm text-text-primary mt-1">{result.duration.toFixed(1)}s</p>
                    </div>
                    <div className="rounded-2xl bg-mansion-card/60 border border-mansion-border/20 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Tiempo</p>
                      <p className="text-sm text-text-primary mt-1">{result.processingTimeLabel}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-mansion-border/30 bg-mansion-card/30 p-6 text-center">
                  <div className="w-14 h-14 rounded-3xl bg-black/20 border border-white/10 flex items-center justify-center mx-auto">
                    <Download className="w-6 h-6 text-mansion-gold" />
                  </div>
                  <p className="font-display text-lg mt-4">Todavía no hay salida</p>
                  <p className="text-sm text-text-dim mt-1">Cuando termine la conversión, vas a poder previsualizar y descargar el MP4 desde acá.</p>
                </div>
              )}
            </section>
          </motion.aside>
        </div>
      </div>

      {/* Elapsed timer overlay */}
      {processing && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-black/80 backdrop-blur-lg border border-white/10 shadow-2xl">
          <Clock className="w-5 h-5 text-mansion-gold animate-pulse" />
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
