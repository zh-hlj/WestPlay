import { type PointerEvent, useRef, useState } from 'react'
import { useText } from '../../state/text'
import {
  ChevronDownGlyph,
  LyricsGlyph,
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
  RepeatGlyph,
  ShuffleGlyph,
  VolumeGlyph,
} from './glyphs'
import { Cover, Failed } from './parts'
import {
  type Playback,
  clock,
  cycleRepeat,
  playOrPause,
  positionOf,
  seek,
  setVolume,
  skip,
  toggleShuffle,
  useAsked,
  useNetease,
  useNow,
} from './netease'

/**
 * Now Playing, the mini player and the words: NetEase Cloud Music's own player, laid out for the cab.
 *
 * TODO(verify): NetEase's own app's player, on a phone: how its sheet lays the cover, the words and the queue
 * out, and whether its words come timed (the host's netease.js reads `/api/song/lyric`'s `lrc`; translations and
 * which language they're in aren't read yet).
 */

/** The song's time now, ticking while it plays. */
function usePosition(playback: Playback): number {
  const now = useNow(playback.playing && !playback.loading)
  return positionOf(playback, now)
}

/** The mini player, as NetEase's app has it: a round cover, the song and its artists, play or pause, and how far
 * the song is. Pressed, Now Playing. */
export function MiniPlayer() {
  const text = useText()
  const playback = useNetease((state) => state.playback)
  if (!playback) return null
  const words = text.netease
  return (
    <div
      className="ne-mini"
      role="button"
      tabIndex={0}
      aria-label={words.nowPlaying}
      onClick={() => useNetease.setState({ nowPlaying: true })}
    >
      <Cover name={playback.track.name} image={playback.track.image} className="ne-mini-cover" />
      <span className="ne-mini-text">
        <span className="ne-mini-name">{playback.track.name}</span>
        <span className="ne-mini-by">{playback.track.artists.join(' / ')}</span>
      </span>
      <button
        type="button"
        className="ne-round big"
        aria-label={playback.playing ? words.pause : words.play}
        onClick={(event) => {
          event.stopPropagation()
          playOrPause()
        }}
      >
        {playback.playing ? <PauseGlyph size={30} /> : <PlayGlyph size={30} />}
      </button>
      <MiniLine playback={playback} />
    </div>
  )
}

function MiniLine({ playback }: { playback: Playback }) {
  const position = usePosition(playback)
  const share = playback.duration > 0 ? Math.min(1, position / playback.duration) : 0
  return (
    <span className={playback.loading ? 'ne-mini-line loading' : 'ne-mini-line'}>
      <span style={{ transform: `scaleX(${share})` }} />
    </span>
  )
}

/** A thin line with a dot, to drag along (how far the song is; the volume): `share` of it filled, said as it's
 * dragged (`onMove`) and as it's let go (`onDone`). */
function Slider({
  share,
  label,
  className = '',
  onMove,
  onDone,
}: {
  share: number
  label: string
  className?: string
  onMove?(share: number): void
  onDone(share: number): void
}) {
  const bar = useRef<HTMLDivElement>(null)
  const [dragged, setDragged] = useState<number | null>(null)
  const shown = Math.min(1, Math.max(0, dragged ?? share))
  const at = (event: PointerEvent) => {
    const box = bar.current?.getBoundingClientRect()
    if (!box || box.width === 0) return 0
    return Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
  }
  return (
    <div
      ref={bar}
      className={`ne-slider${dragged === null ? '' : ' dragging'} ${className}`}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        const value = at(event)
        setDragged(value)
        onMove?.(value)
      }}
      onPointerMove={(event) => {
        if (dragged === null) return
        const value = at(event)
        setDragged(value)
        onMove?.(value)
      }}
      onPointerUp={(event) => {
        if (dragged === null) return
        onDone(at(event))
        setDragged(null)
      }}
      onPointerCancel={() => setDragged(null)}
    >
      <span className="ne-slider-track" />
      <span className="ne-slider-fill" style={{ transform: `scaleX(${shown})` }} />
      <span className="ne-slider-thumb" style={{ left: `${shown * 100}%` }} />
    </div>
  )
}

/** How far the song is, to drag to another place in it; its time held, breathing, while it waits for its
 * sound. */
function Progress({ playback }: { playback: Playback }) {
  const position = usePosition(playback)
  const [dragged, setDragged] = useState<number | null>(null)
  const duration = playback.duration
  const share = duration > 0 ? position / duration : 0
  return (
    <div className="ne-progress">
      <Slider
        share={share}
        label={clock(position * 1000)}
        className={playback.loading ? 'loading' : ''}
        onMove={(value) => setDragged(value * duration)}
        onDone={(value) => {
          setDragged(null)
          if (duration > 0) seek(value * duration)
        }}
      />
      <div className="ne-times">
        <span>{clock((dragged ?? position) * 1000)}</span>
        <span>{duration > 0 ? clock(duration * 1000) : ''}</span>
      </div>
    </div>
  )
}

/** The volume (the page player's own), quiet to loud. */
function Volume({ playback }: { playback: Playback }) {
  const text = useText()
  return (
    <div className="ne-volume">
      <VolumeGlyph size={22} />
      <Slider
        share={playback.volume ?? 1}
        label={text.netease.volume}
        onMove={(value) => setVolume(value)}
        onDone={(value) => setVolume(value, true)}
      />
      <VolumeGlyph size={22} loud />
    </div>
  )
}

/**
 * Now Playing, as NetEase Cloud Music's app has it, laid side by side for the cab's wide screen: on the song's
 * cover and cover colour, the chevron and the words on top; the cover beside the song's name, its artists, how
 * far it is, the controls and the volume; under them what comes next; the song's words rise as a sheet over it.
 */
export function NowPlaying() {
  const text = useText()
  const open = useNetease((state) => state.nowPlaying)
  const playback = useNetease((state) => state.playback)
  const lyricsOpen = useNetease((state) => state.lyrics)
  if (!open || !playback) return null
  const words = text.netease
  const track = playback.track
  const close = () => useNetease.setState({ nowPlaying: false, lyrics: false })
  return (
    <div className="ne-now" role="dialog" aria-label={words.nowPlaying}>
      <header className="ne-now-top">
        <button type="button" className="ne-round" aria-label={words.close} onClick={close}>
          <ChevronDownGlyph size={34} />
        </button>
        <span className="ne-now-label">
          {playback.context?.name ? `${words.playingFrom} ${playback.context.name}` : words.nowPlaying}
        </span>
        <button
          type="button"
          className={lyricsOpen ? 'ne-round on' : 'ne-round'}
          aria-label={words.lyrics}
          aria-pressed={lyricsOpen}
          onClick={() => useNetease.setState({ lyrics: !lyricsOpen })}
        >
          <LyricsGlyph size={28} />
        </button>
      </header>
      <div className="ne-now-main">
        <div key={track.id} className={`ne-now-art${playback.direction === -1 ? ' back' : ''}`}>
          <Cover name={track.name} image={track.image} className="ne-now-cover" />
        </div>
        <div className="ne-now-song">
          <h1 className="ne-now-name">{track.name}</h1>
          <span className="ne-now-artists">{track.artists.join(' / ')}</span>
          {track.album && <span className="ne-now-album">{track.album}</span>}
          <Progress playback={playback} />
          <div className="ne-controls">
            <button
              type="button"
              className={playback.shuffle ? 'ne-round on' : 'ne-round'}
              aria-label={words.shuffle}
              aria-pressed={playback.shuffle}
              onClick={toggleShuffle}
            >
              <ShuffleGlyph size={28} />
            </button>
            <button type="button" className="ne-round" aria-label={words.previous} onClick={() => skip(-1)}>
              <PreviousGlyph size={38} />
            </button>
            <button
              type="button"
              className="ne-play"
              aria-label={playback.playing ? words.pause : words.play}
              onClick={playOrPause}
            >
              {playback.playing ? <PauseGlyph size={44} /> : <PlayGlyph size={44} />}
            </button>
            <button type="button" className="ne-round" aria-label={words.next} onClick={() => skip(1)}>
              <NextGlyph size={38} />
            </button>
            <button
              type="button"
              className={playback.repeat === 'off' ? 'ne-round' : 'ne-round on'}
              aria-label={words.repeat}
              aria-pressed={playback.repeat !== 'off'}
              onClick={cycleRepeat}
            >
              <RepeatGlyph size={28} one={playback.repeat === 'one'} />
            </button>
          </div>
          <Volume playback={playback} />
        </div>
      </div>
      {playback.next.length > 0 && !lyricsOpen && <UpNext playback={playback} />}
      {lyricsOpen && <Lyrics songId={track.id} onClose={() => useNetease.setState({ lyrics: false })} />}
    </div>
  )
}

/** What comes next, as NetEase's page says it (not pressable: its queue isn't the app's to jump about). */
function UpNext({ playback }: { playback: Playback }) {
  const text = useText()
  return (
    <section className="ne-now-next">
      <h2>{text.netease.upNext}</h2>
      <div className="ne-rows">
        {playback.next.slice(0, 6).map((track, index) => (
          <div key={`${track.id}-${index}`} className="ne-row">
            <span className="ne-row-number">{index + 1}</span>
            <span className="ne-row-text">
              <span className="ne-row-name">{track.name}</span>
              <span className="ne-row-by">{track.artists.join(' / ')}</span>
            </span>
            <span className="ne-row-length">{track.durationMs > 0 ? clock(track.durationMs) : ''}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** The song's words, each line lit as it's sung; or that there are none. */
function Lyrics({ songId, onClose }: { songId: string; onClose(): void }) {
  const text = useText()
  const asked = useAsked({ ask: 'lyrics', song: songId })
  const playback = useNetease((state) => state.playback)
  const position = usePosition(playback ?? fallback)
  const words = text.netease
  return (
    <div className="ne-sheet" role="dialog" aria-label={words.lyrics}>
      <button type="button" className="ne-sheet-handle" aria-label={words.close} onClick={onClose}>
        <span />
      </button>
      <header className="ne-sheet-head">
        <h2>{words.lyrics}</h2>
      </header>
      <div className="ne-sheet-body">
        {asked.failed ? (
          <Failed onRetry={asked.retry} />
        ) : !asked.answer ? (
          <div className="ne-lyrics-wait" role="progressbar" />
        ) : asked.answer.lines.length === 0 ? (
          <p className="ne-note">{words.noLyrics}</p>
        ) : (
          <LyricsLines lines={asked.answer.lines} synced={asked.answer.synced} position={position} />
        )}
      </div>
    </div>
  )
}

/** A stand-in time for a song nothing plays of (Now Playing is open: it does). */
const fallback: Playback = {
  track: { id: '', name: '', artists: [], album: '', durationMs: 0 },
  context: null,
  playing: false,
  loading: false,
  position: 0,
  at: 0,
  duration: 0,
  volume: null,
  shuffle: false,
  repeat: 'off',
  next: [],
  direction: 1,
}

function LyricsLines({
  lines,
  synced,
  position,
}: {
  lines: { start: number; end: number; text: string }[]
  synced: boolean
  position: number
}) {
  const current = synced ? lines.reduce((found, line, index) => (line.start <= position + 0.15 ? index : found), 0) : -1
  return (
    <div className="ne-lyrics">
      {lines.map((line, index) =>
        line.text ? (
          <p
            key={index}
            className={index === current ? 'ne-lyric current' : index < current ? 'ne-lyric sung' : 'ne-lyric'}
          >
            {line.text}
          </p>
        ) : (
          <span key={index} className="ne-lyric-gap" />
        ),
      )}
    </div>
  )
}
