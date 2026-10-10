import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button } from "@forkvlift/ui";
import { usePreferences } from "../../app/preferences";
import { musicEngine, TRACKS } from "./synth";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore storage issues in private mode
  }
}

/**
 * Elevator music player in the header slot (Task 1.13).
 * Supports: mute/unmute, volume slider, track skipping, remembered choice.
 * Strictly adheres to autoplay policies: starts only on first click.
 */
export function MusicButton() {
  const { motionReduced } = usePreferences();
  const [open, setOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => readStorage("fv-music-muted", false));
  const [volume, setVolume] = useState(() => readStorage("fv-music-volume", 0.35));
  const [trackIndex, setTrackIndex] = useState(() => readStorage("fv-music-track", 0));
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync engine state on mount
  useEffect(() => {
    musicEngine.setMuted(isMuted);
    musicEngine.setVolume(volume);
  }, [isMuted, volume]);

  // Close panel on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  const togglePlay = useCallback(() => {
    if (!isPlaying) {
      void musicEngine.play(trackIndex);
      setIsPlaying(true);
    } else {
      musicEngine.pause();
      setIsPlaying(false);
    }
  }, [isPlaying, trackIndex]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    musicEngine.setMuted(nextMuted);
    writeStorage("fv-music-muted", nextMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVol = parseFloat(e.target.value);
    setVolume(nextVol);
    musicEngine.setVolume(nextVol);
    writeStorage("fv-music-volume", nextVol);
    if (isMuted && nextVol > 0) {
      setIsMuted(false);
      musicEngine.setMuted(false);
      writeStorage("fv-music-muted", false);
    }
  }, [isMuted]);

  const handleSkip = useCallback(() => {
    const nextIndex = musicEngine.nextTrack();
    setTrackIndex(nextIndex);
    writeStorage("fv-music-track", nextIndex);
    if (!isPlaying) {
      void musicEngine.play(nextIndex);
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSelectTrack = useCallback((index: number) => {
    setTrackIndex(index);
    writeStorage("fv-music-track", index);
    void musicEngine.play(index);
    setIsPlaying(true);
  }, []);

  const currentTrack = TRACKS[trackIndex] ?? TRACKS[0]!;

  return (
    <div className="relative" ref={panelRef}>
      {/* Primary Header Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-1.5 rounded-pixel border border-border bg-surface px-2.5 text-xs font-medium text-fg hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-focus"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Elevator music: ${currentTrack.title} (${isPlaying ? (isMuted ? "muted" : "playing") : "paused"})`}
      >
        {/* Animated Sound Wave Bars */}
        <span className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
          <span
            className={`w-0.5 bg-pixel-4 rounded-pixel transition-all ${
              isPlaying && !isMuted && !motionReduced
                ? "h-3 animate-pulse"
                : isPlaying && !isMuted
                  ? "h-2.5"
                  : "h-1 bg-muted"
            }`}
          />
          <span
            className={`w-0.5 bg-pixel-5 rounded-pixel transition-all ${
              isPlaying && !isMuted && !motionReduced
                ? "h-3.5 animate-pulse"
                : isPlaying && !isMuted
                  ? "h-3"
                  : "h-1.5 bg-muted"
            }`}
          />
          <span
            className={`w-0.5 bg-pixel-6 rounded-pixel transition-all ${
              isPlaying && !isMuted && !motionReduced
                ? "h-2.5 animate-pulse"
                : isPlaying && !isMuted
                  ? "h-2"
                  : "h-1 bg-muted"
            }`}
          />
        </span>

        <span className="hidden sm:inline font-mono">
          {isPlaying ? (isMuted ? "Muted" : "Music ON") : "Music"}
        </span>
      </button>

      {/* Expanded Control Popover */}
      {open ? (
        <div
          role="dialog"
          aria-label="Elevator music player"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-card border border-border bg-surface p-4 text-fg shadow-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-semibold text-fg">
                Elevator Music
              </span>
              <Badge tone="accent">CC0</Badge>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
              aria-label="Close music player"
            >
              ✕
            </button>
          </div>

          {/* Now Playing Card */}
          <div className="mt-3 rounded-pixel bg-surface-2 p-2.5">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs font-semibold text-fg">
                {currentTrack.title}
              </p>
              <span className="font-mono text-[10px] text-muted">
                {currentTrack.bpm} BPM
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {currentTrack.subtitle}
            </p>
          </div>

          {/* Main Controls: Play/Pause, Skip, Mute */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant={isPlaying ? "secondary" : "primary"}
              size="sm"
              onClick={togglePlay}
              className="flex-1"
            >
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSkip}
              title="Next track"
            >
              Skip ⏭
            </Button>
            <Button
              variant={isMuted ? "danger" : "ghost"}
              size="sm"
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "Unmute" : "Mute"}
            </Button>
          </div>

          {/* Volume Slider */}
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-muted">
              <span>Volume</span>
              <span className="font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              aria-label="Volume slider"
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Track Selection */}
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
              Select Track
            </p>
            <div className="flex flex-col gap-1">
              {TRACKS.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTrack(idx)}
                  className={`flex items-center justify-between rounded-pixel px-2 py-1 text-xs text-left transition ${
                    trackIndex === idx
                      ? "bg-surface-2 font-medium text-fg"
                      : "text-muted hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  <span>{t.title}</span>
                  {trackIndex === idx && isPlaying ? (
                    <span className="text-[10px] font-mono text-accent">Playing</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Footer licensing note */}
          <div className="mt-3 border-t border-border pt-2 text-center text-[10px] text-muted">
            Original synthesized tunes · 100% royalty-free CC0
          </div>
        </div>
      ) : null}
    </div>
  );
}
