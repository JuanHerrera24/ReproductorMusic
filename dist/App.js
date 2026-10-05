"use strict";
const ICONS = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.5"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 5a1 1 0 0 1 2 0v14a1 1 0 0 1-2 0V5zm13 .14v13.72a1 1 0 0 1-1.52.86l-9.5-5.86a1 1 0 0 1 0-1.72l9.5-5.86A1 1 0 0 1 19 5.14z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 5a1 1 0 0 1 2 0v14a1 1 0 0 1-2 0V5zM5 5.14v13.72a1 1 0 0 0 1.52.86l9.5-5.86a1 1 0 0 0 0-1.72l-9.5-5.86A1 1 0 0 0 5 5.14z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
};
const STORAGE_KEY = "taller-listas-dobles:playlist";
const VOLUME_KEY = "taller-listas-dobles:volume";
class App {
    constructor() {
        this.player = new MusicPlayer();
        this.files = new FileStore();
        this.query = "";
        this.editingId = null;
        this.warnedPersist = false;
    }
    async init() {
        this.player.onChange = () => {
            this.render();
            this.save();
        };
        this.player.onTick = () => this.updateProgress();
        this.player.onNotice = (msg, type) => this.toast(msg, type);
        try {
            const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? "");
            if (!isNaN(v))
                this.player.setVolume(v);
        }
        catch { }
        this.bindEvents();
        const saved = this.readSaved();
        const songs = saved ? await this.hydrate(saved.songs, saved.defaultsVersion) : this.defaultSongs();
        this.player.load(songs, saved?.currentId);
        this.fillDurations();
    }
    defaultSongs() {
        return DEFAULT_TRACKS.map((t) => ({
            id: uid(),
            title: t.title,
            artist: t.artist,
            duration: 0,
            hue: hueFrom(t.title),
            src: t.url,
            builtin: true,
        }));
    }
    fillDurations() {
        for (const node of this.player.playlist.nodes()) {
            const song = node.value;
            if (song.duration > 0)
                continue;
            readDuration(song.src).then((d) => {
                if (d > 0 && song.duration === 0) {
                    song.duration = d;
                    this.player.onChange();
                }
            });
        }
    }
    bindEvents() {
        document.addEventListener("click", (e) => {
            const target = e.target.closest("[data-action]");
            if (!target)
                return;
            const node = this.player.findById(target.dataset.id);
            switch (target.dataset.action) {
                case "toggle":
                    this.player.toggle();
                    break;
                case "next":
                    this.player.next();
                    break;
                case "prev":
                    this.player.prev();
                    break;
                case "stop":
                    this.player.stop();
                    break;
                case "repeat":
                    this.player.cycleRepeat();
                    break;
                case "play-node":
                    if (node)
                        this.player.playNode(node);
                    break;
                case "up":
                    if (node)
                        this.player.shift(node, -1);
                    break;
                case "down":
                    if (node)
                        this.player.shift(node, 1);
                    break;
                case "edit":
                    if (node)
                        this.openEdit(node);
                    break;
                case "remove":
                    if (node) {
                        const song = node.value;
                        this.player.remove(node);
                        this.releaseSong(song);
                        this.toast(`“${song.title}” eliminada de la lista`, "info");
                    }
                    break;
                case "clear":
                    if (this.player.playlist.size && confirm("¿Vaciar toda la lista de reproducción?")) {
                        this.clearAll();
                        this.player.clear();
                        this.toast("Lista vaciada", "info");
                    }
                    break;
                case "restore":
                    if (confirm("¿Restaurar la lista por defecto? Se quitarán las canciones que agregaste.")) {
                        this.clearAll();
                        this.player.load(this.defaultSongs());
                        this.fillDurations();
                        this.toast("Lista por defecto restaurada", "success");
                    }
                    break;
                case "pick-files":
                    document.querySelector("#file-input").click();
                    break;
            }
        });
        document.addEventListener("click", (e) => {
            const bar = e.target.closest("#progress");
            if (!bar || !this.player.current)
                return;
            const rect = bar.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            this.player.seek(ratio * this.player.current.value.duration);
        });
        document.addEventListener("input", (e) => {
            const el = e.target;
            if (el.id !== "volume")
                return;
            this.player.setVolume(parseFloat(el.value));
            try {
                localStorage.setItem(VOLUME_KEY, String(this.player.volume));
            }
            catch { }
        });
        document.querySelector("#search").addEventListener("input", (e) => {
            this.query = e.target.value.trim().toLowerCase();
            this.renderPlaylist();
        });
        const fileInput = document.querySelector("#file-input");
        fileInput.addEventListener("change", () => {
            if (fileInput.files?.length)
                void this.addFiles(Array.from(fileInput.files));
            fileInput.value = "";
        });
        let dragDepth = 0;
        const hasFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
        window.addEventListener("dragenter", (e) => {
            if (!hasFiles(e))
                return;
            dragDepth++;
            document.body.classList.add("dragging");
        });
        window.addEventListener("dragleave", (e) => {
            if (!hasFiles(e))
                return;
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0)
                document.body.classList.remove("dragging");
        });
        window.addEventListener("dragover", (e) => {
            if (hasFiles(e))
                e.preventDefault();
        });
        window.addEventListener("drop", (e) => {
            if (!hasFiles(e))
                return;
            e.preventDefault();
            dragDepth = 0;
            document.body.classList.remove("dragging");
            if (e.dataTransfer?.files.length)
                void this.addFiles(Array.from(e.dataTransfer.files));
        });
        const form = document.querySelector("#add-form");
        const posSelect = form.querySelector("#f-position");
        const posField = form.querySelector("#f-index-field");
        posSelect.addEventListener("change", () => {
            posField.hidden = posSelect.value !== "index";
        });
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            void this.handleAddLink(form);
        });
        const dialog = document.querySelector("#edit-dialog");
        dialog.querySelector("form").addEventListener("submit", (e) => {
            e.preventDefault();
            this.saveEdit(dialog);
        });
        dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
        document.addEventListener("keydown", (e) => {
            if (document.querySelector("dialog[open]"))
                return;
            const tag = e.target.tagName;
            if (["INPUT", "SELECT", "TEXTAREA"].includes(tag))
                return;
            if (e.code === "Space") {
                e.preventDefault();
                this.player.toggle();
            }
            else if (e.code === "ArrowRight")
                this.player.next();
            else if (e.code === "ArrowLeft")
                this.player.prev();
        });
    }
    async addFiles(files) {
        const isAudio = (f) => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|oga|flac|aac|opus|weba)$/i.test(f.name);
        const audioFiles = files.filter(isAudio);
        const ignored = files.length - audioFiles.length;
        if (ignored > 0)
            this.toast(`${ignored} archivo(s) ignorado(s): no son audio`, "warn");
        if (!audioFiles.length)
            return;
        const atStart = document.querySelector("#files-position").value === "start";
        if (audioFiles.length > 1)
            this.toast(`Cargando ${audioFiles.length} canciones…`, "info");
        let added = 0;
        for (const file of audioFiles) {
            const src = URL.createObjectURL(file);
            const duration = await readDuration(src);
            if (duration <= 0) {
                URL.revokeObjectURL(src);
                this.toast(`No se pudo leer «${file.name}»`, "warn");
                continue;
            }
            const { title, artist } = parseFileName(file.name);
            const song = { id: uid(), title, artist, duration, hue: hueFrom(title), src, local: true };
            const saved = await this.files.put(song.id, file);
            if (!saved && !this.warnedPersist) {
                this.warnedPersist = true;
                this.toast("Tu navegador no permitió guardar los archivos: la música local durará solo esta sesión", "warn");
            }
            this.player.add(song, atStart ? { kind: "index", index: added } : { kind: "end" });
            added++;
        }
        if (added)
            this.toast(`${added} canción(es) agregada(s) ${atStart ? "al inicio" : "al final"}`, "success");
    }
    async handleAddLink(form) {
        const val = (id) => form.querySelector(id).value.trim();
        const title = val("#f-title");
        const artist = val("#f-artist") || "Artista desconocido";
        const url = val("#f-url");
        const kind = val("#f-position");
        if (!title)
            return this.toast("Escribe el título de la canción", "warn");
        try {
            const parsed = new URL(url);
            if (!/^https?:$/.test(parsed.protocol))
                throw new Error("protocolo");
        }
        catch {
            return this.toast("El enlace debe empezar por http:// o https://", "warn");
        }
        let position;
        let where;
        if (kind === "start") {
            position = { kind: "start" };
            where = "al inicio";
        }
        else if (kind === "end") {
            position = { kind: "end" };
            where = "al final";
        }
        else {
            const n = parseInt(val("#f-index"), 10);
            const max = this.player.playlist.size + 1;
            if (isNaN(n) || n < 1 || n > max) {
                return this.toast(`La posición debe estar entre 1 y ${max}`, "warn");
            }
            position = { kind: "index", index: n - 1 };
            where = `en la posición ${n}`;
        }
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        button.textContent = "Verificando enlace…";
        const duration = await readDuration(url);
        button.disabled = false;
        button.textContent = "+ Agregar a la lista";
        if (duration <= 0) {
            return this.toast("No se pudo cargar ese enlace. Verifica que apunte directo a un archivo de audio", "warn");
        }
        if (position.kind === "index")
            position = { kind: "index", index: Math.min(position.index, this.player.playlist.size) };
        this.player.add({ id: uid(), title, artist, duration, hue: hueFrom(title), src: url }, position);
        this.toast(`“${title}” agregada ${where}`, "success");
        form.querySelector("#f-title").value = "";
        form.querySelector("#f-artist").value = "";
        form.querySelector("#f-url").value = "";
        form.querySelector("#f-title").focus();
    }
    openEdit(node) {
        const dialog = document.querySelector("#edit-dialog");
        this.editingId = node.value.id;
        dialog.querySelector("#e-title").value = node.value.title;
        dialog.querySelector("#e-artist").value = node.value.artist;
        dialog.showModal();
    }
    saveEdit(dialog) {
        const node = this.player.findById(this.editingId ?? undefined);
        const title = dialog.querySelector("#e-title").value.trim();
        const artist = dialog.querySelector("#e-artist").value.trim();
        if (node && title) {
            node.value.title = title;
            node.value.artist = artist || "Artista desconocido";
            this.player.onChange();
            this.toast("Canción actualizada", "success");
        }
        dialog.close();
    }
    releaseSong(song) {
        if (!song.local)
            return;
        URL.revokeObjectURL(song.src);
        void this.files.delete(song.id);
    }
    clearAll() {
        for (const node of this.player.playlist.nodes()) {
            if (node.value.local)
                URL.revokeObjectURL(node.value.src);
        }
        void this.files.clear();
    }
    render() {
        this.renderStats();
        this.renderPlayer();
        this.renderPlaylist();
        this.renderChain();
        this.renderFormHints();
    }
    renderStats() {
        const p = this.player;
        this.setText("#stat-count", String(p.playlist.size));
        this.setText("#stat-duration", formatTotal(p.totalDuration()));
    }
    renderFormHints() {
        const max = this.player.playlist.size + 1;
        const idx = document.querySelector("#f-index");
        idx.max = String(max);
        idx.placeholder = `1 – ${max}`;
    }
    cover(hue) {
        return `--h:${hue}`;
    }
    renderPlayer() {
        const p = this.player;
        const host = document.querySelector("#player");
        const song = p.current?.value;
        const repeatLabel = { off: "Repetir: no", all: "Repetir: toda la lista", one: "Repetir: una canción" }[p.repeat];
        const hasPrev = !!p.current && (!!p.current.prev || p.repeat === "all");
        const hasNext = !!p.current && (!!p.current.next || p.repeat === "all");
        host.innerHTML = `
      <div class="np-label"><span class="live-dot ${p.isPlaying ? "on" : ""}"></span>${p.isPlaying ? "Reproduciendo" : "En pausa"}</div>
      <div class="vinyl-wrap ${p.isPlaying ? "spinning" : ""}" style="${song ? this.cover(song.hue) : "--h:260"}">
        <div class="vinyl ${song ? "" : "empty"}">
          <div class="vinyl-label">${ICONS.note}</div>
        </div>
      </div>
      <h2 class="np-title">${song ? escapeHtml(song.title) : "Tu lista está vacía"}</h2>
      <p class="np-artist">${song ? escapeHtml(song.artist) : "Agrega una canción para comenzar"}</p>

      <div class="progress" id="progress" title="Haz clic para saltar">
        <div class="progress-fill" id="progress-fill"></div>
        <div class="progress-knob" id="progress-knob"></div>
      </div>
      <div class="times"><span id="t-elapsed">0:00</span><span id="t-total">${song ? formatDuration(song.duration) : "0:00"}</span></div>

      <div class="controls">
        <button class="ctl small ${p.repeat !== "off" ? "active" : ""}" data-action="repeat" title="${repeatLabel}" aria-label="${repeatLabel}">
          ${ICONS.repeat}${p.repeat === "one" ? '<i class="badge">1</i>' : ""}
        </button>
        <button class="ctl" data-action="prev" title="Retroceder (←)" aria-label="Retroceder" ${hasPrev ? "" : "disabled"}>${ICONS.prev}</button>
        <button class="ctl main" data-action="toggle" title="Reproducir / Pausar (Espacio)" aria-label="Reproducir o pausar" ${song ? "" : "disabled"}>${p.isPlaying ? ICONS.pause : ICONS.play}</button>
        <button class="ctl" data-action="next" title="Adelantar (→)" aria-label="Adelantar" ${hasNext ? "" : "disabled"}>${ICONS.next}</button>
        <button class="ctl small" data-action="stop" title="Detener" aria-label="Detener" ${song ? "" : "disabled"}>${ICONS.stop}</button>
      </div>
      <label class="volume" title="Volumen">
        ${ICONS.volume}
        <input id="volume" type="range" min="0" max="1" step="0.01" value="${p.volume}" aria-label="Volumen" />
      </label>
      <p class="hint-keys"><kbd>Espacio</kbd> play/pausa · <kbd>←</kbd> retroceder · <kbd>→</kbd> adelantar</p>
    `;
        this.updateProgress();
    }
    updateProgress() {
        const p = this.player;
        const total = p.current?.value.duration ?? 0;
        const ratio = total ? Math.min(1, p.elapsed / total) * 100 : 0;
        const fill = document.querySelector("#progress-fill");
        const knob = document.querySelector("#progress-knob");
        if (fill)
            fill.style.width = `${ratio}%`;
        if (knob)
            knob.style.left = `${ratio}%`;
        this.setText("#t-elapsed", formatTime(p.elapsed));
    }
    renderPlaylist() {
        const p = this.player;
        const host = document.querySelector("#playlist");
        if (p.playlist.isEmpty()) {
            host.innerHTML = `
        <li class="empty-state">
          <div class="empty-icon">${ICONS.note}</div>
          <strong>No hay canciones todavía</strong>
          <span>Agrega música desde tu PC o por enlace.</span>
          <button class="btn ghost" data-action="pick-files">Elegir archivos de mi PC</button>
        </li>`;
            return;
        }
        const items = [];
        let index = 0;
        for (const node of p.playlist.nodes()) {
            const s = node.value;
            const matches = !this.query || `${s.title} ${s.artist}`.toLowerCase().includes(this.query);
            if (matches) {
                const isCurrent = node === p.current;
                const isFirst = index === 0;
                const isLast = index === p.playlist.size - 1;
                const idxCell = isCurrent && p.isPlaying
                    ? '<span class="eq"><i></i><i></i><i></i></span>'
                    : String(index + 1);
                items.push(`
          <li class="song ${isCurrent ? "current" : ""}">
            <button class="song-main" data-action="play-node" data-id="${s.id}" title="Reproducir">
              <span class="song-idx">${idxCell}</span>
              <span class="mini-cover" style="${this.cover(s.hue)}"></span>
              <span class="song-info"><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.artist)}${s.local ? " · en tu PC" : ""}</small></span>
              <span class="song-dur">${formatDuration(s.duration)}</span>
            </button>
            <div class="song-actions">
              <button class="icon-btn" data-action="edit" data-id="${s.id}" title="Editar título y artista" aria-label="Editar">${ICONS.edit}</button>
              <button class="icon-btn" data-action="up" data-id="${s.id}" title="Subir" aria-label="Subir" ${isFirst ? "disabled" : ""}>${ICONS.up}</button>
              <button class="icon-btn" data-action="down" data-id="${s.id}" title="Bajar" aria-label="Bajar" ${isLast ? "disabled" : ""}>${ICONS.down}</button>
              <button class="icon-btn danger" data-action="remove" data-id="${s.id}" title="Eliminar" aria-label="Eliminar">${ICONS.trash}</button>
            </div>
          </li>`);
            }
            index++;
        }
        host.innerHTML = items.length
            ? items.join("")
            : `<li class="empty-state"><strong>Sin resultados</strong><span>Ninguna canción coincide con tu búsqueda.</span></li>`;
    }
    renderChain() {
        const p = this.player;
        const host = document.querySelector("#chain");
        const arrow = '<span class="link" aria-hidden="true"><svg viewBox="0 0 40 16"><path d="M2 5h34m0 0l-5-4m5 4l-5 4M38 11H4m0 0l5-4m-5 4l5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
        if (p.playlist.isEmpty()) {
            host.innerHTML = `<span class="null-box">NULL</span>${arrow}<span class="null-box">NULL</span>`;
            return;
        }
        const parts = ['<span class="null-box">NULL</span>', arrow];
        let i = 0;
        for (const node of p.playlist.nodes()) {
            const tags = [
                node === p.playlist.head ? '<em class="tag head">HEAD</em>' : "",
                node === p.playlist.tail ? '<em class="tag tail">TAIL</em>' : "",
                node === p.current ? '<em class="tag now">ACTUAL</em>' : "",
            ].join("");
            parts.push(`
        <button class="node ${node === p.current ? "current" : ""}" data-action="play-node" data-id="${node.value.id}" title="${escapeHtml(node.value.title)}">
          <span class="node-tags">${tags}</span>
          <span class="node-body">
            <span class="ptr">${node.prev ? "prev" : "∅"}</span>
            <span class="data"><b>${escapeHtml(node.value.title)}</b><small>posición ${i}</small></span>
            <span class="ptr">${node.next ? "next" : "∅"}</span>
          </span>
        </button>`);
            parts.push(arrow);
            i++;
        }
        parts.push('<span class="null-box">NULL</span>');
        host.innerHTML = parts.join("");
    }
    save() {
        try {
            const songs = this.player.playlist.toArray().map((s) => (s.local ? { ...s, src: "" } : s));
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ songs, currentId: this.player.current?.value.id, defaultsVersion: DEFAULTS_VERSION }));
        }
        catch { }
    }
    readSaved() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw)
                return null;
            const data = JSON.parse(raw);
            return Array.isArray(data.songs) ? data : null;
        }
        catch {
            return null;
        }
    }
    async hydrate(saved, version) {
        const result = [];
        for (const song of saved) {
            if (song.local) {
                const blob = await this.files.get(song.id);
                if (blob)
                    result.push({ ...song, src: URL.createObjectURL(blob) });
            }
            else if (song.src) {
                result.push(song);
            }
        }
        if (version === DEFAULTS_VERSION)
            return result;
        return [...this.defaultSongs(), ...result.filter((s) => !s.builtin)];
    }
    setText(selector, text) {
        const el = document.querySelector(selector);
        if (el)
            el.textContent = text;
    }
    toast(message, type = "info") {
        const host = document.querySelector("#toasts");
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.textContent = message;
        host.appendChild(el);
        window.setTimeout(() => {
            el.classList.add("out");
            window.setTimeout(() => el.remove(), 300);
        }, 2600);
    }
}
