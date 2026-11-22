# 调度台

《调度台》的官网与游戏源码仓库。

- 官网：https://severuszx.github.io/dispatch/
- 网页版：https://severuszx.github.io/dispatch/play/
- 发布包：https://github.com/severuszx/dispatch/releases
- 版本清单：https://severuszx.github.io/dispatch/latest.json

## 目录

- `index.html`、`assets`、`play`、`shots`：官网静态站，GitHub Pages 直接从 `main` 根目录发布
- `latest.json`：桌面端更新检查读取的版本清单
- `game/`：0.4.2 游戏源码、数据与桌面壳
- `game/desktop/`：Electron 主进程、预加载桥、打包入口

## 更新流程

1. 修改 `game/`，在本地跑通。
2. 同步游戏前端到 `game/desktop/app` 或直接用打包脚本。
3. 打出 Windows 包，上传到 GitHub Releases，不要进仓库。
4. 更新 `latest.json` 的版本、下载地址、大小与 SHA256。
5. 推送 `main`，等待 Pages 重新构建。
