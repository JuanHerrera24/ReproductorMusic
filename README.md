# Music Player — Doubly Linked List Workshop (TypeScript)

Web app that simulates a music playlist using a **doubly linked list** implemented from scratch.

## How to run
1. Local music only: open `index.html` in the browser (the JavaScript is already compiled into `dist/`).
2. **For YouTube you must serve the folder over http**: `npm start` (runs `npx serve .`) or the VS Code *Live Server* extension, then open `http://localhost:...`.
3. To change the code: `npm install`, then `npm run build` (or `npm run watch`).

## Workshop requirements
| Requirement | Where |
|---|---|
| Interactive frontend | `index.html`, `styles.css`, `src/App.ts` |
| Add at the start / end / any position | `addFirst`, `addLast`, `addAt` in `src/DoublyLinkedList.ts` |
| Remove a song | `removeNode` / `MusicPlayer.remove` |
| Skip forward | `MusicPlayer.next()` → `current.next` |
| Go back | `MusicPlayer.prev()` → `current.prev` |
| Extra features | play/pause, progress bar, volume, repeat (off/all/one), move up/down, edit, search, clear, persistence, keyboard shortcuts, live view of the nodes |

## Structure
```
src/types.ts            Types (Song, SongPosition, RepeatMode)
src/utils.ts            Time formatting, file-name parsing, audio duration
src/storage.ts          Local file storage (IndexedDB)
src/DoublyLinkedList.ts Node + generic doubly linked list
src/engines.ts          PlaybackEngine interface + AudioEngine (mp3)
src/YouTubeEngine.ts    YouTube IFrame player engine
src/config.ts           Shared YouTube API key for the deployed site
src/youtubeApi.ts       YouTube Data API (search, details, playlists)
src/MusicPlayer.ts      Player logic (no DOM)
src/defaultTracks.ts    Default songs
src/App.ts              User interface
src/main.ts             Entry point
audio/                  Default mp3 files
```

## Complexity
- `addFirst`, `addLast`, `removeNode`, `next`, `prev`: **O(1)**
- `addAt`, `removeAt`, `getNodeAt`: **O(n)** (walks from the closest end)

## Music
- **From your PC:** "Elegir archivos de audio" button or drag and drop (no limit). Files are stored in IndexedDB and stay in the list after reloading.
- **By link:** "Agregar por enlace" form (direct link to an .mp3).
- **Defaults:** songs in `src/defaultTracks.ts` (the mp3 files live in `audio/`). To add more links, add them to `DEFAULT_TRACKS`, bump `DEFAULTS_VERSION` and run `npm run build`.
- **YouTube:** search by name (needs a free API key from Google Cloud, typed in the page and kept only in your browser), paste a video link (no key needed) or paste a playlist link (needs the key). YouTube songs are normal nodes of the list; they play through YouTube's official embedded player, which stays visible. Songs whose owner disallows embedding are filtered out of the search.
- Audio is real (`HTMLAudioElement`). Titles of local files come from the file name and can be fixed with the pencil button.

## Deploying (Vercel)
1. Put your API key in `src/config.ts` (`DEFAULT_YOUTUBE_API_KEY`) and run `npm run build`.
2. Push the whole folder to GitHub (including `dist/` and `audio/`).
3. In Vercel: *Add New → Project → import the repo → Deploy* (no build command needed, `vercel.json` already sets it).
4. In Google Cloud, restrict the key to your Vercel domain and to YouTube Data API v3.
