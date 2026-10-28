import { type MusicPlayer, pauseMusicWithGame } from '../musicWithGame'
import { netease, pauseNow, playingNow, resumeNow, setVolume, useNetease } from './netease'

/** NetEase Cloud Music as one of the cab's players (musicWithGame.ts, oneAtATime.ts). */
export const neteasePlayer: MusicPlayer = {
  name: 'netease cloud music',
  playingHere: playingNow,
  pauseHere: pauseNow,
  resumeHere: resumeNow,
  volume: () => useNetease.getState().playback?.volume ?? null,
  sendVolume: (share) => netease({ action: 'volume', percent: Math.round(share * 100) }),
  setVolume: (share) => setVolume(share, true),
  subscribe: (changed) =>
    useNetease.subscribe((music, before) => {
      changed(Boolean(music.playback?.playing && !before.playback?.playing))
    }),
}

/** NetEase Cloud Music with the game (musicWithGame.ts). Returns the function that stops it. */
export function pauseNeteaseWithGame(): () => void {
  return pauseMusicWithGame(neteasePlayer)
}
