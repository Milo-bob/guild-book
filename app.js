'use strict';
/* GuildBook – RPG character sheet for real life. All data is stored locally (localStorage). */

const KEY = 'guildbook.v1';
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dstr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => dstr(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dstr(d); };

/* ---------- Spielregeln ---------- */
const defaultDiffs = () => [
  { name: 'Easy', xp: 10, gold: 5 }, { name: 'Medium', xp: 25, gold: 12 },
  { name: 'Hard', xp: 50, gold: 25 }, { name: 'Epic', xp: 100, gold: 50 },
];
const THEMES = {
  night:   { label: 'Night Violet', bg: '#14111f', card: '#241f3a', accent: '#8b6cff', gold: '#f5c542', text: '#ece8ff' },
  forest:  { label: 'Forest',      bg: '#0f1a14', card: '#1b2e23', accent: '#4cd38a', gold: '#e8c15a', text: '#e6f4ea' },
  ember:   { label: 'Ember',          bg: '#1a100e', card: '#2e1b17', accent: '#ff7a45', gold: '#ffd166', text: '#fbeee8' },
  ocean:   { label: 'Ocean',         bg: '#0d1722', card: '#162a3d', accent: '#3fa7ff', gold: '#f5c542', text: '#e6f1fb' },
  parch:   { label: 'Parchment (light)', bg: '#f2e8d0', card: '#fbf5e4', accent: '#8a4b1f', gold: '#b8860b', text: '#2b2013' },
  mono:    { label: 'Black & White',  bg: '#0b0b0b', card: '#1a1a1a', accent: '#e0e0e0', gold: '#ffffff', text: '#f2f2f2' },
};
const FONTS = {
  system: 'system-ui,-apple-system,"Segoe UI",sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
  fantasy: '"Palatino Linotype",Palatino,"Book Antiqua",serif',
  mono: 'ui-monospace,Consolas,monospace',
};
const STAT_COLORS = ['#e5604d', '#4cb5f5', '#8b6cff', '#f5a742', '#e86bc1', '#4cd38a', '#f5d742', '#9aa5b1'];
const defaultSettings = () => ({ charBase: 100, statBase: 60, streakStep: 10, streakMax: 10, preset: 'night', theme: { ...THEMES.night }, font: 'system' });
let DIFF = [], CHAR_BASE = 100, STAT_BASE = 60;
const diffOf = q => DIFF[Math.min(q.diff, DIFF.length - 1)];
const baseReward = q => { const d = diffOf(q); return { d, xp: q.xp > 0 ? q.xp : d.xp, gold: q.gold > 0 ? q.gold : d.gold }; };
const setLevel = (xp, L, base) => { L = Math.max(1, Math.round(L) || 1); return levelOf(xp, base) === L ? xp : total(L, base); };
const total = (L, base) => base * L * (L - 1) / 2;           // XP, die für Level L nötig sind
const levelOf = (xp, base) => { let l = 1; while (xp >= total(l + 1, base)) l++; return l; };
const progress = (xp, base) => { const l = levelOf(xp, base), a = total(l, base), b = total(l + 1, base); return { l, cur: xp - a, need: b - a, pct: (xp - a) / (b - a) * 100 }; };

/* ---------- Startdaten ---------- */
function defaults() {
  const stats = [
    ['kor', 'Body', '💪'], ['geist', 'Mind', '🧠'], ['disz', 'Discipline', '🛡️'],
    ['soz', 'Social', '💬'], ['krea', 'Creativity', '🎨'], ['fok', 'Focus', '🎯'],
  ].map(([id, name, icon], i) => ({ id, name, icon, color: STAT_COLORS[i], xp: 0 }));
  // [id, stat, name, icon, Kosten, Mindest-Statlevel, Voraussetzung, Beschreibung]
  const sk = [
    ['kor1', 'kor', 'Early Bird', '🌅', 1, 1, [], 'Get up early, consistently'],
    ['kor2', 'kor', 'Endurance', '🏃', 2, 2, ['kor1'], 'Cardio as a fixed part of the week'],
    ['kor3', 'kor', 'Iron Body', '🏋️', 3, 4, ['kor2'], 'Strength training as a habit'],
    ['geist1', 'geist', 'Bookworm', '📚', 1, 1, [], 'Read every day'],
    ['geist2', 'geist', 'Learning Machine', '🎓', 2, 2, ['geist1'], 'Learn something new, systematically'],
    ['geist3', 'geist', 'Sage', '🦉', 3, 4, ['geist2'], 'Share and apply what you know'],
    ['disz1', 'disz', 'Routine', '⏰', 1, 1, [], 'Fixed morning/evening routine'],
    ['disz2', 'disz', 'Household Hero', '🧹', 2, 2, ['disz1'], 'Keep things tidy without procrastinating'],
    ['disz3', 'disz', 'Unshakeable', '🗿', 3, 4, ['disz2'], 'Follow through even on bad days'],
    ['soz1', 'soz', 'Icebreaker', '👋', 1, 1, [], 'Start conversations on your own'],
    ['soz2', 'soz', 'Listener', '👂', 2, 2, ['soz1'], 'Have real conversations'],
    ['soz3', 'soz', 'Leader', '👑', 3, 4, ['soz2'], 'Organize groups'],
    ['krea1', 'krea', 'Sketchbook', '✏️', 1, 1, [], 'Be creative regularly'],
    ['krea2', 'krea', 'Project Starter', '🚀', 2, 2, ['krea1'], 'Start your own projects'],
    ['krea3', 'krea', 'Masterpiece', '🏆', 3, 4, ['krea2'], 'Finish a project and show it'],
    ['fok1', 'fok', 'Deep Work', '🔕', 1, 1, [], 'Focus blocks without distractions'],
    ['fok2', 'fok', 'Phone Fasting', '📵', 2, 2, ['fok1'], 'Deliberate offline time'],
    ['fok3', 'fok', 'Flow State', '🌊', 3, 4, ['fok2'], 'Long concentration on demand'],
  ].map(([id, stat, name, icon, cost, minLvl, req, desc]) => ({ id, stat, name, icon, cost, minLvl, req, desc, bonus: 5, unlocked: false }));
  return {
    v: 1, setupDone: false, settings: defaultSettings(), diffs: defaultDiffs(),
    char: { name: 'Nameless Hero', title: 'Adventurer', avatar: '🧙', bio: '' },
    xp: 0, gold: 0, sp: 0,
    stats, skills: sk,
    quests: [
      { id: uid(), title: 'Stretch for 10 minutes', stat: 'kor', diff: 0, type: 'daily', done: false, lastDone: null, streak: 0 },
      { id: uid(), title: 'Read 20 pages', stat: 'geist', diff: 1, type: 'daily', done: false, lastDone: null, streak: 0 },
      { id: uid(), title: 'Tidy up the apartment', stat: 'disz', diff: 2, type: 'once', done: false, lastDone: null, streak: 0 },
    ],
    rewards: [
      { id: uid(), name: 'One episode of a show', icon: '📺', cost: 30, count: 0 },
      { id: uid(), name: 'Order your favorite food', icon: '🍕', cost: 150, count: 0 },
      { id: uid(), name: 'Buy a new game / book', icon: '🎁', cost: 500, count: 0 },
    ],
    log: [],
  };
}

function migrate(d) {
  d.settings = { ...defaultSettings(), ...(d.settings || {}) };
  d.settings.theme = { ...THEMES.night, ...d.settings.theme };
  d.diffs ||= defaultDiffs();
  d.stats.forEach((s, i) => s.color ||= STAT_COLORS[i % STAT_COLORS.length]);
  if (d.setupDone === undefined) d.setupDone = true;
  return d;
}
let S;
try { S = migrate(JSON.parse(localStorage.getItem(KEY)) || defaults()); } catch { S = defaults(); }
function applySettings() {
  const st = S.settings, t = st.theme, r = document.documentElement.style;
  CHAR_BASE = st.charBase; STAT_BASE = st.statBase;
  DIFF = S.diffs.map((d, i) => ({ ...d, mark: '★'.repeat(Math.min(i + 1, 5)) }));
  ['bg', 'card', 'accent', 'gold', 'text'].forEach(k => r.setProperty('--' + k, t[k]));
  r.setProperty('--font', FONTS[st.font] || FONTS.system);
  document.querySelector('meta[name=theme-color]').content = t.bg;
}
applySettings();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('⚠️ Saving failed'); } };
const addLog = text => { S.log.unshift({ t: Date.now(), text }); S.log.length = Math.min(S.log.length, 300); };
const stat = id => S.stats.find(s => s.id === id);
const skill = id => S.skills.find(s => s.id === id);
const questDone = q => q.type === 'daily' ? q.lastDone === today() : q.done;
const streakOf = q => q.type === 'daily' && (q.lastDone === today() || q.lastDone === yesterday()) ? q.streak : 0;
const bonusFor = statId => 1 + S.skills.filter(s => s.unlocked && s.stat === statId).reduce((a, s) => a + (+s.bonus || 0), 0) / 100;

/* ---------- Aktionen ---------- */
let undoSnap = null;
function snapshot() { undoSnap = JSON.stringify(S); }

function completeQuest(id) {
  const q = S.quests.find(x => x.id === id); if (!q || questDone(q)) return;
  snapshot();
  const b = baseReward(q);
  if (q.type === 'daily') { q.streak = q.lastDone === yesterday() ? q.streak + 1 : 1; q.lastDone = today(); }
  else { q.done = true; q.lastDone = today(); }
  const mult = (q.type === 'daily' ? 1 + Math.min(q.streak - 1, S.settings.streakMax) * S.settings.streakStep / 100 : 1);
  const xp = Math.round(b.xp * mult * bonusFor(q.stat)), gold = Math.round(b.gold * mult);
  const lvBefore = levelOf(S.xp, CHAR_BASE), stBefore = levelOf(stat(q.stat).xp, STAT_BASE);
  S.xp += xp; S.gold += gold; stat(q.stat).xp += xp;
  const lvAfter = levelOf(S.xp, CHAR_BASE), stAfter = levelOf(stat(q.stat).xp, STAT_BASE);
  S.sp += lvAfter - lvBefore;
  addLog(`✅ ${q.title}  (+${xp} XP, +${gold} 🪙)`);
  save(); render();
  if (lvAfter > lvBefore) { addLog(`🎉 Reached level ${lvAfter}! +${lvAfter - lvBefore} skill point(s)`); save(); toast(`🎉 LEVEL ${lvAfter}! +${lvAfter - lvBefore} ✨`, true, true); }
  else if (stAfter > stBefore) { addLog(`⬆️ ${stat(q.stat).name} Level ${stAfter}`); save(); toast(`⬆️ ${stat(q.stat).name} Lv ${stAfter}`, true, true); }
  else toast(`+${xp} XP · +${gold} 🪙`, true);
}

function skillState(s) {
  if (s.unlocked) return 'got';
  const reqOk = s.req.every(r => skill(r)?.unlocked);
  const lvOk = levelOf(stat(s.stat).xp, STAT_BASE) >= s.minLvl;
  return reqOk && lvOk ? 'avail' : 'locked';
}
function unlockSkill(id) {
  const s = skill(id); if (!s || s.unlocked) return;
  const st = skillState(s);
  if (st !== 'avail') return toast(missingText(s));
  if (S.sp < s.cost) return toast(`Not enough skill points (${S.sp}/${s.cost} ✨)`);
  snapshot(); S.sp -= s.cost; s.unlocked = true;
  addLog(`🌳 Skill unlocked: ${s.icon} ${s.name} (+${s.bonus}% XP ${stat(s.stat).name})`);
  save(); render(); toast(`${s.icon} ${s.name} unlocked!`, true, true);
}
function missingText(s) {
  const m = [];
  s.req.forEach(r => { if (!skill(r)?.unlocked) m.push(`Skill “${skill(r)?.name ?? '?'}”`); });
  const lv = levelOf(stat(s.stat).xp, STAT_BASE);
  if (lv < s.minLvl) m.push(`${stat(s.stat).name} Lv ${s.minLvl} (now ${lv})`);
  return 'Missing: ' + m.join(', ');
}
function buy(id) {
  const r = S.rewards.find(x => x.id === id);
  if (S.gold < r.cost) return toast(`Not enough gold (${S.gold}/${r.cost} 🪙)`);
  snapshot(); S.gold -= r.cost; r.count++;
  addLog(`🛒 Reward redeemed: ${r.icon} ${r.name} (−${r.cost} 🪙)`);
  save(); render(); toast(`${r.icon} Enjoy!`, true);
}

/* ---------- Toast / Dialog ---------- */
let toastT;
function toast(msg, undo = false, big = false) {
  const t = $('#toast'); t.hidden = false; t.className = big ? 'big' : '';
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button id="undo">Undo</button>' : ''}`;
  if (undo) $('#undo').onclick = () => { if (undoSnap) { S = JSON.parse(undoSnap); undoSnap = null; save(); render(); } t.hidden = true; };
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, undo ? 5000 : 3000);
}

function form(title, fields, onSave, onDel) {
  const d = $('#dlg');
  const fh = f => {
    const v = f.value ?? '';
    if (f.type === 'select') return `<label class="f">${f.label}<select name="${f.key}">${f.options.map(([val, txt]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(txt)}</option>`).join('')}</select></label>`;
    if (f.type === 'checks') return f.options.length ? `<div class="f"><div>${f.label}</div><div class="checks">${f.options.map(([val, txt]) => `<label><input type="checkbox" name="${f.key}" value="${esc(val)}"${(v || []).includes(val) ? ' checked' : ''}> ${esc(txt)}</label>`).join('')}</div></div>` : '';
    if (f.type === 'bool') return `<label class="f" style="display:flex;gap:8px;align-items:center;color:var(--text)"><input type="checkbox" name="${f.key}"${v ? ' checked' : ''} style="width:auto;margin:0"> ${f.label}</label>`;
    if (f.type === 'textarea') return `<label class="f">${f.label}<textarea name="${f.key}" rows="3">${esc(v)}</textarea></label>`;
    return `<label class="f">${f.label}<input name="${f.key}" type="${f.type || 'text'}" value="${esc(v)}"${f.type === 'number' && !f.neg ? ' min="0"' : ''}${f.req ? ' required' : ''}></label>`;
  };
  d.innerHTML = `<form id="f"><h3>${esc(title)}</h3>${fields.map(fh).join('')}<div class="row"><button type="button" class="btn ghost" id="cancel">Cancel</button>${onDel ? '<button type="button" class="btn danger" id="del">Delete</button>' : ''}<button class="btn">Save</button></div></form>`;
  $('#cancel').onclick = () => d.close();
  if (onDel) $('#del').onclick = () => { if (confirm('Really delete?')) { onDel(); d.close(); save(); render(); } };
  $('#f').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target), out = {};
    fields.forEach(f => out[f.key] = f.type === 'checks' ? fd.getAll(f.key) : f.type === 'bool' ? fd.get(f.key) === 'on' : f.type === 'number' ? (f.neg ? (+fd.get(f.key) || 0) : Math.max(0, +fd.get(f.key) || 0)) : String(fd.get(f.key) ?? '').trim());
    onSave(out); d.close(); save(); render();
  };
  d.showModal();
}

const statOptions = () => S.stats.map(s => [s.id, `${s.icon} ${s.name}`]);
const diffOptions = () => DIFF.map((d, i) => [i, `${d.mark} ${d.name} (${d.xp} XP / ${d.gold} 🪙)`]);

function editQuest(id) {
  const q = S.quests.find(x => x.id === id) || { title: '', stat: S.stats[0].id, diff: 1, type: 'daily', xp: 0, gold: 0, note: '' };
  form(id ? 'Edit quest' : 'New quest', [
    { key: 'title', label: 'Title', value: q.title, req: true },
    { key: 'note', label: 'Note / description', type: 'textarea', value: q.note },
    { key: 'type', label: 'Type', type: 'select', value: q.type, options: [['daily', '🔁 Daily (repeats)'], ['once', '⭐ One-time']] },
    { key: 'stat', label: 'Attribute', type: 'select', value: q.stat, options: statOptions() },
    { key: 'diff', label: 'Difficulty', type: 'select', value: q.diff, options: diffOptions() },
    { key: 'xp', label: 'Custom XP (0 = use difficulty value)', type: 'number', value: q.xp },
    { key: 'gold', label: 'Custom gold (0 = use difficulty value)', type: 'number', value: q.gold },
  ], o => {
    o.diff = +o.diff;
    if (id) Object.assign(q, o);
    else S.quests.push({ id: uid(), ...o, done: false, lastDone: null, streak: 0 });
  }, id ? () => { S.quests = S.quests.filter(x => x.id !== id); } : null);
}
function editSkill(id) {
  const s = skill(id) || { name: '', icon: '⭐', stat: S.stats[0].id, cost: 1, minLvl: 1, req: [], desc: '', bonus: 5 };
  form(id ? 'Edit skill' : 'New skill', [
    { key: 'name', label: 'Name', value: s.name, req: true },
    { key: 'icon', label: 'Emoji', value: s.icon },
    { key: 'stat', label: 'Attribute', type: 'select', value: s.stat, options: statOptions() },
    { key: 'desc', label: 'Description (what does this skill mean in real life?)', value: s.desc },
    { key: 'cost', label: 'Cost (skill points)', type: 'number', value: s.cost },
    { key: 'minLvl', label: 'Minimum attribute level', type: 'number', value: s.minLvl },
    { key: 'bonus', label: 'Bonus: +% XP for this attribute', type: 'number', value: s.bonus },
    { key: 'unlocked', label: 'Already unlocked (costs nothing)', type: 'bool', value: s.unlocked },
    { key: 'req', label: 'Requirements', type: 'checks', value: s.req, options: S.skills.filter(x => x.id !== id).map(x => [x.id, `${x.icon} ${x.name}`]) },
  ], o => {
    o.cost = Math.max(1, o.cost); o.minLvl = Math.max(1, o.minLvl);
    if (id) Object.assign(s, o);
    else S.skills.push({ id: uid(), ...o });
  }, id ? () => { S.skills = S.skills.filter(x => x.id !== id); S.skills.forEach(x => x.req = x.req.filter(r => r !== id)); } : null);
}
function editReward(id) {
  const r = S.rewards.find(x => x.id === id) || { name: '', icon: '🎁', cost: 50 };
  form(id ? 'Edit reward' : 'New reward', [
    { key: 'name', label: 'Name', value: r.name, req: true },
    { key: 'icon', label: 'Emoji', value: r.icon },
    { key: 'cost', label: 'Price (gold)', type: 'number', value: r.cost },
  ], o => { if (id) Object.assign(r, o); else S.rewards.push({ id: uid(), ...o, count: 0 }); },
  id ? () => { S.rewards = S.rewards.filter(x => x.id !== id); } : null);
}
function editChar() {
  form('Character Sheet', [
    { key: 'avatar', label: 'Avatar (Emoji)', value: S.char.avatar },
    { key: 'name', label: 'Name', value: S.char.name, req: true },
    { key: 'title', label: 'Class / Title', value: S.char.title },
    { key: 'bio', label: 'About me / goals', type: 'textarea', value: S.char.bio },
  ], o => Object.assign(S.char, o));
}

/* Character Builder: Startwerte frei setzen (Level, Gold, Skillpunkte, Level je Attribut) */
function charBuilder() {
  form('🧙 Character Builder', [
    { key: 'avatar', label: 'Avatar (Emoji)', value: S.char.avatar },
    { key: 'name', label: 'Name', value: S.char.name, req: true },
    { key: 'title', label: 'Class / Title', value: S.char.title },
    { key: 'bio', label: 'About me / goals', type: 'textarea', value: S.char.bio },
    { key: 'clvl', label: 'Overall level', type: 'number', value: levelOf(S.xp, CHAR_BASE) },
    { key: 'gold', label: 'Gold', type: 'number', value: S.gold },
    { key: 'sp', label: 'Free skill points', type: 'number', value: S.sp },
    ...S.stats.map(s => ({ key: 'lv_' + s.id, label: `${s.icon} ${esc(s.name)} – current level`, type: 'number', value: levelOf(s.xp, STAT_BASE) })),
  ], o => {
    Object.assign(S.char, { avatar: o.avatar, name: o.name, title: o.title, bio: o.bio });
    S.xp = setLevel(S.xp, o.clvl, CHAR_BASE);
    S.gold = o.gold; S.sp = o.sp;
    S.stats.forEach(s => s.xp = setLevel(s.xp, o['lv_' + s.id], STAT_BASE));
    addLog('🧙 Character values set in the builder');
  });
}

function editStat(id) {
  const s = stat(id) || { name: '', icon: '⭐', color: STAT_COLORS[S.stats.length % STAT_COLORS.length], xp: 0 };
  form(id ? 'Edit attribute' : 'New attribute', [
    { key: 'name', label: 'Name', value: s.name, req: true },
    { key: 'icon', label: 'Emoji', value: s.icon },
    { key: 'color', label: 'Color', type: 'color', value: s.color },
    { key: 'lvl', label: 'Current level', type: 'number', value: levelOf(s.xp, STAT_BASE) },
  ], o => {
    const xp = setLevel(s.xp, o.lvl, STAT_BASE);
    if (id) Object.assign(s, { name: o.name, icon: o.icon, color: o.color, xp });
    else S.stats.push({ id: uid(), name: o.name, icon: o.icon, color: o.color, xp });
  }, id && S.stats.length > 1 ? () => {
    S.stats = S.stats.filter(x => x.id !== id);
    S.quests.forEach(q => { if (q.stat === id) q.stat = S.stats[0].id; });
    const gone = S.skills.filter(k => k.stat === id).map(k => k.id);
    S.skills = S.skills.filter(k => k.stat !== id);
    S.skills.forEach(k => k.req = k.req.filter(r => !gone.includes(r)));
  } : null);
}

/* Beliebige Änderung/Erfolg nachtragen (auch negativ) */
function manualEntry() {
  form('✍️ Log a change', [
    { key: 'kind', label: 'What?', type: 'select', value: 'stat', options: [['stat', 'XP in an attribute (also counts toward overall level)'], ['xp', 'Overall XP only'], ['gold', 'Gold'], ['sp', 'Skill points']] },
    { key: 'stat', label: 'Attribute (only for “XP in an attribute”)', type: 'select', value: S.stats[0].id, options: statOptions() },
    { key: 'amount', label: 'Amount (negative to subtract)', type: 'number', neg: true, value: 50 },
    { key: 'note', label: 'Note (e.g. “Ran a marathon”)', value: '' },
  ], o => {
    const a = Math.round(o.amount); if (!a) return;
    const lvBefore = levelOf(S.xp, CHAR_BASE);
    if (o.kind === 'gold') S.gold = Math.max(0, S.gold + a);
    else if (o.kind === 'sp') S.sp = Math.max(0, S.sp + a);
    else {
      S.xp = Math.max(0, S.xp + a);
      if (o.kind === 'stat') { const st = stat(o.stat); st.xp = Math.max(0, st.xp + a); }
      const gained = levelOf(S.xp, CHAR_BASE) - lvBefore; if (gained > 0) S.sp += gained;
    }
    const what = { stat: `${stat(o.stat)?.name} XP`, xp: 'XP', gold: '🪙', sp: '✨' }[o.kind];
    addLog(`✍️ ${o.note || 'Manual change'}  (${a > 0 ? '+' : ''}${a} ${what})`);
  });
}

function editDiffs() {
  const f = [];
  S.diffs.forEach((d, i) => f.push(
    { key: 'n' + i, label: `Tier ${i + 1} – name`, value: d.name, req: true },
    { key: 'x' + i, label: 'XP', type: 'number', value: d.xp },
    { key: 'g' + i, label: 'Gold', type: 'number', value: d.gold }));
  f.push({ key: 'add', label: 'Add new tier (name, empty = none)', value: '' });
  form('Difficulty tiers', f, o => {
    S.diffs = S.diffs.map((d, i) => ({ name: o['n' + i], xp: o['x' + i], gold: o['g' + i] }));
    if (o.add) { const l = S.diffs[S.diffs.length - 1]; S.diffs.push({ name: o.add, xp: l.xp * 2, gold: l.gold * 2 }); }
  });
}

function editRules() {
  const st = S.settings;
  form('Rules & level curve', [
    { key: 'charBase', label: 'XP needed for overall level 2 (curve grows quadratically)', type: 'number', value: st.charBase },
    { key: 'statBase', label: 'XP needed for attribute level 2', type: 'number', value: st.statBase },
    { key: 'streakStep', label: 'Streak bonus per day in % (daily quests)', type: 'number', value: st.streakStep },
    { key: 'streakMax', label: 'Streak bonus counts up to day …', type: 'number', value: st.streakMax },
  ], o => {
    // Level beibehalten, wenn sich die Kurve ändert
    const cl = levelOf(S.xp, CHAR_BASE), sl = S.stats.map(s => levelOf(s.xp, STAT_BASE));
    Object.assign(st, { charBase: Math.max(1, o.charBase), statBase: Math.max(1, o.statBase), streakStep: o.streakStep, streakMax: o.streakMax });
    CHAR_BASE = st.charBase; STAT_BASE = st.statBase;
    S.xp = total(cl, CHAR_BASE);
    S.stats.forEach((s, i) => s.xp = total(sl[i], STAT_BASE));
  });
}

function editDesign() {
  const st = S.settings, t = st.theme;
  form('🎨 Design', [
    { key: 'preset', label: 'Color scheme', type: 'select', value: st.preset || 'custom', options: [...Object.entries(THEMES).map(([k, v]) => [k, v.label]), ['custom', 'Custom colors (below)']] },
    { key: 'bg', label: 'Custom colors – background', type: 'color', value: t.bg },
    { key: 'card', label: 'Cards', type: 'color', value: t.card },
    { key: 'accent', label: 'Accent', type: 'color', value: t.accent },
    { key: 'gold', label: 'Gold', type: 'color', value: t.gold },
    { key: 'text', label: 'Text', type: 'color', value: t.text },
    { key: 'font', label: 'Font', type: 'select', value: st.font, options: [['system', 'Default'], ['serif', 'Serif (Georgia)'], ['fantasy', 'Fantasy (Palatino)'], ['mono', 'Monospace']] },
  ], o => {
    st.preset = o.preset;
    st.theme = o.preset === 'custom' ? { bg: o.bg, card: o.card, accent: o.accent, gold: o.gold, text: o.text } : (({ label, ...c }) => c)(THEMES[o.preset]);
    st.font = o.font;
  });
}

function clearExamples() {
  if (!confirm('Remove all example quests, skills and rewards? (Level, gold and attributes stay)')) return;
  S.quests = []; S.skills = []; S.rewards = []; save(); render(); toast('All clear – get started!');
}

/* ---------- Ansichten ---------- */
let tab = 'hero';

function radar() {
  const n = S.stats.length, c = 100, R = 78;
  if (n < 3) return '';
  const lv = S.stats.map(s => levelOf(s.xp, STAT_BASE)), max = Math.max(5, ...lv);
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * r, c + Math.sin(a) * r]; };
  const poly = r => S.stats.map((_, i) => pt(i, r).map(v => v.toFixed(1)).join(',')).join(' ');
  const data = lv.map((l, i) => pt(i, R * l / max).map(v => v.toFixed(1)).join(',')).join(' ');
  const rings = [1 / 3, 2 / 3, 1].map(k => `<polygon points="${poly(R * k)}"/>`).join('');
  const labels = S.stats.map((s, i) => { const [x, y] = pt(i, R + 18); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${s.icon}</text>`; }).join('');
  return `<svg class="radar" viewBox="-10 -10 220 220" role="img" aria-label="Attribute overview">${rings}<polygon class="data" points="${data}"/>${labels}</svg>`;
}

function viewHero() {
  const p = progress(S.xp, CHAR_BASE);
  const dailies = S.quests.filter(q => q.type === 'daily'), doneN = dailies.filter(questDone).length;
  const pass = S.skills.filter(s => s.unlocked);
  return `
  <div class="card"><div class="hero">
    <div class="avatar">${esc(S.char.avatar)}</div>
    <div style="flex:1;min-width:0"><h1>${esc(S.char.name)}</h1>
      <div class="muted">${esc(S.char.title)} · <span class="lvl">Level ${p.l}</span></div>
      <div class="bar xp" style="margin-top:8px"><div style="width:${p.pct}%"></div></div>
      <div class="muted small">${p.cur} / ${p.need} XP</div></div>
    <button class="edit" data-act="editChar" title="Edit">✎</button>
  </div>${S.char.bio ? `<p class="muted small" style="margin:12px 0 0;white-space:pre-wrap">${esc(S.char.bio)}</p>` : ''}</div>

  <div class="card"><div class="muted">Today: <b>${doneN}/${dailies.length}</b> dailies done</div>
    <div class="bar" style="margin-top:6px"><div style="width:${dailies.length ? doneN / dailies.length * 100 : 0}%"></div></div>
    <div class="row" style="justify-content:flex-start;margin-top:12px"><button class="btn sm ghost" data-act="manual">✍️ Log a change</button><button class="btn sm ghost" data-act="builder">🧙 Character Builder</button></div></div>

  <h2>Attributes</h2>
  <div class="card">${radar()}
    ${S.stats.map(s => { const sp = progress(s.xp, STAT_BASE); return `
      <div class="stat"><span style="font-size:22px">${s.icon}</span><b>${esc(s.name)}</b><span class="lvl">Lv ${sp.l}</span>
      <div class="bar"><div style="width:${sp.pct}%;background:${esc(s.color)}"></div></div></div>`; }).join('')}
  </div>

  <h2>Active skills</h2>
  <div class="card">${pass.length ? pass.map(s => `<span class="pill">${s.icon} ${esc(s.name)} <span class="muted">+${s.bonus}% ${esc(stat(s.stat).name)}</span></span>`).join('') : '<span class="muted">None yet – unlock some in the skill tree.</span>'}</div>`;
}

function questRow(q) {
  const done = questDone(q), { d, xp, gold } = baseReward(q), st = stat(q.stat) || S.stats[0], sk = streakOf(q);
  return `<div class="card quest${done ? ' done' : ''}">
    <button class="check" data-act="done" data-id="${q.id}" ${done ? 'disabled' : ''} aria-label="Complete">${done ? '✓' : ''}</button>
    <div class="qt"><b>${esc(q.title)}</b><span class="muted small">${st.icon} ${esc(st.name)} · <span class="diff">${d.mark}</span>${sk > 1 ? ` · 🔥 ${sk}` : ''}</span>${q.note ? `<span class="muted small" style="display:block">${esc(q.note)}</span>` : ''}</div>
    <div class="reward">+${xp} XP<br>+${gold} 🪙</div>
    <button class="edit" data-act="editQuest" data-id="${q.id}" aria-label="Edit">✎</button></div>`;
}
function viewQuests() {
  const daily = S.quests.filter(q => q.type === 'daily'), once = S.quests.filter(q => q.type === 'once' && !q.done), fin = S.quests.filter(q => q.type === 'once' && q.done);
  return `<h2>Daily quests <button class="btn sm" data-act="newQuest">+ New</button></h2>
    ${daily.map(questRow).join('') || '<div class="empty">No daily quests.</div>'}
    <h2>Main quests</h2>${once.map(questRow).join('') || '<div class="empty">No open quests.</div>'}
    ${fin.length ? `<h2>Completed</h2>${fin.map(questRow).join('')}` : ''}`;
}

function viewSkills() {
  const depth = (s, seen = new Set()) => { if (seen.has(s.id)) return 0; seen.add(s.id); return s.req.length ? 1 + Math.max(...s.req.map(r => skill(r) ? depth(skill(r), seen) : 0)) : 0; };
  const branches = S.stats.map(st => {
    const list = S.skills.filter(s => s.stat === st.id); if (!list.length) return '';
    const tiers = {}; list.forEach(s => (tiers[depth(s)] ||= []).push(s));
    const rows = Object.keys(tiers).sort((a, b) => a - b).map(k => `<div class="tier">${tiers[k].map(s => {
      const state = skillState(s);
      return `<div class="node ${state}" data-act="skill" data-id="${s.id}"><div class="ic">${state === 'locked' ? '🔒' : esc(s.icon)}</div><b>${esc(s.name)}</b>
        <small>${esc(s.desc)}</small><small>${s.unlocked ? `✔ +${s.bonus}% XP` : `${s.cost} ✨ · Lv ${s.minLvl}`}</small></div>`;
    }).join('')}</div>`).join('<div class="arrow">▼</div>');
    return `<div class="card branch"><h3>${st.icon} ${esc(st.name)} <span class="lvl">Lv ${levelOf(st.xp, STAT_BASE)}</span></h3>${rows}</div>`;
  }).join('');
  return `<h2>Skilltree <button class="btn sm" data-act="newSkill">+ Skill</button></h2>
    <p class="muted small">Level-ups grant skill points. Tap a skill to unlock it, long-press or ✎ to edit. Skills give permanent bonus XP.</p>${branches}`;
}

function viewShop() {
  return `<h2>Rewards <button class="btn sm" data-act="newReward">+ New</button></h2>
    <p class="muted small">Treat yourself – define your own rewards and redeem them with gold.</p>
    ${S.rewards.map(r => `<div class="card item"><span class="ic">${esc(r.icon)}</span>
      <div class="qt"><b>${esc(r.name)}</b><div class="muted small">redeemed ${r.count}×</div></div>
      <button class="btn sm" data-act="buy" data-id="${r.id}" ${S.gold < r.cost ? 'disabled' : ''}>${r.cost} 🪙</button>
      <button class="edit" data-act="editReward" data-id="${r.id}" aria-label="Edit">✎</button></div>`).join('') || '<div class="empty">No rewards yet.</div>'}`;
}

function viewLog() {
  const fmt = t => new Date(t).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
  return `<h2>Chronicle</h2><div class="card">${S.log.map(l => `<div class="logline"><time>${fmt(l.t)}</time>${esc(l.text)}</div>`).join('') || '<div class="empty">Nothing yet. Complete your first quest!</div>'}</div>`;
}

function viewSetup() {
  const row = (act, t) => `<button class="btn sm ghost" data-act="${act}">${t}</button>`;
  return `<h2>Character</h2><div class="card"><div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin:0">
      ${row('builder', '🧙 Character Builder')}${row('manual', '✍️ Log a change')}${row('editChar', '✎ Name & Bio')}</div>
    <p class="muted small" style="margin-bottom:0">Builder: freely set overall level, gold, skill points and the level of every attribute – e.g. if you are already level 10.</p></div>
  <h2>Attributes <button class="btn sm" data-act="newStat">+ Attribute</button></h2>
  ${S.stats.map(s => `<div class="card item"><span class="ic">${esc(s.icon)}</span><div class="qt"><b>${esc(s.name)}</b>
      <div class="muted small">Level ${levelOf(s.xp, STAT_BASE)} · ${s.xp} XP</div></div>
      <span style="width:18px;height:18px;border-radius:50%;background:${esc(s.color)};flex:none"></span>
      <button class="edit" data-act="editStat" data-id="${s.id}" aria-label="Edit">✎</button></div>`).join('')}
  <h2>Rules</h2><div class="card"><div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin:0">
      ${row('diffs', '⚔️ Difficulty tiers')}${row('rules', '📈 Level curve & streaks')}</div>
    <p class="muted small" style="margin-bottom:0">Tiers: ${DIFF.map(d => `${esc(d.name)} (${d.xp} XP / ${d.gold} 🪙)`).join(' · ')}</p></div>
  <h2>Design</h2><div class="card">${row('design', '🎨 Colors & font')}</div>
  <h2>Data</h2><div class="card">
    <p class="muted small" style="margin-top:0">Everything is stored only on this device. Export a backup regularly.</p>
    <div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-top:0">
      <button class="btn sm" data-act="export">⬇ Export</button>
      <button class="btn sm ghost" data-act="import">⬆ Import</button>
      <button class="btn sm ghost" data-act="clearEx">Remove example data</button>
      <button class="btn sm danger" data-act="reset">Reset everything</button></div></div>`;
}

function render() {
  applySettings();
  $('#gold').textContent = S.gold; $('#sp').textContent = S.sp;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const y = window.scrollY;
  $('#view').innerHTML = { hero: viewHero, quests: viewQuests, skills: viewSkills, shop: viewShop, log: viewLog, setup: viewSetup }[tab]();
  window.scrollTo(0, y);
}

/* ---------- Events ---------- */
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.tab; window.scrollTo(0, 0); render(); } };

let pressT, pressed = false;
$('#view').addEventListener('pointerdown', e => {
  const n = e.target.closest('[data-act="skill"]'); pressed = false;
  if (n) pressT = setTimeout(() => { pressed = true; editSkill(n.dataset.id); }, 600);
});
['pointerup', 'pointerleave', 'pointercancel', 'scroll'].forEach(ev => $('#view').addEventListener(ev, () => clearTimeout(pressT), true));

$('#view').onclick = e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (pressed) { pressed = false; return; }
  const id = el.dataset.id;
  ({
    done: () => completeQuest(id), editQuest: () => editQuest(id), newQuest: () => editQuest(),
    skill: () => unlockSkill(id), newSkill: () => editSkill(), buy: () => buy(id),
    editReward: () => editReward(id), newReward: () => editReward(), editChar,
    builder: charBuilder, manual: manualEntry, newStat: () => editStat(), editStat: () => editStat(id),
    diffs: editDiffs, rules: editRules, design: editDesign, clearEx: clearExamples,
    export: exportData, import: () => $('#importFile').click(),
    reset: () => { if (confirm('Delete ALL data and start over?')) { S = defaults(); S.setupDone = true; save(); render(); charBuilder(); } },
  })[el.dataset.act]?.();
};

function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
  a.download = `guildbook-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || d.v !== 1 || !Array.isArray(d.stats) || !Array.isArray(d.quests)) throw 0;
    if (!confirm('Replace current data with the backup?')) return;
    S = migrate(d); save(); render(); toast('Backup loaded');
  } catch { toast('⚠️ Invalid file'); }
};

document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); }); // Tageswechsel
render();
if (!S.setupDone) { S.setupDone = true; save(); charBuilder(); } // Ersteinrichtung

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
