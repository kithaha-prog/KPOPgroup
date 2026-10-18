/********************************************************************
 * systems6.js —— 巡演与演唱会 · 综艺/广告通告池（v7）
 * ------------------------------------------------------------------
 * 必须在 systems5.js 之后加载（k_pop.html 末尾加 <script src="systems6.js"></script>）
 *  · 🎤 巡演规划：选路线（国内/亚洲/世界）+ 票价，按周逐城演出，途中有随机事件；
 *      收入取决于团粉数、成员体力、票价；巡演期间每周成员体力 -8
 *  · 📺 通告池：每周刷新 5 个综艺/广告/电台/杂志/颁奖嘉宾通告，
 *      要求某项技能，派合适的出道成员去（消耗 1 AP 与体力），发挥好坏影响报酬
 *  · 与 systems5 联动：通告成功提升路人缘，巡演出事故会拉低路人缘
 *  · 新增导航页签「通告·巡演」；数据存在 state.gigs 与 g.tour
 *  · 要调数值，只改下面 TOURS / GIGS
 ********************************************************************/
(function () {
const $$ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rnd = a => a[Math.floor(Math.random() * a.length)];
const r1 = v => Math.round(v * 10) / 10;
const wk = () => Math.floor((Date.parse(state.dateStr) - Date.parse('2026-01-01')) / 6048e5);
const nm = p => p.stageName || p.name;
const refresh = () => { saveState(); updateGlobalUI(); renderCurrentTab(); };
const need = c => { if (state.funds < c) { playSound('warn'); showToast(`💰 资金不足 ¥${c}万！`, 'warn'); return false; } return true; };
const stam = m => m.stamina == null ? 60 : m.stamina;
const avgSt = g => g.members.reduce((s, m) => s + stam(m), 0) / g.members.length;
const pubAdd = d => { if (state.rv && state.rv.pub != null) state.rv.pub = clamp(state.rv.pub + d); };
const fmt = n => typeof formatFans === 'function' ? formatFans(Math.round(n)) : Math.round(n);

/* ================= 数值表 ================= */
// need: 所需团粉；cost: 筹备费(¥万)；base: 每城基础票房(¥万)；cities: 城市数
const TOURS = {
  home: { n: '🇰🇷 国内巡演', need: 2e4, cost: 20, base: 11, cities: ['首尔', '釜山', '大邱', '仁川'] },
  asia: { n: '🌏 亚洲巡演', need: 1e5, cost: 60, base: 30, cities: ['东京', '大阪', '曼谷', '台北'] },
  world: { n: '🌍 世界巡演', need: 5e5, cost: 150, base: 72, cities: ['洛杉矶', '纽约', '伦敦', '巴黎', '悉尼'] }
};
const PRICE = { low: ['亲民票价', 0.8, 0.25], mid: ['标准票价', 1, 0], high: ['高价票', 1.3, -0.25] };   // [名称, 收入倍率, 上座率修正]
const SK = { vocal: '声乐', dance: '舞蹈', rap: 'Rap', visual: '颜值', charisma: '魅力' };
// [类型, 名称, 要求技能, 要求值, 基础报酬, 基础粉丝增长, 路人缘]
const GIGS = [
  ['📺', '周末综艺嘉宾', 'charisma', 40, 8, 600, 2], ['📺', '热门游戏综艺', 'charisma', 60, 14, 1500, 3], ['📺', '王牌综艺固定嘉宾', 'charisma', 75, 26, 3500, 4],
  ['🧴', '护肤品广告', 'visual', 50, 14, 600, 1], ['👜', '奢侈品牌活动', 'visual', 70, 28, 1200, 1], ['📻', '电台直播间', 'vocal', 45, 7, 500, 2],
  ['🎼', '经典OST演唱', 'vocal', 65, 15, 1800, 3], ['🏆', '颁奖典礼表演嘉宾', 'dance', 65, 18, 2200, 2], ['📸', '时尚杂志封面', 'visual', 60, 16, 900, 1],
  ['🎤', 'Rap 竞演特别节目', 'rap', 55, 12, 1600, 2], ['💃', '舞蹈挑战短视频', 'dance', 45, 8, 1000, 2]
];

/* ================= 数据 ================= */
function ensure6() {
  const G = state.gigs = state.gigs || {};
  if (G.w !== wk() || !G.list) {
    const pool = GIGS.slice().sort(() => Math.random() - .5).slice(0, 5);
    G.w = wk(); G.list = pool.map(([ic, n, sk, req, pay, fan, pub], i) => ({ id: i, ic, n, sk, req: req + R(-3, 6), pay: Math.round(pay * (0.9 + Math.random() * .3)), fan, pub, done: 0 }));
  }
  return G;
}
const deb = () => state.groups.flatMap(g => g.members);
let GSEL = 0;
const curG = () => state.groups[Math.min(GSEL, state.groups.length - 1)];

/* ================= 通告 ================= */
function sendGig(id, uid) {
  const G = ensure6(), gg = G.list.find(x => x.id === id), m = deb().find(x => x.uid === uid);
  if (!gg || gg.done || !m) return;
  if (state.ap < 1) { playSound('warn'); return showToast('⚡ 本周行动力(AP)已用尽！', 'warn'); }
  state.ap -= 1; gg.done = 1; m.stamina = clamp(stam(m) - 15);
  const skill = m[gg.sk] || 0, edge = skill - gg.req + R(-12, 12), ok = edge >= 0, great = edge >= 15;
  const pay = r1(gg.pay * (great ? 1.4 : ok ? 1 : .5)), fans = Math.round(gg.fan * (great ? 1.5 : ok ? 1 : .3)), g = state.groups.find(x => x.members.includes(m));
  state.funds += pay; if (g) { g.fans += fans; state.totalFans += fans; } if (m.pop != null) m.pop = clamp(m.pop + (great ? 4 : ok ? 2 : -2));
  pubAdd(ok ? gg.pub : -2); state.reputation += great ? 6 : ok ? 3 : 0;
  playSound(ok ? 'fanfare' : 'warn');
  showToast(`${gg.ic} ${nm(m)} ${gg.n}：${great ? '表现惊艳！' : ok ? '顺利完成' : '发挥失常'} +¥${pay}万 粉丝 +${fans}`, great ? 'gold' : ok ? 'success' : 'warn'); refresh();
}

/* ================= 巡演 ================= */
function startTour(key, price) {
  const g = curG(), T = TOURS[key]; if (!g || g.tour || !need(T.cost)) return;
  if (g.fans < T.need) { playSound('warn'); return showToast(`👥 团粉需要至少 ${fmt(T.need)}`, 'warn'); }
  state.funds -= T.cost; g.tour = { key, price, i: 0, rev: 0, fans: 0, log: [] };
  showToast(`🎤 ${g.name} ${T.n}启动！共 ${T.cities.length} 站`, 'gold'); playSound('fanfare'); refresh();
}
function tourWeek(g) {
  const t = g.tour, T = TOURS[t.key], P = PRICE[t.price], city = T.cities[t.i];
  let sell = 0.3 + 0.35 * Math.min(g.fans / T.need, 2) + P[2] + (Math.random() - .5) * .2 + (avgSt(g) < 25 ? -.2 : 0), ev = '';
  g.members.forEach(m => { m.stamina = clamp(stam(m) - 8); });
  const r = Math.random();
  if (r < .12) { const m = rnd(g.members); m.stamina = clamp(stam(m) - 25); sell -= .1; ev = `⚠️ ${nm(m)} 带伤上阵`; pubAdd(-2); }
  else if (r < .27) { sell += .15; ev = '🔥 现场安可被疯传'; pubAdd(2); }
  else if (r < .35) { sell -= .15; ev = '🌧️ 暴雨影响观众到场'; }
  sell = clamp(sell, .1, 1.15);
  const rev = r1(T.base * sell * P[1] * (1 + state.reputation / 2000)), fans = Math.round(g.fans * .012 * Math.min(1, sell) * (sell >= 1 ? 1.5 : 1));
  state.funds += rev; g.fans += fans; state.totalFans += fans; state.reputation += 3; t.rev = r1(t.rev + rev); t.fans += fans;
  t.log.push(`${city}：上座率 ${Math.round(Math.min(sell, 1) * 100)}%${sell >= 1 ? '（售罄）' : ''} +¥${rev}万 ${ev}`);
  showToast(`🎤 ${g.name} ${city}站${sell >= 1 ? ' 门票售罄！' : ''} +¥${rev}万`, sell >= 1 ? 'gold' : 'info');
  if (++t.i >= T.cities.length) {
    const net = r1(t.rev - T.cost); state.reputation += 10 + T.cities.length * 2;
    showToast(`🏁 ${g.name} ${T.n}圆满落幕！票房 ¥${t.rev}万，净利 ${net >= 0 ? '+' : ''}¥${net}万，新增粉丝 ${fmt(t.fans)}`, 'gold');
    (g.tourHist = g.tourHist || []).unshift({ n: T.n, rev: t.rev, net, d: state.dateStr }); g.tourHist.length = Math.min(g.tourHist.length, 5);
    if (typeof addTrendPost === 'function') addTrendPost(`🎤 ${g.name} ${T.n}全部场次落幕，累计票房 ¥${t.rev}万`, '爆 260万', '巡演');
    state.tours = (state.tours || 0) + 1; g.tour = null;
  }
}

/* ================= 周推进挂钩 ================= */
const _adv = advanceNextWeek;
advanceNextWeek = function () {
  const d = state.dateStr; _adv();
  if (state.dateStr !== d) { ensure6(); state.groups.forEach(g => { if (g.tour) tourWeek(g); }); refresh(); }
};

/* ================= 页面 ================= */
function gigHtml() {
  const G = ensure6(), ds = deb();
  const cards = G.list.map(g => {
    const els = ds.filter(m => (m[g.sk] || 0) >= g.req - 10).sort((a, b) => (b[g.sk] || 0) - (a[g.sk] || 0)).slice(0, 4);
    return `<div class="rounded-2xl border ${g.done ? 'border-white/5 opacity-50' : 'border-white/10'} bg-black/30 p-3 space-y-1.5"><div class="flex justify-between text-xs"><b class="text-white">${g.ic} ${g.n}</b><span class="text-emerald-300">¥${g.pay}万 · 粉丝+${g.fan}</span></div>
      <div class="text-[10px] text-slate-400">要求 ${SK[g.sk]} ≥ ${g.req}（低于要求 10 以内也可尝试，但容易失常）</div>
      ${g.done ? '<div class="text-[11px] text-slate-500">本周已完成</div>' : els.length ? `<div class="flex flex-wrap gap-1.5">${els.map(m => `<button onclick="S6.gig(${g.id},${m.uid})" class="glass-pill px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-200">${nm(m)} ${SK[g.sk]}${m[g.sk] || 0} · 体力${Math.round(stam(m))}</button>`).join('')}</div>` : '<div class="text-[11px] text-rose-300">没有合适的出道成员</div>'}</div>`;
  }).join('');
  return `<div class="glass-panel rounded-3xl p-5 space-y-3"><div class="flex justify-between items-center"><h3 class="text-sm font-black text-white">📺 本周通告</h3><span class="text-[11px] text-slate-400">每次消耗 1 AP · 体力 -15（当前 AP ${state.ap}）</span></div><div class="grid grid-cols-1 md:grid-cols-2 gap-2">${cards}</div></div>`;
}
function tourHtml() {
  if (!state.groups.length) return '<div class="glass-panel rounded-3xl p-5 text-xs text-slate-400">还没有出道女团，先去出道一个吧。</div>';
  const g = curG(), tabs = state.groups.map((x, i) => `<button onclick="S6.sel(${i})" class="px-3 py-1 rounded-full text-[11px] font-black ${x === g ? 'btn-luxury text-white' : 'glass-pill text-slate-300'}">${x.name}</button>`).join('');
  let body;
  if (g.tour) {
    const t = g.tour, T = TOURS[t.key];
    body = `<div class="text-xs text-white font-black">${T.n}进行中 · 第 ${t.i + 1}/${T.cities.length} 站：${T.cities[t.i]}</div><div class="text-[11px] text-slate-400">每次「进入下一周」演出一站。已收票房 ¥${t.rev}万 · 成员体力 ${Math.round(avgSt(g))}</div>${t.log.map(l => `<div class="text-[10px] text-slate-300">${l}</div>`).join('')}`;
  } else {
    body = Object.entries(TOURS).map(([k, T]) => { const ok = g.fans >= T.need; return `<div class="rounded-2xl border ${ok ? 'border-white/10' : 'border-white/5 opacity-60'} bg-black/30 p-3 space-y-1.5"><div class="flex justify-between text-xs"><b class="text-white">${T.n}（${T.cities.length} 站）</b><span class="text-rose-300">筹备费 ¥${T.cost}万</span></div>
      <div class="text-[10px] text-slate-400">${T.cities.join(' → ')} · 需团粉 ${fmt(T.need)}${ok ? '' : '（还差 ' + fmt(T.need - g.fans) + '）'}</div>
      ${ok ? `<div class="flex flex-wrap gap-1.5">${Object.entries(PRICE).map(([p, P]) => `<button onclick="S6.tour('${k}','${p}')" class="btn-luxury px-3 py-1 rounded-full text-[10px] font-black text-white">${P[0]}</button>`).join('')}</div>` : ''}</div>`; }).join('');
  }
  const h = (g.tourHist || []).map(x => `${x.d} ${x.n} 票房¥${x.rev}万（净${x.net >= 0 ? '+' : ''}${x.net}）`).join('<br>');
  return `<div class="glass-panel rounded-3xl p-5 space-y-3"><div class="flex flex-wrap justify-between items-center gap-2"><h3 class="text-sm font-black text-white">🎤 巡演与演唱会</h3><div class="flex gap-1.5">${tabs}</div></div>${body}
    <p class="text-[10px] text-slate-500">票价越高单场收入越多但上座率下降；团粉越多、体力越足上座率越高。巡演期间每周成员体力 -8，注意休息。${h ? '<br>历史：<br>' + h : ''}</p></div>`;
}
const _rc = renderCurrentTab;
renderCurrentTab = function () { if (currentTab === 'gig') $$('mainContent').innerHTML = `<div class="space-y-4 pb-24">${tourHtml()}${gigHtml()}</div>`; else _rc(); };
const _ug = updateGlobalUI;
updateGlobalUI = function () {
  _ug(); const on = currentTab === 'gig';
  ['desk-nav-gig', 'mob-nav-gig'].forEach(id => { const e = $$(id); if (e) { e.classList.toggle('bg-white/10', on); e.style.color = on ? '#fff' : ''; } });
};
(function addNav() {
  const dt = $$('desk-nav-trends'), mt = $$('mob-nav-trends');
  if (dt && !$$('desk-nav-gig')) { const c = dt.cloneNode(true); c.id = 'desk-nav-gig'; c.setAttribute('onclick', "switchTab('gig')"); c.innerHTML = '<span class="flex items-center gap-3"><i class="fa-solid fa-microphone-lines text-sm w-4 text-center"></i>通告·巡演</span>'; dt.parentNode.insertBefore(c, dt); }
  if (mt && !$$('mob-nav-gig')) { const c = mt.cloneNode(true); c.id = 'mob-nav-gig'; c.setAttribute('onclick', "switchTab('gig')"); c.innerHTML = '<i class="fa-solid fa-microphone-lines text-xs mb-0.5"></i><span class="text-[10px] font-bold">通告</span>'; mt.parentNode.insertBefore(c, mt); mt.parentNode.className = mt.parentNode.className.replace(/grid-cols-(\d)/, (s, n) => 'grid-cols-' + (+n + 1)); }
})();

window.S6 = { gig: sendGig, tour: startTour, sel: i => { GSEL = i; renderCurrentTab(); } };
ensure6(); updateGlobalUI(); renderCurrentTab();
})();
