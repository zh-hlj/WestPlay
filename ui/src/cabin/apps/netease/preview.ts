import type {
  NeteaseAnswers,
  NeteaseCollection,
  NeteaseContext,
  NeteaseHome,
  NeteaseItem,
  NeteaseQuestion,
  NeteaseResults,
  NeteaseTrack,
} from '../../../shared/host'

/**
 * NetEase Cloud Music's preview, outside WestPlay (a plain browser): an invented catalogue (made-up songs,
 * playlists, albums and artists, no pictures: the app draws their covers) answering every question as NetEase
 * Cloud Music would, after a moment, and playing it here (netease.ts).
 *
 * TODO(verify): NetEase's own answers, as its page's API gives them (netease.js): the app's shapes are what it
 * cuts them down to.
 */

const ARTISTS = ['雾港', '南屿', '夜航电台', '林间汽笛', '陈默与风', '山岚']

const ALBUMS = ['夜行高速', '货场清晨', '公路尽头', '雾中信号', '南方货栈', '远光灯']

const SONG_NAMES = [
  '夜行高速',
  '沿海公路',
  '载重三十吨',
  '雨刷',
  '尾灯',
  '休息区',
  '柴油与月亮',
  '导航失灵',
  '四点零七分',
  '下一座桥',
  '货场清晨',
  '山口的雾',
  '长途电话',
  '免费公路',
  '收音机',
  '到家之前',
  '反光镜',
  '油表到底',
  '冰点以下',
  '最后一个服务区',
  '北方的风',
  '双闪',
  '雾灯',
  '天亮之前',
]

const PLAYLISTS = ['长途夜行歌单', '卡车司机的清晨', '雨夜慢歌', '公路电影原声', '休息区广播', '南方小调']

const PLAYLIST_BASE = 2_100_000
const ALBUM_BASE = 3_200_000
const SONG_BASE = 1_900_000

function songId(index: number): string {
  return String(SONG_BASE + index)
}

function track(index: number): NeteaseTrack {
  const album = ALBUMS[index % ALBUMS.length]
  return {
    id: songId(index),
    name: SONG_NAMES[index % SONG_NAMES.length],
    artists: [ARTISTS[index % ARTISTS.length]],
    album,
    image: null,
    durationMs: (2 + (index % 4)) * 60_000 + ((index * 17) % 60) * 1000,
  }
}

/** `count` songs from `from`, as a list's track list. */
function tracks(from: number, count: number): NeteaseTrack[] {
  return Array.from({ length: count }, (_, at) => track(from + at))
}

function playlist(index: number): NeteaseItem {
  return {
    id: String(PLAYLIST_BASE + index),
    kind: 'playlist',
    name: PLAYLISTS[index % PLAYLISTS.length],
    by: index % 2 ? 'WestPlay' : ARTISTS[index % ARTISTS.length],
    image: null,
    description: '为长途驾驶挑的歌，一首接一首。',
  }
}

function album(index: number): NeteaseItem {
  return {
    id: String(ALBUM_BASE + index),
    kind: 'album',
    name: ALBUMS[index % ALBUMS.length],
    by: ARTISTS[index % ARTISTS.length],
    image: null,
    description: null,
  }
}

function artist(index: number): NeteaseItem {
  return {
    id: String(460_000 + (index % ARTISTS.length)),
    kind: 'artist',
    name: ARTISTS[index % ARTISTS.length],
    by: '',
    image: null,
    description: null,
  }
}

function songItem(index: number): NeteaseItem {
  const found = track(index)
  return {
    id: found.id,
    kind: 'song',
    name: found.name,
    by: found.artists.join(' / '),
    image: null,
    description: null,
  }
}

function home(): NeteaseHome {
  return {
    sections: [
      { title: '推荐歌单', items: [0, 1, 2, 3, 4, 5].map(playlist) },
      { title: '推荐新音乐', items: [0, 1, 2, 3, 4, 5].map(songItem) },
      { title: '精选专辑', items: [0, 1, 2, 3, 4, 5].map(album) },
      { title: '热门歌手', items: [0, 1, 2, 3, 4].map(artist) },
    ],
  }
}

function search(query: string): NeteaseResults {
  const words = query.trim().toLowerCase()
  // What the words name first, then the rest (a search shows what it found, and what's near it).
  const named = <T extends { name: string }>(list: T[]): T[] => {
    if (!words) return list
    const found = list.filter((each) => each.name.toLowerCase().includes(words))
    return [...found, ...list.filter((each) => !found.includes(each))].slice(0, 8)
  }
  return {
    songs: named(tracks(0, 12)),
    playlists: named([0, 1, 2].map(playlist)),
    albums: named([0, 1, 2].map(album)),
    artists: named([0, 1, 2].map(artist)),
  }
}

/** The playlist or album an id names (the preview's ids say which by their range). */
function listOf(id: string): { item: NeteaseItem; tracks: NeteaseTrack[] } | null {
  const value = Number(id)
  if (!Number.isFinite(value)) return null
  const playlistIndex = value - PLAYLIST_BASE
  if (playlistIndex >= 0 && playlistIndex < PLAYLISTS.length) {
    return { item: playlist(playlistIndex), tracks: tracks(playlistIndex * 2, 12) }
  }
  const albumIndex = value - ALBUM_BASE
  if (albumIndex >= 0 && albumIndex < ALBUMS.length) {
    return { item: album(albumIndex), tracks: tracks(albumIndex * 3, 8) }
  }
  return null
}

function collection(id: string): NeteaseCollection {
  const found = listOf(id)
  if (found) return found
  // An id the preview doesn't know: an empty playlist under it (the app says it's empty).
  return { item: { ...playlist(0), id }, tracks: [] }
}

function lyrics(): NeteaseAnswers['lyrics'] {
  // TODO(verify): NetEase's own timed words (`/api/song/lyric`): the preview's are not synced, one line each.
  return {
    synced: false,
    lines: [
      '车灯照着前面的雨',
      '收音机开得很低',
      '再过一个收费站',
      '就快到家了',
      '',
      '夜行高速，一直往南',
      '把这座城留在身后',
    ].map((text) => ({ start: 0, end: 0, text })),
    provider: '',
  }
}

/** Mine, signed in: the account's own lists (the preview has a few). */
function library(): NeteaseAnswers['library'] {
  return { sections: [{ title: '我的歌单', items: PLAYLISTS.map((_, index) => playlist(index)) }] }
}

function answer(question: NeteaseQuestion): NeteaseAnswers[NeteaseQuestion['ask']] {
  switch (question.ask) {
    case 'home':
      return home()
    case 'library':
      return library()
    case 'search':
      return search(question.query)
    case 'collection':
      return collection(question.id)
    case 'lyrics':
      return lyrics()
  }
}

/** The preview's answer, after a moment (as NetEase's own would come). */
export function previewAnswer(question: NeteaseQuestion): Promise<unknown> {
  return new Promise((resolve) => setTimeout(() => resolve(answer(question)), 350))
}

/** What the preview plays for a song, or from a playlist (a song in it, or its first), and what it plays from. */
export function previewPlay({
  song,
  playlist,
}: {
  song?: string
  playlist?: string
}): { tracks: NeteaseTrack[]; index: number; from: string; context: NeteaseContext | null } | null {
  if (playlist) {
    const found = listOf(playlist)
    if (!found) return null
    const at = song ? found.tracks.findIndex((each) => each.id === song) : 0
    return {
      tracks: found.tracks,
      index: Math.max(0, at),
      from: found.item.name,
      context: { id: found.item.id, name: found.item.name, kind: found.item.kind },
    }
  }
  if (!song) return null
  const index = Number(song) - SONG_BASE
  const from = index >= 0 && index < SONG_NAMES.length ? index : 0
  // A song on its own: the songs after it too (Netease's page plays a queue of its own).
  return { tracks: tracks(from, 20), index: 0, from: track(from).name, context: null }
}
