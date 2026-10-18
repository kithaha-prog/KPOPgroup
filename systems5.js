/********************************************************************
 * systems5.js —— 竞争 · 企划 · 舆论（v6）
 * ------------------------------------------------------------------
 * 必须在 systems4.js 之后加载（k_pop.html 末尾加 <script src="systems5.js"></script>）
 *  · 🏆 竞争对手公司：4 家 AI 公司每周成长，行业排行榜，年终按排名发奖金；
 *      对手会向你的练习生发出挖角邀约（花钱留人 / 放人）
 *  · 🎬 回归企划：点「回归」后先走 3 步企划（预热 / MV 方向 / 宣传重点），
 *      花钱换回归质量加成，高风险选项加成波动更大
 *  · 📰 舆论与危机公关：随机爆出绯闻/谣言，3 周内处理（澄清/道歉/起诉/冷处理/调查），
 *      「路人缘」影响损失大小
 *  · 新增一个导航页签「竞争·舆论」；数据存在 state.rv
 *  · 要调数值，只改下面 CO0 / CR / OPT / PL
 ********************************************************************/
(function () {
const $$ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rnd = a => a[Math.floor(Math.random() * a.length)];
const deb = () => state.groups.flatMap(g => g.members);
const nm = p => p.stageName || p.name;
const avgSk = p => ((p.vocal || 0) + (p.dance || 0) + (p.rap || 0) + (p.visual || 0) + (p.charisma || 0)) / 5;
const refresh = () => { saveState(); updateGlobalUI(); renderCurrentTab(); };
const showModal = h => { $$('modalBox').innerHTML = h; $$('modalOverlay').classList.remove('hidden'); };
const need = c => { if (state.funds < c) { playSound('warn'); showToast(`💰 资金不足 ¥${c}万！`, 'warn'); return false; } return true; };

/* ================= 数值表 ================= */
// [id, 名称, 颜色, 起始口碑相对你的倍数, 每周成长, 旗下女团]
const CO0 = [
  ['orbit', 'ORBIT 娱乐', '#60a5fa', 0.7, 3, ['VELA']],
  ['galaxy', '星河传媒', '#c084fc', 1.1, 3.5, ['HAZE', 'Aster']],
  ['moon', 'BLUE MOON', '#34d399', 1.6, 4, ['Mirae', 'Juno']],
  ['nexa', 'NEXA 娱乐', '#fbbf24', 2.4, 5, ['Kairo', 'Daybreak', 'BLOOMY']]
];
const NEWG = ['LUMEN', 'PRISM', 'SOLAR', 'MIRAGE', 'VIVID', 'HALO', 'ZENITH', 'CORAL', 'AURA', 'EMBER'];
const YEAR_PRIZE = [[80, 30], [30, 10]];   // 年终第1/2名：[奖金, 口碑]
const CR = [
  { t: '💔 恋爱绯闻', d: n => `有媒体放出疑似 ${n} 与异性约会的偷拍照，评论区迅速发酵。` },
  { t: '🔥 整容谣言', d: n => `网络流传 ${n}「全面整容」的对比图，黑粉疯狂转发。` },
  { t: '📸 旧照风波', d: n => `有人翻出 ${n} 练习生时期的旧照与发言，被断章取义。` },
  { t: '🎙️ 直播失言', d: n => `${n} 在直播中的一句玩笑被剪辑传播，引发「态度问题」争议。` },
  { t: '🗡️ 黑粉造谣', d: n => `匿名账号爆料 ${n}「耍大牌欺负后辈」，不少路人跟风批评。` },
  { t: '🤝 团内不和传闻', d: n => `粉丝发现 ${n} 与队友的舞台互动异常，「团内不和」冲上热搜。`, multi: 1 }
];
// f(c) → {rep:口碑变化, pub:路人缘变化, m:结果文案}；c.truth = 传闻是否属实（玩家不知道，可花钱调查）
const OPT = {
  clarify: { n: '📢 发声明澄清', c: 5, tip: '传闻失实时很有效；属实则被打脸',
    f: c => c.truth ? { rep: -c.sev, pub: -6, m: '证据被扒出，澄清反被打脸' } : Math.random() < .8 ? { rep: -c.sev * .1, pub: 4, m: '澄清有力，风波平息' } : { rep: -c.sev * .5, pub: 0, m: '声明效果有限' } },
  apology: { n: '🙇 诚恳道歉', c: 3, tip: '传闻属实时止损最好；失实则白白认错',
    f: c => c.truth ? { rep: -c.sev * .3, pub: 5, m: '坦诚道歉获得谅解' } : { rep: -c.sev * .5, pub: -2, m: '无端认错被抓住把柄' } },
  sue: { n: '⚖️ 发律师函起诉', c: 15, tip: '失实时可能反转口碑；属实则严重反噬',
    f: c => c.truth ? { rep: -c.sev * 1.2, pub: -8, m: '起诉反遭反噬，被指心虚' } : Math.random() < .85 ? { rep: c.sev * .3, pub: 5, m: '造谣者被追责，舆论反转' } : { rep: -c.sev * .3, pub: -2, m: '诉讼拖延，热度未退' } },
  silent: { n: '🤐 冷处理', c: 0, tip: '一半概率自然消退，一半概率发酵',
    f: c => Math.random() < .5 ? { rep: -c.sev * .2, pub: -1, m: '热度自然消退' } : { rep: -c.sev * .7, pub: -4, m: '沉默被解读为默认，事态发酵' } },
  ignore: { n: '', c: 0, f: c => ({ rep: -c.sev * .9, pub: -5, m: '拖延未处理，舆论持续发酵' }) }
};
// 企划：[名称, 花费¥万, [质量加成最小, 最大]]
const PL = {
  pre: { n: '① 预热企划', o: [['无预热', 0, [0, 0]], ['悬疑预告片', 6, [1, 3]], ['成员个人预告', 10, [2, 4]], ['全网猜谜活动（高风险）', 16, [0, 8]]] },
  mv: { n: '② MV 方向', o: [['稳妥叙事', 0, [0, 1]], ['潮流舞蹈 MV', 8, [2, 4]], ['电影感大制作（高风险）', 14, [0, 9]]] },
  pr: { n: '③ 宣传重点', o: [['不特别宣传', 0, [0, 0]], ['综艺轮番出演', 8, [2, 3]], ['线下快闪店', 12, [1, 5]]] }
};

/* ================= 数据 ================= */
function ensure5() {
  const v = state.rv = state.rv || {};
  if (!v.cos) { const b = Math.max(60, state.reputation || 60); v.cos = CO0.map(([id, name, color, k, g, gs]) => ({ id, name, color, rep: Math.round(b * k), g, groups: gs.slice() })); }
  v.pub = v.pub == null ? 50 : v.pub;
  v.crises = v.crises || []; v.offers = v.offers || []; v.log = v.log || []; v.hist = v.hist || []; v.cid = v.cid || 1;
  return v;
}
const LG = t => { const v = ensure5(); v.log.unshift(`${state.dateStr}　${t}`); if (v.log.length > 12) v.log.length = 12; };
const league = () => [{ id: 'me', name: state.agencyName || 'STARLIGHT 娱乐', rep: state.reputation, me: 1, color: '#f472b6', groups: state.groups.map(g => g.name) }, ...ensure5().cos].sort((a, b) => b.rep - a.rep);
const coOf = id => ensure5().cos.find(c => c.id === id);

/* ================= 每周结算 ================= */
function leave(o) {
  const v = ensure5(), co = coOf(o.co);
  state.trainees = state.trainees.filter(t => t.uid !== o.uid);
  if (co) co.rep += 10;
  LG(`${o.name} 转投 ${co ? co.name : '对手公司'}`); showToast(`😢 ${o.name} 已离开，转投 ${co ? co.name : '对手公司'}`, 'warn');
}
function tick5(py) {
  const v = ensure5(), me = state.reputation;
  // 对手成长 / 出道 / 丑闻
  v.cos.forEach(c => {
    let g = c.g * (0.6 + Math.random() * 0.8);
    if (c.rep < me * .5) g *= 1.3; else if (c.rep > me * 1.8) g *= .7;
    c.rep = Math.max(20, Math.round((c.rep + g) * 10) / 10);
    const free = NEWG.filter(n => !c.groups.includes(n));
    if (Math.random() < .04 && free.length) { const n = rnd(free); c.groups.push(n); c.rep += 25; LG(`${c.name} 推出新女团「${n}」`); addTrendPost(`🎤 ${c.name} 推出新女团「${n}」，业界关注`, '爆 120万', '行业'); }
    else if (Math.random() < .03) { c.rep = Math.max(20, c.rep - 20); LG(`${c.name} 爆出丑闻，口碑下滑`); }
  });
  // 挖角邀约
  v.offers = v.offers.filter(o => {
    if (!state.trainees.some(t => t.uid === o.uid && t.status !== 'debuted')) return false;
    if (--o.wk < 0) { leave(o); return false; }
    return true;
  });
  if (!v.offers.length && Math.random() < .07) {
    const cs = state.trainees.filter(t => t.status !== 'debuted').sort((a, b) => avgSk(b) - avgSk(a)).slice(0, 3);
    if (cs.length) { const t = rnd(cs), co = rnd(v.cos); v.offers.push({ uid: t.uid, name: nm(t), co: co.id, fee: Math.round(20 + avgSk(t) * .8), wk: 2 }); showToast(`🕵️ ${co.name} 正在挖角 ${nm(t)}！`, 'warn'); }
  }
  // 危机：老化 → 过期自动恶化 → 新爆发
  v.crises.forEach(c => c.wk--);
  v.crises.filter(c => c.wk <= 0).forEach(c => apply(c, 'ignore', true));
  const ds = deb();
  if (ds.length && v.crises.length < 3 && Math.random() < .10 + Math.min(.1, ds.length * .01)) {
    const m = rnd(ds), g = state.groups.find(x => x.members.includes(m)), pool = CR.map((x, i) => i).filter(i => !CR[i].multi || (g && g.members.length >= 2));
    const i = rnd(pool), c = { id: v.cid++, i, uid: m.uid, n: nm(m), gn: g ? g.name : '', sev: R(12, 30), truth: Math.random() < .3, wk: 3, probe: 0 };
    v.crises.push(c); v.pop = c.id;
    addTrendPost(`${CR[i].t}：${c.n}（${c.gn}）相关话题登上热搜`, '爆 380万', '舆论'); playSound('warn'); showToast(`🚨 危机公关：${c.n} ${CR[i].t}！3 周内处理`, 'warn');
  } else if (ds.length && Math.random() < .05) {
    const g = rnd(state.groups), d = Math.round(g.fans * .02);
    g.fans += d; state.totalFans += d; state.reputation += 8; v.pub = clamp(v.pub + 5);
    LG(`${g.name} 的舞台直拍意外出圈，粉丝 +${d}`); showToast(`🌟 ${g.name} 直拍出圈！粉丝 +${d}，口碑 +8`, 'gold');
  }
  v.pub = clamp(v.pub + (50 - v.pub) * .03);
  // 年终排名
  if (state.year > py) {
    const L = league(), rk = L.findIndex(x => x.me) + 1, pz = YEAR_PRIZE[rk - 1];
    v.hist.unshift({ y: py, rk, top: L[0].name });
    if (pz) { state.funds += pz[0]; state.reputation += pz[1]; }
    LG(`${py} 年度公司排名第 ${rk}${pz ? `，奖金 ¥${pz[0]}万` : ''}`); showToast(`🏆 ${py} 年度行业排名第 ${rk}${pz ? `！奖金 ¥${pz[0]}万、口碑 +${pz[1]}` : '，明年继续努力'}`, rk === 1 ? 'gold' : 'info');
  }
}

/* ================= 危机公关 ================= */
function apply(c, key, auto) {
  const v = ensure5(), o = OPT[key];
  if (!auto && !need(o.c)) return;
  state.funds -= o.c;
  const r = o.f(c); if (r.rep < 0) r.rep *= (1.3 - v.pub / 100);
  state.reputation = Math.max(0, Math.round(state.reputation + r.rep)); v.pub = clamp(v.pub + r.pub);
  const g = state.groups.find(x => x.name === c.gn);
  if (g) {
    const d = Math.round(g.fans * .002 * r.rep); g.fans = Math.max(0, g.fans + d); state.totalFans = Math.max(0, state.totalFans + d);
    if (r.rep < -8) g.members.forEach(m => { m.stamina = clamp((m.stamina == null ? 60 : m.stamina) - 8); });
  }
  v.crises = v.crises.filter(x => x.id !== c.id);
  const rep = Math.round(r.rep); LG(`${c.n}「${CR[c.i].t}」${r.m}（口碑 ${rep >= 0 ? '+' : ''}${rep}）`);
  if (!auto) { playSound(r.rep >= 0 ? 'fanfare' : 'warn'); closeModal(); }
  showToast(`${r.rep >= 0 ? '✅' : '📉'} ${c.n}：${r.m}（口碑 ${rep >= 0 ? '+' : ''}${rep}）`, r.rep >= 0 ? 'success' : 'warn');
  if (!auto) refresh();
}
function openCr(id) {
  const v = ensure5(), c = v.crises.find(x => x.id === id); if (!c) return;
  const hint = c.probe ? `<div class="text-[11px] ${c.truth ? 'text-rose-300' : 'text-emerald-300'}">🔎 调查结果：${c.truth ? '传闻基本属实' : '传闻严重失实，是恶意造谣'}</div>`
    : `<button onclick="S5.probe(${id})" class="glass-pill px-3 py-1.5 rounded-full text-[11px] font-bold text-cyan-200">🔎 委托调查真相 ¥4万</button>`;
  showModal(`<div class="space-y-3"><div class="flex justify-between items-center"><h3 class="text-base font-black text-white">${CR[c.i].t}</h3><button onclick="closeModal()" class="text-slate-400 text-xs">关闭</button></div>
    <p class="text-xs text-slate-200">${CR[c.i].d(c.n)}</p>
    <div class="text-[11px] text-slate-400">所属：${c.gn}　·　严重度 ${c.sev}　·　剩余 <b class="text-amber-300">${c.wk}</b> 周（逾期将自动恶化）　·　路人缘 ${Math.round(v.pub)}</div>${hint}
    <div class="space-y-2">${['clarify', 'apology', 'sue', 'silent'].map(k => `<button onclick="S5.act(${id},'${k}')" class="w-full text-left glass-pill rounded-2xl px-4 py-2.5"><div class="flex justify-between text-xs font-black text-white"><span>${OPT[k].n}</span><span class="text-rose-300">${OPT[k].c ? '¥' + OPT[k].c + '万' : '免费'}</span></div><div class="text-[10px] text-slate-400">${OPT[k].tip}</div></button>`).join('')}</div></div>`);
}
function probe(id) {
  const c = ensure5().crises.find(x => x.id === id); if (!c || c.probe || !need(4)) return;
  state.funds -= 4; c.probe = 1; refresh(); openCr(id);
}

/* ================= 挖角 ================= */
function counter(i) {
  const v = ensure5(), o = v.offers[i]; if (!o || !need(o.fee)) return;
  state.funds -= o.fee; const co = coOf(o.co); if (co) co.rep = Math.max(20, co.rep - 8);
  v.offers.splice(i, 1); LG(`成功留住 ${o.name}，${co ? co.name : '对手'} 铩羽而归`); playSound('fanfare'); showToast(`🤝 留住了 ${o.name}！对手口碑 -8`, 'gold'); refresh();
}
function letGo(i) { const v = ensure5(), o = v.offers[i]; if (!o) return; v.offers.splice(i, 1); leave(o); refresh(); }

/* ================= 回归企划 ================= */
let PLAN = null, GO = false;
const _lc = launchGroupComeback;
launchGroupComeback = function () {
  if (GO) {
    GO = false;
    const g = getActiveGroup(), had = g && g.activeComeback, b = PLAN.bonus || 0, d = b / 0.2;
    if (g && b) g.synergy += d;
    try { _lc(); } finally { if (g && b) g.synergy -= d; }
    if (g && g.activeComeback === had) { state.funds += PLAN.cost; refresh(); }   // 发行失败：退还企划费
    else if (g) { LG(`${g.name} 回归企划：花费 ¥${PLAN.cost}万，质量 +${b}`); showToast(`🎬 回归企划生效：质量 +${b}（企划费 ¥${PLAN.cost}万）`, 'gold'); saveState(); }
    return;
  }
  if (!getActiveGroup()) return;
  PLAN = { pre: 0, mv: 0, pr: 0 }; planModal();
};
function planCost() { return Object.keys(PL).reduce((s, k) => s + PL[k].o[PLAN[k]][1], 0); }
function planModal() {
  const sec = k => `<div class="space-y-1.5"><div class="text-xs font-black text-white">${PL[k].n}</div><div class="grid grid-cols-1 md:grid-cols-2 gap-1.5">${PL[k].o.map((o, i) => `<button onclick="S5.pick('${k}',${i})" class="rounded-xl px-3 py-2 text-left text-[11px] ${PLAN[k] === i ? 'btn-luxury text-white' : 'glass-pill text-slate-300'}"><b>${o[0]}</b><div class="text-[10px] opacity-80">${o[1] ? '¥' + o[1] + '万' : '免费'} · 质量 +${o[2][0]}${o[2][1] > o[2][0] ? '~' + o[2][1] : ''}</div></button>`).join('')}</div></div>`;
  showModal(`<div class="space-y-4"><div class="flex justify-between items-center"><h3 class="text-base font-black text-white">🎬 回归企划</h3><button onclick="closeModal()" class="text-slate-400 text-xs">取消</button></div>
    <p class="text-[11px] text-slate-400">先定企划再正式发行。企划费在专辑制作费之外另付，加成在发行时随机落在区间内。</p>${Object.keys(PL).map(sec).join('')}
    <button onclick="S5.go()" class="btn-luxury w-full py-3 rounded-2xl text-sm font-black text-white">确认企划并发行（企划费 ¥${planCost()}万）</button></div>`);
}
function pick(k, i) { PLAN[k] = i; planModal(); }
function go() {
  const cost = planCost(); if (!need(cost)) return;
  PLAN.bonus = Object.keys(PL).reduce((s, k) => { const r = PL[k].o[PLAN[k]][2]; return s + R(r[0], r[1]); }, 0);
  state.funds -= cost; PLAN.cost = cost; closeModal(); GO = true; launchGroupComeback();
}

/* ================= 周推进挂钩 ================= */
const _adv = advanceNextWeek;
advanceNextWeek = function () {
  ensure5(); const d = state.dateStr, py = state.year;
  _adv();
  if (state.dateStr !== d) {
    tick5(py); refresh();
    const v = state.rv;
    if (v.pop) { const id = v.pop; v.pop = 0; if ($$('modalOverlay').classList.contains('hidden')) openCr(id); }
  }
};

/* ================= 页面 ================= */
function rvHtml() {
  const v = ensure5(), L = league(), mx = Math.max(...L.map(x => x.rep), 1);
  const rows = L.map((c, i) => `<div class="space-y-0.5"><div class="flex items-center gap-2 text-[11px] ${c.me ? 'text-pink-200 font-black' : 'text-slate-200'}"><span class="w-4 text-slate-400">${i + 1}</span><span class="w-28 truncate">${c.name}${c.me ? '（你）' : ''}</span><div class="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.round(c.rep / mx * 100)}%;background:${c.color}"></div></div><b class="w-12 text-right">${Math.round(c.rep)}</b></div><div class="pl-6 text-[10px] text-slate-500">旗下：${c.groups.join(' / ') || '—'}</div></div>`).join('');
  const hist = v.hist.slice(0, 3).map(h => `${h.y}年第${h.rk}名（榜首 ${h.top}）`).join(' · ') || '尚无记录';
  const crisis = v.crises.length ? v.crises.map(c => `<div class="flex items-center justify-between gap-2 rounded-2xl border border-rose-400/30 bg-black/30 px-3 py-2"><div class="text-[11px] text-slate-200"><b class="text-white">${CR[c.i].t}</b> · ${c.n}（${c.gn}）<div class="text-[10px] text-amber-300">剩余 ${c.wk} 周 · 严重度 ${c.sev}</div></div><button onclick="S5.open(${c.id})" class="btn-luxury px-3 py-1.5 rounded-full text-[11px] font-black text-white">处理</button></div>`).join('') : '<div class="text-[11px] text-slate-500">暂无舆论危机。</div>';
  const offers = v.offers.length ? v.offers.map((o, i) => { const co = coOf(o.co); return `<div class="rounded-2xl border border-amber-400/30 bg-black/30 px-3 py-2 space-y-1.5"><div class="text-[11px] text-slate-200"><b style="color:${co ? co.color : '#fff'}">${co ? co.name : '对手'}</b> 想挖走练习生 <b class="text-white">${o.name}</b><span class="text-amber-300">（${o.wk + 1} 周内答复）</span></div><div class="flex gap-2"><button onclick="S5.counter(${i})" class="btn-luxury px-3 py-1.5 rounded-full text-[11px] font-black text-white">加薪留人 ¥${o.fee}万</button><button onclick="S5.let(${i})" class="glass-pill px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-300">放她走</button></div></div>`; }).join('') : '<div class="text-[11px] text-slate-500">目前没有对手来挖人。</div>';
  const log = v.log.length ? v.log.map(t => `<div class="text-[10px] text-slate-400">${t}</div>`).join('') : '<div class="text-[10px] text-slate-500">暂无动态。</div>';
  return `<div class="space-y-4 pb-24">
    <div class="glass-panel rounded-3xl p-5 space-y-3"><div class="flex justify-between items-center"><h3 class="text-sm font-black text-white">🏆 行业公司排行榜</h3><span class="text-[10px] text-slate-400">按口碑排名 · 年终第1名奖 ¥${YEAR_PRIZE[0][0]}万</span></div>${rows}<div class="text-[10px] text-slate-500">历年：${hist}</div></div>
    <div class="glass-panel rounded-3xl p-5 space-y-3"><div class="flex justify-between items-center"><h3 class="text-sm font-black text-white">📰 舆论与危机公关</h3><span class="text-[11px] text-slate-400">路人缘 <b class="${v.pub >= 50 ? 'text-emerald-300' : 'text-rose-300'}">${Math.round(v.pub)}</b></span></div>${crisis}<p class="text-[10px] text-slate-500">路人缘越高，危机造成的口碑损失越小。传闻是否属实需要调查才知道；逾期不处理会自动恶化。</p></div>
    <div class="glass-panel rounded-3xl p-5 space-y-3"><h3 class="text-sm font-black text-white">🕵️ 挖角邀约</h3>${offers}</div>
    <div class="glass-panel rounded-3xl p-5 space-y-1"><h3 class="text-sm font-black text-white mb-1">🗞️ 行业动态</h3>${log}</div></div>`;
}
const _rc = renderCurrentTab;
renderCurrentTab = function () { if (currentTab === 'rv') $$('mainContent').innerHTML = rvHtml(); else _rc(); };
const _ug = updateGlobalUI;
updateGlobalUI = function () {
  _ug(); const on = currentTab === 'rv', v = state.rv || {};
  ['desk-nav-rv', 'mob-nav-rv'].forEach(id => { const e = $$(id); if (e) { e.classList.toggle('bg-white/10', on); e.style.color = on ? '#fff' : ''; } });
  const n = (v.crises || []).length + (v.offers || []).length;
  ['rv-badge', 'rv-badge-m'].forEach(id => { const b = $$(id); if (b) { b.textContent = n || ''; b.style.display = n ? '' : 'none'; } });
};
(function addNav() {
  const dt = $$('desk-nav-trends'), mt = $$('mob-nav-trends');
  if (dt && !$$('desk-nav-rv')) { const c = dt.cloneNode(true); c.id = 'desk-nav-rv'; c.setAttribute('onclick', "switchTab('rv')"); c.innerHTML = '<span class="flex items-center gap-3"><i class="fa-solid fa-trophy text-sm w-4 text-center"></i>竞争·舆论</span><span id="rv-badge" class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-extrabold" style="display:none"></span>'; dt.parentNode.insertBefore(c, dt); }
  if (mt && !$$('mob-nav-rv')) { const c = mt.cloneNode(true); c.id = 'mob-nav-rv'; c.setAttribute('onclick', "switchTab('rv')"); c.innerHTML = '<i class="fa-solid fa-trophy text-xs mb-0.5"></i><span class="text-[10px] font-bold">竞争<b id="rv-badge-m" class="text-rose-400 ml-0.5"></b></span>'; mt.parentNode.insertBefore(c, mt); mt.parentNode.className = mt.parentNode.className.replace(/grid-cols-(\d)/, (s, n) => 'grid-cols-' + (+n + 1)); }
})();

window.S5 = { open: openCr, act: (id, k) => { const c = ensure5().crises.find(x => x.id === id); if (c) apply(c, k); }, probe, counter, let: letGo, pick, go };
ensure5(); updateGlobalUI(); renderCurrentTab();
})();
