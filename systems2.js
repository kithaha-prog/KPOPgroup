/********************************************************************
 * systems2.js —— 公司经营扩展（v3）：设施升级 · 关系网联动 · 成就系统
 * ------------------------------------------------------------------
 * 加载顺序：必须在 systems.js 之后（k_pop.html 末尾已加 <script src="systems2.js">）
 *  · 设施：练习室 / 录音棚 / 宿舍，花钱升级，每周扣维护费
 *  · 关系联动：挚友可开 Unit 舞台；关系过低会触发团内不和；亲密的两人会有营业事件
 *  · 成就：读取已有存档数据，每周自动结算，奖励资金
 *  · 新数据：state.fac / state.ach / state.units / state.tours / state.pairCd
 ********************************************************************/
(function () {
const $$ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rnd = a => a[Math.floor(Math.random() * a.length)];
const absWk = () => { const [y, m, d] = state.dateStr.split('-').map(Number); return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 604800000); };
const relKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const byUid = uid => state.trainees.find(t => t.uid === uid);
const deb = () => state.groups.flatMap(g => g.members);
const relOf = (a, b) => { state.rel = state.rel || {}; const v = state.rel[relKey(a.uid, b.uid)]; return v == null ? 30 : v; };
const addRel1 = (a, b, d) => { state.rel = state.rel || {}; const k = relKey(a.uid, b.uid); state.rel[k] = clamp((state.rel[k] == null ? 30 : state.rel[k]) + d); };
const pairsOf = g => g.members.flatMap((a, i) => g.members.slice(i + 1).map(b => ({ a, b, v: relOf(a, b) })));
const refresh = () => { saveState(); updateGlobalUI(); renderCurrentTab(); };
const needAp = () => { if (state.ap < 1) { playSound('warn'); showToast('⚡ 本周行动力(AP)已用尽！', 'warn'); return false; } return true; };
const needFund = c => { if (state.funds < c) { playSound('warn'); showToast(`💰 资金不足 ¥${c}万！`, 'warn'); return false; } return true; };
const TIERS = [[85, '灵魂搭档', '#f472b6'], [70, '挚友', '#fb7185'], [50, '好友', '#c084fc'], [30, '熟络', '#60a5fa'], [15, '点头之交', '#94a3b8'], [0, '陌生', '#64748b']];
const tierOf = v => TIERS.find(t => v >= t[0]);

/* ================= 数据补全 ================= */
function ensure2() {
  state.fac = state.fac || {};
  ['practice', 'studio', 'dorm'].forEach(k => { if (!state.fac[k]) state.fac[k] = 1; });
  state.ach = state.ach || {};
  state.units = state.units || 0;
  state.tours = state.tours || 0;
  state.pairCd = state.pairCd || {};
}

/* ================= 一、设施 ================= */
const FAC = {
  practice: { icon: '🎤', name: '练习室', eff: L => `个人特训 / 集体合练：额外 +${L - 1} 点属性` },
  studio:   { icon: '🎧', name: '录音棚', eff: L => `回归专辑质量 +${(L - 1) * 2}` },
  dorm:     { icon: '🛏️', name: '宿舍',   eff: L => `每周全员心情 +${L - 1}，练习生压力 -${(L - 1) * 2}${L >= 4 ? '，同团关系每周额外 +1' : ''}` }
};
const COST = [0, 60, 120, 200, 320];      // 从 Lv(i) 升到 Lv(i+1) 的费用（¥万）
const MAXL = 5;
const upkeep = () => Object.values(state.fac).reduce((s, L) => s + (L - 1) * 1.5, 0);
const lv = k => (state.fac && state.fac[k]) || 1;

function upgrade(k) {
  ensure2(); const L = lv(k); if (L >= MAXL) return;
  const c = COST[L]; if (!needFund(c)) return;
  state.funds -= c; state.fac[k] = L + 1;
  playSound('fanfare'); showToast(`🏗️ ${FAC[k].name} 升级到 Lv${L + 1}！${FAC[k].eff(L + 1)}`, 'gold'); refresh();
}

/* 练习室：包装个人特训 / 集体合练 */
const _ti = trainIndividual;
trainIndividual = function (uid, type) {
  ensure2(); const t = getPersonByUid(uid), before = t ? t[type] : null;
  _ti(uid, type);
  const b = lv('practice') - 1;
  if (t && b > 0 && type !== 'rest' && typeof before === 'number' && t[type] > before) {
    const cap = t.potential === 'UR' ? 100 : t.potential === 'SSR' ? 96 : 90;
    t[type] = Math.min(cap, t[type] + b); t.grade = calcTraineeGrade(t);
    saveState(); updateGlobalUI(); renderCurrentTab();
  }
};
const _gc = runGroupTraineeClass;
runGroupTraineeClass = function () {
  ensure2(); const ap = state.ap; _gc();
  const b = lv('practice') - 1;
  if (b > 0 && state.ap < ap) {
    getActiveTrainees().forEach(t => {
      const cap = t.potential === 'UR' ? 100 : 95;
      ['vocal', 'dance', 'charisma'].forEach(s => { t[s] = Math.min(cap, t[s] + b); });
      t.grade = calcTraineeGrade(t);
    });
    saveState(); updateGlobalUI(); renderCurrentTab();
  }
};

/* ================= 二、关系网联动 ================= */
const unitBonus = g => (g && g.unitBuff > absWk()) ? (g.unitPow || 4) : 0;
const comebackBonus = g => g ? (lv('studio') - 1) * 2 + unitBonus(g) : 0;

/* 录音棚 + Unit 默契：回归质量里 synergy 占 0.2 权重，临时抬高 synergy 即可 */
const _lc = launchGroupComeback;
launchGroupComeback = function () {
  ensure2(); const g = getActiveGroup(), n = state.discography.length, b = comebackBonus(g), d = b / 0.2;
  if (g && b) g.synergy += d;
  try { _lc(); } finally { if (g && b) g.synergy -= d; }
  if (g && state.discography.length > n) { g.unitBuff = 0; refresh(); }
};

/* 巡演计数（成就用） */
const _rs = runGroupSchedule;
runGroupSchedule = function (type) { const ap = state.ap; _rs(type); if (type === 'tour' && state.ap < ap) { ensure2(); state.tours++; } };

function unitShow(aUid, bUid) {
  ensure2(); const A = byUid(aUid), B = byUid(bUid); if (!A || !B) return;
  const g = state.groups.find(x => x.id === A.groupId), v = relOf(A, B);
  if (v < 70) return showToast('关系还不够默契（需要 ≥70）', 'warn');
  if (!needAp() || !needFund(10)) return;
  if ((A.stamina != null && A.stamina < 15) || (B.stamina != null && B.stamina < 15)) { playSound('warn'); return showToast('有人体力不足 15，先休息！', 'warn'); }
  state.ap--; state.funds -= 10;
  const soul = v >= 85, rev = R(18, 30) + Math.round(v / 5), f = R(2000, 4500) + (soul ? 2000 : 0);
  state.funds += rev;
  [A, B].forEach(m => { m.stamina = clamp((m.stamina == null ? 60 : m.stamina) - 10); m.pop = clamp(m.pop + 3); m.fans = (m.fans || 0) + Math.round(f * 0.4); });
  g.fans += Math.round(f * 0.2); g._fs = g.fans; state.totalFans += f;
  addRel1(A, B, 3);
  g.unitBuff = absWk() + 4; g.unitPow = soul ? 6 : 4; state.units++;
  addTrendPost(`🎤 ${A.stageName} × ${B.stageName} 的 Unit 舞台登上热搜，默契炸裂！`, '爆 380万', '爆');
  playSound('fanfare'); showToast(`🎤 Unit 舞台成功！+¥${rev}万，吸粉 ${formatFans(f)}，4 周内回归质量 +${g.unitPow}`, 'gold'); refresh();
}
function mediate(aUid, bUid) {
  const A = byUid(aUid), B = byUid(bUid); if (!A || !B || !needAp() || !needFund(5)) return;
  state.ap--; state.funds -= 5; addRel1(A, B, 10);
  [A, B].forEach(m => { m.mood = clamp(m.mood + 5); m.grudge = Math.max(0, (m.grudge || 0) - 8); });
  playSound('success'); showToast(`☕ 你把 ${A.stageName} 和 ${B.stageName} 叫到一起聊开了，关系 +10`, 'success'); refresh();
}

/* 关系事件（独立事件队列，用同一个弹窗） */
let EVQ2 = [], CUR2 = null;
function pump2() {
  if (CUR2 || !EVQ2.length) return;
  if (!$$('modalOverlay').classList.contains('hidden')) return setTimeout(pump2, 900);
  CUR2 = EVQ2.shift();
  $$('modalBox').innerHTML = `<div class="space-y-3"><h3 class="text-base font-black text-white">${CUR2.t}</h3><p class="text-xs text-slate-300 leading-relaxed">${CUR2.b}</p>` +
    CUR2.c.map((c, i) => `<button onclick="S2.pick(${i})" class="btn-luxury w-full py-2.5 rounded-2xl text-xs font-black text-white">${c.t}</button>`).join('') + '</div>';
  $$('modalOverlay').classList.remove('hidden'); playSound('click');
}
const _cm = closeModal;
closeModal = function () { CUR2 = null; _cm(); setTimeout(pump2, 300); };

function relEvents() {
  const now = absWk(), cand = [];
  state.groups.forEach(g => pairsOf(g).forEach(p => {
    const k = relKey(p.a.uid, p.b.uid); if ((state.pairCd[k] || 0) > now) return;
    if (p.v < 25 && Math.random() < 0.3) cand.push({ ...p, g, k, kind: 'bad' });
    else if (p.v >= 70 && Math.random() < 0.12) cand.push({ ...p, g, k, kind: 'good' });
  }));
  if (!cand.length) return;
  const { a, b, g, k, kind } = rnd(cand); state.pairCd[k] = now + 8;
  if (kind === 'bad') EVQ2.push({ t: '💢 团内不和', b: `${a.stageName} 和 ${b.stageName} 在练习室为走位吵了起来，气氛很僵，其他成员都不敢说话。（亲密度 ${relOf(a, b)}）`, c: [
    { t: '亲自调解（-¥6万）', f: () => { state.funds -= 6; addRel1(a, b, 12); a.mood = clamp(a.mood + 4); b.mood = clamp(b.mood + 4); return '你把两人叫到一起，说开之后关系缓和了不少。'; } },
    { t: '错开行程，让她们冷静', f: () => { addRel1(a, b, 4); return '暂时分开后火气消了一些。'; } },
    { t: '放任不管', f: () => { addRel1(a, b, -5); g.synergy = clamp(g.synergy - 4); a.mood = clamp(a.mood - 6); b.mood = clamp(b.mood - 6); if (Math.random() < 0.3) { g.fans = Math.round(g.fans * 0.98); addTrendPost(`📰 ${g.name} ${a.stageName}、${b.stageName} 疑似不和，现场气氛尴尬`, '热议 210万', '热议'); return '矛盾公开化，被路人拍到，粉丝流失。'; } return '矛盾继续发酵，团队默契下降。'; } }] });
  else EVQ2.push({ t: '🍗 深夜炸鸡', b: `${a.stageName} 和 ${b.stageName} 练完歌后窝在宿舍吃炸鸡，笑得停不下来。（亲密度 ${relOf(a, b)}）`, c: [
    { t: '拍成 Vlog 发出去（+¥10万）', f: () => { state.funds += 10; const f = R(1500, 3000); g.fans += f; g._fs = g.fans; state.totalFans += f; addRel1(a, b, 3); return `Vlog 播放量爆表，吸粉 ${formatFans(f)}！`; } },
    { t: '保持私密，不打扰她们', f: () => { addRel1(a, b, 6); a.mood = clamp(a.mood + 6); b.mood = clamp(b.mood + 6); return '这份友情更牢固了，两人心情都很好。'; } }] });
}

function unitSection(g) {
  ensure2(); const ps = pairsOf(g); if (!ps.length) return '';
  const best = [...ps].sort((x, y) => y.v - x.v).slice(0, 3), worst = [...ps].sort((x, y) => x.v - y.v).filter(p => p.v < 50).slice(0, 2);
  const row = (p, btn) => { const t = tierOf(p.v); return `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="flex-1 truncate">${p.a.stageName} × ${p.b.stageName}</span><span class="px-2 py-0.5 rounded-full" style="background:${t[2]}33;color:${t[2]}">${t[1]} ${p.v}</span>${btn}</div>`; };
  const B = 'px-2.5 py-1 rounded-full btn-luxury text-[10px] font-black text-white whitespace-nowrap';
  const ub = unitBonus(g), sb = (lv('studio') - 1) * 2;
  return `<div class="glass-panel rounded-3xl p-5 mt-4 space-y-3"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-black text-white">🕸️ ${g.name} 关系联动</h3>
    <span class="text-[10px] text-slate-400">下次回归加成：录音棚 <b class="text-cyan-300">+${sb}</b> · Unit 默契 <b class="text-pink-300">+${ub}</b></span></div>
    <div class="space-y-1.5"><div class="text-xs font-black text-pink-300">💞 最默契的搭档（≥70 可开 Unit 舞台，AP1 ¥10万）</div>${best.map(p => row(p, p.v >= 70 ? `<button onclick="S2.unit('${p.a.uid}','${p.b.uid}')" class="${B}">🎤 Unit 舞台</button>` : '<span class="text-[10px] text-slate-500 w-16 text-right">未达标</span>')).join('')}</div>
    ${worst.length ? `<div class="space-y-1.5"><div class="text-xs font-black text-rose-300">⚠️ 关系偏低（&lt;25 每周有概率触发团内不和）</div>${worst.map(p => row(p, `<button onclick="S2.med('${p.a.uid}','${p.b.uid}')" class="px-2.5 py-1 rounded-full glass-pill text-[10px] font-bold text-amber-200 whitespace-nowrap">☕ 调解 AP1 ¥5万</button>`)).join('')}</div>` : ''}
    <p class="text-[10px] text-slate-500">提示：单飞活动太偏心会拉低其他人和她的关系；宿舍 Lv4 以上同团关系每周额外升温。</p></div>`;
}
const _rg = renderGroupsTab;
renderGroupsTab = function () {
  const h = _rg();
  if (!state.groups.length || !/id="(albumsBox|honorBox)"/.test(h)) return h;
  const g = getActiveGroup(); if (!g) return h;
  ensure2(); return h + unitSection(g);
};

/* ================= 三、成就 ================= */
const ds = () => state.groups;
const ACH = [
  ['debut', '🌟', '星光起航', '女团正式出道', 10, () => ds().length >= 1],
  ['fans10w', '👥', '十万粉丝', '全公司粉丝达到 10 万', 15, () => state.totalFans >= 1e5],
  ['fans100w', '🔥', '百万人气', '全公司粉丝达到 100 万', 40, () => state.totalFans >= 1e6],
  ['fans1000w', '🌏', '千万国民', '全公司粉丝达到 1000 万', 120, () => state.totalFans >= 1e7],
  ['funds500', '💰', '小有积蓄', '资金达到 ¥500万', 20, () => state.funds >= 500],
  ['funds2000', '🏦', '娱乐巨头', '资金达到 ¥2000万', 80, () => state.funds >= 2000],
  ['rep500', '📣', '业界口碑', '公司口碑达到 500', 20, () => state.reputation >= 500],
  ['trophy1', '🏆', '第一座奖杯', '拿到打歌一位', 15, () => (state.totalTrophies || 0) >= 1],
  ['trophy10', '🥇', '一位常客', '累计 10 座打歌一位', 40, () => (state.totalTrophies || 0) >= 10],
  ['trophy30', '👑', '打歌女王', '累计 30 座打歌一位', 100, () => (state.totalTrophies || 0) >= 30],
  ['daesang', '🎖️', '年度大赏', '拿下一次 Daesang', 80, () => (state.daesangCount || 0) >= 1],
  ['pak', '💎', 'Perfect All-Kill', '达成一次 PAK', 100, () => (state.pakCount || 0) >= 1],
  ['ak', '⚡', '全杀', '达成一次全杀', 50, () => (state.akCount || 0) >= 1],
  ['albums5', '💿', '多产女团', '发行 5 张专辑', 30, () => state.discography.length >= 5],
  ['tour1', '🏟️', '万人演唱会', '完成第一次巡演', 25, () => state.tours >= 1],
  ['tour5', '🌍', '巡演常客', '完成 5 次巡演', 60, () => state.tours >= 5],
  ['ur', '✨', '天选之人', '旗下有 UR 潜力艺人', 20, () => state.trainees.some(t => t.potential === 'UR')],
  ['roster15', '🏢', '大型经纪公司', '旗下艺人达到 15 人', 30, () => state.trainees.length >= 15],
  ['wardrobe5', '👗', '时尚衣橱', '衣橱拥有 5 套服装', 15, () => (state.wardrobe || []).length >= 5],
  ['wardrobeAll', '🧵', '衣橱收集家', '买齐全部通用服装', 60, () => { try { const need = OUTFIT_DATA.filter(o => !o.only).map(o => o.id); return need.every(i => state.wardrobe.includes(i)); } catch (e) { return false; } }],
  ['soulmate', '💞', '灵魂搭档', '任意两人亲密度 ≥85', 25, () => ds().some(g => pairsOf(g).some(p => p.v >= 85))],
  ['allfriends', '🫶', '全员好友', '一个团内所有人两两 ≥50', 50, () => ds().some(g => g.members.length > 1 && pairsOf(g).every(p => p.v >= 50))],
  ['unit1', '🎤', '首次 Unit', '开一次 Unit 舞台', 15, () => state.units >= 1],
  ['unit5', '🎶', 'Unit 达人', '开 5 次 Unit 舞台', 40, () => state.units >= 5],
  ['solo10', '🌠', '单飞之星', '艺人累计单飞活动 10 次', 30, () => deb().reduce((s, m) => s + (m.solo || 0), 0) >= 10],
  ['fac3', '🏗️', '扩建工程', '任意设施升到 Lv3', 20, () => Object.values(state.fac).some(L => L >= 3)],
  ['facMax', '🏰', '梦想园区', '全部设施升满 Lv5', 150, () => Object.values(state.fac).every(L => L >= 5)]
].map(([id, icon, name, desc, reward, ok]) => ({ id, icon, name, desc, reward, ok }));

function checkAch() {
  ensure2(); let n = 0;
  ACH.forEach(a => {
    if (state.ach[a.id]) return;
    let ok = false; try { ok = a.ok(); } catch (e) {}
    if (!ok) return;
    state.ach[a.id] = state.dateStr; state.funds += a.reward; state.reputation += 5; n++;
    showToast(`${a.icon} 成就解锁【${a.name}】 +¥${a.reward}万`, 'gold');
  });
  if (n) { playSound('fanfare'); saveState(); }
}

/* ================= 四、「公司」页面 ================= */
function renderCorp() {
  ensure2();
  const done = ACH.filter(a => state.ach[a.id]).length;
  const facCard = k => {
    const f = FAC[k], L = lv(k), c = COST[L];
    return `<div class="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2">
      <div class="flex items-center justify-between"><b class="text-sm text-white">${f.icon} ${f.name}</b><span class="text-xs font-black text-amber-300">Lv${L}${L >= MAXL ? ' MAX' : ''}</span></div>
      <div class="flex gap-1">${[1, 2, 3, 4, 5].map(i => `<span class="h-1.5 flex-1 rounded-full ${i <= L ? 'bg-gradient-to-r from-pink-400 to-fuchsia-400' : 'bg-white/10'}"></span>`).join('')}</div>
      <div class="text-[11px] text-slate-300">当前：${f.eff(L)}</div>
      ${L < MAXL ? `<div class="text-[11px] text-slate-500">下一级：${f.eff(L + 1)}</div><button onclick="S2.up('${k}')" class="btn-luxury w-full py-2 rounded-xl text-xs font-black text-white">升级 ¥${c}万</button>` : '<div class="text-[11px] text-emerald-300 font-bold">已升至最高等级</div>'}</div>`;
  };
  const achCard = a => { const d = state.ach[a.id];
    return `<div class="rounded-2xl border ${d ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-black/30 opacity-70'} p-3 flex gap-3 items-center">
      <div class="text-2xl ${d ? '' : 'grayscale'}">${a.icon}</div><div class="min-w-0 flex-1"><div class="text-xs font-black ${d ? 'text-amber-200' : 'text-slate-300'}">${a.name}</div><div class="text-[10px] text-slate-400">${a.desc}</div></div>
      <div class="text-[10px] text-right shrink-0 ${d ? 'text-emerald-300' : 'text-slate-500'}">${d ? '✓ ' + d : '奖励 ¥' + a.reward + '万'}</div></div>`; };
  return `<div class="space-y-4 p-1"><div class="flex flex-wrap items-center gap-2"><h2 class="text-lg font-black text-white mr-2">🏢 公司设施 & 成就</h2>
    <span class="glass-pill px-3 py-1 rounded-full text-[11px] text-slate-300">每周维护费 <b class="text-rose-300">¥${upkeep().toFixed(1)}万</b></span>
    <span class="glass-pill px-3 py-1 rounded-full text-[11px] text-slate-300">资金 <b class="text-amber-300">¥${Math.round(state.funds)}万</b></span></div>
    <div class="glass-panel rounded-3xl p-5 space-y-3"><h3 class="text-sm font-black text-white">🏗️ 设施升级</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-3">${Object.keys(FAC).map(facCard).join('')}</div>
      <p class="text-[10px] text-slate-500">等级越高，每周维护费越高（每级 ¥1.5万）。录音棚加成会在发行回归时自动计入专辑质量。</p></div>
    <div class="glass-panel rounded-3xl p-5 space-y-3"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-white">🏅 成就墙</h3><span class="text-xs font-black text-amber-300">${done} / ${ACH.length}</span></div>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">${[...ACH].sort((a, b) => !!state.ach[b.id] - !!state.ach[a.id]).map(achCard).join('')}</div></div></div>`;
}
const _rt = renderCurrentTab;
renderCurrentTab = function () {
  if (currentTab === 'corp') {
    const m = $$('mainContent'), st = m.scrollTop; m.innerHTML = renderCorp();
    m.classList.add('noscroll'); m.style.overflowY = 'auto'; m.scrollTop = st;
  } else _rt();
};

/* ================= 五、每周结算 / 全局钩子 ================= */
function weekly2() {
  ensure2();
  state.funds -= upkeep();
  const d = lv('dorm') - 1;
  if (d > 0) {
    state.trainees.forEach(p => { p.mood = clamp((p.mood == null ? 60 : p.mood) + d); if (p.stress != null) p.stress = Math.max(0, p.stress - d * 2); });
    if (d >= 3) state.groups.forEach(g => pairsOf(g).forEach(p => addRel1(p.a, p.b, 1)));
  }
  relEvents(); checkAch(); saveState(); pump2();
}
const _adv = advanceNextWeek;
advanceNextWeek = function () { const d = state.dateStr; _adv(); if (state.dateStr !== d) { weekly2(); updateGlobalUI(); renderCurrentTab(); } };
const _ug = updateGlobalUI;
updateGlobalUI = function () {
  try { ensure2(); } catch (e) {} _ug(); try { checkAch(); } catch (e) {}
  const on = currentTab === 'corp';
  ['desk-nav-corp', 'mob-nav-corp'].forEach(i => { const e = $$(i); if (e) { e.classList.toggle('bg-white/10', on); e.style.color = on && i[0] === 'd' ? '#fff' : ''; } });
};

/* 导航按钮 */
(function () {
  const dt = $$('desk-nav-trends'), mt = $$('mob-nav-trends');
  if (dt) { const c = dt.cloneNode(true); c.id = 'desk-nav-corp'; c.setAttribute('onclick', "switchTab('corp')"); c.innerHTML = '<span class="flex items-center gap-3"><i class="fa-solid fa-building text-sm w-4 text-center"></i>公司设施 & 成就</span><span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 font-extrabold">NEW</span>'; dt.parentNode.insertBefore(c, dt); }
  if (mt) { const c = mt.cloneNode(true); c.id = 'mob-nav-corp'; c.setAttribute('onclick', "switchTab('corp')"); c.innerHTML = '<i class="fa-solid fa-building text-xs mb-0.5"></i><span class="text-[10px] font-bold">公司</span>'; mt.parentNode.insertBefore(c, mt); mt.parentNode.className = mt.parentNode.className.replace(/grid-cols-\d/, 'grid-cols-8'); }
})();

window.S2 = { up: upgrade, unit: unitShow, med: mediate, pick: i => { const c = CUR2 && CUR2.c[i]; if (!c) return; CUR2 = null; const m = c.f(); saveState(); updateGlobalUI(); renderCurrentTab(); closeModal(); showToast(m, 'info'); setTimeout(pump2, 400); } };

ensure2(); checkAch(); saveState(); updateGlobalUI(); renderCurrentTab();
})();
