import { positionOf, useAsked, useNetease, useNow } from '../apps/netease/netease'
import type { Playback } from '../apps/netease/netease'
import { useCabin } from '../state/store'

/**
 * The lyrics in the Dashboard's music card, the way a car's own card shows them (Settings › Now Playing › Show
 * Lyrics): the line being sung at the card's foot in the accent, the one or two before it dim above; under it
 * the artist and how far the song is. No synced lyrics (or the setting off): the card is as it was.
 */
export function DashboardLyrics() {
  const show = useCabin((state) => state.showLyrics)
  const playback = useNetease((state) => state.playback)
  const track = playback?.track
  if (!show || !playback || !track) return null
  return <Lines key={track.id} playback={playback} />
}

function Lines({ playback }: { playback: Playback }) {
  const asked = useAsked({ ask: 'lyrics', song: playback.track.id })
  const now = useNow(playback.playing && !playback.loading)
  const position = positionOf(playback, now)
  const lyrics = asked.answer
  if (!lyrics?.synced || lyrics.lines.length === 0) return null
  const current = lyrics.lines.reduce((found, line, index) => (line.start <= position + 0.15 ? index : found), -1)
  const line = lyrics.lines[current]
  if (!line || !line.text.trim()) return null
  const text = (offset: number) => lyrics.lines[current + offset]?.text.trim() || ''
  const duration = playback.duration
  const share = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0
  return (
    <>
      <div className="np-lyrics" aria-hidden>
        <span className="np-lyric prev">{text(-2) || '\u00a0'}</span>
        <span className="np-lyric prev">{text(-1) || '\u00a0'}</span>
        <span className="np-lyric current">{line.text}</span>
      </div>
      <span className="np-artist">{playback.track.artists.join(' / ')}</span>
      <span className="np-progress" aria-hidden>
        <i style={{ width: `${(share * 100).toFixed(1)}%` }} />
      </span>
    </>
  )
}
