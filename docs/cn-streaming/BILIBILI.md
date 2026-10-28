# 哔哩哔哩（Bilibili）接入设计（CN Streaming）

参考架构：与网易云/QQ 音乐一致——隐藏 WebView 打开 `www.bilibili.com`，注入页面脚本用 **页面自身 cookie + 官方 API** 取数据，自己用 `<audio>` 播放；车内音乐 App 加第三个源「哔哩哔哩」。

## 1. 可行性验证（2026-10-28，headless Edge + CDP）

在 `https://www.bilibili.com/` 页面内用 `fetch(..., {credentials:'include'})` 实测：

| 验证项 | 结果 |
| --- | --- |
| 搜索 `api.bilibili.com/x/web-interface/wbi/search/type`（匿名） | ✅ code 0，返回视频（`BV1BDk2YCEHF`） |
| 视频信息 `x/web-interface/view` | ✅ code 0，`cid=27419215717`，标题/分P 正常 |
| 播放地址 `x/player/playurl`（`fnval=4048`） | ✅ code 0，DASH 音频 `mcdn.bilivideo.cn:8082` |
| 音频 URL 在 bilibili 页面用 `<audio>` 播放 | ✅ `paused:false, ready:4, currentTime` 在走（页面 Referer 让它通过） |
| Web Audio 捕获（接 `cab_sound` 用） | ❌ 电平 0（CDN 无 `Access-Control-Allow-Origin`），**v1 只能直出，不做卡车 3D 声场** |

结论：**搜索/播放可行，匿名就能播 360/480P 音轨；账号登录能提高画质/收藏/历史，但不是播放的必要条件。**

## 2. 架构

- 新增 host `crates/host/src/bilibili.rs`（结构对齐 `qq.rs`）：
  - 隐藏 WebView：`https://www.bilibili.com/`，独立 profile `webview2-bilibili`，注入 `bilibili.js`、`bilibili_sign_in.js`
  - 不需要 `--disable-web-security`（页面 fetch 已验证可读）；如后续接口被 CORS 拦再开
  - 登录：可见窗口打开 bilibili.com，用户扫码；`bilibili_sign_in.js` 轮询 `/x/web-interface/nav`（`data.isLogin`）或 `SESSDATA` cookie 后关闭窗口
- `bilibili.js`：
  - 搜索：`/x/web-interface/wbi/search/type?search_type=video`（必要时带 wbi 签名/buvid cookie）
  - 首页：`/x/web-interface/popular?ps=20&pn=1`（热门视频）
  - 视频详情：`/x/web-interface/view?bvid=`（cid/标题/UP/封面/时长）
  - 播放：`/x/player/playurl?bvid=&cid=&qn=80&fnval=4048` → DASH `audio[].baseUrl`，用自有 `<audio>` 播放（页面 Referer 一起发）
  - 我的收藏：登录后 `/x/v3/fav/folder/created/list-all?up_mid=`，收藏夹内容 `/x/v3/fav/resource/list?media_id=`
  - 进度/播放/列表循环/随机/下一首：同 QQ 的实现
  - 歌词：B 站无 LRC；字幕可后续做，v1 返回空
- UI：车内音乐 App 顶部来源改为三选一：**网易云 / QQ音乐 / 哔哩哔哩**；条目为“视频”，点击播放其音轨；页面复用网易云/QQ 的 Shelf/SongList/NowPlaying。
- companion：账号页加「哔哩哔哩」登录行（扫码）。

## 3. 风险 / 待验证

- B 站 API 的 wbi 签名/风控：匿名搜索目前可用，量大或改版可能需要 `buvid3`/wbi（页面脚本可读取/调用页面自身模块，实在不行用 `--disable-web-security` + 页面内签名）。
- 播放地址是 mcdn P2P 域名，可能对 UA/Referer/时间敏感；失败时回退 `backupUrl` 列表。
- 音频直出（无 3D 声场）：若以后要求卡车喇叭，需要 B 站 CDN CORS 或代理音频（成本高）。
- 视频画面：v1 不做“视频显示在车机屏”，只播音频；若需要，可仿 YouTube 的 `Show/Hide` 合成（后续 P1）。

## 4. 实现步骤

1. `bilibili.js`（搜索/首页/详情/playurl/播放队列）+ `bilibili_sign_in.js`
2. `bilibili.rs`（服务/命令/问题/报告/登录窗口）
3. host 接线（Status/AccountRequests/PageMessage/start_bilibili）
4. UI 第三来源 + companion 账号行 + 文案
5. 检查：tsc/vitest/cargo check → CI 预览构建 → 真机验证
