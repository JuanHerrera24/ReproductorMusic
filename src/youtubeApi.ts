/**
 * ============================================================
 *  YOUTUBE DATA API (search, details, playlists)
 * ============================================================
 *  Searching needs a free API key created in Google Cloud. The key is
 *  typed by the user in the page and kept only in this browser.
 *  Pasting a single video link works without a key (via oEmbed).
 */

interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  /** Duration in seconds (0 if unknown). */
  duration: number;
}

class YouTubeApi {
  private static readonly KEY_STORAGE = "taller-listas-dobles:yt-key";

  /** The key typed by the user wins over the shared one from config.ts. */
  get key(): string {
    try {
      return localStorage.getItem(YouTubeApi.KEY_STORAGE) || DEFAULT_YOUTUBE_API_KEY;
    } catch {
      return DEFAULT_YOUTUBE_API_KEY;
    }
  }

  setKey(key: string): void {
    try {
      if (key) localStorage.setItem(YouTubeApi.KEY_STORAGE, key);
      else localStorage.removeItem(YouTubeApi.KEY_STORAGE);
    } catch { /* storage unavailable */ }
  }

  hasKey(): boolean {
    return this.key.length > 0;
  }

  // ---------------------- Parsing ----------------------

  /** Extracts a video id from a YouTube link (or a bare 11-character id). */
  static parseVideoId(input: string): string | null {
    const text = input.trim();
    if (/^[\w-]{11}$/.test(text)) return text;
    try {
      const url = new URL(text);
      const host = url.hostname.replace(/^(www|m|music)\./, "");
      if (host === "youtu.be") {
        const id = url.pathname.slice(1).split("/")[0];
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (host === "youtube.com") {
        const v = url.searchParams.get("v");
        if (v && /^[\w-]{11}$/.test(v)) return v;
        const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
        if (match) return match[1];
      }
    } catch { /* not a URL */ }
    return null;
  }

  /** Extracts a playlist id from a YouTube link. */
  static parsePlaylistId(input: string): string | null {
    try {
      const url = new URL(input.trim());
      if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null;
      return url.searchParams.get("list");
    } catch {
      return null;
    }
  }

  /** Converts an ISO 8601 duration ("PT3M45S") to seconds. */
  static parseDuration(iso: string): number {
    const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return 0;
    return (parseInt(m[1] ?? "0", 10) * 3600) + (parseInt(m[2] ?? "0", 10) * 60) + parseInt(m[3] ?? "0", 10);
  }

  // ---------------------- Requests ----------------------

  /** Searches videos by text. Only embeddable videos are returned. */
  async search(query: string): Promise<YouTubeVideo[]> {
    const data = await this.request<{ items: { id: { videoId: string } }[] }>("search", {
      part: "snippet",
      type: "video",
      videoEmbeddable: "true",
      maxResults: "10",
      q: query,
    });
    const ids = data.items.map((i) => i.id.videoId).filter(Boolean);
    return ids.length ? this.videos(ids) : [];
  }

  /** Gets title, channel and duration for up to 50 video ids (embeddable ones only). */
  async videos(ids: string[]): Promise<YouTubeVideo[]> {
    const result: YouTubeVideo[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const data = await this.request<{
        items: {
          id: string;
          snippet: { title: string; channelTitle: string };
          contentDetails: { duration: string };
          status?: { embeddable?: boolean };
        }[];
      }>("videos", { part: "snippet,contentDetails,status", id: chunk.join(",") });

      // videos.list does not keep the requested order: restore it
      const byId = new Map(data.items.map((item) => [item.id, item]));
      for (const id of chunk) {
        const item = byId.get(id);
        if (!item || item.status?.embeddable === false) continue;
        result.push({
          id,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          duration: YouTubeApi.parseDuration(item.contentDetails.duration),
        });
      }
    }
    return result;
  }

  /** Lists the videos of a playlist (up to `max`). */
  async playlist(playlistId: string, max = 100): Promise<YouTubeVideo[]> {
    const ids: string[] = [];
    let pageToken = "";
    while (ids.length < max) {
      const params: Record<string, string> = { part: "contentDetails", playlistId, maxResults: "50" };
      if (pageToken) params.pageToken = pageToken;
      const data = await this.request<{ items: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>(
        "playlistItems",
        params
      );
      data.items.forEach((i) => ids.push(i.contentDetails.videoId));
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    return this.videos(ids.slice(0, max));
  }

  /**
   * Resolves a single video id into title/channel/duration.
   * With an API key it uses videos.list; without one it falls back to oEmbed.
   */
  async resolveVideo(id: string): Promise<YouTubeVideo> {
    if (this.hasKey()) {
      const [video] = await this.videos([id]);
      if (video) return video;
      throw new Error("Ese video no existe o no se puede reproducir fuera de YouTube");
    }
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${id}`;
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
      if (response.ok) {
        const data = await response.json();
        return { id, title: String(data.title), channel: String(data.author_name ?? "YouTube"), duration: 0 };
      }
    } catch { /* blocked or offline: use the fallback below */ }
    return { id, title: `Video de YouTube (${id})`, channel: "YouTube", duration: 0 };
  }

  private async request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    if (!this.hasKey()) throw new Error("Falta la API key de YouTube");
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.entries({ ...params, key: this.key }).forEach(([k, v]) => url.searchParams.set(k, v));

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch {
      throw new Error("No hay conexión con YouTube");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(YouTubeApi.friendlyError(data?.error?.errors?.[0]?.reason, data?.error?.message));
    return data as T;
  }

  private static friendlyError(reason?: string, message?: string): string {
    switch (reason) {
      case "quotaExceeded": return "Se agotó la cuota diaria de YouTube. Inténtalo mañana";
      case "keyInvalid": return "La API key no es válida";
      case "accessNotConfigured": return "Activa «YouTube Data API v3» en tu proyecto de Google Cloud";
      case "playlistNotFound": return "No se encontró esa playlist (¿es privada?)";
      default: return message ?? "YouTube devolvió un error";
    }
  }
}
