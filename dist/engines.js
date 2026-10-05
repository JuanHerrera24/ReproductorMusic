"use strict";
/**
 * ============================================================
 *  PLAYBACK ENGINES
 * ============================================================
 *  The MusicPlayer does not care where the sound comes from. It talks to
 *  a PlaybackEngine, and there is one engine per kind of source:
 *    - AudioEngine   → mp3 files / links (HTMLAudioElement)
 *    - YouTubeEngine → YouTube videos (official IFrame player)
 */
class AudioEngine {
    constructor(events) {
        this.events = events;
        this.audio = new Audio();
        this.hasSource = false;
        this.audio.preload = "metadata";
        this.audio.addEventListener("timeupdate", () => this.events.onTime(this.audio.currentTime));
        this.audio.addEventListener("loadedmetadata", () => {
            if (Number.isFinite(this.audio.duration))
                this.events.onDuration(this.audio.duration);
        });
        this.audio.addEventListener("ended", () => this.events.onEnded());
        this.audio.addEventListener("error", () => {
            if (this.hasSource)
                this.events.onError(""); // ignore errors caused by release()
        });
    }
    load(song) {
        this.audio.src = song.src;
        this.hasSource = true;
    }
    play() {
        return this.audio.play();
    }
    pause() {
        this.audio.pause();
    }
    seek(seconds) {
        if (!this.hasSource)
            return;
        const max = Number.isFinite(this.audio.duration) ? this.audio.duration : Infinity;
        this.audio.currentTime = Math.min(Math.max(0, seconds), max);
    }
    setVolume(volume) {
        this.audio.volume = volume;
    }
    release() {
        this.audio.pause();
        this.hasSource = false;
        this.audio.removeAttribute("src");
        this.audio.load();
    }
}
