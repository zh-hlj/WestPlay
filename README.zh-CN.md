# WestPlay（简体中文 + 网易云音乐 分支）

> 把电脑上的音乐、视频和地图，投到 **Euro Truck Simulator 2 / American Truck Simulator** 卡车的原车中控屏上。
> 本仓库是 [enes-less/WestPlay](https://github.com/enes-less/WestPlay) 的非官方分支：在官方 **v2.1.0** 基础上加入**简体中文界面**和**实验性网易云音乐**，并用 GitHub Actions 构建 Windows 安装包。

> **简体中文说明**（本文件） | 上游英文说明：[README.md](README.md)

---

## 这是什么

WestPlay 会在游戏里替换/扩展卡车的导航屏幕：把真实网页（Spotify、Apple Music、YouTube、YouTube Music、地图等）渲染到卡车的屏幕上，音乐声音则通过卡车的扬声器（带车内 3D 声场/EQ）播放。你可以在游戏里用方向盘按键或鼠标操作屏幕。

本分支在官方 v2.1.0 的基础上做了三件事：

1. **完整的简体中文界面**：跟随游戏语言，游戏是中文就显示简体中文；包含车内中控界面与 companion 助手。
2. **实验性网易云音乐**：登录、搜索、首页推荐、歌单、歌词、播放/暂停/进度/音量、**列表连续播放**、**账号 VIP 状态读取与按权限取音质**。
3. **可直接使用的 Windows 构建**：GitHub Actions（MSVC 官方工具链）自动构建安装版和便携版。

## 功能概览

| 功能 | 说明 |
| --- | --- |
| 卡车屏幕 | 在 ETS2/ATS 支持车型的原车屏幕上显示 WestPlay 界面 |
| 简体中文 | 游戏语言为中文时自动显示简体中文（`English / Türkçe / 简体中文`） |
| 网易云音乐 | 实验性接入：扫码登录、搜索、首页推荐、我的歌单、歌词、播放控制、读取账号 VIP 状态（VIP/黑胶VIP/非VIP）并按权限取音质 |
| 列表播放 | 歌单点「播放」后按列表连续播放：自动下一首、跳过不可播的歌、循环/随机、上一首/下一首 |
| 其它音乐 | 保留上游的 Spotify / Apple Music / YouTube / YouTube Music |
| 地图 | 保留上游地图功能 |
| companion 助手 | 账号登录、设置、自定义、地图状态等 |
| 安装/便携 | 提供 NSIS 安装包和免安装便携包 |

## 安装

从 [Releases](https://github.com/zh-hlj/WestPlay/releases) 下载：

- **安装版**：`WestPlay_2.1.0_x64-setup.exe` —— 安装时建议选一个**普通用户可写目录**（如 `C:\Users\<你>\AppData\Local\WestPlay`）。部分机器上覆盖安装到 `C:\gameDATE` 这类旧目录会失败（Windows 拒绝写入旧文件），遇到时改用便携版。
- **便携版**：`WestPlay-2.1.0-netease-zh-portable-msvc.zip` —— 解压到任意目录直接运行；WebView2 数据目录被占用时使用包内 `启动(避让占用).bat`。

注意事项：

- **签名**：构建用自签名证书签名（没有付费代码签名证书，Windows 仍可能显示"未知发布者"）。先运行下载包内的 `信任证书.bat`（加入当前用户的 Root / TrustedPublisher），之后 `setup.exe`/`westplay.exe` 不再弹未知发布者；每次更新后重跑一次（每个构建证书不同）。不想信任证书就选「更多信息 → 仍要运行」或直接用便携版。
- **覆盖安装**：安装器写入前会结束正在运行的 WestPlay，并删除/改名旧的 `westplay.exe`；若原目录仍不可写（例如权限异常的 `C:\gameDATE`），会自动改安装到 `%LOCALAPPDATA%\WestPlay` 并在安装时提示。
- 本分支已**关闭指向上游官方源的自动更新**，不会把修改版更新成官方版；
- 需要系统已安装 WebView2 Runtime（Win10/11 一般自带 Edge 即已安装）。

## 使用

1. 启动 `westplay.exe`（或启动 bat）；
2. companion 打开后，「账号」页可以登录网易云音乐（会在桌面弹出官方网页登录窗口，用手机网易云 App 扫码）；
3. 进入游戏，在卡车屏幕上打开「网易云音乐」；
4. 在「首页 / 搜索 / 我的」里找歌：点歌单进入列表，按列表的「播放」即从第一首能播的开始**连续播放**；
5. 方向盘/键盘按键操作屏幕（具体按键见游戏内设置）。

## 从源码构建

- 官方 CI：GitHub Actions `windows-latest` + MSVC（`.github/workflows/build-windows.yml`），自动产出 NSIS 安装包和便携包；
- 本地构建需要 Node.js、Rust（MSVC 工具链）和 WebView2 Runtime，命令与上游一致：
  ```powershell
  npm install
  cargo build --release -p westplay-plugin
  npm run tauri build
  ```
  本分支的 CI 会在构建前把 `app/` 配置合成为 `src-tauri/`，并覆盖安装器的 WebView2 检测与更新源配置。

## 已知限制

- **版权/VIP**：网易云 VIP/版权歌曲由网易云接口决定；程序会读取账号 VIP 状态并在「我的」页显示，**有会员且地区允许**时 VIP 歌曲可播放，取不到播放地址时会跳过或提示，本分支**不绕过**任何版权限制；
- 搜索/首页直接点单曲时没有列表上下文，播完会停（歌单播放已连续）；
- 声音目前是普通立体声直出，尚未接入卡车的 3D 声场/车内 EQ；
- 网易云网页改版可能导致部分页面/接口失效（播放走独立接口，不依赖网页播放器）；
- 安装器已处理旧文件占用/不可写（必要时自动换目录）；没有付费受信任证书，自签名需先运行信任脚本；
- 详情与待办见 [`docs/netease/README.md`](docs/netease/README.md) 和仓库根目录的未完成清单（本地交付包内）。

## 免责声明

- 本项目为**非官方**修改，与 SCS Software、网易云音乐、Apple、Spotify、Google、YouTube 均无关联；
- 网易云音乐接入为实验性功能，仅通过官方网页登录态与其公开接口读取/播放，不下载、不破解、不绕过版权；
- 请遵守相关服务条款；因使用本分支产生的任何问题由使用者自行承担。

## 许可

GPL-3.0-or-later，与上游一致。上游版权归 [enes-less](https://github.com/enes-less/WestPlay) 及贡献者所有；本分支的修改同样以 GPL-3.0-or-later 发布。

## 相关链接

- 上游仓库：https://github.com/enes-less/WestPlay
- 本分支仓库 / Releases：https://github.com/zh-hlj/WestPlay
- 网易云接入设计与接线文档：[`docs/netease/README.md`](docs/netease/README.md)
- 真机验证清单：[`docs/netease/verification.md`](docs/netease/verification.md)

## 更新日志（摘要）

- 2026-10-27：网易云**列表播放**修好——歌单连续播放、自动下一首、跳过不可播、循环/随机、接下来播放；单曲不再假装播放。
- 2026-10-27：读取**账号 VIP 状态**（「我的」页显示 VIP/黑胶VIP/非VIP），VIP 账号按权限请求无损/320k 音质；VIP 歌能否播放仍取决于账号与网易版权。
- 2026-10-27：安装器覆盖问题修复（结束旧进程、清理/改名旧文件、不可写自动换目录）；安装包/exe 加自签名证书和 `信任证书.bat`（消除本机未知发布者提示）。
- 2026-10-26：网易云改为**自己播放音频**（不再依赖出问题的网页播放器），登录/歌单/搜索可用；修复播放无声。
- 2026-10-26：合并官方 v2.1.0；中文界面；GitHub Actions 构建安装包/便携包；关闭官方更新源。
