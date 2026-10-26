# 网易云 host 接线清单（v2.0.3，逐步可复制）

> 本文是给 Lead 的**精确接线单**：照抄片段即可，不需要改 `netease.rs` / `netease.js` / `netease_sign_in.js`
> 本身。行号基于 **v2.0.3（2026-10-26，`feat/netease-zh` 工作区）** 的当前文件；若文件已有他人改动而漂移，
> 按每节给出的**定位锚点**（相邻代码片段）插入。
>
> 本环境没有 Rust 工具链（无 rustc/cargo/MSVC），**接线后必须由有工具链的机器跑**：
>
> ```powershell
> cargo check -p westplay-host
> cargo test  -p westplay-host netease
> cargo clippy -p westplay-host
> cargo fmt --check
> cd ui; npm test -- hostScripts
> ```
>
> 接线顺序建议：**① `signin.rs` → ② `performance.rs` → ③ `customize.rs` → ④ `lib.rs` → ⑤ `app/src/main.rs`
> → ⑥ `ui/src/hostScripts.test.ts`**。`netease.rs` 引用 `crate::signin::NETEASE`，所以 `signin.rs` 必须先补；
> `performance.rs` 的 `Profile` 是穷尽 match，新枚举变体不补 match 臂会编译失败。

---

## 0. 新增文件（本任务已交付，无需改动）

| 文件                                 | 说明                                       |
| ------------------------------------ | ------------------------------------------ |
| `crates/host/src/netease.rs`         | host 模块（977 行，9 处 `TODO(verify)`）   |
| `crates/host/src/netease.js`         | 注入桥（611 行，29 处 `TODO(verify)`）     |
| `crates/host/src/netease_sign_in.js` | 登录窗口脚本（53 行，2 处 `TODO(verify)`） |

`Cargo.toml` **不用加依赖**：`netease.rs` 只用 `serde`/`serde_json`/`std` 和 crate 内已有的
`signin`/`speakers`/`webview`/`lyrics`。

---

## 1. `crates/host/src/signin.rs`：`pub const NETEASE: Site`

**位置**：`APPLE_MUSIC`（`signin.rs:93-100`）之后、`const CLASS`（`signin.rs:101`）之前。

```rust
/// 网易云的登录：它自己的网页（二维码，用手机 App 扫）。地址不变（登录是页面里的弹层），所以由页面里的
/// 脚本（`netease_sign_in.js`）轮询它的账号接口/顶部栏，登录成功后说一声（`page_says`）。
pub const NETEASE: Site = Site {
    sign_in: "https://music.163.com/",
    title: "Sign in to NetEase Cloud Music - WestPlay",
    home: "https://music.163.com/",
    not_yet: None,
    page_says: Some(include_str!("netease_sign_in.js")),
};
```

**配套测试**（可选，建议加）：`signin.rs:560-568` 的 `hears_a_page_say_its_signed_in` 末尾已有
`assert!(APPLE_MUSIC.page_says.is_some(), "its address says nothing");`，紧跟一行：

```rust
        assert!(NETEASE.page_says.is_some(), "its address never says it");
```

> 注意：`Site` 的地址与 `netease.rs::HOME` 是两份常量，故意不互相引用（与 `SPOTIFY`/`spotify::HOME` 的现状
> 一致）。

---

## 2. `crates/host/src/performance.rs`：`Profile::Netease`（**不补 match 会编译错**）

**2.1 枚举**：`performance.rs:33-40`，在 `AppleMusic` 后加：

```rust
    /// 网易云自己的 WebView2 profile（`webview2-netease`），进程按它计数。
    Netease,
```

**2.2 名称**：`performance.rs:213-216` 的 `parts_of` 里 `match profile` 是穷尽的：

```rust
            let part = match profile {
                Profile::Spotify => "Spotify",
                Profile::AppleMusic => "Apple Music",
                Profile::Netease => "NetEase Cloud Music",
                Profile::Cab => match kind {
```

> `page_part`（`performance.rs:229-237`）只服务 `Profile::Cab` 的 renderer（YouTube、cab 页面），网易云是独立
> profile，不需要改。
> 若 `Profile` 在别处还有穷尽 match（当前只有 `parts_of` 一处，`grep -n "Profile::"` 可确认），一并补。

---

## 3. `crates/host/src/customize.rs`：`ICON_ROLES` 10 → 11

**位置**：`customize.rs:27-39`。改类型长度并加一行：

```rust
/// An icon's file name (without its extension), and the role the cabin page knows it by.
pub const ICON_ROLES: [(&str, &str); 11] = [
    ("maps", "maps"),
    ("music", "music"),
    ("spotify", "spotify"),
    ("podcasts", "podcasts"),
    ("messages", "messages"),
    ("phone", "phone"),
    ("settings", "settings"),
    ("weather", "weather"),
    ("youtube", "youtube"),
    ("youtube-music", "youtubeMusic"),
    // 网易云：图标文件名 `netease.png`（或 `.light/.dark`），cabin 页面角色 `netease`（与
    // `ui/src/shared/icons.ts` 已加的一致）。
    ("netease", "netease"),
];
```

> UI 侧角色名 `netease` 已由 UI 任务写进 `ui/src/shared/icons.ts` 的 `AppIconRole` 与 `FILES`；`customize.rs`
> 这里的两列是（图标文件基名，页面角色），网易云两者都是 `netease`。
> `customize.rs` 现有测试不数角色个数，加一行不会破坏；`icon_sets_take_only_icons_named_by_role`
> （`customize.rs:607`）只断言它自己造的两个图标。

---

## 4. `crates/host/src/lib.rs`：12+1 处

> 全部片段均可直接粘贴；`netease` 模块路径写法与现有 `spotify`/`youtube_music` 一致（同一 crate 根，无需
> `use`）。13 处中第 7 处（performance profiles）在任务书的“12 处”之外，但同样必须改。

### 4.1 `mod`（`lib.rs:8-35`）

`mod netease;` 按字母序插在 `pub mod maps;`（18 行）与 `mod performance;`（19 行）之间：

```rust
pub mod maps;
mod netease;
mod performance;
```

### 4.2 `Status` 字段（`lib.rs:98-104`）

`apple_music_signing_in`（104 行）之后、`/// The map of the profile played`（105 行）之前：

```rust
    /// 同 Spotify：网易云是否已登录（`None`：还没跑过，或未知），它的登录窗口是否开着。账号别的不出现。
    pub netease_signed_in: Option<bool>,
    pub netease_signing_in: bool,
```

> `Status` 派生 `Default`：`Option<bool>` 默认 `None`、`bool` 默认 `false`，无需额外实现。
> 序列化字段是 `neteaseSignedIn` / `neteaseSigningIn`（`#[serde(rename_all = "camelCase")]`）。

### 4.3 `AccountRequests`（`lib.rs:118-123`）

```rust
#[derive(Debug, Default)]
pub struct AccountRequests {
    pub youtube: AccountRequest,
    pub spotify: AccountRequest,
    pub apple_music: AccountRequest,
    /// 网易云（新增）。
    pub netease: AccountRequest,
}
```

> `AccountRequest: Default`，`AccountRequests` 的 `Default` 派生继续可用。
> 另建议把 116-117 行与 199-200 行的文档注释“Signing YouTube, Spotify or Apple Music…”补上网易云（纯文档，可略）。

### 4.4 `PlayLog`（`lib.rs:355-359`）

`let mut youtube_music_log = play_log::PlayLog::new("youtube music");` 之后：

```rust
    let mut netease_log = play_log::PlayLog::new("netease");
```

### 4.5 循环状态变量（`lib.rs:374-378` 之后）

YouTube Music 的状态块（374-378）之后、`// The settings generation last applied`（379 行）之前：

```rust
    // 网易云网页播放器，与它最后说的话（页面重载后重发）：是否已登录、正在播放什么。
    let mut netease: Option<netease::Netease> = None;
    let mut netease_state: Option<netease::State> = None;
    let (mut netease_window_open, mut netease_confirming) = (false, false);
    let mut netease_playback: Option<String> = None;
```

### 4.6 companion 的账号请求（`lib.rs:455-463`，Apple Music 块之后）

```rust
        if let Some(action) = config.accounts.netease.take()
            && let Some(player) = start_netease(&mut netease, &stage, &config)
        {
            let _ = player.command(&match action {
                AccountAction::SignIn => netease::Command::SignIn,
                AccountAction::SignOut => netease::Command::SignOut,
                AccountAction::Check => netease::Command::Start,
            });
        }
```

> 用 `let … && let …` 的 let-chain 写法与相邻三块一致（edition 2024，现有代码已这么写）。

### 4.7 performance 采样（`lib.rs:554-560`）

`profiles` 的 `Vec` 组装（每个 WebView2 profile 的进程按名计数）：

```rust
                let mut profiles = vec![(performance::Profile::Cab, webview.environment())];
                if let Some(spotify) = &spotify {
                    profiles.push((performance::Profile::Spotify, spotify.view().environment()));
                }
                if let Some(apple_music) = &apple_music {
                    profiles.push((performance::Profile::AppleMusic, apple_music.view().environment()));
                }
                // 新增：
                if let Some(netease) = &netease {
                    profiles.push((performance::Profile::Netease, netease.view().environment()));
                }
```

### 4.8 Ready：页面重载后重发（`lib.rs:720-727`，YouTube Music 块之后）

```rust
                    if netease.is_some() {
                        let signing_in = netease_window_open || netease_confirming;
                        let message = netease::state_message(netease_state.as_ref(), signing_in);
                        let _ = webview.post_json(&message);
                        if let Some(playback) = &netease_playback {
                            let _ = webview.post_json(playback);
                        }
                    }
```

### 4.9 PageMessage 命令分支（`lib.rs:805-817`，YoutubeMusic 块之后）

```rust
                Some(PageMessage::Netease { command }) => {
                    if netease.is_none() && matches!(command, netease::Command::Pause) {
                        // 没在跑：没有可暂停的（与 Spotify/Apple Music/YouTube Music 一致）。
                    } else if let Some(player) = start_netease(&mut netease, &stage, &config) {
                        let _ = player.command(&command);
                    }
                }
```

### 4.10 Report 排空（`lib.rs:1301`，YouTube Music 块之后、`// What the player typed`（1303）之前）

整块照抄（与 Spotify 的块同构）：

```rust
        // 网易云页面说的话（是否登录、在播什么）与登录窗口，给页面；WebView 失败就关掉它（页面会再开它）。
        if let Some(player) = &netease {
            if player.failed() || players_closing {
                if players_closing {
                    log!("[netease] closed with the game");
                } else {
                    log!("[netease] its browser failed: closed, the page opens it again");
                }
                if let Some(line) = netease_log.heard(None) {
                    log!("{line}");
                }
                if let Some(failed) = netease.take() {
                    failed.close(&stage);
                }
                netease_state = None;
                netease_playback = None;
                (netease_window_open, netease_confirming) = (false, false);
                status.netease_signed_in = None;
                status.netease_signing_in = false;
                (config.on_status)(&status);
                let _ = webview.post_json(&netease::state_message(None, false));
                let _ = webview.post_json(&netease::playback_message(None));
            } else {
                let mut state_changed = false;
                for report in player.take_reports() {
                    match report {
                        netease::Report::Spectrum(bars) => {
                            let _ = webview.post_json(&speakers::spectrum_message(&bars));
                        }
                        netease::Report::State(state) => {
                            if status.netease_signed_in != Some(state.signed_in) {
                                status.netease_signed_in = Some(state.signed_in);
                                (config.on_status)(&status);
                            }
                            netease_state = Some(state);
                            state_changed = true;
                        }
                        netease::Report::SignInWindow(open) => {
                            netease_window_open = open;
                            state_changed = true;
                        }
                        // 等页面自己说已登录（不是重新加载时的“未登录”一瞬）。
                        netease::Report::Confirming(confirming) => {
                            netease_confirming = confirming;
                            state_changed = true;
                        }
                        // 回答与播放内容直接转发（不写日志）。
                        netease::Report::Answer(answer) => {
                            let _ = webview.post_json(&netease::answer_message(&answer));
                        }
                        netease::Report::Playback(playback) => {
                            let heard = playback.as_deref().map(|playback| play_log::Heard {
                                doing: play_log::doing(false, playback.playing),
                                track: playback.track.as_ref().map(|track| track.id.as_str()),
                                // 网易云是毫秒，play_log 用秒。
                                position: playback.position_ms / 1000.0,
                            });
                            if let Some(line) = netease_log.heard(heard) {
                                log!("{line}");
                            }
                            let message = netease::playback_message(playback.as_deref());
                            let _ = webview.post_json(&message);
                            netease_playback = Some(message);
                        }
                    }
                }
                if state_changed {
                    let signing_in = netease_window_open || netease_confirming;
                    if status.netease_signing_in != signing_in {
                        status.netease_signing_in = signing_in;
                        (config.on_status)(&status);
                    }
                    let message = netease::state_message(netease_state.as_ref(), signing_in);
                    let _ = webview.post_json(&message);
                }
            }
        }
```

### 4.11 cab 下发（`lib.rs:1337-1348`，Spotify 的 `player.cab` 之后）

```rust
            if let Some(player) = &netease {
                let _ = player.cab(truck.id.as_str(), head, outside, distance, equalizer, spectrum);
            }
```

### 4.12 `start_netease`（`lib.rs:1756`，`start_spotify` 之后、`build_pipeline`（1758）之前）

**profile 目录**：`config.data_dir.join("webview2-netease")`（与 `webview2-spotify`/`webview2-apple-music`
并列；`webview2` 是 cabin 与 YouTube 共用，不要用）。

```rust
/// 网易云网页播放器，第一次被页面用到时启动（独立的 WebView2 profile：退出登录只忘网易云的 cookie），
/// 或 `None`（起不来）。
fn start_netease<'a>(
    netease: &'a mut Option<netease::Netease>,
    stage: &Stage,
    config: &Config,
) -> Option<&'a netease::Netease> {
    if netease.is_none() {
        let user_data = config.data_dir.join("webview2-netease");
        match netease::Netease::start(stage, config.width, config.height, &user_data) {
            Ok(started) => {
                log!("[netease] opened");
                *netease = Some(started)
            }
            Err(e) => startup::mark(&format!("host: NetEase Cloud Music couldn't start: {e}")),
        }
    }
    netease.as_ref()
}
```

### 4.13 `PageMessage` 变体（`lib.rs:1845-1846`，YoutubeMusic 变体之后）

```rust
    /// 给网易云网页播放器的命令（`netease`）：登录、提问、播放控制。
    Netease { command: netease::Command },
```

> 变体名 `Netease` → 反序列化按 `#[serde(tag = "type", rename_all = "camelCase")]` 期待 `"netease"`，与
> `HostCommand` 的 `{type:'netease', command}` 对齐。

### 4.14 测试（在 `lib.rs` 的 `#[cfg(test)] mod tests` 里，两处）

**(a) `reads_the_pages_messages`（`lib.rs:2059-2062`，youtube 命令断言之后）**：

```rust
        assert_eq!(
            parse_page_message(r#"{"type":"netease","command":{"action":"seek","seconds":42.5}}"#),
            Some(PageMessage::Netease { command: crate::netease::Command::Seek { seconds: 42.5 } })
        );
```

**(b) `passes_on_the_companions_sign_ins_once`（`lib.rs:2147-2163`）**：可选但推荐：

```rust
        requests.netease.request(AccountAction::Check);
        // …（在 spotify 的 take 断言之后）：
        assert_eq!(requests.netease.take(), Some(AccountAction::Check));
        assert_eq!(requests.netease.take(), None);
        // Status：
        let status = super::Status { netease_signed_in: Some(true), netease_signing_in: false, ..Default::default() };
        let json = serde_json::to_value(&status).unwrap();
        assert_eq!((json["neteaseSignedIn"].as_bool(), json["neteaseSigningIn"].as_bool()), (Some(true), Some(false)));
```

---

## 5. `app/src/main.rs`：三个 Tauri 命令（companion 窗口用）

**5.1 命令定义**（`app/src/main.rs:111-115`，`apple_music_check` 之后、`/// The maker's Kreosus page`（117）之前）：

```rust
/// 打开网易云的登录窗口（二维码，手机 App 扫；状态随后会说好没好）。
#[tauri::command]
fn netease_sign_in(accounts: State<Accounts>) {
    accounts.0.netease.request(AccountAction::SignIn);
}

/// 退出网易云登录。
#[tauri::command]
fn netease_sign_out(accounts: State<Accounts>) {
    accounts.0.netease.request(AccountAction::SignOut);
}

/// 在后台跑一下网易云（隐藏），让状态知道它有没有登录。
#[tauri::command]
fn netease_check(accounts: State<Accounts>) {
    accounts.0.netease.request(AccountAction::Check);
}
```

**5.2 注册**（`app/src/main.rs:171-205` 的 `invoke_handler`，`apple_music_check,`（182 行）之后）：

```rust
            netease_sign_in,
            netease_sign_out,
            netease_check,
```

> 前端调用名即 `invoke('netease_sign_in')` 等；`Accounts` 是 `Arc<AccountRequests>` 的 newtype（35-36 行），
> 不需要改 `manage`。
> 另：`AppHandle` 的 `host-status` 事件里 `Status` 新字段会自动带上，前端 types 由 UI 任务补。

---

## 6. `ui/src/hostScripts.test.ts`：注入脚本编译测试

**6.1 imports**（1-7 行，`youtubeMusic` 之后）：

```ts
import netease from "../../crates/host/src/netease.js?raw";
import neteaseSignIn from "../../crates/host/src/netease_sign_in.js?raw";
```

**6.2 `AS_RUN`**（14-20 行）：

```ts
const AS_RUN: Record<string, string[]> = {
  YouTube: [cabSound, youtube],
  "Apple Music": [cabSound, appleMusic],
  "YouTube Music": [cabSound, youtubeMusic],
  Spotify: [cabSound, spotify],
  // 网易云：host 的 add_startup_script 把 cab_sound 与 netease 拼成一份（netease.js 顶层跑，iframe 里守卫退出）。
  Netease: [cabSound, netease],
  "Apple Music's sign-in": [appleMusicSignIn],
  "NetEase Cloud Music's sign-in": [neteaseSignIn],
};
```

> 本环境已用 `node -e "new Function(...)"` 验证：`cab_sound.js + netease.js` 与 `netease_sign_in.js` 均能编译
> （与 `hostScripts.test.ts` 的检查方式等价）。

---

## 7. UI 侧（**不由本任务改**，给 UI 任务的协议对照）

`ui/src/shared/host.ts` 需要补的类型（字段以 `netease.rs` 为准，`task-2` 协议见 README §6）：

- `HostMessage` 联合里加：
  - `{ type: 'netease'; signedIn: boolean | null; playing: boolean | null; signingIn: boolean }`
  - `({ type: 'neteaseAnswer'; id: number; failed?: boolean } & Partial<NeteaseAnswers>)`
  - `{ type: 'neteasePlayback'; playback: NeteasePlayback | null }`
- `HostCommand` 联合里加：`{ type: 'netease'; command: NeteaseCommand }`
- `NeteaseCommand`：`start | signIn | signOut | ask{id,question} | play{song?,playlist?} | pause | resume | next
| previous | seek{seconds} | volume{percent} | shuffle{on} | repeat{mode}`
- `NeteaseQuestion`：`{ask:'home'} | {ask:'search',query} | {ask:'lyrics',song} | {ask:'collection',id}`
- `NeteaseItem` / `NeteaseTrack` / `NeteaseHome` / `NeteaseResults` / `NeteaseCollection` / `NeteasePlayback` /
  `NeteaseAnswers` / `NeteaseKind` / `NeteaseRepeat`（注意：**毫秒**、`artists: string[]`、无 `color`、`sections`
  只有 `{title, items}`）。
- `ui/src/shared/icons.ts`：`netease` 角色（与 `customize.rs::ICON_ROLES` 对应，**UI 任务已加**）。
- `ui/src/cabin/apps/` 新增网易云 App（Home 图标、路由、Now Playing、中文文案在 zh 词条）；`cabin/apps/index`
  注册。

> 这些都在 UI 任务的写入范围；host 侧契约只保证上面字段名。

---

## 8. 接线后自检

```powershell
# 1) 组件语法（本环境已做过的等价检查）
node -e "const fs=require('fs');const b='crates/host/src/';new Function(fs.readFileSync(b+'cab_sound.js','utf8')+'\n'+fs.readFileSync(b+'netease.js','utf8'));console.log('ok')"

# 2) 有 Rust 工具链的机器：
cargo check -p westplay-host
cargo test  -p westplay-host netease     # netease.rs 的 8 个 serde 测试
cargo test  -p westplay-host             # lib.rs 的 PageMessage/Status 测试
cargo clippy -p westplay-host
cargo fmt --check

# 3) UI 脚本测试
cd ui; npm test -- hostScripts

# 4) 接线完整性（应有多行命中）
rg -n "netease" crates/host/src/lib.rs
rg -n "Profile::Netease" crates/host/src/performance.rs
rg -n "NETEASE" crates/host/src/signin.rs
rg -n "netease" app/src/main.rs
```

### 编译陷阱（按踩坑概率排序）

1. **`performance.rs::parts_of` 的 `match profile` 是穷尽的**：只加枚举变体不补 `Profile::Netease => …` 会
   `E0004 non-exhaustive patterns`。
2. **`signin::NETEASE` 必须先加**：`netease.rs::open_sign_in` 引用 `&signin::NETEASE`；否则 E0425。
3. **`netease.rs` 在 `mod netease;` 之前就存在不会报错，但没 mod 声明时 `lib.rs` 的 `netease::…` 会全红**。
4. **`Report::Playback(Option<Box<Playback>>)`**：`playback.as_deref()`（`Box<Playback>` → `&Playback`）和
   `playback.track.as_ref().map(|track| track.id.as_str())` 是现成写法，别改成 `playback.track.map(...)`
   （会 move）。
5. **`PlayerLog::Heard.position` 是秒**：网易的 `position_ms / 1000.0`，忘了会日志里位置放大 1000 倍（不崩）。
6. **`state_message` 的 `Option<State>`**：网页没在跑时 `state_message(None, false)`；`Answer` 的 `failed` 用
   `..Default::default()` 构造（`Answer: Default`）。
7. **`status.netease_*` 字段**：`Status` 是 `Clone + Debug + Default`，新增 `Option<bool>`/`bool` 不影响派生。
8. **`AccountAction` 的 import**：`app/src/main.rs` 顶部已经 `use westplay_host::{AccountAction, AccountRequests, …}`
   （21-23 行），新命令不用再加。
9. **`let … && let …`**：`start_netease` 的调用照抄相邻块的 let-chain；若项目退回旧 edition 会编译失败，但
   当前 workspace `edition = "2024"`，没问题。
10. **`netease.js` 的 `?raw` import**：Vite 支持任意文件 `?raw`；新 import 路径相对 `ui/src/` 是
    `../../crates/host/src/netease.js?raw`（与现有条目同一写法）。
11. **`#[serde(rename(serialize = "id"))]`**：`Answer.answer` 反序列化的字段名是 `answer`（不是 `id`）；
    `read_message` 已处理两种页面形状，接线不用管。
12. **别把 `netease.js` 的 `window.top !== window` 守卫删掉**：`add_startup_script` 对每个 frame 都执行，
    删掉会让 `#g_iframe` 里也跑一遍顶层逻辑（重复 ready、重复 interval、`#g_player` 找不到）。
