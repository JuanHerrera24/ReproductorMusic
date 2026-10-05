/**
 * ============================================================
 *  DEFAULT TRACKS
 * ============================================================
 *  These songs appear in the playlist the first time the app is opened
 *  (and when pressing "Restaurar"). Each one needs a direct link to an
 *  .mp3 file (or a relative path inside the project, like audio/song.mp3).
 *
 *  If you change this list, also bump DEFAULTS_VERSION so browsers that
 *  already opened the app receive the new list.
 */
const DEFAULTS_VERSION = 2;

const DEFAULT_TRACKS: DefaultTrack[] = [
  // Files included in the project's audio/ folder
  { title: "Gracias Amor", artist: "Orquesta Matecana", url: "audio/gracias-amor.mp3" },
  { title: "Tuyo", artist: "Romeo Santos", url: "audio/tuyo.mp3" },
  { title: "Junto a Tu Corazón", artist: "Miguel Moly", url: "audio/junto-a-tu-corazon.mp3" },
  { title: "Te voy a olvidar", artist: "Yeison Jiménez", url: "audio/te-voy-a-olvidar.mp3" },
  { title: "GAVILÁN II", artist: "Peso Pluma, Tito Double P", url: "audio/gavilan-ii.mp3" },

  // mp3 links (add them here when you have them):
  // { title: "Song name", artist: "Artist", url: "https://.../song.mp3" },
];
