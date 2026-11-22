# 交接

## 0.4.3 当前状态（2026-11-22）

0.4.3 把“列车真的在站场图里跑”和“货车、客车、车辆段有区别”落到代码里，版本号已统一到 0.4.3，桌面/Pad 包已重打。

- 接车动画：`tickHub()` 进站写 `enterWall`，`ctc.js` 站内车按 1500ms 从咽喉斜插股道；发车写 `departWall`，按 6000ms 从股道斜出正线再驶向出站口。
- 区间运行：`leaveHub()` 不再直接 `terminated`，置 `running`、`departAt/arriveAt`、`progress`；`tickHub()` 推进并出清，出清后才释放股道。
- 货场/站台：`trackRole()` 统一判定，`trackValid()`、`panels2.trackState()`、`drawYard()` 共用；6 道以上 1—3 道站台、其余货场，4 道按配置单线。
- 货车作业链：无预置任务的货车自动挂“货票核验 3 分、装卸 4 分、摘挂 3 分”；客车挂“客运乘降 5 分”；检测、检修、工程车沿用 20/30/15 分。
- 车辆段：K/T/Z、货物、检测、检修、工程车的色条分色；车卡副标题补编组辆数与车种。
- 云端包：`app.js` 的 `PACK_BASE` 指 `https://severuszx.github.io/dispatch/data/packs/`；首次点焦柳/宁西标签下载并合并，安装包不预装 55 站。
- 背景音乐：`audio.js` WebAudio 程序化四套和弦循环，`play()` 启动、`stop()` 停止。
- 交付：`dispatch-0.4.3-win64.zip` 162,629,906 B，sha256 `6352945d8c2ad91e279df1b3edaae89936dbcb74c287a82150e254caeca9012f`；Pad `dispatch-0.4.3-pad.apk` 510,117 B，sha256 `dd7b428cffd40bd34cac2ddd128b4969755cff1e3a89f259b405ef330bd322a0`，versionCode 7、versionName 0.4.3，Release asset id `779127986`；固定证书 `CN=Dispatch, O=TST, C=CN`，SHA-256 `8b2e1d5b0143014489c32d2e650c1190b11a87e082b493d2d0fb49b1330a8dff`。
- Pad 签名：0.4.2、旧 0.4.3、当前固定密钥三版证书各不相同，客户端检测到已安装应用签名不同时会报“安装包签名不正确”。装 0.4.3 前必须在 Pad 上长按旧“调度台”进入应用信息并卸载，再装新包；从当前版本起后续覆盖升级可沿用同一张证书。
- Pad 新包实测 apksigner：v2、v3 校验通过，证书 `CN=Dispatch`，minSdk 26、targetSdk 34；v1 未启用，targetSdk 34 不要求 v1。
- `latest.json` 已更新为 0.4.3 的 size/hash；官网首页、游戏副本、桌面/Pad 资源均已同步。

### 尚未做

- 桌面更新器“下载→SHA256→退出替换→重启”仍未真机全链路实测。
- Pad 0.4.3 APK 未实机安装试跑。
- 接车 1500ms、发车 6000ms 的手感需用户实测；BGM 音量与开关是否保留待验收。

## 0.4.2 与 55 站资源包（2026-11-22 上一轮）

- 新增 `data/hub-jl.json`（焦柳 30 站）、`data/hub-nx.json`（宁西 26 站）、`data/scenes-55.json`（56 个开班项，南阳两线各一项）。
- 55 个不重复站，三等及以上全收；16 个无客运电报码的车站（月山、洛阳东、襄阳北、新丰镇、南阳西、肥东等）按货运/编组运行，场景简介会写明。
- 12306 当日数据落在 `data/rail-2026-11-22.json`：271 趟车、全程停站；`tools/stations-55.json` 是站表，`tools/fetch-rail-more.mjs` 可重抓。
- 开班页“选择车站”改为 7 列密集行表（车站/线路/天气/时长/难度/车次/数据），去掉 4 列卡片网格与线路色块；行高约 23px，焦柳 30 行可一屏滚动查看。根目录与 `desktop\app`、`pad\app\src\main\assets`、`site\play`、`site-github\play`、`deploy_github\pages\play` 已同步，桌面 zip 与 Pad APK 已按行表重打。
- 作业系统：站内换挂、换向整备、列检、摘挂、待避。信阳 K822 换向为 K389，方向翻转并自动改配股道，实测通过；H1 K101 站内换挂实测通过。
- 0.4.2 桌面包已重打并替换 Release：`dispatch-0.4.2-win64.zip` 158,416,800 B，sha256 `5b93ace3265d2c31c9dc3eb53bdce33b8af1ea6a4d6e2810a9b7392876f803cb`；包内界面为 0.4.2，焦柳/宁西标签实测可切。
- 尚未做：更新器下载替换重启全链路实测。
- Pad 0.4.2 APK 已重打并上传：`dispatch-0.4.2-pad.apk` 331,345 B，sha256 `f5648f69950e39eaef1317858d4be7de9a93351f175dbaa406d78995df4a9577`，versionCode 5，验签通过。

## 官网、仓库与更新器（2026-11-22）

- 新仓库：`https://github.com/severuszx/dispatch`，`main` 分支；官网根目录静态站由 GitHub Pages 发布。
- 线上官网：`https://severuszx.github.io/dispatch/`；网页版 `/play/`；版本清单 `/latest.json`。
- Release：`v0.3.4`（桌面 162,608,573 B、Pad 240,874 B）；`v0.4.2`（release id `454302162`，桌面 158,416,800 B、Pad 331,345 B）。
- 桌面端更新：`desktop/main.js` 启动后 4 秒自动请求 `latest.json`；开机页“检查更新”可手动触发。比较版本后弹原生确认，下载到临时目录，校验 SHA256，退出后由 PowerShell 脚本解压覆盖安装目录并重启。
- 更新器只在 `app.isPackaged` 生效；开发态手动检查返回“开发环境不检查更新”。预加载桥 `desktop/preload.js` 已用隐藏窗口实测，`window.dispatchUpdate.check()` 返回正常。
- 仓库 `game/` 存放 0.4.2 源码；`desktop/app`、`pad/app/src/main/assets`、`site/play`、`site-github/play` 已同步 0.4.2 前端；0.4.2 桌面与 Pad 包均已发布。

## 当前状态（0.4.2，2026-11-22）

0.4.2 继续把《调度台》收成“单站复线值班”：玩家要在站场图上接车、选股道、等发车，不能再靠一次“放行”通关。网页参数 `0.4.2p`，左栏与关于页显示 `0.4.2`。官网、源码仓库、四端副本、0.4.2 桌面与 Pad 包已同步。

- 站场图：按真实双线中间站画，两条正线相邻居中，到发线分在正线两侧；两端咽喉用斜向道岔接到发线。图头新增站名牌：站名、线路、场型、股道数、值班时钟、天气和“值班员在岗”。
- 接车预告：T1 左上新增“接车预告”方角表格，列车次、始发→终到、计划到、状态，状态带“待接 N 分 / 压站外 N 分”；整行可点开动作卡。H1 八股道时自动隐藏，避免压住 1/2 道。
- 手动接车：站外车状态为 `approach`，到点前必须已指定合法股道，否则压站外并累计晚点；到点前 4 分可预留，到点自动转 `station`。`checkLimits` 晚点≥15 或站外≥12 即结束本班。
- 车次牌：在站车显示“车次 + 计划发车 + 终到站”，如 `K101 06:12发 / 终到 北京西`；不再堆车型、机车、路局。
- 动作卡：顶部路线固定“始发 → 本站 → 终到”，事实区给股道（含“站台 / 货物线 / 有效长”）、编组、计划到发、实际到发、下一区间、运用；站外车给 1—4 道按钮并标“占用 / 反向 / 货线 / 客站”。
- 股道专用：T1 `3 道` 为客运站台、`4 道` 为货物线；`trackValid` 拒绝客车进货物线、货车进客运站台，按钮内显示被拒原因。
- 开班页：整屏方角、无阴影、暖白底；模式/难度/车次改紧凑横排，去掉英文代号；右侧补“值班站 / 本班任务”。
- 教程：T1 第 1、7、8 步按“先接 K102 到 3 道，再接货1 到 4 道，K101 06:12 放行”重写；货1 40 辆约 560 m。
- 提示条：从深色圆角阴影改成方角墨块，移到顶部居中，不挡动作卡。

### 本轮已实测

- `node --check` 通过 `ctc.js`、`sim.js`、`panels2.js`、`tutorial.js`、`app.js`。
- `test-play.js`：K102 选 3 道后 `approach / reserved=true`，06:06 转 `station`，K101 放行后 `terminated`。
- 1440×900 已重拍 `check-boot.png`、`check-t1.png`、`check-action.png`、`check-h1.png`、`check-approach.png`。

### 尚未同步

- Pad 0.4.2 APK 无实机试装；versionCode 5。
- 自动更新下载→SHA256→退出替换→重启未做真机全链路实测。
- H2—H5、T2—T5 尚未逐关实拍；H1 已跑换挂，信阳已跑换向。

## 0.4.0 历史状态（2026-11-22）

0.4.0 把产品方向从“多站控制台”改成“一局只值班一个车站”。网页版本参数 `0.4.0p`，启动屏、左栏底、关于页显示 `0.4.0`。本轮只改源码与本地实拍，桌面包、Pad APK、四端副本、官网、GitHub 尚未同步。

- 单站：`setupHub` 只取焦点场，`stationOrder` / `control` / 轨道表 / 列车过滤只含该场；线路关取股道最多的站作为 `focusStation`。车站列表、切站入口、`station` 窗口全部删除。
- 复线：`draw()` 只走 `drawYard`；焦点站股道居中，上半场接上行正线，下半场接下行正线，正线经咽喉道岔连到各股道，两端画菱形道岔和信号点。客运、货运到发、编组到达按双线；检查库、段修库按一条入库线，图头写“入库线”不写“单线”。
- 车型：新增 `assets/js/fleet.js`，按车次派生 25G / 25K / 25T / C70 / CR400AF 等车型与 HXD3D / SS7E / HXD3C / SS9 等机车，按场景派生京局 / 上局 / 武局 / 西局 / 广局。
- 列车卡两行：第一行车次、方向箭头、计划发车；第二行车型 · 机车 · 路局。动作卡 8 格：位置、计划、状态、编组、车型、机车、路局、方向。
- 顶部 HUD：正点/得分改为在站/晚点/报警三个实时数，开局不再显示 0% 和未完成评分。
- 面板：左 rail 16 项收到 8 项；车站、段所、甘特、图鉴、复盘、工坊、手册、扩展包移入右上角菜单；删除 `CTC/GPH/STN` 代号和动态抽屉代号。
- 动作卡删掉重复的“查看全部信息”，“交回本站”改为“改回自动放行”；开局不再自动打开空侧栏。
- T1：线路“京广线实训段 · 上下行双线”，4 道，K101 1 道 25G/HXD3D/京局，K102 3 道 25G/SS7E/京局，货1 4 道 C70/HXD3C/京局，2 道空；教程同步改为“先放行一列，让 2 道接下一列”。
- H1：只开普速场 8 道，开局 T64、Z10 在上行 1、2 道，K101、K845 在下行 5、6 道，共 4 列在站。

### 本轮已实测

- 1440×900 T1：3 列在站，车型/机车/路局两行显示正常；顶部“在站 3 / 晚点 0 / 报警 0”；无右侧空面板。
- 1440×900 T1 点 K101：动作卡打开，8 格信息与“放行出站 / 改回自动放行 / 换一条股道 / 下发调度命令”正常。
- 1440×900 H1：8 道上下行分组，4 列在站，咽喉与双正线可见。
- `node --check` 通过 `fleet.js`、`sim.js`、`ctc.js`、`graph.js`、`app.js`、`panels.js`、`panels2.js`、`tutorial.js`、`wm.js`；`scenarios.json`、`hub.json`、`hub-t1.json` 可解析。
- 本地服务 `http://127.0.0.1:8123/index.html` 返回 200。

### 尚未同步

- `desktop\app`、`pad\app\src\main\assets`、`site\play`、`deploy_github\pages\play` 仍是 0.3.4 代码。
- 桌面包、APK、`site\dl`、官网实拍、GitHub 仓库与 Release 未更新。
- H3 检查库、H4 段修库的“入库线”未实拍；T2 仍是单线教学关；T2—T5 未逐关跑。

---

## 0.3.4 历史状态

0.3.4 已把《调度台》的真实工作台按 A 方案重做，替换掉 0.3.3 的纸面手绘。网页版本参数 `0.3.4p`，启动屏与官网展示 `0.3.4`。网页端、Windows 桌面端、Pad APK、官网、四端副本都已同步到最新代码并重新出包。

- 视觉：浅灰底 `#edf0f2`、白面板 `#ffffff`、1px 细边、14px 圆角、橙红 `#e84b30`、深墨 `#18222d`，主按钮 `#1b2634`。启动屏、左 rail、顶栏、状态栏、事件卡、结果卡、教练卡、图鉴、抽屉、Pad 模式全部换色。
- PC 键鼠台：站场图 + 右侧常开列车动作栏；默认提示“选一列车”。点车次牌后显示位置、计划、状态、编组四格，主按钮全宽；未放行时补红色影响提示。
- Pad 单任务卡：站场图全屏、底部教学卡；点车后底部动作抽屉，一次只处理一列车，所有动作按钮可见。抽屉打开时教练卡隐藏。
- 弹窗：全库已无 `alert` / `confirm` / `prompt`，Pad 端也删除了原生 `AlertDialog`，改为启动屏右侧静态注明“为 Pad 横屏设计，手机打开可能显示不全”。退出确认改为自绘 `#askLayer`，点遮罩、按 Esc、“留下继续”都关，“退出”后显示“已退出，可以直接关闭窗口”。
- 面板互斥：左侧 rail 打开非 CTC 面板时自动关右侧栏；浮窗用 `.drawer-win`，运行图 `z-index:75`，打开时关侧栏，关闭后复位 CTC。
- 单站教学 T1：直接走 `drawYard`，4 条直线股道，最大间距 104；窄屏只画站名与“N 列 · 时刻”。Pad 下站场下边界避开教练卡。
- 单站运行图：`drawTracks` 画 4 条股道行，空闲、占用实线、计划发车虚线，时间窗 `±60 分`；多场枢纽仍是 `±120 分`。
- 扩展包：补齐 `.pk-*` 卡片排版，抽屉宽 440px，列表限高滚动，安装按钮独立列；底栏只留“导入包 / 打开目录”，支持格式说明不再显示，避免底边裁字。
- 教学 T1 第 4 步去掉不存在的“接管本站”，第 7 步说明报警栏正常为空的原因。
- 官网 `site/index.html` 已改 0.3.4：顶栏、02 界面、05 扩展包、下载版本/体积/文件名、开发日志、已知问题、footer。首图、启动屏、多场裁图、扩展包图全部换成 A 实拍。

## 本轮已实测

- 1440×900 教学关：4 道全露出，右侧动作栏默认“选一列车”，底部教练横条不压股道。
- 1440×900 点 K101：2×2 信息格、全宽“放行出站”、红色影响提示正常。
- 1440×900 运行图：单站 ±60 分，1/2 道占用，06:12 / 06:24 计划发车虚线可见。
- 1440×900 H1 六场、H5 四场：白底细线橙红，车次牌、股道红/绿点、图例正常。
- 1200×800 Pad：4 道全部露出，教练卡在底部；启动屏右侧显示 Pad 横屏说明；点 K101 后动作抽屉完整显示“放行出站 / 交回本站 / 换一条股道 / 下发调度命令 / 查看全部信息”；Pad 退出确认框为自绘卡片，占宽 620px。
- 提示条：PC 教学关有教练卡时上移到教练卡上方；Pad 提示条固定在顶栏下方，不再压住底部按钮。
- 启动屏与退出框：A 配色；退出框为自绘卡片，无系统弹窗。
- 扩展包：440×152，三包各自成行，“安装”不压字，底栏两个按钮完整。
- 桌面打包版 `--capture --start --scene=t1` 出图正常，asar 内为 A 0.3.4。
- APK `com.tst.dispatch`、`versionCode 4`、`versionName 0.3.4`、`minSdk 26`、`targetSdk 34`、label「调度台」，`apksigner verify` 通过。

## 产物与校验

- `desktop\dist\调度台-win32-x64\调度台.exe`
- `site\dl\调度台-0.3.4-win64.zip`，162,608,573 bytes，sha256 `9cd7e75c86b9b141faa587bec7b1773d29884781eab65ce4c8ab2b409e061e7f`
- `site\dl\调度台-0.3.4-pad.apk`，240,874 bytes，sha256 `f181ee3075b5e6f19c7db6edad9f788b02cab4b8e936cb88cf65dc5fef7f22e9`
- 官网实拍：`preview\site-a-top.png`、`site-a-shots.png`、`site-a-packs.png`、`site-a-download.png`
- 游戏实拍：`preview\a-1440.png`、`a-1440-action.png`、`a-1440-graph.png`、`a-1440-h1.png`、`a-1440-h5.png`、`a-pad-1200.png`、`a-pad-action.png`、`a-boot-current.png`、`a-quit-ask.png`、`a-packs.png`、`packaged-a2-t1.png`

## 未完成 / 未验证

- Pad 自绘退出框与启动屏已在 1200×800 实拍；APK 未实机安装。
- H1/H5 只做静态实拍，未实际点车、放行、跑事件；H4 未跑完整班，枢纽评分继续复用线路关逻辑。
- 5 分钟事件间隔只核对常量，没有真等 5 分钟跑第二件。
- 教学 t2、t5 与通用术语教程未逐步走完，t2 仍写“点车站与站场”。
- 音效未逐条试听。
- 1100px 以下窄窗、8 股道以上站场仍有挤压风险。
- Pad APK 已验签，未在实机试装。
- GitHub 仍未登录、未建仓库、未 push、未 Release；本机无 git/gh。`deploy_github\pages\play` 已同步最新代码，但站点根、下载包、Release 地址仍未整理。
- `site\dl` 仍保留 0.3.3 及更早的包，官网只链接 0.3.4。
- 游戏名只能用中性「调度台」，不得改成「中国铁路调度」。

## 重新出包顺序

1. 结束 `调度台.exe`，否则 `dist` 被占用。
2. 同步 `index.html`、`assets`、`data`、`packs` 到 `desktop\app`、`pad\app\src\main\assets`、`site\play`、`deploy_github\pages\play`。
3. 在 `desktop` 目录用本地 Electron 缓存打包：
   `.\node_modules\.bin\electron-packager.cmd . "调度台" --platform=win32 --arch=x64 --icon=build/icon.ico --out=dist --overwrite --prune=true --electron-zip-dir="C:\Users\Lenovo\AppData\Local\electron\Cache\7e39f58f61b8a3d7ff06030e8caf7be16be4b273dfca84bfcfd833c4ac309404" --ignore="^/dist"`
   `build.ps1` 里的 `npx electron-packager` 在本机会报 `fetch failed`，脚本仍打印 `pack done`，不要只看这句话。
4. `pwsh -File pad\build-apk.ps1`，复制 APK 到 `site\dl`。
5. 用 `[System.IO.Compression.ZipFile]::CreateFromDirectory` 生成 Windows zip。
6. 重算 `site\dl\SHA256SUMS.txt`。
7. 更新 `deploy_github\pages` 根目录的官网、下载链接与 Release 地址；GitHub 登录后建仓库、push、发 Release、开 Pages。

