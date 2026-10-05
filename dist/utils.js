"use strict";
function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(s / 60);
    return `${minutes}:${String(s % 60).padStart(2, "0")}`;
}
function formatTotal(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0)
        return `${h} h ${m} min`;
    if (m > 0)
        return `${m} min ${s % 60} s`;
    return `${s} s`;
}
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function hueFrom(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++)
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash % 360;
}
function formatDuration(seconds) {
    return seconds > 0 ? formatTime(seconds) : "–:––";
}
function parseFileName(fileName) {
    const title = fileName
        .replace(/\.[^.]+$/, "")
        .replace(/_/g, " ")
        .replace(/[()[\]]/g, " ")
        .replace(/\b(official\s+(audio|video|music\s+video|lyric\s+video)|audio\s+oficial|video\s+oficial|lyric\s+video|lyrics?|letra|visualizer|audio|video|hd|\d+\s*kbps)\b/gi, " ")
        .replace(/\s+/g, " ")
        .replace(/^[\s-]+|[\s-]+$/g, "")
        .trim();
    return { title: title || fileName, artist: "Archivo local" };
}
function readDuration(src, timeoutMs = 12000) {
    return new Promise((resolve) => {
        const probe = new Audio();
        probe.preload = "metadata";
        let timer = 0;
        const finish = (seconds) => {
            window.clearTimeout(timer);
            probe.removeAttribute("src");
            probe.load();
            resolve(seconds);
        };
        timer = window.setTimeout(() => finish(0), timeoutMs);
        probe.addEventListener("loadedmetadata", () => finish(Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0), { once: true });
        probe.addEventListener("error", () => finish(0), { once: true });
        probe.src = src;
    });
}
