# CN Streaming 交付说明（WestPlay 2.1.3 中文分支）

本分支 `feature/cn-streaming` 在原版 WestPlay v2.1.3（基线 `de6e887`）上接入三个国内流媒体服务，并处理卡车 3D 声场、安装/签名与已知缺陷。车内音乐界面全中文。

## 1. 功能状态

| 服务 | App | 数据/浏览 | 账号登录 | 歌单/列表 | 播放 | 3D 声场 |
| --- | --- | --- | --- | --- | --- | --- |
| 网易云音乐 | Home「网易云音乐」 | 搜索/首页/歌单/歌词 | 扫码（可见窗口） | ✅ 自建列表、自动下一首/循环/随机 | 直链 URL + `<audio>`；VIP 受账号权限 | ✅ CORS 直捕 |
| QQ音乐 | Home「QQ音乐」 | 搜索/首页/歌单/歌词 | 扫码；资料接口读账号 | ✅ | vkey（登录后地址） | ✅ Blob 捕获 |
| 哔哩哔哩 | Home「哔哩哔哩」 | 搜索/热门/排行榜/视频详情/收藏夹 | 扫码 | ✅ 收藏夹/搜索列表 | 视频音轨 + **Now Playing 16:9 视频**、**全屏播放器（进度条/720P/1080P/自动）**、播放量显示 | ✅ Blob 捕获 |

- 三个服务是 **三个独立 App**（独立图标/窗口），打开时锁定对应服务；切换时旧服务暂停，不会双播放。
- 音量：`cab_sound.js` 捕获后新增 Volume GainNode，跟随页面元素 `volume/muted`，方向盘音量键/滑条对 3D 声场生效。
- 安装器：写入前结束旧进程、清理/改名被占用 exe，不可写则换用户目录；自签名 + `Trust-Certificate.bat`。
- 与原版 YouTube / Apple Music / Spotify 共存，未改动其逻辑。

## 2. 架构（沿用原版，不重写渲染层）

- host（Rust）为每服务启动一个隐藏 WebView2，独立 profile：
  - 网易云：`webview2-netease`，页面 `music.163.com`，注入 `cab_sound.js` + `netease.js`
  - QQ：`webview2-qq`，页面 `y.qq.com`，`--disable-web-security`（读 CDN/接口），`cab_sound.js` + `qq.js`
  - B 站：`webview2-bilibili`，页面 `www.bilibili.com`，`--disable-web-security`（fetch 音频做 Blob），`cab_sound.js` + `bilibili.js`
- 页面脚本用**页面自身 cookie** 调官方 API，把数据转换成原版 `netease.rs` 的 Item/Track/Question/Answer/Playback 形状；host 通过 `PageMessage`/`post_json` 与车内页通信。
- 登录：host 开可见 WebView 窗口（`signin.rs`），页面脚本检测登录完成（cookie / 页内头像 / nav 接口）后关闭。
- QQ/B 站播放：页面 fetch 音频 → `URL.createObjectURL(blob)` → `<audio>`（绕开 CDN 无 CORS），再交 `cab_sound` 做卡车喇叭/HRTF/EQ/车外闷音/频谱。Blob 缓存上限 3 首，超出 revoke。

## 3. 构建与发布

- CI：`.github/workflows/build-windows.yml`（windows-latest / MSVC），手动 `workflow_dispatch`。
- 产物：NSIS 安装器、便携 zip、自签名 `.cer`、`Trust-Certificate.bat`、`SHA256SUMS.txt`。
- Release 标签：`v2.1.3-cn-previewN`（预览版）。本分支最新预览见 GitHub Releases。
- 本地校验：`ui` 下 `npm run build`、`npx vitest run`；Rust 目标机用 MSVC，或按 docs 中 GNU 环境交叉检查 host 单测。

## 4. 安装 / 使用

1. 运行 `Trust-Certificate.bat`（每构建一次，信任当次自签名证书）。
2. 安装：运行 `WestPlay_2.1.3_x64-setup.exe`；或把便携 zip 解压覆盖原安装目录。
3. companion「账号」页可登录三个服务；游戏内 Home 打开对应 App。
4. 日志：`Documents\WestPlay\logs\app.log`，服务行以 `[netease]` / `[qq]` / `[bilibili]` 开头。

## 5. 自测清单（真机必过）

- [ ] 三个 App 图标存在，分别能打开
- [ ] 网易云：登录→首页/搜索→播放→列表自动下一首→切随机/循环
- [ ] QQ：扫码登录→搜索/歌单→播放（看 `[qq]` 日志是否有 vkey 失败）
- [ ] B 站：搜索/热门→播放（首次有 Blob 下载延迟）→收藏夹
- [ ] 三服务 3D：车内喇叭声场、车外变闷、EQ、频谱
- [ ] 音量键/滑条对三个服务生效
- [ ] 切换 App 不双播放
- [ ] 覆盖安装原目录成功（无“无法写入”）
- [ ] 安装后的 `westplay.exe` 属性显示有效签名（信任证书后）
- [ ] YouTube / Apple Music / Spotify 回归

## 6. 已知问题 / 风险

- 签名已解决（preview12 起）：Tauri `bundle.windows.certificateThumbprint` + 自签名证书，便携 exe、安装包、安装包内嵌 exe 均已签名；首次使用需运行 `Trust-Certificate.bat` 信任当次证书。
- QQ/B 站 Blob 方式**整首下载后起播**（大 FLAC 延迟/内存）；B 站 mcdn 可能 anti-leech，失败回退原 URL 直出（有声音、无 3D）。
- B 站视频画面在 Now Playing 显示（预览版 14 起）；全屏视频 App 仍为后续项。
- QQ vkey/登录、B 站登录/收藏仍待真机确认；代码内已加 `[qq] debug:` / `[bilibili] debug:` 日志。
- 使用零件喇叭数据的卡车（`speakers::by_parts`）在网易云/QQ/B 站没有已知喇叭，会按无声场处理（原版网易云同样）。
- 自签名证书只在本机信任后有效；正式分发需付费代码签名证书。

## 7. 后续

1. 内嵌 exe 签名（`certificateThumbprint`/signtool 或付费证书）
2. 真机回归三服务并取日志修细节
3. 可选：B 站视频画面（仿 YouTube Show/Hide 合成）、Blob 流式播放优化
4. 最终稳定 Release（脱离 preview 标签）+ 使用说明

## 8. 本机自测记录（2026-10-28，preview13）

| 检查 | 结果 |
| --- | --- |
| UI `tsc -b` | 0 错误 |
| UI `vitest run` | 64 文件 / 451 tests passed |
| UI `npm run build` | 通过 |
| host `cargo test -p westplay-host --lib` | 212 passed / 0 failed |
| CI preview11/12/13（MSVC） | success |
| Release SHA256 | 安装包/便携包全部 match |
| 签名 | 便携 exe、安装包、安装包内嵌 exe = CN=WestPlay CN Streaming Preview |
| 哔哩哔哩 Blob + Web Audio（headless） | fetch 200，blob 2.4 MB，ready 4，currentTime 前进，分析器电平 0.0616 |
| Home（cabin demo 截图） | NetEase Cloud Music / QQ Music / Bilibili 三个独立图标 |
| 原版 YouTube / AppleMusic / Spotify 回归 | 未做（需真机） |

> 上游同步：2026-10-28 检查 `origin/main` 仍为 `de6e887`（v2.1.3）；当次 `git fetch` 网络握手失败，使用已缓存的 origin/main 引用，稍后重试。

## 9. B 站视频平台功能（预览版 14–20）

- Now Playing：视频 16:9（约 803×452 @1280 宽），标题/UP/分区·播放量/进度/控制/音量在下方；
- 全屏观看：视频占满 App 区域，控制层（退出/上一首/播放暂停/下一首/可拖动进度条/清晰度）播放时淡出、触碰唤醒；
- 清晰度：720P / 1080P / 自动（切换重取 playurl，保持播放位置）；
- 首页：热门 + 排行榜；曲目显示分区与播放量；
- 视频画面与卡车音频（Blob + cab_sound 3D）每 900ms 同步；隐藏时暂停页面视频解码。

## 10. 真机已知限制（2026-10-28）

- **QQ 音乐微信登录**：vkey 服务返回 104003，微信会话无 QQ uin；请用 QQ 账号扫码。代码已加 `uin()` 的 wxuin 回退、vkey 重试与 `wechat=yes/no`/cookie 名日志。
- 网易云 3D 的 CORS 探测已改为成功才缓存、失败重试；日志 `[netease] debug: capture speakers|direct <host>` 可确认。

## 11. QQ 微信登录的结论（2026-10-28）

- 用你的 WebView2 登录态在无头 Edge 复现：cookie 为微信登录（`qm_keyst W_`、`wxuin/euin/wxopenid`，无 QQ uin）；
- `vkey.GetVkeyServer` 对 `wxuin/euin/qlogin_uid` 各种 uin 与 `authst/ct/platform` 组合均返回 104003；即使宿主侧带完整 Cookie 请求也一样；
- 尝试让 QQ 网页自己播放（免费歌曲页 + 点击播放）：页面没有可直接控制的 `<audio>/<video>` 元素（播放器走内部加密流），无法做轻量回退；
- 结论：QQ 音乐**播放需 QQ 账号扫码登录**；微信登录可浏览/收藏但无法直链播放。companion 已在 QQ 行提示“播放需 QQ 账号”。

## 12. B 站视频链路验证（2026-10-28，headless Edge）

- 在 bilibili 页面内取 `player/playurl` DASH 视频地址（<=720P），用 `<video muted>` 播放：`paused:false`、`readyState:4`、`currentTime` 前进（匿名环境 480P；登录后可选 720/1080P）；
- 音频走页面 fetch->Blob->cab_sound（实测 fetch 200、Blob 2.4MB、AudioContext 电平 0.0616）；
- host `videoShow/videoHide/videoQuality` 与 Shell `#video-over` 开洞、Now Playing/全屏切换均已接线；真机仍需确认画面合成与音画同步。

## 13. RC1（2026-10-28）

- 功能范围：网易云/QQ/B 站三个独立 App；B 站视频 Now Playing + 全屏 + 清晰度；三服务 3D 声场；音量修复；全链路签名。
- 已知限制：QQ 微信登录无法 vkey（需 QQ 账号）；B 站视频真机合成待确认；网易云 3D 待真机日志确认。
- 安装：先 `Trust-Certificate.bat`，再用安装包或便携包；companion 账号页登录。

## 14. RC2（2026-10-28）

- 网易云 3D：对 `*.music.126.net` / `*.music.163.com` 直接视为可捕获（CDN 已实测 `Access-Control-Allow-Origin: *`），不再依赖可能被 WebView2 HEAD 拒绝的探测；其余保留“成功才缓存、失败重试”。

## 15. 账号链路验证（用真机 WebView2 profile，2026-10-28）

- **哔哩哔哩**：用你 PC 上 `webview2-bilibili` profile 无头验证：`nav.data.isLogin=true`、`mid` 存在、`x/v3/fav/folder/created/list-all` 返回 `code 0` 且有 **8 个收藏夹** → B 站登录/收藏夹链路可用。
- **QQ**：微信登录态下 `fcg_get_profile_order_asset.fcg` 返回非 JSON/加密内容，歌单列表接口暂不可用（播放 vkey 亦 104003）；QQ 账号登录路径仍待真机。
