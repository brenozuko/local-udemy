"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

const SAVE_INTERVAL_MS = 5000;
const COMPLETE_THRESHOLD = 0.9;
const RESUME_TAIL_SECONDS = 15;
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SPEED_STORAGE_KEY = "player-speed";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function Player({
  lessonId,
  courseId,
  initialPosition,
  initialWatched,
  prevId,
  nextId,
}: {
  lessonId: number;
  courseId: number;
  initialPosition: number;
  initialWatched: boolean;
  prevId: number | null;
  nextId: number | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSaveRef = useRef(0);
  const markedRef = useRef(initialWatched);
  const [watched, setWatched] = useState(initialWatched);
  const [streamError, setStreamError] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Render the <video> only after mount: browser extensions (e.g. Video Speed
  // Controller) inject DOM next to video tags and break hydration otherwise.
  const [mounted, setMounted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Seek-bar hover preview: a hidden second <video> on the same stream is
  // seeked to the hovered time (the stream route supports Range requests).
  const previewRef = useRef<HTMLVideoElement>(null);
  const [preview, setPreview] = useState<{ time: number; x: number } | null>(
    null
  );

  function onSeekBarHover(e: React.MouseEvent<HTMLInputElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const time = ratio * duration;
    setPreview({ time, x: e.clientX - rect.left });
    const pv = previewRef.current;
    if (pv && pv.readyState >= 1 && Math.abs(pv.currentTime - time) > 0.5) {
      pv.currentTime = time;
    }
  }

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    const saved = Number(localStorage.getItem(SPEED_STORAGE_KEY));
    if (SPEEDS.includes(saved)) setSpeed(saved);
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function changeSpeed(value: number) {
    setSpeed(value);
    setSpeedMenuOpen(false);
    localStorage.setItem(SPEED_STORAGE_KEY, String(value));
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function changeVolume(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(video.muted);
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  const save = useCallback(
    (extra?: { watched?: 0 | 1 }) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration)) return;
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          position: video.currentTime,
          duration: video.duration,
          ...extra,
        }),
      }).catch(() => {});
    },
    [lessonId]
  );

  function markWatchedOnce() {
    if (markedRef.current) return;
    markedRef.current = true;
    setWatched(true);
    save({ watched: 1 });
    router.refresh();
  }

  function onLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setDuration(video.duration);
    if (
      initialPosition > 0 &&
      initialPosition < video.duration - RESUME_TAIL_SECONDS
    ) {
      video.currentTime = initialPosition;
    }
  }

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    const now = Date.now();
    if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
      lastSaveRef.current = now;
      save();
    }
    if (
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.currentTime / video.duration >= COMPLETE_THRESHOLD
    ) {
      markWatchedOnce();
    }
  }

  function onEnded() {
    markWatchedOnce();
    if (nextId) {
      router.push(`/courses/${courseId}/lessons/${nextId}`);
    }
  }

  useEffect(() => {
    function beacon() {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.currentTime === 0)
        return;
      navigator.sendBeacon(
        "/api/progress",
        new Blob(
          [
            JSON.stringify({
              lessonId,
              position: video.currentTime,
              duration: video.duration,
            }),
          ],
          { type: "text/plain" }
        )
      );
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") beacon();
    }
    window.addEventListener("pagehide", beacon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", beacon);
      document.removeEventListener("visibilitychange", onVisibility);
      beacon();
    };
  }, [lessonId]);

  return (
    <div className="space-y-4">
      {streamError ? (
        <div className="flex aspect-video items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
          Vídeo indisponível — o drive externo está montado?
        </div>
      ) : (
        <div
          ref={containerRef}
          onMouseMove={showControls}
          onMouseLeave={() => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            setControlsVisible(false);
          }}
          className={`group relative overflow-hidden bg-black ${
            fullscreen ? "flex h-full items-center" : "rounded-lg border"
          } ${
            playing && !controlsVisible && !speedMenuOpen ? "cursor-none" : ""
          }`}
        >
          {mounted ? (
            <video
              ref={videoRef}
              src={`/api/stream/${lessonId}`}
              autoPlay
              className={`w-full ${fullscreen ? "h-full" : "aspect-video"}`}
              onClick={togglePlay}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              onError={() => setStreamError(true)}
            />
          ) : (
            <div className="aspect-video w-full" />
          )}

          {/* Control bar */}
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-8 transition-opacity ${
              playing && !controlsVisible && !speedMenuOpen
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            }`}
          >
            <div className="relative">
              <div
                className={`pointer-events-none absolute bottom-4 z-10 -translate-x-1/2 overflow-hidden rounded-md border border-white/20 bg-black shadow-lg ${
                  preview ? "visible" : "invisible"
                }`}
                style={{
                  left: `clamp(80px, ${preview?.x ?? 0}px, calc(100% - 80px))`,
                }}
              >
                <video
                  ref={previewRef}
                  src={`/api/stream/${lessonId}`}
                  muted
                  preload="metadata"
                  className="aspect-video w-40 object-cover"
                />
                <div className="py-0.5 text-center text-sm tabular-nums text-white">
                  {preview ? formatTime(preview.time) : "0:00"}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                onMouseMove={onSeekBarHover}
                onMouseLeave={() => setPreview(null)}
                aria-label="Progresso do vídeo"
                className="mb-1 block h-1 w-full cursor-pointer accent-primary"
              />
            </div>
            <div className="flex items-center gap-3 text-white">
              <button
                onClick={togglePlay}
                title={playing ? "Pausar" : "Reproduzir"}
                className="hover:text-primary"
              >
                {playing ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  title={muted ? "Ativar som" : "Silenciar"}
                  className="hover:text-primary"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="h-1 w-20 cursor-pointer accent-primary"
                />
              </div>

              <span className="text-sm tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="ml-auto flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={() => setSpeedMenuOpen((o) => !o)}
                    title="Velocidade de reprodução"
                    className="rounded px-1.5 py-0.5 text-sm font-semibold hover:text-primary"
                  >
                    {speed}x
                  </button>
                  {speedMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-20 overflow-hidden rounded-md bg-black/90 backdrop-blur-sm">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          onClick={() => changeSpeed(s)}
                          className={`block w-full px-3 py-1.5 text-left text-sm text-white hover:bg-white/20 ${
                            s === speed ? "bg-white/10 font-semibold" : ""
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={toggleFullscreen}
                  title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
                  className="hover:text-primary"
                >
                  {fullscreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-6">
        <Button variant="outline" size="sm" asChild disabled={!prevId}>
          {prevId ? (
            <Link href={`/courses/${courseId}/lessons/${prevId}`}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Link>
          ) : (
            <span className="opacity-50">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </span>
          )}
        </Button>

        {watched && (
          <span className="flex items-center gap-1 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" /> Assistida
          </span>
        )}

        <Button variant="outline" size="sm" asChild disabled={!nextId}>
          {nextId ? (
            <Link href={`/courses/${courseId}/lessons/${nextId}`}>
              Próxima <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="opacity-50">
              Próxima <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
