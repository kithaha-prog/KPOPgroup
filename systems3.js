/********************************************************************
 * systems3.js —— 持续开销 + 员工系统（v4）
 * ------------------------------------------------------------------
 * 必须在 systems2.js 之后加载。
 *  · 每周固定支出：办公室运营 / 艺人生活费 / 团队运营 / 法务公关 / 员工薪资
 *  · 通胀：运营类支出随时间每周上涨 0.2%
 *  · 月度税务与资产管理费：只对超过 ¥300万 的部分累进收取（钱越多扣得越多）
 *  · 财务难度：宽松 0.7 / 标准 1 / 严苛 1.4，只影响运营类支出
 *  · 新手保护：前 18 周运营类支出从 40% 逐步升到 100%
 *  · 员工：编舞师 / 作曲家 / 造型师 / 经纪人，需要对应设施等级才生效
 *  · 要调数值，只改下面 CFG / ROLES
 ********************************************************************/
(function () {
const $$ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rnd = a => a[Math.floor(Math.random() * a.length)];
const r1 = v => Math.round(v * 10) / 10;
const absWk = () => { const [y, m, d] = state.dateStr.split('-').map(Number); return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 604800000); };
const deb = () => state.groups.flatMap(g => g.members);
const facLv = k => (state.fac && state.fac[k]) || 1;

/* ================= 数值表 ================= */
const CFG = {
  rentBase: 6, rentPerRep: 0.012,          // 办公室：基础 + 口碑加成
  livingTrainee: 0.6, livingDebut: 1.2,    // 每人每周生活费
  groupBase: 3, groupPerMember: 0.8, groupPerFans: 1 / 200000,   // 每个女团的运营费
  legalFrom: 200, legalPerRep: 0.006,      // 口碑 > 200 后需要法务 / 公关顾问
  inflation: 0.002,                        // 每周通胀
  rampWeeks: 18, rampStart: 0.4,           // 新手保护
  taxFree: 300, brackets: [[1000, 0.03], [3000, 0.06], [Infinity, 0.10]]   // 月度税务：各档只对该档内的部分收取
};
const ROLES = {
  choreo:   { icon: '💃', name: '编舞师', gate: () => facLv('practice') >= 2, gateTxt: '练习室 Lv2', eff: s => `回归质量 +${r1(s * 1.5)}` },
  composer: { icon: '🎹', name: '作曲家', gate: () => facLv('studio') >= 3,   gateTxt: '录音棚 Lv3', eff: s => `回归质量 +${s * 2}` },
  stylist:  { icon: '👗', name: '造型师', gate: () => true,                    gateTxt: '',          eff: s => `每周团粉自然增长 +${r1(s * 0.1)}%` },
  manager:  { icon: '📋', name: '经纪人', gate: () => facLv('dorm') >= 2,      gateTxt: '宿舍 Lv2',   eff: s => `每周出道成员体力 +${s * 2}` }
};
const NAMES = ['金敏哲', '李书妍', '朴正勋', '崔雅琳', '郑世珍', '姜惠美', '尹泰宇', '韩诗雅', '宋民浩', '许兰', '白智恩', '赵成焕'];

/* ================= 数据补全 ================= */
function ensure3() {
  state.staff = state.staff || {};
  state.staffPool = state.staffPool || {};
  if (state.costMult == null) state.costMult = 1;
  state.ledger = state.ledger || null;
}
const active = k => { const s = state.staff[k]; return s && ROLES[k].gate() ? s : null; };
const salaryTotal = () => Object.values(state.staff).reduce((t, s) => t + s.salary, 0);
const opMult = () => state.costMult * clamp(CFG.rampStart + absWk() * (1 - CFG.rampStart) / CFG.rampWeeks, CFG.rampStart, 1) * (1 + CFG.inflation * absWk());
const facUpkeep = () => Object.values(state.fac || {}).reduce((s, L) => s + (L - 1) * 1.5, 0);

/* ================= 每周支出 ================= */
function weeklyCosts() {
  const op = opMult(), rep = state.reputation, items = [];
  const nT = state.trainees.filter(p => p.status !== 'debuted').length, nD = state.trainees.length - nT;
  items.push(['🏢 办公室运营', (CFG.rentBase + rep * CFG.rentPerRep) * op]);
  items.push(['🍚 艺人生活费', (nT * CFG.livingTrainee + nD * CFG.livingDebut) * op]);
  items.push(['🎪 女团运营', state.groups.reduce((s, g) => s + CFG.groupBase + g.members.length * CFG.groupPerMember + g.fans * CFG.groupPerFans, 0) * op]);
  if (rep > CFG.legalFrom) items.push(['⚖️ 法务公关顾问', (rep - CFG.legalFrom) * CFG.legalPerRep * op]);
  if (salaryTotal() > 0) items.push(['👔 员工薪资', salaryTotal()]);
  return items.map(([n, v]) => [n, r1(v)]);
}
function taxOf(funds) {
  let t = 0, lo = CFG.taxFree;
  for (const [hi, rate] of CFG.brackets) { if (funds <= lo) break; t += (Math.min(funds, hi) - lo) * rate; lo = hi; }
  return r1(t);
}

function weekly3(fundsBefore, monthChanged) {
  ensure3();
  const items = weeklyCosts(), total = r1(items.reduce((s, [, v]) => s + v, 0));
  state.funds -= total;
  // 员工效果
  const st = active('stylist'), mg = active('manager');
  if (st) state.groups.forEach(g => { const f = Math.round(g.fans * 0.001 * st.skill); g.fans += f; g._fs = g.fans; state.totalFans += f; });
  if (mg) deb().forEach(m => { m.stamina = clamp((m.stamina == null ? 60 : m.stamina) + mg.skill * 2); });
  // 月度税务
  let tax = 0;
  if (monthChanged) {
    tax = taxOf(state.funds);
    if (tax > 0) { state.funds -= tax; showToast(`🧾 月度税务与资产管理费 ¥${tax}万`, 'warn'); }
    state.staffPool = {};   // 人才市场每月换一批
  }
  state.ledger = { date: state.dateStr, items, total, tax, facUpkeep: r1(facUpkeep()), net: r1(state.funds - fundsBefore) };
  if (state.funds < 0) { state.reputation = Math.max(0, state.reputation - 5); playSound('warn'); showToast(`🚨 资金为负（¥${Math.round(state.funds)}万）！口碑每周 -5，尽快开源节流`, 'warn'); }
  else showToast(`📉 本周固定支出 ¥${r1(total + facUpkeep())}万`, 'info');
  saveState();
}

/* 员工对回归质量的加成（质量公式里 synergy 权重 0.2，临时抬高再还原，与 systems2 同样的做法） */
const _lc = launchGroupComeback;
launchGroupComeback = function () {
  ensure3(); const g = getActiveGroup();
  const ch = active('choreo'), co = active('composer'), b = (ch ? ch.skill * 1.5 : 0) + (co ? co.skill * 2 : 0), d = b / 0.2;
  if (g && b) g.synergy += d;
  try { _lc(); } finally { if (g && b) g.synergy -= d; }
  if (g && b) { saveState(); updateGlobalUI(); renderCurrentTab(); }
};

const _adv = advanceNextWeek;
advanceNextWeek = function () {
  ensure3(); const d = state.dateStr, f0 = state.funds;
  _adv();
  if (state.dateStr !== d) {
    weekly3(f0, d.slice(5, 7) !== state.dateStr.slice(5, 7));
    updateGlobalUI(); renderCurrentTab();
  }
};

/* ================= 员工操作 ================= */
function genPool(role) {
  return Array.from({ length: 3 }, () => {
    const skill = Math.min(5, 1 + Math.floor(Math.pow(Math.random(), 1.4) * 5));
    return { name: rnd(NAMES), skill, salary: r1(2 + skill * 2.2), fee: skill * 20 };
  });
}
function hire(role, i) {
  ensure3(); const c = (state.staffPool[role] || [])[i]; if (!c || state.staff[role]) return;
  if (state.funds < c.fee) { playSound('warn'); return showToast(`💰 签约费不足 ¥${c.fee}万！`, 'warn'); }
  state.funds -= c.fee; state.staff[role] = { name: c.name, skill: c.skill, salary: c.salary }; state.staffPool[role] = [];
  playSound('fanfare'); showToast(`🤝 聘用${ROLES[role].name}【${c.name}】，周薪 ¥${c.salary}万`, 'gold'); refresh3();
}
function fire(role) {
  ensure3(); const s = state.staff[role]; if (!s) return;
  const sev = r1(s.salary * 4);
  if (state.funds < sev) { playSound('warn'); return showToast(`💰 解约赔偿金不足 ¥${sev}万`, 'warn'); }
  state.funds -= sev; delete state.staff[role]; showToast(`${ROLES[role].name}【${s.name}】已离职，赔偿 ¥${sev}万`, 'info'); refresh3();
}
function reroll(role) {
  if (state.funds < 5) { playSound('warn'); return showToast('💰 猎头费不足 ¥5万', 'warn'); }
  state.funds -= 5; state.staffPool[role] = genPool(role); refresh3();
}
function setCost(v) { ensure3(); state.costMult = v; refresh3(); }
const refresh3 = () => { saveState(); updateGlobalUI(); renderCurrentTab(); };

/* ================= 页面（追加到「公司」页） ================= */
const stars = n => '★'.repeat(n) + '<span class="text-slate-600">' + '★'.repeat(5 - n) + '</span>';
function ledgerHtml() {
  ensure3(); const L = state.ledger, op = opMult();
  const diff = [[0.7, '宽松'], [1, '标准'], [1.4, '严苛']].map(([v, n]) => `<button onclick="S3.cost(${v})" class="px-3 py-1 rounded-full text-[11px] font-black ${state.costMult === v ? 'btn-luxury text-white' : 'glass-pill text-slate-300'}">${n}</button>`).join('');
  const pred = weeklyCosts(), predT = r1(pred.reduce((s, [, v]) => s + v, 0) + facUpkeep());
  const rows = (L ? [...L.items, ['🏗️ 设施维护（升级设施产生，已自动扣除）', L.facUpkeep]] : [...pred, ['🏗️ 设施维护', r1(facUpkeep())]]);
  return `<div class="glass-panel rounded-3xl p-5 space-y-3 mb-4"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-black text-white">📒 财务与固定支出</h3><div class="flex items-center gap-1.5"><span class="text-[10px] text-slate-400">财务难度</span>${diff}</div></div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
      <div class="glass-pill rounded-xl px-3 py-2"><div class="text-slate-400">预计每周支出</div><b class="text-rose-300 text-sm">¥${predT}万</b></div>
      <div class="glass-pill rounded-xl px-3 py-2"><div class="text-slate-400">上周净收支</div><b class="${L && L.net < 0 ? 'text-rose-300' : 'text-emerald-300'} text-sm">${L ? (L.net >= 0 ? '+' : '') + '¥' + L.net + '万' : '—'}</b></div>
      <div class="glass-pill rounded-xl px-3 py-2"><div class="text-slate-400">运营成本系数</div><b class="text-amber-300 text-sm">×${op.toFixed(2)}</b></div>
      <div class="glass-pill rounded-xl px-3 py-2"><div class="text-slate-400">上次月度税务</div><b class="text-amber-300 text-sm">${L && L.tax ? '¥' + L.tax + '万' : '—'}</b></div></div>
    <div class="space-y-1">${rows.map(([n, v]) => `<div class="flex justify-between text-[11px] text-slate-300"><span>${n}</span><b class="text-rose-300">-¥${v}万</b></div>`).join('')}</div>
    <p class="text-[10px] text-slate-500">月度税务：资金超过 ¥${CFG.taxFree}万的部分累进收取（${CFG.brackets.map(([hi, r], i) => `${i ? CFG.brackets[i - 1][0] : CFG.taxFree}${hi === Infinity ? '以上' : '–' + hi}：${r * 100}%`).join(' / ')}），存得越多扣得越多。运营类支出随时间每周上涨 ${CFG.inflation * 100}%；前 ${CFG.rampWeeks} 周有新手保护。当前税务预估：<b class="text-amber-300">¥${taxOf(state.funds)}万/月</b>。</p></div>`;
}
function staffHtml() {
  ensure3();
  const card = k => {
    const r = ROLES[k], s = state.staff[k], ok = r.gate();
    if (s) return `<div class="rounded-2xl border ${ok ? 'border-emerald-400/30' : 'border-amber-400/30'} bg-black/30 p-4 space-y-1.5">
      <div class="flex justify-between items-center"><b class="text-sm text-white">${r.icon} ${r.name}</b><span class="text-xs text-amber-300">${stars(s.skill)}</span></div>
      <div class="text-xs text-slate-200">${s.name} · 周薪 <b class="text-rose-300">¥${s.salary}万</b></div>
      <div class="text-[11px] ${ok ? 'text-emerald-300' : 'text-amber-300'}">${ok ? '生效中：' + r.eff(s.skill) : '⚠️ 未生效，需要 ' + r.gateTxt + '（薪水照付）'}</div>
      <button onclick="S3.fire('${k}')" class="glass-pill px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-300">解雇（赔偿 ¥${r1(s.salary * 4)}万）</button></div>`;
    if (!state.staffPool[k]) state.staffPool[k] = genPool(k);
    return `<div class="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2">
      <div class="flex justify-between items-center"><b class="text-sm text-white">${r.icon} ${r.name}（空缺）</b>${r.gateTxt ? `<span class="text-[10px] ${ok ? 'text-emerald-300' : 'text-rose-300'}">${ok ? '✓' : '需要'} ${r.gateTxt}</span>` : ''}</div>
      ${state.staffPool[k].map((c, i) => `<div class="flex items-center gap-2 text-[11px] text-slate-200"><span class="w-12 truncate">${c.name}</span><span class="text-amber-300">${stars(c.skill)}</span><span class="flex-1 text-right text-slate-400">周薪 ¥${c.salary}万</span><button onclick="S3.hire('${k}',${i})" class="px-2.5 py-1 rounded-full btn-luxury text-[10px] font-black text-white whitespace-nowrap">聘用 ¥${c.fee}万</button></div>`).join('')}
      <div class="flex items-center justify-between text-[10px] text-slate-500"><span>${r.eff(1)}（1星）→ ${r.eff(5)}（5星）</span><button onclick="S3.reroll('${k}')" class="underline">换一批 ¥5万</button></div></div>`;
  };
  return `<div class="glass-panel rounded-3xl p-5 space-y-3 mt-4"><div class="flex justify-between items-center"><h3 class="text-sm font-black text-white">👔 员工与人才市场</h3><span class="text-[11px] text-slate-400">在职周薪合计 <b class="text-rose-300">¥${r1(salaryTotal())}万</b></span></div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${Object.keys(ROLES).map(card).join('')}</div>
    <p class="text-[10px] text-slate-500">每个职位只能有一名员工；人才市场每月刷新。高星员工效果更强，但周薪也更高，薪水是长期固定支出，设施等级不够时薪水照付、效果不生效。</p></div>`;
}
const _rt = renderCurrentTab;
renderCurrentTab = function () {
  _rt();
  if (currentTab === 'corp') {
    const m = $$('mainContent'), st = m.scrollTop, box = m.firstElementChild;
    if (box && box.firstElementChild) { box.firstElementChild.insertAdjacentHTML('afterend', ledgerHtml()); box.insertAdjacentHTML('beforeend', staffHtml()); }
    m.scrollTop = st;
  }
};

window.S3 = { hire, fire, reroll, cost: setCost };
ensure3(); updateGlobalUI(); renderCurrentTab();
})();
