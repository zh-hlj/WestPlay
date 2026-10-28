# CN Streaming 交付说明（WestPlay 2.1.3 中文分支）

本分支 `feature/cn-streaming` 在原版 WestPlay v2.1.3（基线 `de6e887`）上接入三个国内流媒体服务，并处理卡车 3D 声场、安装/签名与已知缺陷。车内音乐界面全中文。

## 1. 功能状态

| 服务 | App | 数据/浏览 | 账号登录 | 歌单/列表 | 播放 | 3D 声场 |
| --- | --- | --- | --- | --- | --- | --- |
| 网易云音乐 | Home「网易云音乐」 | 搜索/首页/歌单/歌词 | 扫码（可见窗口） | ✅ 自建列表、自动下一首/循环/随机 | 直链 URL + `<audio>`；VIP 受账号权限 | ✅ CORS 直捕 |
| QQ音乐 | Home「QQ音乐」 | 搜索/首页/歌单/歌词 | 扫码；资料接口读账号 | ✅ | vkey（登录后地址） | ✅ Blob 捕获 |
| 哔哩哔哩 | Home「哔哩哔哩」 | 搜索/热门/视频详情/收藏夹 | 扫码 | ✅ 收藏夹/搜索列表 | 视频音轨（DASH 音频） | ✅ Blob 捕获 |

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
- B 站 v1 只播音频，不显示视频画面。
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
