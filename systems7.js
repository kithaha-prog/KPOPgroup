/********************************************************************
 * systems7.js —— 舞台挑战小游戏（v8）
 * ------------------------------------------------------------------
 * 必须在 systems6.js 之后加载（k_pop.html 末尾加 <script src="systems7.js"></script>）
 *  · 🎮 4 轨节奏小游戏：D F J K（或 ← ↓ ↑ →）击键，手机直接点对应列
 *  · 触发点 ①：每周音乐节目结算前，每个报名的女团各打一次，
 *      评级 S/A/B/C/D 决定该档节目的「评审」得分加减（S 级还有概率现场炸裂，D 级有概率出舞台事故）
 *  · 触发点 ②：回归发行（点「确认企划并发行」后），评级决定本次专辑质量加减，
 *      S 级有概率直拍爆红额外涨粉
 *  · 成员技能越高，判定越宽松；不想玩可以选「自动演出」（按实力随机评级，效果减半），
 *      也可勾选「以后都自动演出」
 *  · 数据存在 state.stage；要调数值，只改下面 SHOW_MOD / LAUNCH_MOD
 ********************************************************************/
(function () {
const $$ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rnd = a => a[Math.floor(Math.random() * a.length)];
const r1 = v => Math.round(v * 10) / 10;
const sgn = v => (v >= 0 ? '+' : '') + v;
const findG = gid => state.groups.find(g => String(g.id) === String(gid));
const refresh = () => { saveState(); updateGlobalUI(); renderCurrentTab(); };

/* ================= 数值表 ================= */
const SHOW_MOD   = { S: 7, A: 4, B: 1.5, C: -1, D: -4 };   // 对音乐节目「评审」得分的加减
const LAUNCH_MOD = { S: 8, A: 5, B: 2,   C: 0,  D: -3 };   // 对回归专辑质量的加减
const AUTO_FACTOR = 0.5;                                   // 自动演出效果倍率
const GC = { S: '#fbbf24', A: '#34d399', B: '#60a5fa', C: '#a78bfa', D: '#f87171' };
const LANE_COL = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24'];
const KEYS = { d: 0, f: 1, j: 2, k: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const LANE_TXT = ['D', 'F', 'J', 'K'];

/* ================= 数据 ================= */
function ensure7() {
  const S = state.stage = state.stage || {};
  S.mods = S.mods || {};
  S.stats = S.stats || { plays: 0, S: 0, A: 0, B: 0, C: 0, D: 0 };
  if (S.autoAll == null) S.autoAll = false;
  return S;
}
const modKey = (id, gid) => state.dateStr + '|' + id + '|' + gid;
const gradeOf = acc => acc >= .92 ? 'S' : acc >= .78 ? 'A' : acc >= .6 ? 'B' : acc >= .4 ? 'C' : 'D';
const autoGrade = skill => gradeOf(skill / 100 * .6 + Math.random() * .4);
const avgSk = (g, sk) => g.members.reduce((s, m) => s + (Array.isArray(sk) ? sk.reduce((a, k) => a + (m[k] || 0), 0) / sk.length : (m[sk] || 0)), 0) / g.members.length;
const winMs = skill => [Math.round(clamp(55 + (skill - 50) * .4, 42, 80)), Math.round(clamp(120 + (skill - 50) * .8, 90, 165))];

function roll(table, grade, auto) {
  let d = table[grade] * (auto ? AUTO_FACTOR : 1), note = '';
  if (grade === 'S' && Math.random() < .25) { d += 3; note = '现场气氛炸裂'; }
  if (grade === 'D' && Math.random() < .25) { d -= 3; note = '舞台事故被疯传'; }
  return { grade, auto: !!auto, delta: r1(d), note };
}

/* ================= 小游戏界面 ================= */
let OV = null, STOP = null;
function mount() {
  unmount();
  OV = document.createElement('div'); OV.id = 's7ov';
  OV.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(5,5,15,.94);display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto';
  document.body.appendChild(OV); return OV;
}
function unmount() { if (STOP) { STOP(); STOP = null; } if (OV) { OV.remove(); OV = null; } }
const card = html => `<div style="width:min(94vw,440px);background:#12101f;border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:18px;color:#fff">${html}</div>`;
const btn = (id, txt, primary) => `<button id="${id}" style="width:100%;margin-top:8px;padding:11px;border-radius:16px;font-weight:900;font-size:13px;color:#fff;border:1px solid rgba(255,255,255,.15);background:${primary ? 'linear-gradient(135deg,#ec4899,#8b5cf6)' : 'rgba(255,255,255,.08)'}">${txt}</button>`;

/* o: { title, group, gid, skill, table, effect, onDone } */
function ask(o) {
  const S = ensure7();
  const finish = (grade, auto) => {
    const r = roll(o.table, grade, auto); r.gid = o.gid;
    if (!auto) { S.stats.plays++; S.stats[grade]++; }
    saveState(); o.onDone(r);
  };
  if (S.autoAll) return finish(autoGrade(o.skill), true);
  const ov = mount(), [pw, gw] = winMs(o.skill), st = S.stats;
  ov.innerHTML = card(`<div style="font-weight:900;font-size:16px">🎮 舞台挑战 · ${o.title}</div>
    <div style="font-size:12px;color:#fda4af;margin-top:2px">${o.group}</div>
    <p style="font-size:11px;color:#94a3b8;line-height:1.7;margin:10px 0">按 <b style="color:#fff">D F J K</b>（或 ← ↓ ↑ →）在音符落到判定线时击键；手机直接点对应列。时长约 25 秒。成员实力越强判定越宽松（当前 Perfect ±${pw}ms / Good ±${gw}ms）。</p>
    <div style="display:flex;gap:6px;font-size:11px;font-weight:900;text-align:center;margin-bottom:6px">${Object.keys(o.table).map(k => `<div style="flex:1;padding:6px 0;border-radius:10px;background:rgba(255,255,255,.06);color:${GC[k]}">${k}<div style="color:#e2e8f0;font-weight:700">${sgn(o.table[k])}</div></div>`).join('')}</div>
    <div style="font-size:10px;color:#64748b">评级决定${o.effect}（S 级有概率额外加成，D 级有概率出事故）。累计挑战 ${st.plays} 次 · S 评级 ${st.S} 次</div>
    ${btn('s7go', '🎵 开始挑战', true)}${btn('s7auto', '⏭ 自动演出（按实力随机，效果减半）')}
    <label style="display:flex;gap:6px;align-items:center;margin-top:10px;font-size:11px;color:#94a3b8"><input id="s7all" type="checkbox"> 以后都自动演出（跳过小游戏）</label>`);
  const setAll = () => { S.autoAll = ov.querySelector('#s7all').checked; };
  ov.querySelector('#s7auto').onclick = () => { setAll(); unmount(); finish(autoGrade(o.skill), true); };
  ov.querySelector('#s7go').onclick = () => { setAll(); play(ov, o, grade => { if (grade == null) { unmount(); finish(autoGrade(o.skill), true); } else result(ov, o, grade, finish); }); };
}

function result(ov, o, grade, finish) {
  const r = roll(o.table, grade, false), S = ensure7();
  S.stats.plays++; S.stats[grade]++; saveState();
  ov.innerHTML = card(`<div style="text-align:center"><div style="font-size:12px;color:#94a3b8;font-weight:800">${o.title} · ${o.group}</div>
    <div style="font-size:84px;font-weight:900;line-height:1.1;color:${GC[grade]};text-shadow:0 0 30px ${GC[grade]}88">${grade}</div>
    <div style="font-size:12px;color:#e2e8f0;font-weight:800">${o.effect} <span style="color:${r.delta >= 0 ? '#34d399' : '#f87171'}">${sgn(r.delta)}</span></div>
    ${r.note ? `<div style="font-size:11px;color:#fbbf24;margin-top:4px">✨ ${r.note}</div>` : ''}</div>${btn('s7ok', '继续', true)}`);
  ov.querySelector('#s7ok').onclick = () => { unmount(); r.gid = o.gid; o.onDone(r); };
}

function play(ov, o, end) {
  const W = Math.round(Math.min(innerWidth * .94, 440)), H = Math.round(Math.min(innerHeight * .68, 560)), dpr = window.devicePixelRatio || 1;
  ov.innerHTML = `<div style="width:${W}px"><div style="display:flex;justify-content:space-between;align-items:center;color:#fff;font-size:12px;font-weight:800;margin-bottom:6px"><span>${o.title} · ${o.group}</span><button id="s7quit" style="font-size:10px;padding:3px 10px;border-radius:99px;background:rgba(255,255,255,.1);color:#cbd5e1">放弃·改自动</button></div><canvas id="s7cv" style="width:${W}px;height:${H}px;border-radius:20px;touch-action:none;background:#0b0916;display:block"></canvas></div>`;
  const cv = ov.querySelector('#s7cv'); cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const BPM = 124, B = 60 / BPM, FALL = 1.15, BEATS = 52, hitY = H - 70, laneW = W / 4;
  const [pwm, gwm] = winMs(o.skill), PW = pwm / 1000, GW = gwm / 1000;

  // 谱面
  const notes = []; let ln = R(0, 3);
  for (let i = 0; i < BEATS; i++) {
    const t = 3 + i * B;
    if (Math.random() < .88) {
      let l; do { l = Math.random() < .5 ? clamp(ln + rnd([-1, 1]), 0, 3) : R(0, 3); } while (l === ln && Math.random() < .7);
      ln = l; notes.push({ t, l, s: 0 });
      if (Math.random() < .18 && i < BEATS - 1) { let l2 = R(0, 3); if (l2 === l) l2 = (l + 2) % 4; notes.push({ t: t + B / 2, l: l2, s: 0 }); }
      if (Math.random() < .07) notes.push({ t, l: (l + R(1, 3)) % 4, s: 0 });
    }
  }
  const total = notes.length, endT = 3 + BEATS * B + 1;
  let P = 0, G = 0, M = 0, combo = 0, maxC = 0, fb = null, flash = [-9, -9, -9, -9], raf = 0, over = false;

  // 音频（可有可无）
  let ac = null;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); ac.resume && ac.resume(); } catch (e) { ac = null; }
  const tone = (f, t, d, type, v, f2) => { if (!ac) return; try { const os = ac.createOscillator(), g = ac.createGain(); os.type = type; os.frequency.setValueAtTime(f, t); if (f2) os.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); os.connect(g); g.connect(ac.destination); os.start(t); os.stop(t + d + .02); } catch (e) { } };
  const a0 = ac ? ac.currentTime + .05 : 0, t0 = performance.now() + 50;
  if (ac) for (let i = 0; i < BEATS; i++) {
    const t = a0 + 3 + i * B;
    tone(150, t, .14, 'sine', .5, 40); tone(8000, t + B / 2, .04, 'square', .015);
    tone([98, 123, 147, 123][i % 4], t, B * .9, 'triangle', .12);
  }
  const blip = l => tone([523, 587, 659, 784][l], ac ? ac.currentTime : 0, .09, 'sine', .12);
  const now = () => (performance.now() - t0) / 1000;

  function press(l) {
    if (over) return; const s = now(); flash[l] = s; let best = null;
    for (const n of notes) if (!n.s && n.l === l) { const dt = Math.abs(n.t - s); if (dt <= GW && (!best || dt < Math.abs(best.t - s))) best = n; }
    if (!best) return;
    const perfect = Math.abs(best.t - s) <= PW; best.s = perfect ? 1 : 2; perfect ? P++ : G++;
    combo++; maxC = Math.max(maxC, combo); fb = { txt: perfect ? 'PERFECT' : 'GOOD', col: perfect ? '#fbbf24' : '#60a5fa', t: s }; blip(l);
  }
  const onKey = e => { const l = KEYS[e.key]; if (l == null) return; e.preventDefault(); if (!e.repeat) press(l); };
  const onPtr = e => { e.preventDefault(); const r = cv.getBoundingClientRect(); press(clamp(Math.floor((e.clientX - r.left) / r.width * 4), 0, 3)); };
  window.addEventListener('keydown', onKey); cv.addEventListener('pointerdown', onPtr);
  STOP = () => { over = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); cv.removeEventListener('pointerdown', onPtr); try { ac && ac.close(); } catch (e) { } };
  ov.querySelector('#s7quit').onclick = () => { unmount(); end(null); };

  const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  function frame() {
    if (over) return; const s = now();
    for (const n of notes) if (!n.s && s - n.t > GW) { n.s = 3; M++; combo = 0; fb = { txt: 'MISS', col: '#f87171', t: s }; }
    c.clearRect(0, 0, W, H);
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#120a24'); bg.addColorStop(1, '#2a0f3a'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let l = 0; l < 4; l++) {
      c.fillStyle = l % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.015)'; c.fillRect(l * laneW, 0, laneW, H);
      const f = Math.max(0, 1 - (s - flash[l]) / .18); if (f > 0) { const gr = c.createLinearGradient(0, hitY - 160, 0, hitY); gr.addColorStop(0, 'transparent'); gr.addColorStop(1, LANE_COL[l] + Math.round(f * 90).toString(16).padStart(2, '0')); c.fillStyle = gr; c.fillRect(l * laneW, hitY - 160, laneW, 160); }
      c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '800 13px sans-serif'; c.textAlign = 'center'; c.fillText(LANE_TXT[l], l * laneW + laneW / 2, hitY + 44);
    }
    c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(0, hitY, W, 3);
    c.shadowColor = '#ec4899'; c.shadowBlur = 14; c.fillStyle = '#ec4899'; c.fillRect(0, hitY + 1, W, 1); c.shadowBlur = 0;
    for (const n of notes) {
      if (n.s === 1 || n.s === 2 || n.s === 3) continue;
      const y = hitY - (n.t - s) / FALL * hitY; if (y < -30 || y > H + 30) continue;
      c.fillStyle = LANE_COL[n.l]; c.shadowColor = LANE_COL[n.l]; c.shadowBlur = 10; rr(n.l * laneW + 6, y - 12, laneW - 12, 24, 8); c.fill(); c.shadowBlur = 0;
    }
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 0, W, 4); c.fillStyle = '#ec4899'; c.fillRect(0, 0, W * clamp(s / endT, 0, 1), 4);
    const done = P + G + M, acc = done ? (P + G * .6) / done : 1;
    c.textAlign = 'left'; c.fillStyle = '#e2e8f0'; c.font = '800 12px sans-serif'; c.fillText(`准确率 ${Math.round(acc * 100)}%`, 10, 24);
    c.textAlign = 'right'; c.fillText(`P ${P}  G ${G}  M ${M}`, W - 10, 24);
    if (combo >= 2) { c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '900 26px sans-serif'; c.fillText(combo + ' COMBO', W / 2, H * .3); }
    if (s < 3) { c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '900 72px sans-serif'; c.fillText(Math.ceil(3 - s), W / 2, H * .5); }
    else if (s < 3.5) { c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '900 40px sans-serif'; c.fillText('GO!', W / 2, H * .5); }
    if (fb && s - fb.t < .5) { c.globalAlpha = 1 - (s - fb.t) / .5; c.textAlign = 'center'; c.fillStyle = fb.col; c.font = '900 20px sans-serif'; c.fillText(fb.txt, W / 2, hitY - 36); c.globalAlpha = 1; }
    if (s > endT) { const a = (P + G * .6) / total; if (STOP) { STOP(); STOP = null; } return end(gradeOf(a)); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}
/* ================= 接口 1：音乐节目 ================= */
// 由 k_pop.html 的 settleNext 在每档节目结算前调用；返回 true 表示已弹出小游戏，完成后会自动继续结算
function showGate(id, name, sk, gids) {
  const S = ensure7();
  Object.keys(S.mods).forEach(k => { if (k.split('|')[0] !== state.dateStr) delete S.mods[k]; });   // 清理旧周
  const todo = gids.filter(gid => findG(gid) && !S.mods[modKey(id, gid)]);
  if (!todo.length) return false;
  const one = gid => { const g = findG(gid); return { title: `📺 ${name}`, group: g.name, gid, skill: avgSk(g, sk), table: SHOW_MOD, effect: '本档「评审」得分' }; };
  if (S.autoAll) { todo.forEach(gid => { S.mods[modKey(id, gid)] = roll(SHOW_MOD, autoGrade(avgSk(findG(gid), sk)), true); }); return false; }
  const run = i => {
    if (i >= todo.length) { saveState(); return window.settleNext(); }
    const o = one(todo[i]); o.onDone = r => { S.mods[modKey(id, todo[i])] = r; run(i + 1); }; ask(o);
  };
  run(0); return true;
}
// 由 settleShow 在算分时调用：取出并消耗该团本档的加减分
function showMod(id, gid) {
  const S = ensure7(), k = modKey(id, gid), r = S.mods[k]; if (!r) return 0; delete S.mods[k];
  const g = findG(gid);
  showToast(`🎮 ${g ? g.name : ''} 舞台挑战 ${r.grade}${r.auto ? '（自动）' : ''}：评审发挥 ${sgn(r.delta)}${r.note ? ' · ' + r.note : ''}`, r.delta >= 3 ? 'gold' : r.delta >= 0 ? 'success' : 'warn');
  return r.delta;
}

/* ================= 接口 2：回归发行 ================= */
// 在「确认企划并发行」(S5.go) 前插入小游戏；成绩暂存到 launchMod，由下面包装的 launchGroupComeback 消耗
if (window.S5 && S5.go && !S5.__s7) {
  const _go = S5.go; S5.__s7 = 1;
  S5.go = function () {
    const g = getActiveGroup(); if (!g) return _go();
    const S = ensure7(), n = state.discography.length;
    const fire = r => { S.launchMod = r; try { _go(); } finally { S.launchMod = null; } S.cache = state.discography.length > n ? null : r; };   // 资金不足等发行失败时，保留成绩不用重打
    if (S.cache && String(S.cache.gid) === String(g.id)) return fire(S.cache);
    const sk = avgSk(g, ['dance', 'vocal']);
    if (S.autoAll) return fire(Object.assign(roll(LAUNCH_MOD, autoGrade(sk), true), { gid: g.id }));
    ask({ title: '🎬 回归首发舞台', group: g.name, gid: g.id, skill: sk, table: LAUNCH_MOD, effect: '本次专辑质量', onDone: fire });
  };
}
const _lc = launchGroupComeback;
launchGroupComeback = function () {
  const S = ensure7(), r = S.launchMod, g = getActiveGroup();
  if (!r || !g) return _lc();
  S.launchMod = null;
  const had = g.activeComeback, d = r.delta / 0.2;   // 质量公式里 synergy 权重 0.2，临时抬高再还原（与 systems2/3/5 同样的做法）
  g.synergy += d;
  try { _lc(); } finally { g.synergy -= d; }
  if (g.activeComeback !== had) {
    let extra = '';
    if (r.grade === 'S' && Math.random() < .3) { g.fans += 3000; state.totalFans += 3000; extra = '，直拍爆红涨粉 +3000'; if (typeof addTrendPost === 'function') addTrendPost(`🎬 ${g.name} 回归首发舞台直拍爆红！`, '爆 320万', '直拍'); }
    showToast(`🎮 首发舞台 ${r.grade}${r.auto ? '（自动）' : ''}：专辑质量 ${sgn(r.delta)}${r.note ? ' · ' + r.note : ''}${extra}`, r.delta >= 3 ? 'gold' : r.delta >= 0 ? 'success' : 'warn');
    refresh();
  }
};

/* ================= 对外 ================= */
window.S7 = { showGate, mod: showMod, auto: v => { ensure7().autoAll = !!v; saveState(); showToast(v ? '🎮 舞台挑战：已改为自动演出' : '🎮 舞台挑战：已恢复手动挑战', 'info'); },
  practice: () => { const g = state.groups[0]; if (!g) return; const sk = avgSk(g, ['dance', 'vocal']); const S = ensure7(), was = S.autoAll; S.autoAll = false; ask({ title: '练习模式', group: g.name, gid: g.id, skill: sk, table: LAUNCH_MOD, effect: '（练习，不产生任何效果）', onDone: () => { S.autoAll = was; } }); } };
ensure7();
})();
