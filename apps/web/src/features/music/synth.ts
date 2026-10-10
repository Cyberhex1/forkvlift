/**
 * Procedural Elevator Music Synthesizer (Task 1.13).
 * Generates warm, mellow 16-bit / chiptune / bossa-nova elevator music
 * entirely using Web Audio API without any external dependencies.
 * All compositions are CC0 (Public Domain).
 */

export interface Track {
  id: string;
  title: string;
  subtitle: string;
  bpm: number;
}

export const TRACKS: Track[] = [
  {
    id: "lobby-bossa",
    title: "Lobby Bossa",
    subtitle: "16-bit elevator lounge · Cmaj7",
    bpm: 110,
  },
  {
    id: "penthouse-chill",
    title: "Penthouse Chill",
    subtitle: "Lo-Fi mellow jazz · Fmaj7",
    bpm: 90,
  },
  {
    id: "warehouse-8bit",
    title: "Warehouse 8-Bit",
    subtitle: "Upbeat forklift groove · G major",
    bpm: 124,
  },
];

// Note frequencies in Hz
const NOTES = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  REST: 0,
} as const;

type NoteName = keyof typeof NOTES;

interface TrackScore {
  chords: Array<{ root: NoteName; third: NoteName; fifth: NoteName; seventh: NoteName; duration: number }>;
  melody: Array<{ note: NoteName; duration: number }>;
  bass: Array<{ note: NoteName; duration: number }>;
}

const SCORES: Record<string, TrackScore> = {
  "lobby-bossa": {
    chords: [
      { root: "C4", third: "E4", fifth: "G4", seventh: "B4", duration: 4 }, // Cmaj7
      { root: "A3", third: "C4", fifth: "E4", seventh: "G4", duration: 4 }, // Am7
      { root: "D3", third: "F4", fifth: "A4", seventh: "C5", duration: 4 }, // Dm7
      { root: "G3", third: "B4", fifth: "D4", seventh: "F4", duration: 4 }, // G7
    ],
    melody: [
      { note: "E4", duration: 1 },
      { note: "G4", duration: 1 },
      { note: "B4", duration: 1 },
      { note: "C5", duration: 1 },
      { note: "E5", duration: 2 },
      { note: "D5", duration: 1 },
      { note: "C5", duration: 1 },
      { note: "A4", duration: 1 },
      { note: "C5", duration: 1 },
      { note: "E5", duration: 1 },
      { note: "D5", duration: 1 },
      { note: "B4", duration: 2 },
      { note: "G4", duration: 2 },
    ],
    bass: [
      { note: "C3", duration: 2 },
      { note: "G3", duration: 2 },
      { note: "A3", duration: 2 },
      { note: "E3", duration: 2 },
      { note: "D3", duration: 2 },
      { note: "A3", duration: 2 },
      { note: "G3", duration: 2 },
      { note: "D3", duration: 2 },
    ],
  },
  "penthouse-chill": {
    chords: [
      { root: "F3", third: "A3", fifth: "C4", seventh: "E4", duration: 4 }, // Fmaj7
      { root: "E3", third: "G3", fifth: "B3", seventh: "D4", duration: 4 }, // Em7
      { root: "D3", third: "F3", fifth: "A3", seventh: "C4", duration: 4 }, // Dm7
      { root: "C3", third: "E3", fifth: "G3", seventh: "B3", duration: 4 }, // Cmaj7
    ],
    melody: [
      { note: "A4", duration: 2 },
      { note: "G4", duration: 1 },
      { note: "E4", duration: 1 },
      { note: "G4", duration: 2 },
      { note: "D4", duration: 2 },
      { note: "F4", duration: 1.5 },
      { note: "E4", duration: 0.5 },
      { note: "D4", duration: 1 },
      { note: "C4", duration: 1 },
      { note: "E4", duration: 4 },
    ],
    bass: [
      { note: "F3", duration: 4 },
      { note: "E3", duration: 4 },
      { note: "D3", duration: 4 },
      { note: "C3", duration: 4 },
    ],
  },
  "warehouse-8bit": {
    chords: [
      { root: "G3", third: "B3", fifth: "D4", seventh: "G4", duration: 4 }, // G
      { root: "E3", third: "G3", fifth: "B3", seventh: "E4", duration: 4 }, // Em
      { root: "C3", third: "E3", fifth: "G3", seventh: "C4", duration: 4 }, // C
      { root: "D3", third: "F4", fifth: "A3", seventh: "D4", duration: 4 }, // D
    ],
    melody: [
      { note: "G4", duration: 0.5 },
      { note: "B4", duration: 0.5 },
      { note: "D5", duration: 1 },
      { note: "B4", duration: 0.5 },
      { note: "G4", duration: 0.5 },
      { note: "E5", duration: 1 },
      { note: "G4", duration: 0.5 },
      { note: "C5", duration: 0.5 },
      { note: "E5", duration: 1 },
      { note: "D5", duration: 1 },
      { note: "A4", duration: 1 },
      { note: "G4", duration: 2 },
      { note: "REST", duration: 2 },
    ],
    bass: [
      { note: "G3", duration: 1 },
      { note: "G3", duration: 1 },
      { note: "E3", duration: 1 },
      { note: "E3", duration: 1 },
      { note: "C3", duration: 1 },
      { note: "C3", duration: 1 },
      { note: "D3", duration: 1 },
      { note: "D3", duration: 1 },
    ],
  },
};

class ElevatorMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timerId: number | null = null;
  private currentTrackIndex = 0;
  private isPlayingState = false;
  private isMutedState = false;
  private volumeLevel = 0.35; // pleasant 35% background default

  public init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Low-pass filter to give that warm, mellow elevator acoustic
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

    // Master volume gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMutedState ? 0 : this.volumeLevel, this.ctx.currentTime);

    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  public async play(trackIndex?: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    if (trackIndex !== undefined) {
      this.currentTrackIndex = trackIndex % TRACKS.length;
    }

    this.stopPlayback();
    this.isPlayingState = true;
    this.scheduleLoop();
  }

  public pause() {
    this.isPlayingState = false;
    this.stopPlayback();
  }

  public togglePlay(): boolean {
    if (this.isPlayingState) {
      this.pause();
      return false;
    } else {
      void this.play();
      return true;
    }
  }

  public setVolume(vol: number) {
    this.volumeLevel = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain && !this.isMutedState) {
      this.masterGain.gain.setValueAtTime(this.volumeLevel, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean) {
    this.isMutedState = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volumeLevel, this.ctx.currentTime);
    }
  }

  public nextTrack(): number {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % TRACKS.length;
    if (this.isPlayingState) {
      void this.play(this.currentTrackIndex);
    }
    return this.currentTrackIndex;
  }

  public getCurrentTrack(): Track {
    const track = TRACKS[this.currentTrackIndex];
    if (track) return track;
    return TRACKS[0]!;
  }

  public getCurrentTrackIndex(): number {
    return this.currentTrackIndex;
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public getVolume(): number {
    return this.volumeLevel;
  }

  private stopPlayback() {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleLoop() {
    if (!this.isPlayingState || !this.ctx || !this.filter) return;

    const track = this.getCurrentTrack();
    const defaultScore = SCORES["lobby-bossa"]!;
    const score = SCORES[track.id] ?? defaultScore;
    const beatSec = 60 / track.bpm;
    const now = this.ctx.currentTime + 0.05;

    // Schedule chords
    let chordTime = now;
    for (const ch of score.chords) {
      const dur = ch.duration * beatSec;
      this.playNote(NOTES[ch.root], chordTime, dur, "triangle", 0.07);
      this.playNote(NOTES[ch.third], chordTime, dur, "sine", 0.05);
      this.playNote(NOTES[ch.fifth], chordTime, dur, "sine", 0.04);
      this.playNote(NOTES[ch.seventh], chordTime, dur, "sine", 0.03);
      chordTime += dur;
    }

    // Schedule melody
    let melodyTime = now;
    for (const m of score.melody) {
      const dur = m.duration * beatSec;
      if (m.note !== "REST") {
        this.playNote(NOTES[m.note], melodyTime, dur * 0.9, "sine", 0.12);
      }
      melodyTime += dur;
    }

    // Schedule bass
    let bassTime = now;
    for (const b of score.bass) {
      const dur = b.duration * beatSec;
      this.playNote(NOTES[b.note], bassTime, dur * 0.8, "triangle", 0.15);
      bassTime += dur;
    }

    // Loop duration is the maximum of scheduled tracks
    const totalDuration = Math.max(chordTime, melodyTime, bassTime) - now;

    this.timerId = window.setTimeout(() => {
      if (this.isPlayingState) {
        this.scheduleLoop();
      }
    }, totalDuration * 1000 - 150);
  }

  private playNote(freq: number, startTime: number, duration: number, type: OscillatorType, gainVal: number) {
    if (!this.ctx || !this.filter || freq <= 0) return;

    try {
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Subtle envelope (soft attack & fade)
      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(gainVal, startTime + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(this.filter);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch {
      // AudioContext state error safely handled
    }
  }
}

export const musicEngine = new ElevatorMusicEngine();
