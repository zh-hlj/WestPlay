// WestPlay, in QQ Music's web player (qq.rs): y.qq.com run hidden, its own login (a QR code in a window on the
// PC) kept in this profile's cookies. This script reads the account and QQ Music's own API (`u.y.qq.com` /
// `c.y.qq.com`, same site, cookies with `credentials: 'include'`) and plays what the app asks for in an element
// of its own: the page's own player is not used. The WebView has CORS enforcement off for its profile only
// (`webview.rs`'s extra arguments), so the page's fetch can read the API's answers.
//
// Answers, playback and state are shaped as the NetEase service's (`netease.rs`): the cabin's app is the same,
// with the service switched to QQ Music.
;;(() => {
  if (location.hostname !== 'y.qq.com' || window.top !== window) return
  const post = (message) => window.chrome?.webview?.postMessage(message)
  const pageFetch = window.fetch.bind(window)
  const stringify = JSON.stringify

  const text = (value) => (value == null ? '' : String(value)).replace(/\s+/g, ' ').trim()
  const cut = (value, most) => text(value).slice(0, most)
  const https = (url) => {
    const found = typeof url === 'string' ? url.replace(/^http:\/\//, 'https://') : null
    return found?.startsWith('https://') ? found : null
  }
  const isId = (id) => typeof id === 'string' && id.length >= 1 && id.length <= 30 && /^[A-Za-z0-9]+$/.test(id)

  // --- The account, by its own page's cookies (the sign-in window set them) ------------------------------------
  const cookie = (name) => {
    const found = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    if (!found) return ''
    try {
      return decodeURIComponent(found[1])
    } catch {
      return found[1]
    }
  }
  const musicKey = () => cookie('qm_keyst') || cookie('qqmusic_key') || cookie('music_key') || cookie('p_skey') || ''
  // The account: QQ Music's own profile answer, asked with the page's cookies (whether or not the cookies can be
  // read here: an HttpOnly qm_keyst is still sent). It says the uin the vkey answer wants, and the membership.
  let signed = false
  let account = { uin: '', nick: '', avatar: null, vip: null }
  let accountAt = 0
  const uin = () => account.uin || cookie('uin') || cookie('qqmusic_uin') || cookie('p_uin') || ''
  // Signed in: the profile said so, or the page's own uin cookie (qm_keyst may be HttpOnly: not read here).
  const signedIn = () => signed || Boolean(uin())
  const vip = () => {
    if (account.vip) return account.vip
    const raw = cookie('vip_type') || cookie('qqmusic_vip') || ''
    if (/^\d+$/.test(raw)) return Number(raw) > 0 ? 'VIP' : '非VIP'
    return null
  }
  const debug = (what) => post({ debug: what })
  const refreshAccount = async () => {
    if (Date.now() - accountAt < 10_000) return
    accountAt = Date.now()
    try {
      const answer = await getJSON(
        'https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?cid=205360838&userid=0&reqfrom=1&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0',
      )
      const creator = answer?.data?.creator ?? answer?.data?.user ?? null
      if (!creator) {
        if (signed) debug('account signed out')
        signed = false
        account = { uin: '', nick: '', avatar: null, vip: null }
        return
      }
      const vipType = Number(creator.vipType ?? creator.vip_type ?? creator.isVip ?? 0) || 0
      account = {
        uin: String(creator.uin ?? creator.encrypt_uin ?? ''),
        nick: text(creator.nick ?? creator.name),
        avatar: https(creator.headpic ?? creator.avatarUrl ?? creator.avatar),
        vip: vipType > 0 ? 'VIP' : '非VIP',
      }
      if (!signed) debug(`account signed in uin=${account.uin ? 'yes' : 'no'}`)
      signed = true
    } catch (e) {
      // The profile not this turn: the cookies still say whether there is a key.
      signed = Boolean((cookie('uin') || cookie('qqmusic_uin')) && (musicKey() || cookie('p_skey')))
    }
  }

  // --- QQ Music's own API: the web player's signed requests -----------------------------------------------------
  const sha1 = async (value) => {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value))
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  // The web player's `sign` for `musics.fcg`, as Mineradio-paused's server computes it: part of the SHA-1's
  // hex, 20 XORed bytes in base64 without `\/+=`, and the rest of the hash around it.
  const sign = async (body) => {
    const hash = await sha1(body)
    const part1 = [23, 14, 6, 36, 16, 40, 7, 19].map((at) => hash[at]).join('')
    const part2 = [16, 1, 32, 12, 19, 27, 8, 5].map((at) => hash[at]).join('')
    const scramble = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179]
    const bytes = scramble.map((value, at) => value ^ parseInt(hash.slice(at * 2, at * 2 + 2), 16))
    const middle = btoa(String.fromCharCode(...bytes)).replace(/[\\/+=]/g, '')
    return `zzc${part1}${middle}${part2}`.toLowerCase()
  }
  const COMM = {
    ct: '11',
    cv: '14090508',
    v: '14090508',
    tmeAppID: 'qqmusic',
    phonetype: 'EBG-AN10',
    os_ver: '12',
    OpenUDID: '0',
    QIMEI36: '0',
    udid: '0',
    chid: '0',
    aid: '0',
    oaid: '0',
    taid: '0',
    tid: '0',
    wid: '0',
    uid: '0',
    sid: '0',
    modeSwitch: '6',
    teenMode: '0',
    ui_mode: '2',
    nettype: '1020',
  }
  const musicu = async (payload) => {
    const body = stringify(payload)
    const signature = await sign(body)
    const response = await pageFetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?sign=${signature}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'User-Agent': 'QQMusic 14090508(android 12)', 'Content-Type': 'application/json' },
      body,
    })
    if (!response.ok) throw new Error(`musicu ${response.status}`)
    return await response.json()
  }
  const getJSON = async (url) => {
    const response = await pageFetch(url, { credentials: 'include', headers: { Referer: 'https://y.qq.com/' } })
    if (!response.ok) throw new Error(`${url} ${response.status}`)
    return await response.json()
  }

  // --- Shapes the cabin app reads (as NetEase's: `netease.rs`) ---------------------------------------------------
  const cover = (albumMid) =>
    albumMid ? `https://y.qq.com/music/photo_new/T002R300x300M000${albumMid}.jpg?max_age=2592000` : null
  const artistCover = (singerMid) =>
    singerMid ? `https://y.qq.com/music/photo_new/T001R300x300M000${singerMid}.jpg?max_age=2592000` : null
  const songOf = (raw) => {
    if (!raw) return null
    const mid = raw.mid || raw.songmid || raw.songMid || ''
    const name = raw.name || raw.title || raw.songname || ''
    if (!mid || !name) return null
    const artists = (raw.singer ?? raw.singers ?? []).map((one) => text(one?.name ?? one)).filter(Boolean)
    const album = raw.album ?? {}
    const duration = Number(raw.interval ?? raw.duration ?? 0) || 0
    return {
      id: mid,
      name,
      artists: artists.length ? artists : [text(raw.author)].filter(Boolean),
      album: text(album.name ?? album.albumname),
      image: cover(album.mid ?? album.albumMid),
      durationMs: Math.round(duration * 1000),
    }
  }
  const itemOf = (song) => song && { id: song.id, kind: 'song', name: song.name, by: song.artists.join(', '), image: song.image, description: null }
  const playlistOf = (raw) => {
    const id = raw?.dissid || raw?.tid || raw?.dirId || raw?.id || ''
    const name = text(raw?.dissname ?? raw?.title ?? raw?.name)
    if (!isId(String(id)) || !name) return null
    return { id: String(id), kind: 'playlist', name, by: text(raw?.creator?.name ?? raw?.nick), image: https(raw?.logo ?? raw?.imgurl ?? raw?.picurl), description: null }
  }
  const albumOf = (raw) => {
    const mid = raw?.albumMid || raw?.mid || ''
    const name = text(raw?.albumName ?? raw?.name ?? raw?.title)
    if (!isId(mid) || !name) return null
    return { id: mid, kind: 'album', name, by: text(raw?.singerName ?? raw?.singername), image: cover(mid), description: null }
  }
  const artistOf = (raw) => {
    const mid = raw?.singerMid || raw?.mid || ''
    const name = text(raw?.singerName ?? raw?.name ?? raw?.title)
    if (!isId(mid) || !name) return null
    return { id: mid, kind: 'artist', name, by: '歌手', image: artistCover(mid), description: null }
  }

  // --- The app's questions ---------------------------------------------------------------------------------------
  const search = async ({ query }) => {
    const payload = {
      comm: COMM,
      req: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicMobile',
        param: {
          search_type: 0,
          searchid: String(Date.now()) + String(Math.random()).slice(2, 8),
          query: cut(query, 200),
          page_num: 1,
          num_per_page: 24,
          highlight: 0,
          nqc_flag: 0,
          multi_zhida: 0,
          cat: 2,
          grp: 1,
          sin: 0,
          sem: 0,
        },
      },
    }
    const answer = await musicu(payload)
    const body = answer?.req?.data?.body ?? {}
    const songs = (body.item_song ?? body.song?.list ?? body.list ?? [])
      .map((entry) => songOf(entry?.track_info ?? entry?.songInfo ?? entry))
      .filter(Boolean)
    return {
      songs,
      playlists: [],
      albums: [],
      artists: [],
    }
  }
  // Home: the app's own shelves are not public in one request: a few of QQ Music's real search results, by genre,
  // are shown as shelves (kept short: the cabin asks for this as it opens).
  const home = async () => {
    const shelves = []
    for (const [query, title] of [['热歌', 'QQ音乐热歌'], ['新歌', 'QQ音乐新歌'], ['纯音乐', '纯音乐']]) {
      try {
        const found = await search({ query })
        const items = found.songs.slice(0, 12).map(itemOf).filter(Boolean)
        if (items.length) shelves.push({ title, items })
      } catch {
        // This shelf not this turn.
      }
    }
    return { sections: shelves }
  }
  const lyrics = async ({ song }) => {
    const answer = await getJSON(
      `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?format=json&nobase64=0&songmid=${encodeURIComponent(song)}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`,
    )
    const raw = typeof answer?.lyric === 'string' && answer.lyric
      ? new TextDecoder().decode(Uint8Array.from(atob(answer.lyric.replace(/\s/g, '')), (one) => one.charCodeAt(0)))
      : ''
    const LRC = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
    const lines = []
    for (const row of raw.split('\n')) {
      const words = row.replace(LRC, '').trim()
      for (const found of row.matchAll(LRC)) {
        const fraction = found[3] ? Number(`0.${found[3].padEnd(3, '0')}`) : 0
        lines.push({ start: Number(found[1]) * 60 + Number(found[2]) + fraction, end: 0, text: words })
      }
    }
    lines.sort((a, b) => a.start - b.start)
    return lines.length ? { synced: true, lines, provider: '' } : { synced: false, lines: [], provider: '' }
  }
  const playlistTracks = async (id) => {
    const answer = await getJSON(
      `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${encodeURIComponent(id)}&format=json&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`,
    )
    const list = (answer?.cdlist ?? [])[0] ?? {}
    const item = playlistOf({ dissid: id, dissname: list.dissname, logo: list.logo, nick: list.nick })
    const tracks = (list.songlist ?? []).map(songOf).filter(Boolean)
    return item ? { item, tracks } : null
  }
  const albumTracks = async (mid) => {
    const answer = await getJSON(
      `https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?albummid=${encodeURIComponent(mid)}&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`,
    )
    const data = answer?.data ?? {}
    const item = albumOf({ albumMid: mid, albumName: data.albumName ?? data.name, singerName: data.singerName ?? data.singername })
    const tracks = (data.list ?? []).map(songOf).filter(Boolean)
    return item ? { item, tracks } : null
  }
  const collection = async ({ id }) => {
    const found = /^\d+$/.test(id) ? await playlistTracks(id) : await albumTracks(id)
    if (!found) throw new Error('not a page the app shows')
    return found
  }
  const library = async () => {
    await refreshAccount()
    const uid = uin()
    if (!uid) throw new Error('not signed in')
    const sections = []
    try {
      const answer = await getJSON(
        `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?cid=205360956&userid=${encodeURIComponent(uid)}&reqtype=3&sin=0&size=100&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`,
      )
      const lists = [...(answer?.data?.cdlist ?? []), ...(answer?.data?.disslist ?? [])].map(playlistOf).filter(Boolean)
      if (lists.length) sections.push({ title: '我的歌单', items: lists })
    } catch {
      // The account's lists not this turn.
    }
    if (sections.length === 0) throw new Error('no lists')
    return { sections }
  }
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

  // --- Playing it ourselves -------------------------------------------------------------------------------------
  //
  // The vkey answer gives a signed path on a CDN: an `https` one (the page is https) is played in our own
  // element, uncut by the page's own player. `http` CDN hosts are asked for their `https` form first.
  let queue = null
  let at = 0
  let element = null
  let current = null
  let context = null
  let volumeWanted = null
  let shuffle = false
  let repeat = 'off'
  let stepping = false
  const token = () => `0${Math.floor(Math.random() * 1e9)}`
  const guid = () => String(10000000 + Math.floor(Math.random() * 90000000))
  const filenameFor = (mid, quality) => {
    const extension = quality.startsWith('F') ? '.flac' : quality.startsWith('C') ? '.m4a' : '.mp3'
    return `${quality}${mid}${extension}`
  }
  const URL_OF = async (song, premium) => {
    await refreshAccount()
    const mid = String(song)
    const qualities = premium
      ? ['F000', 'M800', 'C600', 'M500', 'C400']
      : ['M800', 'C600', 'M500', 'C400']
    const filenames = qualities.map((quality) => filenameFor(mid, quality))
    const key = musicKey()
    const payload = {
      comm: { uin: uin() || '0', format: 'json', ct: key ? 19 : 24, cv: 0, ...(key ? { authst: key } : {}) },
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: guid(),
          songmid: filenames.map(() => mid),
          songtype: filenames.map(() => 0),
          uin: uin() || '0',
          loginflag: 1,
          platform: '20',
          filename: filenames,
        },
      },
    }
    const answer = await musicu(payload)
    const data = answer?.req_0?.data ?? {}
    const sips = (data.sip ?? []).map(https).filter(Boolean)
    const infos = (data.midurlinfo ?? []).filter((one) => one?.purl)
    for (const info of infos) {
      for (const sip of sips.length ? sips : ['https://ws.stream.qqmusic.qq.com/']) {
        const url = https(sip + info.purl)
        if (url) return url
      }
    }
    debug(
      `vkey empty login=${signedIn() ? 'yes' : 'no'} uin=${uin() ? 'yes' : 'no'} key=${musicKey() ? 'yes' : 'no'} names=${(data.midurlinfo ?? []).map((one) => one?.result).join(',')}`,
    )
    return null
  }
  const player = async () => {
    if (element) return element
    element = document.createElement('audio')
    element.preload = 'auto'
    document.documentElement.appendChild(element)
    element.addEventListener('timeupdate', () => tellPlayback())
    element.addEventListener('play', () => {
      tellPlayback()
      tellState(true)
    })
    element.addEventListener('pause', () => {
      tellPlayback()
      tellState(true)
    })
    element.addEventListener('loadedmetadata', () => tellPlayback())
    element.addEventListener('ended', () => {
      void ended()
    })
    return element
  }
  const playFrom = async (tracks, index, playlist) => {
    for (let start = index; start < tracks.length; start++) {
      const track = tracks[start]
      const url = await URL_OF(track.id, Boolean(vip())).catch(() => null)
      if (!url) continue
      const audio = await player()
      current = track
      at = start
      queue = { playlist, tracks }
      context = playlist ? { id: playlist, name: '', kind: 'playlist' } : null
      audio.volume = volumeWanted ?? 0.8
      audio.src = url
      await audio.play().catch(() => {})
      tellPlayback()
      tellState(true)
      return true
    }
    return false
  }
  const playSong = async (song, playlist) => {
    const track = {
      id: song,
      name: '',
      artists: [],
      album: '',
      image: null,
      durationMs: 0,
    }
    // Its own detail fills what the app shows meanwhile.
    try {
      const detail = await musicu({
        comm: { ct: 24, cv: 0 },
        songinfo: { module: 'music.pf_song_detail_svr', method: 'get_song_detail_yqq', param: { song_mid: song } },
      })
      const raw = detail?.songinfo?.data?.track_info ?? null
      const found = songOf(raw)
      if (found) Object.assign(track, found)
    } catch {
      // Shown unnamed until the app's list says it.
    }
    if (playlist) {
      const found = await collection({ id: playlist }).catch(() => null)
      if (found?.tracks?.length) {
        const index = Math.max(0, found.tracks.findIndex((one) => one.id === song))
        return playFrom(found.tracks, index, playlist)
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
      for (const index of order(by)) {
        const track = queue.tracks[index]
        const url = await URL_OF(track.id, Boolean(vip())).catch(() => null)
        if (!url) continue
        const audio = await player()
        current = track
        at = index
        audio.src = url
        await audio.play().catch(() => {})
        tellPlayback()
        tellState(true)
        return true
      }
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
    const stepped = await step(1)
    tellPlayback()
    tellState(true)
    return stepped
  }

  // --- What the app shows of it ---------------------------------------------------------------------------------
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
  let lastPlayback = null
  let lastAt = performance.now()
  const tellPlayback = () => {
    const now = playback()
    const shape = stringify(now)
    if (shape !== toldPlayback) {
      toldPlayback = shape
      lastPlayback = now
      lastAt = performance.now()
      post({ playback: now })
    }
  }
  let toldState = ''
  const tellState = (always = false) => {
    const state = { signedIn: signedIn(), playing: playing(), vip: vip() }
    const said = stringify(state)
    if (said === toldState && !always) return
    toldState = said
    post({ state })
  }
  const poll = () => {
    refreshAccount().finally(() => {
      tellState()
      tellPlayback()
      if (lastPlayback && !lastPlayback.playing) {
        // The app's own time doesn't run here: a pause is only said when it changes.
      }
      setTimeout(poll, 700)
    })
  }

  // --- The app's commands ----------------------------------------------------------------------------------------
  const CONTROLS = {
    play: ({ song, playlist }) => {
      if (song) return playSong(song, playlist)
      if (playlist) return collection({ id: playlist }).then((found) => (found.tracks.length ? playFrom(found.tracks, 0, playlist) : false))
      if (current) {
        if (element?.paused) element.play().catch(() => {})
        else element?.pause()
      }
      return undefined
    },
    pause: () => {
      if (element && !element.paused) element.pause()
      tellPlayback()
      tellState(true)
    },
    resume: () => {
      if (element?.paused) element.play().catch(() => {})
      tellPlayback()
      tellState(true)
    },
    next: () => step(1),
    previous: () => (element && element.currentTime > 3 ? ((element.currentTime = 0), tellPlayback()) : step(-1)),
    seek: ({ seconds }) => {
      if (!element) return
      element.currentTime = Math.max(0, Number(seconds) || 0)
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

  window.chrome?.webview?.addEventListener('message', ({ data }) => {
    try {
      if (data?.action === 'ask') answer(data.id, data.question)
      else Promise.resolve(CONTROLS[data?.action]?.(data)).catch(() => {})
    } catch {
      // Nothing to press, or the page's own.
    }
  })

  // --- Its page, ready -------------------------------------------------------------------------------------------
  const start = () => {
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
