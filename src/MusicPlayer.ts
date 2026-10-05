class MusicPlayer {
  readonly playlist = new DoublyLinkedList<Song>();
  current: DoublyNode<Song> | null = null;
  isPlaying = false;
  elapsed = 0;
  repeat: RepeatMode = "off";
  volume = 0.8;

  onChange: () => void = () => {};

  onTick: () => void = () => {};

  onNotice: (message: string, type: NoticeType) => void = () => {};

  private readonly audio = new Audio();

  private loadedId: string | null = null;

  constructor() {
    this.audio.preload = "metadata";
    this.audio.volume = this.volume;

    this.audio.addEventListener("timeupdate", () => {
      this.elapsed = this.audio.currentTime;
      this.onTick();
    });
    this.audio.addEventListener("loadedmetadata", () => this.syncDuration());
    this.audio.addEventListener("ended", () => this.handleEnded());
    this.audio.addEventListener("error", () => this.handleError());
  }

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

  remove(node: DoublyNode<Song>): void {
    const wasCurrent = node === this.current;
    const fallback = node.next ?? node.prev;
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

  play(): void {
    if (!this.current) return;
    this.ensureLoaded();
    this.isPlaying = true;
    this.requestPlay();
    this.onChange();
  }

  pause(): void {
    this.audio.pause();
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
    this.audio.pause();
    this.isPlaying = false;
    this.elapsed = 0;
    if (this.loadedId) this.audio.currentTime = 0;
    this.onChange();
  }

  playNode(node: DoublyNode<Song>): void {
    this.current = node;
    this.elapsed = 0;
    this.isPlaying = true;
    this.afterTrackChange();
    this.onChange();
  }

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
    const max = Number.isFinite(this.audio.duration) ? this.audio.duration : this.current.value.duration;
    this.audio.currentTime = Math.min(Math.max(0, seconds), max);
    this.elapsed = this.audio.currentTime;
    this.onTick();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.audio.volume = this.volume;
  }

  cycleRepeat(): void {
    const order: RepeatMode[] = ["off", "all", "one"];
    this.repeat = order[(order.indexOf(this.repeat) + 1) % order.length];
    this.onChange();
  }

  private ensureLoaded(): void {
    const song = this.current?.value;
    if (!song) return;
    if (this.loadedId !== song.id) {
      this.audio.src = song.src;
      this.loadedId = song.id;
    }
  }

  private afterTrackChange(): void {
    this.ensureLoaded();
    this.audio.currentTime = 0;
    if (this.isPlaying) this.requestPlay();
  }

  private requestPlay(): void {
    this.audio.play().catch((err: DOMException) => {
      if (err.name === "AbortError") return;
      this.isPlaying = false;
      this.onNotice("No se pudo reproducir esta canción", "warn");
      this.onChange();
    });
  }

  private release(): void {
    this.audio.pause();
    this.loadedId = null;
    this.audio.removeAttribute("src");
    this.audio.load();
  }

  private syncDuration(): void {
    const song = this.current?.value;
    const real = this.audio.duration;
    if (song && Number.isFinite(real) && Math.abs(song.duration - real) > 1) {
      song.duration = Math.round(real);
      this.onChange();
    }
  }

  private handleEnded(): void {
    if (this.repeat === "one") {
      this.audio.currentTime = 0;
      this.requestPlay();
    } else if (this.current && (this.current.next || this.repeat === "all")) {
      this.next();
    } else {
      this.isPlaying = false;
      this.elapsed = 0;
      this.audio.currentTime = 0;
      this.onNotice("Fin de la lista de reproducción", "info");
      this.onChange();
    }
  }

  private handleError(): void {
    if (!this.loadedId) return;
    const title = this.current?.value.title ?? "la canción";
    this.isPlaying = false;
    this.onNotice(`No se pudo cargar «${title}»`, "warn");
    this.onChange();
  }
}
