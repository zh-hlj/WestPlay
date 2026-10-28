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
