import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  type NeteaseAnswers,
  type NeteaseCommand,
  type NeteaseContext,
  type NeteaseItem,
  type NeteasePlayback,
  type NeteaseQuestion,
  type NeteaseRepeat,
  type NeteaseTrack,
  isInHost,
  postToHost,
} from '../../../shared/host'
import type { MediaSource } from '../../../shared/media'
import { createAsking } from '../asking'
import { positionOf, type Timed } from '../music/time'
import { previewAnswer, previewPlay } from './preview'

export { positionOf } from '../music/time'
export type {
  NeteaseAnswers,
  NeteaseCollection,
  NeteaseHome,
  NeteaseItem,
  NeteaseQuestion,
  NeteaseResults,
  NeteaseSection,
  NeteaseTrack,
} from '../../../shared/host'

/**
 * The NetEase Cloud Music app's state: WestPlay's own app in the look of NetEase Cloud Music's own app. NetEase
 * Cloud Music's web player, run by the host in a hidden WebView (crates/host netease.rs), plays and answers the
 * app's questions (Home, a search, a playlist's or an album's page, a song's words) from its own page. The app
 * shows what it asked for at once (a song pressed shows here before NetEase says it plays), then follows what
 * NetEase says plays. In a plain browser an invented preview answers and plays (preview.ts).
 *
 * Signed out, NetEase Cloud Music is what its web player is then: Home and Search, every song playing. The
 * sign-in is NetEase's (a QR code, in a window on the PC's desktop). The host says whether it's signed in,
 * nothing more; that's kept (shown at once as WestPlay starts, replaced as NetEase's page says it). Answers are
 * only shown, held for this session.
 *
 * TODO(verify): NetEase's own web player, run for real: its page's player bar (the old web player's `#g_player`;
 * the page NetEase put out in November 2025 has none of it) and its own API, what its page says of what plays
 * (the host's netease.js, netease.rs). The app's shapes here are the host's cut-down ones; nothing of a phone
 * has answered these yet.
 */

export type Question = NeteaseQuestion
export type Answers = NeteaseAnswers
export type Repeat = NeteaseRepeat

export type Tab = 'home' | 'search' | 'mine'
/** The tabs of the bottom bar, in its order (Search is the top bar's, as NetEase's app has it). */
export const TABS: readonly Tab[] = ['home', 'search', 'mine']

/** A page over a tab's own (the card pressed, to show at once while its page comes). */
export type View =
  { id: number; kind: 'collection'; item: NeteaseItem } | { id: number; kind: 'results'; query: string }

/** What plays: the song, how far and how long, the options, the queue around it (what NetEase's page says comes
 * next), where it plays from, and the way the last change of song went (Now Playing's cover slides that way). */
export interface Playback extends Timed {
  track: NeteaseTrack
  context: NeteaseContext | null
  volume: number | null
  shuffle: boolean
  repeat: Repeat
  next: NeteaseTrack[]
  direction: 1 | -1
}

interface NeteaseState {
  /** Whether NetEase Cloud Music's web player is signed in (the host says; kept as last said): `null` until known. */
  signedIn: boolean | null
  playing: boolean | null
  signingIn: boolean
  /** The account's membership as NetEase says it ("VIP", "黑胶VIP", "非VIP"; null: signed out or not known). */
  vip: string | null
  tab: Tab
  /** Each tab's pages over its own, the one showing last (each tab is kept where it was left). */
  views: Record<Tab, View[]>
  /** Now Playing is open, over the app; its words risen over it, or not. */
  nowPlaying: boolean
  lyrics: boolean
  playback: Playback | null
  toast: { text: string; id: number } | null
  /** Searches made, newest first (kept, as NetEase's app keeps its own). */
  searches: string[]
  /** Plays NetEase didn't confirm, counted (the app says it couldn't play, each time). */
  unplayed: number
}

const NO_VIEWS: Record<Tab, View[]> = { home: [], search: [], mine: [] }
const SEARCHES_KEPT = 12

export const useNetease = create<NeteaseState>()(
  persist(
    (): NeteaseState => ({
      // Outside WestPlay (a plain browser) there's no host to say: the preview starts signed out.
      signedIn: isInHost() ? null : false,
      playing: null,
      signingIn: false,
      vip: null,
      tab: 'home',
      views: NO_VIEWS,
      nowPlaying: false,
      lyrics: false,
      playback: null,
      toast: null,
      searches: [],
      unplayed: 0,
    }),
    {
      name: 'westplay.netease',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Signed in or not (shown at once as WestPlay starts), and the searches made. Nothing else.
      partialize: (state) => ({ signedIn: state.signedIn, searches: state.searches }),
      // Kept by an earlier WestPlay (or edited): only what's sound.
      merge: (stored, current) => {
        const { signedIn, searches } = (stored ?? {}) as Partial<NeteaseState>
        return {
          ...current,
          ...(typeof signedIn === 'boolean' ? { signedIn } : {}),
          searches: Array.isArray(searches)
            ? searches.filter((each) => typeof each === 'string' && each.length <= 200).slice(0, SEARCHES_KEPT)
            : [],
        }
      },
    },
  ),
)

/** A command for NetEase Cloud Music's web player (nothing happens in a plain browser preview). */
export function netease(command: NeteaseCommand): void {
  postToHost({ type: 'netease', command })
}

// --- The account -------------------------------------------------------------------------------------------

/** How long the app waits for the web player to say before showing NetEase Cloud Music signed out. */
const ACCOUNT_WAIT = 8000

/** Signed in, signed out, or not known yet (the web player starting, nothing kept): known by `ACCOUNT_WAIT` at
 * the latest, signed out then. */
export function useAccount(): 'in' | 'out' | 'unknown' {
  const signedIn = useNetease((state) => state.signedIn)
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (signedIn !== null) return
    const timer = setTimeout(() => setWaited(true), ACCOUNT_WAIT)
    return () => clearTimeout(timer)
  }, [signedIn])
  return signedIn === null ? (waited ? 'out' : 'unknown') : signedIn ? 'in' : 'out'
}

/** The preview's sign-in: as if the QR code were scanned on the phone a moment later. */
const PREVIEW_SIGN_IN = 1800

/** NetEase's sign-in: a QR code in its window on the PC's desktop. */
export function signIn(): void {
  if (isInHost()) {
    netease({ action: 'signIn' })
    return
  }
  useNetease.setState({ signingIn: true })
  setTimeout(() => useNetease.setState({ signingIn: false, signedIn: true }), PREVIEW_SIGN_IN)
}

/** Signs out (NetEase's cookies forgotten: its page starts again signed out). */
export function signOut(): void {
  if (isInHost()) netease({ action: 'signOut' })
  useNetease.setState({ signedIn: false })
}

/** What the host says of NetEase Cloud Music's web player (`netease`). */
export function receiveState(message: {
  signedIn: boolean | null
  playing: boolean | null
  signingIn: boolean
  vip?: string | null
}): void {
  useNetease.setState({
    playing: message.playing,
    signingIn: message.signingIn,
    // Not running (`null`): the kept sign-in stays as it was.
    ...(message.signedIn === null ? {} : { signedIn: message.signedIn }),
    ...(message.signedIn === null || message.vip === undefined ? {} : { vip: message.vip }),
    ...(message.signedIn === false ? { vip: null } : {}),
  })
}

// --- Questions ---------------------------------------------------------------------------------------------

const asking = createAsking<Question, Answers>(
  (id, question) => netease({ action: 'ask', id, question }),
  previewAnswer,
  isInHost,
)
export const ask = asking.ask
export const useAsked = asking.useAsked
/** NetEase Cloud Music's answer (`neteaseAnswer`), for the question asked with its id. */
export const receiveAnswer = asking.receive

// Signed in or out: nothing's kept of what the account had (its answers asked again, for the other).
useNetease.subscribe((state, before) => {
  if (state.signedIn !== before.signedIn && before.signedIn !== null && state.signedIn !== null) {
    asking.clear()
    useNetease.setState({
      playback: null,
      nowPlaying: false,
      lyrics: false,
      views: NO_VIEWS,
      tab: state.tab === 'mine' && !state.signedIn ? 'home' : state.tab,
    })
  }
})

/** How many times a page has been shown again (a page kept under others, or a tab left, is shown again). */
export function useShownAgain(shown: boolean): number {
  const [times, setTimes] = useState(0)
  const [was, setWas] = useState(shown)
  if (shown !== was) {
    setWas(shown)
    if (shown) setTimes(times + 1)
  }
  return times
}

// --- Going around ------------------------------------------------------------------------------------------

let nextId = 1

/** A tab: pressed again where it already is, back to its own page. */
export function openTab(tab: Tab): void {
  const { tab: was, views } = useNetease.getState()
  if (was === tab) useNetease.setState({ views: { ...views, [tab]: [] } })
  else useNetease.setState({ tab })
}

type Unidentified<T> = T extends unknown ? Omit<T, 'id'> : never

export function openView(view: Unidentified<View>): void {
  const { tab, views } = useNetease.getState()
  useNetease.setState({
    views: { ...views, [tab]: [...views[tab], { ...view, id: nextId++ } as View] },
    nowPlaying: false,
  })
}

export function goBack(): void {
  const { tab, views } = useNetease.getState()
  useNetease.setState({ views: { ...views, [tab]: views[tab].slice(0, -1) } })
}

/** A card or row pressed: its page; a song plays. */
export function openItem(item: NeteaseItem): void {
  if (item.kind === 'song') {
    playSong(trackOfItem(item))
    return
  }
  if (item.kind === 'playlist' || item.kind === 'album') {
    openView({ kind: 'collection', item })
    return
  }
  // TODO(verify): an artist's page (and a radio's) needs questions NetEase's page isn't asked yet: nothing opens
  // for them until they are.
}

export function remember(query: string): void {
  const trimmed = query.trim()
  if (!trimmed) return
  const searches = useNetease.getState().searches.filter((each) => each !== trimmed)
  useNetease.setState({ searches: [trimmed, ...searches].slice(0, SEARCHES_KEPT) })
}

export function forget(query: string): void {
  useNetease.setState({ searches: useNetease.getState().searches.filter((each) => each !== query) })
}

// --- Playing -----------------------------------------------------------------------------------------------

/** A change of what plays, shown at once (NetEase then says how it really is). */
function showPlayback(change: Partial<Playback>): void {
  const playback = useNetease.getState().playback
  if (playback) useNetease.setState({ playback: { ...playback, ...change } })
}

/** "3:08" */
export function clock(ms: number): string {
  const whole = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** A card's song as Now Playing shows it, from its card (until NetEase says it). */
export function trackOfItem(item: NeteaseItem): NeteaseTrack {
  return {
    id: item.id,
    name: item.name,
    artists: item.by
      .split(/\s*[/,]\s*/)
      .map((name) => name.trim())
      .filter(Boolean),
    album: '',
    image: item.image ?? null,
    durationMs: 0,
  }
}

/** What plays, shown at once: `track` playing (or waiting for its sound), from where `context` says. */
function showPlaying(track: NeteaseTrack, context: NeteaseContext | null): void {
  const was = useNetease.getState().playback
  useNetease.setState({
    playback: {
      track,
      context,
      playing: true,
      loading: true,
      position: 0,
      at: performance.now(),
      duration: track.durationMs / 1000,
      volume: was?.volume ?? null,
      shuffle: was?.shuffle ?? false,
      repeat: was?.repeat ?? 'off',
      next: [],
      direction: 1,
    },
  })
}

/** A song pressed: it plays (in its list, if it was in one). */
export function playSong(track: NeteaseTrack, playlist?: string, context?: NeteaseContext): void {
  if (!isInHost()) {
    const found = previewPlay({ song: track.id, ...(playlist ? { playlist } : {}) })
    if (found) startPreview(found.tracks, found.index, found.from, found.context)
    return
  }
  netease({ action: 'play', song: track.id, ...(playlist ? { playlist } : {}) })
  expectPlaying()
  showPlaying(track, context ?? null)
}

/** A list's Play pressed: its songs play from the first (NetEase's page plays the whole list its own way). */
export function playCollection(item: NeteaseItem, tracks: readonly NeteaseTrack[]): void {
  const first = tracks[0]
  if (!isInHost()) {
    const found = previewPlay({ playlist: item.id })
    if (found) startPreview(found.tracks, found.index, found.from, found.context)
    return
  }
  // TODO(verify): an album's id on NetEase's playlist route: its page tries a playlist and then an album.
  netease({ action: 'play', playlist: item.id })
  expectPlaying()
  if (first) showPlaying(first, { id: item.id, name: item.name, kind: item.kind })
}

/** Plays or pauses what's playing. */
export function playOrPause(): void {
  const playback = useNetease.getState().playback
  if (!playback) return
  const now = performance.now()
  if (isInHost()) {
    netease({ action: playback.playing ? 'pause' : 'resume' })
    if (playback.playing) stopExpecting()
  }
  showPlayback({ playing: !playback.playing, position: positionOf(playback, now), at: now })
}

/** The last skip pressed (for the way the cover slides when NetEase says the song changed). */
let lastSkip: { direction: 1 | -1; at: number } | null = null

/** The next song, or the one before (within a song's first seconds; later, its start). */
export function skip(direction: 1 | -1): void {
  const playback = useNetease.getState().playback
  if (!playback) return
  const now = performance.now()
  if (!isInHost()) {
    previewSkip(direction)
    return
  }
  lastSkip = { direction, at: now }
  netease({ action: direction === 1 ? 'next' : 'previous' })
  // Back late in a song is its start: no waiting. Otherwise the next song's: its time held, its bar breathing.
  if (direction === -1 && positionOf(playback, now) > 3) showPlayback({ position: 0, at: now })
  else if (playback.playing) showPlayback({ loading: true, position: positionOf(playback, now), at: now })
}

export function seek(seconds: number): void {
  if (isInHost()) netease({ action: 'seek', seconds: Math.max(0, seconds) })
  showPlayback({ position: Math.max(0, seconds), at: performance.now() })
}

let volumeSent = 0

/** The player's volume (0 to 1), as it's dragged: shown at once, sent a few times a second (and the last one
 * always). */
export function setVolume(share: number, done = false): void {
  const volume = Math.min(1, Math.max(0, share))
  showPlayback({ volume })
  if (!isInHost()) return
  const now = performance.now()
  if (!done && now - volumeSent < 120) return
  volumeSent = now
  netease({ action: 'volume', percent: Math.round(volume * 100) })
}

/** NetEase's shuffle. */
export function toggleShuffle(): void {
  const playback = useNetease.getState().playback
  if (!playback) return
  if (isInHost()) netease({ action: 'shuffle', on: !playback.shuffle })
  showPlayback({ shuffle: !playback.shuffle })
}

/** Off, all, the one song: NetEase's order. */
export function cycleRepeat(): void {
  const playback = useNetease.getState().playback
  if (!playback) return
  const repeat: Repeat = playback.repeat === 'off' ? 'all' : playback.repeat === 'all' ? 'one' : 'off'
  if (isInHost()) netease({ action: 'repeat', mode: repeat })
  showPlayback({ repeat })
}

let toastId = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined

export function showToast(text: string): void {
  clearTimeout(toastTimer)
  useNetease.setState({ toast: { text, id: ++toastId } })
  toastTimer = setTimeout(() => useNetease.setState({ toast: null }), 2600)
}

/** How long NetEase has to say it plays what was asked for, before the app says it couldn't. */
const PLAY_WAIT = 15000
let playWait: ReturnType<typeof setTimeout> | undefined
/** Playing was asked for, and NetEase hasn't said it plays yet (what it says meanwhile, that nothing or nothing
 * new plays, is on its way there: not shown). */
let awaitingPlay = false

function expectPlaying(): void {
  clearTimeout(playWait)
  awaitingPlay = true
  playWait = setTimeout(() => {
    awaitingPlay = false
    const playback = useNetease.getState().playback
    const now = performance.now()
    useNetease.setState({
      playback: playback
        ? { ...playback, playing: false, loading: false, position: positionOf(playback, now), at: now }
        : null,
      unplayed: useNetease.getState().unplayed + 1,
    })
  }, PLAY_WAIT)
}

function stopExpecting(): void {
  clearTimeout(playWait)
  awaitingPlay = false
}

/** What NetEase Cloud Music plays (`neteasePlayback`): the app follows it. */
export function receivePlayback(playback: NeteasePlayback | null): void {
  // On the way to playing what was asked for: what's said meanwhile isn't where it's going.
  if (awaitingPlay && !playback?.playing) return
  // The page's bar says no song (nor does the app): nothing plays.
  if (!playback || !playback.track) {
    stopExpecting()
    useNetease.setState({ playback: null, nowPlaying: false, lyrics: false })
    return
  }
  const was = useNetease.getState().playback
  const now = performance.now()
  const changed = was?.track.id !== playback.track.id
  // The cover slides the way the song changed: back if Back was pressed a moment ago, forward otherwise.
  const backwards = lastSkip?.direction === -1 && now - lastSkip.at < 4000
  const direction: 1 | -1 = !changed ? (was?.direction ?? 1) : backwards ? -1 : 1
  if (changed) lastSkip = null
  if (playback.playing) stopExpecting()
  useNetease.setState({
    playback: {
      track: playback.track,
      context: playback.context,
      playing: playback.playing,
      loading: false,
      position: playback.positionMs / 1000,
      at: now,
      duration: playback.durationMs > 0 ? playback.durationMs / 1000 : playback.track.durationMs / 1000,
      volume: playback.volume,
      shuffle: playback.shuffle,
      repeat: playback.repeat,
      next: playback.next,
      direction,
    },
  })
}

// --- The preview's own playing (a plain browser: no host) ----------------------------------------------------

let previewQueue: NeteaseTrack[] = []
let previewIndex = 0
let previewFrom = ''
let previewContext: NeteaseContext | null = null

function startPreview(tracks: NeteaseTrack[], index: number, from: string, context: NeteaseContext | null): void {
  const track = tracks[index]
  if (!track) return
  const was = useNetease.getState().playback
  const before = previewIndex
  previewQueue = tracks
  previewIndex = index
  previewFrom = from
  previewContext = context
  useNetease.setState({
    playback: {
      track,
      context,
      playing: true,
      loading: false,
      position: 0,
      at: performance.now(),
      duration: track.durationMs > 0 ? track.durationMs / 1000 : 200,
      volume: was?.volume ?? 0.8,
      shuffle: was?.shuffle ?? false,
      repeat: was?.repeat ?? 'off',
      next: tracks.slice(index + 1, index + 6),
      direction: index < before ? -1 : 1,
    },
  })
}

function previewSkip(direction: 1 | -1): void {
  const playback = useNetease.getState().playback
  if (!playback) return
  const now = performance.now()
  if (direction === -1 && positionOf(playback, now) > 3) {
    showPlayback({ position: 0, at: now })
    return
  }
  const next = previewIndex + direction
  if (next < 0) return
  if (next >= previewQueue.length) {
    if (playback.repeat === 'all') startPreview(previewQueue, 0, previewFrom, previewContext)
    else showPlayback({ playing: false, position: 0, at: now })
    return
  }
  startPreview(previewQueue, next, previewFrom, previewContext)
}

/** While the app is open in a plain browser: the preview's songs end by themselves, the next one starting. */
export function useSongsEnd(): void {
  const playing = useNetease((state) => state.playback?.playing ?? false)
  useEffect(() => {
    if (!playing || isInHost()) return
    const timer = setInterval(() => {
      const playback = useNetease.getState().playback
      if (!playback || positionOf(playback) < playback.duration) return
      if (playback.repeat === 'one') showPlayback({ position: 0, at: performance.now() })
      else previewSkip(1)
    }, 400)
    return () => clearInterval(timer)
  }, [playing])
}

// --- With the game, the Dashboard ---------------------------------------------------------------------------

/** What NetEase Cloud Music plays, as the Dashboard's Now Playing takes music, and its cover; `null` while
 * nothing does. */
export function useNeteaseSource(): { source: MediaSource; artwork: string | null } | null {
  const playback = useNetease((state) => state.playback)
  return useMemo(() => {
    if (!playback) return null
    return {
      source: {
        id: 'westplay-netease',
        service: 'netease',
        title: playback.track.name,
        artist: playback.track.artists.join(', '),
        album: playback.track.album,
        artwork: null,
        status: playback.playing ? 'playing' : 'paused',
        positionMs: playback.position * 1000,
        positionAt: Math.round(performance.timeOrigin + playback.at),
        durationMs: playback.duration * 1000,
        controls: { playPause: true, next: true, previous: true, shuffle: true, repeat: true },
        shuffle: playback.shuffle,
        repeat: playback.repeat === 'one' ? 'track' : playback.repeat === 'all' ? 'list' : 'off',
      },
      artwork: playback.track.image ?? null,
    }
  }, [playback])
}

export function playingNow(): boolean {
  return Boolean(useNetease.getState().playback?.playing)
}

/** Pauses what plays (the game paused, tabbed out of, its electrics off). */
export function pauseNow(): void {
  const playback = useNetease.getState().playback
  if (!playback?.playing) return
  const now = performance.now()
  if (isInHost()) {
    netease({ action: 'pause' })
    stopExpecting()
  }
  showPlayback({ playing: false, position: positionOf(playback, now), at: now })
}

/** Plays on what was paused (back in the game). */
export function resumeNow(): void {
  const playback = useNetease.getState().playback
  if (!playback || playback.playing) return
  if (isInHost()) netease({ action: 'resume' })
  showPlayback({ playing: true, at: performance.now() })
}

/** The time (`performance.now()`), again every quarter second while `running`: for a song's time. */
export function useNow(running: boolean): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [running])
  return now
}

/** While the app is open: NetEase Cloud Music's web player runs (hidden, under the page), saying whether it's
 * signed in and what plays. */
export function useWebPlayer(): void {
  useEffect(() => {
    if (!isInHost()) return
    netease({ action: 'start' })
  }, [])
}
