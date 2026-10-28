import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { bilibiliVideo } from './netease'

/** Where Bilibili's picture shows: a rounded rectangle of the CarPlay area, in screen pixels. */
export interface BilibiliHole {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

interface BilibiliVideoState {
  /** The hole the shell cuts over the page for Bilibili's picture; `null`: none (it plays on, heard). */
  hole: BilibiliHole | null
  setHole(hole: BilibiliHole | null): void
  /** Its video over the whole app, its controls over it (BilibiliFullPlayer.tsx). */
  fullscreen: boolean
  setFullscreen(fullscreen: boolean): void
}

export const useBilibiliVideo = create<BilibiliVideoState>()((set) => ({
  hole: null,
  setHole: (hole) => set({ hole }),
  fullscreen: false,
  setFullscreen: (fullscreen) => set({ fullscreen }),
}))

/**
 * Bilibili's video in its Now Playing: Bilibili's own page picture, placed by the host under the cabin page, and
 * the CarPlay area cut open over this element (shell/Shell.tsx's hole). Placed again whenever it may have moved.
 * Outside the host (a plain browser preview) the picture isn't there: the cover's place is left empty.
 */
export function BilibiliVideoHole({ className }: { className?: string }) {
  const frame = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const element = frame.current
    if (!element) return
    const place = () => {
      const area = document.querySelector('.carplay')?.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      if (!area || !box.width || !box.height) return
      // The shell's hole is in the CarPlay area's pixels (as YouTube's VideoHole); the host wants the frame's.
      const zoom = element.offsetWidth ? box.width / element.offsetWidth : 1
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) * zoom
      const hole: BilibiliHole = {
        x: box.left - area.left,
        y: box.top - area.top,
        width: box.width,
        height: box.height,
        radius: Number.isFinite(radius) ? radius : 0,
      }
      useBilibiliVideo.getState().setHole(hole)
      const scale = window.devicePixelRatio
      bilibiliVideo({
        action: 'videoShow',
        x: Math.round(box.left * scale),
        y: Math.round(box.top * scale),
        width: Math.round(box.width * scale),
        height: Math.round(box.height * scale),
      })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(element)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      useBilibiliVideo.getState().setHole(null)
      bilibiliVideo({ action: 'videoHide' })
    }
  }, [])
  return <span ref={frame} className={className} aria-hidden />
}
