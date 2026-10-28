# CN Streaming 基线记录

- 基线仓库：`enes-less/WestPlay`（最新原版）
- 基线 commit：`de6e887ecf5d8da3b83dcd129a168330d6b596ca`（`WestPlay 2.1.3`，2026-10-27 17:49 +0300）
- 本地路径：`C:\DSH\工作区\WestPlay`
- 开发分支：`feature/cn-streaming`（从原版 main 建出）
- 覆盖时间：2026-10-28（Asia/Shanghai）

## 覆盖前备份（10月28日复刻版，仅参考）

- Git bundle：`C:\DSH\工作区\backup-2026-10-28\WestPlay-feat-netease-zh.bundle`（含 `feat/netease-zh` 全部提交）
- 旧工作区：`C:\DSH\工作区\backup-2026-10-28\WestPlay-old-pre-2.1.3`
- 已在当前仓库加 remote `reference` 指向旧工作区，可 `git show reference/feat/netease-zh:<path>` 取任意文件对照/移植。
- 可复用内容：网易云接入（host `netease.rs/js/sign_in.js`、车内网易云组件、companion 账号页、中文词条、图标、文档、CI 构建/签名/安装器修复）。

## 原版自检（开工前）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 依赖安装 | `npm install`（含 `npm --prefix ui install`） | 通过（0 vulnerabilities） |
| UI 构建 | `npm --prefix ui run build`（tsc -b + vite build） | 通过 |
| UI 测试 | `npm --prefix ui test`（vitest） | 通过 |
| Host 编译 | `cargo check -p westplay-host`（Rust 1.99.1 GNU 工具链） | 通过（Finished dev profile in 3m 11s） |
| YouTube/AppleMusic/Spotify 运行自检 | 需 WebView2 + 游戏真机 | **待真机验证**（编译级已通过；本机游戏会话时补） |
| 原版 `npm run build`（Tauri 安装包） | MSVC 工具链 | 未跑（本地为 GNU；可交给 GitHub Actions） |

## 下一步（按执行文稿）

1. 从 `reference/feat/netease-zh` 逐文件移植网易云接入到 2.1.3 基线上（host 模块 + 车内 UI + companion + 中文 + 图标 + 文档），边移植边 `tsc`/`cargo check`/`vitest`。
2. QQ 音乐：参考 `XxHuberrr/Mineradio-paused` 的账号方案，先做 web 端数据抓取 + 组件 + 列表播放。
3. 哔哩哔哩：调研并实施登录/数据获取 + 组件。
4. 3D 音效（卡车音响）：研究原版 `speakers.rs` / `cab_sound.js` 与网易云跨域音频的接入方式。
5. 修复清单漏洞，全量自测，元旦前交付。
