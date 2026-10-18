/********************************************************************
 * systems.js —— 艺人经营扩展：关系 / 随机事件 / 状态 / 合约 / 粉丝 / 单飞
 * 用法：与 k_pop.html 放同一目录，页面末尾已引入。所有新数据存在 state 里，随存档保存。
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
const SEG = { casual: '路人粉', solo: '唯粉', group: '团粉', career: '事业粉' };
let mgSub = 'status', EVQ = [], CUR = null;

/* ---------- 数据迁移：给老存档补默认值 ---------- */
function ensureAll() {
  const now = absWk();
  state.rel = state.rel || {};
  state.trainees.forEach(p => {
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
const pairs = g => g.members.flatMap((a, i) => g.members.slice(i + 1).map(b => ({ a, b, v: state.rel[relKey(a.uid, b.uid)] ?? 30 })));
const addRel = (g, uids, d) => pairs(g).forEach(({ a, b }) => { if (!uids || (uids.includes(a.uid) && uids.includes(b.uid))) { const k = relKey(a.uid, b.uid); state.rel[k] = clamp((state.rel[k] ?? 30) + d); } });
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
    { t: '接受（体力-15）', f: () => { const pay = 20 + Math.round(state.reputation * 0.05); state.funds += pay; g.members.forEach(m => { m.stamina = clamp(m.stamina - 15); m.pop = clamp(m.pop + 5); }); const f = R(6000, 14000); g.fans += f; state.totalFans += f; return `名场面出圈！+¥${pay}万，吸粉 ${f}。`; } },
    { t: '婉拒', f: () => { g.members.forEach(m => m.mood = clamp(m.mood + 3)); return '大家获得了难得的休息。'; } }] }; },
  () => { const g = rnd(state.groups); if (!g) return; return { t: '👿 黑粉造谣', b: `有人散布 ${g.name} 成员"耍大牌"的捏造视频，热度还在上升。`, c: [
    { t: '法务介入（-¥20万）', f: () => { state.funds -= 20; state.reputation += 6; return '法务函发出，造谣者道歉，口碑回升。'; } },
    { t: '无视冷处理', f: () => { g.fans = Math.round(g.fans * 0.98); g.members.forEach(m => m.mood = clamp(m.mood - 6)); return '谣言发酵，成员们心情低落。'; } }] }; },
  () => { const m = rnd(deb()); if (!m) return; return { t: '🩹 成员受伤', b: `${m.stageName} 练习时扭伤脚踝，但行程表还排着一场商演。`, c: [
    { t: '全力休养（-¥8万）', f: () => { state.funds -= 8; m.injured = 2; m.stamina = clamp(m.stamina + 20); m.mood = clamp(m.mood + 4); return `${m.stageName} 休养两周。`; } },
    { t: '带伤出战（+¥25万）', f: () => { state.funds += 25; m.injured = 4; m.stamina = clamp(m.stamina - 30); m.mood = clamp(m.mood - 12); m.pop = clamp(m.pop + 4); return '演出顺利，但伤势拖得更久，她心里有委屈。'; } }] }; },
  () => { const m = rnd(deb()); if (!m) return; return { t: '🎂 生日应援', b: `${m.stageName} 的生日到了，粉丝在首尔地铁站挂满了应援广告！`, c: [
    { t: '亲自写信回应', f: () => { m.mood = clamp(m.mood + 12); m.pop = clamp(m.pop + 3); const g = grpOf(m); if (g) bump(g, 'solo', 3); return `${m.stageName} 感动落泪，唯粉更粘了。`; } },
    { t: '安排直播庆生（+¥12万）', f: () => { state.funds += 12; m.mood = clamp(m.mood + 6); const g = grpOf(m); if (g) { g.fans += 5000; state.totalFans += 5000; } return '直播同时在线破纪录。'; } }] }; }
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
    if (left <= 8 && left > 0 && !p.warned) { p.warned = 1; showToast(`📑 ${p.stageName} 的合约还剩 ${left} 周，请到「艺人经营→合约」续约`, 'warn'); }
    if (left > 8) p.warned = 0;
    if (left <= 0) {
      if (p.mood < 30 && Math.random() < 0.4 || left <= -4) { depart(p, `🚨 ${p.stageName} 合约到期后被竞争公司高价挖走！`); showToast(`💔 ${p.stageName} 离开了公司`, 'warn'); return; }
      if (!EVQ.some(e => e.uid === p.uid) && !(CUR && CUR.uid === p.uid)) EVQ.push(negotiation(p));
    }
  });
}
function renewCost(p) { return Math.round(20 + p.pop * 0.8 + (p.potential === 'UR' ? 30 : p.potential === 'SSR' ? 15 : 0)); }
function negotiation(p) { return { uid: p.uid, t: `📑 ${p.stageName} 合约到期`, b: `${p.stageName} 的合约已到期（心情 ${p.mood}，人气 ${p.pop}，现分成 ${p.contract.share}%），竞争公司也在接触她。`, c: [
  { t: `续约3年（-¥${renewCost(p)}万）`, f: () => { const c = renewCost(p); if (state.funds < c) return '资金不足，谈判破裂，请尽快凑钱！'; state.funds -= c; p.contract.until = absWk() + 156; p.mood = clamp(p.mood + 8); return `${p.stageName} 续约成功！`; } },
  { t: '提高分成续约2年（分成+8%）', f: () => { p.contract.share += 8; p.contract.until = absWk() + 104; p.mood = clamp(p.mood + 5); return `分成提升至 ${p.contract.share}%，续约成功。`; } },
  { t: '放手', f: () => { depart(p, `📰 ${p.stageName} 合约期满离开 ${state.agencyName}。`); return `${p.stageName} 离开了。`; } }] }; }

/* ---------- 每周结算 ---------- */
function weeklyTick() {
  ensureAll();
  let pay = 0;
  state.trainees.forEach(p => {
    p.mood = clamp(p.mood + (p.mood < 60 ? 3 : -1) - (p.grudge >= 40 ? 3 : 0));
    p.grudge = Math.max(0, p.grudge - 2);
    if (p.pop > 40) p.pop -= 1;
    if (p.injured > 0) { p.injured--; p.stamina = Math.min(p.stamina, 45); }
    if (p.status === 'debuted') pay += (p.contract.share - 20) * 0.15 - p.pop / 60;
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
  ost: ['🎧 OST', m => { const g = R(14, 22) + Math.round(m.vocal / 8); state.funds += g; m.stamina = clamp(m.stamina - 8); m.pop = clamp(m.pop + 4); return `${m.stageName} 的OST登上榜单，+¥${g}万`; }],
  show: ['📺 固定综艺', m => { const g = R(16, 28); state.funds += g; m.stamina = clamp(m.stamina - 12); m.pop = clamp(m.pop + 5); return `${m.stageName} 成为综艺新宠，+¥${g}万`; }],
  album: ['💿 Solo专辑(-¥25万)', m => { if (!cost(25)) return null; state.funds -= 25; const g = Math.round(m.vocal / 3 + m.pop * 0.9 + R(0, 25)); state.funds += g; m.stamina = clamp(m.stamina - 18); m.pop = clamp(m.pop + 8); return `${m.stageName} 的Solo专辑回收 ¥${g}万！`; }],
  cf: ['💎 个人代言', m => { const g = Math.round(12 + m.visual / 3 + m.pop * 0.5); state.funds += g; m.stamina = clamp(m.stamina - 10); m.pop = clamp(m.pop + 5); return `${m.stageName} 拿下代言，+¥${g}万`; }]
};
function solo(uid, k) {
  const m = state.trainees.find(t => t.uid === uid), g = grpOf(m); if (!m || !g || !needAp()) return;
  if (m.stamina < 20) { playSound('warn'); return showToast('体力不足，先休息！', 'warn'); }
  const msg = SOLO[k][1](m); if (!msg) return;
  state.ap--; m.solo++; m.mood = clamp(m.mood - 2);
  bump(g, 'solo', 2);
  g.members.forEach(o => { if (o.uid !== m.uid && m.solo > o.solo + 1) { o.grudge = clamp(o.grudge + 4); const kk = relKey(o.uid, m.uid); state.rel[kk] = clamp(state.rel[kk] - 2); } });
  playSound('success'); showToast('🌟 ' + msg, 'success'); refresh();
}
function cp(a, b) {
  if (!needAp()) return; const A = state.trainees.find(t => t.uid === a), B = state.trainees.find(t => t.uid === b), g = grpOf(A);
  const f = R(8000, 16000); g.fans += f; state.totalFans += f; bump(g, 'solo', 2);
  const k = relKey(a, b); state.rel[k] = clamp(state.rel[k] + 6); state.ap--; A.pop = clamp(A.pop + 3); B.pop = clamp(B.pop + 3);
  addTrendPost(`💞 ${A.stageName} × ${B.stageName} 合照营业炸了，CP粉狂欢！`, '爆 520万', '爆'); playSound('fanfare'); showToast(`💞 CP营业成功，吸粉 ${f}！`, 'gold'); refresh();
}
function talk(uid) { const m = state.trainees.find(t => t.uid === uid); if (!needAp() || !cost(5)) return; state.ap--; state.funds -= 5; m.mood = clamp(m.mood + 20); m.grudge = Math.max(0, m.grudge - 30); showToast(`🤝 与 ${m.stageName} 恳谈后，她轻松多了`, 'info'); refresh(); }
function fanEvt(k) {
  const g = getActiveGroup(); if (!g) return;
  if (k === 'ad') { if (!cost(30)) return; state.funds -= 30; const f = 6000 + state.reputation * 20; g.fans += f; state.totalFans += f; state.reputation += 8; bump(g, 'casual', 4); showToast(`🚇 地铁广告投放！吸粉 +${f}`, 'success'); }
  if (k === 'meet') { if (!needAp() || !cost(12)) return; state.ap--; state.funds -= 12; const f = 5000 + state.reputation * 15; g.fans += f; state.totalFans += f; g.members.forEach(m => m.mood = clamp(m.mood + 8)); bump(g, 'group', 4); bump(g, 'solo', 2); g.synergy = clamp(g.synergy + 2); showToast(`💝 粉丝见面会圆满！全员心情+8，吸粉 +${f}`, 'success'); }
  playSound('success'); refresh();
}
function extend(uid) { const p = state.trainees.find(t => t.uid === uid), c = renewCost(p); if (!cost(c)) return; state.funds -= c; p.contract.until += 104; p.mood = clamp(p.mood + 5); showToast(`📑 ${p.stageName} 提前续约2年`, 'success'); refresh(); }

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
closeModal = function () { if (CUR) CUR = null; _cm(); setTimeout(pump, 300); };
const _rt = renderCurrentTab;
renderCurrentTab = function () { if (currentTab === 'mgmt') { ensureAll(); $$('mainContent').innerHTML = renderMgmt(); try { fitPage(); } catch (e) {} } else _rt(); };
const _ug = updateGlobalUI;
updateGlobalUI = function () { _ug(); const on = currentTab === 'mgmt'; ['desk-nav-mgmt', 'mob-nav-mgmt'].forEach(i => { const e = $$(i); if (e) { e.classList.toggle('bg-white/10', on); e.style.color = on && i[0] === 'd' ? '#fff' : ''; } }); };

/* ---------- 「艺人经营」页面 ---------- */
const bar = (v, c) => `<div class="h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full ${c}" style="width:${clamp(v)}%"></div></div>`;
const card = h => `<div class="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2">${h}</div>`;
const B = 'btn-luxury px-3 py-1.5 rounded-xl text-[11px] font-black text-white';
function renderMgmt() {
  const g = getActiveGroup(), now = absWk();
  const tabs = [['status', '状态'], ['rel', '关系'], ['fans', '粉丝'], ['solo', '单飞'], ['contract', '合约']];
  let h = `<div class="space-y-3 p-1"><div class="flex flex-wrap items-center gap-2"><h2 class="text-lg font-black text-white mr-2">🎛️ 艺人经营</h2>${tabs.map(([k, n]) => `<button onclick="SYS.sub('${k}')" class="glass-pill px-3 py-1 rounded-full text-[11px] font-bold ${mgSub === k ? 'bg-white/20 text-white' : 'text-slate-300'}">${n}</button>`).join('')}<span class="text-[11px] text-amber-300 ml-auto">AP ${state.ap}/${state.maxAp} · ¥${state.funds.toFixed(1)}万</span></div>`;
  const noGrp = '<p class="text-xs text-slate-400">请先在「女团运营」选择一个已出道的女团。</p>';
  if (mgSub === 'status') {
    h += state.trainees.map(p => { const left = p.contract.until - now; return card(`<div class="flex items-center gap-2 text-xs"><span class="w-2.5 h-2.5 rounded-full" style="background:${p.color || '#888'}"></span><b class="text-white">${p.stageName}</b><span class="text-slate-400">${p.status === 'debuted' ? '已出道' : '练习生'}</span>${p.injured ? '<span class="text-rose-300">🩹受伤</span>' : ''}${p.grudge >= 40 ? `<span class="text-amber-300">😒不满${p.grudge}</span>` : ''}<span class="ml-auto text-slate-400">合约${left}周</span></div>
        <div class="grid grid-cols-3 gap-2 text-[10px] text-slate-300"><div>体力 ${p.stamina}${bar(p.stamina, 'bg-emerald-400')}</div><div>心情 ${p.mood}${bar(p.mood, p.mood < 30 ? 'bg-rose-500' : 'bg-pink-400')}</div><div>人气 ${p.pop}${bar(p.pop, 'bg-amber-400')}</div></div>
        ${p.status === 'debuted' ? `<button onclick="SYS.talk('${p.uid}')" class="glass-pill px-2.5 py-1 rounded-full text-[10px] text-cyan-200">🤝 恳谈(AP1,¥5万)</button>` : ''}`); }).join('') || '<p class="text-xs text-slate-400">暂无艺人</p>';
  } else if (mgSub === 'rel') {
    if (!g) h += noGrp; else {
      const ps = pairs(g).sort((a, b) => b.v - a.v);
      h += card(`<div class="text-xs font-black text-white">${g.name} 成员默契（每周自动影响团魂）</div>` + (ps.map(({ a, b, v }) => `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="w-28 truncate">${a.stageName} × ${b.stageName}</span><div class="flex-1">${bar(v, 'bg-fuchsia-400')}</div><span class="w-6">${v}</span>${v >= 55 ? `<button onclick="SYS.cp('${a.uid}','${b.uid}')" class="glass-pill px-2 py-0.5 rounded-full text-[10px] text-pink-200">💞CP营业</button>` : ''}</div>`).join('') || '<p class="text-xs text-slate-400">团里至少需要两人</p>'));
      h += card(`<div class="text-xs font-black text-white">不满度（偏心C位/单飞不均会累积）</div>` + g.members.map(m => `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="w-20">${m.stageName}</span><div class="flex-1">${bar(m.grudge, 'bg-amber-500')}</div><span class="w-6">${m.grudge}</span></div>`).join(''));
    }
  } else if (mgSub === 'fans') {
    if (!g) h += noGrp; else h += card(`<div class="flex items-center gap-2 text-xs"><b class="text-white">${g.fandomName || ''}</b><span class="text-slate-400">总粉丝 ${formatFans(g.fans)}</span><label class="ml-auto text-[10px] text-slate-300">应援色 <input type="color" value="${g.fcolor}" onchange="SYS.color(this.value)" class="align-middle bg-transparent"></label></div>` +
      Object.keys(SEG).map(k => `<div class="text-[11px] text-slate-200 flex items-center gap-2"><span class="w-14">${SEG[k]}</span><div class="flex-1">${bar(g.seg[k], '')}<style></style></div><span class="w-20 text-right">${g.seg[k]}% · ${formatFans(Math.round(g.fans * g.seg[k] / 100))}</span></div>`).join('') +
      `<p class="text-[10px] text-slate-400">路人粉带来自然增粉；事业粉带来被动收入；团粉/唯粉通过活动与单飞提升。</p><div class="flex flex-wrap gap-2"><button onclick="SYS.fan('ad')" class="${B}">🚇 地铁广告 ¥30万</button><button onclick="SYS.fan('meet')" class="${B}">💝 粉丝见面会 AP1 ¥12万</button></div>`).replace(/<div class="h-1\.5 rounded-full bg-white\/10 overflow-hidden"><div class="h-full " /g, `<div class="h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full" `).replace(/style="width:(\d+)%"><\/div><\/div><style><\/style>/g, `style="width:$1%;background:${g.fcolor}"></div></div>`);
  } else if (mgSub === 'solo') {
    if (!g) h += noGrp; else h += g.members.map(m => card(`<div class="text-xs text-white font-black">${m.stageName} <span class="text-slate-400 font-normal">单飞${m.solo}次 · 体力${m.stamina} · 人气${m.pop}</span></div><div class="flex flex-wrap gap-1.5">${Object.keys(SOLO).map(k => `<button onclick="SYS.solo('${m.uid}','${k}')" class="glass-pill px-2.5 py-1 rounded-full text-[10px] text-slate-100">${SOLO[k][0]}</button>`).join('')}</div>`)).join('') + '<p class="text-[10px] text-slate-400">每次消耗1 AP。某人单飞过多，其他队友会积累不满。</p>';
  } else {
    h += state.trainees.map(p => { const left = p.contract.until - now; return card(`<div class="flex items-center gap-2 text-xs"><b class="text-white w-20">${p.stageName}</b><span class="${left <= 8 ? 'text-rose-300' : 'text-slate-300'}">剩 ${left} 周</span><span class="text-slate-400">分成 ${p.contract.share}%</span><button onclick="SYS.extend('${p.uid}')" class="ml-auto glass-pill px-2.5 py-1 rounded-full text-[10px] text-amber-200">提前续约2年 ¥${renewCost(p)}万</button></div>`); }).join('');
  }
  return h + '</div>';
}

window.SYS = { pick: i => { const c = CUR && CUR.c[i]; if (!c) return; CUR = null; const m = c.f(); saveState(); updateGlobalUI(); renderCurrentTab(); _cm(); showToast(m, 'info'); setTimeout(pump, 400); },
  sub: k => { mgSub = k; renderCurrentTab(); }, solo, cp, talk, fan: fanEvt, extend, color: v => { getActiveGroup().fcolor = v; saveState(); renderCurrentTab(); } };

/* ---------- 导航按钮 ---------- */
(function () {
  const dt = $$('desk-nav-trends'), mt = $$('mob-nav-trends');
  if (dt) { const c = dt.cloneNode(true); c.id = 'desk-nav-mgmt'; c.setAttribute('onclick', "switchTab('mgmt')"); c.innerHTML = '<span class="flex items-center gap-3"><i class="fa-solid fa-sliders text-sm w-4 text-center"></i>艺人经营</span><span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/25 text-cyan-300 font-extrabold">NEW</span>'; dt.parentNode.insertBefore(c, dt); }
  if (mt) { const c = mt.cloneNode(true); c.id = 'mob-nav-mgmt'; c.setAttribute('onclick', "switchTab('mgmt')"); c.innerHTML = '<i class="fa-solid fa-sliders text-xs mb-0.5"></i><span class="text-[10px] font-bold">经营</span>'; mt.parentNode.insertBefore(c, mt); mt.parentNode.className = mt.parentNode.className.replace(/grid-cols-\d/, 'grid-cols-7'); }
})();
ensureAll(); saveState(); renderCurrentTab(); setTimeout(pump, 500);
})();
