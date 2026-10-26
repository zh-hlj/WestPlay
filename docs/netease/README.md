# 网易云音乐接入（host 侧）：方案、决策与交付

> 状态：**设计 + host 侧代码 + 接线已落地**（`lib.rs` 等现有文件已由 Lead 按 [`rust-wiring.md`](rust-wiring.md) 接线；
> **未编译验证**：本机无 Rust 工具链、无 MSVC，必须先在 Windows 开发机上 `cargo check`/`cargo test`）。
> 目标版本：WestPlay v2.0.3（分支 `feat/netease-zh`，GPL-3.0-or-later）。
> 本任务写入范围：`crates/host/src/netease.rs`、`netease.js`、`netease_sign_in.js`、`docs/netease/`；接线改动见
> `crates/host/src/{lib,signin,performance,customize}.rs`、`app/src/main.rs`、`ui/src/hostScripts.test.ts`。
> 真机验证见 [`verification.md`](verification.md)。

## 0. 结论（TL;DR）

1. **路线 A（采用）**：与仓库里 Spotify / Apple Music / YouTube Music 完全相同的模式——把网易云官方网页播放器
   （`https://music.163.com/`）放进一个隐藏的 WebView2（独立 profile `webview2-netease`），由注入脚本
   `netease.js` 读页面状态、点页面自己的按钮播放、用页面自己的 cookie 同源请求 `/api/...` 答题；host 把
   `state / answer / playback` 转成 cabin 消息，把声音交给 `cab_sound.js`（车内扬声器 3D 声）。**不抓加密接口、
   不逆向、不下盗版、不绕会员/地区限制**，页面放不了的就放不了。
2. **两个网页版本**：旧版网页播放器（`#g_player` 顶层播放条 + `#g_iframe` 内容框架）仍是 `music.163.com/`
   默认返回的页面（2026-10-26 实测抓取到播放条控件文案），是本次实现目标；网易 2025-11 悄悄上线的**新版全功能
   Web 播放器**（PWA，入口在下载页的 “Linux”）DOM 完全不同，列为后续里程碑，脚本目前在新版上只能报登录态和
   答题，不能控制播放（`TODO(verify)`）。
3. **协议与现有 App 有三处形状差异**（详见 §6）：时长用毫秒、`artists` 用字符串数组、页面→host 的
   `state`/`answer` 用包装对象；`netease.rs` 两种形状都读，UI 侧只需按本文 §6 的类型来写。
4. **主要风险**：网页改版（选择器失效）、网易风控/ToS（§7.3）、VIP/版权/地区灰歌/广告/音质（§8）。这些
   风险是产品性的，不是本实现的 bug；UI 必须如实显示“不可播/试听”，不能假装成功。
5. **工作量**：host 骨架 + 文档（本任务）约 0.5–1 人日；接线到可编译约 0.5 人日；旧版真机可用 +1–2 人日；
   搜索/歌词/歌单 +1–2 人日；新版网页播放器适配 +2–4 人日（最不确定）；稳定性收尾 +1–2 人日。

## 1. 目标与范围

**目标**：让舱内 UI 里有第四个音乐应用——网易云音乐。用户登录自己的网易云账号后，能在车机屏幕上浏览推荐、
搜索、看歌单/专辑、播放/暂停/切歌/拖进度/调音量/随机/循环，听到的仍是自己账号有权限听的内容，声音从车内
扬声器出来（与现有三个音乐 App 一致体验）。

**本任务交付（host 侧）**：

| 文件                                 | 内容                                                                                                                                                                                                            | 状态                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `crates/host/src/netease.rs`         | `Command/Question/Answer/Playback/Home/...` 数据模型、`Netease` 结构体、`start/command/cab/take_reports/failed/close/view`、`Message/read_message`、`state_message/answer_message/playback_message`、serde 单测 | 新增，未编译                  |
| `crates/host/src/netease.js`         | 注入桥：页面播放条 + `mediaSession` + 媒体元素读状态；页面按钮控制；同源 `/api` 搜索/歌单/专辑/歌词；答问；上报；`cab_sound` 接管                                                                               | 新增，`new Function` 语法通过 |
| `crates/host/src/netease_sign_in.js` | 登录窗口里轮询登录态（`/api/nuser/account/get` 优先、DOM 兜底），成功后 `post({signedIn:true})`                                                                                                                 | 新增，`new Function` 语法通过 |
| `docs/netease/README.md`             | 本文：方案、决策、风险、里程碑                                                                                                                                                                                  | —                             |
| `docs/netease/rust-wiring.md`        | `lib.rs`/`signin.rs`/`performance.rs`/`customize.rs`/`app/src/main.rs`/`hostScripts.test.ts` 逐处接线片段与行号                                                                                                 | —                             |
| `docs/netease/verification.md`       | Windows 真机验证清单与验收标准（本环境无法执行）                                                                                                                                                                | —                             |

**不在本任务范围**（这些已在同一分支由其他任务/Lead 完成）：舱内 UI（`ui/src/cabin/apps/netease/...`、
`ui/src/shared/host.ts` 类型、图标/文案/中文化）、`lib.rs` 等现有文件的接线、新版 Web 播放器适配、任何绕版权/会员/风控的手段。

## 2. 路线 A：官方网页播放器 + 注入桥 + 原生皮肤

### 2.1 为什么这条路

仓库里三个音乐 App 已经验证过同一条路，组件与约束都现成：

- **隐藏的 WebView2 仍在运行**：`OffscreenWebView::show(false)` 只是不显示，页面与音频照常跑（Spotify、Apple
  Music 的实测结论，见 `spotify.rs` 头注释与 `CHANGELOG` 2.0.3 的 Spotify 音量修复）。
- **登录留在页面里**：`signin.rs` 打开服务自己的登录页，cookie 留在 WebView2 的 profile 里；WestPlay 只看
  “窗口还在/已登录/已关闭”。网易云用扫码登录，天然适合这个窗口（PC 上弹二维码，手机 App 扫）。
- **页面脚本有完整的页面权限**：注入脚本与页面同源、共享 cookie，因此 `/api/search/get`、`/api/song/lyric`
  这类页面自己用的接口可以直接 `fetch`，不需要 weapi/eapi 加密算法，也不需要第三方 API 服务。
- **声音接管现成**：`cab_sound.js` 只要拿到“当前发声的 `HTMLMediaElement`”和 `post`，就能把声音接进车内
  扬声器/头部 HRTF/车外闷音/均衡器，并回传频谱。网易云网页播放器用的是普通 `<audio>`（无 DRM），正好适用。

### 2.2 数据流

```
 cabin UI（WestPlay 自己的网易云 App）
   │  host 命令: {type:'netease', command:{action:…}}            ▲  host 消息:
   ▼                                                              │  netease / neteaseAnswer / neteasePlayback
 host thread（lib.rs，见 rust-wiring.md）
   │  post_json(command)                                          ▲ take_reports()/take_page_messages()
   ▼                                                              │
 OffscreenWebView（独立 WebView2 profile: data_dir/webview2-netease）
   │  music.163.com（旧版：顶层 #g_player 播放条 + #g_iframe 内容框架）
   │  启动脚本 = cab_sound.js + netease.js（add_startup_script）
   │
   ├─ 读：navigator.mediaSession.metadata、#g_player DOM、页面自己的 <audio>
   ├─ 控：页面自己的按钮（播放/暂停/上一首/下一首/循环/随机）＋ <audio>.currentTime/volume
   ├─ 问：fetch('/api/search/get' …)、'/api/v6/playlist/detail'、'/api/album/<id>'、'/api/song/lyric'（页面 cookie）
   ├─ 答：post({answer:{id, home|search|collection|lyrics}}) / {answer:{id, failed:true}}
   ├─ 报：post({state:{signedIn,playing}}) / {playback:…} / {ready:true} / {signIn:true} / {speakers}
   └─ 声：window.westplayCabSound(() => findPlayback(), post)
```

`netease.rs` 与现有 `spotify.rs` 同构：`HOME`、`Command`、`Question`、`Answer`、`Playback`、`State`、`Report`、
`Cab`（speakers/head/outside/equalizer/spectrum）、`Told`（页面重载后重发）、`Unanswered`（问题在页面重载后重问）、
`SignInWindow` + `Confirming`（登录窗口与确认）。

### 2.3 生命周期（与现有音乐 App 一致）

- **首次使用**：UI 发 `{action:'start'}`（或任何非 `pause` 命令）→ host `start_netease` 建 WebView、注入脚本、
  导航到 `https://music.163.com/`，日志 `[netease] opened` / `[netease] page loaded (music.163.com)`。
- **页面就绪**：`netease.js` post `{ready:true}` → host 重发 cab（speakers/head/…）和未答的问题。
- **登录**：UI 发 `signIn` → host 打开 520×760 桌面窗口，加载 `https://music.163.com/`，`netease_sign_in.js`
  自动点页面“登录”、轮询账号接口，登录成功 post `{signedIn:true}` → host 关闭窗口、`navigate(HOME)`、进入
  `Confirming`（最多 20 秒等页面说已登录）。
- **使用中**：`take_reports` 每圈处理 state/answer/playback/spectrum；`cab()` 每圈按司机头部/车辆/镜头/音调变化
  下发；`PlayLog` 只记“加载/播放/暂停/下一首/位置”，不记曲目名（`play_log.rs` 只比较不写）。
- **游戏退出**：`players_closing` → host 关闭网易云 WebView，UI 收到 `state:null` + `playback:null`；重新打开
  游戏/UI 时按需再启动。
- **WebView 崩溃**：`failed()` → 关闭并从 `Option<Netease>` 移除，UI 的下一次命令会重启它。

### 2.4 独立 profile 的理由

`data_dir/webview2-netease`（与 `webview2-spotify`、`webview2-apple-music` 并列）。网易的 cookie 独立，退出登录
只清网易的；也不会影响 cabin 页面与 YouTube 共用的 `webview2` profile。歌单/会员信息全部留在网易自己的
profile 里，WestPlay 不落盘、不打印。

## 3. 两个网页版本：旧版 vs 新版 PWA

|            | 旧版网页播放器                                                                                       | 新版全功能 Web 播放器（PWA）                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 入口       | `https://music.163.com/`（默认仍是它）                                                               | 2025-11 低调上线；入口藏在 `https://music.163.com/#/download` → “Linux”，可“安装”为 Web App                  |
| 顶层结构   | 顶栏 + **`#g_player` 播放条** + `#g_iframe`（同源 iframe，hash 路由 `#/song?id=`、`#/playlist?id=`） | 与桌面端 3.0 几乎一致的单页应用；无 `#g_player`、无 `#g_iframe`                                              |
| 播放条控件 | `.btns a.prv/.ply                                                                                    | .pas/.nxt`，`.words`（歌名/歌手）、`.head img`（封面）、`.time`（时间）、循环/收藏/分享/随机、播放列表按钮   | 未知（`TODO(verify)`，需要真机抓 DOM） |
| 音质       | 网页端可到 SQ（无损）/HQ；更高音质/部分 VIP 音质仅客户端                                             | 有用户反馈仅 SQ（`TODO(verify)`）                                                                            |
| 本实现     | **目标版本**：`netease.js` 全部逻辑按它的选择器写                                                    | 只保证：登录态上报、search/lyrics/collection/home 问答（同源 API 相同）；播放控制、播放状态、封面/歌名待适配 |

**决策**：先做旧版。原因：旧版结构简单、`#g_player` 用 DOM 就能读播放状态、页面自己的 hash 路由能把内容加载
进 `#g_iframe` 再点页面自己的按钮；新版是 React 单页应用，DOM 无稳定契约，且网易随时可能替换入口。README
不把“新版适配”当已完成，脚本里用 `old()`/`TODO(verify)` 标注了边界。

**新版的回退策略**（里程碑 M4 再定）：

1. 若新版仍是 `music.163.com` 同源：问答可复用；播放统计可退化为 `mediaSession.metadata`（有歌名/歌手/封面，
   但拿不到网易歌曲 id），控制退化为 `HTMLMediaElement.play/pause/currentTime`（队列由页面自己维护，能听）。
2. 若新版换域名（如 `web.music.163.com`）：`netease.js` 的 hostname 守卫要同时放行新域名，或给新版单独一份
   脚本；host 的 `HOME`/`signin::NETEASE` 也要改。**入口是否在 `music.163.com` 下需真机确认（`TODO(verify)`）**。
3. 若两者都不可注入：退化为“网易云外链到浏览器”，不放进舱内（不作为默认方案）。

### 3.1 `#g_iframe` 双 frame 注入差异（重要）

- `webview.rs` 的 `add_startup_script` 用 WebView2 的
  `AddScriptToExecuteOnDocumentCreated`，**对顶层文档和每个子 frame 的文档创建都执行**（WebView2 文档）。
  因此 `cab_sound.js + netease.js` 会在 `#g_iframe` 里也执行一遍。
- `netease.js` 第一行是 `if (location.hostname !== 'music.163.com' || window.top !== window) return`：**只有顶层
  跑**，iframe 里直接退出。这与现有四个注入脚本的守卫一致。
- **为什么顶层就够**：`#g_iframe` 与顶层同源，顶层脚本可以直接 `document.getElementById('g_iframe').contentDocument`
  拿到内容页 DOM（`netease.js` 的 `frame()`）。播放条在顶层，内容页只用来“找按钮点一下”。
- **若将来需要在 iframe 里跑脚本**（例如新版把播放条也放进内容页、或要监听渲染后的列表）：
  - 需要第二份脚本（或同一个文件里 `if (window.top === window) {顶层逻辑} else {iframe 逻辑}`）；
  - iframe 里的 `post` 也能到 host（WebView2 的 `chrome.webview.postMessage` 在子 frame 可用，但**每条消息没有
    frame 标识**，host 不区分来源，`read_message` 必须按形状嗅探——本实现已经这样写）；
  - 每个 frame 都会 post 一次 `{ready:true}`，host 的 Ready 重发逻辑要幂等（本实现重发 cab 和未答问题，幂等）；
  - **不要把 iframe 里的 `window.top` 守卫去掉后直接在 iframe 里读 `#g_player`（那里没有）**。
- `TODO(verify)`：真机上用 `webview.evaluate("document.getElementById('g_iframe').contentDocument !== null")`
  确认同源可访问；以及 WebView2 子 frame 的 `chrome.webview` 是否随版本可用（本实现不依赖）。

## 4. 登录

- 复用 `signin.rs` 的 `SignInWindow`：桌面 520×760 窗口，WebView 的 profile 与页面 WebView 相同
  （`SignInWindow::open(self.view.environment(), &signin::NETEASE)`）。
- `signin::NETEASE` 的地址是 `https://music.163.com/`，`page_says = Some(include_str!("netease_sign_in.js"))`：
  网易登录是页面内弹层（hash/遮罩，不换地址），所以只能靠页面脚本判断已登录（与 Apple Music 的 `page_says`
  模式相同），不能用 `progress_at` 按 URL 判断。
- `netease_sign_in.js`：
  1. 每 500 ms 查一次登录态：优先 `fetch('/api/nuser/account/get')`（页面自己用的接口，`{account:…}`），失败/不
     可用时用 DOM 标记（`a[href*="/user/home"]` 等）兜底；`TODO(verify)` 选择器与接口。
  2. 未登录时自动点页面自己的“登录”（`#showLogin, .m-top .login, [data-action="login"]`），弹出二维码。
  3. 检测到已登录 → `post({signedIn:true})`，最多重复 3 次（间隔 300 ms）；10 分钟超时后静默放弃（窗口仍开着，
     用户可以关闭或继续扫）。
- host 收到 `SignedIn` → 关窗口 → `navigate(HOME)` → `Confirming`（20 s 内页面说已登录即确认，见
  `signin.rs::Confirming`）。退出登录：`delete_cookies()`（只清网易 profile）+ 重新导航。
- **隐私**：账号、昵称、二维码 token、cookie 都不经过 host；host 只知道“是否已登录”。`Status` 只加
  `neteaseSignedIn`/`neteaseSigningIn` 两个字段；日志不打印账号。

## 5. 数据来源：页面 DOM + mediaSession + 同源 API

### 5.1 播放状态（页面 → host）

优先级从高到低：

1. **页面的 `<audio>` 元素**（`netease.js::findPlayback`）：`paused/ended/currentTime/duration/volume`。旧版网页
   播放器的音频元素不在播放条 DOM 里，是页面 JS 动态建的，所以脚本 hook 了
   `HTMLMediaElement.prototype.play` 与 `playing` 事件，把所有碰过的元素收进 `KNOWN`，取“正在响的那个”。
2. **`#g_player` 播放条 DOM**：歌名（`.words a.name`）、歌手（`.words a[href*="/artist?id="]`）、封面
   （`.head img`）、播放/暂停状态（播放按钮 `.pas` class）、歌曲 id（播放条里 `/song?id=` 链接）。
3. **`navigator.mediaSession.metadata`**：歌名/歌手/专辑/封面兜底（控件由页面自己设置）。

`TODO(verify)`：旧版播放条的确切 class（`.words` 内部结构、`.time` 文案格式、`.pas` 语义）；`duration` 在
`loadedmetadata` 之前是 `NaN`（脚本已按 0 处理）。

### 5.2 同源 API（页面 cookie 签名）

只使用页面自己用的、非加密的 `/api/...` 地址（同源 `fetch`，带 cookie）：

| 用途             | 地址                                                                                          | 说明                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 登录态           | `GET /api/nuser/account/get`                                                                  | `{account: null}` / 账号对象；登录窗口轮询用它                |
| 搜索             | `GET /api/search/get?s=…&type=1                                                               | 10                                                            | 100 | 1000&offset=0&limit=20` | 歌曲/专辑/歌手/歌单各查一次；`type` 数字与返回字段需真机核对 |
| 首页推荐         | `GET /api/personalized/playlist?limit=12`、`GET /api/personalized/newsong?limit=12`           | 推荐歌单/新歌；可能受登录/地区影响                            |
| 歌单页           | `GET /api/v6/playlist/detail?id=<id>&n=0&s=0` → `trackIds`，再 `GET /api/song/detail?ids=[…]` | 歌单曲目可能上千，取前 200 首                                 |
| 专辑页           | `GET /api/album/<id>`                                                                         | `album` + `songs`                                             |
| 歌词             | `GET /api/song/lyric?id=<song>&lv=1&kv=1&tv=-1`                                               | `lrc.lyric` 为 `[mm:ss.xxx]` LRC；转换成 `lyrics::Lyrics`     |
| （未用）播放地址 | `/api/song/enhance/player/url`                                                                | **不用**：不自己拉流、不绕过页面播放器，避免绕过会员/地区判断 |

**兼容两种字段形状**：网易 API 新旧字段并存（`artists`/`ar`、`album`/`al`、`duration`/`dt`、`picUrl`），脚本
两者都读（`TODO(verify)`）。

**封面地址统一升级为 `https://`**：网易 CDN（`p1.music.126.net` 等）同时支持 http/https，cabin 页面是
`https://westplay.cabin`，http 封面会被浏览器拦截；`netease.rs` 只放行 `https://` 的图片地址（其余的置空）。

### 5.3 不做的数据来源

- **页面 `<script>` 里的 webpack 模块 / 加密 weapi/eapi**：不碰。改版即失效，且容易踩 ToS 与风控。
- **第三方 API 服务器**（`NeteaseCloudMusicApi` 等）：见 §7。
- **`#g_iframe` 内容页的渲染 DOM 抓取**：MVP 不用；同源 API 更稳。保留以后需要“页面当数据源”时的入口
  （`netease.js::frame()`）。

## 6. 协议（与 UI 任务的共享约定）

### 6.1 host → page 命令（serde tag=action、camelCase）

```
start | signIn | signOut | ask{id,question} | play{song?,playlist?} | pause | resume | next | previous
| seek{seconds} | volume{percent} | shuffle{on} | repeat{mode:off|all|one}
```

- `play` 两个字段都可缺：`{song}` 单曲、`{playlist}` 整单、`{playlist,song}` 单曲+上下文、都不给 = 继续播。
- `pause` 与 `resume` **分开**（现有 Spotify/YouTube Music 是 `play` 不带参数即 resume）；`netease.js` 两者都实现。
- 只有 `start/signIn/signOut` 是 host 自己处理（`Command::for_page()` 为 false）；`seek/volume` 传
  `NaN/Infinity` 不会到页面（`is_finite` 校验）。

### 6.2 Question

```
{ask:'home'} | {ask:'search',query} | {ask:'lyrics',song} | {ask:'collection',id}
```

- `song`/`id` 是网易数字 id 的十进制字符串（`netease.rs::is_id`：1–20 位数字、不全 0）。
- `collection`：id 可能是歌单也可能是专辑（id 本身不区分），脚本先试歌单接口、失败再试专辑；两边都不是 →
  `failed:true`。
- `home`/`search` 的返回见 §6.4；`lyrics` 复用 `crates/host/src/lyrics.rs` 的 `Lyrics`。

### 6.3 page → host 消息（本实现的实际形状）

| 消息     | 形状                                                                    | 说明                                                                             |
| -------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ready    | `{"ready":true}`                                                        | 页面脚本首次就绪（旧版：等 `#g_player` 出现，最多 15 s）                         |
| state    | `{"state":{"signedIn":true,"playing":false}}`                           | **包装在 `state` 里**；host 也兼容现有 App 的平铺 `{"signedIn":…,"playing":…}`   |
| answer   | `{"answer":{"id":3,"home":{…}}}` 或 `{"answer":{"id":3,"failed":true}}` | **包装在 `answer` 里**；host 也兼容 `{"answer":3,"home":{…}}`                    |
| playback | `{"playback":{…}}` / `{"playback":null}`                                | 与现有 App 相同                                                                  |
| signIn   | `{"signIn":true}`                                                       | 用户点了页面自己的“登录”链接，请 host 开桌面登录窗口                             |
| speakers | `{"speakers":"through the speakers (audio)"}` 等                        | 供日志诊断；host 只接受三种白名单文案                                            |
| spectrum | `{"spectrum":[…]}`                                                      | `cab_sound.js` 均衡器频谱（`speakers::read_spectrum` 处理，不进 `read_message`） |

**与现有代码不一致（Lead 请留意）**：

1. **`state`、`answer` 用包装对象**（任务书 `{state:{…}}` / `{answer:{id,failed?}}` 的字面形状），而现有
   Spotify/YouTube Music 是平铺（`{signedIn,playing}`、`{answer:<id>,home:…}`）。`netease.rs::read_message`
   **两种都读**，所以 UI/页面任一侧改形状都不会挂；但 `neteaseAnswer` 发往 cabin 的消息仍是平铺
   `{type:'neteaseAnswer', id, …}`（与 spotifyAnswer 一致）。
2. **时长单位是毫秒**（`Track.durationMs`、`Playback.positionMs/durationMs`）；现有 Spotify/Apple Music 是秒、
   YouTube Music 是秒。`lib.rs` 接线时给 `play_log::Heard.position` 要除以 1000（wiring 文档已写）。
3. **`artists` 是字符串数组**（`Track.artists: string[]`），现有 Spotify 是 `{uri,name}[]`、YouTube Music 是
   逗号分隔字符串。UI 直接 join 显示即可。
4. **没有 `color` 字段**（现有 App 用封面主色洗页面）；网易 API 不给主色，UI 需自己从封面取色或退回主题色。
5. **没有 `save/like` 命令、没有 `show/hide`（视频画面）、没有 `jump(index)`、没有 `language`**：本阶段不做。
   UI 上对应按钮应隐藏/禁用（或在 UI 任务定义后追加命令）。

### 6.4 数据模型（Rust 序列化后的 JSON 字段）

```jsonc
// Item
{"id":"3778678","kind":"playlist","name":"欧美私人订制","by":"","image":"https://…", "description":null}
// kind: song | playlist | album | artist | radio
// Track
{"id":"185809","name":"Şımarık","artists":["Tarkan"],"album":"Ölürüm Sana","image":"https://…",
 "durationMs":240500,"saved":true}   // saved 可缺省
// Home
{"sections":[{"title":"推荐歌单","items":[…Item…]}]}
// Results
{"songs":[…Track…],"playlists":[…Item…],"albums":[…Item…],"artists":[…Item…]}
// Collection
{"item":{…Item…},"tracks":[…Track…]}
// Playback
{"track":{…Track…}|null,"context":{"id":"3778678","name":"","kind":"playlist"}|null,
 "playing":true,"positionMs":12500,"durationMs":240500,"volume":0.5,"shuffle":false,"repeat":"all","next":[]}
// State（仅 page→host，不发给 cabin）
{"signedIn":true,"playing":false}
```

cabin 消息（与现有 App 一致）：

```jsonc
{"type":"netease","signedIn":true,"playing":false,"signingIn":false}   // null 字段：没在跑
{"type":"neteaseAnswer","id":3,"home":{…}}                             // 失败：{"type":"neteaseAnswer","id":3,"failed":true}
{"type":"neteasePlayback","playback":{…}}                              // 无播放：playback:null
```

> 落盘时（2026-10-26）UI 任务已在工作区加了 `ui/src/shared/host.ts` 的 `Netease*` 类型与 `ui/src/shared/icons.ts`
> 的 `netease` 图标角色，逐字段核对与本模块一致（`NeteaseKind` 的 `radio` 已在 `netease.rs::Kind` 补上；消息名
> `netease`/`neteaseAnswer`/`neteasePlayback`、`HostCommand` 的 `{type:'netease',command}` 均对齐）。

## 7. 路线 B：第三方 API（备选，不采用为默认）

### 7.1 是什么

社区维护的网易云“逆向 API”（最知名的是 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)，
另有 [simple-cloud-music](https://github.com/dufu1991/simple-cloud-music) 这类完整第三方播放器）：在本机/远程跑
一个 Node 服务，封装 weapi/eapi 加密，提供 `/search`、`/playlist/detail`、`/song/url`、二维码登录等接口。

### 7.2 优点

- 与网页改版解耦，数据形状稳定、字段完整（播放地址、码率、VIP 标记、`privilege`）。
- 不依赖 WebView2 里的页面，UI 响应快；不需要 iframe 注入。
- 社区验证过核心接口，维护者多。

### 7.3 缺点与风险（不采用的理由）

- **ToS 与封号**：网易云音乐《音乐服务条款》（生效 2023-11-01）明确禁止
  “通过非网易公司开发、授权或认可的第三方兼容软件、系统登录或使用网易云音乐软件或服务，或……使用非网易
  公司开发、授权或认证的插件”（8.5(1)）、“反向工程……获取源代码”（8.5(3)）、“对……客户端与服务器端的交互
  数据进行复制、更改、修改”（8.5(5)）；违反可暂停/终止服务、**封禁或注销账号**（8.6、3.7）。第三方 API 的
  `song/url` 这类接口通常还涉及绕过 VIP/地区/版权判断，违反程度更重。
- **风控**：接口频繁变更、需要设备指纹/加密参数、登录态易失效；第三方服务器 IP 被封会连累账号。
- **技术与分发**：要么内置 Node 服务（安装包 +30 MB、Windows 服务生命周期、端口/防火墙），要么依赖外部服务
  （用户数据/账号 cookie 交给第三方，隐私问题更严重）。
- **License/合规**：社区项目多为 MIT，但 GPL-3.0 的 WestPlay 引入逆向实现仍需自行评估；产品层面等于鼓励
  用户违反服务条款。
- **本实现与路线 A 的边界**：路线 A 也不等于“被网易官方认可”，只是**用官方网页播放器播官方网页能播的内容**，
  没有伪造请求、没有解密、没有绕过付费；这已是风险最低的可行形态。

**结论**：不采用路线 B 作为默认。若将来旧版网页播放器彻底下线、新版又无法注入，再以“可选高级功能、用户自行
承担风险”的方式评估；此前的兜底是外链浏览器打开网易云网页版。

## 8. 账号/版权/区域/广告/音质约束（如实呈现，不绕过）

| 约束                   | 表现                                                                          | host/UI 的做法                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VIP / 付费歌曲**     | 非会员播放 VIP 歌：网页播放器只给 30 s 试听，或提示开通会员；部分歌直接不可播 | host 只转发页面真实状态（`durationMs` 可能异常/试听时长）；UI 显示“试听/VIP”由 UI 任务按 `Track` 或后续字段判断，**不伪造播放成功**。`TODO: 协议未含 fee/privilege，若 UI 需要再加字段** |
| **版权灰歌（无版权）** | 歌单/搜索里能看见，播放时提示“因版权方要求无法播放”                           | 页面不播 → `playback` 保持上一首/空；`play` 命令不报错（页面自己弹提示，窗口是隐藏的，故 host 可考虑回一个失败态，见 `TODO`）                                                            |
| **海外/地区限制**      | 海外 IP 大量灰歌、仅试听；部分接口返回空                                      | 与灰歌相同，如实失败；不代理、不改 IP                                                                                                                                                    |
| **广告**               | 网页播放器可能插音频/贴片广告；`mediaSession.metadata` 可能变成广告信息       | 不实现去广告、不拦截。UI 若看到异常曲名可忽略；`playback` 仍按页面真实内容上报。`TODO(verify)` 广告期间播放条 DOM 是否变化                                                               |
| **音质**               | 网页端可用 SQ/HQ；更高（Hi-Res/沉浸声）仅客户端；VIP 音质受限                 | 不提供音质选择（命令协议没有）；用户账号有什么听什么                                                                                                                                     |
| **下载**               | 网页端下载受限                                                                | 不实现                                                                                                                                                                                   |
| **账号风险**           | 网页端登录、正常操作风险最低；外挂/伪造请求风险高                             | 不注入任何伪造请求；只调用页面自己也在用的接口                                                                                                                                           |

**产品口径建议**：网易云入口文案写“网页版：VIP/部分歌曲按网易云网页版规则播放”，避免用户以为 WestPlay
能解锁会员曲库。

## 9. 与现有音乐 App 的实现差异（给 UI/接线的提醒）

| 项                     | Spotify         | YouTube Music     | **网易云**                     |
| ---------------------- | --------------- | ----------------- | ------------------------------ |
| 网页播放器 profile     | 独立            | 与 cabin 共用     | **独立**（`webview2-netease`） |
| 时长单位               | 秒              | 秒                | **毫秒**                       |
| 歌手类型               | `{uri,name}[]`  | 字符串            | **`string[]`**                 |
| 主色 `color`           | 有              | 有                | **无**                         |
| 主页是否带 chips       | 有              | 有                | **只有 `sections`**            |
| 页面→host state/answer | 平铺            | 平铺              | **包装对象**（host 两种都读）  |
| 播放控制方式           | Spotify Connect | 页面 player API   | **按钮点击 + `<audio>`**       |
| 登录检测               | 窗口 URL        | 窗口 URL          | **页面内 `page_says` 脚本**    |
| 是否支持视频画面       | 否              | 是（`show/hide`） | 否                             |
| 是否有 `save/like`     | 是              | 是                | **否（本阶段）**               |
| `next[]` 队列          | Connect 给      | 页面队列给        | **空（`TODO(verify)`）**       |

## 10. 里程碑与工作量

| 里程碑                        | 内容                                                                                                                                                                                  | 估算               | 依赖/风险                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| **M0 本任务**                 | host 骨架 + 注入脚本 + 登录脚本 + 三份文档                                                                                                                                            | 0.5–1 人日         | 无（本环境无 Rust 工具链，未编译）                               |
| **M1 接线（已落地，待编译）** | Lead 已按 `rust-wiring.md` 改 `lib.rs`/`signin.rs`/`performance.rs`/`customize.rs`/`app/src/main.rs`/`hostScripts.test.ts`；**尚未** `cargo check`/`cargo test`（本机无 Rust 工具链） | 0.5 人日（待验证） | 行号漂移；`Profile` 新枚举必须补 match 臂                        |
| **M2 旧版真机可用**           | WebView2 加载旧版、登录扫码、播放/暂停/切歌/音量/进度、状态上报、cab 出声                                                                                                             | 1–2 人日           | **选择器未验证**（`.pas`、`.words`、按钮）；`#g_iframe` 同源访问 |
| **M3 浏览/搜索/歌词**         | home/search/collection/lyrics 接口形状核对、错误兜底、封面 https、200 首截断、性能                                                                                                    | 1–2 人日           | `/api` 参数与字段随页面变化                                      |
| **M4 新版 PWA 适配**          | 抓 DOM/网络、决定复用或单独脚本、入口域名判定                                                                                                                                         | 2–4 人日           | **最不确定**；可能只能做播放统计+媒体元素控制                    |
| **M5 稳定性与边角**           | VIP 试听/灰歌/广告/海外、长播、游戏退出重开、WebView 崩溃恢复、日志与隐私复核                                                                                                         | 1–2 人日           | 风控、网易改版                                                   |

合计约 **6–11 人日**（不含 UI 任务；UI 另计）。

## 11. 风险与回退

| 风险                             | 影响                                 | 缓解 / 回退                                                                                                       |
| -------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 旧版网页播放器下线/改版          | 选择器全失效，播放状态读不到         | README 已记录；注入脚本按“能读到多少报多少”降级；M4 适配新版；最终回退外链浏览器                                  |
| 网易风控（高频 `/api`、自动化）  | 账号被限流/封禁                      | 只做用户动作触发的请求；问答带重试但最多 2 次；不轮询搜索；不批量拉歌单（200 首上限）；页面自身用户态请求不篡改   |
| ToS 争议                         | 产品合规风险                         | 不逆向、不伪造、不绕过付费；入口文案说明“网页版规则”；参考条款链接见 §12                                          |
| 登录二维码在隐藏窗口/桌面窗口    | 用户看不到                           | 登录窗口是**桌面窗口**（`signin.rs` 的 520×760），不是隐藏 WebView，扫码可见                                      |
| `cab_sound.js` 拿不到媒体元素    | 车内 3D 声无效（声音仍从默认输出出） | hook `play`/`playing` 收集元素；`tick()` 每 250 ms 重找；日志 `[netease] speakers: no media element found` 可诊断 |
| 多实例/多 profile WebView2 内存  | 内存上涨                             | 与现有三个音乐 App 同策略：按需启动、游戏退出即关                                                                 |
| WebView2 子 frame 消息来源不区分 | 消息混淆                             | `read_message` 只做形状嗅探 + 白名单，不信任内容；`netease.js` 只在顶层运行                                       |

## 12. 参考链接

**仓库与实现样板**

- WestPlay 仓库（GPL-3.0-or-later）：https://github.com/enes-less/WestPlay
- 本仓库内样板：`crates/host/src/spotify.rs`、`spotify.js`、`youtube_music.rs`、`youtube_music.js`、
  `apple_music_sign_in.js`、`signin.rs`、`cab_sound.js`、`lyrics.rs`
- WebView2 `AddScriptToExecuteOnDocumentCreated`（注入到顶层与子 frame 的行为）：
  https://learn.microsoft.com/microsoft-edge/webview2/reference/win32/icorewebview2#addscripttoexecuteondocumentcreated

**网易云官方 / 条款**

- 旧版网页播放器：https://music.163.com/ （2026-10-26 抓取仍返回旧版布局文案：上一首/播放暂停/下一首/收藏/分享/随机）
- 新版全功能 Web 播放器入口：https://music.163.com/#/download → “Linux”（2025-11 上线，社区实测）
- 网易云音乐《音乐服务条款》（生效 2023-11-01，第三方软件/插件、逆向、数据复制条款见 8.5；封禁见 3.7/8.5/8.6）：
  https://y.music.163.com/g/yida/6f6572a0d6cb4254b2d445507158e11f
- 网易云音乐官方授权/开放文档（云村交易所，授权接入与接口说明；**不是**公开可用的免费 API）：
  - http://music.163.com/st/sublicense-doc/open-doc/online-play/api-interfeace
  - http://music.163.com/st/sublicense-doc/open-doc/origin-data/api-interface

**社区资料 / 新闻**

- IT之家：网易云音乐 2024-08-19 故障（网页端 502、App 不可用，反映网页端仍在服务）：
  https://www.ithome.com/0/789/489.htm
  - 说明：任务书提到的“IT之家停更报道”在本环境检索不到一手来源（`web_search` 只找到上面这篇故障报道）。
    **不要把“网页版已停更”当事实**；本文只采用可核实的“新版 PWA 上线 + 旧版仍在线”两个事实。
- deepin 论坛：网易云音乐低调上线新的 Web 播放器（2025-11-19）：
  https://bbs.deepin.org.cn/zh/post/293411
- NGA 讨论：给 Linux 做的单独网页版：
  https://bbs.nga.cn/read.php?tid=46535605

**第三方 API（路线 B 参考，不采用）**

- NeteaseCloudMusicApi：https://github.com/Binaryify/NeteaseCloudMusicApi
- simple-cloud-music（第三方播放器）：https://github.com/dufu1991/simple-cloud-music

## 13. 待办清单（按优先级）

1. **编译并在开发机验证**（M1；接线已由 Lead 落地）：`cargo check -p westplay-host`、`cargo test -p westplay-host`、
   `cd ui; npm test -- hostScripts`，修掉只有编译才能发现的类型/借用问题（命令见 `rust-wiring.md` §8）。
2. **真机验证选择器**（M2）：`#g_player`、`.pas`、`.words`、`.head img`、`.time`、`.prv/.nxt`、`.u-btni-play`、
   `#g_iframe.contentDocument`；把 `TODO(verify)` 逐个转成确认的常量。
3. **`/api` 形状核对**（M3）：`search/get` 的 `type` 数字与返回、`personalized/*`、`v6/playlist/detail`、
   `song/detail`、`song/lyric`。
4. **登录态确认**（M2）：`/api/nuser/account/get` 在 WebView2 profile 里是否可用；DOM 兜底选择器。
5. **新版 PWA 调研**（M4）：入口域名、DOM、`mediaSession`、媒体元素。
6. **VIP/灰歌/广告的 UI 表达**（UI 任务）：可能需要给 `Track` 增加 `fee`/`privilege`/`playable` 字段（协议变更，
   需 host+UI 同步）。
7. **中文化与图标**（已完成）：`netease` 图标角色（见 `rust-wiring.md` 的 `ICON_ROLES`）与三语文案已落地；
   自绘占位图标待换成合规素材；`ui/src/companion/pages/Accounts.tsx` 的 companion 账号入口仍未接（车内 App 的
   登录按钮已可用），需要时按现有三个服务补（还要动 43 个 locale 的 words 文件）。
