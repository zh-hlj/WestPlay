import type { CSSProperties, ReactNode } from 'react'
import { useText } from '../../state/text'
import { EqualizerGlyph } from './glyphs'
import {
  type NeteaseItem,
  type NeteaseSection,
  type NeteaseTrack,
  clock,
  openItem,
  playSong,
  useNetease,
} from './netease'

/** The pieces the NetEase Cloud Music app's pages share: covers, cards and shelves, song rows, and the shapes of
 * what's still coming.
 *
 * TODO(verify): NetEase's own app, on a phone: how its cards and shelves sit, what its song rows have at their
 * ends, and its drawn placeholders' colours, are drawn from its look for the cab. */

/** A colour for something without a picture (the preview's): from its name, always the same. */
function hueOf(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

/** A cover: NetEase's picture (square; an artist's round), or (the preview's, which have none) one drawn in a
 * colour of its name's, its initials on it. */
export function Cover({
  name,
  kind,
  image,
  className = '',
}: {
  name: string
  kind?: NeteaseItem['kind']
  image?: string | null
  className?: string
}) {
  const round = kind === 'artist'
  const classes = `ne-cover${round ? ' round' : ''} ${className}`
  if (image) {
    return (
      <span className={classes}>
        <img src={image} alt="" draggable={false} loading="lazy" />
      </span>
    )
  }
  const initials =
    name
      .split(/\s+/)
      .filter((word) => /^\p{L}/u.test(word))
      .slice(0, 2)
      .map((word) => word[0])
      .join('') || '♪'
  return (
    <span className={`${classes} drawn`} style={{ '--ne-hue': hueOf(name) } as CSSProperties}>
      <b>{initials}</b>
    </span>
  )
}

/** Whether a song is the one playing now, and playing. */
function usePlaying(id: string | undefined): 'playing' | 'paused' | null {
  return useNetease((state) => {
    const playback = state.playback
    if (!id || !playback || playback.track.id !== id) return null
    return playback.playing ? 'playing' : 'paused'
  })
}

/** A card: its cover, its name, and NetEase's line under it (who it's by, or what it is). */
export function Card({ item }: { item: NeteaseItem }) {
  return (
    <div role="button" tabIndex={0} className={`ne-card ${item.kind}`} onClick={() => openItem(item)}>
      <span className="ne-card-cover">
        <Cover name={item.name} kind={item.kind} image={item.image} />
      </span>
      <span className="ne-card-name">{item.name}</span>
      {item.by && <span className="ne-card-by">{item.by}</span>}
    </div>
  )
}

/** A shelf: its title, then its cards side by side. */
export function Shelf({ section }: { section: NeteaseSection }) {
  if (section.items.length === 0) return null
  return (
    <section className="ne-shelf">
      <header className="ne-shelf-head">
        <h2>{section.title}</h2>
      </header>
      <div className="ne-cards">
        {section.items.map((item, index) => (
          <Card key={`${item.id}-${index}`} item={item} />
        ))}
      </div>
    </section>
  )
}

/** A song's row: its number (playing, the bars), its name and artists, its length. */
export function SongRow({ track, number, onPlay }: { track: NeteaseTrack; number?: string; onPlay?(): void }) {
  const playing = usePlaying(track.id)
  return (
    <div
      role="button"
      tabIndex={0}
      className={playing ? 'ne-row now' : 'ne-row'}
      onClick={() => (onPlay ? onPlay() : playSong(track))}
    >
      <span className="ne-row-number">{playing ? <EqualizerGlyph size={22} /> : (number ?? '')}</span>
      <span className="ne-row-text">
        <span className="ne-row-name">{track.name}</span>
        <span className="ne-row-by">
          {track.artists.join(' / ')}
          {track.album ? ` · ${track.album}` : ''}
        </span>
      </span>
      <span className="ne-row-length">{track.durationMs > 0 ? clock(track.durationMs) : ''}</span>
    </div>
  )
}

/** A list's songs, numbered (each playing from its list, if one's given). */
export function SongList({ tracks, onPlay }: { tracks: NeteaseTrack[]; onPlay?(track: NeteaseTrack): void }) {
  return (
    <div className="ne-rows">
      {tracks.map((track, index) => (
        <SongRow
          key={`${track.id}-${index}`}
          track={track}
          number={String(index + 1)}
          {...(onPlay ? { onPlay: () => onPlay(track) } : {})}
        />
      ))}
    </div>
  )
}

/** A page's shelves still coming: their shapes, grey, breathing (as NetEase's own wait). */
export function Skeletons({ shelves = 3, rows = false }: { shelves?: number; rows?: boolean }) {
  return (
    <div className="ne-skeletons" role="progressbar">
      {Array.from({ length: shelves }, (_, index) => (
        <section key={index} className="ne-shelf">
          <span className="ne-skeleton-line title" />
          {rows ? (
            <div className="ne-rows">
              {Array.from({ length: 6 }, (_, at) => (
                <div key={at} className="ne-row">
                  <span className="ne-skeleton-block number" />
                  <span className="ne-row-text">
                    <span className="ne-skeleton-line" />
                    <span className="ne-skeleton-line short" />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ne-cards">
              {Array.from({ length: 6 }, (_, at) => (
                <div key={at} className="ne-card">
                  <span className="ne-card-cover">
                    <span className="ne-cover ne-skeleton-block" />
                  </span>
                  <span className="ne-skeleton-line" />
                  <span className="ne-skeleton-line short" />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

/** Couldn't load: said, with a way to ask again. */
export function Failed({ onRetry }: { onRetry(): void }) {
  const text = useText()
  return (
    <div className="ne-failed">
      <p>{text.netease.failed}</p>
      <button type="button" className="ne-pill" onClick={onRetry}>
        {text.netease.tryAgain}
      </button>
    </div>
  )
}

/** A page's scroll box: its content, with the page's sides. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="ne-scroll">{children}</div>
}
