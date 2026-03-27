import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Film, Play, Upload } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

/* Constants */
const MAX_CLIP_SECONDS = 15;
const LANDSCAPE_WIDTH = 1280;
const LANDSCAPE_HEIGHT = 720;
const PORTRAIT_WIDTH = 720;
const PORTRAIT_HEIGHT = 1280;
const FFMPEG_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

const ENCODE_PRESET = {
  crf: '29',
  maxrate: '2700k',
  bufsize: '8000k',
  audioBitrate: '64k',
  audioMono: true,
  preset: 'superfast',
};

/* Helpers */
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function roundToEven(v) { const r = Math.round(v); return r % 2 === 0 ? r : r + 1; }

function getOutputProfile(res) {
  const w = res?.width || LANDSCAPE_WIDTH;
  const h = res?.height || LANDSCAPE_HEIGHT;
  if (h > w) {
    const sh = roundToEven((h / w) * PORTRAIT_WIDTH);
    const ch = Math.min(Math.max(sh, PORTRAIT_WIDTH), PORTRAIT_HEIGHT);
    return { scaleFilter: `scale=${PORTRAIT_WIDTH}:-2:flags=bicubic`, label: `${PORTRAIT_WIDTH}x${ch}` };
  }
  const sw = roundToEven((w / h) * LANDSCAPE_HEIGHT);
  const cw = Math.min(Math.max(sw, LANDSCAPE_HEIGHT), LANDSCAPE_WIDTH);
  return { scaleFilter: `scale=-2:${LANDSCAPE_HEIGHT}:flags=bicubic`, label: `${cw}x${LANDSCAPE_HEIGHT}` };
}

function getFileStem(name) {
  return (name || 'clip').replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'clip';
}

function parseFfmpegTime(msg) {
  const m = msg.match(/time=(\d+):(\d+):([\d.]+)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function downloadBlobUrl(url, mimeType, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download failed');
  const total = Number(res.headers.get('content-length') || 0);
  if (!res.body) { const buf = await res.arrayBuffer(); onProgress?.(1); return URL.createObjectURL(new Blob([buf], { type: mimeType })); }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) { chunks.push(value); received += value.length; if (total > 0) onProgress?.(received / total); }
  }
  onProgress?.(1);
  return URL.createObjectURL(new Blob(chunks, { type: mimeType }));
}

/* Animations */
const fadeSlide = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { animate: { transition: { staggerChildren: 0.1 } } };
const childFade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/* Component */
export default function StoryUploadPage() {
  const ffmpegRef = useRef(null);
  const loadPromiseRef = useRef(null);
  const resultUrlRef = useRef('');
  const activeSegRef = useRef(0);
  const isTranscodingRef = useRef(false);
  const timerIntervalRef = useRef(null);
  const timerStartRef = useRef(0);

  const [step, setStep] = useState('pick');
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [resultUrl, setResultUrl] = useState('');
  const [resultName, setResultName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!ffmpegRef.current) ffmpegRef.current = new FFmpeg();

  useEffect(() => {
    const ff = ffmpegRef.current;
    const handleProgress = () => {};
    const handleLog = ({ message }) => {
      if (!isTranscodingRef.current) return;
      const t = parseFfmpegTime(message);
      if (t !== null && activeSegRef.current > 0) {
        setProgress(clamp(t / activeSegRef.current, 0, 0.99));
      }
    };
    ff.on('progress', handleProgress);
    ff.on('log', handleLog);
    return () => {
      ff.off('progress', handleProgress);
      ff.off('log', handleLog);
      ff.terminate();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => { resultUrlRef.current = resultUrl; }, [resultUrl]);

  /* Preload FFmpeg engine on mount so it's ready when user picks a file */
  useEffect(() => { ensureEngine().catch(() => {}); }, []);

  const ensureEngine = async () => {
    const ff = ffmpegRef.current;
    if (ff.loaded) return ff;
    if (loadPromiseRef.current) { await loadPromiseRef.current; return ff; }
    loadPromiseRef.current = (async () => {
      const coreURL = await downloadBlobUrl(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, 'text/javascript', () => {});
      const wasmURL = await downloadBlobUrl(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm', () => {});
      await ff.load({ coreURL, wasmURL });
    })();
    try { await loadPromiseRef.current; } catch (e) { setErrorMessage(e?.message || 'Error cargando FFmpeg'); throw e; } finally { loadPromiseRef.current = null; }
    return ff;
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErrorMessage('');
    setProgress(0);
    setResultUrl('');
    setResultName('');

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

    const resolution = meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
    const clipEnd = Math.min(meta.duration || 0, MAX_CLIP_SECONDS);

    if (clipEnd <= 0) {
      setErrorMessage('No se pudo leer el video.');
      return;
    }

    await startEncode(file, resolution, 0, clipEnd);
  };

  const startEncode = async (file, resolution, clipStart, clipEnd) => {
    setStep('encoding');
    setProgress(0);
    setErrorMessage('');
    setElapsedSeconds(0);

    const profile = getOutputProfile(resolution);

    try {
      const ff = await ensureEngine();
      isTranscodingRef.current = true;

      /* Start timer AFTER engine is loaded — only count actual encoding time */
      timerStartRef.current = performance.now();
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((performance.now() - timerStartRef.current) / 1000));
      }, 500);

      const inputExtension = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inputFileName = `input.${inputExtension}`;
      const outputFileName = `${getFileStem(file.name)}-story.mp4`;
      const segmentDuration = Math.max(0.1, clipEnd - clipStart);
      activeSegRef.current = segmentDuration;

      try { await ff.deleteFile(inputFileName); } catch {}
      try { await ff.deleteFile(outputFileName); } catch {}

      await ff.writeFile(inputFileName, await fetchFile(file));

      const sharedArgs = [
        '-ss', clipStart.toFixed(2),
        '-t', segmentDuration.toFixed(2),
        '-i', inputFileName,
        '-vf', `${profile.scaleFilter},setsar=1`,
        '-movflags', '+faststart',
      ];

      let exitCode = await ff.exec([
        ...sharedArgs,
        '-c:v', 'libx264',
        '-threads', '4',
        '-x264-params', 'sliced-threads=1:threads=4',
        '-crf', ENCODE_PRESET.crf,
        '-maxrate', ENCODE_PRESET.maxrate,
        '-bufsize', ENCODE_PRESET.bufsize,
        '-preset', ENCODE_PRESET.preset,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', ENCODE_PRESET.audioBitrate, '-ac', '1',
        outputFileName,
      ]);

      if (exitCode !== 0) {
        try { await ff.deleteFile(outputFileName); } catch {}
        exitCode = await ff.exec([
          ...sharedArgs,
          '-c:v', 'mpeg4', '-q:v', '4',
          '-c:a', 'aac', '-b:a', ENCODE_PRESET.audioBitrate, '-ac', '1',
          outputFileName,
        ]);
      }

      if (exitCode !== 0) throw new Error('FFmpeg no pudo generar el MP4 final.');

      const data = await ff.readFile(outputFileName);
      const outputBlob = new Blob([data], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(outputBlob);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);

      setProgress(1);
      setResultUrl(outputUrl);
      setResultName(outputFileName);

      try { await ff.deleteFile(inputFileName); } catch {}
      try { await ff.deleteFile(outputFileName); } catch {}

      await new Promise((r) => setTimeout(r, 600));
      setStep('done');
    } catch (err) {
      setErrorMessage(err?.message || 'No se pudo convertir el video.');
      setStep('pick');
    } finally {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      isTranscodingRef.current = false;
      activeSegRef.current = 0;
    }
  };

  const startOver = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    setProgress(0);
    setElapsedSeconds(0);
    setResultUrl('');
    setResultName('');
    setErrorMessage('');
    setStep('pick');
  };

  return (
    <div className="min-h-screen bg-mansion-base text-text-primary flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-mansion-gold/[0.06] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-lg z-10">
        <AnimatePresence mode="popLayout">

          {step === 'pick' && (
            <motion.div key="pick" {...fadeSlide} className="flex flex-col items-center text-center py-16">
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

              <label className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg cursor-pointer hover:bg-mansion-gold-light transition-colors">
                <Upload className="w-5 h-5" />
                Elegir video
                <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
              </label>

              {errorMessage && (
                <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}
            </motion.div>
          )}

          {step === 'encoding' && (
            <div key="encoding" className="flex flex-col items-center text-center py-16">
              <h2 className="font-display text-2xl font-bold mb-2">Procesando tu historia…</h2>
              <p className="text-text-muted text-sm mb-6">Esto puede tomar unos segundos.</p>

              <div className="w-full max-w-xs rounded-2xl bg-black/25 border border-white/10 overflow-hidden">
                <div className="h-3 bg-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-mansion-crimson to-mansion-gold transition-all duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-text-muted tabular-nums">
                    {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
                  </span>
                  <span className="font-semibold text-text-primary tabular-nums">{Math.round(progress * 100)}%</span>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <motion.div key="done" {...fadeSlide} variants={stagger} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 16 }}
                className="mb-6"
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              </motion.div>

              <motion.h2 variants={childFade} className="font-display text-3xl font-bold mb-2">
                ¡Tu historia está lista!
              </motion.h2>
              <motion.p variants={childFade} className="text-text-muted mb-6">
                Podés previsualizarla antes de publicar.
              </motion.p>

              {resultUrl && (
                <motion.div variants={childFade} className="w-full aspect-video rounded-2xl overflow-hidden bg-black/50 border border-white/10 mb-6">
                  <video src={resultUrl} controls playsInline className="w-full h-full object-contain bg-black" />
                </motion.div>
              )}

              <motion.div variants={childFade} className="flex flex-wrap gap-3 justify-center">
                {resultUrl && (
                  <a
                    href={resultUrl}
                    download={resultName}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-mansion-gold text-mansion-base font-semibold hover:bg-mansion-gold-light transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Descargar
                  </a>
                )}
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

        </AnimatePresence>
      </div>
    </div>
  );
}
