# 调度台

《调度台》的官网与游戏源码仓库。

- 官网：https://severuszx.github.io/dispatch/ （0.5.8 深色版已上线）
- 网页版：https://severuszx.github.io/dispatch/play/
- 3D 驾驶：https://severuszx.github.io/dispatch/play/3d/drive.html
- 发布包：https://github.com/severuszx/dispatch/releases
- 版本清单：https://severuszx.github.io/dispatch/latest.json

## 当前版本

- 3D 驾驶初版：宁西线 Z595，HXD3D 牵引 18 辆 25T，信阳—西安；司机室三屏、36 个可操作开关、牵引/制动/受电弓/主断/管压/监控、驾驶室/操纵台/外部三视角，带日光阴影与接触网。入口 `play/3d/drive.html`，资源包 `ningxi-z595`。司机室开关位置按公开照片近似，尚未达到 99% 实车复原；线路为压缩示意，真实里程、坡度、曲线、桥隧未接。

- 网页版与源码：0.5.8；独立经营模式已上线 `play/manage/`，值班台 `play/` 仍是 0.5.7。新增下一班队列、90/45 判负红线、折线进出站与现场音效。
- 经营手机端已适配 390×844；线上经营页使用单文件 JS + 合并 CSS，CDN 托管。
- 桌面 Zip、Pad APK、`latest.json` 仍是 0.4.3，0.5.8 尚未重打。
- `latest.json` 仍指向 0.4.3，等新安装包发布后更新。
- 安装包：Android `调度台-0.6.19.apk`（WebView 本地资源服务，482 KB，已签名）；Windows `调度台-0.6.19-win64.zip`（Electron portable，152 MB）。
- 全量网页版已发布 `app_17jrnmgq939`，release `7712087175769623806`，入口含值班调度与经营管理；本地压缩包 `调度台-0.6.19-网页版.zip`。
- 站长台 0.6.19：全屏宝鸡站站场图 + 右侧经营台账抽屉，桌面/手机均按大地图取景；单文件版已发布 `app_17jr0d8xw5s`，release `7711958404785556715`。
- 站场拓扑草稿 v0.6.18：画布 3600×1500，非客运场用横向梯形岔；补全 25G/25B/25K/25T/22B/SY25K/CR400AF/CRH380A/C70/X6K/N17/G70 与 HXD3D/HXD3C/SS7E/SS9/DF11/DF7G 车辆图；货1 改 C70 敞车。主线列车详情新增编组预览。已发布 `app_17jnybc5g0g`，release `7711752270744636684`。
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
