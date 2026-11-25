# 调度台

《调度台》的官网与游戏源码仓库。

- 官网：https://severuszx.github.io/dispatch/ （0.5.8 深色版已上线）
- 网页版：https://severuszx.github.io/dispatch/play/
- 发布包：https://github.com/severuszx/dispatch/releases
- 版本清单：https://severuszx.github.io/dispatch/latest.json

## 当前版本

- 安装包：Android `调度台-0.6.19.apk`（WebView 内置资源服务，482 KB，已签名）；Windows `调度台-0.6.19-win64.zip`（Electron portable，152 MB）。
- 全量网页版已发布 `app_17jrnmgq939`，release `7712087175769623806`，入口含值班调度与经营管理；本地压缩包 `调度台-0.6.19-网页版.zip`。
- 站长台 0.6.19：全屏宝鸡站站场图 + 右侧经营台账抽屉，桌面/手机均按大地图取景；单文件版已发布 `app_17jr0d8xw5s`，release `7711958404785556715`。
- 值班台 0.6.19：默认场景切到宝鸡站客运场，6 台 10 线；1 道基本站台，2—9 道岛式站台，10 道尽头式；补错位咽喉曲线和股道类型。
- 站场拓扑草稿 v0.6.18：画布 3600×1500，非客运场用横向梯形岔；补全 25G/25B/25K/25T/22B/SY25K/CR400AF/CRH380A/C70/X6K/N17/G70 与 HXD3D/HXD3C/SS7E/SS9/DF11/DF7G 车辆图；货1 改 C70 敞车。主线列车详情新增编组预览。已发布 `app_17jnybc5g0g`，release `7711752270744636684`。
- 20 个扩展包清单在 `data/dlc/`，网页版从该目录按需下载。

## 目录

- `index.html`、`assets`、`play`、`shots`：官网静态站，GitHub Pages 直接从 `main` 根目录发布
- `latest.json`：桌面端更新检查读取的版本清单
- `data/dlc/`：网页版扩展包清单与单包 manifest
- `game/`：0.6.19 游戏源码、数据与安装包构建目录
- `game/desktop/`：Electron 主进程、预加载桥、打包入口
- `game/android/`：原生 WebView APK 构建目录

## 更新流程

1. 修改 `game/`，在本地跑通。
2. 同步 `game/` 到 `play/`，同步 `game/data/dlc/` 到 `data/dlc/`。
3. 打出 Windows 包，上传到 GitHub Releases，不要进仓库。
4. 更新 `latest.json` 的版本、下载地址、大小与 SHA256。
5. 推送 `main`，等待 Pages 重新构建。
