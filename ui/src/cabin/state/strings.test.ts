import { describe, expect, it } from 'vitest'
import { languageOf, STRINGS } from './strings'

describe('languageOf', () => {
  it('picks Turkish when the game plays in Turkish, in any case or region', () => {
    expect(languageOf('tr_tr')).toBe('tr')
    expect(languageOf('tr-TR')).toBe('tr')
    expect(languageOf('TR')).toBe('tr')
  })

  it('picks Chinese when the game plays in Chinese, in any case or script', () => {
    expect(languageOf('zh_cn')).toBe('zh')
    expect(languageOf('zh-CN')).toBe('zh')
    expect(languageOf('zh_tw')).toBe('zh')
    expect(languageOf('ZH-Hans')).toBe('zh')
  })

  it('falls back to English for every other language, and until the game’s is known', () => {
    expect(languageOf('en_us')).toBe('en')
    expect(languageOf('de_de')).toBe('en')
    expect(languageOf('pl_pl')).toBe('en')
    expect(languageOf(null)).toBe('en')
  })
})

describe('STRINGS.zh', () => {
  it('is the cabin’s words in Simplified Chinese', () => {
    expect(STRINGS.zh.destinations.go).toBe('出发')
    expect(STRINGS.zh.destinations.addStop).toBe('添加途经点')
    expect(STRINGS.zh.apps.maps).toBe('地图')
    expect(STRINGS.zh.apps.settings).toBe('设置')
    expect(STRINGS.zh.keyboard.returnKey.done).toBe('完成')
    expect(STRINGS.zh.settings.equalizer).toBe('均衡器')
  })

  it('keeps the brand names as they are', () => {
    expect(STRINGS.zh.apps.spotify).toBe('Spotify')
    expect(STRINGS.zh.apps.youtubeMusic).toBe('YouTube Music')
    expect(STRINGS.zh.youtubeMusic.cantPlay).toContain('YouTube Music')
    expect(STRINGS.zh.appleMusic.finishOnPc).toContain('Apple Music')
    expect(STRINGS.zh.spotify.previewTitle).toContain('Spotify')
  })

  it('says distances, times and numbers in Chinese units', () => {
    expect(STRINGS.zh.minutes(12)).toBe('12 分钟')
    expect(STRINGS.zh.hours(1, '05')).toBe('1 小时 05 分')
    expect(STRINGS.zh.youtube.seconds(10)).toBe('10 秒')
    expect(STRINGS.zh.speedLimit(80)).toBe('限速 80')
    expect(STRINGS.zh.roundabout(2)).toBe('进入环岛，从第 2 个出口驶出')
    expect(STRINGS.zh.arriveBy('周四 14:00')).toBe('最晚 周四 14:00 到达')
    expect(STRINGS.zh.days).toHaveLength(7)
    expect(STRINGS.zh.days[0]).toBe('周一')
  })

  it('puts the search’s own words in its results', () => {
    expect(STRINGS.zh.spotify.noResults('晴天')).toBe('未找到“晴天”的相关结果')
    expect(STRINGS.zh.spotify.length(12_000)).toBe('3 小时 20 分钟')
    expect(STRINGS.zh.spotify.length(72)).toBe('1 分 12 秒')
    expect(STRINGS.zh.appleMusic.length(11, 2580)).toBe('11 首歌曲，43 分钟')
    expect(STRINGS.zh.spotify.monthlyListeners('1,234')).toBe('1,234 位月度听众')
  })
})
