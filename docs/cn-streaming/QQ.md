# QQ 音乐接入设计（CN Streaming）

参考：`XxHuberrr/Mineradio-paused`（其 `server.js` / `qq-vip-api.js` 已实现 QQ 音乐接口与登录），本设计按 WestPlay 原版架构（隐藏 WebView + 注入脚本 + 车内组件）落地。

## 1. 架构

- 新增 host 服务 `crates/host/src/qq.rs`，结构对齐 `netease.rs`：
  - 隐藏 WebView：`https://y.qq.com/`，独立 profile `webview2-qq`，注入 `qq.js` 与 `qq_sign_in.js`；
  - 登录：可见的登录窗口打开 `https://y.qq.com/`，用户点“登录”用 QQ/微信扫码；登录完成后关闭窗口，cookie 留在该 profile；
  - 数据：`qq.js` 在页面内用 `fetch` 调 QQ 官方接口（`credentials: 'include'`）；页面与接口同为 `qq.com` 站点，cookie 会带上；
  - 播放：像网易云一样用程序自己的 `<audio>` 播放解析出的音频 URL（先直出；3D 声场后续单独处理）。
- 为了让页面内跨域读取 `u.y.qq.com` 的响应，QQ 的隐藏 WebView 用 `OffscreenWebView::new_with_arguments(..., "--disable-web-security")` 创建（该参数只作用于 QQ 自己的 WebView2 环境；`webview.rs` 已加此能力并编译通过）。
- UI：复制车内 `netease` 组件目录为 `qq`（改类型/文案/图标），复用同一套“音乐 App”外观；companion 账号页增加 QQ 音乐登录行。

## 2. 接口（从 Mineradio 提取，均以 cookie 为该账号的登录态）

| 功能 | 接口 | 关键参数 |
| --- | --- | --- |
| 搜索 | `POST https://u.y.qq.com/cgi-bin/musics.fcg?sign=<qqSearchSign(body)>` | `comm{ct:11,cv:14090508,v:14090508,tmeAppID:'qqmusic',...}`，`req.module='music.search.SearchCgiService'`, `method='DoSearchForQQMusicMobile'`, `param{query,page_num,num_per_page,...}` |
| 搜索签名 | `qqSearchSign(text)`：SHA1(text) → 固定索引取字符 + 20 字节 XOR → base64 去 `\/+=` → `zzc…` 小写 | 需在浏览器里用 `crypto.subtle.digest('SHA-1')` 实现 |
| 歌曲详情 | `POST musicu.fcg`：`songinfo{module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param:{song_mid}}` | 拿 track_info（名称/歌手/专辑/封面/时长） |
| 播放地址 | `POST musicu.fcg`：`req_0{module:'vkey.GetVkeyServer',method:'CgiGetVkey',param{guid,songmid:[],songtype:[0],uin,loginflag:1,platform:'20',filename:[]}}`；`comm{uin,format:'json',ct:19/24,cv:0,authst:<qm_keyst>}` | 返回 `sip` + `midurlinfo[].purl`；URL = sip + purl |
| 我的歌单 | `c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss`（创建的歌单）/ `c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg`（收藏） | 需 cookie（uin/qm_keyst），Referer `https://y.qq.com/portal/profile.html` |
| 歌单歌曲 | `c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg`（playlist id） | `disstid`、`type=1`、`utf8=1` |
| 歌词 | `c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg` | `songmid`/`songid`，Referer `https://y.qq.com/` |
| 登录态 | 读取 cookie：`uin`/`qqmusic_uin`/`p_uin`、`qm_keyst`/`qqmusic_key`；或调资料接口验证 | VIP 还可用 `qq-vip-api.js` 的探测思路（读取 `vipType`/特权接口） |

请求头参考：`Referer: https://y.qq.com/`、移动端 UA（搜索接口用 `QQMusic 14090508(android 12)`）等。

## 3. 登录方案

1. companion/车内「账号」页点 QQ 音乐登录 → host 打开可见登录窗口（y.qq.com）；
2. 用户点页面登录，扫码授权；
3. `qq_sign_in.js` 每 1.5s 用 JSONP/接口验证登录（例如 `c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?format=jsonp` 或页面 DOM 的登录头像）；成功 → 关闭窗口并通知 host；
4. 隐藏播放页收到 `signedIn` 后重新加载/刷新状态；cookie 持久化在 `webview2-qq`。

## 4. 风险 / 待验证

- `--disable-web-security` 只影响 QQ 自己的 profile，但属于非常规手段；若不可接受，fallback 是 Rust 端 HTTP + WebView2 CookieManager（工作量大）。
- QQ 接口对 Referer/UA/签名敏感，可能随网页改版失效；需要真机调试。
- `qm_keyst` 可能是 HttpOnly，JS 读不到；vkey 的 `comm.authst` 可能因此拿不到 → 先试不带 `authst`（匿名/低音质可取），VIP 音质再走 Rust 侧或 profile。
- 页面与 `u.y.qq.com` 虽同站，但 `--disable-web-security` 下 cookie 是否随跨域 fetch 发送需要真机验证。
- 账号登录/歌单数据均只在用户自己账号权限内，不绕过版权。

## 5. 实现步骤

1. ~~`webview.rs` 支持每个 WebView 自己的浏览器参数~~（已完成，`cargo check -p westplay-host` 通过）；
2. `qq.rs` 骨架：State/Question/Answer/Item/Track/Playback/Command + 单测；`qq.js` 先做搜索/歌曲详情/播放地址/列表；
3. host 接线（lib.rs）+ 登录窗口 + companion 账号页；
4. 车内 QQ 音乐组件（复制 netease 组件改造）；
5. 歌单/收藏/歌词/VIP 状态；列表连续播放；
6. 真机验证 + CI 构建。
