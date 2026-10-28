// WestPlay, in Bilibili's own page (bilibili.rs): www.bilibili.com run hidden, its own login (a QR code in a
// window on the PC) kept in this profile's cookies. This script asks Bilibili's own API with them (the page's
// fetch may read it: checked 2026-10-28), shows a video's audio through an element of its own, and answers the
// music app's questions in the shapes the NetEase service uses (a video is a "song": its bvid is its id).
//
// The video's picture is not shown (v1: sound only). Its audio's CDN (mcdn.bilivideo.cn) has no CORS, so the
// page fetches the audio's bytes itself (this profile's browser has CORS off) and plays them from a blob: the
// truck's speakers (cab_sound.js) take the sound through Web Audio, as the other services'.
;;(() => {
  if (location.hostname !== 'www.bilibili.com' || window.top !== window) return
  const post = (message) => window.chrome?.webview?.postMessage(message)
  const pageFetch = window.fetch.bind(window)
  const stringify = JSON.stringify

  const text = (value) => (value == null ? '' : String(value)).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  const cut = (value, most) => text(value).slice(0, most)
  const https = (url) => {
    const found = typeof url === 'string' ? url.replace(/^\/\//, 'https://').replace(/^http:\/\//, 'https://') : null
    return found?.startsWith('https://') ? found : null
  }
  const isId = (id) => typeof id === 'string' && id.length >= 1 && id.length <= 40 && /^[A-Za-z0-9]+$/.test(id)
  const cookie = (name) => {
    const found = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    if (!found) return ''
    try {
      return decodeURIComponent(found[1])
    } catch {
      return found[1]
    }
  }
  const api = async (path) => {
    const response = await pageFetch(`https://api.bilibili.com${path}`, {
      credentials: 'include',
      headers: { Referer: 'https://www.bilibili.com/' },
    })
    if (!response.ok) throw new Error(`${path} ${response.status}`)
    const answer = await response.json()
    if (answer?.code !== 0) throw new Error(`${path} code ${answer?.code}`)
    return answer
  }
  const debug = (what) => post({ debug: what })

  // --- The account, by its own page's nav answer ---------------------------------------------------------------
  let account = { in: false, mid: '', nick: '', avatar: null, vip: null }
  let accountAt = 0
  const signedIn = () => account.in || Boolean(cookie('SESSDATA'))
  const vip = () => account.vip
  const refreshAccount = async () => {
    if (Date.now() - accountAt < 10_000) return
    accountAt = Date.now()
    try {
      const answer = await api('/x/web-interface/nav')
      const data = answer?.data ?? {}
      const was = account.in
      account = {
        in: Boolean(data.isLogin),
        mid: String(data.mid ?? cookie('DedeUserID') ?? ''),
        nick: text(data.uname),
        avatar: https(data.face),
        vip: data.isLogin ? (Number(data.vipStatus ?? data.vip_type ?? 0) > 0 ? '大会员' : '非大会员') : null,
      }
      if (was !== account.in) debug(`account ${account.in ? 'signed in' : 'signed out'} mid=${account.mid ? 'yes' : 'no'}`)
    } catch {
      // The nav not this turn: the cookies still say whether there is a session.
      account = { ...account, in: Boolean(cookie('SESSDATA')) }
    }
  }

  // --- Bilibili's API, cut down to the app's shapes ------------------------------------------------------------
  const durationMs = (seconds) => Math.round((Number(seconds) || 0) * 1000)
  const cover = (url) => https(url)
  const trackOf = (video) => {
    const bvid = video?.bvid ?? ''
    const name = text(video?.title)
    if (!isId(bvid) || !name) return null
    return {
      id: bvid,
      name,
      artists: [text(video?.owner?.name ?? video?.author)].filter(Boolean),
      album: text(video?.tname ?? '哔哩哔哩'),
      image: cover(video?.pic),
      durationMs: durationMs(video?.duration),
    }
  }
  const itemOf = (video) => {
    const track = trackOf(video)
    // The app's items are what it plays: a video's track is a song there (its audio).
    return track && { id: track.id, kind: 'song', name: track.name, by: track.artists.join(', '), image: track.image, description: null }
  }
  const folderOf = (folder) => {
    const id = folder?.id ?? folder?.media_id
    const name = text(folder?.title ?? folder?.name)
    if (id == null || !name) return null
    return {
      id: String(id),
      kind: 'playlist',
      name,
      by: `${Number(folder?.media_count ?? folder?.count ?? 0) || 0} 个视频`,
      image: cover(folder?.cover ?? folder?.pic),
      description: null,
    }
  }

  // Home: Bilibili's popular videos and its ranking, each video once (a video both has is in popular's).
  const home = async () => {
    const seen = new Set()
    const itemsOf = (answer) =>
      (answer?.data?.list ?? (answer?.data ?? []))
        .map(itemOf)
        .filter((item) => item && !seen.has(item.id) && seen.add(item.id))
    let popular = []
    let ranking = []
    try {
      popular = itemsOf(await api('/x/web-interface/popular?ps=20&pn=1'))
    } catch {
      // Its popular not this turn: the ranking may still be.
    }
    try {
      ranking = itemsOf(await api('/x/web-interface/ranking/v2?rid=0&type=all'))
    } catch {
      // No ranking this turn: the popular's enough.
    }
    const sections = []
    if (popular.length) sections.push({ title: '哔哩哔哩热门', items: popular })
    if (ranking.length) sections.push({ title: '排行榜', items: ranking })
    return { sections }
  }
  const search = async ({ query }) => {
    const answer = await api(
      `/x/web-interface/wbi/search/type?search_type=video&keyword=${encodeURIComponent(cut(query, 120))}&page=1&page_size=24`,
    )
    const songs = (answer?.data?.result ?? []).map(trackOf).filter(Boolean)
    return { songs, playlists: [], albums: [], artists: [] }
  }
  const video = async (bvid) => {
    const answer = await api(`/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`)
    const data = answer?.data ?? {}
    return { raw: data, track: trackOf(data), item: itemOf(data) }
  }
  let qualityWanted = 0
  const playUrl = async (bvid, cid) => {
    const answer = await api(
      `/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}&qn=80&fnval=4048&fourk=1`,
    )
    const audios = answer?.data?.dash?.audio ?? []
    const best = audios.slice().sort((a, b) => Number(b?.id ?? 0) - Number(a?.id ?? 0))[0]
    const audio = [best?.baseUrl, ...(best?.backupUrl ?? [])].map(https).filter(Boolean)
    // The picture (DASH, video only: the sound is the element above): the best up to 720P, the lighter default.
    const videos = (answer?.data?.dash?.video ?? [])
      .slice()
      .sort((a, b) => Number(a?.height ?? 0) - Number(b?.height ?? 0))
    // The best up to the wanted height (default 720P: lighter on the truck's screen), else the smallest.
    const limit = qualityWanted > 0 ? qualityWanted : 720
    const light = videos.filter((one) => Number(one?.height ?? 0) <= limit)
    const chosen = light.at(-1) ?? videos.at(-1)
    const picture = chosen?.baseUrl
    const video = [picture, ...(chosen?.backupUrl ?? [])].map(https).filter(Boolean)
    return { audio, video }
  }
  const collection = async ({ id }) => {
    if (id.startsWith('BV')) {
      const found = await video(id)
      if (!found.track) throw new Error('not a video')
      return { item: found.item, tracks: [found.track] }
    }
    if (!/^\d+$/.test(id)) throw new Error('not a page the app shows')
    const answer = await api(`/x/v3/fav/resource/list?media_id=${encodeURIComponent(id)}&ps=40&pn=1&platform=web`)
    const data = answer?.data ?? {}
    const item = folderOf(data?.info)
    const tracks = (data?.medias ?? []).map((media) => trackOf(media)).filter(Boolean)
    if (!item || !tracks.length) throw new Error('not a page the app shows')
    return { item, tracks }
  }
  const library = async () => {
    await refreshAccount()
    const mid = account.mid || cookie('DedeUserID')
    if (!mid) throw new Error('not signed in')
    const answer = await api(`/x/v3/fav/folder/created/list-all?up_mid=${encodeURIComponent(mid)}`)
    const folders = (answer?.data?.list ?? []).map(folderOf).filter(Boolean)
    if (!folders.length) throw new Error('no folders')
    return { sections: [{ title: '我的收藏夹', items: folders }] }
  }
  const lyrics = async () => ({ synced: false, lines: [], provider: '' })
  const QUESTIONS = { home, search, lyrics, collection, library }
  const answer = async (id, question) => {
    const asked = QUESTIONS[question?.ask]
    if (!asked) {
      post({ answer: { id, failed: true } })
      return
    }
    try {
      post({ answer: { id, [question.ask]: await asked(question) } })
    } catch {
      post({ answer: { id, failed: true } })
    }
  }

  // --- Playing a video's audio -----------------------------------------------------------------------------------
  let queue = null
  let at = 0
  let element = null
  let current = null
  let context = null
  let volumeWanted = null
  let shuffle = false
  let repeat = 'off'
  let stepping = false
  let cidOf = new Map()
  const player = async () => {
    if (element) return element
    element = document.createElement('audio')
    element.preload = 'auto'
    document.documentElement.appendChild(element)
    for (const name of ['play', 'pause', 'seeked', 'loadedmetadata', 'timeupdate']) element.addEventListener(name, () => tellPlayback())
    element.addEventListener('play', () => {
      tellPlayback()
      tellState(true)
    })
    element.addEventListener('pause', () => {
      tellPlayback()
      tellState(true)
    })
    element.addEventListener('ended', () => {
      void ended()
    })
    return element
  }
  // The truck's speakers take the element's sound through the Web Audio API, which reads only what the page's
  // own origin may read: Bilibili's CDN gives no CORS, so a video's audio is fetched in the page (this profile's
  // browser has CORS off) and played from a blob of it. Kept per address: a video played again is fetched once.
  const blobs = new Map()
  const blobOf = async (url) => {
    const kept = blobs.get(url)
    if (kept) return kept
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) throw new Error(`audio ${response.status}`)
    const objectURL = URL.createObjectURL(await response.blob())
    blobs.set(url, objectURL)
    // Three songs kept: enough to go back and forth, never a whole session's (a FLAC is tens of MB).
    if (blobs.size > 3) {
      const [oldest, object] = blobs.entries().next().value
      URL.revokeObjectURL(object)
      blobs.delete(oldest)
    }
    return objectURL
  }
  // A video's sound: the blob when it can be had (the truck's speakers take it), the CDN's own address when not
  // (no 3D sound, but the sound plays).
  const sourceOf = (url) => blobOf(url).catch(() => url)
  // The video itself: Bilibili's page shows it full page (its own interface hidden), the host placing the page
  // under the cabin page's video area. Muted: its sound is the element the truck's speakers take.
  let picture = null
  // The video address of the track playing, and whether the app shows the picture now: the picture is only made
  // (and played) while shown, not for the app's sound-only use.
  let pendingPicture = null
  let pictureShown = false
  let currentVideo = null
  const hidePageUi = () => {
    if (document.getElementById('westplay-bilibili-style')) return
    const style = document.createElement('style')
    style.id = 'westplay-bilibili-style'
    style.textContent =
      'body > *:not(#westplay-bilibili-video){visibility:hidden!important}' +
      '#westplay-bilibili-video{position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:2147483647}'
    document.documentElement.appendChild(style)
  }
  const changeQuality = async (height) => {
    qualityWanted = Math.max(0, Number(height) || 0)
    if (!currentVideo) return
    try {
      const media = await playUrl(currentVideo.bvid, currentVideo.cid)
      pendingPicture = media.video[0] ?? null
      if (!pictureShown || !pendingPicture) return
      const at = picture?.currentTime ?? 0
      await showPicture(pendingPicture)
      if (picture) {
        picture.currentTime = at
        syncPicture()
      }
    } catch {
      // The quality as it was.
    }
  }
  const syncPicture = () => {
    if (!picture || !element || !picture.src) return
    try {
      if (Math.abs((picture.currentTime || 0) - (element.currentTime || 0)) > 0.5) picture.currentTime = element.currentTime
      if (element.paused && !picture.paused) picture.pause()
      else if (!element.paused && picture.paused) picture.play().catch(() => {})
    } catch {
      // The picture's own.
    }
  }
  const showPicture = async (src) => {
    if (!src) return
    hidePageUi()
    if (!picture) {
      picture = document.createElement('video')
      picture.id = 'westplay-bilibili-video'
      picture.muted = true
      picture.playsInline = true
      picture.preload = 'auto'
      document.documentElement.appendChild(picture)
    }
    if (picture.src !== src) picture.src = src
    await picture.play().catch((e) => debug(`picture play failed ${String(e).slice(0, 60)}`))
    syncPicture()
  }
  const playOne = async (track, index, playlist) => {
    try {
      let cid = cidOf.get(track.id)
      if (!cid) {
        const found = await video(track.id)
        cid = found.raw?.cid
        if (!cid) return false
        cidOf.set(track.id, cid)
        if (found.track) Object.assign(track, found.track)
      }
      const media = await playUrl(track.id, cid)
      const url = media.audio[0]
      if (!url) {
        debug(`playurl empty bvid=${track.id}`)
        return false
      }
      const audio = await player()
      current = track
      at = index
      queue = playlist ? { playlist, tracks: queue?.tracks ?? null } : null
      context = playlist ? { id: playlist, name: '', kind: 'playlist' } : null
      audio.volume = volumeWanted ?? 0.8
      audio.src = await sourceOf(url)
      await audio.play().catch((e) => debug(`audio play failed ${String(e).slice(0, 80)}`))
      pendingPicture = media.video[0] ?? null
      currentVideo = { bvid: track.id, cid }
      if (pictureShown) await showPicture(pendingPicture)
      tellPlayback()
      tellState(true)
      return true
    } catch (e) {
      debug(`play failed bvid=${track.id} ${String(e.message ?? e).slice(0, 80)}`)
      return false
    }
  }
  const playFrom = async (tracks, index, playlist) => {
    queue = playlist ? { playlist, tracks } : null
    for (let start = index; start < tracks.length; start++) {
      if (await playOne(tracks[start], start, playlist)) return true
    }
    return false
  }
  const playSong = async (bvid, playlist) => {
    const found = await video(bvid).catch(() => null)
    const track = found?.track
    if (!track) return false
    cidOf.set(bvid, found.raw?.cid)
    if (playlist) {
      const page = await collection({ id: playlist }).catch(() => null)
      if (page?.tracks?.length) {
        const index = Math.max(0, page.tracks.findIndex((one) => one.id === bvid))
        return playFrom(page.tracks, index, playlist)
      }
    }
    return playFrom([track], 0, null)
  }
  const order = (by) => {
    if (!queue?.tracks?.length) return []
    const count = queue.tracks.length
    if (shuffle) {
      const list = [...Array(count).keys()].filter((index) => index !== at)
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
      return list
    }
    const list = []
    for (let step = 1; step <= count; step++) {
      const index = at + by * step
      if (index >= 0 && index < count) list.push(index)
      else if (repeat === 'all') list.push(((index % count) + count) % count)
    }
    return [...new Set(list)]
  }
  const step = async (by) => {
    if (stepping || !queue?.tracks) return false
    stepping = true
    try {
      for (const index of order(by)) if (await playOne(queue.tracks[index], index, queue.playlist)) return true
      return false
    } finally {
      stepping = false
    }
  }
  const ended = async () => {
    if (repeat === 'one' && element) {
      element.currentTime = 0
      await element.play().catch(() => {})
      tellPlayback()
      return
    }
    await step(1)
    tellPlayback()
    tellState(true)
  }
  const playing = () => Boolean(current && element && !element.paused && !element.ended)
  const playback = () =>
    current && {
      track: current,
      context,
      playing: playing(),
      positionMs: Math.round((element?.currentTime ?? 0) * 1000),
      durationMs: Math.round((Number.isFinite(element?.duration) ? element.duration : current.durationMs / 1000) * 1000),
      shuffle: Boolean(shuffle),
      repeat,
      volume: element ? Math.min(1, Math.max(0, element.volume)) : null,
      next: queue?.tracks ? queue.tracks.slice(at + 1, at + 7) : [],
    }
  let toldPlayback = ''
  const tellPlayback = () => {
    const now = playback()
    const shape = stringify(now)
    if (shape === toldPlayback) return
    toldPlayback = shape
    post({ playback: now })
  }
  let toldState = ''
  const tellState = (always = false) => {
    const state = { signedIn: signedIn(), playing: playing(), vip: vip() }
    const said = stringify(state)
    if (said === toldState && !always) return
    toldState = said
    post({ state })
  }

  const CONTROLS = {
    play: ({ song, playlist }) => {
      if (song) return playSong(song, playlist)
      if (playlist) return collection({ id: playlist }).then((found) => playFrom(found.tracks, 0, playlist))
      if (current) {
        if (element?.paused) element.play().catch(() => {})
        else element?.pause()
      }
      return undefined
    },
    pause: () => {
      if (element && !element.paused) element.pause()
      if (picture && !picture.paused) picture.pause()
      tellPlayback()
      tellState(true)
    },
    resume: () => {
      if (element?.paused) element.play().catch(() => {})
      if (picture?.paused) picture.play().catch(() => {})
      tellPlayback()
      tellState(true)
    },
    next: () => step(1),
    previous: () => (element && element.currentTime > 3 ? ((element.currentTime = 0), tellPlayback()) : step(-1)),
    seek: ({ seconds }) => {
      if (!element) return
      element.currentTime = Math.max(0, Number(seconds) || 0)
      if (picture) picture.currentTime = element.currentTime
      tellPlayback()
    },
    volume: ({ percent }) => {
      volumeWanted = Math.min(1, Math.max(0, Number(percent) / 100))
      if (element) element.volume = volumeWanted
      tellPlayback()
    },
    shuffle: ({ on }) => {
      shuffle = Boolean(on)
      tellPlayback()
    },
    repeat: ({ mode }) => {
      repeat = mode
      tellPlayback()
    },
  }

  // --- The truck's speakers -------------------------------------------------------------------------------------
  //
  // The page's sound through the truck's own speakers (cab_sound.js, loaded first), told the speakers, the head,
  // the camera, the tone and the spectrum by the host; the element it takes is the one playing now (none before
  // the first video).
  const cab = window.westplayCabSound?.(() => element, post)
  const CAB = {
    speakers: (data) => cab?.speakers(data.speakers),
    // The host flattens the head and the tone into the message (netease.rs's Cab); a nested shape works too.
    head: (data) => cab?.head(data.head ?? data),
    outside: (data) => cab?.outside(data.on, data.distance),
    equalizer: (data) => cab?.equalizer(data.equalizer ?? data),
    spectrum: (data) => cab?.spectrum(data.on),
  }

  window.chrome?.webview?.addEventListener('message', ({ data }) => {
    try {
      if (CAB[data?.action]) CAB[data.action](data)
      else if (data?.action === 'videoShow') {
        pictureShown = true
        void showPicture(pendingPicture)
      } else if (data?.action === 'videoHide') {
        pictureShown = false
        picture?.pause()
      } else if (data?.action === 'videoQuality') {
        void changeQuality(data.height)
      }
      else if (data?.action === 'ask') answer(data.id, data.question)
      else Promise.resolve(CONTROLS[data?.action]?.(data)).catch(() => {})
    } catch {
      // Nothing to press, or the page's own.
    }
  })

  const poll = () => {
    refreshAccount().finally(() => {
      tellState()
      tellPlayback()
      syncPicture()
      setTimeout(poll, 900)
    })
  }
  const start = () => {
    // The truck's speakers: each pass, the element playing now, its volume (the app's slider), and the context
    // woken (cab_sound.js).
    if (cab) setInterval(() => cab.tick(), 250)
    refreshAccount().finally(() => {
      tellState(true)
      tellPlayback()
    })
    poll()
    post({ ready: true })
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start)
  else start()
})()
