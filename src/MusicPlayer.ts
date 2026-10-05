/**
 * ============================================================
 *  PLAYER LOGIC (independent from the interface)
 * ============================================================
 *  Uses a DoublyLinkedList<Song> as the playlist and a `current`
 *  pointer to the node that is playing. Skipping forward and going back
 *  are simply following `current.next` or `current.prev` (O(1)).
 *
 *  The sound is produced by a PlaybackEngine: a real HTMLAudioElement for
 *  mp3 files and YouTube's embedded player for YouTube songs.
 */

class MusicPlayer {
  readonly playlist = new DoublyLinkedList<Song>();
  current: DoublyNode<Song> | null = null;
  isPlaying = false;
  elapsed = 0;
  repeat: RepeatMode = "off";
  volume = 0.8;

  /** Called when the state changes (list, song, play/pause...). */
  onChange: () => void = () => {};
  /** Called while playing (only updates the progress). */
  onTick: () => void = () => {};
  /** Called to show notices to the user. */
  onNotice: (message: string, type: NoticeType) => void = () => {};

  private readonly audioEngine: AudioEngine;
  private readonly youtubeEngine: YouTubeEngine;
  /** Engine that currently owns the loaded song. */
  private engine: PlaybackEngine;
  /** id of the song that is loaded in the active engine. */
  private loadedId: string | null = null;

  constructor() {
    this.audioEngine = new AudioEngine(this.eventsFor(() => this.audioEngine));
    this.youtubeEngine = new YouTubeEngine("yt-player", this.eventsFor(() => this.youtubeEngine));
    this.engine = this.audioEngine;
    this.setVolume(this.volume);
  }

  // ---------------------- Playlist ----------------------

  /** Replaces the whole list (no notices). Used when the app starts. */
  load(songs: Song[], currentId?: string): void {
    this.release();
    this.isPlaying = false;
    this.elapsed = 0;
    this.playlist.clear();
    songs.forEach((s) => this.playlist.addLast(s));
    this.current = this.findById(currentId) ?? this.playlist.head;
    this.ensureLoaded();
    this.onChange();
  }

  /** Adds a song at the start, at the end or at any position. */
  add(song: Song, position: SongPosition): DoublyNode<Song> {
    let node: DoublyNode<Song>;
    switch (position.kind) {
      case "start":
        node = this.playlist.addFirst(song);
        break;
      case "end":
        node = this.playlist.addLast(song);
        break;
      case "index":
        node = this.playlist.addAt(position.index, song);
        break;
    }
    if (!this.current) {
      this.current = node;
      this.ensureLoaded();
    }
    this.onChange();
    return node;
  }

  /** Removes a song. If it was the current one, moves to the next (or previous) one. */
  remove(node: DoublyNode<Song>): void {
    const wasCurrent = node === this.current;
    const fallback = node.next ?? node.prev; // computed BEFORE unlinking
    this.playlist.removeNode(node);

    if (wasCurrent) {
      this.current = fallback;
      this.elapsed = 0;
      if (this.current) {
        this.afterTrackChange();
      } else {
        this.isPlaying = false;
        this.release();
      }
    }
    this.onChange();
  }

  /** Moves a song up (-1) or down (+1) inside the list. */
  shift(node: DoublyNode<Song>, direction: -1 | 1): void {
    const index = this.playlist.indexOf(node);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= this.playlist.size) return;
    this.playlist.move(node, target);
    this.onChange();
  }

  clear(): void {
    this.isPlaying = false;
    this.release();
    this.playlist.clear();
    this.current = null;
    this.elapsed = 0;
    this.onChange();
  }

  findById(id?: string): DoublyNode<Song> | null {
    if (!id) return null;
    for (const n of this.playlist.nodes()) if (n.value.id === id) return n;
    return null;
  }

  totalDuration(): number {
    let total = 0;
    for (const n of this.playlist.nodes()) total += n.value.duration;
    return total;
  }

  // ---------------------- Playback ----------------------

  play(): void {
    if (!this.current) return;
    this.ensureLoaded();
    this.isPlaying = true;
    this.requestPlay();
    this.onChange();
  }

  pause(): void {
    this.engine.pause();
    if (this.isPlaying) {
      this.isPlaying = false;
      this.onChange();
    }
  }

  toggle(): void {
    if (!this.current) {
      this.onNotice("Agrega una canción para empezar", "info");
      return;
    }
    this.isPlaying ? this.pause() : this.play();
  }

  stop(): void {
    this.engine.pause();
    this.isPlaying = false;
    this.elapsed = 0;
    if (this.loadedId) this.engine.seek(0);
    this.onChange();
  }

  /** Plays a specific node directly. */
  playNode(node: DoublyNode<Song>): void {
    this.current = node;
    this.elapsed = 0;
    this.isPlaying = true;
    this.afterTrackChange();
    this.onChange();
  }

  /** SKIP FORWARD: moves to the next node. Returns false if there is none. */
  next(): boolean {
    if (!this.current) return false;
    const target = this.current.next ?? (this.repeat === "all" ? this.playlist.head : null);
    if (!target) {
      this.onNotice("Ya estás en la última canción", "warn");
      return false;
    }
    this.current = target;
    this.elapsed = 0;
    this.afterTrackChange();
    this.onChange();
    return true;
  }

  /** GO BACK: moves to the previous node. Returns false if there is none. */
  prev(): boolean {
    if (!this.current) return false;
    const target = this.current.prev ?? (this.repeat === "all" ? this.playlist.tail : null);
    if (!target) {
      this.onNotice("Ya estás en la primera canción", "warn");
      return false;
    }
    this.current = target;
    this.elapsed = 0;
    this.afterTrackChange();
    this.onChange();
    return true;
  }

  seek(seconds: number): void {
    if (!this.current || !this.loadedId) return;
    const clamped = Math.min(Math.max(0, seconds), this.current.value.duration || seconds);
    this.engine.seek(clamped);
    this.elapsed = clamped;
    this.onTick();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.audioEngine.setVolume(this.volume);
    this.youtubeEngine.setVolume(this.volume);
  }

  cycleRepeat(): void {
    const order: RepeatMode[] = ["off", "all", "one"];
    this.repeat = order[(order.indexOf(this.repeat) + 1) % order.length];
    this.onChange();
  }

  // ---------------------- Internals ----------------------

  /** Builds the event handlers of an engine; events from an inactive engine are ignored. */
  private eventsFor(getEngine: () => PlaybackEngine): EngineEvents {
    const active = () => getEngine() === this.engine;
    return {
      onTime: (seconds) => {
        if (!active()) return;
        this.elapsed = seconds;
        this.onTick();
      },
      onDuration: (seconds) => {
        if (active()) this.syncDuration(seconds);
      },
      onEnded: () => {
        if (active()) this.handleEnded();
      },
      onError: (message) => {
        if (active()) this.handleError(message);
      },
      onStalled: () => {
        if (!active() || !this.isPlaying) return;
        this.isPlaying = false;
        this.onNotice("YouTube no arrancó solo. Pulsa el botón de play dentro del cuadro de YouTube", "warn");
        this.onChange();
      },
      onPlayState: (playing) => {
        if (!active() || playing === this.isPlaying) return;
        this.isPlaying = playing;
        this.onChange();
      },
    };
  }

  /** Picks the engine that can play a song. */
  private engineFor(song: Song): PlaybackEngine {
    return song.youtubeId ? this.youtubeEngine : this.audioEngine;
  }

  /** Loads the current song into its engine (if it was not loaded already). */
  private ensureLoaded(): void {
    const song = this.current?.value;
    if (!song || this.loadedId === song.id) return;

    const target = this.engineFor(song);
    if (target !== this.engine) {
      this.engine.release(); // silence the previous engine before switching
      this.engine = target;
    }
    this.engine.load(song);
    this.loadedId = song.id;
  }

  /** After changing node: loads the song, restarts it and keeps playing if it was playing. */
  private afterTrackChange(): void {
    this.ensureLoaded();
    this.engine.seek(0);
    if (this.isPlaying) this.requestPlay();
  }

  private requestPlay(): void {
    this.engine.play().catch((err: DOMException) => {
      if (err.name === "AbortError") return; // the song was changed while loading
      this.isPlaying = false;
      this.onNotice("No se pudo reproducir esta canción", "warn");
      this.onChange();
    });
  }

  /** Releases both engines (when no song is loaded anymore). */
  private release(): void {
    this.audioEngine.release();
    this.youtubeEngine.release();
    this.engine = this.audioEngine;
    this.loadedId = null;
  }

  /** The real duration of the file wins over the stored one. */
  private syncDuration(real: number): void {
    const song = this.current?.value;
    if (song && Number.isFinite(real) && Math.abs(song.duration - real) > 1) {
      song.duration = Math.round(real);
      this.onChange();
    }
  }

  private handleEnded(): void {
    if (this.repeat === "one") {
      this.engine.seek(0);
      this.requestPlay();
    } else if (this.current && (this.current.next || this.repeat === "all")) {
      this.next(); // isPlaying is still true, so it keeps playing
    } else {
      this.isPlaying = false;
      this.elapsed = 0;
      this.engine.seek(0);
      this.onNotice("Fin de la lista de reproducción", "info");
      this.onChange();
    }
  }

  private handleError(message: string): void {
    if (!this.loadedId) return; // error caused by releasing the engine
    const title = this.current?.value.title ?? "la canción";
    this.isPlaying = false;
    this.onNotice(message || `No se pudo cargar «${title}»`, "warn");
    this.onChange();
  }
}
