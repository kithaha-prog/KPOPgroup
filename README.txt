立绘素材库文件规则
==================

  portraits/<艺名小写>/<服装id>.png

例：
  portraits/stella/default.png           默认立绘（每人必备，其他服装缺图时用它）
  portraits/stella/street.png            街头休闲装
  portraits/stella/stage_girlcrush.png   Y2K 辣妹舞台装（打歌服）

· 扩展名支持 png / jpg / jpeg / webp
· 旧版 portraits/stella.png 仍然可用，等同于 default
· 查找顺序：该服装 → default → 旧版单文件 → 首字母剪影
· 游戏内「立绘素材库」可检查每人每套服装是否缺图，并一键复制生成提示词
· 加人改 roster.js，加服装改 outfits.js

服装 id 一览（来自 outfits.js）：
  default                 日常练习服（日常）
  street                  街头休闲装（日常）
  uniform                 学院风制服（日常）
  airport                 机场时尚（日常）
  stage_girlcrush         Y2K 辣妹舞台装（打歌服）
  stage_cyber             赛博机能舞台装（打歌服）
  stage_fairy             月光仙女裙（打歌服）
  stage_highteen          清凉果汁运动装（打歌服）
  stage_royal             暗黑高定礼服（打歌服）
  stage_stella_limited    星辉限定高定（打歌服）

艺人文件夹名一览（来自 roster.js）：
  stella        沈星梨 (STELLA)
  chloe         姜予希 (CHLOE)
  vex           崔飒 (VEX)
  momo          林沐桃 (MOMO)
  karina        柳知珉 (KARINA)
  winter        金冬雪 (WINTER)
  giselle       朴采源 (GISELLE)
  ning          郑允真 (NING)
  wonyoung      韩一叶 (WONYOUNG)
  yujin         宋恩采 (YUJIN)
  leeseo        尹元英 (LEESEO)
  rei           张宥真 (REI)
  gaeul         白瑞渊 (GAEUL)
  liz           权礼志 (LIZ)
  yeji          裴留真 (YEJI)
  ryujin        宁彩领 (RYUJIN)
  yuna          叶有娜 (YUNA)
  chaeryeong    苏智秀 (CHAERYEONG)
  sakura        宫脇樱花 (SAKURA)
  kazuha        中村琉璃 (KAZUHA)
  eunchae       沈千寻 (EUNCHAE)
  minji         姜星野 (MINJI)
  hanni         崔珍妮 (HANNI)
  haerin        林丽莎 (HAERIN)
  danielle      柳彩英 (DANIELLE)
  nova          金思成 (NOVA)
  aria          朴语嫣 (ARIA)
  luna          郑清雅 (LUNA)
  sera          韩知珉 (SERA)
  zoe           宋冬雪 (ZOE)
