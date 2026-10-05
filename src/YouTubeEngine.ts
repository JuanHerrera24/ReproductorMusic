/**
 * ============================================================
 *  YOUTUBE ENGINE (official IFrame Player API)
 * ============================================================
 *  YouTube audio cannot be downloaded, so these songs are played with
 *  YouTube's own embedded player, which must stay visible on screen.
 *  The container element (#yt-player) lives outside the re-rendered
 *  player card so the iframe is never destroyed.
 */

/** Minimal shape of the YT.Player object that we use. */
interface YTPlayerLike {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
}

class YouTubeEngine implements PlaybackEngine {
  private static apiPromise: Promise<void> | null = null;

  private player: YTPlayerLike | null = null;
  private creating = false;
  private ready = false;
  private videoId: string | null = null;
  /** Video currently loaded inside the iframe. */
  private loadedVideoId: string | null = null;
  private wantsPlay = false;
  private volume = 0.8;
  private lastDuration = 0;
  private pollTimer: number | null = null;
  /** Ignores PAUSED events caused by our own load/cue calls. */
  private ignorePauseUntil = 0;
  /** true once YouTube reported the PLAYING state for the current request. */
  private playing = false;
  private stallTimer: number | null = null;
  /** How long we wait for the video to start before warning the user. */
  private static readonly STALL_MS = 5000;

  constructor(private readonly containerId: string, private readonly events: EngineEvents) {}

  load(song: Song): void {
    this.videoId = song.youtubeId ?? null;
    this.wantsPlay = false;
    this.lastDuration = 0;
    this.ignorePauseUntil = Date.now() + 500;
    this.playing = false;
    this.stopPolling();
    this.clearStallTimer();
    this.ensurePlayer();
    if (this.ready && this.player && this.videoId) {
      this.player.cueVideoById(this.videoId);
      this.loadedVideoId = this.videoId;
    }
  }

  play(): Promise<void> {
    this.wantsPlay = true;
    this.armStallTimer();
    this.ensurePlayer();
    if (this.ready && this.player && this.videoId) {
      if (this.loadedVideoId !== this.videoId) {
        this.player.loadVideoById(this.videoId);
        this.loadedVideoId = this.videoId;
      } else {
        this.player.playVideo();
      }
    }
    // If the player is not ready yet, onReady starts the video.
    return Promise.resolve();
  }

  pause(): void {
    this.wantsPlay = false;
    this.clearStallTimer();
    if (this.ready && this.player) this.player.pauseVideo();
  }

  seek(seconds: number): void {
    if (this.ready && this.player && this.loadedVideoId) this.player.seekTo(Math.max(0, seconds), true);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.ready && this.player) this.player.setVolume(Math.round(volume * 100));
  }

  release(): void {
    this.wantsPlay = false;
    this.ignorePauseUntil = Date.now() + 500;
    this.playing = false;
    this.stopPolling();
    this.clearStallTimer();
    if (this.ready && this.player && this.loadedVideoId) this.player.stopVideo();
    this.loadedVideoId = null;
    this.videoId = null;
  }

  // ---------------------- Internals ----------------------

  private static loadApi(): Promise<void> {
    if (!YouTubeEngine.apiPromise) {
      YouTubeEngine.apiPromise = new Promise((resolve, reject) => {
        const w = window as any;
        if (w.YT && w.YT.Player) return resolve();
        const previous = w.onYouTubeIframeAPIReady;
        w.onYouTubeIframeAPIReady = () => {
          if (typeof previous === "function") previous();
          resolve();
        };
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.onerror = () => {
          YouTubeEngine.apiPromise = null;
          reject(new Error("api"));
        };
        document.head.appendChild(tag);
      });
    }
    return YouTubeEngine.apiPromise;
  }

  private ensurePlayer(): void {
    if (this.player || this.creating) return;
    this.creating = true;
    YouTubeEngine.loadApi()
      .then(() => this.createPlayer())
      .catch(() => {
        this.creating = false;
        this.events.onError("No se pudo cargar el reproductor de YouTube. Revisa tu conexión a internet");
      });
  }

  private createPlayer(attempt = 0): void {
    // YouTube blocks autoplay when the player has no size, so wait until the container is visible.
    const box = document.getElementById(this.containerId);
    if (box && box.offsetWidth === 0 && attempt < 30) {
      window.setTimeout(() => this.createPlayer(attempt + 1), 100);
      return;
    }
    const YT = (window as any).YT;
    const origin = location.protocol.startsWith("http") ? location.origin : undefined;
    this.player = new YT.Player(this.containerId, {
      width: "100%",
      height: "100%",
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin },
      events: {
        onReady: () => this.handleReady(),
        onStateChange: (e: { data: number }) => this.handleState(e.data),
        onError: (e: { data: number }) => {
          console.warn("[YouTube] error code", e.data);
          this.events.onError(YouTubeEngine.errorMessage(e.data));
        },
      },
    }) as YTPlayerLike;
    this.creating = false;
  }

  private handleReady(): void {
    console.info("[YouTube] player ready");
    this.ready = true;
    this.player!.setVolume(Math.round(this.volume * 100));
    if (!this.videoId) return;
    if (this.wantsPlay) this.player!.loadVideoById(this.videoId);
    else this.player!.cueVideoById(this.videoId);
    this.loadedVideoId = this.videoId;
    if (this.wantsPlay) this.armStallTimer();
  }

  /** If the video does not start soon after play(), tell the player (autoplay probably blocked). */
  private armStallTimer(): void {
    this.clearStallTimer();
    this.stallTimer = window.setTimeout(() => {
      this.stallTimer = null;
      if (this.wantsPlay && !this.playing) {
        console.warn("[YouTube] video did not start (autoplay blocked or player not ready)");
        this.events.onStalled?.();
      }
    }, YouTubeEngine.STALL_MS);
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) {
      window.clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }

  private handleState(state: number): void {
    console.debug("[YouTube] state", state);
    const S = (window as any).YT.PlayerState;
    this.playing = state === S.PLAYING;
    if (state === S.PLAYING) {
      this.clearStallTimer();
      this.startPolling();
      this.reportDuration();
      this.events.onPlayState(true);
    } else if (state === S.PAUSED) {
      this.stopPolling();
      if (Date.now() >= this.ignorePauseUntil) this.events.onPlayState(false);
    } else if (state === S.ENDED) {
      this.stopPolling();
      this.events.onEnded();
    } else if (state === S.CUED) {
      this.reportDuration();
    }
  }

  private reportDuration(): void {
    const d = this.player?.getDuration() ?? 0;
    if (d > 0 && d !== this.lastDuration) {
      this.lastDuration = d;
      this.events.onDuration(d);
    }
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = window.setInterval(() => {
      if (!this.player) return;
      this.events.onTime(this.player.getCurrentTime());
      this.reportDuration();
    }, 500);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private static errorMessage(code: number): string {
    switch (code) {
      case 2: return "El enlace del video de YouTube no es válido";
      case 5: return "El reproductor de YouTube tuvo un problema con este video";
      case 100: return "Ese video no existe o es privado";
      case 101:
      case 150: return "El dueño de ese video no permite reproducirlo fuera de YouTube";
      case 153: return "YouTube necesita que abras la página desde un servidor local (http://localhost), no con doble clic";
      default: return "No se pudo reproducir este video de YouTube";
    }
  }
}
