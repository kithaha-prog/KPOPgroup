/********************************************************************
 * systems.js —— 艺人经营扩展（v2）
 * ------------------------------------------------------------------
 *  · 艺人经营页：只保留「合约」，支持谈判（年限 / 分成 / 签约金）
 *  · 每位艺人都有个人粉丝数；档案弹窗里可打开「关系网」
 *  · 单飞活动、粉丝运营：移到「女团运营」详情页的独立分页
 *  · 所有新数据存在 state 里，随存档保存
 ********************************************************************/
(function () {
const $$ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const rnd = a => a[Math.floor(Math.random() * a.length)];
const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const absWk = () => { const [y, m, d] = state.dateStr.split('-').map(Number); return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 604800000); };
const relKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const deb = () => state.groups.flatMap(g => g.members);
const grpOf = p => state.groups.find(g => g.id === p.groupId);
const byUid = uid => state.trainees.find(t => t.uid === uid);
const SEG = { casual: '路人粉', solo: '唯粉', group: '团粉', career: '事业粉' };
const fmtF = n => formatFans(Math.round(n));
let EVQ = [], CUR = null, ctFilter = 'all', NG = null;

/* ---------- 数据迁移 / 补默认值 ---------- */
const wt = m => 20 + (m.pop == null ? 20 : m.pop);
function ensureAll() {
  const now = absWk();
  state.rel = state.rel || {};
  // 存档读回后 g.members 与 state.trainees 会变成两份拷贝，这里重新指向同一个对象
  state.groups.forEach(g => { g.members = g.members.map(m => state.trainees.find(t => t.uid === m.uid) || m); });
  const all = [...state.trainees, ...deb()];
  all.forEach(p => {
    if (p.mood == null) p.mood = clamp(100 - (p.stress || 20) - 10);
    if (p.pop == null) p.pop = clamp(Math.round(((p.visual || 70) + (p.charisma || 70)) / 2 - 45), 5, 60);
    if (p.grudge == null) p.grudge = 0;
    if (p.solo == null) p.solo = 0;
    if (p.injured == null) p.injured = 0;
    if (!p.contract) p.contract = { until: now + 104, share: p.status === 'debuted' ? 20 : 15 };
  });
  state.groups.forEach(g => {
    if (!g.seg) g.seg = { casual: 50, solo: 20, group: 20, career: 10 };
    if (!g.fcolor) g.fcolor = '#f43f5e';
    g.members.forEach((a, i) => g.members.slice(i + 1).forEach(b => { const k = relKey(a.uid, b.uid); if (state.rel[k] == null) state.rel[k] = 30; }));
    // 个人粉丝：出道成员按人气瓜分团粉的 85%，其余 15% 是只认团的粉丝
    const need = g.members.filter(m => m.fans == null);
    if (need.length) { const tot = g.members.reduce((s, m) => s + wt(m), 0); need.forEach(m => { m.fans = Math.round(g.fans * 0.85 * wt(m) / tot); }); }
    if (g._fs == null) g._fs = g.fans;
  });
  state.trainees.forEach(p => { if (p.fans == null) p.fans = Math.round(400 + p.pop * p.pop * 1.2 + R(0, 1500)); });
}
/* 团体粉丝变化（来自原版各种活动）自动按人气分摊给成员 */
function syncFans() {
  state.groups.forEach(g => {
    if (g._fs == null) { g._fs = g.fans; return; }
    const d = g.fans - g._fs; if (!d) return;
    const ms = g.members.filter(m => m.fans != null);
    if (d > 0 && ms.length) { const tot = ms.reduce((s, m) => s + wt(m), 0); ms.forEach(m => { m.fans += Math.round(d * 0.85 * wt(m) / tot); }); }
    else if (d < 0 && g._fs > 0) { const r = g.fans / g._fs; ms.forEach(m => { m.fans = Math.max(0, Math.round(m.fans * r)); }); }
    g._fs = g.fans;
  });
}
function bump(g, key, d) {
  const s = g.seg; s[key] = Math.max(2, s[key] + d);
  const t = Object.values(s).reduce((a, b) => a + b, 0);
  Object.keys(s).forEach(k => s[k] = Math.round(s[k] / t * 100));
}
function depart(p, why) {
  const g = grpOf(p);
  if (g) { g.members = g.members.filter(m => m.uid !== p.uid); if (!g.members.length) { state.groups = state.groups.filter(x => x.id !== g.id); if (state.activeGroupId === g.id) state.activeGroupId = state.groups[0]?.id || null; } }
  state.trainees = state.trainees.filter(t => t.uid !== p.uid);
  if (state.debutDraft) state.debutDraft.selectedUids = (state.debutDraft.selectedUids || []).filter(u => u !== p.uid);
  if (state.selectedTraineeUid === p.uid) state.selectedTraineeUid = state.trainees[0]?.uid || null;
  addTrendPost(why, '爆 640万', '热议');
}

/* ---------- 关系网：全公司任意两人都有亲密度 ---------- */
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
function relVal(a, b) {
  const k = relKey(a.uid, b.uid);
  if (state.rel[k] == null) state.rel[k] = (a.groupId && a.groupId === b.groupId) ? 30 : 6 + hash(k) % 20;
  return state.rel[k];
}
const TIERS = [[85, '灵魂搭档', '#f472b6'], [70, '挚友', '#fb7185'], [50, '好友', '#c084fc'], [30, '熟络', '#60a5fa'], [15, '点头之交', '#94a3b8'], [0, '陌生', '#64748b']];
const tierOf = v => TIERS.find(t => v >= t[0]);
const pairs = g => g.members.flatMap((a, i) => g.members.slice(i + 1).map(b => ({ a, b, v: relVal(a, b) })));
const addRel = (g, uids, d) => pairs(g).forEach(({ a, b }) => { if (!uids || (uids.includes(a.uid) && uids.includes(b.uid))) { const k = relKey(a.uid, b.uid); state.rel[k] = clamp(state.rel[k] + d); } });
const refresh = () => { saveState(); updateGlobalUI(); renderCurrentTab(); };
const needAp = () => { if (state.ap < 1) { playSound('warn'); showToast('⚡ 本周行动力(AP)已用尽！', 'warn'); return false; } return true; };
const cost = c => { if (state.funds < c) { playSound('warn'); showToast(`💰 资金不足 ¥${c}万！`, 'warn'); return false; } return true; };

/* ---------- 随机事件 ---------- */
const EV = [
  () => { const m = rnd(deb()); if (!m) return; return { t: '💔 恋爱传闻', b: `路透爆出 ${m.stageName} 与某男演员深夜同框，社交平台瞬间发酵。`, c: [
    { t: '发布澄清声明（-¥15万）', f: () => { state.funds -= 15; m.pop = clamp(m.pop - 2); m.mood = clamp(m.mood - 5); return `声明发出，风波平息，${m.stageName} 情绪有点低落。`; } },
    { t: '保持沉默', f: () => { m.pop = clamp(m.pop - 8); const g = grpOf(m); if (g) g.fans = Math.round(g.fans * 0.97); return '沉默被解读为默认，唯粉脱粉，人气下滑。'; } },
    { t: '强硬反击谣言（赌一把）', f: () => { if (Math.random() < 0.6) { m.pop = clamp(m.pop + 6); return `证据确凿，${m.stageName} 洗白反而圈粉！人气 +6`; } m.pop = clamp(m.pop - 14); state.reputation -= 10; return '翻车了！反击被扒出漏洞，口碑受损。'; } }] }; },
  () => { const ts = state.trainees.filter(t => t.mood < 55 || Math.random() < 0.3); const m = rnd(ts); if (!m) return; return { t: '😢 想要离开', b: `${m.stageName} 找到你，说压力太大，想考虑退出公司。（心情 ${m.mood}）`, c: [
    { t: '深入谈心（-¥10万）', f: () => { state.funds -= 10; m.mood = clamp(m.mood + 22); m.grudge = Math.max(0, m.grudge - 15); return `${m.stageName} 重新振作起来。`; } },
    { t: '涨分成挽留（分成+5%）', f: () => { m.contract.share += 5; m.mood = clamp(m.mood + 12); return `${m.stageName} 留下了，今后分成变为 ${m.contract.share}%。`; } },
    { t: '尊重她的决定', f: () => { depart(m, `📰 ${m.stageName} 宣布与 ${state.agencyName} 解约，粉丝一片哗然。`); return `${m.stageName} 离开了公司。`; } }] }; },
  () => { const g = rnd(state.groups); if (!g) return; return { t: '🎬 综艺邀约', b: `热门综艺向 ${g.name} 发出嘉宾邀请，档期很满。`, c: [
    { t: '接受（体力-15）', f: () => { const pay = 20 + Math.round(state.reputation * 0.05); state.funds += pay; g.members.forEach(m => { m.stamina = clamp(m.stamina - 15); m.pop = clamp(m.pop + 5); }); const f = R(1500, 4000); g.fans += f; state.totalFans += f; return `名场面出圈！+¥${pay}万，吸粉 ${f}。`; } },
    { t: '婉拒', f: () => { g.members.forEach(m => m.mood = clamp(m.mood + 3)); return '大家获得了难得的休息。'; } }] }; },
  () => { const g = rnd(state.groups); if (!g) return; return { t: '👿 黑粉造谣', b: `有人散布 ${g.name} 成员"耍大牌"的捏造视频，热度还在上升。`, c: [
    { t: '法务介入（-¥20万）', f: () => { state.funds -= 20; state.reputation += 6; return '法务函发出，造谣者道歉，口碑回升。'; } },
    { t: '无视冷处理', f: () => { g.fans = Math.round(g.fans * 0.98); g.members.forEach(m => m.mood = clamp(m.mood - 6)); return '谣言发酵，成员们心情低落。'; } }] }; },
  () => { const m = rnd(deb()); if (!m) return; return { t: '🩹 成员受伤', b: `${m.stageName} 练习时扭伤脚踝，但行程表还排着一场商演。`, c: [
    { t: '全力休养（-¥8万）', f: () => { state.funds -= 8; m.injured = 2; m.stamina = clamp(m.stamina + 20); m.mood = clamp(m.mood + 4); return `${m.stageName} 休养两周。`; } },
    { t: '带伤出战（+¥25万）', f: () => { state.funds += 25; m.injured = 4; m.stamina = clamp(m.stamina - 30); m.mood = clamp(m.mood - 12); m.pop = clamp(m.pop + 4); return '演出顺利，但伤势拖得更久，她心里有委屈。'; } }] }; },
  () => { const m = rnd(deb()); if (!m) return; return { t: '🎂 生日应援', b: `${m.stageName} 的生日到了，粉丝在首尔地铁站挂满了应援广告！`, c: [
    { t: '亲自写信回应', f: () => { m.mood = clamp(m.mood + 12); m.pop = clamp(m.pop + 3); const g = grpOf(m); if (g) bump(g, 'solo', 3); return `${m.stageName} 感动落泪，唯粉更粘了。`; } },
    { t: '安排直播庆生（+¥12万）', f: () => { state.funds += 12; m.mood = clamp(m.mood + 6); const g = grpOf(m); if (g) { g.fans += 1500; state.totalFans += 1500; } return '直播同时在线破纪录。'; } }] }; }
];
function rollEvent() { const arr = [...EV].sort(() => Math.random() - .5); for (const f of arr) { const e = f(); if (e) return EVQ.push(e); } }
function pump() {
  if (CUR || !EVQ.length) return;
  if (!$$('modalOverlay').classList.contains('hidden')) return setTimeout(pump, 800);
  CUR = EVQ.shift();
  $$('modalBox').innerHTML = `<div class="space-y-3"><h3 class="text-base font-black text-white">${CUR.t}</h3><p class="text-xs text-slate-300 leading-relaxed">${CUR.b}</p>` +
    CUR.c.map((c, i) => `<button onclick="SYS.pick(${i})" class="btn-luxury w-full py-2.5 rounded-2xl text-xs font-black text-white">${c.t}</button>`).join('') + '</div>';
  $$('modalOverlay').classList.remove('hidden'); playSound('click');
}

/* ---------- 合约 ---------- */
function contractCheck() {
  const now = absWk();
  [...state.trainees].forEach(p => {
    const left = p.contract.until - now;
    if (left <= 8 && left > 0 && !p.warned) { p.warned = 1; showToast(`📑 ${p.stageName} 的合约还剩 ${left} 周，请到「艺人经营」谈判续约`, 'warn'); }
    if (left > 8) p.warned = 0;
    if (left <= 0) {
      if (p.mood < 30 && Math.random() < 0.4 || left <= -4) { depart(p, `🚨 ${p.stageName} 合约到期后被竞争公司高价挖走！`); showToast(`💔 ${p.stageName} 离开了公司`, 'warn'); return; }
      if (!EVQ.some(e => e.uid === p.uid) && !(CUR && CUR.uid === p.uid) && !(NG && NG.uid === p.uid)) EVQ.push(negotiation(p));
    }
  });
}
function renewCost(p) { return Math.round(20 + p.pop * 0.8 + (p.potential === 'UR' ? 30 : p.potential === 'SSR' ? 15 : 0)); }
const weeklyPay = (p, share) => p.status === 'debuted' ? Math.max(0, (share - 15) * (0.25 + p.pop / 200)) : 0;
function negotiation(p) { return { uid: p.uid, t: `📑 ${p.stageName} 合约到期`, b: `${p.stageName} 的合约已到期（心情 ${p.mood}，人气 ${p.pop}，现分成 ${p.contract.share}%），竞争公司也在接触她。坐下来谈，还是放手？`, c: [
  { t: '🤝 坐下来谈判', f: () => { setTimeout(() => openNego(p.uid, true), 120); return `${p.stageName} 走进了会议室。`; } },
  { t: '放手', f: () => { depart(p, `📰 ${p.stageName} 合约期满离开 ${state.agencyName}。`); return `${p.stageName} 离开了。`; } }] }; }

/* ---------- 合约谈判 ---------- */
// 艺人的心理价位：人气/粉丝/潜力越高要得越多；心情差的人想要更短的合约
function wantOf(p) {
  const potB = { UR: 6, SSR: 3 }[p.potential] || 0;
  let share = 14 + p.pop * 0.28 + potB + Math.min(8, (p.fans || 0) / 40000) + (p.status === 'debuted' ? 4 : 0) + (p.grudge >= 40 ? 3 : 0) - (p.mood - 50) * 0.08;
  return { share: clamp(Math.round(share), 12, 55), years: p.mood >= 75 ? 4 : p.mood >= 55 ? 3 : p.mood >= 35 ? 2 : 1, bonus: renewCost(p) };
}
function evalOffer(p, o) {
  const w = wantOf(p);
  const a = (o.share - w.share) * 3;
  const b = (o.bonus - w.bonus) / Math.max(10, w.bonus) * 12;
  const dy = o.years - w.years;
  const c = dy > 0 ? -dy * (p.mood < 55 ? 8 : 3) : dy * 1.2;
  const d = (p.mood - 50) * 0.25 - (p.grudge || 0) * 0.15;
  return { sc: a + b + c + d, parts: { share: a, bonus: b, years: c }, w };
}
function openNego(uid, expired) {
  const p = byUid(uid); if (!p) return; ensureAll();
  const now = absWk();
  if (!expired && p.negoLock > now) { playSound('warn'); return showToast(`😒 ${p.stageName} 刚谈崩，还需冷静 ${p.negoLock - now} 周再谈`, 'warn'); }
  const w = wantOf(p);
  NG = { uid, expired: !!expired, rounds: 4, years: 3, share: p.contract.share, bonus: w.bonus, msg: '', counter: null, done: false };
  renderNego(); $$('modalOverlay').classList.remove('hidden'); playSound('click');
}
function renderNego() {
  const p = byUid(NG.uid); if (!p) return;
  const left = p.contract.until - absWk(), maxB = Math.max(60, renewCost(p) * 3);
  const chip = (l, v, c = 'text-white') => `<span class="px-2 py-1 rounded-lg glass-pill text-[10px] text-slate-400">${l} <b class="${c}">${v}</b></span>`;
  const slider = (k, label, min, max, step, unit) => `<div><div class="flex justify-between text-[11px] text-slate-300 mb-1"><span>${label}</span><b id="ngv_${k}" class="text-amber-200">${NG[k]}${unit}</b></div><input type="range" min="${min}" max="${max}" step="${step}" value="${NG[k]}" ${NG.done ? 'disabled' : ''} oninput="SYS.ng('${k}',this.value)" class="w-full accent-pink-500"></div>`;
  const cnt = NG.counter;
  $$('modalBox').innerHTML = `<div class="space-y-3">
    <div class="flex items-center justify-between"><h3 class="text-base font-black text-white">📑 合约谈判 · ${p.stageName}</h3><button onclick="closeModal()" class="w-8 h-8 rounded-full glass-pill text-slate-300 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="flex flex-wrap gap-1.5">${chip('心情', p.mood, p.mood < 35 ? 'text-rose-300' : 'text-emerald-300')}${chip('人气', p.pop)}${chip('粉丝', fmtF(p.fans || 0))}${chip('现分成', p.contract.share + '%')}${chip('剩余', left > 0 ? left + '周' : '已到期', left <= 8 ? 'text-rose-300' : 'text-white')}${chip('潜力', p.potential || '-')}</div>
    <div class="glass-pill rounded-2xl p-3 space-y-3">
      ${slider('years', '合约长度', 1, 5, 1, ' 年')}
      ${slider('share', '艺人分成', 5, 60, 1, '%')}
      ${slider('bonus', '一次性签约金', 0, maxB, 1, ' 万')}
      <div id="ngCost" class="text-[10px] text-slate-400"></div>
    </div>
    <div class="rounded-2xl border ${NG.done ? 'border-rose-400/40' : 'border-white/10'} bg-black/30 p-3 text-xs text-slate-200 leading-relaxed min-h-[52px]">${NG.msg || `${p.stageName} 看着你，等你开价。<br><span class="text-slate-500">提示：心情好的艺人愿意签更久；人气和粉丝越高，要的分成越高；签约金可以弥补分成的差距。</span>`}</div>
    ${cnt ? `<button onclick="SYS.ngAccept()" class="w-full py-2 rounded-2xl glass-pill border border-emerald-400/40 text-[11px] font-black text-emerald-200">✅ 接受她的还价：${cnt.years}年 · 分成${cnt.share}% · 签约金¥${cnt.bonus}万</button>` : ''}
    <div class="flex items-center gap-2"><span class="text-[10px] text-slate-400">剩余谈判机会 <b class="text-white">${NG.rounds}</b>/4</span>
      <button onclick="closeModal()" class="ml-auto px-4 py-2 rounded-2xl glass-pill text-[11px] font-black text-slate-200">${NG.done ? '关闭' : '放弃谈判'}</button>
      ${NG.done ? '' : '<button onclick="SYS.ngSubmit()" class="btn-luxury px-5 py-2 rounded-2xl text-[11px] font-black text-white">提交方案</button>'}</div>
  </div>`;
  ngCost();
}
function ngCost() {
  const e = $$('ngCost'), p = NG && byUid(NG.uid); if (!e || !p) return;
  const wk = weeklyPay(p, NG.share);
  e.innerHTML = p.status === 'debuted' ? `预计每周分成支出 ≈ <b class="text-slate-200">¥${wk.toFixed(1)}万</b>，整份合约共约 ¥${(wk * 52 * NG.years + NG.bonus).toFixed(0)}万（含签约金）` : '练习生阶段不产生分成支出，出道后按分成结算。';
}
function ngSet(k, v) {
  if (!NG || NG.done) return; NG[k] = +v;
  const u = { years: ' 年', share: '%', bonus: ' 万' }[k], e = $$('ngv_' + k); if (e) e.textContent = NG[k] + u; ngCost();
}
function signDeal(p, o) {
  const now = absWk(), w = wantOf(p);
  state.funds -= o.bonus;
  p.contract.share = o.share;
  p.contract.until = Math.min(Math.max(p.contract.until, now) + o.years * 52, now + 312);
  p.mood = clamp(p.mood + 6 + (o.share >= w.share ? 3 : 0) + Math.min(6, Math.round(o.bonus / Math.max(10, w.bonus) * 2)));
  p.grudge = Math.max(0, (p.grudge || 0) - 5); p.warned = 0; p.negoLock = 0;
  playSound('success'); showToast(`📑 ${p.stageName} 续约 ${o.years} 年，分成 ${o.share}%${o.bonus ? '，签约金 ¥' + o.bonus + '万' : ''}`, 'success');
  NG = null; closeModal(); refresh();
}
function ngSubmit() {
  if (!NG || NG.done) return; const p = byUid(NG.uid); if (!p) return;
  const o = { years: NG.years, share: NG.share, bonus: NG.bonus };
  if (state.funds < o.bonus) { playSound('warn'); return showToast(`💰 资金不足，签约金需 ¥${o.bonus}万`, 'warn'); }
  const r = evalOffer(p, o);
  if (r.sc >= 0) return signDeal(p, o);
  NG.rounds--; NG.counter = null;
  const worst = Object.entries(r.parts).sort((x, y) => x[1] - y[1])[0][0], hint = { share: '分成', bonus: '签约金', years: '合约长度' }[worst];
  if (r.sc >= -12) {
    const need = -r.sc; let c = { ...o };
    const ds = Math.ceil(need / 3);
    if (o.share + ds <= 60) c.share = o.share + ds; else c.bonus = o.bonus + Math.ceil(need / 12 * Math.max(10, r.w.bonus));
    NG.counter = c;
    NG.msg = `😐 「差一点点……」她对<b>${hint}</b>还不太满意，提出了还价。`;
  } else if (r.sc >= -30) NG.msg = `😠 「这个条件没有诚意。」她似乎特别在意<b>${hint}</b>。`;
  else { NG.msg = `😡 「你是在开玩笑吗？」她差点起身离开。`; p.mood = clamp(p.mood - 3); }
  if (NG.rounds <= 0 && !NG.counter) {
    NG.done = true; p.mood = clamp(p.mood - 8); p.negoLock = absWk() + (NG.expired ? 1 : 3);
    NG.msg += `<br><b class="text-rose-300">谈判破裂。</b>${NG.expired ? '她的合约已经到期，再不谈拢她就会被挖走！下周还可以再谈一次。' : '她需要冷静几周。'}`;
  }
  playSound('warn'); saveState(); renderNego();
}
function ngAccept() {
  if (!NG || !NG.counter) return; const p = byUid(NG.uid), c = NG.counter;
  if (state.funds < c.bonus) { playSound('warn'); return showToast(`💰 资金不足，签约金需 ¥${c.bonus}万`, 'warn'); }
  signDeal(p, c);
}

/* ---------- 每周结算 ---------- */
function weeklyTick() {
  ensureAll();
  let pay = 0;
  state.trainees.forEach(p => {
    p.mood = clamp(p.mood + (p.mood < 60 ? 3 : -1) - (p.grudge >= 40 ? 3 : 0));
    p.grudge = Math.max(0, p.grudge - 2);
    if (p.pop > 40) p.pop -= 1;
    if (p.injured > 0) { p.injured--; p.stamina = Math.min(p.stamina, 45); }
    pay += weeklyPay(p, p.contract.share);
    if (p.status !== 'debuted') p.fans += Math.round(p.fans * 0.004 * (p.pop / 40) + R(0, 30));
  });
  state.funds -= pay;
  state.groups.forEach(g => {
    addRel(g, null, 1);
    const ps = pairs(g); const avg = ps.length ? ps.reduce((a, x) => a + x.v, 0) / ps.length : 50;
    g.synergy = clamp(g.synergy + Math.round((avg - 50) / 25));
    g.fans += Math.round(g.fans * g.seg.casual / 100 * 0.004);
    state.funds += g.fans * g.seg.career / 100 / 6000;
    g.members.forEach(m => { if (m.grudge >= 70) { m.mood = clamp(m.mood - 6); addRel(g, null, -1); } });
  });
  // 不同团/练习生之间的关系也会慢慢升温
  Object.keys(state.rel).forEach(k => {
    const [x, y] = k.split('|'), A = byUid(x), B = byUid(y);
    if (!A || !B) { delete state.rel[k]; return; }
    if (A.groupId && A.groupId === B.groupId) return;
    if (state.rel[k] < 45 && Math.random() < 0.08) state.rel[k]++;
  });
  syncFans();
  contractCheck();
  if (Math.random() < 0.5) rollEvent();
  pump(); saveState();
}
function afterSchedule(g, type) {
  const M = { practice: [-4, 0], variety: [-2, 4], cf: [-3, 3], fansign: [3, 1], tour: [-5, 6], vacation: [25, 0] }[type] || [0, 0];
  g.members.forEach(m => { m.mood = clamp(m.mood + M[0]); m.pop = clamp(m.pop + M[1]); if (type === 'vacation') m.grudge = Math.max(0, m.grudge - 15); });
  addRel(g, null, type === 'vacation' ? 4 : 3);
  if (type === 'variety') bump(g, 'casual', 3); if (type === 'cf') bump(g, 'career', 3); if (type === 'fansign') bump(g, 'group', 3);
  if (type !== 'vacation' && g.members.some(m => m.stamina < 30) && Math.random() < 0.15) { const e = EV[4](); if (e) { EVQ.push(e); pump(); } }
  refresh();
}

/* ---------- 单飞 / CP / 恳谈 / 粉丝活动 ---------- */
const SOLO = {
  ost: ['🎧 OST', m => { const g = R(14, 22) + Math.round(m.vocal / 8); state.funds += g; m.stamina = clamp(m.stamina - 8); m.pop = clamp(m.pop + 4); return [`${m.stageName} 的OST登上榜单，+¥${g}万`, R(800, 2000)]; }],
  show: ['📺 固定综艺', m => { const g = R(16, 28); state.funds += g; m.stamina = clamp(m.stamina - 12); m.pop = clamp(m.pop + 5); return [`${m.stageName} 成为综艺新宠，+¥${g}万`, R(1500, 3500)]; }],
  album: ['💿 Solo专辑(-¥25万)', m => { if (!cost(25)) return null; state.funds -= 25; const g = Math.round(m.vocal / 3 + m.pop * 0.9 + R(0, 25)); state.funds += g; m.stamina = clamp(m.stamina - 18); m.pop = clamp(m.pop + 8); return [`${m.stageName} 的Solo专辑回收 ¥${g}万！`, R(2500, 6000) + m.pop * 40]; }],
  cf: ['💎 个人代言', m => { const g = Math.round(12 + m.visual / 3 + m.pop * 0.5); state.funds += g; m.stamina = clamp(m.stamina - 10); m.pop = clamp(m.pop + 5); return [`${m.stageName} 拿下代言，+¥${g}万`, R(1000, 2500)]; }]
};
function solo(uid, k) {
  const m = byUid(uid), g = m && grpOf(m); if (!m || !g || !needAp()) return;
  if (m.stamina < 20) { playSound('warn'); return showToast('体力不足，先休息！', 'warn'); }
  const r = SOLO[k][1](m); if (!r) return;
  const [msg, f] = r;
  state.ap--; m.solo++; m.mood = clamp(m.mood - 2);
  m.fans = (m.fans || 0) + f; g.fans += Math.round(f * 0.3); g._fs = g.fans; state.totalFans += f;   // 个人粉丝全记在她身上，团粉蹭 30%
  bump(g, 'solo', 2);
  g.members.forEach(o => { if (o.uid !== m.uid && m.solo > o.solo + 1) { o.grudge = clamp(o.grudge + 4); const kk = relKey(o.uid, m.uid); state.rel[kk] = clamp(state.rel[kk] - 2); } });
  playSound('success'); showToast(`🌟 ${msg}，个人粉丝 +${fmtF(f)}`, 'success'); refresh();
}
function cp(a, b) {
  if (!needAp()) return; const A = byUid(a), B = byUid(b), g = grpOf(A);
  const f = R(1500, 4000); g.fans += f; state.totalFans += f; bump(g, 'solo', 2);
  const k = relKey(a, b); state.rel[k] = clamp(state.rel[k] + 6); state.ap--; A.pop = clamp(A.pop + 3); B.pop = clamp(B.pop + 3);
  addTrendPost(`💞 ${A.stageName} × ${B.stageName} 合照营业炸了，CP粉狂欢！`, '爆 520万', '爆'); playSound('fanfare'); showToast(`💞 CP营业成功，吸粉 ${f}！`, 'gold'); refresh();
}
function talk(uid) { const m = byUid(uid); if (!needAp() || !cost(5)) return; state.ap--; state.funds -= 5; m.mood = clamp(m.mood + 20); m.grudge = Math.max(0, m.grudge - 30); showToast(`🤝 与 ${m.stageName} 恳谈后，她轻松多了`, 'info'); refresh(); }
function fanEvt(k) {
  const g = getActiveGroup(); if (!g) return;
  if (k === 'ad') { if (!cost(30)) return; state.funds -= 30; const f = 1500 + state.reputation * 6; g.fans += f; state.totalFans += f; state.reputation += 8; bump(g, 'casual', 4); showToast(`🚇 地铁广告投放！吸粉 +${f}`, 'success'); }
  if (k === 'meet') { if (!needAp() || !cost(12)) return; state.ap--; state.funds -= 12; const f = 1200 + state.reputation * 4; g.fans += f; state.totalFans += f; g.members.forEach(m => m.mood = clamp(m.mood + 8)); bump(g, 'group', 4); bump(g, 'solo', 2); g.synergy = clamp(g.synergy + 2); showToast(`💝 粉丝见面会圆满！全员心情+8，吸粉 +${f}`, 'success'); }
  playSound('success'); refresh();
}

/* ---------- 钩子：包装原有函数 ---------- */
const _rgs = runGroupSchedule;
runGroupSchedule = function (type) {
  const g = getActiveGroup(); ensureAll();
  if (g && type !== 'vacation' && g.members.some(m => m.mood < 20)) { playSound('warn'); return showToast('😞 有成员心情跌到谷底，先团建或恳谈！', 'warn'); }
  const ap = state.ap; _rgs(type); if (g && state.ap < ap) afterSchedule(g, type);
};
const _lgc = launchGroupComeback;
launchGroupComeback = function () {
  const g = getActiveGroup(), had = g && g.activeComeback, c = state.comebackDraft && state.comebackDraft.centerUid; ensureAll();
  _lgc();
  if (g && !had && g.activeComeback) {
    g.members.forEach(m => { if (m.uid === c) { m.pop = clamp(m.pop + 8); m.mood = clamp(m.mood + 5); } else m.grudge = clamp(m.grudge + 5); });
    addRel(g, null, 2); bump(g, 'career', 2); refresh();
  }
};
const _adv = advanceNextWeek;
advanceNextWeek = function () { const d = state.dateStr; _adv(); if (state.dateStr !== d) { weeklyTick(); updateGlobalUI(); renderCurrentTab(); } };
const _cm = closeModal;
closeModal = function () { if (CUR) CUR = null; if (NG) NG = null; _cm(); setTimeout(pump, 300); };
const _rt = renderCurrentTab;
renderCurrentTab = function () {
  if (currentTab === 'mgmt') {
    ensureAll(); syncFans();
    const m = $$('mainContent'), st = m.scrollTop;
    m.innerHTML = renderMgmt();
    // 修复：fitPage 在 k_pop.html 闭包里，这里调不到，上一个页面留下的 overflow:hidden 会让本页滑不动
    m.classList.add('noscroll'); m.style.overflowY = 'auto'; m.scrollTop = st;
  } else _rt();
};
const _ug = updateGlobalUI;
updateGlobalUI = function () { try { ensureAll(); syncFans(); } catch (e) {} _ug(); const on = currentTab === 'mgmt'; ['desk-nav-mgmt', 'mob-nav-mgmt'].forEach(i => { const e = $$(i); if (e) { e.classList.toggle('bg-white/10', on); e.style.color = on && i[0] === 'd' ? '#fff' : ''; } }); };

/* ---------- 通用小组件 ---------- */
const bar = (v, c, style = '') => `<div class="h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full ${c}" style="width:${clamp(v)}%;${style}"></div></div>`;
const card = h => `<div class="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2">${h}</div>`;
const B = 'btn-luxury px-3 py-1.5 rounded-xl text-[11px] font-black text-white';

/* ---------- 「艺人经营」页面：只有合约 ---------- */
function renderMgmt() {
  const now = absWk();
  const flt = [['all', '全部'], ['soon', '即将到期'], ['debuted', '已出道'], ['trainee', '练习生']];
  const list = state.trainees.filter(p => ctFilter === 'all' || (ctFilter === 'soon' && p.contract.until - now <= 26) || (ctFilter === 'debuted' && p.status === 'debuted') || (ctFilter === 'trainee' && p.status !== 'debuted'))
    .sort((a, b) => a.contract.until - b.contract.until);
  const row = p => {
    const left = p.contract.until - now, g = grpOf(p), lock = p.negoLock > now;
    return `<div class="rounded-2xl border ${left <= 8 ? 'border-rose-400/40' : 'border-white/10'} bg-black/30 p-3 flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 text-xs"><b class="text-white truncate">${p.stageName}</b><span class="text-[10px] text-slate-400 truncate">${p.status === 'debuted' ? (g ? g.name : '已出道') : '练习生'}</span></div>
        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mt-1"><span class="${left <= 8 ? 'text-rose-300 font-bold' : 'text-slate-300'}">${left > 0 ? `剩 ${left} 周 (≈${(left / 52).toFixed(1)}年)` : '已到期'}</span><span class="text-slate-400">分成 <b class="text-slate-200">${p.contract.share}%</b></span><span class="text-slate-400">心情 <b class="${p.mood < 35 ? 'text-rose-300' : 'text-slate-200'}">${p.mood}</b></span><span class="text-slate-400">粉丝 <b class="text-slate-200">${fmtF(p.fans || 0)}</b></span></div>
      </div>
      <button onclick="SYS.nego('${p.uid}')" class="shrink-0 glass-pill px-3 py-1.5 rounded-full text-[11px] font-black ${lock ? 'text-slate-500' : 'text-amber-200'}">${lock ? '冷静中' : '🤝 谈判续约'}</button></div>`;
  };
  return `<div class="space-y-3 p-1"><div class="flex flex-wrap items-center gap-2"><h2 class="text-lg font-black text-white mr-2">📑 艺人合约</h2>${flt.map(([k, n]) => `<button onclick="SYS.flt('${k}')" class="glass-pill px-3 py-1 rounded-full text-[11px] font-bold ${ctFilter === k ? 'bg-white/20 text-white' : 'text-slate-300'}">${n}</button>`).join('')}<span class="text-[11px] text-amber-300 ml-auto">¥${state.funds.toFixed(1)}万</span></div>
    <p class="text-[10px] text-slate-400">随时可以和艺人谈判续约：自己开年限、分成、签约金；她会根据心情、人气、粉丝给出还价。新合约在现有合约基础上顺延（最长再留 6 年）。</p>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">${list.map(row).join('') || '<p class="text-xs text-slate-400">没有符合条件的艺人</p>'}</div></div>`;
}

/* ---------- 女团运营页里的新分页：单飞活动 / 粉丝运营 ---------- */
function soloSection(g) {
  return `<div id="soloBox" class="glass-panel rounded-3xl p-5 mt-4"><div class="flex flex-wrap items-center justify-between gap-2 mb-3"><h3 class="text-sm font-black text-white">🌟 ${g.name} 单飞活动</h3><span class="text-[11px] text-amber-300">AP ${state.ap}/${state.maxAp} · ¥${state.funds.toFixed(1)}万</span></div>
    <p class="text-[10px] text-slate-400 mb-3">每次消耗 1 AP。单飞的粉丝主要记在本人名下，团粉蹭 30%；某人单飞过多，其他队友会积累不满。</p>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">${g.members.map(m => card(`<div class="flex items-center gap-2 text-xs"><b class="text-white">${m.stageName}</b><span class="text-slate-400 text-[10px]">单飞${m.solo}次 · 体力${m.stamina} · 人气${m.pop} · 粉丝${fmtF(m.fans || 0)}</span>${m.injured ? '<span class="text-rose-300 text-[10px]">🩹受伤</span>' : ''}${m.grudge >= 40 ? `<span class="text-amber-300 text-[10px]">😒不满${m.grudge}</span>` : ''}</div>
      <div class="flex flex-wrap gap-1.5">${Object.keys(SOLO).map(k => `<button onclick="SYS.solo('${m.uid}','${k}')" class="glass-pill px-2.5 py-1 rounded-full text-[10px] text-slate-100">${SOLO[k][0]}</button>`).join('')}</div>`)).join('')}</div></div>`;
}
function fanSection(g) {
  const ms = [...g.members].sort((a, b) => (b.fans || 0) - (a.fans || 0)), mx = Math.max(1, ...ms.map(m => m.fans || 0));
  return `<div id="fanBox" class="glass-panel rounded-3xl p-5 mt-4"><h3 class="text-sm font-black text-white mb-3">💖 ${g.name} 粉丝运营</h3>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      ${card(`<div class="flex items-center gap-2 text-xs"><b class="text-white">${g.fandomName || ''}</b><span class="text-slate-400">总粉丝 ${formatFans(g.fans)}</span><label class="ml-auto text-[10px] text-slate-300">应援色 <input type="color" value="${g.fcolor}" onchange="SYS.color(this.value)" class="align-middle bg-transparent"></label></div>` +
        Object.keys(SEG).map(k => `<div class="text-[11px] text-slate-200 flex items-center gap-2"><span class="w-14">${SEG[k]}</span><div class="flex-1">${bar(g.seg[k], '', `background:${g.fcolor}`)}</div><span class="w-24 text-right">${g.seg[k]}% · ${formatFans(Math.round(g.fans * g.seg[k] / 100))}</span></div>`).join('') +
        `<p class="text-[10px] text-slate-400">路人粉带来自然增粉；事业粉带来被动收入；团粉/唯粉通过活动与单飞提升。</p><div class="flex flex-wrap gap-2"><button onclick="SYS.fan('ad')" class="${B}">🚇 地铁广告 ¥30万</button><button onclick="SYS.fan('meet')" class="${B}">💝 粉丝见面会 AP1 ¥12万</button></div>`)}
      ${card(`<div class="text-xs font-black text-white">成员个人粉丝榜</div>` + ms.map((m, i) => `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="w-4 text-slate-500">${i + 1}</span><span class="w-20 truncate">${m.stageName}</span><div class="flex-1">${bar((m.fans || 0) / mx * 100, '', `background:${g.fcolor}`)}</div><span class="w-14 text-right">${fmtF(m.fans || 0)}</span></div>`).join(''))}
    </div></div>`;
}
const _rg = renderGroupsTab;
renderGroupsTab = function () {
  const h = _rg();
  if (!state.groups.length || !/id="(albumsBox|honorBox)"/.test(h)) return h;
  const g = getActiveGroup(); if (!g) return h;
  ensureAll(); syncFans();
  return h + soloSection(g) + fanSection(g);
};

/* ---------- 艺人档案弹窗：粉丝 / 心情 / 合约 / 关系网入口 ---------- */
const _rps = renderProfileSide;
renderProfileSide = function (p) {
  const base = _rps(p);
  if (!p || p.status === 'candidate' || !state.trainees.some(t => t.uid === p.uid)) return base;
  ensureAll(); syncFans();
  const q = byUid(p.uid) || p, left = q.contract.until - absWk();
  const rank = [...state.trainees].sort((a, b) => (b.fans || 0) - (a.fans || 0)).findIndex(t => t.uid === q.uid) + 1;
  const b2 = (l, v, t, g) => `<div class="flex items-center gap-1.5 min-w-0"><span class="text-slate-400 shrink-0">${l}</span><div class="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden"><div class="h-full bg-gradient-to-r ${g}" style="width:${clamp(v)}%"></div></div><b class="${t} shrink-0 w-6 text-right">${v}</b></div>`;
  const chip = (l, v, c = 'text-white') => `<span class="whitespace-nowrap"><span class="text-slate-500">${l}</span> <b class="${c}">${v}</b></span>`;
  return base + `<div class="mt-2 glass-pill rounded-xl px-3 py-2 space-y-1.5 text-[11px]">
    <div class="grid grid-cols-2 gap-x-4">${b2('心情', q.mood, q.mood < 35 ? 'text-rose-300' : 'text-pink-300', 'from-pink-400 to-fuchsia-400')}${b2('人气', q.pop, 'text-amber-300', 'from-amber-300 to-orange-400')}</div>
    <div class="flex flex-wrap gap-x-3 gap-y-0.5 pt-1.5 border-t border-white/5">${chip('粉丝', fmtF(q.fans || 0), 'text-pink-300')}${chip('公司粉丝榜', '#' + rank + '/' + state.trainees.length)}${chip('合约', left > 0 ? '剩' + left + '周' : '已到期', left <= 8 ? 'text-rose-300' : 'text-white')}${chip('分成', q.contract.share + '%')}</div>
    <div class="flex flex-wrap gap-1.5 pt-1">
      <button onclick="SYS.rel('${q.uid}')" class="px-2.5 py-1 rounded-full btn-luxury text-[10px] font-black text-white">🕸️ 关系网</button>
      <button onclick="SYS.nego('${q.uid}')" class="px-2.5 py-1 rounded-full glass-pill text-[10px] font-bold text-amber-200">📑 谈判续约</button>
      ${q.status === 'debuted' ? `<button onclick="SYS.talkM('${q.uid}')" class="px-2.5 py-1 rounded-full glass-pill text-[10px] font-bold text-cyan-200">🤝 恳谈(AP1,¥5万)</button>` : ''}
    </div></div>`;
};

/* ---------- 关系网弹窗 ---------- */
function openRel(uid) {
  const p = byUid(uid); if (!p) return; ensureAll();
  const others = state.trainees.filter(o => o.uid !== uid).map(o => ({ o, v: relVal(p, o) })).sort((a, b) => b.v - a.v);
  const top = others.slice(0, 8), n = top.length, cx = 170, cy = 150, rr = 108;
  const pos = i => { const a = (-90 + i * 360 / Math.max(1, n)) * Math.PI / 180; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; };
  const svg = `<svg viewBox="0 0 340 300" class="w-full max-w-[380px] mx-auto">${top.map(({ o, v }, i) => { const [x, y] = pos(i), t = tierOf(v); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${t[2]}" stroke-opacity="${(0.25 + v / 140).toFixed(2)}" stroke-width="${(1 + v / 22).toFixed(1)}"/>`; }).join('')}
    ${top.map(({ o, v }, i) => { const [x, y] = pos(i), t = tierOf(v); return `<g style="cursor:pointer" onclick="SYS.rel('${o.uid}')"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" fill="#14141f" stroke="${t[2]}" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${v}</text><text x="${x.toFixed(1)}" y="${(y + 30).toFixed(1)}" text-anchor="middle" font-size="9" fill="#cbd5e1">${o.stageName}</text></g>`; }).join('')}
    <circle cx="${cx}" cy="${cy}" r="26" fill="#8b5cf6" stroke="#f472b6" stroke-width="2.5"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">${p.stageName.slice(0, 3)}</text></svg>`;
  const g = grpOf(p);
  $$('modalBox').innerHTML = `<div class="space-y-3">
    <div class="flex items-center justify-between gap-2"><button onclick="openProfileModal('${uid}')" class="px-3 py-1.5 rounded-xl glass-pill text-[11px] font-black text-slate-200">← 返回档案</button><h3 class="text-base font-black text-white truncate">🕸️ ${p.stageName} 的关系网</h3><button onclick="closeModal()" class="w-8 h-8 rounded-full glass-pill text-slate-300 flex items-center justify-center shrink-0"><i class="fa-solid fa-xmark"></i></button></div>
    <p class="text-[10px] text-slate-400">圆圈里的数字是亲密度（0-100），线越粗越亲密，最亲近的 ${n} 人在图上，点人物可切换视角。同团成员每周自动升温，练习生之间也会慢慢熟起来；同团且亲密度 ≥55 可以营业 CP。</p>
    ${svg}
    <div class="flex flex-wrap gap-1.5 justify-center text-[10px]">${TIERS.slice().reverse().map(t => `<span class="px-2 py-0.5 rounded-full" style="background:${t[2]}33;color:${t[2]}">${t[1]} ≥${t[0]}</span>`).join('')}</div>
    <div class="space-y-1.5 max-h-[30dvh] overflow-y-auto custom-scroll pr-1">${others.map(({ o, v }) => { const t = tierOf(v), og = grpOf(o), same = g && og && g.id === og.id;
      return `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="w-20 truncate cursor-pointer hover:underline" onclick="SYS.rel('${o.uid}')">${o.stageName}</span><span class="w-16 truncate text-[10px] text-slate-500">${og ? og.name : (o.status === 'debuted' ? '已出道' : '练习生')}</span><div class="flex-1">${bar(v, '', `background:${t[2]}`)}</div><span class="w-6 text-right">${v}</span><span class="w-14 text-[10px]" style="color:${t[2]}">${t[1]}</span>${same && v >= 55 ? `<button onclick="SYS.cpM('${uid}','${o.uid}')" class="glass-pill px-2 py-0.5 rounded-full text-[10px] text-pink-200">💞CP</button>` : '<span class="w-9"></span>'}</div>`; }).join('') || '<p class="text-xs text-slate-400">公司里还没有其他艺人</p>'}</div></div>`;
  $$('modalOverlay').classList.remove('hidden'); playSound('click');
}

window.SYS = { pick: i => { const c = CUR && CUR.c[i]; if (!c) return; CUR = null; const m = c.f(); saveState(); updateGlobalUI(); renderCurrentTab(); _cm(); showToast(m, 'info'); setTimeout(pump, 400); },
  flt: k => { ctFilter = k; renderCurrentTab(); }, solo, cp, talk, fan: fanEvt, color: v => { getActiveGroup().fcolor = v; saveState(); renderCurrentTab(); },
  nego: uid => openNego(uid, false), ng: ngSet, ngSubmit, ngAccept, rel: openRel,
  talkM: uid => { talk(uid); if (!$$('modalOverlay').classList.contains('hidden')) renderProfileModal(uid); },
  cpM: (a, b) => { cp(a, b); openRel(a); },
  fansOf: p => (p && p.fans) || 0 };

/* ---------- 导航按钮 ---------- */
(function () {
  const dt = $$('desk-nav-trends'), mt = $$('mob-nav-trends');
  if (dt) { const c = dt.cloneNode(true); c.id = 'desk-nav-mgmt'; c.setAttribute('onclick', "switchTab('mgmt')"); c.innerHTML = '<span class="flex items-center gap-3"><i class="fa-solid fa-file-signature text-sm w-4 text-center"></i>艺人经营</span><span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/25 text-cyan-300 font-extrabold">合约</span>'; dt.parentNode.insertBefore(c, dt); }
  if (mt) { const c = mt.cloneNode(true); c.id = 'mob-nav-mgmt'; c.setAttribute('onclick', "switchTab('mgmt')"); c.innerHTML = '<i class="fa-solid fa-file-signature text-xs mb-0.5"></i><span class="text-[10px] font-bold">经营</span>'; mt.parentNode.insertBefore(c, mt); mt.parentNode.className = mt.parentNode.className.replace(/grid-cols-\d/, 'grid-cols-7'); }
})();
ensureAll(); syncFans(); saveState(); renderCurrentTab(); setTimeout(pump, 500);
})();
