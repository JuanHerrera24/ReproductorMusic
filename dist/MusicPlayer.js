"use strict";
class MusicPlayer {
    constructor() {
        this.playlist = new DoublyLinkedList();
        this.current = null;
        this.isPlaying = false;
        this.elapsed = 0;
        this.repeat = "off";
        this.volume = 0.8;
        this.onChange = () => { };
        this.onTick = () => { };
        this.onNotice = () => { };
        this.audio = new Audio();
        this.loadedId = null;
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
    load(songs, currentId) {
        this.release();
        this.isPlaying = false;
        this.elapsed = 0;
        this.playlist.clear();
        songs.forEach((s) => this.playlist.addLast(s));
        this.current = this.findById(currentId) ?? this.playlist.head;
        this.ensureLoaded();
        this.onChange();
    }
    add(song, position) {
        let node;
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
    remove(node) {
        const wasCurrent = node === this.current;
        const fallback = node.next ?? node.prev;
        this.playlist.removeNode(node);
        if (wasCurrent) {
            this.current = fallback;
            this.elapsed = 0;
            if (this.current) {
                this.afterTrackChange();
            }
            else {
                this.isPlaying = false;
                this.release();
            }
        }
        this.onChange();
    }
    shift(node, direction) {
        const index = this.playlist.indexOf(node);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= this.playlist.size)
            return;
        this.playlist.move(node, target);
        this.onChange();
    }
    clear() {
        this.isPlaying = false;
        this.release();
        this.playlist.clear();
        this.current = null;
        this.elapsed = 0;
        this.onChange();
    }
    findById(id) {
        if (!id)
            return null;
        for (const n of this.playlist.nodes())
            if (n.value.id === id)
                return n;
        return null;
    }
    totalDuration() {
        let total = 0;
        for (const n of this.playlist.nodes())
            total += n.value.duration;
        return total;
    }
    play() {
        if (!this.current)
            return;
        this.ensureLoaded();
        this.isPlaying = true;
        this.requestPlay();
        this.onChange();
    }
    pause() {
        this.audio.pause();
        if (this.isPlaying) {
            this.isPlaying = false;
            this.onChange();
        }
    }
    toggle() {
        if (!this.current) {
            this.onNotice("Agrega una canción para empezar", "info");
            return;
        }
        this.isPlaying ? this.pause() : this.play();
    }
    stop() {
        this.audio.pause();
        this.isPlaying = false;
        this.elapsed = 0;
        if (this.loadedId)
            this.audio.currentTime = 0;
        this.onChange();
    }
    playNode(node) {
        this.current = node;
        this.elapsed = 0;
        this.isPlaying = true;
        this.afterTrackChange();
        this.onChange();
    }
    next() {
        if (!this.current)
            return false;
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
    prev() {
        if (!this.current)
            return false;
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
    seek(seconds) {
        if (!this.current || !this.loadedId)
            return;
        const max = Number.isFinite(this.audio.duration) ? this.audio.duration : this.current.value.duration;
        this.audio.currentTime = Math.min(Math.max(0, seconds), max);
        this.elapsed = this.audio.currentTime;
        this.onTick();
    }
    setVolume(volume) {
        this.volume = Math.min(1, Math.max(0, volume));
        this.audio.volume = this.volume;
    }
    cycleRepeat() {
        const order = ["off", "all", "one"];
        this.repeat = order[(order.indexOf(this.repeat) + 1) % order.length];
        this.onChange();
    }
    ensureLoaded() {
        const song = this.current?.value;
        if (!song)
            return;
        if (this.loadedId !== song.id) {
            this.audio.src = song.src;
            this.loadedId = song.id;
        }
    }
    afterTrackChange() {
        this.ensureLoaded();
        this.audio.currentTime = 0;
        if (this.isPlaying)
            this.requestPlay();
    }
    requestPlay() {
        this.audio.play().catch((err) => {
            if (err.name === "AbortError")
                return;
            this.isPlaying = false;
            this.onNotice("No se pudo reproducir esta canción", "warn");
            this.onChange();
        });
    }
    release() {
        this.audio.pause();
        this.loadedId = null;
        this.audio.removeAttribute("src");
        this.audio.load();
    }
    syncDuration() {
        const song = this.current?.value;
        const real = this.audio.duration;
        if (song && Number.isFinite(real) && Math.abs(song.duration - real) > 1) {
            song.duration = Math.round(real);
            this.onChange();
        }
    }
    handleEnded() {
        if (this.repeat === "one") {
            this.audio.currentTime = 0;
            this.requestPlay();
        }
        else if (this.current && (this.current.next || this.repeat === "all")) {
            this.next();
        }
        else {
            this.isPlaying = false;
            this.elapsed = 0;
            this.audio.currentTime = 0;
            this.onNotice("Fin de la lista de reproducción", "info");
            this.onChange();
        }
    }
    handleError() {
        if (!this.loadedId)
            return;
        const title = this.current?.value.title ?? "la canción";
        this.isPlaying = false;
        this.onNotice(`No se pudo cargar «${title}»`, "warn");
        this.onChange();
    }
}
