import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Film, LoaderCircle, Play, Upload, Wand2 } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

/* ─── Constants ─── */
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

/* ─── Helpers ─── */
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function roundToEven(v) { const r = Math.round(v); return r % 2 === 0 ? r : r + 1; }

function formatTime(s) {
  const safe = Math.max(0, Number.isFinite(s) ? s : 0);
  const m = Math.floor(safe / 60);
  const sec = safe - m * 60;
  return `${String(m).padStart(2, '0')}:${sec.toFixed(1).padStart(4, '0')}`;
}

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

function getFileStem(name = 'clip') {
  return name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'clip';
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

/* ─── Animations ─── */
const fadeSlide = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const childFade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/* ─── Component ─── */
export default function StoryUploadPage() {
  const ffmpegRef = useRef(null);
  const loadPromiseRef = useRef(null);
  const videoRef = useRef(null);
  const sourceUrlRef = useRef('');
  const resultUrlRef = useRef('');
  const activeSegRef = useRef(0);
  const isTranscodingRef = useRef(false);
  const trimmerRef = useRef(null);
  const draggingRef = useRef(null);

  // Step: 'pick' | 'trim' | 'encoding' | 'done'
  const [step, setStep] = useState('pick');
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceDuration, setSourceDuration] = useState(0);
  const [sourceResolution, setSourceResolution] = useState(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [thumbnails, setThumbnails] = useState([]);
  const [progress, setProgress] = useState(0);
  const [engineProgress, setEngineProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState('');
  const [resultName, setResultName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedDuration = clipEnd > clipStart ? clipEnd - clipStart : 0;
  const segmentWidth = sourceDuration > 0 ? ((clipEnd - clipStart) / sourceDuration) * 100 : 0;
  const segmentOffset = sourceDuration > 0 ? (clipStart / sourceDuration) * 100 : 0;
  const outputProfile = getOutputProfile(sourceResolution);

  if (!ffmpegRef.current) ffmpegRef.current = new FFmpeg();

  /* ── FFmpeg lifecycle ── */
  useEffect(() => {
    const ff = ffmpegRef.current;
    const onLog = ({ message }) => {
      if (!isTranscodingRef.current) return;
      const t = parseFfmpegTime(message);
      if (t !== null && activeSegRef.current > 0) setProgress(clamp(t / activeSegRef.current, 0, 0.99));
    };
    ff.on('log', onLog);
    return () => {
      ff.off('log', onLog);
      ff.terminate();
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => { sourceUrlRef.current = sourceUrl; }, [sourceUrl]);
  useEffect(() => { resultUrlRef.current = resultUrl; }, [resultUrl]);

  /* ── Thumbnail extraction ── */
  useEffect(() => {
    if (!sourceUrl || sourceDuration <= 0) { setThumbnails([]); return; }
    let cancelled = false;
    const vid = document.createElement('video');
    vid.muted = true;
    vid.preload = 'auto';
    vid.src = sourceUrl;
    const count = Math.min(20, Math.max(10, Math.ceil(sourceDuration / 1.5)));
    const stepSec = sourceDuration / count;
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 56;
    const ctx = canvas.getContext('2d');
    vid.onloadeddata = async () => {
      const arr = [];
      for (let i = 0; i < count; i++) {
        if (cancelled) return;
        vid.currentTime = Math.min(i * stepSec + 0.01, sourceDuration - 0.01);
        await new Promise((r) => { vid.onseeked = r; });
        ctx.drawImage(vid, 0, 0, 80, 56);
        arr.push(canvas.toDataURL('image/jpeg', 0.4));
      }
      if (!cancelled) setThumbnails(arr);
    };
    return () => { cancelled = true; };
  }, [sourceUrl, sourceDuration]);

  /* ── Engine loader ── */
  const ensureEngine = async () => {
    const ff = ffmpegRef.current;
    if (ff.loaded) return ff;
    if (loadPromiseRef.current) { await loadPromiseRef.current; return ff; }
    loadPromiseRef.current = (async () => {
      setEngineProgress(0.02);
      const coreURL = await downloadBlobUrl(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, 'text/javascript', (p) => setEngineProgress(clamp(p * 0.2, 0.02, 0.2)));
      const wasmURL = await downloadBlobUrl(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm', (p) => setEngineProgress(clamp(0.2 + p * 0.8, 0.2, 0.95)));
      await ff.load({ coreURL, wasmURL });
      setEngineProgress(1);
    })();
    try { await loadPromiseRef.current; } catch (e) { setErrorMessage(e?.message || 'Error cargando FFmpeg'); throw e; } finally { loadPromiseRef.current = null; }
    return ff;
  };

  /* ── File selection ── */
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErrorMessage('');
    setSourceFile(file);
    setClipStart(0);
    setClipEnd(0);
    setSourceDuration(0);
    setSourceResolution(null);
    setProgress(0);
    setResultUrl('');
    const url = URL.createObjectURL(file);
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    setSourceUrl(url);
    ensureEngine().catch(() => {});
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const dur = v.duration || 0;
    setSourceDuration(dur);
    setSourceResolution(v.videoWidth && v.videoHeight ? { width: v.videoWidth, height: v.videoHeight } : null);
    setClipStart(0);
    setClipEnd(Math.min(dur, MAX_CLIP_SECONDS));
    setStep('trim');
  };

  /* ── Trimmer drag ── */
  const syncPreview = (t) => { if (videoRef.current) videoRef.current.currentTime = t; };

  const onHandlePointerDown = (e, handle) => {
    e.preventDefault();
    draggingRef.current = handle;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e) => {
    const h = draggingRef.current;
    if (!h) return;
    const el = trimmerRef.current;
    if (!el || sourceDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const time = frac * sourceDuration;
    if (h === 'left') {
      const newStart = clamp(time, Math.max(0, clipEnd - MAX_CLIP_SECONDS), clipEnd - 0.5);
      setClipStart(newStart);
      syncPreview(newStart);
    } else {
      const newEnd = clamp(time, clipStart + 0.5, Math.min(sourceDuration, clipStart + MAX_CLIP_SECONDS));
      setClipEnd(newEnd);
      syncPreview(newEnd);
    }
  };

  const onHandlePointerUp = () => { draggingRef.current = null; };

  /* ── Preview loop ── */
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || clipEnd <= clipStart) return;
    if (v.currentTime >= clipEnd) { v.currentTime = clipStart; if (!v.paused) v.play().catch(() => {}); }
  };

  /* ── Transcode ── */
  const transcode = async () => {
    if (!sourceFile) return;
    setStep('encoding');
    setProgress(0);
    setErrorMessage('');

    try {
      const ff = await ensureEngine();
      isTranscodingRef.current = true;
      const ext = sourceFile.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inFile = `input.${ext}`;
      const outFile = `${getFileStem(sourceFile.name)}-story.mp4`;
      const segDur = Math.max(0.1, clipEnd - clipStart);
      activeSegRef.current = segDur;

      try { await ff.deleteFile(inFile); } catch {}
      try { await ff.deleteFile(outFile); } catch {}
      await ff.writeFile(inFile, await fetchFile(sourceFile));

      let exit = await ff.exec([
        '-ss', clipStart.toFixed(2),
        '-t', segDur.toFixed(2),
        '-i', inFile,
        '-vf', `${outputProfile.scaleFilter},setsar=1`,
        '-movflags', '+faststart',
        '-c:v', 'libx264',
        '-threads', '4',
        '-x264-params', 'sliced-threads=1:threads=4',
        '-crf', ENCODE_PRESET.crf,
        '-maxrate', ENCODE_PRESET.maxrate,
        '-bufsize', ENCODE_PRESET.bufsize,
        '-preset', ENCODE_PRESET.preset,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', ENCODE_PRESET.audioBitrate, '-ac', '1',
        outFile,
      ]);

      if (exit !== 0) {
        try { await ff.deleteFile(outFile); } catch {}
        exit = await ff.exec([
          '-ss', clipStart.toFixed(2), '-t', segDur.toFixed(2), '-i', inFile,
          '-vf', `${outputProfile.scaleFilter},setsar=1`, '-movflags', '+faststart',
          '-c:v', 'mpeg4', '-q:v', '4',
          '-c:a', 'aac', '-b:a', ENCODE_PRESET.audioBitrate, '-ac', '1',
          outFile,
        ]);
      }

      if (exit !== 0) throw new Error('FFmpeg no pudo generar el video.');

      const data = await ff.readFile(outFile);
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);

      setProgress(1);
      setResultUrl(url);
      setResultName(outFile);

      try { await ff.deleteFile(inFile); } catch {}
      try { await ff.deleteFile(outFile); } catch {}

      // Small delay so user sees 100% before transition
      await new Promise((r) => setTimeout(r, 600));
      setStep('done');
    } catch (err) {
      setErrorMessage(err?.message || 'Error al convertir el video.');
      setStep('trim');
    } finally {
      isTranscodingRef.current = false;
      activeSegRef.current = 0;
    }
  };

  /* ── Reset ── */
  const startOver = () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    setSourceFile(null);
    setSourceUrl('');
    setSourceDuration(0);
    setSourceResolution(null);
    setClipStart(0);
    setClipEnd(0);
    setThumbnails([]);
    setProgress(0);
    setResultUrl('');
    setResultName('');
    setErrorMessage('');
    setStep('pick');
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="min-h-screen bg-mansion-base text-text-primary flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-mansion-gold/[0.06] blur-[120px]" />
      </div>

      {/* Hidden video for metadata + preview */}
      {sourceUrl && (
        <video
          ref={videoRef}
          src={sourceUrl}
          className="hidden"
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
        />
      )}

      <div className="relative w-full max-w-lg z-10">
        <AnimatePresence mode="wait">

          {/* ───── STEP 1: PICK ───── */}
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
                Por favor, seleccioná tu video para comenzar.
              </p>

              <label className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg cursor-pointer hover:bg-mansion-gold-light transition-colors">
                <Upload className="w-5 h-5" />
                Elegir video
                <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
              </label>
            </motion.div>
          )}

          {/* ───── STEP 2: TRIM ───── */}
          {step === 'trim' && (
            <motion.div key="trim" {...fadeSlide} variants={stagger} initial="initial" animate="animate" exit="exit">
              <motion.div variants={childFade} className="text-center mb-6">
                <h2 className="font-display text-2xl font-bold mb-2">Recortá tu video</h2>
                <p className="text-text-muted text-sm">
                  Podés seleccionar la parte del video que deseas publicar <span className="text-text-dim">(opcional)</span>
                </p>
              </motion.div>

              {/* Video preview */}
              <motion.div variants={childFade} className="aspect-video rounded-2xl overflow-hidden bg-black/50 border border-white/10 mb-5 relative">
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    // Re-trigger metadata if already loaded
                    if (el && el.readyState >= 1 && sourceDuration === 0) handleLoadedMetadata();
                  }}
                  src={sourceUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain bg-black"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                />
              </motion.div>

              {/* Filmstrip trimmer */}
              <motion.div variants={childFade}>
                <div
                  ref={trimmerRef}
                  className="relative h-[56px] rounded-xl bg-black/40 overflow-hidden select-none touch-none"
                >
                  {/* Thumbnails */}
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

                  {/* Left dim */}
                  <div className="absolute inset-y-0 left-0 bg-black/60 pointer-events-none" style={{ width: `${segmentOffset}%` }} />
                  {/* Right dim */}
                  <div className="absolute inset-y-0 right-0 bg-black/60 pointer-events-none" style={{ width: `${Math.max(0, 100 - segmentOffset - segmentWidth)}%` }} />

                  {/* Top/bottom borders */}
                  <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${segmentOffset}%`, width: `${segmentWidth}%` }}>
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
                <div className="flex items-center justify-between gap-2 mt-2 text-xs text-text-dim">
                  <span>{formatTime(clipStart)}</span>
                  <span className="text-mansion-gold font-semibold">{selectedDuration > 0 ? `${selectedDuration.toFixed(1)}s` : '—'}</span>
                  <span>{formatTime(clipEnd)}</span>
                </div>
              </motion.div>

              {/* Error */}
              {errorMessage && (
                <motion.div variants={childFade} className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </motion.div>
              )}

              {/* Convert button */}
              <motion.div variants={childFade} className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={transcode}
                  disabled={!sourceFile || selectedDuration <= 0}
                  className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-mansion-crimson text-white font-semibold text-lg hover:bg-mansion-crimson-dark disabled:opacity-50 transition-colors"
                >
                  <Wand2 className="w-5 h-5" />
                  Convertir video
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ───── STEP 3: ENCODING ───── */}
          {step === 'encoding' && (
            <motion.div key="encoding" {...fadeSlide} className="flex flex-col items-center text-center py-16">
              <LoaderCircle className="w-10 h-10 text-mansion-gold animate-spin mb-6" />
              <h2 className="font-display text-2xl font-bold mb-2">Procesando tu historia…</h2>
              <p className="text-text-muted text-sm mb-8">Esto puede tomar unos segundos.</p>

              {/* Minimal progress bar */}
              <div className="w-full max-w-xs">
                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-mansion-gold to-mansion-gold-light"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(progress * 100)}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-sm text-text-dim mt-2 tabular-nums">{Math.round(progress * 100)}%</p>
              </div>
            </motion.div>
          )}

          {/* ───── STEP 4: DONE ───── */}
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

              {/* Preview */}
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
