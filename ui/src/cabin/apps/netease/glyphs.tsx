import type { ReactNode } from 'react'

/**
 * The NetEase Cloud Music app's glyphs: WestPlay's own drawings, in the manner of NetEase Cloud Music's app
 * (round, filled shapes), on a 24-unit grid, in the text's colour.
 */

function Glyph({ size, children, label }: { size: number; children: ReactNode; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {children}
    </svg>
  )
}

type Size = { size?: number }

/**
 * The app's mark: a red disc with a white note in a cloud's curl (drawn here, not NetEase's file): the cloud is
 * the service's, the note the music's.
 *
 * TODO(verify): WestPlay's own icon (public/icons/westplay/netease.dark.svg, netease.light.svg) is a placeholder
 * too, to be replaced with a compliant, drawn mark.
 */
export function MarkGlyph({ size = 30 }: Size) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#e60026" />
      <path
        d="M6.6 14.4a3.2 3.2 0 0 1 1-6.2 4.1 4.1 0 0 1 7.9-.7 3.6 3.6 0 0 1 1.8 6.9h-1.9a1.9 1.9 0 0 0 .2-3.8l-.8-.1-.2-.8a2.2 2.2 0 0 0-4.2-.2l-.3.8-.9-.2a1.3 1.3 0 0 0-.4 2.6z"
        fill="#fff"
      />
      <path d="M14.9 12.3h1.4v4.1a1.5 1.5 0 1 1-1.1-1.4v-1.2h-2.4v2.6a1.5 1.5 0 1 1-1.1-1.4v-4.3h3.2z" fill="#fff" />
    </svg>
  )
}

/** A tab's glyph: a cloud and a note (Home), a magnifier (Search), a person (Mine). */
export function NoteCloudGlyph({ size = 26, filled = false }: Size & { filled?: boolean }) {
  return (
    <Glyph size={size}>
      {filled ? (
        <path d="M7.4 8.2a4 4 0 0 1 7.4-1.4 3.4 3.4 0 0 1 1.6 6.5l-.6.2H16v3.6a1.9 1.9 0 1 1-1.5-1.9v-1.9h-2.6v2.9a1.9 1.9 0 1 1-1.5-1.9V9.6a1.5 1.5 0 0 0-2.9-.1z" />
      ) : (
        <path d="M8.9 4.7a4.7 4.7 0 0 1 8.7-.2 4.1 4.1 0 0 1 1.6 7.8l-.5.2h-1.4v3.4a2.6 2.6 0 1 1-2-2.5V11H12v3.4a2.6 2.6 0 1 1-2-2.5V9.4a2.2 2.2 0 0 0-4.2-.7 2 2 0 0 0 1 3.8v2a4 4 0 0 1-1.6-7.7 4.7 4.7 0 0 1 3.7-2.1zm1 2a2.7 2.7 0 0 0-2.6 2.1l-.2 1-.9-.4A2 2 0 0 0 5 13a2 2 0 0 0 1.1-3.7l.6-1.9a2.7 2.7 0 0 1 3.2-.7zm7.7 2a2.3 2.3 0 0 0-1.9 2.2v1l-.9.3a1.8 1.8 0 0 0 1.1 3.4 1.7 1.7 0 0 0 1.2-2.9l.2-1a2.3 2.3 0 0 0 .3-3z" />
      )}
    </Glyph>
  )
}

export function SearchGlyph({ size = 26 }: Size) {
  return (
    <Glyph size={size}>
      <path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
    </Glyph>
  )
}

export function PersonGlyph({ size = 26, filled = false }: Size & { filled?: boolean }) {
  return (
    <Glyph size={size}>
      {filled ? (
        <path d="M12 3a4.2 4.2 0 1 1 0 8.4A4.2 4.2 0 0 1 12 3zm0 10c4.1 0 7.5 2.1 7.5 5.1V21h-15v-2.9C4.5 15.1 7.9 13 12 13z" />
      ) : (
        <path d="M12 3.8a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8zm0-1.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 12 2zM12 13c-4 0-7 2.1-7 5v1.9h2V18c0-1.8 2.2-3 5-3s5 1.2 5 3v1.9h2V18c0-2.9-3-5-7-5z" />
      )}
    </Glyph>
  )
}

export function BackGlyph({ size = 26 }: Size) {
  return (
    <Glyph size={size}>
      <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
    </Glyph>
  )
}

export function CloseGlyph({ size = 24 }: Size) {
  return (
    <Glyph size={size}>
      <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
    </Glyph>
  )
}

export function ChevronDownGlyph({ size = 30 }: Size) {
  return (
    <Glyph size={size}>
      <path d="M5.4 8.6 12 15.2l6.6-6.6L20 10l-8 8-8-8z" />
    </Glyph>
  )
}

/** A searched-for words' row: the clock of the past. */
export function HistoryGlyph({ size = 24 }: Size) {
  return (
    <Glyph size={size}>
      <path d="M13 3a9 9 0 1 1-8.5 12h2.1A7 7 0 1 0 6 9.5l2.5 2.5H2V5.5l2.6 2.6A9 9 0 0 1 13 3zm-1 4h1.5v5.2l4 2.4-.8 1.3-4.7-2.9z" />
    </Glyph>
  )
}

export function PlayGlyph({ size = 26 }: Size) {
  return (
    <Glyph size={size}>
      <path d="M8 5.1v13.8a.8.8 0 0 0 1.2.7l10.6-6.9a.8.8 0 0 0 0-1.4L9.2 4.4A.8.8 0 0 0 8 5.1z" />
    </Glyph>
  )
}

export function PauseGlyph({ size = 26 }: Size) {
  return (
    <Glyph size={size}>
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </Glyph>
  )
}

export function NextGlyph({ size = 26 }: Size) {
  return (
    <Glyph size={size}>
      <path d="M5 6.2v11.6a.8.8 0 0 0 1.2.7l8.5-5.8a.8.8 0 0 0 0-1.4L6.2 5.5A.8.8 0 0 0 5 6.2zM16.5 5.5h2a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z" />
    </Glyph>
  )
}

export function PreviousGlyph({ size = 26 }: Size) {
  return (
    <Glyph size={size}>
      <path d="M19 6.2v11.6a.8.8 0 0 1-1.2.7l-8.5-5.8a.8.8 0 0 1 0-1.4l8.5-5.8a.8.8 0 0 1 1.2.7zM7.5 5.5h-2a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5z" />
    </Glyph>
  )
}

export function ShuffleGlyph({ size = 26 }: Size) {
  return (
    <Glyph size={size}>
      <path
        d="M3.5 7h3.2c2 0 3 1.2 4.3 3.5S13.8 17 16 17h2.5M3.5 17h3.2c2 0 3-1.2 4.3-3.5S13.8 7 16 7h2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M17.5 4 21 7l-3.5 3zm0 10 3.5 3-3.5 3z" />
    </Glyph>
  )
}

export function RepeatGlyph({ size = 26, one = false }: Size & { one?: boolean }) {
  return (
    <Glyph size={size}>
      <path d="M7 7h10V4l4 4-4 4V9H9v4H7zm10 10H7v3l-4-4 4-4v3h8v-4h2z" />
      {one && <path d="M11.2 10.5h1.6v5h-1.4v-3.4l-.9.3v-1.1z" />}
    </Glyph>
  )
}

/** The volume: a speaker, quiet (no waves) or loud (two). */
export function VolumeGlyph({ size = 24, loud = false }: Size & { loud?: boolean }) {
  return (
    <Glyph size={size}>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {loud && (
        <path d="M15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zm2.8-2.8a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8z" />
      )}
    </Glyph>
  )
}

/** A song's words: lines of them, with a note. */
export function LyricsGlyph({ size = 24 }: Size) {
  return (
    <Glyph size={size}>
      <path d="M4 5.5h11v2H4zm0 4h9v2H4zm0 4h7v2H4zm0 4h5v2H4zM17.6 4.6l3.4-.7v9.4a2.3 2.3 0 1 1-1.5-2.2V6.1l-1.9.4z" />
    </Glyph>
  )
}

/** A song playing: three bars. */
export function EqualizerGlyph({ size = 20 }: Size) {
  return (
    <Glyph size={size}>
      <rect className="ne-eq-bar" x="4" y="9" width="3.4" height="11" rx="1" />
      <rect className="ne-eq-bar" x="10.3" y="4" width="3.4" height="16" rx="1" />
      <rect className="ne-eq-bar" x="16.6" y="12" width="3.4" height="8" rx="1" />
    </Glyph>
  )
}
