// WestPlay, in NetEase Cloud Music's web player (netease.rs): NetEase's own page, run hidden under the cab. The
// NetEase Cloud Music app the player sees is WestPlay's own; this reads the page's player bar and its media
// session, plays through the page's own buttons and player, and answers its questions from NetEase's own API,
// as the page itself asks it:
//
// - What plays is the page's: its player bar (`#g_player`, in this top frame) says the song, its artists, its
//   cover and its time; the page's own `<audio>` element is found and followed (`findPlayback`), and the OS's
//   media session (`navigator.mediaSession.metadata`) says the same once the page has set it.
// - Playing is the page's own: a play goes to the page's own route (`#/song?id=…`, `#/playlist?id=…`, loaded
//   into `#g_iframe`) and presses the page's own Play; pause, resume, next, previous are its player bar's
//   buttons; seeking and the volume are its media element's, so its queue and its own bookkeeping stay the
//   page's.
// - Questions (Home, a search, a playlist's or an album's page, a song's words) are asked of the same-origin
//   API the page itself asks (`/api/...`), signed by the page's own cookies.
//
// Nothing of the account leaves the page: only whether it's signed in, and what the app shows (names, covers,
// what plays). The page comes in two versions, the old web player and the new one NetEase put out in November
// 2025, with no DOM in common: this script is written for the old one (`#g_player`); on the new one it still
// says whether the account is signed in and answers questions, and nothing else (TODO(verify)).
;(() => {
  if (location.hostname !== 'music.163.com' || window.top !== window) return
  const post = (message) => window.chrome?.webview?.postMessage(message)
  const pageFetch = window.fetch.bind(window)
  const stringify = JSON.stringify
  const parse = JSON.parse
  const NUMBER = /^\d+$/

  // NetEase's old web player runs its sound through Web Audio (its effects). In the hidden WebView a context
  // may start asleep and no tap comes to wake it: every one made while this script runs is woken as it is made.
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Original = window[name]
    if (typeof Original !== 'function') continue
    const Wake = function (...args) {
      const context = new Original(...args)
      context.resume?.().catch(() => {})
      return context
    }
    Wake.prototype = Original.prototype
    window[name] = Wake
  }

  const appears = (find, wait = 8000) =>
    new Promise((resolve) => {
      const started = Date.now()
      const look = () => {
        const found = find()
        if (found || Date.now() - started > wait) resolve(found ?? null)
        else setTimeout(look, 150)
      }
      look()
    })
  const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const first = (parent, selector) => parent?.querySelector(selector) ?? null
  const all = (parent, selector) => [...(parent?.querySelectorAll(selector) ?? [])]
  const must = (found) => {
    if (!found) throw new Error('not on the page')
    return found
  }

  // --- The page's player bar -----------------------------------------------------------------------------------
  //
  // TODO(verify): the old web player's player bar, at the bottom of this frame: `#g_player`; the play/pause
  // button `.btns a.ply` while it's paused and `.pas` while it plays (the page swaps them); previous and next
  // `.btns a.prv` and `.btns a.nxt`; the song's name and its artists in `.words` (`.name`, `.by a[href*=
  // "/artist?id=…"]`), its cover in `.head img`, its time in `.time` (played in its `em`). The new web player has
  // none of these.
  const BAR = '#g_player'
  const bar = () => document.querySelector(BAR)
  const old = () => Boolean(bar())

  const playButton = () => first(bar(), '.btns a.ply, .btns a.pas') ?? first(bar(), '[data-action="play"]')
  // TODO(verify): `pas` in the play button's classes means it's playing (the button then pauses it).
  const pageIsPlaying = () => {
    const button = playButton()
    if (button) return button.classList.contains('pas')
    return navigator.mediaSession?.playbackState === 'playing' ? true : null
  }

  const songId = () => {
    const link = first(bar(), 'a[href*="/song?id="]')
    return /\/song\?id=(\d+)/.exec(link?.getAttribute('href') ?? '')?.[1] ?? null
  }
  const cover = () => {
    // TODO(verify): `.head img`; the page may keep its own placeholder for a song without a cover.
    const url = first(bar(), '.head img')?.getAttribute('src') ?? null
    return https(url)
  }
  const artists = () => {
    const words = first(bar(), '.words')
    const links = all(words, 'a[href*="/artist?id="]').map((link) => text(link)).filter(Boolean)
    if (links.length) return links
    // TODO(verify): a song's artists as one line in `.by` ("Tarkan / X"), when it isn't links.
    return text(first(words, '.by'))
      .replace(/^[-–—\s]+/, '')
      .split(/\s*\/\s*/)
      .filter(Boolean)
  }
  // TODO(verify): the bar's time (`.time`, the played time in its `<em>`, the length after the `/`): a fallback
  // until the page's media element is found (its own `currentTime`/`duration` are preferred).
  const barTimes = () => {
    const found = [...text(first(bar(), '.time')).matchAll(/(\d{1,3}):(\d{2})/g)].map(
      ([, minute, second]) => Number(minute) * 60 + Number(second),
    )
    if (found.length >= 2) return { played: found[0], total: found[1] }
    return found.length === 1 ? { played: found[0], total: 0 } : null
  }

  // --- The page's own sound element -----------------------------------------------------------------------------
  //
  // The old web player makes its own media element (it isn't in the player bar), and sometimes a muted video
  // beside the song (an ad, a visualiser): every element the page touches is kept, in this frame and in the
  // same-origin frames its pages load in, and the one playing now is the one heard. Never a muted one (as
  // spotify.js does): taken, the truck's speakers play its silence (a player's PC, 2026-10-26: NetEase played,
  // silent, two elements, the taken one a playing video).
  const KNOWN = new Set()
  let sounding = null
  const keep = (element) => {
    // A frame's own HTMLMediaElement isn't this frame's instance: the shape is checked, not the class.
    if (!element || !('paused' in element) || !('muted' in element)) return
    if (!element.muted) sounding = element
    KNOWN.add(element)
  }
  // An element with nothing loaded is no playback (the page's player calls play() before its song's address
  // comes, or when it never does: the app mustn't run its time on for that).
  const usable = (element) => !element.paused && !element.ended && (element.readyState > 0 || element.currentTime > 0)
  const playingNow = () =>
    [...KNOWN].find((element) => !element.paused && !element.ended && !element.muted && usable(element)) ?? null
  const MEDIA_EVENTS = ['loadedmetadata', 'canplay', 'playing', 'pause', 'waiting', 'stalled']
  const watched = new WeakSet()
  const watch = (win) => {
    try {
      if (!win || watched.has(win)) return
      watched.add(win)
      const prototype = win.HTMLMediaElement?.prototype
      if (!prototype) return
      const play = prototype.play
      prototype.play = function (...args) {
        keep(this)
        return play.apply(this, args)
      }
      for (const name of MEDIA_EVENTS) win.document.addEventListener(name, (event) => keep(event.target), true)
      win.addEventListener('playing', (event) => keep(event.target), true)
    } catch {
      // A frame not ours to touch.
    }
  }
  const watchFrames = () => {
    watch(window)
    for (const element of document.querySelectorAll('iframe')) {
      try {
        watch(element.contentWindow)
      } catch {
        // Another origin.
      }
    }
  }
  watchFrames()
  setInterval(watchFrames, 2000)
  // TODO(verify): where the page's element is, should it not have been touched yet (`#g_player audio`, a
  // detached element the page made): the first <audio> of this frame or of its same-origin frames.
  const inThePage = () => {
    const frames = [window, ...[...document.querySelectorAll('iframe')].map((frame) => frame.contentWindow)]
    for (const win of frames) {
      try {
        const found = win?.document?.querySelector('#g_player audio, #g_player video, audio')
        if (found) return found
      } catch {
        // Another origin.
      }
    }
    return null
  }
  const findPlayback = () => playingNow() ?? sounding ?? inThePage()
  const playing = () =>
    directTrack ? Boolean(directElement && !directElement.paused && !directElement.ended) : playingNow() !== null || (pageIsPlaying() ?? false)
  // What the truck's speakers should play: an element of this document (a page's own graph across documents may
  // play its silence), the playing ones in turn; no such element, nothing is taken (the page's own sound stays).
  let chosen = 0
  let unmuted = ''
  const mediaToPlay = () => {
    // Our own element: through the truck's speakers only when its CDN lets the page's audio be captured (CORS:
    // music.126.net answers `Access-Control-Allow-Origin: *`). Otherwise it plays as the page's own sound.
    if (directTrack) return directCors ? directElement : null
    const here = [...KNOWN].filter((element) => element.ownerDocument === document && usable(element))
    const sounding = here.filter((element) => !element.muted)
    if (sounding.length > 0) return sounding[chosen % sounding.length]
    const muted = here.filter((element) => element.muted)
    if (muted.length === 0) return null
    // The page's own autoplay fallback leaves its music muted, waiting for a tap a scripted player never gets.
    // Unmuted here, it's heard through the truck's speakers as any page's sound (a player's PC, 2026-10-26:
    // nothing but a muted video playing, an empty audio element beside it).
    const element = muted[chosen % muted.length]
    unmuted = `${element.tagName.toLowerCase()} ${Math.round(element.currentTime)}s`
    element.muted = false
    return element
  }
  const seconds = (value) => {
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? number : 0
  }
  const played = () => {
    if (directTrack) return directElement ? seconds(directElement.currentTime) : 0
    const element = findPlayback()
    return element ? seconds(element.currentTime) : (barTimes()?.played ?? 0)
  }
  const length = () => {
    if (directTrack) {
      const duration = seconds(directElement?.duration)
      return duration > 0 ? duration : (directTrack.durationMs ?? 0) / 1000
    }
    const element = findPlayback()
    const duration = seconds(element?.duration)
    return duration > 0 ? duration : (barTimes()?.total ?? 0)
  }
  const volume = () => {
    if (directTrack) return directElement ? Math.min(1, Math.max(0, directElement.volume)) : null
    const element = findPlayback()
    if (!element || typeof element.volume !== 'number') return null
    return element.muted ? 0 : Math.min(1, Math.max(0, element.volume))
  }

  // --- What plays -------------------------------------------------------------------------------------------------
  const https = (url) => {
    const found = typeof url === 'string' ? url.replace(/^http:\/\//, 'https://') : null
    return found?.startsWith('https://') ? found : null
  }
  const metadata = () => navigator.mediaSession?.metadata ?? null

  // TODO(verify): a song's own id in the player bar's link (`a[href*="/song?id=…"]`); a song the bar doesn't
  // link (still loading, an ad) has none and nothing of it is shown.
  const pageTrack = () => {
    const id = songId()
    const found = first(bar(), '.words')
    const meta = metadata()
    const name = text(first(found, 'a.name, .name')) || text(meta?.title)
    if (!id || !name) return null
    const names = artists()
    return {
      id,
      name,
      artists: names.length ? names : [text(meta?.artist)].filter(Boolean),
      album: text(meta?.album),
      image: cover() ?? https(meta?.artwork?.at(-1)?.src),
      durationMs: Math.round(length() * 1000),
    }
  }

  const track = () => directTrack ?? pageTrack()

  // TODO(verify): where the page plays from, off its own address (`#/playlist?id=…`, `#/album?id=…`; the old
  // web player's route); a song's page plays from itself, said as none. Its name and the queue around it the
  // page's bar doesn't say.
  const context = () => {
    if (directTrack) return directContext()
    const found = /#\/(playlist|album|artist)\?id=(\d+)/.exec(location.hash ?? '')
    if (!found) return null
    const kind = { playlist: 'playlist', album: 'album', artist: 'artist' }[found[1]]
    return kind ? { id: found[2], name: '', kind } : null
  }

  // The options: the page's own (its loop and shuffle buttons), as last asked for here: the old player bar's
  // buttons cycle, they don't say which one it is (TODO(verify)).
  let shuffle = null
  let repeat = null
  let volumeWanted = null

  const playback = () => {
    const song = track()
    if (!song) return null
    return {
      track: song,
      context: context(),
      playing: playing(),
      positionMs: Math.round(played() * 1000),
      durationMs: Math.round(length() * 1000),
      volume: volume(),
      shuffle: Boolean(shuffle),
      repeat: repeat ?? 'off',
      // The songs to come: our own list's, when we play it; the page's queue the bar doesn't say (none).
      next: directList?.tracks ? directList.tracks.slice(directAt + 1, directAt + 7) : [],
    }
  }

  // Said when what the app shows of it changes, and when the time jumps (a seek, or another song's start): the
  // app runs the time on by itself while it plays.
  let toldPlayback = ''
  let lastPosition = 0
  let lastAt = performance.now()
  const tellPlayback = () => {
    const now = playback()
    const at = performance.now()
    if (!now) {
      if (toldPlayback !== 'null') {
        toldPlayback = 'null'
        post({ playback: null })
      }
      lastPosition = 0
      lastAt = at
      return
    }
    const expected = lastPosition + (now.playing ? at - lastAt : 0)
    const jumped = Math.abs(now.positionMs - expected) > 1500
    const shape = stringify({ ...now, positionMs: 0 })
    if (jumped || shape !== toldPlayback) {
      toldPlayback = shape
      post({ playback: now })
    }
    lastPosition = now.positionMs
    lastAt = at
  }

  // --- The account ----------------------------------------------------------------------------------------------
  //
  // TODO(verify): the page's own account, signed by its cookies: `/api/nuser/account/get` says `{account: null}`
  // signed out and the account's profile signed in. Never anything of it but whether it's signed in.
  let signedIn = null
  // The account's membership, as its own profile says it (vipType 0: none, 10/11: black vinyl): what NetEase
  // lets it hear, and what the app says of it.
  let vipType = 0
  let vip = null
  const account = async () => {
    try {
      // TODO(verify): the request the page itself makes (`/api/nuser/account/get`), and its `credentials`.
      const response = await pageFetch('/api/nuser/account/get', { credentials: 'same-origin' })
      if (!response.ok) return
      const json = await response.json()
      signedIn = Boolean(json?.account)
      const profile = json?.profile ?? null
      vipType = Number(profile?.vipType ?? 0) || 0
      vip = signedIn ? (vipType >= 10 ? '黑胶VIP' : vipType > 0 ? 'VIP' : '非VIP') : null
    } catch {
      // Not this turn: said next time.
    }
  }
  let toldState = ''
  const tellState = (always = false) => {
    if (signedIn === null) return
    const state = { signedIn, playing: playing(), vip }
    const said = stringify(state)
    if (said === toldState && !always) return
    toldState = said
    // `netease.js`'s own shape: the state under `state` (netease.rs reads the players' own flat shape too).
    post({ state: parse(said) })
  }

  // --- Its answers, cut down to what the app shows --------------------------------------------------------------
  //
  // TODO(verify): NetEase's own API, as the page itself asks it, signed by the page's cookies: the addresses,
  // the parameters and the fields below change with the page; the shapes here are the ones its old web player
  // uses (`/api/search/get`, `/api/v6/playlist/detail`, `/api/song/detail`, `/api/song/lyric`). The page's
  // content is in `#g_iframe` (a frame of its own, the same origin): not read here.
  const artistNames = (list) => (list ?? []).map((artist) => artist?.name).filter(Boolean)
  const albumOf = (song) => song?.album ?? song?.al ?? {}
  const artistsOf = (song) => artistNames(song?.artists ?? song?.ar)
  const durationMs = (song) => {
    // The page's API gives a song's length in milliseconds (`duration`, or the new `dt`).
    const found = Number(song?.duration ?? song?.dt)
    return Number.isFinite(found) && found > 0 ? Math.round(found) : 0
  }
  const trackOf = (song) => {
    if (!song?.id) return null
    const album = albumOf(song)
    const songArtists = artistsOf(song)
    return {
      id: String(song.id),
      name: String(song.name ?? ''),
      artists: songArtists,
      album: String(album?.name ?? ''),
      image: https(album?.picUrl ?? song?.picUrl),
      durationMs: durationMs(song),
    }
  }
  const playlistOf = (playlist) => {
    if (!playlist?.id) return null
    return {
      id: String(playlist.id),
      kind: 'playlist',
      name: String(playlist.name ?? ''),
      by: String(playlist.creator?.nickname ?? playlist.copywriter ?? ''),
      image: https(playlist.coverImgUrl ?? playlist.picUrl),
      description: typeof playlist.description === 'string' && playlist.description ? playlist.description : null,
    }
  }
  const albumOfItem = (album) => {
    if (!album?.id) return null
    return {
      id: String(album.id),
      kind: 'album',
      name: String(album.name ?? ''),
      by: String(album.artist?.name ?? artistsOf(album).join(', ')),
      image: https(album.picUrl ?? album.blurPicUrl),
      description: null,
    }
  }
  const artistOfItem = (artist) => {
    if (!artist?.id) return null
    return {
      id: String(artist.id),
      kind: 'artist',
      name: String(artist.name ?? ''),
      by: '',
      image: https(artist.img1v1Url ?? artist.picUrl),
      description: null,
    }
  }
  const tracks = (list) => (list ?? []).map(trackOf).filter(Boolean)
  const items = (list, convert) => (list ?? []).map(convert).filter(Boolean)

  const get = async (path) => {
    const response = await pageFetch(path, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`${path}: ${response.status}`)
    return await response.json()
  }
  const songDetail = async (ids) => {
    if (ids.length === 0) return []
    // TODO(verify): `/api/song/detail` with the ids as one `[1,2,3]` argument; a long list is asked in batches
    // (the address has its length).
    const songs = []
    for (let at = 0; at < ids.length; at += 100) {
      const batch = ids.slice(at, at + 100)
      const answer = await get(`/api/song/detail?ids=${encodeURIComponent(`[${batch.join(',')}]`)}`)
      songs.push(...tracks(answer?.songs))
    }
    return songs
  }

  // TODO(verify): the page's own type numbers for a search (`/api/search/get`): songs 1, albums 10, artists
  // 100, playlists 1000; and its `result` field for each.
  const search = async ({ query }) => {
    const asked = async (type) => {
      const answer = await get(
        `/api/search/get?s=${encodeURIComponent(query)}&type=${type}&offset=0&limit=20`,
      )
      return answer?.result ?? {}
    }
    const [songs, albums, artists, playlists] = await Promise.all([asked(1), asked(10), asked(100), asked(1000)])
    return {
      songs: tracks(songs?.songs),
      albums: items(albums?.albums, albumOfItem),
      artists: items(artists?.artists, artistOfItem),
      playlists: items(playlists?.playlists, playlistOf),
    }
  }

  // TODO(verify): the page's own home recommendations (`/api/personalized/playlist`, `/api/personalized/
  // newsong`), which its own Home shows; each may fail on its own (signed out, no connection) and is left out.
  const home = async () => {
    const sections = []
    const personalized = await get('/api/personalized/playlist?limit=12').catch(() => null)
    const playlists = items(personalized?.result, playlistOf)
    if (playlists.length) sections.push({ title: '推荐歌单', items: playlists })
    const newsong = await get('/api/personalized/newsong?limit=12').catch(() => null)
    const songs = tracks((newsong?.result ?? []).map((entry) => entry?.song ?? entry))
    if (songs.length) {
      sections.push({
        title: '推荐新音乐',
        items: songs.map((song) => ({
          id: song.id,
          kind: 'song',
          name: song.name,
          by: (song.artists ?? []).join(', '),
          image: song.image ?? null,
          description: null,
        })),
      })
    }
    return { sections }
  }

  // The account's own playlists (`/api/user/playlist`, after the page's own account): signed in, the lists
  // NetEase's own app shows under My music, the liked-songs list among them; signed out, none (the app shows
  // its sign-in pitch instead).
  const library = async () => {
    const account = await get('/api/nuser/account/get').catch(() => null)
    const profile = account?.profile ?? account?.account ?? null
    const uid = profile?.userId ?? profile?.id
    if (!uid) throw new Error('not signed in')
    const answer = await get(`/api/user/playlist?uid=${uid}&limit=100&offset=0`)
    const playlists = items(answer?.playlist ?? answer?.more, playlistOf)
    return { sections: [{ title: '\u6211\u7684\u6b4c\u5355', items: playlists }] }
  }

  // TODO(verify): a playlist's or an album's page: `/api/v6/playlist/detail` (its `trackIds`; the full songs
  // from `/api/song/detail`) and `/api/album/<id>` (its `songs`). The id alone doesn't say which it is, so a
  // playlist is tried first and an album then.
  const collection = async ({ id }) => {
    const playlist = await get(`/api/v6/playlist/detail?id=${id}&n=0&s=0`).catch(() => null)
    if (playlist?.playlist?.id) {
      const found = playlist.playlist
      const ids = (found.trackIds ?? [])
        .map((entry) => String(entry?.id ?? ''))
        .filter((each) => NUMBER.test(each))
        // A playlist may be thousands of songs long: the app shows a few pages' worth.
        .slice(0, 500)
      return { item: playlistOf(found), tracks: await songDetail(ids) }
    }
    const album = await get(`/api/album/${id}`).catch(() => null)
    if (album?.album?.id) {
      return { item: albumOfItem(album.album), tracks: tracks(album.songs) }
    }
    throw new Error('not a page the app shows')
  }

  // A song's words: its timed lines (`[mm:ss.xxx]words`), line by line with when each is sung; none for a song
  // without words. The page's own provider is NetEase's: not named.
  const lyrics = async ({ song }) => {
    // TODO(verify): `/api/song/lyric` and its `lv`/`kv`/`tv` parameters; its `lrc.lyric`.
    const answer = await get(`/api/song/lyric?id=${song}&lv=1&kv=1&tv=-1`)
    const text = String(answer?.lrc?.lyric ?? '')
    const LRC = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
    const lines = []
    for (const row of text.split('\n')) {
      const words = row.replace(LRC, '').trim()
      for (const found of row.matchAll(LRC)) {
        const fraction = found[3] ? Number(`0.${found[3].padEnd(3, '0')}`) : 0
        lines.push({ start: Number(found[1]) * 60 + Number(found[2]) + fraction, end: 0, text: words })
      }
    }
    lines.sort((a, b) => a.start - b.start)
    if (lines.length === 0) return { synced: false, lines: [] }
    // TODO(verify): the page's translation lines (`tlyric`) and which language it is; not shown for now.
    return { synced: true, lines, provider: '' }
  }

  const QUESTIONS = { home, search, lyrics, library, collection }
  // An answer, asked of NetEase again once should it fail (a moment's trouble: a dropped connection); failed
  // only then. `netease.js`'s own shape: the payload under `answer`, its id with it.
  const answer = async (id, question) => {
    const asked = QUESTIONS[question?.ask]
    if (!asked) {
      post({ answer: { id, failed: true } })
      return
    }
    for (const wait of [0, 600]) {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
      try {
        post({ answer: { id, [question.ask]: await asked(question) } })
        return
      } catch {
        // Once more, or failed.
      }
    }
    post({ answer: { id, failed: true } })
  }

  // --- Playing ----------------------------------------------------------------------------------------------------
  //
  // TODO(verify): the page's own routes (`#/song?id=…`, `#/playlist?id=…`), which the page loads into
  // `#g_iframe` by itself: a play goes there and presses the page's own Play (all of a playlist's, or a song's
  // row), so its queue and its own play count stay the page's.
  const frame = () => {
    try {
      return document.querySelector('#g_iframe')?.contentDocument ?? null
    } catch {
      return null
    }
  }
  const goto = (hash) => {
    if (location.hash !== hash) location.hash = hash
  }
  const press = (element) => must(element).click()
  const playOnPage = async (song, playlist) => {
    if (playlist) {
      goto(`#/playlist?id=${playlist}`)
      // TODO(verify): the playlist page's own Play (`.u-btni-play`), in the content frame once its page loaded.
      const button = await appears(() => first(frame(), '.u-btni-play, [data-action="play"]'), 8000)
      if (!button) throw new Error('no play button')
      if (!song) return button.click()
      const row = await appears(() => first(frame(), `a[href*="/song?id=${song}"]`), 8000)
      // TODO(verify): a song's row in a playlist's page: its own Play, beside its name.
      return press(first(row?.closest('tr, .item, li'), '.ply, [data-action="play"]') ?? button)
    }
    goto(`#/song?id=${song}`)
    // TODO(verify): a song's page's own Play (`[data-action="play"]`, `.u-btni-play`), once the frame loaded.
    const button = await appears(() => first(frame(), '[data-action="play"], .u-btni-play'), 8000)
    press(button)
  }

  const toggle = () => {
    const button = playButton()
    if (button) return button.click()
    const element = findPlayback()
    if (!element) throw new Error('no player')
    return element.paused ? element.play() : element.pause()
  }

  // --- Playing it ourselves ----------------------------------------------------------------------------------------
  //
  // The old page's player can't be trusted for sound: on a player's PC (2026-10-26) its audio element was never
  // loaded while a muted video played, and a scripted click is no tap for its autoplay fallback. So a song asked
  // for is fetched as the page's own player would (`/api/song/enhance/player/url`, signed by its cookies) and
  // played unmuted in an element of this script's: the WebView plays it (no Web Audio: another origin through it
  // would be CORS-silent), the cabin shows it, and the page's own player is left alone.
  let directTrack = null
  let directElement = null
  let directCors = false
  let directList = null
  let directAt = 0
  let directStepping = false
  const directContext = () => (directList ? { id: directList.playlist, name: '', kind: 'playlist' } : null)
  // A song's address, as the page's player asks it: the best the account's membership allows (a VIP's lossless,
  // anyone's 320k), from the old address API and, failing that, the newer one. Null: NetEase has none to give.
  const directUrl = async (song) => {
    const br = vipType > 0 ? 999000 : 320000
    const old = await get(`/api/song/enhance/player/url?id=${song}&ids=[${song}]&br=${br}`).catch(() => null)
    let url = old?.data?.[0]?.url
    if (typeof url !== 'string' || !url) {
      const level = vipType >= 10 ? 'lossless' : 'exhigh'
      const newer = await get(`/api/song/enhance/player/url/v1?ids=[${song}]&level=${level}&encodeType=aac`).catch(() => null)
      url = newer?.data?.[0]?.url
    }
    if (typeof url !== 'string' || !url) return null
    const https = url.replace(/^http:/, 'https:')
    return https.startsWith('https://') ? https : null
  }
  // Whether the truck's speakers can take an audio address's sound: the CDN has to let the page's Web Audio
  // capture it (CORS), asked once per host. NetEase's own CDNs do; another may not, and then the sound stays the
  // page's own (direct output, no cab's 3D sound).
  const captureHosts = new Map()
  const canCapture = async (url) => {
    try {
      const origin = new URL(url).origin
      if (captureHosts.has(origin)) return captureHosts.get(origin)
      let ok = false
      try {
        // A HEAD: a simple request (no preflight), whose CORS headers say whether the page can capture it.
        const response = await pageFetch(url, { method: 'HEAD' })
        ok = response.ok && response.headers.get('access-control-allow-origin') !== null
      } catch {
        ok = false
      }
      captureHosts.set(origin, ok)
      return ok
    } catch {
      return false
    }
  }
  const directSong = async (song, playlist) => {
    const url = await directUrl(song)
    if (!url) return false
    const capture = await canCapture(url)
    const detail = await get(`/api/song/detail?ids=[${song}]`).catch(() => null)
    const item = detail?.songs?.[0]
    if (!item) return false
    if (directElement && capture !== directCors) {
      // The other way of playing (through the cab's Web Audio, or not): a fresh element, as an element is taken
      // into a Web Audio graph once.
      directElement.pause()
      directElement.remove()
      directElement = null
    }
    directCors = capture
    if (!directElement) {
      directElement = document.createElement('audio')
      directElement.preload = 'auto'
      directElement.crossOrigin = capture ? 'anonymous' : null
      document.documentElement.appendChild(directElement)
      for (const name of ['play', 'pause', 'seeked', 'loadedmetadata', 'timeupdate'])
        directElement.addEventListener(name, () => {
          tellPlayback()
          tellState(true)
        })
      directElement.addEventListener('ended', () => {
        void directEnded()
      })
    }
    // The page's own player heard but not played over ours: the sound is one, this one.
    const page = findPlayback()
    if (page && !page.paused) page.pause()
    directTrack = trackOf(item)
    directList = playlist ? { playlist: String(playlist), tracks: null } : null
    directAt = 0
    directElement.volume = volumeWanted ?? 0.8
    directElement.src = url
    await directElement.play().catch(() => {})
    tellPlayback()
    tellState(true)
    return true
  }
  // A list's songs, in the order they play from the one playing: the list's own way, shuffled or kept, round
  // at its end when it repeats.
  const directOrder = (by) => {
    const tracks = directList?.tracks
    if (!tracks?.length) return []
    if (shuffle) {
      const order = [...Array(tracks.length).keys()].filter((at) => at !== directAt)
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      return order
    }
    const order = []
    for (let step = 1; step <= tracks.length; step++) {
      const at = directAt + by * step
      if (at >= 0 && at < tracks.length) order.push(at)
      else if (repeat === 'all') order.push(((at % tracks.length) + tracks.length) % tracks.length)
    }
    return [...new Set(order)]
  }
  // The next song that can be had: an unplayable one (VIP, region, gone) is left out, the one after tried.
  const directStep = async (by) => {
    if (!directTrack) return false
    const list = directList
    if (!list?.tracks) {
      if (by === -1 && directElement) {
        directElement.currentTime = 0
        return true
      }
      return false
    }
    if (directStepping) return false
    directStepping = true
    try {
      for (const at of directOrder(by)) {
        if (await directSong(list.tracks[at].id, list.playlist)) {
          directList = { playlist: list.playlist, tracks: list.tracks }
          directAt = at
          tellPlayback()
          tellState(true)
          return true
        }
      }
      return false
    } finally {
      directStepping = false
    }
  }
  const directPlayFrom = async (tracks, at, playlist) => {
    for (let index = at; index < tracks.length; index++) {
      if (await directSong(tracks[index].id, playlist)) {
        directList = { playlist: String(playlist), tracks }
        directAt = index
        tellPlayback()
        tellState(true)
        return true
      }
    }
    return false
  }
  const directPlaylist = async (playlist) => {
    const found = await collection({ id: playlist }).catch(() => null)
    if (!found?.tracks?.length) return false
    return directPlayFrom(found.tracks, 0, playlist)
  }
  // Its end: the next one (or the same, repeating one; or round the list).
  const directEnded = async () => {
    if (!directTrack || directStepping) return
    if (repeat === 'one') {
      if (directElement) {
        directElement.currentTime = 0
        await directElement.play().catch(() => {})
      }
      tellPlayback()
      tellState(true)
      return
    }
    const stepped = await directStep(1)
    if (!stepped) {
      tellPlayback()
      tellState(true)
    }
  }

  // TODO(verify): the old player bar's own loop and shuffle controls: the loop button (`.icn-loop`, cycling
  // one/all/off by its title) and the shuffle one (`.icn-shuffle`, `[data-action="shuffle"]`); the page's own
  // icons change with it.
  const nextButton = () => first(bar(), '.btns a.nxt, [data-action="next"]')
  const previousButton = () => first(bar(), '.btns a.prv, [data-action="previous"]')
  const shuffleButton = () => first(bar(), '[data-action="shuffle"], .icn-shuffle, .rdi')
  const loopButton = () => first(bar(), '.icn-loop, [data-action="repeat"]')

  const CONTROLS = {
    play: ({ song, playlist }) => {
      // Only our own player: the page's has played nothing on a player's PC while saying it did.
      if (song) return directSong(song, playlist)
      if (playlist) return directPlaylist(playlist)
      return playing() ? undefined : directTrack ? directElement?.play() : toggle()
    },
    pause: () => {
      if (directTrack) {
        directElement?.pause()
        tellPlayback()
        tellState(true)
        return
      }
      if (playing()) toggle()
    },
    resume: () => {
      if (directTrack) {
        directElement?.play().catch(() => {})
        tellPlayback()
        tellState(true)
        return
      }
      if (!playing()) toggle()
    },
    next: () => (directTrack ? directStep(1) : press(nextButton())),
    previous: () => (directTrack ? directStep(-1) : press(previousButton())),
    seek: ({ seconds: at }) => {
      if (directTrack) {
        if (directElement) directElement.currentTime = Math.max(0, Number(at) || 0)
        tellPlayback()
        return
      }
      const element = findPlayback()
      if (!element) throw new Error('no media element')
      element.currentTime = Math.max(0, Number(at) || 0)
      tellPlayback()
    },
    // The page's own volume, kept over the cab's: its next song may put its own back (TODO(verify) whether it
    // does), so the cab's is put back as it changes.
    volume: ({ percent }) => {
      volumeWanted = Math.min(1, Math.max(0, Number(percent) / 100))
      if (directTrack) {
        if (directElement) directElement.volume = volumeWanted
        tellPlayback()
        return
      }
      const element = findPlayback()
      if (element) element.volume = volumeWanted
      tellPlayback()
    },
    shuffle: ({ on }) => {
      if (!directTrack) {
        const button = shuffleButton()
        if (button && shuffle !== null && shuffle !== Boolean(on)) button.click()
      }
      shuffle = Boolean(on)
      tellPlayback()
    },
    repeat: ({ mode }) => {
      if (!directTrack) {
        const button = loopButton()
        // The loop button cycles off -> all -> one -> off; pressed until the mode asked for (at most three).
        for (let tries = 0; button && repeat !== null && repeat !== mode && tries < 3; tries++) button.click()
      }
      repeat = mode
      tellPlayback()
    },
  }

  // --- The truck's speakers ---------------------------------------------------------------------------------------
  //
  // The page's sound through the truck's own speakers (cab_sound.js, loaded first), told the speakers, the head
  // and the camera by the host; what the speakers made of it said for the host's log, once each way.
  const cab = window.westplayCabSound?.(() => mediaToPlay(), post)
  let saidCab = ''
  let quietSince = null
  let debugAt = 0
  // The elements as the debug line says them: which one is taken, where it is, and what it is doing.
  const detail = (element) => ({
    tag: element?.tagName?.toLowerCase() ?? null,
    here: element ? element.ownerDocument === document : null,
    muted: element?.muted ?? null,
    volume: Math.round((element?.volume ?? 0) * 100) / 100,
    paused: element?.paused ?? null,
    ready: element?.readyState ?? null,
    at: Math.round(element?.currentTime ?? 0),
    length: Math.round(element?.duration ?? 0),
    source: element?.srcObject?.constructor?.name ?? null,
    parent: element?.parentElement
      ? `${element.parentElement.tagName.toLowerCase()}#${element.parentElement.id}.${String(element.parentElement.className).split(' ')[0]}`
      : null,
    src: String(element?.currentSrc || element?.src || '').replace(/^https?:\/\//, '').slice(0, 70),
  })
  const debug = (why) => {
    if (Date.now() - debugAt < 4000) return
    debugAt = Date.now()
    post({
      debug: `${why} unmuted=${unmuted || '-'} bar=${pageIsPlaying()} ${stringify(barTimes() ?? null)} hash=${location.hash} track=${track()?.id ?? '?'} ctx=${cab?.state?.() ?? '?'} level=${stringify(cab?.level() ?? null)} sound=${stringify(detail(mediaToPlay()))} known=${stringify([...KNOWN].map(detail))}`,
    })
  }
  const tellCab = () => {
    const isPlaying = playing()
    const found = mediaToPlay() ?? findPlayback()
    const levels = cab?.level()
    const heard = Array.isArray(levels) && levels.slice(0, 2).some((ear) => ear > 0.0005)
    quietSince = isPlaying && levels && !heard ? (quietSince ?? Date.now()) : null
    if (quietSince && Date.now() - quietSince > 4000) {
      debug('silent')
      if (KNOWN.size > 1 && Date.now() - quietSince > 8000) {
        chosen += 1
        debug('next')
      }
    }
    const now =
      quietSince && Date.now() - quietSince > 4000
        ? `silent while playing (${KNOWN.size} elements, taken one ${found?.muted ? 'muted' : found?.paused ? 'paused' : 'playing'})`
        : levels
          ? `through the speakers (${found?.tagName?.toLowerCase() ?? 'media'})`
          : isPlaying && !found
            ? 'no media element found'
            : ''
    if (now && now !== saidCab) post({ speakers: (saidCab = now) })
  }
  if (cab) {
    setInterval(() => {
      cab.tick()
      tellCab()
    }, 250)
  }
  // How loud it is through the speakers, each ear (and the limiter's cut), for the live test (netease.rs).
  window.westplaySpeakerLevel = () => cab?.level() ?? null
  const CAB = {
    speakers: (data) => cab?.speakers(data.speakers),
    head: (data) => cab?.head(data),
    outside: (data) => cab?.outside(data.on, data.distance),
    equalizer: (data) => cab?.equalizer(data),
    spectrum: (data) => cab?.spectrum(data.on),
  }

  // --- The app's commands, and the page's own sign-in -------------------------------------------------------------
  window.chrome?.webview?.addEventListener('message', ({ data }) => {
    // Not the page's to answer (a control it can't find): nothing said, the app's own state just doesn't change.
    try {
      if (CAB[data?.action]) CAB[data.action](data)
      else if (data?.action === 'ask') answer(data.id, data.question)
      else Promise.resolve(CONTROLS[data?.action]?.(data)).catch(() => {})
    } catch {
      // The page's own, or nothing to press.
    }
  })

  // TODO(verify): the old page's own "登录" (its sign-in: a QR code, in a window on the desktop).
  const SIGN_IN = '#showLogin, .m-top .login, [data-action="login"]'
  addEventListener(
    'click',
    (event) => {
      if (!event.isTrusted || !event.target?.closest?.(SIGN_IN)) return
      event.preventDefault()
      event.stopPropagation()
      post({ signIn: true })
    },
    true,
  )

  // --- Its page, ready ---------------------------------------------------------------------------------------------
  //
  // TODO(verify): the page's player bar appears once its own scripts have run; on the new web player it never
  // does (nothing here is read then: the account, and the answers, still are). The page loaded anew: the host
  // is told, and tells the cab again and the questions the page missed (`netease.rs`).
  const start = async () => {
    await appears(bar, 15000)
    account()
    setInterval(account, 5000)
    post({ ready: true })
    tellState(true)
    tellPlayback()
    setInterval(() => {
      // The page's own volume put back over the cab's (TODO(verify): it may be set when a song starts).
      const element = findPlayback()
      const kept = volumeWanted !== null && element && Math.abs(element.volume - volumeWanted) > 0.01
      if (kept) element.volume = volumeWanted
      tellState()
      tellPlayback()
    }, 500)
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start)
  else start()
})()
