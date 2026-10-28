import { createPortal } from 'react-dom'
import { useText } from '../../state/text'
import { BilibiliVideoHole, useBilibiliVideo } from './bilibiliVideo'
import { NextGlyph, PauseGlyph, PlayGlyph, PreviousGlyph } from './glyphs'
import { playOrPause, skip, useNetease } from './netease'

/**
 * Bilibili full screen: its video over the whole app, its controls over the picture (in the shell's video
 * layer, above the page: the hole there is cut out of the page). The sound is the app's own (cab_sound takes it);
 * Esc-like return: the ×.
 */
export function BilibiliFullPlayer() {
  const text = useText()
  const playback = useNetease((state) => state.playback)
  const hole = useBilibiliVideo((state) => state.hole)
  if (!playback) return null
  const words = text.netease
  const close = () => useBilibiliVideo.getState().setFullscreen(false)
  const layer = document.getElementById('video-over')
  const controls = (
    <div
      className="bili-full-over"
      style={
        hole
          ? { left: hole.x, top: hole.y, width: hole.width, height: hole.height, borderRadius: hole.radius }
          : undefined
      }
    >
      <div className="bili-full-top">
        <button type="button" className="bili-full-exit" aria-label={words.close} onClick={close}>
          ×
        </button>
        <span className="bili-full-title">{playback.track.name}</span>
        <span className="bili-full-by">{playback.track.artists.join(' / ')}</span>
      </div>
      <div className="bili-full-controls">
        <button type="button" className="ne-round" aria-label={words.previous} onClick={() => skip(-1)}>
          <PreviousGlyph size={40} />
        </button>
        <button
          type="button"
          className="ne-play"
          aria-label={playback.playing ? words.pause : words.play}
          onClick={playOrPause}
        >
          {playback.playing ? <PauseGlyph size={52} /> : <PlayGlyph size={52} />}
        </button>
        <button type="button" className="ne-round" aria-label={words.next} onClick={() => skip(1)}>
          <NextGlyph size={40} />
        </button>
      </div>
    </div>
  )
  return (
    <div className="bili-full">
      <BilibiliVideoHole className="bili-full-hole" />
      {layer ? createPortal(controls, layer) : controls}
    </div>
  )
}
