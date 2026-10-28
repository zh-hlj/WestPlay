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
