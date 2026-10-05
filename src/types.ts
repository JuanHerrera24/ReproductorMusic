/**
 * Types shared across the application.
 */

/** Model of a song stored in the doubly linked list. */
interface Song {
  id: string;
  title: string;
  artist: string;
  /** Duration in seconds. */
  duration: number;
  /** Hue (0-360) used to generate the song's cover art. */
  hue: number;
  /** Audio address: http(s) link, relative path or temporary blob: URL of a local file. */
  src: string;
  /** YouTube video id. When present the song plays through the YouTube embedded player. */
  youtubeId?: string;
  /** true if the audio is a file from the user's PC (stored in IndexedDB). */
  local?: boolean;
  /** true if it comes from the default list (DEFAULT_TRACKS). */
  builtin?: boolean;
}

/** Song loaded by default (only title, artist and link). */
interface DefaultTrack {
  title: string;
  artist: string;
  url: string;
}

/** Position where a song should be inserted. */
type SongPosition =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "index"; index: number }; // zero-based index

/** Repeat modes of the player. */
type RepeatMode = "off" | "all" | "one";

/** Kinds of notice (toast) shown by the interface. */
type NoticeType = "success" | "info" | "warn";
