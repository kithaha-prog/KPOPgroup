/********************************************************************
 * outfits.js —— 服装目录（要加服装，只改这个文件）
 * ------------------------------------------------------------------
 * 立绘素材库的文件规则：
 *     portraits/<艺名小写>/<服装id>.png
 * 例如：
 *     portraits/stella/default.png            ← 默认立绘（必备）
 *     portraits/stella/street.png             ← Stella 的街头休闲装
 *     portraits/stella/stage_girlcrush.png    ← Stella 的 Y2K 打歌服
 * 某人缺少某套服装的图时，自动退回使用她的 default 立绘，不会出错。
 * （旧版 portraits/stella.png 仍然可用，等同于 default）
 *
 * 字段说明：
 *   id         服装id，也是立绘文件名（英文小写/下划线，不要重复）
 *   name       显示名
 *   type       'daily' 日常装扮 | 'stage' 打歌服
 *   price      购买价格（¥万），0 = 默认拥有
 *   desc       简介
 *   concept    （打歌服）对应的概念 id：girlcrush / cyber / fairy / highteen / royal
 *   stageBonus （打歌服）回归专辑质量加成；与女团概念一致时再额外 +4
 *   only       （可选）专属服装，只有这个人能买/穿，填她的文件名（艺名小写）
 *   promptZh / promptEn  生成立绘用的服装描述，素材库里一键复制提示词时会用到
 ********************************************************************/
const OUTFIT_DATA = [
  { id: 'default', name: '日常练习服', type: 'daily', price: 0,
    desc: '练习室日常穿搭，宽松舒适。',
    promptZh: '宽松卫衣与运动长裤，练习室日常穿搭，干净自然',
    promptEn: 'loose hoodie and sweatpants, everyday practice-room outfit, clean and natural' },

  { id: 'street', name: '街头休闲装', type: 'daily', price: 8,
    desc: '牛仔外套叠穿，随性的街头感。',
    promptZh: '做旧牛仔外套叠穿印花T恤，阔腿牛仔裤，运动鞋，街头休闲风',
    promptEn: 'oversized denim jacket over a graphic tee, wide-leg jeans, sneakers, relaxed street style' },

  { id: 'uniform', name: '学院风制服', type: 'daily', price: 10,
    desc: '百褶裙与西装外套的学院风。',
    promptZh: '学院风制服，西装外套，百褶裙，领结，及膝长袜，乐福鞋',
    promptEn: 'preppy school-style uniform, blazer, pleated skirt, ribbon tie, knee socks, loafers' },

  { id: 'airport', name: '机场时尚', type: 'daily', price: 16,
    desc: '风衣、墨镜与设计师托特包。',
    promptZh: '机场时尚穿搭，长款风衣，墨镜推到头顶，设计师托特包，围巾',
    promptEn: 'airport fashion, long trench coat, sunglasses pushed up on head, designer tote bag, scarf' },

  { id: 'stage_girlcrush', name: 'Y2K 辣妹舞台装', type: 'stage', price: 18,
    concept: 'girlcrush', stageBonus: 5,
    desc: '玫瑰红与黑色拼接外套，金属链条点缀。',
    promptZh: 'Y2K 舞台服，玫瑰红与黑色拼接夹克，工装长裤，银色链条配饰，厚底靴',
    promptEn: 'Y2K stage outfit, rose-red and black paneled jacket, cargo pants, silver chain accessories, platform boots' },

  { id: 'stage_cyber', name: '赛博机能舞台装', type: 'stage', price: 18,
    concept: 'cyber', stageBonus: 5,
    desc: '金属银外套与青色发光线条。',
    promptZh: '未来感机能舞台服，金属银色外套带青色发光饰边，多口袋工装裤，全息配饰',
    promptEn: 'futuristic techwear stage outfit, metallic silver jacket with cyan glowing trim, utility pants, holographic accessories' },

  { id: 'stage_fairy', name: '月光仙女裙', type: 'stage', price: 18,
    concept: 'fairy', stageBonus: 5,
    desc: '淡紫雪纺长裙，珍珠点缀。',
    promptZh: '空灵舞台长裙，淡紫色雪纺层叠，珍珠配饰，月光图案刺绣，柔和微光面料',
    promptEn: 'ethereal stage gown, layered pale lavender chiffon, pearl accessories, moonlight embroidery, softly glowing fabric' },

  { id: 'stage_highteen', name: '清凉果汁运动装', type: 'stage', price: 14,
    concept: 'highteen', stageBonus: 4,
    desc: '撞色棒球外套，明亮的果汁色系。',
    promptZh: '清爽舞台服，撞色棒球外套，白色T恤，百褶裙，亮色运动鞋，果汁马卡龙色系',
    promptEn: 'fresh stage outfit, color-block varsity jacket, white tee, pleated skirt, bright sneakers, fruity pastel palette' },

  { id: 'stage_royal', name: '暗黑高定礼服', type: 'stage', price: 28,
    concept: 'royal', stageBonus: 7,
    desc: '黑金刺绣长礼服，歌剧院的气场。',
    promptZh: '暗黑高定舞台礼服，黑色天鹅绒配金线刺绣，结构感肩线，长款披风，歌剧风格',
    promptEn: 'dark couture stage gown, black velvet with gold embroidery, structured shoulders, long cape, opera-inspired' },

  { id: 'stage_stella_limited', name: '星辉限定高定', type: 'stage', price: 40,
    concept: 'girlcrush', stageBonus: 9, only: 'stella',
    desc: 'Stella 专属：玫瑰红亮片外套与星形胸针。',
    promptZh: '限定高定舞台外套，玫瑰红亮片，黑色西装裤，星形银色胸针，聚光灯般的光泽',
    promptEn: 'limited couture stage jacket in rose-red sequins, black tailored pants, star-shaped silver brooch, spotlight glow' }
];
