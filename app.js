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
  dragon:  { label: 'Dragon Red (D&D)', bg: '#17110e', card: '#2a1f19', accent: '#b3262d', gold: '#d9a93c', text: '#f2e6cf' },
  night:  { label: 'Night Violet', bg: '#14111f', card: '#241f3a', accent: '#8b6cff', gold: '#f5c542', text: '#ece8ff' },
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
const defaultSettings = () => ({ charBase: 100, statBase: 60, streakStep: 10, streakMax: 10, preset: 'dragon', theme: (({ label, ...c }) => c)(THEMES.dragon), font: 'fantasy', bgImage: '', bgDim: 70, hpOn: true });
const STAT_CLASS = { kor: 'Warrior', geist: 'Wizard', disz: 'Paladin', soz: 'Bard', krea: 'Artificer', fok: 'Monk' };
const TIERS = [[20, 'Grandmaster'], [15, 'Master'], [10, 'Expert'], [5, 'Adept'], [1, 'Novice']];
const REWARD_KINDS = [['', 'Normal reward'], ['shield', '🛡️ Streak shield (+1 shield)'], ['potion', '🧪 Healing potion (+10 HP)']];
const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];
const CHAR_KEYS = ['avatar', 'avatarImg', 'name', 'title', 'race', 'background', 'alignment', 'bio'];

/* Datum-Helfer für wöchentliche Quests (Woche beginnt am Montag) */
const monday = d => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return dstr(x); };
const thisWeek = () => monday(today());
const lastWeek = () => { const x = new Date(thisWeek() + 'T12:00:00'); x.setDate(x.getDate() - 7); return dstr(x); };

/* Bild einlesen, verkleinern und als JPEG-Data-URL zurückgeben (square = mittig quadratisch zuschneiden) */
const readImg = (file, max, square, q) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onerror = rej;
  fr.onload = () => {
    const im = new Image();
    im.onerror = rej;
    im.onload = () => {
      let sx = 0, sy = 0, sw = im.width, sh = im.height, cw, ch;
      if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; cw = ch = Math.min(max, m); }
      else { const k = Math.min(1, max / Math.max(sw, sh)); cw = Math.round(sw * k); ch = Math.round(sh * k); }
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, cw, ch);
      res(c.toDataURL('image/jpeg', q));
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
});
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
  ].map(([id, name, icon], i) => ({ id, name, icon, color: STAT_COLORS[i], cls: STAT_CLASS[id], xp: 0 }));
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
    char: { name: 'Nameless Hero', title: 'Adventurer', race: 'Human', background: 'Commoner', alignment: 'True Neutral', avatar: '🧙', avatarImg: '', bio: '' },
    xp: 0, gold: 0, sp: 0,
    stats, skills: sk,
    quests: [
      { id: uid(), title: 'Stretch for 10 minutes', stat: 'kor', diff: 0, type: 'daily', done: false, lastDone: null, streak: 0 },
      { id: uid(), title: 'Read 20 pages', stat: 'geist', diff: 1, type: 'daily', done: false, lastDone: null, streak: 0 },
      { id: uid(), title: 'Tidy up the apartment', stat: 'disz', diff: 2, type: 'once', done: false, lastDone: null, streak: 0 },
    ],
    hp: 20, shields: 0, lastCheck: today(), bosses: [], hpIntro: true,
    rewards: [
      { id: uid(), name: 'Streak shield', icon: '🛡️', cost: 100, count: 0, kind: 'shield' },
      { id: uid(), name: 'Healing potion', icon: '🧪', cost: 40, count: 0, kind: 'potion' },
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
  d.char = { race: '', background: '', alignment: '', avatarImg: '', ...d.char };
  d.hp ??= 20 + 4 * (levelOf(d.xp || 0, d.settings.charBase) - 1);
  d.shields ??= 0; d.bosses ||= []; d.lastCheck ||= today();
  d.quests.forEach(q => q.created ||= today());
  d.stats.forEach(s => { if (s.cls === undefined) s.cls = STAT_CLASS[s.id] || ''; });
  if (!d.hpIntro) {
    d.hpIntro = true;
    d.rewards.unshift({ id: uid(), name: 'Streak shield', icon: '🛡️', cost: 100, count: 0, kind: 'shield' }, { id: uid(), name: 'Healing potion', icon: '🧪', cost: 40, count: 0, kind: 'potion' });
  }
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
  r.setProperty('--dim', (st.bgDim ?? 70) / 100);
  $('#bgimg').style.backgroundImage = st.bgImage ? `url("${st.bgImage}")` : 'none';
  document.body.classList.toggle('has-bg', !!st.bgImage);
  document.querySelector('meta[name=theme-color]').content = t.bg;
}
applySettings();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('⚠️ Saving failed'); } };
const addLog = text => { S.log.unshift({ t: Date.now(), text }); S.log.length = Math.min(S.log.length, 300); };
const stat = id => S.stats.find(s => s.id === id);
const skill = id => S.skills.find(s => s.id === id);
const isRepeat = q => q.type === 'daily' || q.type === 'weekly';
const donePeriod = q => !!q.lastDone && (q.type === 'weekly' ? monday(q.lastDone) === thisWeek() : q.lastDone === today());
const prevPeriod = q => !!q.lastDone && (q.type === 'weekly' ? monday(q.lastDone) === lastWeek() : q.lastDone === yesterday());
const questDone = q => isRepeat(q) ? donePeriod(q) : q.done;
const streakOf = q => isRepeat(q) && (donePeriod(q) || prevPeriod(q)) ? q.streak : 0;
const bonusFor = statId => 1 + S.skills.filter(s => s.unlocked && s.stat === statId).reduce((a, s) => a + (+s.bonus || 0), 0) / 100;

/* ---------- Aktionen ---------- */
let undoSnap = null;
function snapshot() { undoSnap = JSON.stringify(S); }

function completeQuest(id) {
  const q = S.quests.find(x => x.id === id); if (!q || questDone(q)) return;
  snapshot();
  const b = baseReward(q);
  if (isRepeat(q)) { q.streak = prevPeriod(q) ? q.streak + 1 : 1; q.lastDone = today(); }
  else { q.done = true; q.lastDone = today(); }
  const mult = (isRepeat(q) ? 1 + Math.min(q.streak - 1, S.settings.streakMax) * S.settings.streakStep / 100 : 1);
  const xp = Math.round(b.xp * mult * bonusFor(q.stat)), gold = Math.round(b.gold * mult);
  const lvBefore = levelOf(S.xp, CHAR_BASE), stBefore = levelOf(stat(q.stat).xp, STAT_BASE);
  S.xp += xp; S.gold += gold; stat(q.stat).xp += xp;
  const slain = hitBosses(q, xp);
  const lvAfter = levelOf(S.xp, CHAR_BASE), stAfter = levelOf(stat(q.stat).xp, STAT_BASE);
  S.sp += lvAfter - lvBefore;
  S.hp = lvAfter > lvBefore ? maxHp() : Math.min(maxHp(), S.hp + 1 + q.diff);
  addLog(`✅ ${q.title}  (+${xp} XP, +${gold} 🪙)`);
  save(); render();
  if (slain.length) toast(`⚔️ ${slain.map(b => b.name).join(', ')} defeated! +${slain.reduce((a, b) => a + b.gold, 0)} 🪙`, true, true);
  else if (lvAfter > lvBefore) { addLog(`🎉 Reached level ${lvAfter}! +${lvAfter - lvBefore} skill point(s)`); save(); toast(`🎉 LEVEL ${lvAfter}! +${lvAfter - lvBefore} ✨`, true, true); }
  else if (stAfter > stBefore) { addLog(`⬆️ ${stat(q.stat).name} Level ${stAfter}`); save(); toast(`⬆️ ${stat(q.stat).name} Lv ${stAfter}`, true, true); }
  else toast(`+${xp} XP · +${gold} 🪙`, true);
}

/* ---------- HP, Bosse, Klassen-Pfad ---------- */
const maxHp = () => 20 + 4 * (levelOf(S.xp, CHAR_BASE) - 1);

// Jede erledigte Quest richtet Schaden (= XP) an allen passenden Bossen an
function hitBosses(q, xp) {
  const slain = [];
  S.bosses.filter(b => !b.defeated && (!b.stat || b.stat === q.stat)).forEach(b => {
    b.hp = Math.max(0, b.hp - xp);
    if (b.hp > 0) return;
    b.defeated = true; S.gold += b.gold; S.xp += b.xp; slain.push(b);
    addLog(`⚔️ Boss defeated: ${b.icon} ${b.name} (+${b.gold} 🪙, +${b.xp} XP)`);
  });
  return slain;
}

// Höchstes Attribut bestimmt den Pfad, dessen Level die Rangstufe
function pathOf() {
  const top = [...S.stats].sort((a, b) => b.xp - a.xp)[0];
  if (!top || top.xp === 0) return null;
  const lv = levelOf(top.xp, STAT_BASE), tier = TIERS.find(([min]) => lv >= min)[1];
  return { label: `${tier} ${top.cls || top.name}`, icon: top.icon, color: top.color };
}

// Tageswechsel: verpasste Dailies/Wochenquests kosten HP, Streak-Schilde retten den Streak
function rollover() {
  const t = today(); if (!S.lastCheck || S.lastCheck >= t) { S.lastCheck = t; return; }
  const notes = []; let dmg = 0, shields = 0;
  const d = new Date(S.lastCheck + 'T12:00:00'); d.setDate(d.getDate() + 1);
  for (let guard = 0; dstr(d) < t && guard < 30; d.setDate(d.getDate() + 1), guard++) {
    const D = dstr(d);
    const missed = S.quests.filter(q => q.type === 'daily' && (q.created || '') < D && (q.lastDone || '') < D);
    if (missed.length) {
      if (S.shields > 0 && missed.some(q => q.streak > 0)) { S.shields--; shields++; missed.forEach(q => { if (q.streak > 0) q.lastDone = D; }); }
      else if (S.settings.hpOn) dmg += missed.reduce((a, q) => a + 2 * (q.diff + 1), 0);
    }
    if (d.getDay() === 0 && S.settings.hpOn) {   // Sonntag = Wochenende
      const wk = monday(D);
      dmg += S.quests.filter(q => q.type === 'weekly' && (q.created || '') < wk && !(q.lastDone && monday(q.lastDone) >= wk)).reduce((a, q) => a + 4 * (q.diff + 1), 0);
    }
  }
  S.lastCheck = t;
  if (shields) { notes.push(`🛡️ ${shields} streak shield${shields > 1 ? 's' : ''} used`); addLog(`🛡️ Streak shield used (${shields}×)`); }
  if (dmg) { S.hp -= dmg; notes.push(`💔 −${dmg} HP from missed quests`); addLog(`💔 Missed quests cost ${dmg} HP`); }
  if (S.hp <= 0) {
    const lost = Math.floor(S.gold / 2); S.gold -= lost; S.hp = Math.ceil(maxHp() / 2);
    notes.push(`💀 You fell! Lost ${lost} 🪙, back up with ${S.hp} HP`); addLog(`💀 You fell and lost ${lost} 🪙`);
  }
  S.hp = Math.max(0, Math.min(S.hp, maxHp()));
  save();
  if (notes.length) setTimeout(() => toast('While you were away: ' + notes.join(' · ')), 400);
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
  if (r.kind === 'potion' && S.hp >= maxHp()) return toast('You are already at full HP');
  snapshot(); S.gold -= r.cost; r.count++;
  if (r.kind === 'shield') S.shields++;
  if (r.kind === 'potion') S.hp = Math.min(maxHp(), S.hp + 10);
  addLog(`🛒 Reward redeemed: ${r.icon} ${r.name} (−${r.cost} 🪙)`);
  save(); render(); toast(r.kind === 'potion' ? `${r.icon} +10 HP` : r.kind === 'shield' ? `${r.icon} Shields: ${S.shields}` : `${r.icon} Enjoy!`, true);
}

/* ---------- Toast / Dialog ---------- */
let toastT;
function toast(msg, undo = false, big = false) {
  const t = $('#toast'); t.hidden = false; t.className = big ? 'big' : '';
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button id="undo">Undo</button>' : ''}`;
  if (undo) $('#undo').onclick = () => { if (undoSnap) { S = JSON.parse(undoSnap); undoSnap = null; save(); render(); } t.hidden = true; };
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, undo ? 5000 : Math.max(3000, msg.length * 70));
}

function form(title, fields, onSave, onDel) {
  const d = $('#dlg');
  const fh = f => {
    const v = f.value ?? '';
    if (f.type === 'select') return `<label class="f">${f.label}<select name="${f.key}">${f.options.map(([val, txt]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(txt)}</option>`).join('')}</select></label>`;
    if (f.type === 'checks') return f.options.length ? `<div class="f"><div>${f.label}</div><div class="checks">${f.options.map(([val, txt]) => `<label><input type="checkbox" name="${f.key}" value="${esc(val)}"${(v || []).includes(val) ? ' checked' : ''}> ${esc(txt)}</label>`).join('')}</div></div>` : '';
    if (f.type === 'bool') return `<label class="f" style="display:flex;gap:8px;align-items:center;color:var(--text)"><input type="checkbox" name="${f.key}"${v ? ' checked' : ''} style="width:auto;margin:0"> ${f.label}</label>`;
    if (f.type === 'image') return `<div class="f"><div>${f.label}</div>${v ? `<img class="imgprev" src="${esc(v)}" alt="">` : ''}<input type="file" name="${f.key}" accept="image/*" style="margin-top:6px;width:100%">${v ? `<label class="chk"><input type="checkbox" name="${f.key}__rm"> Remove image</label>` : ''}</div>`;
    if (f.type === 'textarea') return `<label class="f">${f.label}<textarea name="${f.key}" rows="3">${esc(v)}</textarea></label>`;
    return `<label class="f">${f.label}<input name="${f.key}" type="${f.type || 'text'}" value="${esc(v)}"${f.type === 'number' && !f.neg ? ' min="0"' : ''}${f.req ? ' required' : ''}></label>`;
  };
  d.innerHTML = `<form id="f"><h3>${esc(title)}</h3>${fields.map(fh).join('')}<div class="row"><button type="button" class="btn ghost" id="cancel">Cancel</button>${onDel ? '<button type="button" class="btn danger" id="del">Delete</button>' : ''}<button class="btn">Save</button></div></form>`;
  $('#cancel').onclick = () => d.close();
  if (onDel) $('#del').onclick = () => { if (confirm('Really delete?')) { onDel(); d.close(); save(); render(); } };
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target), out = {};
    for (const f of fields.filter(x => x.type === 'image')) {
      const file = fd.get(f.key);
      try { out[f.key] = fd.get(f.key + '__rm') ? '' : file && file.size ? await readImg(file, f.max, f.square, f.quality) : (f.value || ''); }
      catch { out[f.key] = f.value || ''; toast('⚠️ Could not read image'); }
    }
    fields.filter(x => x.type !== 'image').forEach(f => out[f.key] = f.type === 'checks' ? fd.getAll(f.key) : f.type === 'bool' ? fd.get(f.key) === 'on' : f.type === 'number' ? (f.neg ? (+fd.get(f.key) || 0) : Math.max(0, +fd.get(f.key) || 0)) : String(fd.get(f.key) ?? '').trim());
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
    { key: 'type', label: 'Type', type: 'select', value: q.type, options: [['daily', '🔁 Daily (repeats every day)'], ['weekly', '📅 Weekly (resets on Monday)'], ['once', '⭐ One-time']] },
    { key: 'stat', label: 'Attribute', type: 'select', value: q.stat, options: statOptions() },
    { key: 'diff', label: 'Difficulty', type: 'select', value: q.diff, options: diffOptions() },
    { key: 'xp', label: 'Custom XP (0 = use difficulty value)', type: 'number', value: q.xp },
    { key: 'gold', label: 'Custom gold (0 = use difficulty value)', type: 'number', value: q.gold },
  ], o => {
    o.diff = +o.diff;
    if (id) Object.assign(q, o);
    else S.quests.push({ id: uid(), ...o, done: false, lastDone: null, streak: 0, created: today() });
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
  const r = S.rewards.find(x => x.id === id) || { name: '', icon: '🎁', cost: 50, kind: '' };
  form(id ? 'Edit reward' : 'New reward', [
    { key: 'name', label: 'Name', value: r.name, req: true },
    { key: 'icon', label: 'Emoji', value: r.icon },
    { key: 'cost', label: 'Price (gold)', type: 'number', value: r.cost },
    { key: 'kind', label: 'Effect', type: 'select', value: r.kind || '', options: REWARD_KINDS },
  ], o => { if (id) Object.assign(r, o); else S.rewards.push({ id: uid(), ...o, count: 0 }); },
  id ? () => { S.rewards = S.rewards.filter(x => x.id !== id); } : null);
}
function editBoss(id) {
  const b = S.bosses.find(x => x.id === id) || { name: '', icon: '🐉', desc: '', maxHp: 300, hp: 300, stat: '', gold: 150, xp: 100 };
  form(id ? 'Edit boss' : 'New boss', [
    { key: 'name', label: 'Name', value: b.name, req: true },
    { key: 'icon', label: 'Emoji', value: b.icon },
    { key: 'desc', label: 'Description / your big goal', type: 'textarea', value: b.desc },
    { key: 'maxHp', label: 'Boss HP (every finished quest deals its XP as damage)', type: 'number', value: b.maxHp },
    { key: 'stat', label: 'Damaged by', type: 'select', value: b.stat, options: [['', 'Any quest'], ...statOptions()] },
    { key: 'gold', label: 'Reward: gold', type: 'number', value: b.gold },
    { key: 'xp', label: 'Reward: XP', type: 'number', value: b.xp },
  ], o => {
    o.maxHp = Math.max(1, o.maxHp);
    if (id) Object.assign(b, o, { hp: Math.min(b.hp, o.maxHp) });
    else S.bosses.push({ id: uid(), ...o, hp: o.maxHp, defeated: false });
  }, id ? () => { S.bosses = S.bosses.filter(x => x.id !== id); } : null);
}

const charFields = () => [
  { key: 'avatarImg', label: 'Portrait (image, optional)', type: 'image', value: S.char.avatarImg, max: 256, square: true, quality: 0.85 },
  { key: 'avatar', label: 'Avatar emoji (used if there is no portrait)', value: S.char.avatar },
  { key: 'name', label: 'Character name', value: S.char.name, req: true },
  { key: 'title', label: 'Class', value: S.char.title },
  { key: 'race', label: 'Race / origin', value: S.char.race },
  { key: 'background', label: 'Background', value: S.char.background },
  { key: 'alignment', label: 'Alignment', type: 'select', value: S.char.alignment, options: [['', '— none —'], ...ALIGNMENTS.map(a => [a, a])] },
  { key: 'bio', label: 'Backstory & goals', type: 'textarea', value: S.char.bio },
];
const pickChar = o => Object.fromEntries(CHAR_KEYS.map(k => [k, o[k]]));
function editChar() {
  form('Character Sheet', charFields(), o => Object.assign(S.char, pickChar(o)));
}

/* Character Builder: Startwerte frei setzen (Level, Gold, Skillpunkte, Level je Attribut) */
function charBuilder() {
  form('🧙 Character Builder', [
    ...charFields(),
    { key: 'clvl', label: 'Overall level', type: 'number', value: levelOf(S.xp, CHAR_BASE) },
    { key: 'gold', label: 'Gold', type: 'number', value: S.gold },
    { key: 'sp', label: 'Free skill points', type: 'number', value: S.sp },
    { key: 'hp', label: 'Current HP', type: 'number', value: S.hp },
    { key: 'shields', label: 'Streak shields', type: 'number', value: S.shields },
    ...S.stats.map(s => ({ key: 'lv_' + s.id, label: `${s.icon} ${esc(s.name)} – current level`, type: 'number', value: levelOf(s.xp, STAT_BASE) })),
  ], o => {
    Object.assign(S.char, pickChar(o));
    S.xp = setLevel(S.xp, o.clvl, CHAR_BASE);
    S.gold = o.gold; S.sp = o.sp; S.shields = o.shields;
    S.stats.forEach(s => s.xp = setLevel(s.xp, o['lv_' + s.id], STAT_BASE));
    S.hp = Math.min(o.hp, maxHp());
    addLog('🧙 Character values set in the builder');
  });
}

function editStat(id) {
  const s = stat(id) || { name: '', icon: '⭐', color: STAT_COLORS[S.stats.length % STAT_COLORS.length], cls: '', xp: 0 };
  form(id ? 'Edit attribute' : 'New attribute', [
    { key: 'name', label: 'Name', value: s.name, req: true },
    { key: 'icon', label: 'Emoji', value: s.icon },
    { key: 'color', label: 'Color', type: 'color', value: s.color },
    { key: 'cls', label: 'Class name when this is your strongest attribute (e.g. Warrior)', value: s.cls },
    { key: 'lvl', label: 'Current level', type: 'number', value: levelOf(s.xp, STAT_BASE) },
  ], o => {
    const xp = setLevel(s.xp, o.lvl, STAT_BASE);
    if (id) Object.assign(s, { name: o.name, icon: o.icon, color: o.color, cls: o.cls, xp });
    else S.stats.push({ id: uid(), name: o.name, icon: o.icon, color: o.color, cls: o.cls, xp });
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
    { key: 'kind', label: 'What?', type: 'select', value: 'stat', options: [['stat', 'XP in an attribute (also counts toward overall level)'], ['xp', 'Overall XP only'], ['gold', 'Gold'], ['sp', 'Skill points'], ['hp', 'HP']] },
    { key: 'stat', label: 'Attribute (only for “XP in an attribute”)', type: 'select', value: S.stats[0].id, options: statOptions() },
    { key: 'amount', label: 'Amount (negative to subtract)', type: 'number', neg: true, value: 50 },
    { key: 'note', label: 'Note (e.g. “Ran a marathon”)', value: '' },
  ], o => {
    const a = Math.round(o.amount); if (!a) return;
    const lvBefore = levelOf(S.xp, CHAR_BASE);
    if (o.kind === 'gold') S.gold = Math.max(0, S.gold + a);
    else if (o.kind === 'sp') S.sp = Math.max(0, S.sp + a);
    else if (o.kind === 'hp') S.hp = Math.max(0, Math.min(maxHp(), S.hp + a));
    else {
      S.xp = Math.max(0, S.xp + a);
      if (o.kind === 'stat') { const st = stat(o.stat); st.xp = Math.max(0, st.xp + a); }
      const gained = levelOf(S.xp, CHAR_BASE) - lvBefore; if (gained > 0) S.sp += gained;
    }
    const what = { stat: `${stat(o.stat)?.name} XP`, xp: 'XP', gold: '🪙', sp: '✨', hp: 'HP' }[o.kind];
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
    { key: 'hpOn', label: 'HP penalties: missed quests cost HP', type: 'bool', value: st.hpOn !== false },
  ], o => {
    // Level beibehalten, wenn sich die Kurve ändert
    const cl = levelOf(S.xp, CHAR_BASE), sl = S.stats.map(s => levelOf(s.xp, STAT_BASE));
    Object.assign(st, { charBase: Math.max(1, o.charBase), statBase: Math.max(1, o.statBase), streakStep: o.streakStep, streakMax: o.streakMax, hpOn: o.hpOn });
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
    { key: 'bgImage', label: 'Background image (optional)', type: 'image', value: st.bgImage, max: 1280, quality: 0.7 },
    { key: 'bgDim', label: 'Background dimming in % (higher = darker, easier to read)', type: 'number', value: st.bgDim ?? 70 },
  ], o => {
    st.preset = o.preset;
    st.theme = o.preset === 'custom' ? { bg: o.bg, card: o.card, accent: o.accent, gold: o.gold, text: o.text } : (({ label, ...c }) => c)(THEMES[o.preset]);
    st.font = o.font;
    st.bgImage = o.bgImage; st.bgDim = Math.min(95, o.bgDim);
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

function avatarHtml() {
  return S.char.avatarImg ? `<img src="${esc(S.char.avatarImg)}" alt="">` : esc(S.char.avatar);
}
const abilityScore = lvl => 9 + lvl;                       // Level 1 = 10 (modifier +0), wie bei D&D
const abilityMod = score => Math.floor((score - 10) / 2);
const signed = n => (n >= 0 ? '+' : '') + n;

function viewHero() {
  const c = S.char, p = progress(S.xp, CHAR_BASE), prof = 2 + Math.floor((p.l - 1) / 4);   // Proficiency Bonus wie in D&D 5e
  const dailies = S.quests.filter(q => q.type === 'daily'), doneN = dailies.filter(questDone).length;
  const weeklies = S.quests.filter(q => q.type === 'weekly'), weekN = weeklies.filter(questDone).length;
  const feats = S.skills.filter(s => s.unlocked);
  const best = Math.max(0, ...S.quests.map(streakOf));
  const sub = [c.race, c.background, c.alignment].filter(Boolean).map(esc).join(' · '), path = pathOf();
  return `
  <div class="card banner"><div class="hero">
    <div class="avatar">${avatarHtml()}</div>
    <div class="hname"><h1>${esc(c.name)}</h1>
      <div class="cls">${esc(c.title)} <span class="lvl">· Level ${p.l}</span></div>
      <div class="muted small">${sub}</div>
      ${path ? `<div class="path" style="--c:${esc(path.color)}">${esc(path.icon)} ${esc(path.label)}</div>` : ''}</div>
    <button class="edit" data-act="editChar" title="Edit">✎</button>
  </div>
  <div class="bar xp" style="margin-top:12px"><div style="width:${p.pct}%"></div></div>
  <div class="xpline muted small"><span>Experience</span><span>${p.cur} / ${p.need} XP</span></div>
  <div class="bar hp" style="margin-top:10px"><div style="width:${S.hp / maxHp() * 100}%"></div></div>
  <div class="xpline muted small"><span>❤️ Hit Points</span><span>${S.hp} / ${maxHp()} HP</span></div></div>

  <div class="vitals">
    <div class="vit"><b>${signed(prof)}</b><span>Prof. bonus</span></div>
    <div class="vit"><b>🔥 ${best}</b><span>Streak</span></div>
    <div class="vit"><b>${S.gold}</b><span>Gold</span></div>
    <div class="vit"><b>🛡️ ${S.shields}</b><span>Shields</span></div>
  </div>

  <h2>Ability Scores</h2>
  <div class="abilities">${S.stats.map(s => { const sp = progress(s.xp, STAT_BASE), sc = abilityScore(sp.l); return `
    <div class="ability" style="--c:${esc(s.color)}"><div class="an">${s.icon} ${esc(s.name)}</div>
      <div class="mod">${signed(abilityMod(sc))}</div><div class="score">${sc}</div>
      <div class="bar"><div style="width:${sp.pct}%;background:${esc(s.color)}"></div></div>
      <div class="muted small">Level ${sp.l}</div></div>`; }).join('')}</div>
  <p class="muted small" style="margin:6px 2px 0">Score = 9 + attribute level · modifier = (score − 10) ÷ 2, rounded down.</p>

  <h2>Today</h2>
  <div class="card"><div class="muted">Dailies: <b>${doneN}/${dailies.length}</b>${weeklies.length ? ` · Weekly: <b>${weekN}/${weeklies.length}</b>` : ''}</div>
    <div class="bar" style="margin-top:6px"><div style="width:${dailies.length ? doneN / dailies.length * 100 : 0}%"></div></div>
    <div class="row" style="justify-content:flex-start;margin-top:12px"><button class="btn sm ghost" data-act="manual">✍️ Log a change</button><button class="btn sm ghost" data-act="builder">🧙 Character Builder</button></div></div>

  <h2>Features &amp; Traits</h2>
  <div class="card">${feats.length ? feats.map(s => `<div class="feat"><b>${s.icon} ${esc(s.name)}</b> <span class="muted small">+${s.bonus}% ${esc(stat(s.stat)?.name ?? '')} XP</span>${s.desc ? `<div class="muted small">${esc(s.desc)}</div>` : ''}</div>`).join('') : '<span class="muted">None yet – unlock some in the skill tree.</span>'}</div>

  ${c.bio ? `<h2>Backstory &amp; Goals</h2><div class="card"><p class="small" style="margin:0;white-space:pre-wrap">${esc(c.bio)}</p></div>` : ''}

  ${S.stats.length > 2 ? `<h2>Attribute Chart</h2><div class="card">${radar()}</div>` : ''}`;
}

function questRow(q) {
  const done = questDone(q), { d, xp, gold } = baseReward(q), st = stat(q.stat) || S.stats[0], sk = streakOf(q);
  return `<div class="card quest${done ? ' done' : ''}">
    <button class="check" data-act="done" data-id="${q.id}" ${done ? 'disabled' : ''} aria-label="Complete">${done ? '✓' : ''}</button>
    <div class="qt"><b>${esc(q.title)}</b><span class="muted small">${st.icon} ${esc(st.name)} · <span class="diff">${d.mark}</span>${q.type === 'weekly' ? ' · 📅' : ''}${sk > 1 ? ` · 🔥 ${sk}` : ''}</span>${q.note ? `<span class="muted small" style="display:block">${esc(q.note)}</span>` : ''}</div>
    <div class="reward">+${xp} XP<br>+${gold} 🪙</div>
    <button class="edit" data-act="editQuest" data-id="${q.id}" aria-label="Edit">✎</button></div>`;
}
function bossCard(b) {
  const st = b.stat ? stat(b.stat) : null;
  return `<div class="card boss${b.defeated ? ' done' : ''}"><div class="bico">${esc(b.icon)}</div>
    <div class="qt"><b>${esc(b.name)}</b>${b.desc ? `<div class="muted small">${esc(b.desc)}</div>` : ''}
      <div class="bar hp" style="margin:6px 0 2px"><div style="width:${b.hp / b.maxHp * 100}%"></div></div>
      <div class="muted small">${b.defeated ? '✔ Defeated' : `${b.hp} / ${b.maxHp} HP`} · ${st ? esc(st.icon + ' ' + st.name) + ' quests' : 'any quest'} · 🏆 +${b.gold} 🪙 +${b.xp} XP</div></div>
    <button class="edit" data-act="editBoss" data-id="${b.id}" aria-label="Edit">✎</button></div>`;
}
function viewQuests() {
  const by = t => S.quests.filter(q => q.type === t);
  const once = S.quests.filter(q => q.type === 'once' && !q.done), fin = S.quests.filter(q => q.type === 'once' && q.done);
  const bosses = S.bosses.filter(b => !b.defeated), slain = S.bosses.filter(b => b.defeated);
  return `<h2>Boss battles <button class="btn sm" data-act="newBoss">+ Boss</button></h2>
    ${bosses.map(bossCard).join('') || '<div class="empty">No active boss – create one for your biggest goal.</div>'}
    <h2>Daily quests <button class="btn sm" data-act="newQuest">+ New</button></h2>
    ${by('daily').map(questRow).join('') || '<div class="empty">No daily quests.</div>'}
    <h2>Weekly quests</h2>${by('weekly').map(questRow).join('') || '<div class="empty">No weekly quests – pick “Weekly” when creating a quest.</div>'}
    <h2>Main quests</h2>${once.map(questRow).join('') || '<div class="empty">No open quests.</div>'}
    ${fin.length || slain.length ? `<h2>Completed</h2>${slain.map(bossCard).join('')}${fin.map(questRow).join('')}` : ''}`;
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
      <div class="qt"><b>${esc(r.name)}</b><div class="muted small">${r.kind === 'shield' ? `Owned: ${S.shields} · saves a streak on a missed day` : r.kind === 'potion' ? 'Heals 10 HP' : `redeemed ${r.count}×`}</div></div>
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
  S.hp = Math.max(0, Math.min(S.hp, maxHp()));
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
    editReward: () => editReward(id), newReward: () => editReward(), editChar, editBoss: () => editBoss(id), newBoss: () => editBoss(),
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

document.addEventListener('visibilitychange', () => { if (!document.hidden) { rollover(); render(); } }); // Tageswechsel
rollover();
render();
if (!S.setupDone) { S.setupDone = true; save(); charBuilder(); } // Ersteinrichtung

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
