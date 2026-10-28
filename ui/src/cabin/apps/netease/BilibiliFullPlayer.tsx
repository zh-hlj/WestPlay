import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useText } from '../../state/text'
import { BilibiliVideoHole, useBilibiliVideo } from './bilibiliVideo'
import { NextGlyph, PauseGlyph, PlayGlyph, PreviousGlyph } from './glyphs'
import { bilibiliQuality, clock, playOrPause, positionOf, seek, skip, useNetease } from './netease'

/**
 * Bilibili full screen: its video over the whole app, its controls over the picture (in the shell's video
 * layer, above the page: the hole there is cut out of the page). The sound is the app's own (cab_sound takes it);
 * Esc-like return: the ×.
 */
export function BilibiliFullPlayer() {
  const text = useText()
  const playback = useNetease((state) => state.playback)
  const hole = useBilibiliVideo((state) => state.hole)
  // The bar moves between the host's playback messages.
  const [, tick] = useState(0)
  const [quality, setQuality] = useState(0)
  // The controls fade while the picture plays (a pointer wakes them); a faint ghost, still pressable.
  const [shown, setShown] = useState(true)
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wake = () => {
    setShown(true)
    clearTimeout(idle.current)
    idle.current = setTimeout(() => setShown(false), 3500)
  }
  useEffect(() => {
    wake()
    return () => clearTimeout(idle.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const timer = setInterval(() => tick((count) => count + 1), 250)
    return () => clearInterval(timer)
  }, [])
  if (!playback) return null
  const position = positionOf(playback, performance.now())
  const duration = playback.duration
  const at = (event: { currentTarget: HTMLElement; clientX: number }) => {
    const box = event.currentTarget.getBoundingClientRect()
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    seek(share * duration)
  }
  const words = text.netease
  const close = () => useBilibiliVideo.getState().setFullscreen(false)
  const layer = document.getElementById('video-over')
  const controls = (
    <div
      className={shown ? 'bili-full-over' : 'bili-full-over away'}
      onPointerMove={wake}
      onPointerDown={wake}
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
        <span className="bili-full-quality">
          {[720, 1080].map((height) => (
            <button
              key={height}
              type="button"
              className={quality === height ? 'ne-pill on' : 'ne-pill'}
              onClick={() => {
                setQuality(height)
                bilibiliQuality(height)
              }}
            >
              {height}P
            </button>
          ))}
          <button
            type="button"
            className={quality === 0 ? 'ne-pill on' : 'ne-pill'}
            onClick={() => {
              setQuality(0)
              bilibiliQuality(0)
            }}
          >
            自动
          </button>
        </span>
      </div>
      <div className="bili-full-progress" onPointerDown={at}>
        <span>{clock(position * 1000)}</span>
        <span className="bili-full-bar">
          <i style={{ width: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%` }} />
        </span>
        <span>{duration > 0 ? clock(duration * 1000) : ''}</span>
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
