interface Song {
  id: string;
  title: string;
  artist: string;

  duration: number;

  hue: number;

  src: string;

  local?: boolean;

  builtin?: boolean;
}

interface DefaultTrack {
  title: string;
  artist: string;
  url: string;
}

type SongPosition =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "index"; index: number };

type RepeatMode = "off" | "all" | "one";

type NoticeType = "success" | "info" | "warn";
