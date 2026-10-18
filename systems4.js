/********************************************************************
 * systems4.js —— 经营深化（v5）
 * ------------------------------------------------------------------
 * 必须在 systems3.js 之后加载。"公司"页现在有 4 个子页签：
 *   🏢 公司：公司等级 · 设施损耗与大修 · 扩展成就（原设施/成就/财务/员工仍在这页）
 *   💰 财务：财务报表 · 银行贷款 · 引入投资人
 *   🤝 商务：品牌代言合约 · 周边与粉丝团
 *   🧑‍🎤 艺人：健康预算 · 员工成长 · 练习生淘汰赛说明
 * 另有：年度回顾、员工跳槽事件、过劳住院事件、扩展成就
 * 数值集中在 TIERS / BRANDS / LOAN / MERCH 等表里，直接改即可。
 ********************************************************************/
(function () {
const $$ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rnd = a => a[Math.floor(Math.random() * a.length)];
const r1 = v => Math.round(v * 10) / 10;
const absWk = () => { const [y, m, d] = state.dateStr.split('-').map(Number); return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 604800000); };
const deb = () => state.groups.flatMap(g => g.members);
const lv = k => (state.fac && state.fac[k]) || 1;
const byUid = uid => state.trainees.find(t => t.uid === uid);
const fmtF = n => formatFans(Math.round(n));

/* ================= 数值表 ================= */
const TIERS = [
  { n: '小型企划社', cap: 3, slots: 2, hq: 0, loan: 150 },
  { n: '中型经纪公司', cap: 4, slots: 4, hq: 6, loan: 400, bonus: 30, rep: 300, fans: 2e5, trophies: 0, daesang: 0 },
  { n: '大型娱乐公司', cap: 5, slots: 6, hq: 18, loan: 1000, bonus: 80, rep: 800, fans: 1.5e6, trophies: 5, daesang: 0 },
  { n: '顶级娱乐帝国', cap: 5, slots: 10, hq: 40, loan: 3000, bonus: 200, rep: 1800, fans: 8e6, trophies: 10, daesang: 1 }
];
const LOAN = { opts: [100, 300, 800], weeks: 26, rate: 0.004 };                 // 每周利息 0.4%，26 周等额还本
const INVEST = [{ cash: 300, pct: 10 }, { cash: 800, pct: 20 }];               // 注资 / 每周净收益分红比例，回购价 = 注资 ×1.5
const HEALTH = [{ n: '无', cost: 0, st: 0 }, { n: '基础保健', cost: 3, st: 2 }, { n: '专业理疗', cost: 8, st: 4 }, { n: '全套医疗团队', cost: 15, st: 6 }];
const MERCH = { unitCost: 0.03, price: 0.04, store: 0.002, batches: [[12, 400], [30, 1000], [66, 2200]], clubOpen: 15, clubRate: 0.00012 };
const BRANDS = [
  { id: 'fizz', icon: '🥤', name: 'FIZZ 汽水', weekly: 3, weeks: 12, minPop: 20, req: '人气 ≥20', ok: m => m.pop >= 20 },
  { id: 'nova', icon: '📱', name: 'NOVA 科技', weekly: 8, weeks: 16, minPop: 35, req: '人气 ≥35', ok: m => m.pop >= 35 },
  { id: 'glow', icon: '💄', name: 'GLOW 美妆', weekly: 7, weeks: 16, minPop: 30, req: '颜值 ≥75', ok: m => m.visual >= 75 },
  { id: 'stride', icon: '👟', name: 'STRIDE 运动', weekly: 7, weeks: 16, minPop: 30, req: '舞蹈 ≥70', ok: m => m.dance >= 70 },
  { id: 'maison', icon: '👜', name: 'MAISON 奢品', weekly: 16, weeks: 24, minPop: 50, req: '人气 ≥50 且粉丝 ≥5万', ok: m => m.pop >= 50 && (m.fans || 0) >= 50000 }
];
const COACH_MAX = 3, COACH_PAY = 1.5;

/* ================= 数据补全 ================= */
function ensure4() {
  state.wear = state.wear || {}; ['practice', 'studio', 'dorm'].forEach(k => { if (state.wear[k] == null) state.wear[k] = 0; });
  state.loans = state.loans || []; state.deals = state.deals || []; state.fin = state.fin || [];
  if (state.investor === undefined) state.investor = null;
  if (!state.tier) state.tier = 1; if (state.health == null) state.health = 0; if (state.coaches == null) state.coaches = 0;
  state.firedNames = state.firedNames || [];
  state.stats = state.stats || {};
  ['profitStreak', 'loansTaken', 'loansRepaid', 'taxTotal', 'merchSold', 'reviews', 'repairs', 'rehire', 'investorTaken'].forEach(k => { if (!state.stats[k]) state.stats[k] = 0; });
  state.ach = state.ach || {};
  Object.values(state.staff || {}).forEach(s => { if (s.tenure == null) s.tenure = 0; });
  if (!state.yearSnap) state.yearSnap = snap();
  state.groups.forEach(g => { if (!g.merch) g.merch = { stock: 0 }; if (g.club == null) g.club = false; });
}
function snap() { const mf = {}; deb().forEach(m => { mf[m.uid] = m.fans || 0; }); const gf = {}; state.groups.forEach(g => { gf[g.id] = g.fans; });
  return { y: Number(state.dateStr.slice(0, 4)), fans: state.totalFans, funds: state.funds, trophies: state.totalTrophies || 0, mf, gf }; }
const tier = () => TIERS[state.tier - 1];
const loanLeft = () => tier().loan - state.loans.reduce((s, l) => s + l.rem, 0);

/* ================= 独立事件队列（与 systems/systems2 并存） ================= */
let EVQ4 = [], CUR4 = null;
function pump4() {
  if (CUR4 || !EVQ4.length) return;
  if (!$$('modalOverlay').classList.contains('hidden')) return setTimeout(pump4, 1000);
  CUR4 = EVQ4.shift();
  $$('modalBox').innerHTML = `<div class="space-y-3"><h3 class="text-base font-black text-white">${CUR4.t}</h3><div class="text-xs text-slate-300 leading-relaxed">${CUR4.b}</div>` +
    CUR4.c.map((c, i) => `<button onclick="S4.pick(${i})" class="btn-luxury w-full py-2.5 rounded-2xl text-xs font-black text-white">${c.t}</button>`).join('') + '</div>';
  $$('modalOverlay').classList.remove('hidden'); playSound('click');
}
const _cm = closeModal;
closeModal = function () { CUR4 = null; _cm(); setTimeout(pump4, 300); };
const refresh4 = () => { saveState(); updateGlobalUI(); renderCurrentTab(); };
const toast = (m, t) => showToast(m, t || 'info');

/* ================= 每周结算 ================= */
function weekly4(f0, oldDate) {
  ensure4();
  const mChg = oldDate.slice(5, 7) !== state.dateStr.slice(5, 7), yChg = oldDate.slice(0, 4) !== state.dateStr.slice(0, 4);
  const now = absWk(); let extra = 0; const L = state.ledger;
  if (mChg && L && L.tax) state.stats.taxTotal += L.tax;
  const pay = (a) => { state.funds -= a; extra += a; };
  const gain = (a) => { state.funds += a; };

  // 1. 设施损耗
  ['practice', 'studio', 'dorm'].forEach(k => {
    const l = lv(k); if (l < 2) { state.wear[k] = 0; return; }
    const was = state.wear[k]; state.wear[k] += 1.5 + 0.5 * (l - 1);
    if (state.wear[k] >= 100) { state.fac[k] = l - 1; state.wear[k] = 50; playSound('warn'); toast(`🔧 ${k === 'practice' ? '练习室' : k === 'studio' ? '录音棚' : '宿舍'}年久失修，被迫降级到 Lv${l - 1}！`, 'warn'); }
    else if (was < 70 && state.wear[k] >= 70) toast(`🔧 ${k === 'practice' ? '练习室' : k === 'studio' ? '录音棚' : '宿舍'}损耗已达 70%，请尽快大修（公司页）`, 'warn');
  });

  // 2. 员工成长 / 跳槽
  Object.entries(state.staff || {}).forEach(([role, s]) => {
    s.tenure++;
    if (s.tenure % 26 === 0 && s.skill < 5 && Math.random() < 0.6) { s.skill++; s.salary = r1(s.salary + 2.2); toast(`📈 员工【${s.name}】技艺精进，升至 ${s.skill} 星，周薪 +¥2.2万`, 'success'); }
    if (mChg && s.tenure >= 20 && !(s.protect > now) && Math.random() < 0.3) poachEvent(role, s);
  });

  // 3. 品牌代言
  let brandInc = 0;
  state.deals = state.deals.filter(d => {
    const m = byUid(d.uid), b = BRANDS.find(x => x.id === d.brand);
    if (!m || !b) return false;
    if (m.pop < b.minPop - 10) { state.reputation = Math.max(0, state.reputation - 3); toast(`📉 ${b.name} 因 ${m.stageName} 人气下滑终止了合约`, 'warn'); return false; }
    if (d.until <= now) { toast(`📜 ${m.stageName} 与 ${b.name} 的合约期满`, 'info'); return false; }
    brandInc += d.weekly * (0.8 + m.pop / 100); m.mood = clamp(m.mood - 0.3); return true;
  });
  if (brandInc) gain(r1(brandInc));

  // 4. 周边与粉丝团
  let merchInc = 0, clubInc = 0;
  state.groups.forEach(g => {
    const seg = g.seg || { group: 20, solo: 20 };
    if (g.merch.stock > 0) {
      const dem = Math.round(g.fans * 0.003 * (0.5 + (seg.group + seg.solo) / 100)), sold = Math.min(g.merch.stock, dem);
      g.merch.stock -= sold; state.stats.merchSold += sold; merchInc += sold * MERCH.price; pay(g.merch.stock * MERCH.store);
    }
    if (g.club) { clubInc += g.fans * (seg.group / 100) * MERCH.clubRate; pay(1.5 + g.fans / 400000); }
  });
  gain(merchInc + clubInc);

  // 5. 健康：保健预算 + 过劳
  const H = HEALTH[state.health]; if (H.cost) pay(H.cost);
  deb().forEach(m => {
    if (H.st) m.stamina = clamp((m.stamina == null ? 60 : m.stamina) + H.st);
    m.burn = (m.stamina != null && m.stamina < 25) ? (m.burn || 0) + 1 : Math.max(0, (m.burn || 0) - 1);
    if (m.burn >= 3 && !(m.burnCd > now)) { m.burnCd = now + 6; burnEvent(m); }
  });

  // 6. 公司等级总部 / 助教薪资
  if (tier().hq) pay(tier().hq * state.costMult);
  if (state.coaches) pay(state.coaches * COACH_PAY);

  // 7. 贷款与投资人
  state.loans = state.loans.filter(l => {
    const prin = l.amt / LOAN.weeks, intr = l.rem * LOAN.rate; pay(prin + intr); l.rem -= prin;
    if (l.rem <= 0.5) { state.stats.loansRepaid++; toast(`🏦 一笔 ¥${l.amt}万 贷款已还清`, 'success'); return false; } return true;
  });
  const net0 = state.funds - f0;
  if (state.investor && net0 > 0) { const dv = r1(net0 * state.investor.pct / 100); pay(dv); toast(`💼 投资人分红 ¥${dv}万`, 'info'); }

  // 8. 报表
  const net = r1(state.funds - f0), cost = r1(((L && L.total) || 0) + ((L && L.facUpkeep) || 0) + ((L && mChg && L.tax) || 0) + extra);
  state.fin.push({ date: state.dateStr, funds: Math.round(state.funds), net, income: r1(net + cost), cost }); if (state.fin.length > 52) state.fin.shift();
  state.stats.profitStreak = net > 0 ? state.stats.profitStreak + 1 : 0;

  // 9. 公司等级
  const nx = TIERS[state.tier];
  if (nx && state.reputation >= nx.rep && state.totalFans >= nx.fans && (state.totalTrophies || 0) >= nx.trophies && (state.daesangCount || 0) >= nx.daesang) {
    state.tier++; state.funds += nx.bonus; playSound('fanfare'); toast(`🏙️ 公司升级为【${nx.n}】！奖励 ¥${nx.bonus}万，设施上限 Lv${nx.cap}，总部租金 ¥${nx.hq}万/周`, 'gold');
  }

  // 10. 月度：练习生淘汰赛
  if (mChg) cullEvents();

  // 11. 年度回顾
  if (yChg) yearReview();

  checkAch4(); saveState(); pump4();
}

/* ================= 事件 ================= */
function poachEvent(role, s) {
  const names = { choreo: '编舞师', composer: '作曲家', stylist: '造型师', manager: '经纪人' };
  EVQ4.push({ t: '🕵️ 员工被挖角', b: `竞争公司向${names[role]}【${s.name}】（${s.skill}星，在职 ${s.tenure} 周）开出了高价，她来找你谈。`, c: [
    { t: `涨薪 20%（周薪 → ¥${r1(s.salary * 1.2)}万）`, f: () => { s.salary = r1(s.salary * 1.2); return `${s.name} 接受了涨薪，继续留任。`; } },
    { t: `发放一次性挽留金 ¥${s.skill * 25}万`, f: () => { if (state.funds < s.skill * 25) { delete state.staff[role]; return `资金不足，${s.name} 离职了。`; } state.funds -= s.skill * 25; s.protect = absWk() + 26; return `${s.name} 留下了，半年内不会再被挖。`; } },
    { t: '放手', f: () => { delete state.staff[role]; return `${s.name} 去了竞争公司。`; } }] });
}
function burnEvent(m) {
  EVQ4.push({ t: '🏥 成员过劳', b: `${m.stageName} 连续多周体力见底，昏倒在练习室，被送进急诊。`, c: [
    { t: '住院治疗（-¥12万）', f: () => { state.funds -= 12; m.stamina = clamp((m.stamina || 0) + 40); m.mood = clamp(m.mood + 3); m.burn = 0; return `${m.stageName} 住院调养后恢复了精神。`; } },
    { t: '带病继续行程', f: () => { m.burn = 1; m.injured = 3; m.mood = clamp(m.mood - 10); m.pop = clamp(m.pop - 2); return `${m.stageName} 强撑着上了舞台，但状态很差。`; } }] });
}
function cullEvents() {
  const ts = state.trainees.filter(p => p.status !== 'debuted'); if (ts.length < 6) return;
  const sc = p => p.vocal + p.dance + p.rap + p.visual + p.charisma;
  [...ts].sort((a, b) => sc(a) - sc(b)).slice(0, 2).forEach(p => EVQ4.push({ t: '📋 月末淘汰赛', b: `${p.stageName} 在本月综合评分中垫底。公司决定如何安置她？`, c: [
    { t: '续训（-¥8万，心情+6）', f: () => { state.funds -= 8; p.mood = clamp((p.mood == null ? 60 : p.mood) + 6); return `${p.stageName} 决心加倍努力。`; } },
    { t: `转为练习助教（${state.coaches}/${COACH_MAX}，周薪 ¥${COACH_PAY}万）`, f: () => { if (state.coaches >= COACH_MAX) return '助教名额已满，她只好留下续训。'; removeTrainee(p); state.coaches++; return `${p.stageName} 成了助教，今后集体合练每人额外 +${state.coaches} 点属性。`; } },
    { t: '解约（赔偿 ¥6万）', f: () => { state.funds -= 6; removeTrainee(p); state.reputation = Math.max(0, state.reputation - 2); state.trainees.forEach(o => { if (o.mood != null) o.mood = clamp(o.mood - 3); }); return `${p.stageName} 离开了公司，其他练习生心情低落。`; } }] }));
}
function removeTrainee(p) {
  state.trainees = state.trainees.filter(t => t.uid !== p.uid);
  if (state.debutDraft) state.debutDraft.selectedUids = (state.debutDraft.selectedUids || []).filter(u => u !== p.uid);
  if (state.selectedTraineeUid === p.uid) state.selectedTraineeUid = state.trainees[0] ? state.trainees[0].uid : null;
}
/* 助教：集体合练额外加成 */
const _gc = runGroupTraineeClass;
runGroupTraineeClass = function () {
  ensure4(); const ap = state.ap; _gc();
  if (state.coaches && state.ap < ap) { getActiveTrainees().forEach(t => { const cap = t.potential === 'UR' ? 100 : 95; ['vocal', 'dance'].forEach(s => { t[s] = Math.min(cap, t[s] + state.coaches); }); t.grade = calcTraineeGrade(t); }); refresh4(); }
};

function yearReview() {
  const o = state.yearSnap, n = snap();
  let best = null, bd = -1; deb().forEach(m => { const d = (m.fans || 0) - (o.mf[m.uid] || 0); if (d > bd) { bd = d; best = m; } });
  let bg = null, gd = -1; state.groups.forEach(g => { const d = g.fans - (o.gf[g.id] || 0); if (d > gd) { gd = d; bg = g; } });
  const fin = state.fin.slice(-52), inc = fin.reduce((s, x) => s + x.income, 0), cst = fin.reduce((s, x) => s + x.cost, 0);
  const lines = [`粉丝增长：+${fmtF(n.fans - o.fans)}（共 ${fmtF(n.fans)}）`, `打歌一位：+${n.trophies - o.trophies} 座`, `资金：¥${Math.round(o.funds)}万 → ¥${Math.round(n.funds)}万`, `全年收入约 ¥${Math.round(inc)}万 / 支出约 ¥${Math.round(cst)}万`, `公司等级：${tier().n}`, `成就：${Object.keys(state.ach).length} 个已解锁`];
  if (best && bd > 0) lines.push(`⭐ 年度最佳成员：${best.stageName}（个人粉丝 +${fmtF(bd)}）`);
  if (bg && gd > 0) lines.push(`🏆 年度成长女团：${bg.name}（+${fmtF(gd)} 粉丝）`);
  const text = `【${o.y} 年度回顾】${state.agencyName}\n` + lines.join('\n');
  state.stats.reviews++; state.yearSnap = n;
  EVQ4.push({ t: `📅 ${o.y} 年度回顾`, b: lines.map(l => `<div class="py-0.5">${l}</div>`).join(''), c: [
    { t: '📋 复制总结（可分享）', f: () => { try { navigator.clipboard.writeText(text); } catch (e) {} return '年度总结已复制到剪贴板。'; } },
    { t: '继续经营', f: () => '' }] });
}

/* ================= 扩展成就 ================= */
const st4 = () => state.stats;
const ACH4 = [
  ['profit10', '📈', '稳定盈利', '连续 10 周净收支为正', 40, () => st4().profitStreak >= 10],
  ['loan1', '🏦', '第一笔贷款', '向银行贷款一次', 5, () => st4().loansTaken >= 1],
  ['debtfree', '🧾', '按时还款', '还清一笔贷款', 20, () => st4().loansRepaid >= 1],
  ['investor', '💼', '引入资本', '引入投资人', 10, () => st4().investorTaken >= 1],
  ['staff4', '👔', '完整班底', '四个员工职位都有人', 40, () => Object.keys(state.staff || {}).length >= 4],
  ['star5', '🌟', '金牌员工', '拥有一名 5 星员工', 30, () => Object.values(state.staff || {}).some(s => s.skill >= 5)],
  ['rehire', '🔁', '回头是岸', '解雇后又聘回同一个人', 20, () => st4().rehire >= 1],
  ['brand3', '🤝', '代言大户', '同时持有 3 份品牌合约', 40, () => state.deals.length >= 3],
  ['merch10k', '🛍️', '周边热卖', '累计售出 10000 件周边', 40, () => st4().merchSold >= 10000],
  ['tier2', '🏙️', '中型公司', '公司升到第 2 级', 30, () => state.tier >= 2],
  ['tier3', '🏢', '大型公司', '公司升到第 3 级', 60, () => state.tier >= 3],
  ['tier4', '🌆', '娱乐帝国', '公司升到第 4 级', 150, () => state.tier >= 4],
  ['year1', '📅', '满一周年', '看完第一份年度回顾', 20, () => st4().reviews >= 1],
  ['tax1000', '💸', '纳税大户', '累计缴纳税务 ¥1000万', 50, () => st4().taxTotal >= 1000],
  ['coach3', '🎓', '师徒传承', '培养 3 名练习助教', 30, () => state.coaches >= 3],
  ['repair5', '🔧', '勤勉维护', '完成 5 次设施大修', 25, () => st4().repairs >= 5]
].map(([id, icon, name, desc, reward, ok]) => ({ id, icon, name, desc, reward, ok }));
function checkAch4() {
  ensure4(); let n = 0;
  ACH4.forEach(a => { if (state.ach[a.id]) return; let ok = false; try { ok = a.ok(); } catch (e) {} if (!ok) return; state.ach[a.id] = state.dateStr; state.funds += a.reward; state.reputation += 5; n++; toast(`${a.icon} 成就解锁【${a.name}】 +¥${a.reward}万`, 'gold'); });
  if (n) { playSound('fanfare'); saveState(); }
}

/* ================= 玩家操作 ================= */
function borrow(i) {
  ensure4(); const a = LOAN.opts[i];
  if (state.loans.length >= 3) return toast('同时最多 3 笔贷款', 'warn');
  if (a > loanLeft()) { playSound('warn'); return toast(`当前授信额度只剩 ¥${Math.round(loanLeft())}万（公司等级越高额度越大）`, 'warn'); }
  state.funds += a; state.loans.push({ id: Date.now() + i, amt: a, rem: a }); state.stats.loansTaken++;
  playSound('success'); toast(`🏦 贷款 ¥${a}万 到账，之后 ${LOAN.weeks} 周等额还本，另付每周 ${LOAN.rate * 100}% 利息`, 'info'); refresh4();
}
function repay(id) {
  const l = state.loans.find(x => x.id === id); if (!l) return;
  if (state.funds < l.rem) { playSound('warn'); return toast(`💰 提前还清需要 ¥${Math.round(l.rem)}万`, 'warn'); }
  state.funds -= l.rem; state.loans = state.loans.filter(x => x.id !== id); state.stats.loansRepaid++; playSound('success'); toast('🏦 贷款已提前还清', 'success'); refresh4();
}
function invest(i) {
  if (state.investor) return toast('已有投资人，请先回购', 'warn');
  const o = INVEST[i]; state.funds += o.cash; state.investor = { ...o }; state.stats.investorTaken++;
  playSound('success'); toast(`💼 投资人注资 ¥${o.cash}万，之后每周从净收益中分走 ${o.pct}%`, 'info'); refresh4();
}
function buyback() {
  const v = state.investor; if (!v) return; const c = Math.round(v.cash * 1.5);
  if (state.funds < c) { playSound('warn'); return toast(`💰 回购需要 ¥${c}万`, 'warn'); }
  state.funds -= c; state.investor = null; playSound('success'); toast('💼 已回购投资人股份', 'success'); refresh4();
}
function sign(brandId) {
  ensure4(); const b = BRANDS.find(x => x.id === brandId), sel = $$('bs_' + brandId); if (!b || !sel || !sel.value) return toast('请先选择艺人', 'warn');
  const m = byUid(sel.value); if (!m) return;
  if (state.deals.length >= tier().slots) return toast(`合约名额已满（${tier().slots}），提升公司等级可增加`, 'warn');
  if (state.deals.filter(d => d.uid === m.uid).length >= 2) return toast(`${m.stageName} 已有 2 份代言`, 'warn');
  if (state.deals.some(d => d.uid === m.uid && d.brand === b.id)) return toast('她已经代言这个品牌了', 'warn');
  state.funds += b.weekly * 4; state.deals.push({ id: Date.now(), brand: b.id, uid: m.uid, until: absWk() + b.weeks, weekly: b.weekly });
  playSound('success'); toast(`${b.icon} ${m.stageName} 签下 ${b.name}，签约金 ¥${b.weekly * 4}万，周收入约 ¥${r1(b.weekly * (0.8 + m.pop / 100))}万`, 'success'); refresh4();
}
function cancelDeal(id) {
  const d = state.deals.find(x => x.id === id); if (!d) return; const pen = d.weekly * 6;
  if (state.funds < pen) { playSound('warn'); return toast(`💰 违约金 ¥${pen}万 不足`, 'warn'); }
  state.funds -= pen; state.deals = state.deals.filter(x => x.id !== id); state.reputation = Math.max(0, state.reputation - 3); toast(`已解约，支付违约金 ¥${pen}万，口碑 -3`, 'info'); refresh4();
}
function stock(gid, i) {
  const g = state.groups.find(x => String(x.id) === String(gid)); if (!g) return; const [c, n] = MERCH.batches[i];
  if (state.funds < c) { playSound('warn'); return toast(`💰 进货需要 ¥${c}万`, 'warn'); }
  state.funds -= c; g.merch.stock += n; playSound('success'); toast(`🛍️ ${g.name} 周边入库 ${n} 件`, 'info'); refresh4();
}
function club(gid) {
  const g = state.groups.find(x => String(x.id) === String(gid)); if (!g || g.club) return;
  if (state.funds < MERCH.clubOpen) { playSound('warn'); return toast(`💰 开设粉丝团需要 ¥${MERCH.clubOpen}万`, 'warn'); }
  state.funds -= MERCH.clubOpen; g.club = true; playSound('success'); toast(`💌 ${g.name} 官方粉丝团开设，会员费将按周入账`, 'success'); refresh4();
}
function setHealth(t) { state.health = t; toast(`🩺 保健预算：${HEALTH[t].n}（每周 ¥${HEALTH[t].cost}万）`, 'info'); refresh4(); }
function repair(k) {
  const l = lv(k), w = state.wear[k], c = Math.round(l * 6 * (0.5 + w / 100));
  if (l < 2 || w < 5) return; if (state.funds < c) { playSound('warn'); return toast(`💰 大修需要 ¥${c}万`, 'warn'); }
  state.funds -= c; state.wear[k] = 0; state.stats.repairs++; playSound('success'); toast(`🔧 大修完成，花费 ¥${c}万`, 'success'); refresh4();
}
function pick(i) { const c = CUR4 && CUR4.c[i]; if (!c) return; CUR4 = null; const m = c.f(); saveState(); updateGlobalUI(); renderCurrentTab(); closeModal(); if (m) toast(m, 'info'); setTimeout(pump4, 400); }

/* ================= 钩子：设施等级上限 / 员工记录 ================= */
if (window.S2 && S2.up) { const _up = S2.up; S2.up = k => { ensure4(); if (lv(k) >= tier().cap) { playSound('warn'); return toast(`🏙️ 当前公司等级（${tier().n}）设施上限 Lv${tier().cap}，先提升公司等级`, 'warn'); } _up(k); }; }
if (window.S3) {
  const _f = S3.fire, _h = S3.hire;
  S3.fire = r => { ensure4(); const s = state.staff[r]; _f(r); if (s && !state.staff[r]) state.firedNames.push(s.name); };
  S3.hire = (r, i) => { ensure4(); const c = (state.staffPool[r] || [])[i], had = !!state.staff[r]; _h(r, i); if (!had && state.staff[r] && c && state.firedNames.includes(c.name)) state.stats.rehire = 1; if (state.staff[r]) state.staff[r].tenure = 0; };
}
const _adv = advanceNextWeek;
advanceNextWeek = function () { ensure4(); const d = state.dateStr, f0 = state.funds; _adv(); if (state.dateStr !== d) { weekly4(f0, d); updateGlobalUI(); renderCurrentTab(); } };
const _ug = updateGlobalUI;
updateGlobalUI = function () { _ug(); try { ensure4(); checkAch4(); } catch (e) {} };

/* ================= 页面 ================= */
let sub = 'base';
const SUBS = [['base', '🏢 公司'], ['fin', '💰 财务'], ['biz', '🤝 商务'], ['art', '🧑‍🎤 艺人']];
const bar = (v, c) => `<div class="h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full ${c}" style="width:${clamp(v)}%"></div></div>`;
const panel = h => `<div class="glass-panel rounded-3xl p-5 space-y-3">${h}</div>`;
const Bn = 'px-3 py-1.5 rounded-full btn-luxury text-[11px] font-black text-white whitespace-nowrap', Gn = 'px-3 py-1.5 rounded-full glass-pill text-[11px] font-bold text-slate-200 whitespace-nowrap';
const tabBar = () => `<div class="flex flex-wrap gap-2">${SUBS.map(([k, n]) => `<button onclick="S4.sub('${k}')" class="px-4 py-1.5 rounded-full text-xs font-black ${sub === k ? 'btn-luxury text-white' : 'glass-pill text-slate-300'}">${n}</button>`).join('')}</div>`;

function tierHtml() {
  const t = tier(), nx = TIERS[state.tier];
  const need = (l, v, goal, f) => `<div class="text-[11px] text-slate-300 flex justify-between"><span>${l}</span><b class="${v >= goal ? 'text-emerald-300' : 'text-slate-200'}">${f ? f(v) : Math.round(v)} / ${f ? f(goal) : goal}</b></div>`;
  return panel(`<div class="flex justify-between items-center"><h3 class="text-sm font-black text-white">🏙️ 公司等级：${t.n}（${state.tier}/4）</h3><span class="text-[10px] text-slate-400">设施上限 Lv${t.cap} · 代言名额 ${t.slots} · 授信 ¥${t.loan}万 · 总部租金 ¥${t.hq}万/周</span></div>` +
    (nx ? `<div class="text-xs font-black text-pink-300">升级到【${nx.n}】的条件</div>` + need('口碑', state.reputation, nx.rep) + need('全公司粉丝', state.totalFans, nx.fans, fmtF) + need('打歌一位', state.totalTrophies || 0, nx.trophies) + (nx.daesang ? need('Daesang', state.daesangCount || 0, nx.daesang) : '') + `<div class="text-[10px] text-slate-500">升级奖励 ¥${nx.bonus}万，但总部租金会升到 ¥${nx.hq}万/周。</div>` : '<div class="text-xs text-emerald-300 font-bold">已是最高等级</div>'));
}
function wearHtml() {
  const names = { practice: '🎤 练习室', studio: '🎧 录音棚', dorm: '🛏️ 宿舍' };
  return panel(`<h3 class="text-sm font-black text-white">🔧 设施损耗与大修</h3>` + Object.keys(names).map(k => {
    const l = lv(k), w = Math.round(state.wear[k]), c = Math.round(l * 6 * (0.5 + w / 100));
    return `<div class="flex items-center gap-3 text-[11px] text-slate-200"><span class="w-20">${names[k]} Lv${l}</span><div class="flex-1">${bar(w, w >= 70 ? 'bg-rose-400' : 'bg-cyan-400')}</div><span class="w-10 text-right ${w >= 70 ? 'text-rose-300' : ''}">${l < 2 ? '—' : w + '%'}</span>${l >= 2 && w >= 5 ? `<button onclick="S4.repair('${k}')" class="${Gn}">大修 ¥${c}万</button>` : '<span class="w-24"></span>'}</div>`;
  }).join('') + `<p class="text-[10px] text-slate-500">Lv2 以上的设施每周老化（等级越高越快）。损耗到 100% 会被迫降一级；损耗越高，大修越贵，早修更划算。</p>`);
}
function ach4Html() {
  const d = ACH4.filter(a => state.ach[a.id]).length;
  return panel(`<div class="flex justify-between"><h3 class="text-sm font-black text-white">🏅 经营成就</h3><span class="text-xs font-black text-amber-300">${d} / ${ACH4.length}</span></div><div class="grid grid-cols-1 xl:grid-cols-2 gap-2">${ACH4.map(a => { const u = state.ach[a.id]; return `<div class="rounded-2xl border ${u ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-black/30 opacity-70'} p-3 flex gap-3 items-center"><div class="text-2xl ${u ? '' : 'grayscale'}">${a.icon}</div><div class="flex-1 min-w-0"><div class="text-xs font-black ${u ? 'text-amber-200' : 'text-slate-300'}">${a.name}</div><div class="text-[10px] text-slate-400">${a.desc}</div></div><div class="text-[10px] shrink-0 ${u ? 'text-emerald-300' : 'text-slate-500'}">${u ? '✓ ' + u : '奖励 ¥' + a.reward + '万'}</div></div>`; }).join('')}</div>`);
}
function finHtml() {
  const f = state.fin.slice(-26), W = 300, H = 90;
  let chart = '<div class="text-xs text-slate-400 py-6 text-center">推进几周后这里会出现资金曲线</div>';
  if (f.length > 1) {
    const vs = f.map(x => x.funds), lo = Math.min(...vs), hi = Math.max(...vs), rg = Math.max(1, hi - lo);
    const pts = f.map((x, i) => `${(i / (f.length - 1) * W).toFixed(1)},${(H - 8 - (x.funds - lo) / rg * (H - 16)).toFixed(1)}`).join(' ');
    chart = `<svg viewBox="0 0 ${W} ${H}" class="w-full"><polyline points="${pts}" fill="none" stroke="#f472b6" stroke-width="2"/></svg><div class="flex justify-between text-[10px] text-slate-500"><span>${f[0].date}</span><span>资金 ¥${lo}–${hi}万</span><span>${f[f.length - 1].date}</span></div>`;
  }
  const l4 = state.fin.slice(-4), avg = k => l4.length ? r1(l4.reduce((s, x) => s + x[k], 0) / l4.length) : 0;
  const chip = (t, v, c) => `<div class="glass-pill rounded-xl px-3 py-2"><div class="text-[10px] text-slate-400">${t}</div><b class="${c} text-sm">${v}</b></div>`;
  const lastCost = state.ledger ? state.ledger.items.map(([n, v]) => `<div class="flex justify-between text-[11px] text-slate-300"><span>${n}</span><b class="text-rose-300">¥${v}万</b></div>`).join('') : '';
  return panel(`<h3 class="text-sm font-black text-white">📊 财务报表（近 26 周）</h3>${chart}<div class="grid grid-cols-3 gap-2">${chip('近4周周均收入', '¥' + avg('income') + '万', 'text-emerald-300')}${chip('近4周周均支出', '¥' + avg('cost') + '万', 'text-rose-300')}${chip('近4周周均净收益', '¥' + avg('net') + '万', avg('net') >= 0 ? 'text-emerald-300' : 'text-rose-300')}</div>${lastCost ? '<div class="text-xs font-black text-slate-300 pt-1">上周运营支出明细</div>' + lastCost : ''}`) +
    panel(`<div class="flex justify-between items-center"><h3 class="text-sm font-black text-white">🏦 银行贷款</h3><span class="text-[10px] text-slate-400">剩余授信 ¥${Math.max(0, Math.round(loanLeft()))}万 · 最多 3 笔</span></div><div class="flex flex-wrap gap-2">${LOAN.opts.map((a, i) => `<button onclick="S4.borrow(${i})" class="${Bn}">借 ¥${a}万</button>`).join('')}</div>${state.loans.map(l => `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="flex-1">本金 ¥${l.amt}万 · 剩余 ¥${Math.round(l.rem)}万 · 每周还 ¥${r1(l.amt / LOAN.weeks + l.rem * LOAN.rate)}万</span><button onclick="S4.repay(${l.id})" class="${Gn}">提前还清</button></div>`).join('') || '<div class="text-[11px] text-slate-500">暂无贷款</div>'}<p class="text-[10px] text-slate-500">${LOAN.weeks} 周等额还本，每周另付剩余本金的 ${LOAN.rate * 100}% 作为利息；授信额度由公司等级决定。</p>`) +
    panel(`<h3 class="text-sm font-black text-white">💼 引入投资人</h3>${state.investor ? `<div class="flex items-center gap-2 text-xs text-slate-200"><span class="flex-1">已注资 ¥${state.investor.cash}万，每周从净收益里分走 ${state.investor.pct}%</span><button onclick="S4.buyback()" class="${Gn}">回购 ¥${Math.round(state.investor.cash * 1.5)}万</button></div>` : `<div class="flex flex-wrap gap-2">${INVEST.map((o, i) => `<button onclick="S4.invest(${i})" class="${Bn}">注资 ¥${o.cash}万 · 分红 ${o.pct}%</button>`).join('')}</div>`}<p class="text-[10px] text-slate-500">只在当周净收益为正时分红；回购价为注资额的 1.5 倍。同一时间只能有一位投资人。</p>`);
}
function bizHtml() {
  const members = deb(), slots = tier().slots;
  const brandRow = b => { const el = members.filter(m => b.ok(m) && state.deals.filter(d => d.uid === m.uid).length < 2 && !state.deals.some(d => d.uid === m.uid && d.brand === b.id));
    return `<div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-200"><span class="w-28">${b.icon} ${b.name}</span><span class="text-slate-400 flex-1">要求 ${b.req} · 基础周薪 ¥${b.weekly}万 · ${b.weeks} 周</span>${el.length ? `<select id="bs_${b.id}" class="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[11px]">${el.map(m => `<option value="${m.uid}">${m.stageName}（人气${m.pop}）</option>`).join('')}</select><button onclick="S4.sign('${b.id}')" class="${Bn}">签约</button>` : '<span class="text-slate-500">暂无合适艺人</span>'}</div>`; };
  const dealRow = d => { const m = byUid(d.uid), b = BRANDS.find(x => x.id === d.brand); return m && b ? `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="flex-1">${b.icon} ${b.name} × ${m.stageName} · 剩 ${Math.max(0, d.until - absWk())} 周 · 周入 ¥${r1(d.weekly * (0.8 + m.pop / 100))}万</span><button onclick="S4.cancel(${d.id})" class="${Gn}">解约 ¥${d.weekly * 6}万</button></div>` : ''; };
  const gRow = g => `<div class="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2"><div class="text-xs font-black text-white">${g.name} <span class="text-[10px] text-slate-400">库存 ${g.merch.stock} 件 · 粉丝 ${fmtF(g.fans)}</span></div>
    <div class="flex flex-wrap gap-2">${MERCH.batches.map(([c, n], i) => `<button onclick="S4.stock('${g.id}',${i})" class="${Gn}">进货 ${n} 件 ¥${c}万</button>`).join('')}${g.club ? '<span class="text-[11px] text-emerald-300 self-center">💌 粉丝团运营中</span>' : `<button onclick="S4.club('${g.id}')" class="${Bn}">开设粉丝团 ¥${MERCH.clubOpen}万</button>`}</div></div>`;
  return panel(`<div class="flex justify-between"><h3 class="text-sm font-black text-white">🤝 品牌代言合约</h3><span class="text-[11px] text-slate-400">名额 ${state.deals.length} / ${slots}</span></div>${members.length ? BRANDS.map(brandRow).join('') : '<div class="text-xs text-slate-400">女团出道后才能签品牌代言</div>'}<div class="text-xs font-black text-slate-300 pt-1">现有合约</div>${state.deals.map(dealRow).join('') || '<div class="text-[11px] text-slate-500">暂无</div>'}<p class="text-[10px] text-slate-500">签约即得 4 周薪水，每周按人气浮动入账；每份合约会让艺人心情缓慢下降。人气跌破品牌要求 10 点以上会被终止，提前解约要赔 6 周薪水并损失口碑。每位艺人最多 2 份。</p>`) +
    panel(`<h3 class="text-sm font-black text-white">🛍️ 周边与粉丝团</h3>${state.groups.map(gRow).join('') || '<div class="text-xs text-slate-400">女团出道后开放</div>'}<p class="text-[10px] text-slate-500">周边单价 ¥${MERCH.price}万，进价 ¥${MERCH.unitCost}万，库存每件每周仓储费 ¥${MERCH.store}万；销量取决于粉丝数和团粉/唯粉占比，卖不完就亏仓储费。粉丝团每周收会员费，但有运营成本。</p>`);
}
function artHtml() {
  const H = HEALTH, debM = deb();
  const staff = Object.entries(state.staff || {}).map(([r, s]) => `<div class="flex justify-between text-[11px] text-slate-200"><span>${s.name}（${s.skill}星）</span><span class="text-slate-400">在职 ${s.tenure} 周 · ${s.skill >= 5 ? '已满星' : '约每 26 周有 60% 概率升星'}${s.protect > absWk() ? ' · 受挽留保护' : ''}</span></div>`).join('') || '<div class="text-[11px] text-slate-500">暂无员工</div>';
  return panel(`<h3 class="text-sm font-black text-white">🩺 艺人健康预算</h3><div class="flex flex-wrap gap-2">${H.map((h, i) => `<button onclick="S4.health(${i})" class="px-3 py-1.5 rounded-full text-[11px] font-black ${state.health === i ? 'btn-luxury text-white' : 'glass-pill text-slate-300'}">${h.n} ¥${h.cost}万/周</button>`).join('')}</div>
    <p class="text-[10px] text-slate-500">每周所有出道成员体力 +${H[state.health].st}。体力低于 25 连续 3 周会触发过劳住院事件。</p>${debM.map(m => `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="w-20 truncate">${m.stageName}</span><div class="flex-1">${bar(m.stamina == null ? 60 : m.stamina, (m.stamina || 60) < 25 ? 'bg-rose-400' : 'bg-emerald-400')}</div><span class="w-16 text-right ${m.burn >= 2 ? 'text-rose-300' : 'text-slate-500'}">${m.burn ? '疲劳' + m.burn : '正常'}</span></div>`).join('')}`) +
    panel(`<h3 class="text-sm font-black text-white">👔 员工成长</h3>${staff}`) +
    panel(`<h3 class="text-sm font-black text-white">📋 练习生淘汰赛</h3><p class="text-[11px] text-slate-300">每月换月时，练习生超过 6 人，综合评分垫底的 2 人会触发安置选择：续训、转为助教、或解约。</p><div class="text-xs text-slate-200">当前助教：<b class="text-amber-300">${state.coaches} / ${COACH_MAX}</b>（集体合练每人额外 +${state.coaches}，周薪合计 ¥${r1(state.coaches * COACH_PAY)}万）</div>`);
}
const _rt = renderCurrentTab;
renderCurrentTab = function () {
  _rt();
  if (currentTab !== 'corp') return;
  ensure4(); const m = $$('mainContent'), st = m.scrollTop;
  if (sub === 'base') {
    const box = m.firstElementChild;
    if (box && box.firstElementChild) { box.firstElementChild.insertAdjacentHTML('afterend', tabBar() + tierHtml()); box.insertAdjacentHTML('beforeend', wearHtml() + ach4Html()); }
  } else {
    m.innerHTML = `<div class="space-y-4 p-1"><h2 class="text-lg font-black text-white">🏢 公司经营中心</h2>${tabBar()}${({ fin: finHtml, biz: bizHtml, art: artHtml })[sub]()}</div>`;
    m.classList.add('noscroll'); m.style.overflowY = 'auto';
  }
  m.scrollTop = st;
};

window.S4 = { sub: k => { sub = k; renderCurrentTab(); }, borrow, repay, invest, buyback, sign, cancel: cancelDeal, stock, club, health: setHealth, repair, pick };
ensure4(); updateGlobalUI(); renderCurrentTab();
})();
