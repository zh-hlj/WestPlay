# 网易云接入：Windows 真机验证清单

> **本环境无法执行本文的任何一项。** 当前 sandbox 没有 Rust 工具链（无 rustc/cargo/MSVC）、没有 WebView2 真机
> 桌面、没有可交互的游戏与音频设备，也无法通过 git/curl 访问网络（schannel 被拦截）。本文件是**给有
> Windows 10/11 + WebView2 Runtime + 欧卡 2 的机器**执行的手册；能在此环境做的只有两件，已做：
>
> 1. 三个 JS 文件的语法检查（`node -e "new Function(...)"`，等价于 `ui/src/hostScripts.test.ts` 的检查）；
> 2. `netease.rs` 的 serde 单测只“写出来并人工核对”，**没有运行**。
>
> 执行顺序：**A 编译 → B 加载 → C 登录 → D 注入/iframe → E 播放状态 → F 车内声音 → G 命令 → H 拖进度
> → I VIP/灰歌/海外 → J 稳定性 → K 日志隐私 → L 清单勾选**。每节都有可粘贴的诊断脚本与验收标准；
> 不满足的项标成 `FAIL` 并附 `app.log` 对应行。

## 0. 前提与准备

| 项               | 要求                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------- |
| 系统             | Windows 10/11 x64                                                                            |
| WebView2 Runtime | 已安装（Edge 自带亦可）；`Status.webviewVersion` 可见                                        |
| 构建工具         | Rust 工具链 + MSVC + Node 22+；本仓库 `cargo build` 可跑                                     |
| 游戏             | Euro Truck Simulator 2（1.58+）+ WestPlay plugin（v2.1.0 对应）                              |
| 账号             | **非会员测试号** 与 **会员测试号** 各一（VIP 项用）；手机装网易云 App（扫码）                |
| 网络             | 国内出口（正常项）；海外出口（VPN/代理）仅用于 §I 的海外灰歌验证，验证完断开                 |
| 日志             | `%USERPROFILE%\Documents\WestPlay\logs\app.log`（每次启动重写；见 `crates/host/src/log.rs`） |
| 构建产物         | `cargo build`（debug）或 `npm run build`（release），UI 已含网易云 App（UI 任务完成后）      |

**验证前备份**：`%LOCALAPPDATA%\WestPlay\webview2-netease`（网易云的 WebView2 profile，登录态在里面）。
出问题直接删该目录可回到“未登录”初始态（无需重装）。

**日志关键字**（本文用 `grep` 指代 `Select-String`）：

```powershell
$log = "$env:USERPROFILE\Documents\WestPlay\logs\app.log"
Get-Content $log -Wait | Select-String '\[netease\]|netease'
```

---

## A. 编译与静态检查

```powershell
cargo check -p westplay-host
cargo test  -p westplay-host netease
cargo test  -p westplay-host
cargo clippy -p westplay-host
cargo fmt --check
cd ui; npm test -- hostScripts
```

**验收**：

- [ ] `cargo check` 通过（零 error；`netease.rs` 里没有 `#[allow]` 掩盖的类型问题）。
- [ ] `cargo test -p westplay-host netease` 的 8 个测试全过：
      `reads_the_cabin_pages_commands`、`passes_the_page_its_commands_as_the_app_sent_them`、`reads_neteases_page`、
      `reads_answers_in_both_shapes`、`says_when_an_answer_doesnt_read`、`passes_on_only_what_the_app_shows`、
      `passes_on_what_plays`、`says_whether_its_signed_in_and_playing`。
- [ ] `cargo test -p westplay-host` 里 `reads_the_pages_messages`、`passes_on_the_companions_sign_ins_once`（若已按
      wiring 加断言）通过。
- [ ] `npm test -- hostScripts` 里 Netease 与 NetEase 登录脚本两条“compile”用例通过。
- [ ] `cargo clippy` 无 `undocumented_unsafe_blocks`/`missing_safety_doc` 新增告警（`netease.rs` 无 unsafe）。

**本环境状态**：未执行（无 Rust 工具链）。JS 语法已用 node 验证通过。

---

## B. WebView2 加载旧版播放器

1. 启动 WestPlay，进入舱内 UI 的网易云 App（Home 图标）。
2. UI 会发 `{action:'start'}`（或首个非 pause 命令）→ host 建 WebView 并打开 `https://music.163.com/`。
3. 观察日志。

**预期日志**（顺序大致如下）：

```text
[netease] opened
[netease] page loaded (music.163.com)
```

**验收**：

- [ ] 15–30 秒内出现 `[netease] page loaded (music.163.com)`；没有
      `[netease] page didn't load (music.163.com): …`（错误文案见 `webview.rs::web_error`）。
- [ ] host 收到 `{ready:true}`：日志无直接打印，但接下来 UI 能收到 `{"type":"netease","signedIn":false|true,…}`。
- [ ] 无 `[netease] its browser failed` / `closed with the game` 的意外出现。
- [ ] WebView2 进程数上升后回稳（任务管理器里 `msedgewebview2.exe`；performance.rs 会把该 profile 的进程计为
      `NetEase Cloud Music`，见 `performance.rs` 的每分钟日志行）。

**诊断（页面 DOM 不可见时）**：临时在 `netease.rs` 的 `#[cfg(test)] mod tests` 加一个 `#[ignore]` 测试
（本仓库现成样板是 `spotify.rs:756-806` 的 live 测试，用 `Stage::new` + `crate::pump_messages()`）：

```rust
#[test]
#[ignore = "opens music.163.com"]
fn dumps_the_players_page() {
    use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx};
    // SAFETY: COM on this test's own thread, once, before anything uses it.
    unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap() };
    let user_data = std::path::PathBuf::from(std::env::var_os("WESTPLAY_NETEASE_PROFILE").expect("a profile"));
    let stage = Stage::new(1280, 720).unwrap();
    let player = Netease::start(&stage, 1280, 720, &user_data).unwrap();
    player.view.set_muted(true).unwrap();
    for _ in 0..100 {
        crate::pump_messages();
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    for script in [
        "location.href",
        "window.top === window",
        "document.querySelector('#g_player')?.className ?? null",
        "document.querySelector('#g_player')?.innerHTML?.slice(0, 800) ?? null",
        "document.querySelector('#g_iframe')?.contentDocument !== null",
        "navigator.mediaSession?.metadata?.title ?? null",
        "[...document.querySelectorAll('audio')].map(a => ({paused:a.paused, t:a.currentTime, d:a.duration, src:(a.src||'').slice(0,40)}))",
    ] {
        println!("{script} => {}", player.view.evaluate(script).unwrap_or_default());
    }
    player.close(&stage);
}
```

```powershell
$env:WESTPLAY_NETEASE_PROFILE = "$env:LOCALAPPDATA\WestPlay\webview2-netease"
cargo test -p westplay-host dumps_the_players_page -- --ignored --nocapture
```

- [ ] 第 3 条返回 `g-player …`（说明旧版 `#g_player` 在）；打印的 `innerHTML` 用来核对 §D 的选择器。
- [ ] 若返回 `null`：可能加载到新版页面（见 README §3），本题（旧版）记为 `FAIL`，附 `location.href` 与首页
      HTML 片段。

### B2. 新版全功能 Web 播放器（M4 前置调研，不影响 M2 验收）

1. 在**桌面浏览器**打开 `https://music.163.com/#/download`，点“Linux”，记下新版播放器的**真实地址与 host**。
2. 临时把 `netease.rs::HOME` 改成该地址，重新构建（只用于调研，不提交）。
3. 加载后用 §B 的诊断脚本记录：`location.href`、`document.body.innerHTML.slice(0, 2000)`、
   `[...document.querySelectorAll('audio,video')]`、`navigator.mediaSession?.metadata`，以及页面网络里
   `/api/...` 请求的地址。

**验收（调研项）**：

- [ ] 新版在 `music.163.com` 同源：`netease.js` 的 hostname 守卫放行，`{ready:true}` 会出现（等 `#g_player` 超时
      15 s 后），`state`（登录态）与 `ask`（search/lyrics/collection/home）可用；`playback` 为 `null`（无
      `#g_player`，`track.id` 拿不到）——**记录为 M4 的起点**。
- [ ] 新版在别的 host：`netease.js` 直接 return（脚本不跑，host 收不到 ready，UI 一直“未运行”）；这属于预期，
      M4 再改守卫/新增脚本，本阶段记为 `SKIP`。
- [ ] 无论哪种：host 不崩、无日志报错风暴。

---

## C. 登录窗口与扫码

1. UI 点“登录”（或 companion 窗口的网易云登录按钮）→ host 打开 520×760 桌面窗口（`signin.rs::SIZE`）。
2. 窗口先加载 `https://music.163.com/`，`netease_sign_in.js` 自动点页面“登录”，应看到二维码弹层。
3. 手机网易云 App 扫码 → 手机确认。
4. 观察窗口与日志。

**验收**：

- [ ] 窗口出现在**桌面**（不是游戏内、不是隐藏），尺寸约 520×760、标题 `Sign in to NetEase Cloud Music - WestPlay`。
- [ ] 5 秒内二维码弹层出现（脚本点到“登录”）。
- [ ] 手机确认后 **≤10 秒**窗口自动关闭（host `SignedIn` → 关窗），页面重新导航（`[netease] page loaded` 再来一次）。
- [ ] UI 显示“已登录”；`Status.neteaseSignedIn === true`、`neteaseSigningIn === false`（companion 的 status 事件）。
      页面脚本 post 的 `{"signedIn":true}` 触发 `Report::Confirming`，20 秒内页面 `{state:{signedIn:true}}` 确认。
- [ ] 日志**没有**账号、昵称、二维码内容、cookie；最多是上述窗口/页面加载行。
- [ ] 取消路径：打开登录窗口后直接关掉（不扫码）→ `neteaseSigningIn` 回到 `false`，UI 显示未登录，不崩。
- [ ] 已登录状态下再点登录 → 窗口打开后脚本立即 `post({signedIn:true})`（在 URL 不变的情况下也能确认）。
- [ ] 退出登录 → 只清 `webview2-netease` 的 cookie（cabin/YouTube 的 `webview2` profile 不受影响：YouTube 仍登录）。

**诊断**：

```powershell
# 窗口出现前后
Get-Content $log -Wait | Select-String 'netease|NetEase'
# WebView2 profile 里是否真有网易 cookie（退出登录后应清空）
Get-ChildItem "$env:LOCALAPPDATA\WestPlay\webview2-netease\EBWebView\Default\Network" -ErrorAction SilentlyContinue
```

- [ ] `netease_sign_in.js` 的 `/api/nuser/account/get` 失败时，DOM 兜底是否生效（`a[href*="/user/home"]`）：
      断网打开登录窗口，看是否仍能判断状态（此路径只影响“未登录时不误点”和“已登录时 fast-path”，可记为观察项）。

---

## D. iframe 注入与双 frame

启动后（已加载旧版）执行诊断：

```js
// 在顶层页面里（用 §B 的 evaluate）
window.top === window; // 顶层：true
typeof window.westplaySpeakerLevel; // 'function'
document.querySelector("#g_iframe") !== null; // 旧版有内容框架
document.querySelector("#g_iframe").contentDocument !== null; // 同源可访问：true
```

**验收**：

- [ ] `netease.js` 只在顶层生效：`#g_iframe` 的内容页里 `window.westplaySpeakerLevel` 为 `undefined`、且**没有**
      第二个 `{ready:true}` 造成 cab/问题重复处理（日志/行为无重复上报；可在 netease.rs 的 Ready 分支临时
      `log!` 计数，应为每帧一次、且重发幂等）。
- [ ] 顶层能通过 `contentDocument` 找到内容页的播放按钮（§G 的 `play` 验证会真正用到）。
- [ ] 若 WebView2 版本导致子 frame 的 `chrome.webview` 不可用：不影响本实现（顶层脚本兜底），记录 WebView2 版本。

---

## E. 播放状态：mediaSession 与音频元素

1. 在网易云 App 里点一首歌（或 UI 点 Home 里的歌单）。
2. 诊断：

```js
navigator.mediaSession?.playbackState              // 'playing' / 'paused' / undefined
navigator.mediaSession?.metadata?.title ?? null    // 歌名
navigator.mediaSession?.metadata?.artist ?? null   // 歌手
[...document.querySelectorAll('audio')].map(a => ({paused:a.paused, t:a.currentTime, d:a.duration}))
document.querySelector('#g_player')?.querySelector('.words')?.textContent   // 播放条歌名
document.querySelector('#g_player')?.querySelector('.pas') ? 'playing' : 'paused'
document.querySelector('#g_player')?.querySelector('.time')?.textContent    // 播放条时间
document.querySelector('#g_player')?.querySelector('.head img')?.src        // 封面
```

**验收**：

- [ ] 有 `audio` 元素且 `paused === false`；`mediaSession.metadata.title` 非空（页面自己会设）。
- [ ] UI 的 Now Playing 出现歌名/歌手/封面/时长；进度随时间走。
- [ ] host 日志出现 `[netease] playing at 0 s`（或 `loading at …`），**不出现**歌名/id。
- [ ] 暂停 → UI 显示暂停，日志 `[netease] paused at …`；恢复 → 继续。
- [ ] 切歌 → UI 换歌名/封面，日志 `next track, playing`（`play_log.rs` 只比较 id、不打印）。
- [ ] 页面 `duration` 在 `loadedmetadata` 前是 `NaN`：UI 不应显示 `NaN`（脚本已按 0 处理）。
- [ ] `signedIn` 状态正确（登录/未登录各测一次；未登录也能听免费歌）。

---

## F. 车内声音（cab_sound 接管）

前提：一有车内扬声器数据的卡车（如 Scania S，`speakers::in_truck` 有数据）；司机头部 telemetry 正常（游戏里
坐着、镜头在车内）。

```js
window.westplaySpeakerLevel?.(); // [左耳, 右耳, limiter dB] 或 null
```

**验收**：

- [ ] 播放中 `westplaySpeakerLevel()` 返回数组，左/右耳至少一个 **> 0.0005**（说明声音已过 Web Audio）。
- [ ] 日志 `[netease] speakers: through the speakers (audio)`（最多每个状态一次，不刷屏）。
- [ ] 车内/车外镜头切换：车外时声音变闷、变小（`cab_sound.js` 的 muffle），日志变
      `silent while playing (…` 只在**真的**没声时出现（≤4 秒不出现即通过）。
- [ ] 音量命令（UI 音量滑条）改变后扬声器电平随之变化；换歌后音量仍保持（脚本每 500ms 把 cab 的音量补回）。
- [ ] 均衡器（Settings › Sound）改变 → 声音随之变化；Equalizer 面板打开时频谱条响应（`spectrum` 消息）。
- [ ] 没有扬声器数据的卡车：声音仍在（不接管或只做均衡器），不得静音。
- [ ] 游戏内静音/切到后台（游戏失去焦点）时播放不中断（与现有 App 行为一致）。

> 若 `westplaySpeakerLevel()` 全程 `null` 且日志 `no media element found`：`findPlayback()` 没拿到元素，回看
> §E 的 `document.querySelectorAll('audio')` 是否为空/在 `#g_iframe` 里；这是最可能的需要补 `TODO(verify)`
> 的地方。

---

## G. 命令控制（逐条）

用 UI 按钮 + 诊断脚本，逐条验收。每条都先看 UI，再看页面/音频元素，最后看日志。

| #   | 命令                  | 操作                                       | 页面/元素预期                                             | UI 预期                     | 验收                     |
| --- | --------------------- | ------------------------------------------ | --------------------------------------------------------- | --------------------------- | ------------------------ |
| G1  | `play{playlist}`      | Home 点一个歌单                            | 页面跳到歌单页并开始播第一首；`#g_iframe` 里播放按钮被点  | Now Playing 出现第一首      | [ ]                      |
| G2  | `play{song}`          | 搜索里点一首歌                             | 页面跳到 `/song?id=` 并播放                               | 同上                        | [ ]                      |
| G3  | `play{song,playlist}` | 歌单里点某首                               | 从该歌单该首开始播                                        | 同上                        | [ ]                      |
| G4  | `pause` / `resume`    | 暂停、再播                                 | `audio.paused` 切换为 true/false；播放条 `.ply/.pas` 切换 | 图标/进度变化               | [ ]                      |
| G5  | `next` / `previous`   | 下一首/上一首                              | 播放条 `.nxt/.prv` 被点；`audio.currentTime` 归零换歌     | 换歌                        | [ ]                      |
| G6  | `seek{seconds}`       | UI 拖进度到 60s                            | `audio.currentTime≈60`；播放条时间变化                    | 进度条位置正确              | [ ]                      |
| G7  | `volume{percent}`     | 音量 20% / 80%                             | `audio.volume≈0.2/0.8`；换歌后仍保持                      | 音量滑条/扬声器电平变化     | [ ]                      |
| G8  | `shuffle{on}`         | 随机开/关                                  | 页面随机按钮状态切换（若选择器对）                        | 图标状态                    | [ ]                      |
| G9  | `repeat{off           | all                                        | one}`                                                     | 循环模式三档                | 页面循环按钮循环到对应档 | 图标/行为 | [ ] |
| G10 | `ask{home}`           | 打开网易云首页                             | ——（同源 API）                                            | 推荐歌单/新歌两栏           | [ ]                      |
| G11 | `ask{search,query}`   | 搜索“tarkan”                               | ——                                                        | 歌曲/歌单/专辑/歌手四类结果 | [ ]                      |
| G12 | `ask{collection,id}`  | 点搜索结果歌单/专辑                        | ——                                                        | 歌单/专辑页与曲目列表       | [ ]                      |
| G13 | `ask{lyrics,song}`    | Now Playing 打开歌词                       | ——                                                        | 逐行歌词、时间轴对齐        | [ ]                      |
| G14 | 非法 id               | 手工发 `seek` NaN / `play{song:"12/../x"}` | 页面收不到（host 过滤）                                   | 无异常                      | [ ]                      |

**通用验收**：命令不导致页面刷新/登录丢失；连续发 20 次不卡死；未知命令（前端拼错）不崩（host `for_page` 过滤、
脚本 listener 的 try/catch）。

> `G8/G9` 是选择器最不确定的两条：若页面按钮找不到，脚本会更新本地 `shuffle/repeat` 状态但页面没变——这属于
> `TODO(verify)` 未完成，记为 `FAIL(selector)` 而不是崩溃。

---

## H. 玩家拖动进度

1. 播放中，在腔内的 Now Playing 进度条上按住拖动（游戏内鼠标）多段。
2. 同时看页面侧 `audio.currentTime`。
3. 拖到接近结尾，等自动下一首。

**验收**：

- [ ] 拖动后 `audio.currentTime` 与 UI 目标偏差 **≤1 秒**；播放不中断（无 loading 卡死）。
- [ ] UI 进度条不回跳（host `tellPlayback` 的 jump 检测会立即上报一次，之后的 500ms 轮询不再重复）。
- [ ] 拖到结尾 → 自动下一首，UI 换歌；再拖回开头 → 正常。
- [ ] 暂停状态下拖动 → 位置变化但不自动播放。
- [ ] 快速连续拖 10 次 → 最终位置正确、无卡死、无日志风暴。

---

## I. VIP / 版权灰歌 / 海外 / 广告 / 音质（如实呈现，不绕过）

### I1. VIP 歌曲（非会员号）

1. 用**非会员**账号登录。
2. 播放一首 VIP 歌（歌单里带“VIP”标记的）。

**验收**：

- [ ] 网页播放器按网易规则**只给试听**（常见 30 秒）或提示开通会员；host 不伪造 `playing/duration`。
- [ ] UI 不崩；30 秒后行为与网页一致（停止/跳下一首）。
- [ ] 日志无报错风暴。
- [ ] 会员号再测同一首 → 正常完整播放。
- [ ] **不出现**任何绕过会员的请求（检查代码：`/api/song/enhance/player/url` 未被使用）。

### I2. 版权灰歌

1. 找一首页面显示“因版权方要求无法播放”的歌（歌单里灰掉的行）。

**验收**：

- [ ] 点它 → 页面弹提示（窗口隐藏，用户看不到）；host 的 `playback` 不谎报为正在播；UI 最坏保持上一首状态，
      不崩溃、不无限重试。
- [ ] 日志无 `next track` 风暴（播放失败不应被误判成切歌）。

### I3. 海外/地区限制（仅验证，验证后断开 VPN）

1. Windows 全局代理到海外出口，重启 WestPlay（WebView2 走系统代理）。
2. 播放平时能播的歌。

**验收**：

- [ ] 与网页版一致：大量灰歌、仅试听或加载失败；host/UI 如实显示失败（UI 任务定义具体文案）。
- [ ] **不**自动改 IP、不重试代理、不报“未知错误”刷屏（最多每首歌一次）。
- [ ] 断开代理后恢复正常（可点重试）。

### I4. 广告与音质（观察项）

- [ ] 若网页插音频/贴片广告：`mediaSession.metadata`/播放条异常时不崩；UI 可暂停；不实现拦截（记录广告出现频率）。
- [ ] 页面音质（标准/HQ/SQ）由账号与网页版决定：host 无音质命令，不臆造。
- [ ] `TODO(verify)`：广告期间播放条是否变化、`Track.id` 是否还是歌（可能是广告 id）——记录实际行为，回填
      `netease.js` 注释。

---

## J. 游戏退出 / 重载 / 切歌 / 崩溃稳定性

### J1. 游戏退出

1. 播放中关闭游戏（Alt+F4 或任务管理器）。
2. 观察 UI 与日志。

**验收**：

- [ ] 日志 `[netease] closed with the game`（由 `players_closing` 触发），WebView 关闭。
- [ ] UI 收到 `{"type":"netease","signedIn":null,"playing":null,"signingIn":false}` 与
      `{"type":"neteasePlayback","playback":null}`；Now Playing 清空、不残留进度。
- [ ] 重新开游戏 → 进入网易云 App → WebView 重新启动、`[netease] opened` → 登录态仍在（profile 未被清）。

### J2. 舱内页面重载（F5 / UI 崩溃重载）

- [ ] 重载后 UI 重新收到当前 `netease` state + playback（Ready 重发块）；音乐不中断（WebView 独立）。
- [ ] 重载时若正等回答：`Unanswered` 把问题重发给页面，UI 最终拿到 `neteaseAnswer`（而不是永远转圈）。
- [ ] cab 的 speakers/head/outside/equalizer/spectrum 在页面重载后重发，声音仍从车内扬声器出。

### J3. 连续切歌

- [ ] 快速点“下一首” 50 次（或自动连播 20 首）：不卡死、不重复播放、内存/进程数不持续增长（任务管理器看
      `msedgewebview2.exe` 数量回稳）。
- [ ] 每首歌 UI 的封面/歌名/时长都正确（`findPlayback` 在页面换元素时能跟上）。

### J4. WebView2 崩溃/强杀

1. 任务管理器强杀网易云的 `msedgewebview2.exe`（该 profile 的 renderer 或 browser）。
2. 再点 UI 的播放/暂停。

**验收**：

- [ ] 日志 `[netease] its browser failed: closed, the page opens it again`（或 `page didn't load`）。
- [ ] 下一次命令触发 `start_netease` 重启，页面恢复，登录态保留。
- [ ] 不弹崩溃框、不无限重启（host 的浏览器失败重启策略见 `lib.rs` / `app/src/main.rs` 的 supervisor）。

### J5. 断网/恢复

- [ ] 断网 → 播放失败/缓冲；恢复网络 → 能继续或重试（页面自身行为），host 不崩；问答返回 `failed:true` 而非挂起
      （脚本最多重试 1 次，600ms）。

---

## K. 日志与隐私验收

**必须出现**：

```text
[netease] opened
[netease] page loaded (music.163.com)
[netease] playing at 0 s / paused at … / next track, playing
[netease] speakers: through the speakers (audio)      （若接管成功）
```

**不得出现**（`Select-String` 检查）：

- [ ] 账号/手机号/昵称/邮箱/二维码 token/cookie。
- [ ] 歌名/歌手/歌词全文（`play_log.rs` 只比较 id，不打印）。
- [ ] 搜索关键词。
- [ ] 完整 URL 里的 query（`webview.rs::log_as` 只打 host）。

```powershell
Get-Content $log | Select-String 'netease'
# 人工核对：没有用户名/手机号/歌名/搜索词；只有上述几类行
```

**验收**：日志能定位“页面没加载/进程崩了/没声音/登录没成”，但**不能**还原用户听了什么、搜了什么。

---

## L. 总验收清单

### 阻断级（全部必须通过，否则不算“可用”）

- [ ] A：编译 + 单测 + UI 脚本测试全绿。
- [ ] B：旧版页面加载成功，`[netease] page loaded (music.163.com)`，无失败。
- [ ] C：登录窗口扫码登录成功、状态正确、退出登录只清网易 profile。
- [ ] E：播放/暂停/切歌/进度/音量在 UI 与页面双向正确。
- [ ] F：声音从车内扬声器出（有卡车数据时 `westplaySpeakerLevel` 有电平）。
- [ ] J1/J2：游戏退出清理、UI 重载恢复、状态不残留。

### 体验级（可带缺陷发布，需在 CHANGELOG/README 说明）

- [ ] G1–G3 播放来源（歌单/单曲/歌单内单曲）可用。
- [ ] G10–G13 浏览/搜索/歌单/歌词可用（接口失效时 UI 显示“暂无内容”，不崩）。
- [ ] G8/G9：随机/循环的控制（选择器未验证时允许 FAIL，需 UI 侧禁用对应按钮）。
- [ ] H：拖动进度准确、不中断。
- [ ] I1–I3：VIP/灰歌/海外行为与网页版一致（如实失败，不绕过）。
- [ ] J3–J5：连续切歌、崩溃恢复、断网恢复。
- [ ] K：隐私日志。

### 已知限制（发布时写进用户文档）

- 旧版网页播放器是目标；新版 PWA 只支持登录态与问答（M4 前）。
- 无“收藏/喜欢”“音质选择”“下载”“视频画面”。
- `next[]` 队列为空（Now Playing 的“接下来”不显示）。
- 封面无主色，UI 用主题色/取色兜底。

---

## M. 附：本环境已做/未做

| 检查                                                                                       | 状态                                          |
| ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `netease.js` + `cab_sound.js` 合并后的 JS 语法（`new Function`，等价 hostScripts.test.ts） | ✅ 通过                                       |
| 两个注入脚本在伪 DOM 下的加载冒烟（vm：守卫、定义、监听器不抛异常）                        | ✅ 通过                                       |
| `netease_sign_in.js` 语法                                                                  | ✅ 通过                                       |
| LRC 时间解析（`[mm:ss.xxx]` → 秒）抽样                                                     | ✅ 通过（node 脚本）                          |
| `netease.rs` serde 单测                                                                    | ⛔ 未运行（无 Rust 工具链）                   |
| `cargo check/clippy/fmt`                                                                   | ⛔ 未运行                                     |
| WebView2 真机加载 / 登录 / 播放 / 音频 / 命令                                              | ⛔ 未执行（无桌面环境）                       |
| UI 脚本测试（vitest）                                                                      | ⛔ 未运行（需 `npm install`，本任务禁跑安装） |
