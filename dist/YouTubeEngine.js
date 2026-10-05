"use strict";
/**
 * ============================================================
 *  YOUTUBE ENGINE (official IFrame Player API)
 * ============================================================
 *  YouTube audio cannot be downloaded, so these songs are played with
 *  YouTube's own embedded player, which must stay visible on screen.
 *  The container element (#yt-player) lives outside the re-rendered
 *  player card so the iframe is never destroyed.
 */
class YouTubeEngine {
    constructor(containerId, events) {
        this.containerId = containerId;
        this.events = events;
        this.player = null;
        this.creating = false;
        this.ready = false;
        this.videoId = null;
        /** Video currently loaded inside the iframe. */
        this.loadedVideoId = null;
        this.wantsPlay = false;
        this.volume = 0.8;
        this.lastDuration = 0;
        this.pollTimer = null;
        /** Ignores PAUSED events caused by our own load/cue calls. */
        this.ignorePauseUntil = 0;
        /** true once YouTube reported the PLAYING state for the current request. */
        this.playing = false;
        this.stallTimer = null;
    }
    load(song) {
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
    play() {
        this.wantsPlay = true;
        this.armStallTimer();
        this.ensurePlayer();
        if (this.ready && this.player && this.videoId) {
            if (this.loadedVideoId !== this.videoId) {
                this.player.loadVideoById(this.videoId);
                this.loadedVideoId = this.videoId;
            }
            else {
                this.player.playVideo();
            }
        }
        // If the player is not ready yet, onReady starts the video.
        return Promise.resolve();
    }
    pause() {
        this.wantsPlay = false;
        this.clearStallTimer();
        if (this.ready && this.player)
            this.player.pauseVideo();
    }
    seek(seconds) {
        if (this.ready && this.player && this.loadedVideoId)
            this.player.seekTo(Math.max(0, seconds), true);
    }
    setVolume(volume) {
        this.volume = volume;
        if (this.ready && this.player)
            this.player.setVolume(Math.round(volume * 100));
    }
    release() {
        this.wantsPlay = false;
        this.ignorePauseUntil = Date.now() + 500;
        this.playing = false;
        this.stopPolling();
        this.clearStallTimer();
        if (this.ready && this.player && this.loadedVideoId)
            this.player.stopVideo();
        this.loadedVideoId = null;
        this.videoId = null;
    }
    // ---------------------- Internals ----------------------
    static loadApi() {
        if (!YouTubeEngine.apiPromise) {
            YouTubeEngine.apiPromise = new Promise((resolve, reject) => {
                const w = window;
                if (w.YT && w.YT.Player)
                    return resolve();
                const previous = w.onYouTubeIframeAPIReady;
                w.onYouTubeIframeAPIReady = () => {
                    if (typeof previous === "function")
                        previous();
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
    ensurePlayer() {
        if (this.player || this.creating)
            return;
        this.creating = true;
        YouTubeEngine.loadApi()
            .then(() => this.createPlayer())
            .catch(() => {
            this.creating = false;
            this.events.onError("No se pudo cargar el reproductor de YouTube. Revisa tu conexión a internet");
        });
    }
    createPlayer(attempt = 0) {
        // YouTube blocks autoplay when the player has no size, so wait until the container is visible.
        const box = document.getElementById(this.containerId);
        if (box && box.offsetWidth === 0 && attempt < 30) {
            window.setTimeout(() => this.createPlayer(attempt + 1), 100);
            return;
        }
        const YT = window.YT;
        const origin = location.protocol.startsWith("http") ? location.origin : undefined;
        this.player = new YT.Player(this.containerId, {
            width: "100%",
            height: "100%",
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin },
            events: {
                onReady: () => this.handleReady(),
                onStateChange: (e) => this.handleState(e.data),
                onError: (e) => {
                    console.warn("[YouTube] error code", e.data);
                    this.events.onError(YouTubeEngine.errorMessage(e.data));
                },
            },
        });
        this.creating = false;
    }
    handleReady() {
        console.info("[YouTube] player ready");
        this.ready = true;
        this.player.setVolume(Math.round(this.volume * 100));
        if (!this.videoId)
            return;
        if (this.wantsPlay)
            this.player.loadVideoById(this.videoId);
        else
            this.player.cueVideoById(this.videoId);
        this.loadedVideoId = this.videoId;
        if (this.wantsPlay)
            this.armStallTimer();
    }
    /** If the video does not start soon after play(), tell the player (autoplay probably blocked). */
    armStallTimer() {
        this.clearStallTimer();
        this.stallTimer = window.setTimeout(() => {
            this.stallTimer = null;
            if (this.wantsPlay && !this.playing) {
                console.warn("[YouTube] video did not start (autoplay blocked or player not ready)");
                this.events.onStalled?.();
            }
        }, YouTubeEngine.STALL_MS);
    }
    clearStallTimer() {
        if (this.stallTimer !== null) {
            window.clearTimeout(this.stallTimer);
            this.stallTimer = null;
        }
    }
    handleState(state) {
        console.debug("[YouTube] state", state);
        const S = window.YT.PlayerState;
        this.playing = state === S.PLAYING;
        if (state === S.PLAYING) {
            this.clearStallTimer();
            this.startPolling();
            this.reportDuration();
            this.events.onPlayState(true);
        }
        else if (state === S.PAUSED) {
            this.stopPolling();
            if (Date.now() >= this.ignorePauseUntil)
                this.events.onPlayState(false);
        }
        else if (state === S.ENDED) {
            this.stopPolling();
            this.events.onEnded();
        }
        else if (state === S.CUED) {
            this.reportDuration();
        }
    }
    reportDuration() {
        const d = this.player?.getDuration() ?? 0;
        if (d > 0 && d !== this.lastDuration) {
            this.lastDuration = d;
            this.events.onDuration(d);
        }
    }
    startPolling() {
        if (this.pollTimer !== null)
            return;
        this.pollTimer = window.setInterval(() => {
            if (!this.player)
                return;
            this.events.onTime(this.player.getCurrentTime());
            this.reportDuration();
        }, 500);
    }
    stopPolling() {
        if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    static errorMessage(code) {
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
YouTubeEngine.apiPromise = null;
/** How long we wait for the video to start before warning the user. */
YouTubeEngine.STALL_MS = 5000;
