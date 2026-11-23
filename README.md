# 调度台

《调度台》的官网与游戏源码仓库。

- 官网：https://severuszx.github.io/dispatch/ （0.5.8 深色版已上线）
- 网页版：https://severuszx.github.io/dispatch/play/
- 发布包：https://github.com/severuszx/dispatch/releases
- 版本清单：https://severuszx.github.io/dispatch/latest.json

## 当前版本

- 网页版与源码：0.5.8；独立经营模式已上线 `play/manage/`，值班台 `play/` 仍是 0.5.7。新增下一班队列、90/45 判负红线、折线进出站与现场音效。
- 经营手机端已适配 390×844；线上经营页使用单文件 JS + 合并 CSS，CDN 托管。
- 桌面 Zip、Pad APK、`latest.json` 仍是 0.4.3，0.5.8 尚未重打。
- 20 个扩展包清单在 `data/dlc/`，网页版从该目录按需下载。

## 目录

- `index.html`、`assets`、`play`、`shots`：官网静态站，GitHub Pages 直接从 `main` 根目录发布
- `latest.json`：桌面端更新检查读取的版本清单
- `data/dlc/`：网页版扩展包清单与单包 manifest
- `game/`：0.5.8 游戏源码、数据与桌面壳
- `game/desktop/`：Electron 主进程、预加载桥、打包入口

## 更新流程

1. 修改 `game/`，在本地跑通。
2. 同步 `game/` 到 `play/`，同步 `game/data/dlc/` 到 `data/dlc/`。
3. 打出 Windows 包，上传到 GitHub Releases，不要进仓库。
4. 更新 `latest.json` 的版本、下载地址、大小与 SHA256。
5. 推送 `main`，等待 Pages 重新构建。

离线网页包：https://aka.doubaocdn.com/s/54NhUaM7v6 （490 KB，解压后起静态服务器）
