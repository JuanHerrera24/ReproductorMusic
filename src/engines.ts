/**
 * ============================================================
 *  PLAYBACK ENGINES
 * ============================================================
 *  The MusicPlayer does not care where the sound comes from. It talks to
 *  a PlaybackEngine, and there is one engine per kind of source:
 *    - AudioEngine   → mp3 files / links (HTMLAudioElement)
 *    - YouTubeEngine → YouTube videos (official IFrame player)
 */

/** Events an engine reports back to the player. */
interface EngineEvents {
  onTime: (seconds: number) => void;
  onDuration: (seconds: number) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  /** The engine started/stopped playing by itself (e.g. the user used the YouTube controls). */
  onPlayState: (playing: boolean) => void;
  /** The engine was asked to play but nothing started (e.g. the browser blocked autoplay). */
  onStalled?: () => void;
}

interface PlaybackEngine {
  /** Prepares a song without starting it. */
  load(song: Song): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  /** Volume from 0 to 1. */
  setVolume(volume: number): void;
  /** Stops everything and frees the source. */
  release(): void;
}

class AudioEngine implements PlaybackEngine {
  private readonly audio = new Audio();
  private hasSource = false;

  constructor(private readonly events: EngineEvents) {
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () => this.events.onTime(this.audio.currentTime));
    this.audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(this.audio.duration)) this.events.onDuration(this.audio.duration);
    });
    this.audio.addEventListener("ended", () => this.events.onEnded());
    this.audio.addEventListener("error", () => {
      if (this.hasSource) this.events.onError(""); // ignore errors caused by release()
    });
  }

  load(song: Song): void {
    this.audio.src = song.src;
    this.hasSource = true;
  }

  play(): Promise<void> {
    return this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  seek(seconds: number): void {
    if (!this.hasSource) return;
    const max = Number.isFinite(this.audio.duration) ? this.audio.duration : Infinity;
    this.audio.currentTime = Math.min(Math.max(0, seconds), max);
  }

  setVolume(volume: number): void {
    this.audio.volume = volume;
  }

  release(): void {
    this.audio.pause();
    this.hasSource = false;
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
