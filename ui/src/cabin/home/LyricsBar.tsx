import { positionOf, useAsked, useNetease, useNow } from '../apps/netease/netease'
import type { Playback } from '../apps/netease/netease'
import { useCabin } from '../state/store'
import { useText } from '../state/text'
import './lyrics.css'

/**
 * The line being sung, on Home and the Dashboard (Settings › Now Playing › Show Lyrics): the lyrics asked of
 * the service playing, the line it is at. Not synced, or none: nothing is shown (the screens are as they were).
 */
export function LyricsBar() {
  const show = useCabin((state) => state.showLyrics)
  const playback = useNetease((state) => state.playback)
  const track = playback?.track
  if (!show || !playback || !track) return null
  return <Ticker key={track.id} playback={playback} />
}

function Ticker({ playback }: { playback: Playback }) {
  const text = useText()
  const asked = useAsked({ ask: 'lyrics', song: playback.track.id })
  const now = useNow(playback.playing && !playback.loading)
  const position = positionOf(playback, now)
  const lyrics = asked.answer
  if (!lyrics?.synced || lyrics.lines.length === 0) return null
  const current = lyrics.lines.reduce(
    (found, line, index) => (line.start <= position + 0.15 ? index : found),
    -1,
  )
  const line = lyrics.lines[current]
  if (!line || !line.text.trim()) return null
  const next = lyrics.lines[current + 1]
  return (
    <section className="lyrics-bar" aria-label={text.netease.lyrics}>
      <span className="lyrics-text" key={`${current}-${line.text}`}>
        {line.text}
      </span>
      {next?.text.trim() && <span className="lyrics-next">{next.text}</span>}
      <span className="lyrics-track">
        {playback.track.name} · {playback.track.artists.join(' / ')}
      </span>
    </section>
  )
}
