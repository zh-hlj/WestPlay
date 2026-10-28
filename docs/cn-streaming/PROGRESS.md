# CN Streaming 进度

基线：原版 v2.1.3（`de6e887`），分支 `feature/cn-streaming`。参考：`reference/feat/netease-zh`（10 月 28 日复刻版）。

## 2026-10-28 · 里程碑 1：网易云接入移植到 2.1.3（编译级通过）

做法：从 `reference/feat/netease-zh` 生成相对 v2.1.0 的补丁，`git apply --3way` 到 2.1.3 基线；52 个文件（新增 3 个 host 模块、9 个车内网易云组件、图标、companion 账号页、中文字典、dashboard/键盘/shell 接线、docs/netease）。

验证（本机）：

| 检查 | 结果 |
| --- | --- |
| `npm --prefix ui run build`（tsc -b + vite build） | ✅ 通过 |
| `npm --prefix ui test`（vitest） | ✅ 64 文件 / 451 测试通过 |
| `cargo check -p westplay-host`（GNU，ASCII target） | ✅ 通过 |
| `cargo test -p westplay-host --lib netease::` | ✅ 8/8 通过 |
| `cargo check -p westplay-app`（ASCII 源码副本 + ASCII target；中文路径下 MinGW windres 不支持图标路径） | ✅ 通过 |

运行级真机验证（游戏内三件套 + 网易云登录/播放）仍待构建后实测。

## 下一步

1. 适配 MSVC CI（GitHub Actions）构建安装包/便携包，验证 2.1.3 基线上的网易云可运行；
2. QQ 音乐：参考 `Mineradiorr/Mineradio-paused` 的账号/接口方案，先做 web 数据抓取 + 组件 + 列表播放；
3. 哔哩哔哩：调研登录方案并实施；
4. 卡车音响 3D 音效；漏洞修复与全量自测。

## 2026-10-28 · 里程碑 2：2.1.3 MSVC 构建与发布（预览版 1）

- CI 工作流适配 2.1.3：MSVC 构建安装包 + 便携包、自签名证书 + 信任脚本、安装器写入修复、Release 自动挂载。
- Release：`v2.1.3-cn-preview1`（https://github.com/zh-hlj/WestPlay/releases/tag/v2.1.3-cn-preview1）。
- 产物验证：portable `westplay.exe` 2.1.3、已签名；安装包已签名；UI bundle 含 `NetEase Cloud Music`；`SHA256SUMS.txt` 校验通过。
- 待办：安装包内嵌的 `westplay.exe` 当前未签名（下一个构建调整签名顺序）；QQ/B站/3D 声场未开始。
- 已知：GitHub Actions（windows-latest）构建成功，运行级真机验证待做。

## 2026-10-28 · 里程碑 3（进行中）：QQ 音乐基础

- 上游同步：仍为 v2.1.3 `de6e887`，无新提交。
- `webview.rs`：新增 `OffscreenWebView::new_with_arguments`，每个 WebView 可带自己的 Chromium 参数（QQ 用 `--disable-web-security` 读跨域接口，只影响 QQ 自己的 profile）；`cargo check -p westplay-host` 通过。
- QQ 设计文档：`docs/cn-streaming/QQ.md`（架构/接口/登录/风险/步骤，接口与签名算法取自 Mineradio-paused）。
- 下一步：`qq.rs` + `qq.js` + 登录窗口 + UI 组件。

## 2026-10-28 · 里程碑 3b：QQ 音乐 host 核心

- 新增 `crates/host/src/qq.js`（y.qq.com 页面脚本：搜索/签名、歌曲详情、vkey 播放、歌单/歌词/我的歌单、自有 `<audio>` 播放、列表循环/随机/下一首、与 host 的消息协议）。
- 新增 `crates/host/src/qq.rs`（Qq 服务：隐藏 WebView + `--disable-web-security` 独占 profile、登录窗口、Command 路由、问题/回答/状态/播放报告、单测 5/5）。
- `signin.rs` 加 `QQMUSIC` Site + `qq_sign_in.js`（扫码登录检测）。
- `qq.rs` 复用 `netease.rs` 的 `Item/Track/Question/Answer/Playback/State` 等数据形状：UI 后续用同一套音乐组件、加“网易云/QQ音乐”切换。
- 验证：`cargo test -p westplay-host --lib qq::` 5/5；`node --check qq.js`、`qq_sign_in.js` 通过。
- 下一步：lib.rs 接线（两个服务、source 路由、状态/命令）、app 命令、companion 账号行、UI 源切换。

## 2026-10-28 · 里程碑 3c：QQ 服务接入 host（编译级通过）

- `lib.rs`：Status/AccountRequests 加 QQ 字段；`start_qq`；`PageMessage::Qq` 解析与分发；QQ 状态/回答/播放报告与关闭逻辑；性能统计 Profile::Qq。
- `app/src/main.rs`：`qq_sign_in` / `qq_sign_out` / `qq_check` Tauri 命令注册。
- 验证：`cargo test -p westplay-host --lib qq::` 5/5；`cargo check -p westplay-host` ✅；`cargo check -p westplay-app`（ASCII 源码副本）✅。
- 下一步：UI——车内音乐 App 加「网易云 / QQ音乐」切换、companion 账号页 QQ 登录行、host.ts/媒体/图标/字符串；跑 tsc+vitest。

## 2026-10-28 · 里程碑 3d：QQ 音乐 UI（源切换 + companion 登录行）

- 车内音乐 App 顶部加「网易云 / QQ音乐」切换；`setSource` 清空旧服务状态并让 Home/我的重新提问；命令按来源发 `type:'netease'|'qq'`，收到的消息按来源过滤。
- companion「账号」页新增 **QQ 音乐** 登录行（复用通用账号文案）；HostStatus/accounts/preview 全部接通。
- 中文字典 en/tr/zh 加 `sources`（网易云 / QQ Music）。
- 验证：`tsc -b` 0 错误；`vitest` 64 文件 / 451 测试全过。
- 下一步：CI 构建 QQ 预览版（含签名/安装器修复），真机验证登录/vkey/播放。

## 2026-10-28 · 里程碑 4：QQ 音乐预览构建（preview2）

- CI 构建成功：`v2.1.3-cn-preview2` 安装包 + 便携包（MSVC、自签名、安装器写入修复）。
- 便携包验证：`westplay.exe` 2.1.3 已签名；host 含 `y.qq.com`/`GetVkey`/`musicu.fcg`/`disable-web-security`；cabin UI 含 QQ 源；companion 含 `qqSignedIn`/`qq_sign_in`。
- 待真机验证：QQ 扫码登录、登录后 vkey 播放、歌单/我的歌单、列表连续播放。
- 下一步：根据真机结果修 QQ 登录/cookie；之后哔哩哔哩、3D 音效。

## 2026-10-28 · 里程碑 4b：QQ 预览版 3（账号资料接口 + debug 日志）

- `qq.js`：账号从 QQ 资料接口读取（uin/nick/头像/VIP），不再依赖读取 httpOnly cookie；vkey 失败写 `[qq] debug:`；`qq.rs` 转发该日志。
- CI 构建 `v2.1.3-cn-preview3` 成功；本地 SHA256 校验通过。
- 待真机：QQ 扫码登录 → 切源 → 搜索/播放/列表；失败时取 `[qq]` 日志继续修。

## 2026-10-28 · 里程碑 5：网易云卡车 3D 声场（preview4）

- 实测 NetEase 音频 CDN（http/https）返回 `Access-Control-Allow-Origin: *`；headless Edge 验证 media element + CORS + Web Audio 捕获后电平 > 0。
- `netease.js`：直接播放的 URL 先探测 CORS，允许时给 `<audio>` 加 `crossOrigin=anonymous` 并交给 `cab_sound`（卡车喇叭/HRTF/EQ/车外闷音/频谱）；不允许时保持直出。
- CI 构建 `v2.1.3-cn-preview4` 成功；本地 SHA256 校验全部 match。
- 待真机：车内声场/EQ/频谱效果；QQ 登录/vkey 仍未真机验证。

## 2026-10-28 · 里程碑 6：哔哩哔哩可行性验证

- headless Edge 在 bilibili 页面实测：搜索/视频详情/playurl（DASH 音频）均可匿名；音频 `<audio>` 在页面内播放正常（currentTime 在走）。
- Web Audio 捕获电平 0（CDN 无 ACAO）→ B 站 v1 只做直出，无卡车 3D 声场。
- 设计文档：`docs/cn-streaming/BILIBILI.md`（架构/接口/风险/步骤）。
- 下一步：`bilibili.js` + `bilibili.rs` + host/UI 第三来源接线。

## 2026-10-28 · 里程碑 7：哔哩哔哩 host 核心

- 新增 `crates/host/src/bilibili.js`（搜索/wbi search、热门首页、视频详情、playurl DASH 音频、我的收藏夹、自有 `<audio>` 播放、列表循环/随机/下一首、与 host 消息协议）。
- 新增 `crates/host/src/bilibili.rs`（服务/命令/问题/报告/登录窗口；复用 `netease.rs` 数据形状）；`signin.rs` 加 `BILIBILI` Site + `bilibili_sign_in.js`（扫码检测）。
- 验证：`cargo test -p westplay-host --lib bilibili::` 5/5；`node --check bilibili.js`/`bilibili_sign_in.js` 通过。
- 下一步：lib 接线（第三服务）、app 命令、UI 第三来源（网易云/QQ/哔哩哔哩）、companion 登录行；然后 tsc/vitest/cargo check + 预览构建。

## 2026-10-28 · 里程碑 8：哔哩哔哩接入完成（三源）

- lib.rs/app：第三服务 Bilibili 接线（Status/AccountRequests/PageMessage/start_bilibili/报告/Profile）；`bilibili_sign_in/out/check` 命令。
- UI：音乐 App 顶部来源三选一（网易云 / QQ音乐 / 哔哩哔哩）；companion 账号页加哔哩哔哩登录行；HostStatus/accounts/preview/strings（en/tr/zh）全接通。
- 验证：tsc 0 错误；vitest 64 文件 / 451 测试全过；`cargo test -p westplay-host --lib bilibili::` 5/5；`cargo check -p westplay-app`（ASCII 副本）通过。
- 下一步：CI 预览构建 preview5；真机验证。

## 2026-10-28 · 里程碑 9：三源预览版 5

- CI 构建 `v2.1.3-cn-preview5` 成功；SHA256 本地校验全部 match。
- 便携包验证：host 含 bilibili/playurl/api.bilibili.com；cabin/companion UI 均含 bilibili；三源切换完整。
- 待真机：网易云 3D 声场、QQ 登录/vkey、B站搜索/播放/收藏。

## 2026-10-28 · 里程碑 10：三源修复 + 内嵌 exe 签名（preview6）

- 修复 B 站条目 kind（video→song，避免 host `Answer` 解析失败、UI 点击无效）。
- QQ：登录判定不再要求读 HttpOnly 的 qm_keyst（资料接口/uin cookie 即可），登录窗口检测加页面头像兜底。
- CI：构建 app 二进制后先签名，再交给 NSIS 打包（让安装后的 westplay.exe 也带签名）。
- 待构建验证：签名是否保留、三源运行。

## 2026-10-28 · 里程碑 11：三源修复 + 签名回退（preview8）

- 修复 B 站条目 kind（video→song）、QQ 登录判定（不再依赖 HttpOnly qm_keyst）。
- 内嵌 exe 签名尝试失败：先签 app 再 `tauri build` 会被重链接覆盖；`tauri bundle` 后内嵌 exe 签名 HashMismatch（Tauri 打包改动了 exe）→ 已撤回，preview7 删除；preview8 恢复单次构建 + 安装包/便携 exe 签名。
- 结论：安装后 exe 签名需 Tauri `bundle.windows.signCommand`（在打包时签）或付费证书，属未完成项。
- preview8 验证：SHA 全 match；portable exe 已签名；CI 成功。

## 2026-10-28 · 里程碑 12：音量修复 + 三个服务拆成独立 App

- 音量：`cab_sound.js` 在捕获页面音频后加 Volume GainNode，每个 tick 跟随页面元素 `volume/muted`（Web Audio 捕获后元素自身音量不生效，这是 3D 声场下音量键失效的原因）。
- 拆分：`APPS` 新增 `qq` / `bilibili`；Home/Sidebar 各显示独立图标（新画 `qq.*.svg`、`bilibili.*.svg`）；AppScreen 分别打开 `NetEaseApp only="netease|qq|bilibili"`，打开时 `setSource` 锁定来源，移除了 App 内的来源切换按钮。
- 验证：tsc 0 错误；vitest 64 文件 / 451 测试全过；app 列表测试更新。
- 待构建：preview10（含 Tauri signCommand 内嵌 exe 签名尝试）。

## 2026-10-28 · 里程碑 13：拆 App 后的播放修复

- 同步原版：`origin/main` 仍为 de6e887（v2.1.3），无新提交。
- 修复：切换三个独立 App 时先暂停旧服务（`setSource` 发 pause），避免两个服务同时出声。
- 校验：tsc 0 错误；vitest 64 文件 451 测试全过。
- 剩余：QQ/B 站的卡车 3D 声场（需 cab 接线 + blob 音频）、内嵌 exe 签名、全量真机自测。

## 2026-10-28 · 里程碑 14：QQ/B站卡车 3D 声场

- qq.rs/bilibili.rs：复制 netease 的 Cab/Told/cab()/Spectrum 管线，启动脚本先 cab_sound.js；B 站启用独立 profile 的 --disable-web-security。
- qq.js/bilibili.js：页面 fetch 音频为 blob 再播（绕过 CDN 无 CORS），cab 实例接收 host 的 speakers/head/outside/equalizer/spectrum 并 250ms tick。
- lib.rs：QQ/B站 Spectrum 转发到车内 Equalizer；cab 循环给两个服务发卡车喇叭/头部/车外 EQ。
- 验证：node --check 两脚本；cargo test -p westplay-host --lib 212 passed / 0 failed；cargo check 通过。
- 待构建 preview11，真机验证 blob 起播延迟与 3D 效果。

## 2026-10-28 · 里程碑 15：内嵌 exe 签名完成（preview12）

- 采用 Tauri `bundle.windows.certificateThumbprint` + `digestAlgorithm=sha256`：Tauri 在打包时用 signtool 签 app 与安装包。
- 本地验证：便携 exe、安装包内嵌 exe、安装包本身三者签名均为 `CN=WestPlay CN Streaming Preview`（valid self-signed）。
- QQ/B 站 Blob 缓存 3 首上限 + revoke；B 站 Blob + Web Audio 本机 headless 实测电平 0.0616。
- CI 成功；SHA256 全 match。

## 2026-10-28 · 里程碑 16：拆 App 后的界面收尾（preview13）

- 仪表盘 Now Playing 打开当前音乐所属的 App（netease/qq/bilibili），不再总是网易云。
- companion 账号页 QQ/哔哩哔哩使用自己的 AppId 与光效（GLOW.qq / GLOW.bilibili）。
- 校验：tsc 0 错误；vitest 451 passed。

## 2026-10-28 · 里程碑 17：哔哩哔哩视频画面

- 用户指出「哔哩哔哩主要是视频平台」：B 站 App 的 Now Playing 现在显示**视频画面**。
- host `bilibili.rs` 加 `VideoShow/VideoHide`（`view.place` + `show`，clamp 到 frame），页面 `bilibili.js` 取 DASH 视频（≤720P）建立全页静音 `<video>`，隐藏 B 站页面 UI；音频仍走 blob + cab 3D，画面与音频每 900ms 同步。
- UI：`bilibiliVideo.tsx` 的 `BilibiliVideoHole` 测量 NowPlaying 封面区域，通知 host 放置并在 Shell 的 hole mask 上开洞；NowPlaying 在 B 站源时用视频洞替代封面。
- 校验：tsc 0；vitest 451 passed；npm build 通过；host 212 passed / 0 failed；node --check 通过。
- 待构建 preview14 与真机验证（视频是否显示、同步、B 站 anti-leech）。

## 2026-10-28 · 里程碑 18：B 站 Now Playing 视频放大为 16:9（preview15）

- NowPlaying 在 B 站源时改为纵向布局：视频区域 16:9、约占主体 62% 高度，歌名/进度/控制/音量在下方；本机 demo 注入播放态截图验证（视频 803×452，控制区 261px 可见）。
- 校验：tsc 0；vitest 451；npm build 通过。
- preview15 构建中。

## 2026-10-28 · 里程碑 19：B 站全屏视频播放器（preview16）

- Now Playing 里 B 站视频下方新增「全屏观看」按钮；进入全屏后视频占满整个 App 区域（侧边栏保留），顶部标题/退出、底部上一首/播放暂停/下一首悬浮在画面上（走 Shell 的 `#video-over` 层，避开开洞遮罩）。
- 修正 `BilibiliVideoHole` 的坐标：mask 用 carplay 相对 CSS 像素、host `videoShow` 用设备像素（此前 mask 坐标错误）。
- 本机 demo 注入播放态验证：全屏区域 1346×819、视频洞/控制层同尺寸（截图）。
- 校验：tsc 0；vitest 451；npm build 通过。
- preview16 构建中。
