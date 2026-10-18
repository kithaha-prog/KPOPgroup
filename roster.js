/********************************************************************
 * roster.js —— 固定人物名册（要加人，只改这个文件）
 * ------------------------------------------------------------------
 * 每个人一行，格式：
 *     { name: '本名', stageName: '艺名' },
 * 立绘默认读取： portraits/艺名小写.png （也支持 jpg / jpeg / webp）
 * 想用别的文件名，加 file 字段（不含扩展名）：
 *     { name: '本名', stageName: 'ABC', file: 'abc_v2' },
 *
 * 注意：
 *  1. 只能往末尾追加；不要调整已有人物的顺序，否则旧存档里的人会变脸。
 *  2. 每行末尾的英文逗号不要漏。
 *  3. 艺名不要重复。
 *
 * 可选字段 lookZh / lookEn：这个人固定的外貌描述（发型、五官、气质）。
 * 填了以后，在“立绘素材库”里复制提示词时会自动带上，方便不同服装下保持同一张脸。
 ********************************************************************/
const IDOL_ROSTER_DATA = [
      { name: '沈星梨', stageName: 'STELLA',
        lookZh: '东亚少女，冷艳精致的五官，高颅顶小脸，狐系眼型，黑色长直发并挑染一缕玫瑰红发束，侧边微微遮眼，自信而略带疏离的眼神',
        lookEn: 'East Asian girl, striking bone structure, small face, fox eyes, long straight black hair with a rose-red streak, side-swept bangs, confident slightly aloof gaze' },
      { name: '姜予希', stageName: 'CHLOE',
        lookZh: '东亚少女，温柔清透的五官，大而明亮的杏眼，及腰淡紫色长卷发，气质清冷空灵',
        lookEn: 'East Asian girl, soft delicate features, large bright almond eyes, waist-length pale lavender wavy hair, serene ethereal aura' },
      { name: '崔飒', stageName: 'VEX',
        lookZh: '东亚少女，利落冷感的五官，上挑猫眼，银灰色锁骨短发带青色挑染，舞台气场强烈',
        lookEn: 'East Asian girl, sharp cool features, upturned cat eyes, silver-gray bob with cyan streaks, strong stage presence' },
      { name: '林沐桃', stageName: 'MOMO',
        lookZh: '东亚少女，元气甜美的五官，圆圆的大眼睛，蜜糖棕色双马尾，笑容明亮',
        lookEn: 'East Asian girl, sweet cheerful features, round bright eyes, honey-brown twin tails, bright smile' },
      { name: '柳知珉', stageName: 'KARINA' },
      { name: '金冬雪', stageName: 'WINTER' },
      { name: '朴采源', stageName: 'GISELLE' },
      { name: '郑允真', stageName: 'NING' },
      { name: '韩一叶', stageName: 'WONYOUNG' },
      { name: '宋恩采', stageName: 'YUJIN' },
      { name: '尹元英', stageName: 'LEESEO' },
      { name: '张宥真', stageName: 'REI' },
      { name: '白瑞渊', stageName: 'GAEUL' },
      { name: '权礼志', stageName: 'LIZ' },
      { name: '裴留真', stageName: 'YEJI' },
      { name: '宁彩领', stageName: 'RYUJIN' },
      { name: '叶有娜', stageName: 'YUNA' },
      { name: '苏智秀', stageName: 'CHAERYEONG' },
      { name: '宫脇樱花', stageName: 'SAKURA' },
      { name: '中村琉璃', stageName: 'KAZUHA' },
      { name: '沈千寻', stageName: 'EUNCHAE' },
      { name: '姜星野', stageName: 'MINJI' },
      { name: '崔珍妮', stageName: 'HANNI' },
      { name: '林丽莎', stageName: 'HAERIN' },
      { name: '柳彩英', stageName: 'DANIELLE' },
      { name: '金思成', stageName: 'NOVA' },
      { name: '朴语嫣', stageName: 'ARIA' },
      { name: '郑清雅', stageName: 'LUNA' },
      { name: '韩知珉', stageName: 'SERA' },
      { name: '宋冬雪', stageName: 'ZOE' }
];
