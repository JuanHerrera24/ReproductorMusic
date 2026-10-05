# 🎵 Taller Listas Dobles — Reproductor de Música (TypeScript)

Aplicación web que simula una lista de reproducción usando una **lista doblemente enlazada** implementada desde cero.

## Cómo ejecutarla
1. Abre `index.html` en el navegador (el JavaScript ya está compilado en `dist/`).
2. Para modificar el código: `npm install` y luego `npm run build` (o `npm run watch`).

## Requisitos del taller
| Requisito | Dónde está |
|---|---|
| Frontend interactivo | `index.html`, `styles.css`, `src/App.ts` |
| Agregar al inicio / final / cualquier posición | `addFirst`, `addLast`, `addAt` en `src/DoublyLinkedList.ts` |
| Eliminar canción | `removeNode` / `MusicPlayer.remove` |
| Adelantar canción | `MusicPlayer.next()` → `current.next` |
| Retroceder canción | `MusicPlayer.prev()` → `current.prev` |
| Otras funcionalidades | play/pausa, barra de progreso, repetir (off/all/one), subir/bajar, buscar, vaciar, persistencia (localStorage), atajos de teclado, visualización de los nodos |

## Estructura
```
src/types.ts            Tipos (Song, SongPosition, RepeatMode)
src/utils.ts            Formato de tiempo, nombre de archivo, duración de audio
src/storage.ts          Guardado de archivos locales (IndexedDB)
src/defaultTracks.ts    Canciones por defecto
src/DoublyLinkedList.ts Nodo + lista doble genérica
src/MusicPlayer.ts      Lógica del reproductor (sin DOM)
src/App.ts              Interfaz
src/main.ts             Punto de entrada
```

## Complejidad
- `addFirst`, `addLast`, `removeNode`, `next`, `prev`: **O(1)**
- `addAt`, `removeAt`, `getNodeAt`: **O(n)** (recorre desde el extremo más cercano)

## Música
- **Desde tu PC:** botón "Elegir archivos de audio" o arrastrar y soltar (sin límite de canciones). Se guardan en IndexedDB y siguen en la lista al recargar.
- **Por enlace:** formulario "Agregar por enlace" (enlace directo a un .mp3).
- **Por defecto:** las canciones de `src/defaultTracks.ts` (los mp3 están en `audio/`). Para agregar más enlaces, añádelos a `DEFAULT_TRACKS`, sube `DEFAULTS_VERSION` y ejecuta `npm run build`.
- El audio es real (`HTMLAudioElement`). Los títulos de archivos locales salen del nombre del archivo y se pueden corregir con el botón de lápiz.
