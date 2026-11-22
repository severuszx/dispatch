import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT = join(process.cwd(), 'data');

const P = { key: 'P', name: '人的因素', short: '人' };
const E = { key: 'E', name: '设备因素', short: '设备' };
const N = { key: 'N', name: '环境因素', short: '环境' };
const M = { key: 'M', name: '管理因素', short: '管理' };

const FAMILY_BRANCHES = {
  P: [
    { id: 'b1', label: '立即补发/更正命令，电话复核受令者', risk: '低', tone: 'safe', time: 2, score: 6, effect: '命令合规 +6，岗位补位；处理慢 2 分钟', why: '规章要求命令必须准确到受令者，宁可慢一点' },
    { id: 'b2', label: '先口头通知车站值班员，正式命令稍后补', risk: '中', tone: 'warn', time: 0, score: -6, effect: '当场压住风险，但命令校验判漏发', why: '能抢时间，复盘时会算一次违规' },
    { id: 'b3', label: '暂不处置，盯一站看是否自愈', risk: '高', tone: 'danger', time: 0, score: -14, effect: '可能演变为二级传播，站外停车概率上升', why: '人力紧张时的赌，赌输就是大面积晚点' },
    { id: 'b4', label: '上报值班主任，与邻台联动交接', risk: '低', tone: 'safe', time: 4, score: 3, effect: '交接单记入，传播链被截断一级', why: '跨台问题不要自己扛' },
    { id: 'b5', label: '扣车待命，等现场确认后再放行', risk: '中', tone: 'warn', time: 3, score: -2, effect: '安全但占用一条到发线', why: '信息不完整时最稳，代价是股道' },
  ],
  E: [
    { id: 'b1', label: '发布临时限速命令，限速通过', risk: '中', tone: 'warn', time: 1, score: 4, effect: '区间保通，能力降至 70%', why: '不需要封锁就能维持基本秩序' },
    { id: 'b2', label: '封锁区间，抢修组上线', risk: '低', tone: 'safe', time: 8, score: 5, effect: '区间封闭，能力 0；安全底线保住', why: '必须封锁的故障不要犹豫' },
    { id: 'b3', label: '改走邻线/反向行车，签发反方向命令', risk: '高', tone: 'danger', time: 4, score: -4, effect: '维持通过能力，但命令校验严查', why: '反方向行车是降级手段，不是常规操作' },
    { id: 'b4', label: '维持原速通过，通知司机注意瞭望', risk: '高', tone: 'danger', time: 0, score: -12, effect: '可能触发险性事件判定', why: '有些故障不能赌' },
    { id: 'b5', label: '启用热备/救援资源顶替', risk: '中', tone: 'warn', time: 6, score: 2, effect: '消耗一张底牌，交路恢复', why: '底牌用一张少一张' },
    { id: 'b6', label: '通知电务/工务/供电专业到场，设防护', risk: '低', tone: 'safe', time: 5, score: 3, effect: '专业处置，故障定位更准', why: '调度不能替专业干活' },
  ],
  N: [
    { id: 'b1', label: '按雨量/风速计标准降速至 120', risk: '低', tone: 'safe', time: 1, score: 5, effect: '按标执行，正点率小幅下降', why: '有明确阈值就按阈值' },
    { id: 'b2', label: '进一步限速至 45 并加派巡守', risk: '中', tone: 'warn', time: 2, score: 3, effect: '安全冗余更大，区间能力降至 40%', why: '雨更大时只能这么干' },
    { id: 'b3', label: '封锁区间，停止接发', risk: '低', tone: 'safe', time: 6, score: 4, effect: '零风险，但枢纽开始积压', why: '极端天气先保命' },
    { id: 'b4', label: '维持原速，只发天气预警', risk: '高', tone: 'danger', time: 0, score: -16, effect: '可能直接判失败', why: '越过红线的操作' },
    { id: 'b5', label: '启动防洪/防台预案，压缩天窗', risk: '中', tone: 'warn', time: 5, score: 2, effect: '设备健康度下降，后续故障概率上升', why: '省下的天窗会以另一种方式还回来' },
  ],
  M: [
    { id: 'b1', label: '停运部分临客，保图定正点', risk: '低', tone: 'safe', time: 3, score: 4, effect: '正点率回升，客运收入下降', why: '取舍就是调度的工作' },
    { id: 'b2', label: '全部接入，硬扛到发线全满', risk: '高', tone: 'danger', time: 0, score: -10, effect: '站外停车队列增长，情绪值下跌', why: '枢纽最怕的就是"全都放进来"' },
    { id: 'b3', label: '加开热备车底，切断车底接续', risk: '中', tone: 'warn', time: 7, score: 3, effect: '消耗热备，后续无底牌', why: '一次热备换一条传播链' },
    { id: 'b4', label: '与邻局协调推迟分界口接入', risk: '中', tone: 'warn', time: 5, score: 1, effect: '邻局不满，本地压力缓解', why: '把压力推给别人，账要还' },
    { id: 'b5', label: '向客运段申请乘务换班，解除超劳', risk: '低', tone: 'safe', time: 4, score: 5, effect: '安全卡控解除，交路延长', why: '超劳是硬红线' },
  ],
};

function buildRoots(spec) {
  const out = [];
  for (const [family, sub, items] of spec) {
    for (const line of items) {
      const parts = line.split('|');
      out.push({ family: family.key, familyName: family.name, sub, code: parts[0], title: parts[1], sev: Number(parts[2]), desc: parts[3] || '', radio: parts[4] || '' });
    }
  }
  return out;
}

const ROOTS = buildRoots([
  [P, 'D', [
    'P-D-01|调度命令漏发|4|封锁命令只通知了车站，没通知司机，列车已压上接近区段|"客车K1178次，你刚才那条封锁命令我没收到，现在已经进接近区段了"',
    'P-D-02|受令者错误|4|命令发给了相邻车站而不是作业车站，两个站都以为对方在办|"调度，这条限速命令是给我的还是给宝鸡站的？"',
    'P-D-03|进路排列超时未介入|3|自动进路 45 秒超时报警连响三次，没人点确认|CTC 报警栏连续跳出"进路超时"提示',
    'P-D-04|未及时设临时限速|4|工务报的限速点已经过去两趟车，命令还压在手边|"工务说 45 公里限速，你什么时候下命令？"',
    'P-D-05|热备启用延迟|3|热备动车组在原位等了 26 分钟，故障车还在站外|"热备组问还走不走，司机已经待命 20 多分钟"',
    'P-D-06|分界口交接判断失误|3|把邻局接入的一列超长货车当成空车放进了枢纽|邻台："这列编组 62 辆，你别当我这里是编组场"',
    'P-D-07|交接班信息遗漏|4|交接单上没写热备已被占用，接班人按满编配置排计划|"交接单热备栏是空的，可实际上那组车底在整备"',
    'P-D-08|命令复诵缺失|3|司机只回了"收到"，没有复诵命令号，事后无法核对|"收到"——录音里只有这两个字',
    'P-D-09|越权调整运行计划|3|私自把重点列车往后排，没有报值班主任|运行图终端出现一条无审批的调整记录',
    'P-D-10|盯台疲劳误读车次|3|把 K1178 看成 K1176，进路排给了另一列车|"这不是 1176 吗？"值班员在电话那头反问',
    'P-D-11|误判占用状态放行|5|CTC 显示区间空闲，实际上一列货车还没出清|"区间不是有车吗？你怎么放的？"',
    'P-D-12|忘记录入封锁登记簿|3|封锁了区间但登记簿没写，接班的人不知道|登记簿最后一行还是前一班的记录',
    'P-D-13|调车通知单填写错误|3|通知单股道写错一位，调车组把车送进了邻线|"3 道还是 8 道，你写的是 38？"',
    'P-D-14|未通知客调加开临客|3|临客已上线，客调还在按原图排站台|"这趟临客什么时候加的？我这没接到通知"',
    'P-D-15|漏发降弓通过命令|4|接触网有异物，列车还带着弓往上冲|"前面挂网了，你怎么还没让我降弓？"',
    'P-D-16|误将检修车当运用车|3|扣修车底被排进了始发交路|车辆段："这组在二级修，你排它跑？"',
    'P-D-17|对司机的异响报告处置犹豫|4|司机报车外异响，调度既没扣车也没让继续，僵了 4 分钟|"到底停不停？我这儿速度已经起来了"',
    'P-D-18|未核受令车站值班员在岗|4|命令发给了无人站，站里根本没人|"宝鸡站现在是无人值守，你发命令给谁？"',
    'P-D-19|复核时漏看限速区间|4|命令只写了起点，没写终点里程|"限速到哪一站结束？"',
    'P-D-20|夜班单人盯双台|3|一台盯高速场一台盯普速场，报警漏看两次|报警栏两条未处置记录叠在一起',
    'P-D-21|调度台电话占线未记录|2|关键通话没记入台账，复盘时缺证据|录音里有一段 90 秒的空白',
    'P-D-22|误用邻台权限排进路|4|在邻台终端上排了一条进路，两边锁闭状态冲突|"这条进路是谁排的？我这边锁不上"',
    'P-D-23|临时变更径路未通知司机|4|径路改了，司机还按原方向准备进站|"我这车头都摆好了，你让我改到几道？"',
    'P-D-24|春运期间超负荷排计划|3|计划排得比股道能力多 18%，自己也知道排不下|运行图上一片红',
    'P-D-25|对 AI 助调建议照单全收|3|助调推荐了一条交叉进路，调度没有复核|"这俩车要是在咽喉顶上了呢？"',
  ]],
  [P, 'S', [
    'P-S-01|车站未及时开放信号|3|列车已到站外，出站信号还没开|"宝鸡站，车在那儿等 3 分钟了，信号呢？"',
    'P-S-02|车站误办进路|4|值班员把接车进路排成了发车进路|"我这边锁的是发车，你那车是进来的"',
    'P-S-03|无人站调车通知单错误|3|无人站按旧通知单作业，股道已改|"通知单上还是 5 道，实际 5 道封锁了"',
    'P-S-04|货检漏检超限货进正线|4|超限货车未经审批直接放进正线|"这车装得比限界宽，怎么上的正线？"',
    'P-S-05|车站值班员擅自变更接车线|4|临时把接车线从 2 道改到 4 道，没报调度|"我这儿 4 道，你别按 2 道排了"',
    'P-S-06|站台作业与接发冲突|3|上水作业没撤，列车已经进站|"水管还在车上挂着"',
    'P-S-07|车站未报列车到发|3|到发点没报，运行图终端空了一大段|运行图上出现一段没有任何实绩的空白',
    'P-S-08|车站报点延迟|2|实绩晚了 6 分钟才录，传播判断失真|"刚才那趟几点到的？我记不清了"',
    'P-S-09|车站误关信号|4|列车接近时信号突然关闭，司机紧急制动|"信号怎么灭了？"',
    'P-S-10|车站人员未确认防溜|4|坡道上的车没设铁鞋|"这车怎么自己动了一下？"',
    'P-S-11|车站擅自开放非到发线|4|货物线接了一趟客车，站台对不上|"旅客从货物线下来，走哪儿？"',
    'P-S-12|车站与外勤沟通中断|3|外勤没收到甩挂指令，车底没摘|"这车怎么还挂着？"',
  ]],
  [P, 'L', [
    'P-L-01|司机未试闸|4|始发开车前没做制动试验|"闸没试就开了？"',
    'P-L-02|司机误认信号冒进出站|5|把邻线信号当本线，直接出站|"你刚才闯的是红灯"',
    'P-L-03|司机疲劳错过减速点|4|连续值乘 9 小时，减速点已过才反应|"我看见限速牌的时候已经来不及了"',
    'P-L-04|机车换挂延迟|3|换挂作业超时 12 分钟|"机务说挂不上，前面那台还没摘"',
    'P-L-05|司机未报告异响|3|车外异响持续 2 分钟才报|"刚开始以为是小石子"',
    'P-L-06|司机误报车次|2|报成邻线车次，调度排错进路|"我是 1176，不是 1178"',
    'P-L-07|司机未确认行车凭证|4|电话闭塞下没拿书面凭证就发车|"凭证还没递到司机手里"',
    'P-L-08|司机擅自退行|5|区间内未经许可退行|"他在往回倒车"',
    'P-L-09|司机超速通过限速区|4|限速 45，实际 78|"监控装置已经报警了"',
    'P-L-10|司机与调度通话不清|2|关键指令听错一个字|"你说的是 4 道还是 14 道？"',
    'P-L-11|司机未执行降弓指令|4|命令已下，弓还升着|"降弓命令收到没？怎么还带着弓"',
    'P-L-12|司机交接班未交清|3|接班司机不知道前方限速|"这车前方限速多少？上一班没跟我说"',
  ]],
  [P, 'C', [
    'P-C-01|乘务超劳|4|司机连续值乘接近限时，必须换班|"我这班已经 7 小时 40 分了"',
    'P-C-02|乘务交路接续失败|3|接班乘务堵在路上，列车无法发车|"接班的还在高速上"',
    'P-C-03|乘务换班点无人|4|换班点空岗，两组人都在别的车上|"换班点没人，我这车怎么办"',
    'P-C-04|乘务计划与运行图脱节|3|计划按旧图排，实绩已晚点 40 分钟|"计划上这趟该在 3 点换班，实际 3 点 40 才到"',
    'P-C-05|调车组人员不足|3|解体作业只剩两人|"两个人解 62 辆？"',
    'P-C-06|装卸劳力不足|3|货位空着，装卸工只到一半|"再等 20 分钟能来一队"',
  ]],
  [P, 'P', [
    'P-P-01|旅客吸烟触发紧急制动|3|车厢烟感联动，列车区间停车|"8 号车厢烟感报警，已经紧急制动了"',
    'P-P-02|旅客纠纷站停延长|2|车厢内冲突，乘警处置，站停超时 8 分钟|"车上吵起来了，得等乘警"',
    'P-P-03|旅客突发疾病临时停车|3|需要就近车站送医|"车上有旅客不行了，能不能前面停一下"',
    'P-P-04|超员报警车门无法关闭|3|春运超员 32%，车门关不上|"门关不上，一直报警"',
    'P-P-05|旅客扒车门|4|发车瞬间有人扒门，紧急制动|"有人扒着门，车已经动了"',
    'P-P-06|旅客坠站台|5|站台边缘人员坠落|"有人掉下去了！"',
    'P-P-07|错乘漏乘越站|2|团体旅客上错车，需前方站处置|"我们团 26 个人上错车了"',
    'P-P-08|重点旅客无人接|3|轮椅旅客到站无人接，站停延长|"轮椅旅客还没下来"',
    'P-P-09|行李掉落砸伤|3|行李架行李坠落|"有人被砸了"',
    'P-P-10|站台拥挤限流|3|春运站台人数超容量|"站台上已经站不下了"',
  ]],
  [P, 'O', [
    'P-O-01|路外人员侵入|5|有人翻越护栏进入线路|"线路上有人！"',
    'P-O-02|牲畜上道|4|附近牛群进入区间|"一群牛在轨道上"',
    'P-O-03|无人机侵限|5|无人机在站场上空飞行|"有无人机在咽喉上方"',
    'P-O-04|施工人员误入邻线|4|作业人员越过防护进入邻线|"人跑到邻线去了"',
    'P-O-05|闲杂人员在站台奔跑|3|站台人员越线|"站台上有人在跑"',
    'P-O-06|垂钓者靠近线路|4|线路旁有人垂钓|"河边有人甩竿，线甩到轨道上了"',
  ]],
  [E, 'T', [
    'E-T-26|受电弓上升位置异常|4|受电弓升弓不到位，接触压力不稳|"弓升起来位置不对，车顶有异响"',
    'E-T-27|VCB 无法闭合|4|主断路器合不上，牵引无输出|"VCB 合不上，全车没牵引"',
    'E-T-28|牵引变流器故障|4|变流器模块报故障，限功率运行|"变流器报红，只能跑一半功率"',
    'E-T-29|牵引电机通风机停止|3|通风机停转，电机温度上升|"风机不转了"',
    'E-T-30|主变压器温度过高|4|油温超过报警值|"主变油温 92 度了"',
    'E-T-31|BCU 故障|4|制动控制单元通信中断|"BCU 失联"',
    'E-T-32|紧急制动 UB 不缓解|4|紧急制动施加后无法缓解|"UB 缓解不了，车动不了"',
    'E-T-33|抱死误报/滑行故障|3|防空转系统误动作|"一直报抱死"',
    'E-T-34|轴温预警|4|轴温达到预警阈值|"2 位轴温预警"',
    'E-T-35|轴温报警立即停车|5|轴温报警需立即停车检查|"轴温报警，必须停"',
    'E-T-36|齿轮箱温度异常|4|齿轮箱温度超限|"齿轮箱温度上来了"',
    'E-T-37|轴不旋转|5|某轴不转，可能抱死|"有一根轴不转"',
    'E-T-38|ATP 故障转 LKJ|3|ATP 故障降级到 LKJ 模式|"ATP 挂了，转 LKJ"',
    'E-T-39|BTM 故障|4|应答器传输模块故障|"BTM 故障，收不到应答器"',
    'E-T-40|DMI 黑屏|4|司机显示单元黑屏|"屏幕黑了"',
    'E-T-41|CTCS 等级切换失败|4|等级切换点未成功切换|"切换点过了，等级没切上去"',
    'E-T-42|辅助变流器模块故障限 200|3|辅助变流器降级，限速 200|"辅助变流器故障，限 200 跑"',
    'E-T-43|空调失效开门限速|3|动车组空调失效需开门通风限速|"空调全停，车里 38 度"',
    'E-T-44|车窗玻璃破碎|3|运行中车窗破裂|"车窗碎了，风往里灌"',
    'E-T-45|车门卡住|3|车门无法关闭，超员报警|"5 号车门卡住"',
    'E-T-46|火灾报警|5|车厢烟感/温感报警|"火警！"',
    'E-T-47|自动降弓|4|车顶检测到异常自动降弓|"弓自己降了"',
    'E-T-48|MPU 离线|3|主处理单元离线|"MPU 掉线"',
    'E-T-49|RIOM 网关离线|3|远程 I/O 网关离线|"RIOM 网关掉了"',
    'E-T-50|两端司机室激活冲突|4|两端同时激活，方向冲突|"前后两个司机室都激活了"',
    'E-T-51|方向冲突|4|方向指令与列车实际方向不符|"方向反了"',
    'E-T-52|停放制动不缓解|4|停放制动无法缓解|"停放制动缓解不了"',
    'E-T-53|撒砂装置故障|2|撒砂失效，坡起困难|"砂撒不出来"',
    'E-T-54|受电弓绝缘子污闪|4|污闪导致跳闸|"车顶闪了一下，跳闸了"',
    'E-T-55|车外异响请求停车|4|司机报车外异响，请示停车|"外面有异响，我想停一下"',
    'E-T-56|制动管压力异常|4|列车管压力下降|"列车管压力掉了"',
    'E-T-57|总风压力不足|3|总风缸压力低于标准|"总风不够"',
    'E-T-58|空压机故障|3|空压机不工作|"空压机没起来"',
    'E-T-59|速度传感器故障|3|速度信号丢失|"速度显示为零，车在跑"',
    'E-T-60|烟火报警误报|2|烟感误报，需确认|"又是误报？"',
  ]],
  [E, 'G', [
    'E-G-56|断轨|5|探伤发现断轨，需立即封锁|"探伤车报了断轨"',
    'E-G-57|胀轨跑道|5|高温导致轨道胀轨|"轨道鼓起来了"',
    'E-G-58|工务红光带|4|工务作业区段出现红光带|"工务那边红光带"',
    'E-G-59|道床冲空|4|雨水冲空道床|"道床下面空了"',
    'E-G-60|边坡溜塌|4|边坡土体下滑|"边坡塌了，土压到轨枕上"',
    'E-G-61|路基下沉|4|路基不均匀下沉|"这一段明显下沉"',
    'E-G-62|尖轨不密贴|4|道岔尖轨与基本轨不密贴|"尖轨贴不上"',
    'E-G-63|表示杆卡阻|3|道岔表示杆卡住|"表示杆卡了"',
    'E-G-64|桥隧限界异物|4|桥梁下方有异物侵入限界|"桥下有东西"',
    'E-G-65|轨道板裂纹/沉降|3|轨道板出现裂纹|"板裂了"',
    'E-G-66|施工延点|3|天窗施工未按时结束|"施工还没完，天窗超了"',
    'E-G-67|路料侵限|4|施工路料堆到限界内|"料堆到线上了"',
    'E-G-68|钢轨磨耗超限|3|钢轨侧磨超限|"这段磨耗厉害"',
    'E-G-69|轨枕失效|3|轨枕断裂或失效|"轨枕断了"',
    'E-G-70|扣件松动|2|扣件大面积松动|"扣件松了一片"',
    'E-G-71|道岔爬行|3|道岔位置偏移|"道岔位置跑了"',
    'E-G-72|护轨损坏|3|桥上护轨损坏|"护轨断了"',
    'E-G-73|路基渗水|3|路基渗水|"路基在渗水"',
    'E-G-74|隧道衬砌掉块|5|隧道衬砌掉块|"隧道里掉石头"',
    'E-G-75|桥墩位移|5|桥墩监测报警|"桥墩位移报警"',
    'E-G-76|路基冻胀|4|低温路基冻胀|"路基鼓起来了"',
    'E-G-77|轨道几何尺寸超限|3|轨距水平超限|"轨检车报了超限"',
    'E-G-78|道岔融雪装置故障|3|融雪装置不工作|"雪化了又冻上"',
    'E-G-79|线路沉陷监测报警|4|监测点沉陷|"监测点在报警"',
    'E-G-80|桥面漏水|2|桥面排水堵塞|"桥面在漏水"',
  ]],
  [E, 'X', [
    'E-X-68|电务红光带|4|轨道电路出现红光带|"电务红光带，2 道"',
    'E-X-69|接车进路道岔失表|4|接车进路道岔失去表示|"接车进路道岔没表示"',
    'E-X-70|发车进路道岔失表|4|发车进路道岔失去表示|"发车进路道岔失表"',
    'E-X-71|进站信号不能开放|4|进站信号无法开放|"进站信号开不了"',
    'E-X-72|出站信号不能开放|4|出站信号无法开放|"出站信号开不了"',
    'E-X-73|进路信号故障|4|进路信号机故障|"进路信号故障"',
    'E-X-74|计轴故障|4|计轴设备故障|"计轴故障，区段占用不确定"',
    'E-X-75|相邻区段紫光带|3|相邻区段显示紫光带|"旁边区段紫光带"',
    'E-X-76|CTC 典型故障|4|CTC 终端与车站失联|"CTC 掉线了"',
    'E-X-77|全站信联闭停电|5|全站信号联锁闭塞停电|"全站没电了"',
    'E-X-78|列车占用丢失|5|CTC 丢失列车占用位置|"车不见了"',
    'E-X-79|应答器丢失/报文错误|4|应答器报文错误|"应答器报文不对"',
    'E-X-80|RBC 故障|4|无线闭塞中心故障|"RBC 故障"',
    'E-X-81|联锁重启|4|联锁系统重启|"联锁重启了"',
    'E-X-82|信号机灯泡断丝|3|信号机主灯丝断|"信号机不亮了"',
    'E-X-83|转辙机进水|3|转辙机进水|"转辙机进水了"',
    'E-X-84|电缆故障|4|信号电缆故障|"电缆断了一根"',
    'E-X-85|防灾系统误报|2|防灾系统误报|"防灾又误报"',
    'E-X-86|道岔转换不到位|4|道岔转不到底|"道岔转不到位"',
    'E-X-87|信号机显示异常|4|信号显示与联锁不一致|"信号显示跟联锁对不上"',
    'E-X-88|轨道电路分路不良|4|分路不良导致占用不显示|"车压上去了，区段还是空的"',
    'E-X-89|计轴受扰|3|计轴受电磁干扰|"计轴又跳了"',
    'E-X-90|列控中心重启|4|列控中心重启|"TCC 重启"',
    'E-X-91|无线通信单元故障|4|车载无线单元故障|"无线单元故障"',
    'E-X-92|应答器天线损坏|4|车载应答器天线损坏|"天线坏了，收不到点"',
    'E-X-93|信号电源切换|3|信号电源切换|"电源切了，灯闪了一下"',
    'E-X-94|联锁机切换|4|联锁主机切换|"联锁切机"',
    'E-X-95|防雷器损坏|3|防雷模块损坏|"防雷器炸了"',
    'E-X-96|调度终端失联|4|调度终端与服务器失联|"我这边黑屏了"',
    'E-X-97|时钟同步故障|2|CTC 时钟不同步|"时间不对"',
    'E-X-98|报警音响故障|2|报警声音不响|"报警没声"',
  ]],
  [E, 'W', [
    'E-W-86|跳闸重合成功|3|接触网跳闸重合成功|"跳闸又重合了"',
    'E-W-87|跳闸重合失败|5|跳闸重合失败，区间失电|"重合失败，那边没电了"',
    'E-W-88|接触线断线|5|接触线断线|"接触线断了"',
    'E-W-89|承力索断线|5|承力索断线|"承力索掉下来了"',
    'E-W-90|AF 线故障|4|AF 线故障|"AF 线故障"',
    'E-W-91|隔离开关故障|4|隔离开关无法操作|"隔离开关推不上"',
    'E-W-92|异物挂网铁皮|4|铁皮挂在接触网上|"网上挂了一块铁皮"',
    'E-W-93|彩钢瓦|4|彩钢瓦吹上接触网|"彩钢瓦挂网了"',
    'E-W-94|树木|4|树木倒伏压网|"树倒在网上了"',
    'E-W-95|风筝/气球|3|风筝挂网|"网上挂了个风筝"',
    'E-W-96|覆冰/冰瘤|4|接触网覆冰|"网上结冰了"',
    'E-W-97|弓网故障|4|弓网拉弧|"弓网打火了"',
    'E-W-98|分区所故障|4|分区所故障|"分区所故障"',
    'E-W-99|AT 所故障|4|AT 所故障|"AT 所故障"',
    'E-W-100|牵引变电所跳闸|5|牵引变电所跳闸|"变电所跳了"',
    'E-W-101|越区供电|3|越区供电|"越区供电了"',
    'E-W-102|馈线过电流|4|馈线过流|"馈线过流"',
    'E-W-103|电压低于 19kV|3|网压低于 19kV|"网压只有 18 点几"',
    'E-W-104|绝缘子击穿|4|绝缘子击穿|"绝缘子炸了"',
    'E-W-105|接地故障|4|接地故障|"接地了"',
    'E-W-106|网压波动|3|网压剧烈波动|"网压在跳"',
    'E-W-107|馈线保护动作|4|馈线保护动作跳闸|"保护动作了"',
    'E-W-108|接触网偏移|4|接触网横向偏移超限|"网偏了"',
    'E-W-109|吊弦脱落|4|吊弦脱落|"吊弦掉了"',
    'E-W-110|分段绝缘器故障|4|分段绝缘器故障|"分段绝缘器打火"',
  ]],
  [E, 'C', [
    'E-C-106|通信中断|5|区间通信中断|"车站联系不上了"',
    'E-C-107|GSM-R 故障|4|GSM-R 网络故障|"GSM-R 挂了"',
    'E-C-108|RBC 通信超时|4|RBC 通信超时|"RBC 超时"',
    'E-C-109|列控地面设备故障|4|列控地面设备故障|"地面设备故障"',
    'E-C-110|临时限速未下达|4|临时限速未成功下达|"限速没到车上"',
    'E-C-111|LKJ 基础数据错误|4|LKJ 数据错误|"LKJ 数据不对"',
    'E-C-112|运行揭示未写 IC 卡|3|运行揭示未写卡|"揭示没写进卡"',
    'E-C-113|通话质量差|3|电台噪音大，听不清|"电台全是噪音"',
    'E-C-114|无线盲区|4|区间无线盲区|"这段没信号"',
    'E-C-115|调度电话故障|4|调度电话故障|"调度台电话不通"',
    'E-C-116|车站电台故障|4|车站电台故障|"车站电台坏了"',
    'E-C-117|应急通信通道未建立|4|应急通道没接通|"应急通道还没连上"',
    'E-C-118|列车无线设备故障|4|车载电台故障|"车载台故障"',
    'E-C-119|通信电源故障|3|通信电源故障|"通信电源掉了"',
    'E-C-120|光缆中断|5|通信光缆中断|"光缆断了"',
    'E-C-121|时钟偏差|2|各终端时间不一致|"三个屏时间都不一样"',
  ]],
  [N, 'V', [
    'N-V-113|暴雨雨量计报警|4|雨量计报警|"雨量计报警了"',
    'N-V-114|雨量超 45mm/h|4|雨量超 45 毫米每小时|"45 以上了"',
    'N-V-115|雨量超 60mm/h|5|雨量超 60 毫米每小时|"60 了，必须限 45"',
    'N-V-116|暴雪道岔积雪|4|道岔积雪|"道岔里全是雪"',
    'N-V-117|冻雨接触网覆冰|4|冻雨覆冰|"网上结了一层冰"',
    'N-V-118|大风|4|大风超限|"风太大了"',
    'N-V-119|大雾|3|能见度低|"看不见信号"',
    'N-V-120|雷暴|4|雷暴天气|"打雷了"',
    'N-V-121|冰雹|4|冰雹|"下冰雹了，车顶在响"',
    'N-V-122|台风封锁|5|台风预警需封锁|"台风要来了"',
    'N-V-123|低温制动故障|4|低温导致制动故障|"零下 22 度，闸不缓解"',
    'N-V-124|高温钢轨超限|4|轨温超限|"轨温 62 度"',
    'N-V-125|洪水路基冲毁|5|洪水冲毁路基|"路基冲没了"',
    'N-V-126|塌方|5|塌方|"前面塌方了"',
    'N-V-127|泥石流|5|泥石流|"泥石流下来了"',
    'N-V-128|落石|5|落石|"有石头落在轨面上"',
    'N-V-129|岩溶塌陷|5|岩溶塌陷|"地面塌了一个洞"',
    'N-V-130|地震预警|5|地震预警|"地震预警，全线停"',
    'N-V-131|地面沉降|4|地面沉降|"这一段在沉"',
    'N-V-132|飞鸟撞击|3|飞鸟撞击车头|"撞上鸟了"',
    'N-V-133|鸟巢短路|4|鸟巢导致短路|"鸟巢把网短了"',
    'N-V-134|野生动物侵入|4|野生动物进入线路|"野猪在线上"',
    'N-V-135|异物侵限报警|5|异物侵限监测报警|"侵限报警，区间有东西"',
    'N-V-136|防尘网吹上线路|4|防尘网吹上线路|"防尘网盖到线上了"',
    'N-V-137|树木倒伏压网|4|树木倒伏|"树倒了"',
    'N-V-138|广告布挂网|3|广告布挂网|"广告布挂网了"',
    'N-V-139|洪水漂浮物|4|漂浮物冲到线路|"水上漂来东西"',
    'N-V-140|隧道内异物|4|隧道内出现异物|"隧道里有东西"',
    'N-V-141|大雾能见度不足 50 米|4|能见度不足 50 米|"看不见 200 米外的信号"',
    'N-V-142|积雪压网|4|积雪压覆接触网|"雪把网压低了"',
    'N-V-143|霜冻道岔|3|霜冻导致道岔卡阻|"道岔冻住了"',
    'N-V-144|高温限速|3|高温需限速|"轨温高，按暑运限速"',
    'N-V-145|强侧风|4|强侧风|"侧风太大，高层车不稳"',
    'N-V-146|沙尘|3|沙尘影响能见度|"沙尘把信号都糊了"',
    'N-V-147|雷电击中设备|5|雷击设备|"雷打到设备上了"',
    'N-V-148|冰凌掉落|4|冰凌掉落|"冰凌砸到车顶"',
    'N-V-149|积水淹轨|5|积水高于轨面|"水已经漫过轨面"',
    'N-V-150|山体滑坡|5|山体滑坡|"山滑了"',
    'N-V-151|夜间照明不足|2|夜间照明故障|"站台灯全灭了"',
    'N-V-152|雾霾|3|雾霾能见度低|"霾太重"',
  ]],
  [M, 'A', [
    'M-A-141|天窗修超时|4|天窗修超时 18 分钟|"天窗还没销"',
    'M-A-142|施工延点|4|施工延点|"施工延了"',
    'M-A-143|临客加开|3|临时加开临客|"又加一趟临客"',
    'M-A-144|春运能力饱和|4|春运能力饱和|"今天图定加临客 22 对"',
    'M-A-145|暑运高温限速|3|暑运高温限速|"暑运限速生效了"',
    'M-A-146|热备不足|4|热备资源不足|"热备全派出去了"',
    'M-A-147|乘务交路紧张|3|乘务交路紧张|"乘务交路排满了"',
    'M-A-148|车站作业瓶颈|4|车站作业瓶颈|"车站整备不过来"',
    'M-A-149|分界口交接不畅|4|分界口交接不畅|"邻局不接"',
    'M-A-150|邻局晚点传入|3|邻局晚点传入|"邻局那边大面积晚点"',
    'M-A-151|军运/专运重点列车|4|军运专运重点列车|"重点列车，不能晚"',
    'M-A-152|路用列车冲突|3|路用列车冲突|"路用车跟图定车顶上了"',
    'M-A-153|救援列车出动延迟|4|救援列车出动延迟|"救援车还没出库"',
    'M-A-154|抢修资源不足|4|抢修资源不足|"抢修队只有一队"',
    'M-A-155|应急预案启动滞后|4|应急预案启动滞后|"预案还没启动"',
    'M-A-156|客流高峰站台拥挤|3|站台拥挤|"站台挤满了"',
    'M-A-157|超限货物审批延迟|3|超限审批延迟|"审批还没下来"',
    'M-A-158|机车交路断裂|4|机车交路断裂|"机车接不上"',
    'M-A-159|车底接续计划错误|4|车底接续计划错误|"车底排错了"',
    'M-A-160|预算超支|2|预算超支|"这个月救援成本超了"',
    'M-A-161|临客与图定抢股道|4|临客与图定抢股道|"临客把股道占了"',
    'M-A-162|加挂计划未落实|3|加挂计划未落实|"加挂车厢没挂上"',
    'M-A-163|军运保密要求|3|军运保密|"这趟车不显示车次"',
    'M-A-164|交接班时段人手不足|3|交接班人手不足|"交接班就俩人"',
    'M-A-165|规章临时修订|2|规章临时修订|"新文件刚下来"',
    'M-A-166|邻台协同失误|4|邻台协同失误|"邻台把车放过来了"',
    'M-A-167|重复下发命令|3|重复下发命令|"这条命令发了两遍"',
    'M-A-168|开天窗与临客冲突|4|开天窗与临客冲突|"天窗和临客撞了"',
    'M-A-169|施工配合单位未到场|4|施工配合单位未到场|"电务没来"',
    'M-A-170|限速命令过期未撤|3|限速命令过期未撤|"限速还在，实际已经修好了"',
  ]],
  [E, 'D', [
    'DDS-01|入所检修超时|4|动车组入所检修超时|"这组车二级修超了 3 小时"',
    'DDS-02|洗车线故障|3|洗车线设备故障|"洗车线坏了"',
    'DDS-03|临修线满|4|临修线满|"临修线满了"',
    'DDS-04|融冰除雪线排队|4|融冰除雪线排队|"融冰线排到 4 组"',
    'DDS-05|存车线不足|4|存车线不足|"存车线放不下了"',
    'DDS-06|检修窗口与运行图冲突|4|检修窗口与运行图冲突|"检修窗口和始发撞了"',
    'DDS-07|出所晚点连锁|4|出所晚点连锁|"出所晚了 40 分钟"',
    'DDS-08|所内调车冲突|4|所内调车冲突|"所内两台车顶上了"',
    'DDS-09|地勤司机不足|3|地勤司机不足|"地勤就一个人"',
    'DDS-10|动车所至车站咽喉能力不足|4|动车所至车站咽喉能力不足|"出所进不去站"',
    'DDS-11|受电弓检测不合格|4|受电弓检测不合格|"弓检不合格"',
    'DDS-12|轮对镟修排队|4|轮对镟修排队|"镟轮排到明天"',
    'DDS-13|车载设备检修失败|4|车载设备检修失败|"车载设备修不好"',
    'DDS-14|蓄电池亏电|3|蓄电池亏电|"蓄电池亏电"',
    'DDS-15|动车所火灾报警|5|动车所火灾报警|"所里火警"',
    'DDS-16|检修线被热备占用|3|检修线被热备占用|"热备占了检修线"',
    'DDS-17|所内试验失败|4|出所试验失败|"试验没过"',
    'DDS-18|检修等料|3|检修等料|"等配件"',
  ]],
  [E, 'K', [
    'KCS-01|卧具更换超时|3|卧具更换超时|"卧具还没换完"',
    'KCS-02|上水设备故障|3|上水设备故障|"上水栓坏了"',
    'KCS-03|吸污设备故障|3|吸污设备故障|"吸污车坏了"',
    'KCS-04|餐车补给延迟|3|餐车补给延迟|"餐料没到"',
    'KCS-05|发电车补油延迟|4|发电车补油延迟|"发电车没油了"',
    'KCS-06|列检作业超时|3|列检作业超时|"列检超时"',
    'KCS-07|保洁不到位|2|保洁不到位|"卫生没做"',
    'KCS-08|整备线爆仓|4|整备线爆仓|"整备线满了"',
    'KCS-09|车底周转不足|4|车底周转不足|"车底倒不开"',
    'KCS-10|消毒作业延迟|3|消毒作业延迟|"消毒没过"',
  ]],
  [E, 'J', [
    'JWS-01|机车换挂延迟|4|机车换挂延迟|"换挂晚了 12 分钟"',
    'JWS-02|机车整备故障|4|机车整备故障|"整备台故障"',
    'JWS-03|机车交路断裂|4|机车交路断裂|"机车接不上"',
    'JWS-04|乘务换班超时|3|乘务换班超时|"换班晚了"',
    'JWS-05|机走线堵塞|4|机走线堵塞|"机走线堵了"',
    'JWS-06|加油加砂不足|3|加油加砂不足|"油不够"',
    'JWS-07|机车检修线满|4|机车检修线满|"检修线满了"',
    'JWS-08|出段晚点|4|出段晚点|"出段晚了"',
  ]],
  [E, 'L', [
    'CLS-01|站修线满|4|站修线满|"站修线满了"',
    'CLS-02|货车临修超时|4|货车临修超时|"临修超时"',
    'CLS-03|危险品车检修隔离|4|危险品车检修隔离|"危险品车要隔离"',
    'CLS-04|超限车检修|4|超限车检修|"超限车进不了修"',
    'CLS-05|洗罐不足|3|洗罐不足|"洗罐排不上"',
    'CLS-06|定检集中|3|定检集中|"定检全赶一起"',
    'CLS-07|轮对检修排队|3|轮对检修排队|"轮对排队"',
  ]],
  [M, 'G', [
    'GD-01|开放股道过多导致咽喉交叉|4|股道开太多，咽喉进路交叉|"咽喉顶上了"',
    'GD-02|开放股道不足导致站外停车|4|股道开太少，站外停车|"站外排了三列"',
    'GD-03|预留股道被误用|4|预留股道被占用|"那是我留给救援的"',
    'GD-04|借道货物线接客车|4|借货物线接客车|"客车从货物线下来"',
    'GD-05|股道有效长不匹配|4|股道有效长不够，需分解|"这车 62 辆，股道放不下"',
    'GD-06|高站台接低开门车|3|高站台接低开门车|"门打不开，旅客下不来"',
    'GD-07|安全线使用后作业中断|3|安全线使用后作业中断|"安全线用了"',
    'GD-08|站修线满致故障车占正线|4|故障车占正线|"故障车停在正线上了"',
  ]],
  [M, 'P', [
    'MP-01|售票策略失误|3|区段限售设置失误，长途票卖空|"短途把长途票挤没了"',
    'MP-02|候补未及时兑现|2|候补兑现延迟|"候补一直没兑现"',
    'MP-03|超员控制失当|4|超员超 36%|"车上站不下了"',
    'MP-04|重点旅客服务缺位|3|重点旅客无人接|"轮椅旅客没人管"',
    'MP-05|退改签拥堵|2|退改签窗口排长队|"窗口排到门外了"',
    'MP-06|站台换乘引导错误|3|换乘指引错误|"旅客走错站台"',
  ]],
  [M, 'F', [
    'MF-01|装车超偏载|4|装车超偏载|"这车偏了"',
    'MF-02|排空不及时|3|空车排空不及时|"空车没排过来"',
    'MF-03|货位不足|3|货位不足|"货位满了"',
    'MF-04|装卸劳力不足|3|装卸劳力不足|"装卸工不够"',
    'MF-05|危险品隔离违规|5|危险品隔离违规|"这两车不能挨着"',
    'MF-06|超限会车条件不满足|5|超限会车条件不满足|"这俩车不能交会"',
    'MF-07|冷链温度断链|4|冷链温度断链|"冷柜温度上来了"',
    'MF-08|鲜活时效超限|3|鲜活时效超限|"鲜活要坏了"',
    'MF-09|集装箱班列衔接失败|3|集装箱班列衔接失败|"船期对不上"',
    'MF-10|中欧班列换装延误|4|中欧班列换装延误|"宽轨换装慢了"',
    'MF-11|专用线取送延迟|3|专用线取送延迟|"专用线车没取回来"',
    'MF-12|驼峰溜放冲突|4|驼峰溜放冲突|"溜放顶上去了"',
    'MF-13|调车通知单错误|4|调车通知单错误|"单子写错了"',
    'MF-14|铁鞋防溜失效|5|铁鞋防溜失效|"车自己溜了"',
    'MF-15|脱轨器未设|5|脱轨器未设|"脱轨器没放"',
    'MF-16|货车集结不足|3|货车集结不足|"编不满"',
  ]],
  [M, 'R', [
    'MR-01|舆情发酵|3|晚点引发舆情|"微博上已经有人发了"',
    'MR-02|旅客投诉集中|2|投诉集中爆发|"投诉电话打爆了"',
    'MR-03|赔偿成本超预算|2|赔偿超预算|"赔偿超了"',
    'MR-04|媒体到场|3|媒体到站采访|"记者来了"',
    'MR-05|货主索赔|3|货主索赔|"货主说货坏了"',
    'MR-06|大面积滞留|4|大面积滞留|"候车厅全是人"',
  ]],
  [M, 'S', [
    'MS-01|拨接施工过渡|4|拨接施工过渡|"拨接还没完"',
    'MS-02|防洪三检未完成|4|防洪三检未完成|"三检没做完"',
    'MS-03|消防通道占用|3|消防通道占用|"消防通道被占了"',
    'MS-04|应急预案未演练|3|应急预案未演练|"预案没演练过"',
    'MS-05|事故调查取证|4|事故调查取证|"调查组要调录音"',
    'MS-06|新线开通调试|3|新线开通调试|"新线还在调试"',
  ]],
  [M, 'X', [
    'MX-01|AI 助调误判|3|AI 助调给出错误建议|"助调建议排这条交叉进路"',
    'MX-02|多台指令冲突|4|多台同时下指令冲突|"客调和列调各发一条"',
    'MX-03|邻局异步对抗|4|邻局优先保自家车|"邻局不放车"',
    'MX-04|电台通讯质量差|3|电台噪音干扰指挥|"听不清，全是杂音"',
    'MX-05|专运密语误读|5|专运密语误读|"密语对不上"',
    'MX-06|军运保密泄露|5|军运信息泄露|"车次不该显示"',
  ]],
]);

const POSITIONS = ['区间', '站内', '咽喉', '分相', '道岔', '站台'];
const STAGES = ['始发', '运行', '终到', '传播'];
const PROPAGATIONS = {
  P: [{ t: 'interval', d: -8, n: '区间能力' }, { t: 'platform', d: -4, n: '到发线占用' }, { t: 'crew', d: -6, n: '乘务余量' }],
  E: [{ t: 'interval', d: -18, n: '区间能力' }, { t: 'stock', d: -8, n: '车底接续' }, { t: 'platform', d: -6, n: '到发线占用' }],
  N: [{ t: 'interval', d: -22, n: '区间能力' }, { t: 'platform', d: -10, n: '到发线占用' }, { t: 'emotion', d: -3, n: '旅客情绪' }],
  M: [{ t: 'platform', d: -12, n: '到发线占用' }, { t: 'stock', d: -10, n: '车底接续' }, { t: 'crew', d: -8, n: '乘务余量' }],
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

function pick(arr, seed, count, offset = 0) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(arr[(seed + offset + i * 7) % arr.length]);
  return out;
}

function branchesFor(root) {
  const pool = FAMILY_BRANCHES[root.family];
  const seed = hash(root.code);
  const chosen = pick(pool, seed, 4);
  return chosen.map((b, i) => ({ ...b, id: `${root.code}-${b.id}-${i}` }));
}

function textFor(root, pos, stage) {
  const base = root.desc || root.title;
  const seat = stage === '始发' ? '始发端' : stage === '终到' ? '终到端' : stage === '传播' ? '下游传播环节' : '运行中';
  return `【${pos}·${seat}】${base}。当前位置：${pos}，阶段：${stage}。按处置分支推进，注意安全底线与传播。`;
}

function radioFor(root, pos) {
  if (root.radio) return root.radio;
  return `"调度，${pos}这边${root.title}，请示怎么处理。"`;
}

function buildEvents() {
  const events = [];
  for (const root of ROOTS) {
    const seed = hash(root.code);
    const pos = POSITIONS[seed % POSITIONS.length];
    const stage = STAGES[(seed >> 3) % STAGES.length];
    events.push({
      id: root.code,
      code: root.code,
      family: root.family,
      sub: root.sub,
      title: root.title,
      severity: root.sev,
      stage: [stage],
      positions: [pos],
      desc: textFor(root, pos, stage),
      radio: radioFor(root, pos),
      branches: branchesFor(root),
      propagate: PROPAGATIONS[root.family],
      tags: [root.familyName, root.sub],
      weight: root.sev,
    });
    const extraCount = 1 + (seed % 2);
    for (let i = 0; i < extraCount; i += 1) {
      const p2 = POSITIONS[(seed + 11 + i * 3) % POSITIONS.length];
      const s2 = STAGES[(seed + 5 + i) % STAGES.length];
      if (p2 === pos && s2 === stage) continue;
      events.push({
        id: `${root.code}-${i + 1}`,
        code: root.code,
        family: root.family,
        sub: root.sub,
        title: `${root.title}（${p2}）`,
        severity: Math.max(1, root.sev - (i % 2)),
        stage: [s2],
        positions: [p2],
        desc: textFor(root, p2, s2),
        radio: radioFor(root, p2),
        branches: branchesFor(root),
        propagate: PROPAGATIONS[root.family],
        tags: [root.familyName, root.sub],
        weight: root.sev,
      });
    }
  }
  return events;
}

const EVENTS = buildEvents();

const GLOSSARY = [
  { id: 'ctc', term: 'CTC 调度集中', en: 'Centralized Traffic Control', plain: '调度所一套能直接看站场、排进路、控信号的系统。', impact: '你看到的主屏幕就是它；它掉线你就只能靠电话。', myth: '不是"列车自动开"，司机仍在开车，CTC 管的是信号和进路。' },
  { id: 'panel', term: '站场图', en: 'Track Diagram', plain: '把车站股道、道岔、信号机画在一张图上的调度视图。', impact: '3 秒内要能看出哪条线红了、哪列车没进站。', myth: '不是示意图，它和现场联锁基本同源。' },
  { id: 'route', term: '进路', en: 'Route', plain: '列车从 A 到 B 要走的那条被锁定的路线，道岔和信号一起锁好。', impact: '排进路就是提前把路线占住；排错会顶到别的车。', myth: '进路不是"想走哪就走哪"，锁闭后要取消有代价。' },
  { id: 'block', term: '闭塞', en: 'Block System', plain: '保证两列车之间隔一段安全距离的规则。', impact: '闭塞降级，区间通过能力断崖式下降。', myth: '闭塞不是"信号灯"，是一整套间隔规则。' },
  { id: 'phoneblock', term: '电话闭塞', en: 'Telephone Block', plain: '设备坏了以后用电话+书面凭证办闭塞的降级办法。', impact: '能力掉到 30%，而且每列车都要凭证。', myth: '不是随便打个电话就行，凭证和号码都要对。' },
  { id: 'local', term: '非常站控', en: 'Local Control', plain: '调度中心失去对车站的直接控制，车站值班员接管。', impact: '你只能打电话指挥，慢且容易听错。', myth: '不是"车站造反"，是故障下的规定切换。' },
  { id: 'signal', term: '信号机', en: 'Signal', plain: '给司机看的灯，红黄绿代表能不能走。', impact: '信号开不了，列车就只能在站外等。', myth: '不是"装饰灯"，闯红灯就是险性事件。' },
  { id: 'switch', term: '道岔', en: 'Turnout', plain: '把轨道掰到另一条线上的装置。', impact: '道岔失表，进路就排不通。', myth: '不是"扳一下就行"，要确认位置表示。' },
  { id: 'redband', term: '红光带', en: 'Red Band', plain: '轨道区段显示红色，表示系统认为这里有车或电路故障。', impact: '你要判断是真车还是故障，决定引导接车还是等电务。', myth: '红光带不等于一定有车，也不等于一定没车。' },
  { id: 'switchlost', term: '道岔失去表示', en: 'Switch Loss of Indication', plain: '道岔转不到位或信号收不到位置确认。', impact: '进站信号可能开不了，列车要在站外停。', myth: '不是"道岔坏了就能硬闯"。' },
  { id: 'approach', term: '接近区段', en: 'Approach Section', plain: '列车进入车站前的一段，进了这段再改进路就很危险。', impact: '列车已接近时，要先呼叫停车才能取消进路。', myth: '不是"想取消就取消"。' },
  { id: 'guide', term: '引导接车', en: 'Guide Entry', plain: '信号故障时用手信号/引导信号把车接进站。', impact: '能接车，但速度低、要派人。', myth: '不是"随便挥挥手"。' },
  { id: 'order', term: '调度命令', en: 'Dispatch Order', plain: '调度正式下给司机/车站的书面或口头指令，有编号。', impact: '封锁、限速、反方向、救援都必须有命令；错发漏发扣分。', myth: '不是"点一下按钮"，要复诵、要记录。' },
  { id: 'heat', term: '热备', en: 'Hot Standby', plain: '备用的动车组/机车/车底，故障时顶上去。', impact: '一张底牌，用早了后面没得用。', myth: '不是"无限备用车"。' },
  { id: 'track', term: '到发线', en: 'Arrival-Departure Track', plain: '车站里接发列车用的股道。', impact: '满了列车只能在站外停，晚点开始传播。', myth: '不是"停车场"，有有效长限制。' },
  { id: 'throat', term: '咽喉', en: 'Throat Area', plain: '车站两端道岔密集区，进路会在这里交叉。', impact: '咽喉堵了，整个站就瘫了。', myth: '不是"越宽越好"，交叉进路会互相顶。' },
  { id: 'length', term: '有效长', en: 'Effective Length', plain: '一股道能停下多少辆车。', impact: '长编组放不进短股道，只能分解或改线。', myth: '不是"看着挺长就能放"。' },
  { id: 'gantry', term: '超偏载', en: 'Overload / Off-center Load', plain: '货车装得超重或偏一边。', impact: '必须倒装或甩车，否则不能上路。', myth: '不是"少装一点就没事"，偏载一样危险。' },
  { id: 'oos', term: '超限货物', en: 'Out-of-Gauge Cargo', plain: '货物太宽太高，会车、过隧道、侧线通过都有限制。', impact: '要审批、要限速、要禁交会。', myth: '不是"慢点开就行"。' },
  { id: 'hazmat', term: '危险品隔离', en: 'Hazmat Segregation', plain: '不同危险品不能随便放同一股道、同一列车、不能交会。', impact: '隔离错了，事故链直接升级。', myth: '不是"都装上车就完事"。' },
  { id: 'crew', term: '乘务超劳', en: 'Crew Overwork', plain: '司机/乘务员连续工作时间超限。', impact: '必须换班，否则触发安全卡控。', myth: '不是"撑一撑就到"。' },
  { id: 'stock', term: '车底接续', en: 'Rolling Stock Connection', plain: '上一趟车的车底折返跑下一趟。', impact: '晚到就传染下一趟，传播链的核心。', myth: '不是"车到了就能立刻走"，要整备。' },
  { id: 'skylight', term: '天窗', en: 'Maintenance Window', plain: '留给施工维修的时间窗口。', impact: '压缩天窗能多跑车，但设备更容易坏。', myth: '不是"没车的时候随便修"。' },
  { id: 'section', term: '区间', en: 'Section', plain: '两个车站之间的一段线路。', impact: '区间能力决定整条线能跑多少车。', myth: '不是"两站之间的空地"。' },
  { id: 'meet', term: '会让 / 待避', en: 'Meet / Wait', plain: '两列车在单线上互相让行；慢车在站里等快车先过。', impact: '单线调度最核心的操作。', myth: '不是"谁先到谁先走"。' },
  { id: 'hump', term: '驼峰', en: 'Hump', plain: '编组站里把车厢推上小坡再溜下去，靠重力分到不同股道。', impact: '溜放冲突会让整个编组场停摆。', myth: '不是"随便推下去"。' },
  { id: 'cips', term: 'CIPS / SAM', en: 'Yard Automation', plain: '编组站自动化系统，管驼峰和调车计划。', impact: '自动化挂了要人工接管，效率掉一半。', myth: '不是"全自动无人"。' },
  { id: 'hazmatchain', term: '危险品事故链', en: 'Hazmat Chain', plain: '泄漏→火灾→爆炸→污染→疏散→封锁→救援。', impact: '处理错一步，整条线要停一天。', myth: '不是"喷点水就行"。' },
  { id: 'gauge', term: '限界', en: 'Gauge', plain: '机车车辆限界、建筑限界、桥隧限界三层限制。', impact: '超限车过不了隧道就得改线。', myth: '不是"看着能过就行"。' },
  { id: 'emotion', term: '旅客情绪值', en: 'Passenger Sentiment', plain: '晚点、拥挤、服务不到位累积的旅客不满。', impact: '太高会触发舆情事件和投诉潮。', myth: '不是"忍忍就过去了"。' },
  { id: 'budget', term: '预算', en: 'Budget', plain: '临客、热备、救援、赔偿都要花钱。', impact: '花超了会影响评级和后续资源。', myth: '不是"安全就无限花钱"。' },
  { id: 'entropy', term: '晚点传播', en: 'Delay Propagation', plain: '一列车的晚点通过车底、乘务、股道、区间传到别的车。', impact: '切断传播链比抢救一列车更重要。', myth: '不是"晚点会自己消失"。' },
  { id: 'dd', term: '动车所', en: 'EMU Depot', plain: '动车组检修、洗车、存车的地方。', impact: '出所晚了，始发就晚。', myth: '不是"车库"那么简单，检修窗口和运行图绑定。' },
  { id: 'kc', term: '客整所', en: 'Passenger Car Depot', plain: '普速客车整备的地方：卧具、上水、吸污、餐料。', impact: '整备线爆仓，车底就周转不开。', myth: '不是"洗个车就走"。' },
  { id: 'jw', term: '机务折返段', en: 'Loco Depot', plain: '机车整备、换挂、乘务换班的地方。', impact: '机走线堵了，换挂就晚，交路断裂。', myth: '不是"司机休息室"。' },
  { id: 'cls', term: '站修所', en: 'Wagon Repair', plain: '货车临修、洗罐、消毒的地方。', impact: '站修线满了，故障车只能占正线。', myth: '不是"随便找个空地修"。' },
  { id: 'port', term: '口岸换装', en: 'Border Transshipment', plain: '宽轨准轨换装、边检海关。', impact: '换装慢了，中欧班列整列晚点。', myth: '不是"换个轮子就行"。' },
  { id: 'ai', term: 'AI 助调', en: 'AI Assistant', plain: '给你推荐处置的系统，但不保证对。', impact: '照单全收会踩坑，要复核。', myth: '不是"权威答案"。' },
  { id: 'duty', term: '交接班', en: 'Shift Handover', plain: '一班结束把风险、重点车、热备、施工交给下一班。', impact: '交接单漏填，下一班就会踩你踩过的坑。', myth: '不是"签个字就完"。' },
  { id: 'special', term: '专运 / 军运', en: 'Special / Military', plain: '重点列车，优先级最高，信息可能保密。', impact: '晚点权重大，且只能用密语沟通。', myth: '不是"普通车加个标记"。' },
];

const NETWORK = {
  lines: [
    {
      id: 'qinglan',
      name: '宝成线',
      kind: '单线',
      block: '半自动闭塞',
      length: 200,
      stations: ['qinglan', 'baishu', 'heyuan', 'lingkou'],
      speed: 80,
    },
    {
      id: 'jiangwan',
      name: '京广高铁',
      kind: '双线',
      block: '自动闭塞',
      length: 210,
      stations: ['jiangwan', 'xintang', 'nanpu', 'haigang'],
      speed: 300,
    },
    {
      id: 'linhe',
      name: '襄阳北编组站',
      kind: '编组站',
      block: '自动闭塞',
      length: 8,
      stations: ['linhe'],
      speed: 40,
    },
  ],
  stations: {
    qinglan: { name: '宝鸡', type: '一等站', tracks: 8, platforms: 3, throat: 4, unmanned: false, km: 0 },
    baishu: { name: '秦岭', type: '中间站', tracks: 3, platforms: 1, throat: 2, unmanned: true, km: 45 },
    heyuan: { name: '凤县', type: '中间站', tracks: 3, platforms: 1, throat: 2, unmanned: false, km: 108 },
    lingkou: { name: '略阳', type: '区段站', tracks: 4, platforms: 2, throat: 3, unmanned: false, km: 200 },
    jiangwan: { name: '许昌东', type: '高速场', tracks: 6, platforms: 3, throat: 4, unmanned: false, km: 0 },
    xintang: { name: '漯河西', type: '高速场', tracks: 4, platforms: 2, throat: 3, unmanned: false, km: 55 },
    nanpu: { name: '驻马店西', type: '高速场', tracks: 4, platforms: 2, throat: 3, unmanned: false, km: 120 },
    haigang: { name: '信阳东', type: '高速场', tracks: 5, platforms: 2, throat: 3, unmanned: false, km: 210 },
    linhe: { name: '襄阳北', type: '编组站', tracks: 12, platforms: 1, throat: 4, unmanned: false, hump: true, km: 0 },

  },
  depots: {
    dd: { name: '襄阳北动车所', lines: ['检修线', '洗车线', '存车线', '临修线', '融冰除雪线', '镟轮线'], capacity: 8 },
    kc: { name: '襄阳北客整所', lines: ['整备线', '存车线', '洗车线', '消毒线'], capacity: 6 },
    jw: { name: '襄阳北机务折返段', lines: ['整备线', '折返线', '检修线', '机走线'], capacity: 5 },
    cls: { name: '襄阳北站修所', lines: ['站修线', '洗罐线', '轮对线'], capacity: 4 },
  },
  resources: {
    hotStandbyEmu: 2,
    hotStandbyLoco: 2,
    rescueTrain: 1,
    powerRepair: 1,
    permanentWayRepair: 1,
  },
};

function makeTrains(lineId, list) {
  const line = NETWORK.lines.find((l) => l.id === lineId);
  const order = line.stations;
  const occ = new Map();
  const secMin = { qinglan: 28, jiangwan: 12, linhe: 4 }[lineId];
  const out = [];
  const busy = (list2, s, e) => (list2 || []).some(([a, b]) => s < b && e > a);
  const sorted = list.slice().sort((a, b) => a.dep - b.dep);
  for (const sp of sorted) {
    const fi = order.indexOf(sp.from);
    const ti = order.indexOf(sp.to);
    const dir = Math.sign(ti - fi);
    const secs = [];
    for (let i = fi; i !== ti; i += dir) secs.push([order[i], order[i + dir]]);
    let cur = sp.dep;
    const stops = [{ st: sp.from, arr: null, dep: cur }];
    secs.forEach(([a, b], k) => {
      const key = lineId === 'jiangwan'
        ? `${dir}|${order.indexOf(a)}`
        : [order.indexOf(a), order.indexOf(b)].sort((x, y) => x - y).join('-');
      const headway = lineId === 'jiangwan' ? 2 : 0;
      let guard = 0;
      while (busy(occ.get(key), cur, cur + secMin + headway) && guard < 300) { cur += 1; guard += 1; }
      const arr = cur + secMin;
      const hold = occ.get(key) || [];
      hold.push([cur, arr]);
      occ.set(key, hold);
      const last = k === secs.length - 1;
      stops.push({ st: b, arr, dep: last ? null : arr + (sp.dwell || 2) });
      if (!last) cur = arr + (sp.dwell || 2);
    });
    const arr = secs.length ? stops[stops.length - 1].arr : sp.dep + (sp.dwell || 20);
    out.push({
      id: `${lineId}-${out.length + 1}`,
      no: sp.no,
      type: sp.type,
      from: sp.from,
      to: sp.to,
      dep: stops[0].dep,
      arr,
      dwell: sp.dwell || 2,
      priority: sp.priority || (sp.type.startsWith('G') ? 1 : sp.type.startsWith('D') ? 2 : sp.type.startsWith('K') ? 4 : 5),
      stockGroup: sp.stock || null,
      crew: sp.crew || 1,
      coaches: sp.coaches || 16,
      special: sp.special || false,
      stops,
    });
  }
  return out;
}

const TIMETABLE = {
  qinglan: makeTrains('qinglan', [
    { no: '6063', type: '普快', from: 'qinglan', to: 'lingkou', dep: 352, dwell: 4, coaches: 14, stock: 'S1', priority: 5 },
    { no: '6064', type: '普快', from: 'lingkou', to: 'qinglan', dep: 356, dwell: 4, coaches: 14, stock: 'S2', priority: 5 },
    { no: 'K245', type: 'K', from: 'qinglan', to: 'lingkou', dep: 364, dwell: 3, coaches: 18, stock: 'S3', priority: 4 },
    { no: 'K291', type: 'K', from: 'qinglan', to: 'lingkou', dep: 371, dwell: 3, coaches: 18, stock: 'S4', priority: 4 },
    { no: '31001', type: '货', from: 'qinglan', to: 'lingkou', dep: 378, dwell: 8, coaches: 46, stock: null, priority: 6 },
    { no: '31003', type: '货', from: 'lingkou', to: 'qinglan', dep: 382, dwell: 9, coaches: 48, stock: null, priority: 6 },
    { no: '42001', type: '路用', from: 'baishu', to: 'heyuan', dep: 388, dwell: 12, coaches: 8, stock: null, priority: 7 },
    { no: 'K546', type: 'K', from: 'lingkou', to: 'qinglan', dep: 394, dwell: 3, coaches: 18, stock: 'S5', priority: 4 },
    { no: '31005', type: '货', from: 'qinglan', to: 'lingkou', dep: 401, dwell: 8, coaches: 44, stock: null, priority: 6 },
    { no: '31007', type: '货', from: 'lingkou', to: 'qinglan', dep: 407, dwell: 9, coaches: 50, stock: null, priority: 6 },
  ]),
  jiangwan: makeTrains('jiangwan', [
    { no: 'G65', type: 'G', from: 'jiangwan', to: 'haigang', dep: 358, dwell: 2, coaches: 16, stock: 'E1', priority: 1 },
    { no: 'G67', type: 'G', from: 'jiangwan', to: 'haigang', dep: 365, dwell: 2, coaches: 16, stock: 'E2', priority: 1 },
    { no: 'G71', type: 'G', from: 'jiangwan', to: 'haigang', dep: 372, dwell: 2, coaches: 16, stock: 'E3', priority: 1 },
    { no: 'G79', type: 'G', from: 'haigang', to: 'jiangwan', dep: 378, dwell: 2, coaches: 16, stock: 'E4', priority: 1 },
    { no: 'G93', type: 'G', from: 'jiangwan', to: 'haigang', dep: 385, dwell: 2, coaches: 16, stock: 'E5', priority: 1 },
    { no: 'G95', type: 'G', from: 'haigang', to: 'jiangwan', dep: 391, dwell: 2, coaches: 16, stock: 'E6', priority: 1 },
    { no: 'D901', type: 'D', from: 'jiangwan', to: 'haigang', dep: 397, dwell: 4, coaches: 16, stock: 'E7', priority: 2 },
    { no: 'D903', type: 'D', from: 'haigang', to: 'jiangwan', dep: 403, dwell: 4, coaches: 16, stock: 'E8', priority: 2 },
    { no: 'G531', type: 'G', from: 'jiangwan', to: 'nanpu', dep: 409, dwell: 2, coaches: 8, stock: 'E9', priority: 1 },
    { no: 'G1571', type: 'G', from: 'xintang', to: 'haigang', dep: 415, dwell: 2, coaches: 16, stock: 'E10', priority: 1 },
  ]),
  linhe: makeTrains('linhe', [
    { no: 'X8011', type: '货', from: 'linhe', to: 'linhe', dep: 356, dwell: 38, coaches: 41, priority: 9, special: true },
    { no: '21001', type: '货', from: 'linhe', to: 'linhe', dep: 360, dwell: 26, coaches: 58, priority: 6 },
    { no: '21003', type: '货', from: 'linhe', to: 'linhe', dep: 364, dwell: 28, coaches: 62, priority: 6 },
    { no: '31001', type: '货', from: 'linhe', to: 'linhe', dep: 368, dwell: 24, coaches: 60, priority: 6 },
    { no: '31003', type: '货', from: 'linhe', to: 'linhe', dep: 372, dwell: 26, coaches: 54, priority: 6 },
    { no: '42001', type: '货', from: 'linhe', to: 'linhe', dep: 376, dwell: 30, coaches: 48, priority: 7 },
    { no: '42003', type: '货', from: 'linhe', to: 'linhe', dep: 381, dwell: 28, coaches: 50, priority: 7 },
    { no: 'X8013', type: '货', from: 'linhe', to: 'linhe', dep: 386, dwell: 34, coaches: 41, priority: 9, special: true },
    { no: '21005', type: '货', from: 'linhe', to: 'linhe', dep: 391, dwell: 24, coaches: 56, priority: 6 },
    { no: '31005', type: '货', from: 'linhe', to: 'linhe', dep: 397, dwell: 26, coaches: 60, priority: 6 },
  ]),
};

const SCENARIOS = [
  { id: 't1', kind: 'tutorial', title: '认识调度台', line: 'qinglan', brief: '看懂一列车从进站到发车', terms: ['ctc', 'panel', 'route', 'track', 'signal'], duration: 240, difficulty: 1, weather: '晴', trains: 6 },
  { id: 't2', kind: 'tutorial', title: '两车会车', line: 'qinglan', brief: '单线两站让两车安全交会', terms: ['block', 'section', 'meet', 'track'], duration: 300, difficulty: 1, weather: '晴', trains: 8 },
  { id: 't3', kind: 'tutorial', title: '红光带与引导接车', line: 'qinglan', brief: '判断真占用还是故障', terms: ['redband', 'guide', 'switch'], duration: 300, difficulty: 2, weather: '阴', trains: 8 },
  { id: 't4', kind: 'tutorial', title: '道岔失表与接近区段', line: 'qinglan', brief: '列车已接近时先呼叫停车再变更', terms: ['switchlost', 'approach', 'guide'], duration: 300, difficulty: 2, weather: '阴', trains: 8 },
  { id: 't5', kind: 'tutorial', title: '调度命令入门', line: 'qinglan', brief: '发对一条命令', terms: ['order', 'block'], duration: 300, difficulty: 2, weather: '晴', trains: 8 },
  { id: 't6', kind: 'tutorial', title: '晚点与传播', line: 'jiangwan', brief: '用一次热备切断传播链', terms: ['entropy', 'heat', 'stock'], duration: 360, difficulty: 3, weather: '雨', trains: 10 },
  { id: 't7', kind: 'tutorial', title: '股道开放', line: 'linhe', brief: '开局开放合适股道，避免站外停车', terms: ['track', 'length', 'throat', 'panel'], duration: 360, difficulty: 3, weather: '晴', trains: 10 },
  { id: 't8', kind: 'tutorial', title: '客运参与', line: 'jiangwan', brief: '压缩停站与保服务的取舍', terms: ['emotion', 'track'], duration: 360, difficulty: 3, weather: '晴', trains: 10 },
  { id: 't9', kind: 'tutorial', title: '货运参与', line: 'linhe', brief: '处理一次超偏载甩车', terms: ['gantry', 'hazmat', 'hump'], duration: 420, difficulty: 4, weather: '晴', trains: 10 },
  { id: 't10', kind: 'tutorial', title: '车辆段入门', line: 'linhe', brief: '排一次出所计划', terms: ['dd', 'heat', 'stock'], duration: 420, difficulty: 4, weather: '雪', trains: 10 },
  { id: 't11', kind: 'tutorial', title: '沙盒开关', line: 'qinglan', brief: '开一组开关并理解为什么难', terms: ['ai', 'budget'], duration: 420, difficulty: 4, weather: '晴', trains: 8 },
  { id: 's1', kind: 'story', title: '第一章：学员上岗', line: 'qinglan', brief: '第一次独立盯台', terms: ['ctc', 'order'], duration: 420, difficulty: 2, weather: '晴', trains: 10, act: 1 },
  { id: 's2', kind: 'story', title: '第二章：春运', line: 'linhe', brief: '图定加临客 22 对，股道不够用', terms: ['track', 'entropy'], duration: 600, difficulty: 4, weather: '雪', trains: 14, act: 2 },
  { id: 's3', kind: 'story', title: '第三章：台风', line: 'jiangwan', brief: '台风封锁与热备底牌', terms: ['heat', 'emotion'], duration: 600, difficulty: 4, weather: '台风', trains: 12, act: 3 },
  { id: 's4', kind: 'story', title: '第四章：地震', line: 'qinglan', brief: '全线停运后的抢修与恢复', terms: ['section', 'order'], duration: 600, difficulty: 5, weather: '地震', trains: 10, act: 4 },
  { id: 's5', kind: 'story', title: '第五章：专运', line: 'jiangwan', brief: '密语、优先级、全站让行', terms: ['special', 'heat'], duration: 600, difficulty: 5, weather: '晴', trains: 12, act: 5 },
  { id: 's6', kind: 'story', title: '第六章：事故调查', line: 'linhe', brief: '从运行图与录音还原事故链', terms: ['entropy', 'hazmat'], duration: 720, difficulty: 5, weather: '阴', trains: 12, act: 6 },
  { id: 's7', kind: 'story', title: '第七章：新线开通', line: 'jiangwan', brief: '新线调试与首日运行', terms: ['route', 'block'], duration: 720, difficulty: 5, weather: '晴', trains: 14, act: 7 },
  { id: 'd1', kind: 'daily', title: '每日挑战：雨夜宝成', line: 'qinglan', brief: '暴雨夜，一条单线，两列车同时晚点', terms: ['section', 'emotion'], duration: 480, difficulty: 4, weather: '暴雨', trains: 10 },
  { id: 'd2', kind: 'daily', title: '每日挑战：枢纽爆仓', line: 'linhe', brief: '到发线全满，只能取舍', terms: ['track', 'entropy'], duration: 480, difficulty: 5, weather: '晴', trains: 14 },
  { id: 'd3', kind: 'daily', title: '每日挑战：冻雨', line: 'jiangwan', brief: '接触网覆冰，降弓通过', terms: ['heat', 'order'], duration: 480, difficulty: 5, weather: '冻雨', trains: 12 },
];

const CMD_TYPES = [
  {
    id: '封锁区间',
    build: (c) => `${c.no} 号　${c.a}—${c.b} 间 K${c.km}+${c.m} 处${c.reason}，自 ${c.t1} 起封锁区间，停止接发列车，准许${c.unit}进入处理，处理完毕凭调度命令开通。受令：${c.recv}。`,
  },
  {
    id: '开通区间',
    build: (c) => `${c.no} 号　${c.a}—${c.b} 间 K${c.km}+${c.m} 处${c.reason}处理完毕，设备恢复正常，自 ${c.t1} 起开通区间，恢复基本闭塞，首列凭本命令运行。受令：${c.recv}。`,
  },
  {
    id: '临时限速',
    build: (c) => `${c.no} 号　自 ${c.t1} 起至 ${c.t2} 止，${c.a}—${c.b} 间 K${c.km}+${c.m} 至 K${c.km2}+${c.m2} 因${c.reason}，准许限速 ${c.v} km/h 运行，司机须确认限速揭示。受令：${c.recv}。`,
  },
  {
    id: '慢行施工',
    build: (c) => `${c.no} 号　${c.a}—${c.b} 间 K${c.km}+${c.m} 至 K${c.km2}+${c.m2} 进行${c.work}，自 ${c.t1} 起至 ${c.t2} 止按 ${c.v} km/h 慢行，施工负责人 ${c.recv} 现场监护。`,
  },
  {
    id: '反方向行车',
    build: (c) => `${c.no} 号　${c.a}—${c.b} 间正线${c.reason}，自 ${c.t1} 起改按反方向行车，行车凭证为调度命令，区间占用按单线办理，两端站须确认区间空闲。受令：${c.recv}。`,
  },
  {
    id: '降弓通过',
    build: (c) => `${c.no} 号　${c.a}—${c.b} 间 K${c.km}+${c.m} 处接触网${c.reason}，自 ${c.t1} 起禁止电力机车升弓，列车惰力通过，越过后方可恢复升弓。受令：${c.recv}。`,
  },
  {
    id: '改电话闭塞',
    build: (c) => `${c.no} 号　${c.a}—${c.b} 间基本闭塞设备${c.reason}，自 ${c.t1} 起停止基本闭塞法，改按电话闭塞法行车，行车凭证为路签（牌），两端站须签发占用区间凭证。受令：${c.recv}。`,
  },
  {
    id: '恢复基本闭塞',
    build: (c) => `${c.no} 号　${c.a}—${c.b} 间基本闭塞设备恢复正常，自 ${c.t1} 起停止电话闭塞法，恢复基本闭塞法行车，两端站核对区间空闲后办理。受令：${c.recv}。`,
  },
  {
    id: '转非常站控',
    build: (c) => `${c.no} 号　${c.station} 站 CTC 设备${c.reason}，自 ${c.t1} 起转非常站控，由车站值班员办理接发列车，调度台仅负责计划与命令。受令：${c.recv}。`,
  },
  {
    id: '恢复站控',
    build: (c) => `${c.no} 号　${c.station} 站设备恢复正常，自 ${c.t1} 起由非常站控转回中心站控，车站值班员与调度员核对行车日志后交接。受令：${c.recv}。`,
  },
  {
    id: '救援列车',
    build: (c) => `${c.no} 号　准许救援列车自 ${c.t1} 起由 ${c.station} 进入 ${c.a}—${c.b} 间 K${c.km}+${c.m} 处，救援期间限速 ${c.v} km/h，接近事故列车时停车联系。受令：${c.recv}。`,
  },
  {
    id: '热备替换',
    build: (c) => `${c.no} 号　启用 ${c.station} 热备${c.unit}，替换 ${c.train} 次车底，自 ${c.t1} 起按新交路运行，原车底回送就近客整所。受令：${c.recv}。`,
  },
  {
    id: '站内扣车',
    build: (c) => `${c.no} 号　${c.train} 次在 ${c.station} 站内扣停，等候${c.reason}处理，不得越站，开车时间另行通知。受令：${c.recv}。`,
  },
  {
    id: '临时加开',
    build: (c) => `${c.no} 号　准许加开 ${c.train} 次，${c.a} 至 ${c.b}，${c.t1} 开，按 ${c.v} km/h 运行，各站不得擅自扣停。受令：${c.recv}。`,
  },
  {
    id: '变更接车股道',
    build: (c) => `${c.no} 号　${c.train} 次变更接入 ${c.station} ${c.n} 道，车站须确认股道空闲、进路无误后开放信号。受令：${c.recv}。`,
  },
  {
    id: '超限列车',
    build: (c) => `${c.no} 号　${c.train} 次装载超限货物，${c.a}—${c.b} 间限速 ${c.v} km/h，禁止与相邻列车同时占用区间，邻线有车时须停车等待。受令：${c.recv}。`,
  },
  {
    id: '军运列车',
    build: (c) => `${c.no} 号　${c.train} 次为军运列车，${c.a}—${c.b} 间优先放行，不得会让、不得扣停，信息按保密规定传递。受令：${c.recv}。`,
  },
  {
    id: '接触网停电',
    build: (c) => `${c.no} 号　${c.a}—${c.b} 间 K${c.km}+${c.m} 至 K${c.km2}+${c.m2} 接触网自 ${c.t1} 起停电检修，停电期间禁止电力机车进入，作业完毕确认送电后方可恢复。受令：${c.recv}。`,
  },
  {
    id: '道岔加锁',
    build: (c) => `${c.no} 号　${c.station} 站 ${c.n} 号道岔自 ${c.t1} 起加锁，禁止扳动，需使用时须经调度员同意并现场确认。受令：${c.recv}。`,
  },
  {
    id: '股道封锁',
    build: (c) => `${c.no} 号　${c.station} 站 ${c.n} 道自 ${c.t1} 起封锁，停止接发列车与调车作业，作业完毕由 ${c.recv} 确认后销记。`,
  },
];

const REASONS = [
  '工务线路检查', '轨枕更换', '钢轨伤损处理', '道床清筛', '路基下沉', '接触网断线',
  '信号机灭灯', '轨道电路红光带', '道岔失表', '电缆故障', '牵引供电故障', '接触网覆冰',
  '暴雨积水', '山体溜坍', '落石侵限', '地震影响', '台风预警', '大雾能见度不足',
  '列车分离', '车辆热轴', '货物超偏载', '装载加固不良',
];
const WORKS = ['线路捣固', '更换钢轨', '道岔整治', '接触网检修', '信号设备调试', '桥隧检查'];
const UNITS = ['工务抢修队', '电务抢修队', '供电抢修队', '救援列车', '接触网作业车'];
const RECVS = ['车站值班员', '列车调度员', '司机', '驻站联络员', '供电调度员', '工务驻站员', '机务段调度员'];
const T1S = ['06:10', '06:25', '06:40', '07:05', '07:30', '08:00', '08:20', '09:15'];
const T2S = ['07:20', '07:45', '08:30', '09:00', '10:10', '11:00', '12:30'];
const VS = [15, 25, 40, 45, 60, 80, 120];

function buildOrders() {
  const out = {};
  const yard = (c) => [
    `${c.no} 号　${c.station} 站 ${c.n} 道自 ${c.t1} 起封锁，停止接发列车与调车作业，作业完毕由 ${c.recv} 确认后销记。`,
    `${c.no} 号　${c.station} 站 ${c.n} 号道岔自 ${c.t1} 起加锁，禁止扳动，需使用时须经调度员同意并现场确认。`,
    `${c.no} 号　${c.station} 站 ${c.n} 道至 ${c.n2} 道自 ${c.t1} 起进行调车作业，牵出线与驼峰径路须单独确认，不得越过警冲标。`,
    `${c.no} 号　${c.station} 站驼峰自 ${c.t1} 起进行${c.work}，溜放间隔按 ${c.v} km/h 控制，峰下股道须预留空线。`,
    `${c.no} 号　${c.train} 次在 ${c.station} 站 ${c.n} 道扣停，等候${c.reason}处理，不得动车。`,
    `${c.no} 号　${c.station} 站自 ${c.t1} 起转非常站控，由车站值班员办理接发列车与调车作业。`,
    `${c.no} 号　${c.station} 站设备恢复正常，自 ${c.t1} 起转回中心站控，核对行车日志后交接。`,
    `${c.no} 号　启用 ${c.station} 热备${c.unit}，替换 ${c.train} 次，自 ${c.t1} 起执行新交路。`,
    `${c.no} 号　${c.train} 次为军运，在 ${c.station} 站 ${c.n} 道停留，禁止调车与检修作业，信息保密。`,
    `${c.no} 号　${c.train} 次装载超限，${c.station} 站内 ${c.n} 道停留，邻线接车时须确认限界。`,
  ];
  for (const line of NETWORK.lines) {
    const order = line.stations;
    const secs = [];
    for (let i = 0; i < order.length - 1; i += 1) secs.push([order[i], order[i + 1], i]);
    let seq = 2001;
    const lineOrders = [];
    if (!secs.length) {
      const only = order[0];
      for (let r = 0; r < 24; r += 1) {
        for (let vi = 0; vi < 3; vi += 1) {
          for (let ti = 0; ti < 3; ti += 1) {
            const c = {
              no: String(seq++),
              station: NETWORK.stations[only].name,
              a: NETWORK.stations[only].name,
              b: NETWORK.stations[only].name,
              km: 0, m: 100, km2: 1, m2: 200,
              reason: REASONS[(r + vi + ti) % REASONS.length],
              work: WORKS[(r + vi) % WORKS.length],
              unit: UNITS[(r + ti) % UNITS.length],
              recv: RECVS[(r + ti) % RECVS.length],
              t1: T1S[(ti + r) % T1S.length],
              t2: T2S[(ti + vi) % T2S.length],
              v: VS[(vi + ti + r) % VS.length],
              n: 1 + ((r + vi) % 12),
              n2: 1 + ((r + vi + 2) % 12),
              train: `${['X', '21', '31', '42'][(r + vi) % 4]}${100 + ((r * 11 + vi * 5) % 800)}`,
            };
            const builders = yard(c);
            lineOrders.push({ type: '编组站', line: line.id, text: builders[(r + ti) % builders.length] });
          }
        }
      }
      out[line.id] = lineOrders;
      continue;
    }
    for (const [a, b, si] of secs) {
      const kmA = NETWORK.stations[a].km || 0;
      const kmB = NETWORK.stations[b].km || 0;
      const base = Math.round((kmA + kmB) / 2);
      for (const type of CMD_TYPES) {
        for (let r = 0; r < 4; r += 1) {
          for (let vi = 0; vi < 3; vi += 1) {
            for (let ti = 0; ti < 3; ti += 1) {
              const reason = REASONS[(si * 7 + r * 3 + vi + ti) % REASONS.length];
              const c = {
                no: String(seq++),
                a: NETWORK.stations[a].name,
                b: NETWORK.stations[b].name,
                station: NETWORK.stations[si === 0 ? a : b].name,
                km: base + (r * 2) - 1,
                m: 100 + (vi * 50) % 800,
                km2: base + 3 + r,
                m2: 200,
                reason,
                work: WORKS[(r + vi) % WORKS.length],
                unit: UNITS[(r + ti) % UNITS.length],
                recv: RECVS[(r * 2 + ti) % RECVS.length],
                t1: T1S[(ti + r) % T1S.length],
                t2: T2S[(ti + vi) % T2S.length],
                v: VS[(vi + ti + r) % VS.length],
                n: 1 + ((r + vi) % 8),
                train: `${['K', 'G', 'D', 'Z', 'T', 'X', '60', '31'][(r + vi) % 8]}${100 + ((r * 13 + vi * 7) % 800)}`,
              };
              lineOrders.push({ type: type.id, line: line.id, text: type.build(c) });
            }
          }
        }
      }
    }
    out[line.id] = lineOrders;
  }
  return out;
}

const EVENT_COUNT = EVENTS.length;

mkdirSync(OUT, { recursive: true });
const ORDERS = buildOrders();
writeFileSync(join(OUT, 'orders.json'), JSON.stringify({ version: 1, types: CMD_TYPES.map((t) => t.id), orders: ORDERS }, null, 0), 'utf8');
writeFileSync(join(OUT, 'events.json'), JSON.stringify({ version: 1, count: EVENT_COUNT, roots: ROOTS.length, events: EVENTS }, null, 0), 'utf8');
writeFileSync(join(OUT, 'glossary.json'), JSON.stringify({ version: 1, terms: GLOSSARY }, null, 0), 'utf8');
writeFileSync(join(OUT, 'network.json'), JSON.stringify(NETWORK, null, 0), 'utf8');
writeFileSync(join(OUT, 'timetable.json'), JSON.stringify(TIMETABLE, null, 0), 'utf8');
writeFileSync(join(OUT, 'scenarios.json'), JSON.stringify(SCENARIOS, null, 0), 'utf8');

console.log(`roots=${ROOTS.length} events=${EVENT_COUNT} terms=${GLOSSARY.length} scenarios=${SCENARIOS.length}`);


