import { SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_DOMAINS } from './config.js';

const DOMAINS_TEXT = ALLOWED_DOMAINS.map(d => '@' + d).join(' or ');
const allowedEmail = email => ALLOWED_DOMAINS.some(d => email.toLowerCase().endsWith('@' + d));

const AMS = ['Rene Minnie','Dylan Lockwood','Thabo Lekoloane','Shanndrae Markgraff','Brendon Atwell','Francois Crafford','Zane Mansfield','Atreya Christiany','Antoinette Zlatarov','Daryn de Villiers','Henry Holt'];
const EVENT = new Date(2026, 9, 22);
const CUTOFF = new Date(2026, 9, 9);
const RESP = [['yes','Yes'],['maybe','Maybe'],['no','No']];
const DEMO = !SUPABASE_URL || SUPABASE_URL.includes('YOUR-') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR-');
const DEMO_KEY = 'founder-breakfast-demo-invites';

let sb = null;
const state = { user: null, invites: [], tab: 'dashboard', query: '', am: '', resp: 'all', loaded: false, pending: false };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const daysTo = d => { const t = new Date(); return Math.round((d - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5); };
const plural = n => Math.abs(n) === 1 ? 'day' : 'days';
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3200); }
function setSync(kind, text) { const s = $('#sync'); if (!s) return; s.className = 'sync ' + kind; s.innerHTML = `<i></i>${esc(text)}`; }

/* ---------- Data layer ---------- */
const db = {
  async load() {
    if (DEMO) {
      const saved = localStorage.getItem(DEMO_KEY);
      return saved ? JSON.parse(saved) : [];
    }
    const { data, error } = await sb.from('invites').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  saveDemo() { localStorage.setItem(DEMO_KEY, JSON.stringify(state.invites)); },
  async insert() {
    const row = { account_manager: null, customer: '', contact: '', telephone: '', response: null };
    if (DEMO) { const r = { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() }; state.invites.unshift(r); db.saveDemo(); return r; }
    const { data, error } = await sb.from('invites').insert(row).select().single();
    if (error) throw error;
    upsertLocal(data);
    return data;
  },
  async update(id, patch) {
    const inv = state.invites.find(x => x.id === id); if (inv) Object.assign(inv, patch);
    if (DEMO) return db.saveDemo();
    const { error } = await sb.from('invites').update(patch).eq('id', id);
    if (error) throw error;
  },
  async remove(id) {
    state.invites = state.invites.filter(x => x.id !== id);
    if (DEMO) return db.saveDemo();
    const { error } = await sb.from('invites').delete().eq('id', id);
    if (error) throw error;
  },
};
function upsertLocal(row) {
  const i = state.invites.findIndex(x => x.id === row.id);
  if (i >= 0) state.invites[i] = row; else state.invites.unshift(row);
}
async function run(p, okText = 'All changes saved') {
  setSync('saving', 'Saving…');
  try { await p; setSync('', okText); }
  catch (e) { console.error(e); setSync('err', 'Not saved'); toast('That change did not save. Check your connection and try again.'); await refresh(); }
}
async function refresh() {
  try { state.invites = await db.load(); state.loaded = true; dataChanged(); }
  catch (e) { console.error(e); toast('Could not load invites: ' + (e.message || e)); }
}

/* ---------- Stats ---------- */
function stats(list) {
  const c = r => list.filter(x => (x.response || null) === r).length;
  const total = list.length, yes = c('yes'), maybe = c('maybe'), no = c('no');
  return { total, yes, maybe, no, awaiting: total - yes - maybe - no };
}
const pct = (n, t) => t ? Math.round(n / t * 100) + '%' : '0%';

/* ---------- Views ---------- */
function loginView(msg, isErr) {
  return `<div class="login">
  <div class="login-art">
    <img src="assets/nymbis-white.png" alt="Nymbis">
    <div>
      <div class="eyebrow-c">Thursday 22 October 2026 · 9h30 – 12h00</div>
      <h1>Nymbis Cloud Founder Breakfast</h1>
      <p style="margin:0;color:var(--ink-100)">The Island Club, Century City</p>
    </div>
    <p style="margin:0;font-size:13px;color:var(--ink-100)">Invite tracker for Account Managers · RSVP cut-off 9 October 2026</p>
  </div>
  <div class="login-form">
    <form id="login">
      <h2>Sign in</h2>
      <p class="note">Enter your ${esc(DOMAINS_TEXT)} email. We will send you a sign-in link.</p>
      ${msg ? `<div class="alert ${isErr ? 'err' : ''}">${esc(msg)}</div>` : ''}
      <label>Work email<input class="field" id="email" type="email" required autocomplete="email" placeholder="name@${esc(ALLOWED_DOMAINS[0])}"></label>
      <button class="btn btn-primary" type="submit">Send sign-in link</button>
    </form>
  </div>
</div>`;
}

function headerView() {
  return `${DEMO ? `<div class="demo">Demo mode: data is saved in this browser only. Add your Supabase keys to config.js to share it.</div>` : ''}
<header class="top">
  <img src="assets/nymbis-gradient.png" alt="Nymbis">
  <nav class="tabs">
    <a class="tab" data-tab="dashboard" href="#dashboard">Dashboard</a>
    <a class="tab" data-tab="invites" href="#invites">Invites</a>
  </nav>
  <div class="who"><span>${esc(state.user.email)}</span>${DEMO ? '' : '<button class="btn btn-ghost" id="signout">Sign out</button>'}</div>
</header><div id="main"></div>`;
}

function heroView() {
  const dc = daysTo(CUTOFF), de = daysTo(EVENT);
  return `<section class="hero">
  <div class="hero-main">
    <div class="eyebrow-c">Thursday 22 October 2026 · 9h30 – 12h00</div>
    <h1>Nymbis Cloud Founder Breakfast</h1>
    <p>The Island Club, Century City</p>
  </div>
  <div class="countdowns">
    <div class="cd"><div class="cd-l">RSVP cut-off · 9 Oct</div><div class="cd-v"><b>${dc >= 0 ? dc : 'Closed'}</b><span>${dc >= 0 ? plural(dc) + ' left' : ''}</span></div></div>
    <div class="cd"><div class="cd-l">Event · 22 Oct</div><div class="cd-v"><b>${de >= 0 ? de : 'Done'}</b><span>${de >= 0 ? plural(de) + ' to go' : ''}</span></div></div>
  </div>
</section>`;
}

const barView = (s, cls = '') => `<div class="bar ${cls}">
  <i class="c-yes" style="flex:${s.yes} 0 0"></i><i class="c-maybe" style="flex:${s.maybe} 0 0"></i><i class="c-no" style="flex:${s.no} 0 0"></i>${cls ? `<i class="c-await" style="flex:${s.awaiting} 0 0"></i>` : `<i style="flex:${s.awaiting} 0 0"></i>`}
</div>`;

function dashboardView() {
  const s = stats(state.invites);
  const per = AMS.map(name => ({ name, ...stats(state.invites.filter(x => x.account_manager === name)) }));
  const unassigned = stats(state.invites.filter(x => !x.account_manager));
  if (unassigned.total) per.push({ name: 'Not assigned', ...unassigned });
  const max = Math.max(1, ...per.map(p => p.total));
  return `${heroView()}
<div class="page">
  <div class="stats num">
    <div class="stat"><div class="stat-l">Invited</div><div class="stat-v">${s.total}</div><div class="stat-s">customers</div></div>
    <div class="stat yes"><div class="stat-l">Yes</div><div class="stat-v">${s.yes}</div><div class="stat-s">${pct(s.yes, s.total)} of invited</div></div>
    <div class="stat maybe"><div class="stat-l">Maybe</div><div class="stat-v">${s.maybe}</div><div class="stat-s">${pct(s.maybe, s.total)} of invited</div></div>
    <div class="stat no"><div class="stat-l">No</div><div class="stat-v">${s.no}</div><div class="stat-s">${pct(s.no, s.total)} of invited</div></div>
    <div class="stat await"><div class="stat-l">Awaiting response</div><div class="stat-v">${s.awaiting}</div><div class="stat-s">follow up before 9 Oct</div></div>
  </div>
  <div class="panel" style="padding:24px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap"><h2 style="font-size:16px;margin:0">Response split</h2><span class="muted">${s.total - s.awaiting} of ${s.total} responded</span></div>
    ${barView(s)}
  </div>
  <div class="panel">
    <div class="panel-h"><h2>By Account Manager</h2>
      <div class="legend"><span><i class="c-yes"></i>Yes</span><span><i class="c-maybe"></i>Maybe</span><span><i class="c-no"></i>No</span><span><i class="c-await"></i>Awaiting</span></div>
    </div>
    <div class="am-row head"><div>Account Manager</div><div class="r">Invited</div><div class="r">Yes</div><div class="r">Maybe</div><div class="r">No</div><div class="r">Awaiting</div><div></div></div>
    ${per.map(p => `<div class="am-row num">
      <div style="font-weight:500">${esc(p.name)}</div><div class="r">${p.total}</div><div class="r t-yes">${p.yes}</div><div class="r t-maybe">${p.maybe}</div><div class="r t-no">${p.no}</div><div class="r t-await">${p.awaiting}</div>
      <div style="width:${p.total / max * 100}%">${p.total ? barView(p, 'sm') : ''}</div>
    </div>`).join('')}
  </div>
</div>`;
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  return state.invites.filter(x =>
    (!state.am || x.account_manager === state.am) &&
    (state.resp === 'all' || (state.resp === 'none' ? !x.response : x.response === state.resp)) &&
    (!q || `${x.customer} ${x.contact} ${x.telephone}`.toLowerCase().includes(q)));
}

function invitesView() {
  return `<div class="page">
  <div class="page-head">
    <div><h1>Invites</h1><p id="inv-sub"></p></div>
    <div class="page-actions">
      <button class="btn btn-secondary" id="export">Export Yes list</button>
      <button class="btn btn-primary" id="add">Add invite</button>
    </div>
  </div>
  <div class="toolbar">
    <input class="field" id="q" type="search" placeholder="Search customer, contact or number" value="${esc(state.query)}">
    <select class="field" id="amf"><option value="">All Account Managers</option>${AMS.map(n => `<option ${state.am === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <div class="chips" id="chips"></div>
  </div>
  <div class="panel table-wrap">
    <div class="inv head"><div>Account Manager</div><div>Customer</div><div>Contact</div><div>Telephone</div><div>Response</div><div></div></div>
    <div id="list"></div>
  </div>
  <div class="foot"><span>Changes save automatically and appear for everyone.</span><span class="sync" id="sync"><i></i>${DEMO ? 'Saved in this browser' : 'Up to date'}</span></div>
</div>`;
}

function rowView(x) {
  return `<div class="inv" data-id="${esc(x.id)}">
  <label class="cell c-am"><span class="cell-l">Account Manager</span>
    <select class="edit ${x.account_manager ? '' : 'missing'}" data-f="account_manager"><option value="">Select Account Manager</option>${AMS.map(n => `<option ${x.account_manager === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
  <label class="cell c-cust"><span class="cell-l">Customer</span><input class="edit strong" data-f="customer" value="${esc(x.customer)}" placeholder="Customer"></label>
  <label class="cell c-contact"><span class="cell-l">Contact</span><input class="edit" data-f="contact" value="${esc(x.contact)}" placeholder="Contact name"></label>
  <label class="cell c-tel"><span class="cell-l">Telephone</span><input class="edit num" data-f="telephone" type="tel" value="${esc(x.telephone)}" placeholder="+27"></label>
  <div class="cell c-resp"><span class="cell-l">Response</span><div class="resp">${RESP.map(([k, l]) => `<button type="button" data-r="${k}" class="${x.response === k ? 'on-' + k : ''}">${l}</button>`).join('')}</div></div>
  <button class="del" type="button" title="Remove invite" aria-label="Remove invite"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
</div>`;
}

function renderList() {
  const s = stats(state.invites);
  const list = filtered();
  $('#inv-sub').textContent = `${s.total} customers invited · ${s.awaiting} awaiting response`;
  $('#chips').innerHTML = [['all','All',s.total],['yes','Yes',s.yes],['maybe','Maybe',s.maybe],['no','No',s.no],['none','Awaiting',s.awaiting]]
    .map(([k, l, n]) => `<button class="chip ${state.resp === k ? 'on' : ''}" data-filter="${k}">${l} · ${n}</button>`).join('');
  $('#list').innerHTML = list.length ? list.map(rowView).join('')
    : `<div class="empty">${state.invites.length ? 'No invites match these filters.' : 'No invites yet. Select Add invite to start the list.'}</div>`;
}

function renderMain() {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === state.tab));
  const m = $('#main'); if (!m) return;
  if (!state.loaded) { m.innerHTML = '<div class="boot">Loading invites…</div>'; return; }
  if (state.tab === 'dashboard') m.innerHTML = dashboardView();
  else { m.innerHTML = invitesView(); renderList(); }
}

function render(msg, isErr) {
  const app = $('#app');
  if (!state.user) { app.innerHTML = loginView(msg, isErr); return; }
  app.innerHTML = headerView();
  renderMain();
}

function dataChanged() {
  if (!state.user || !$('#main')) return;
  if (state.tab === 'dashboard') return renderMain();
  if (!$('#list')) return renderMain();
  if ($('#list').contains(document.activeElement)) { state.pending = true; return; }
  renderList();
}

/* ---------- Export ---------- */
// Door list of everyone who said Yes, as a CSV that opens in Excel.
function exportYes() {
  const yes = state.invites.filter(x => x.response === 'yes')
    .sort((a, b) => (a.customer || '').localeCompare(b.customer || '') || (a.contact || '').localeCompare(b.contact || ''));
  if (!yes.length) return toast('No one has said Yes yet.');
  const cell = v => {
    let t = String(v ?? '');
    if (/^[=+\-@]/.test(t)) t = "'" + t;   // stop Excel treating names as formulas
    return '"' + t.replace(/"/g, '""') + '"';
  };
  const tel = v => v ? '="' + String(v).replace(/"/g, '') + '"' : '';   // keep leading 0 and +27
  const rows = [['Customer', 'Contact', 'Telephone', 'Account Manager', 'Arrived'].map(cell).join(',')]
    .concat(yes.map(x => [cell(x.customer), cell(x.contact), tel(x.telephone), cell(x.account_manager || 'Not assigned'), cell('')].join(',')));
  const blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Founder Breakfast - Yes list - ${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${yes.length} ${yes.length === 1 ? 'guest' : 'guests'}.`);
}

/* ---------- Events ---------- */
document.addEventListener('submit', async e => {
  if (e.target.id !== 'login') return;
  e.preventDefault();
  const email = $('#email').value.trim().toLowerCase();
  if (!allowedEmail(email)) return render(`Use your ${DOMAINS_TEXT} email address.`, true);
  const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Sending…';
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  render(error ? error.message : `Check ${email} for your sign-in link.`, !!error);
});

document.addEventListener('click', async e => {
  const t = e.target;
  if (t.closest('#signout')) { await sb.auth.signOut(); return; }
  if (t.closest('#export')) { exportYes(); return; }
  if (t.closest('#add')) {
    state.resp = 'all'; state.query = ''; state.am = '';
    renderMain();
    await run(db.insert().then(r => { renderList(); const row = document.querySelector(`[data-id="${CSS.escape(r.id)}"]`); if (row) { row.classList.add('flash'); row.querySelector('select').focus(); } }));
    return;
  }
  const chip = t.closest('[data-filter]');
  if (chip) { state.resp = chip.dataset.filter; renderList(); return; }
  const row = t.closest('.inv[data-id]'); if (!row) return;
  const id = row.dataset.id;
  const rb = t.closest('[data-r]');
  if (rb) {
    const inv = state.invites.find(x => x.id === id);
    const next = inv.response === rb.dataset.r ? null : rb.dataset.r;
    await run(db.update(id, { response: next }));
    renderList();
    return;
  }
  if (t.closest('.del')) {
    const inv = state.invites.find(x => x.id === id);
    if (!confirm(`Remove ${inv.customer || 'this invite'} from the list?`)) return;
    await run(db.remove(id));
    renderList();
  }
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'amf') { state.am = t.value; renderList(); return; }
  const f = t.dataset.f; if (!f) return;
  const id = t.closest('.inv').dataset.id;
  const value = f === 'account_manager' ? (t.value || null) : t.value.trim();
  if (f === 'account_manager') t.classList.toggle('missing', !value);
  await run(db.update(id, { [f]: value }));
});

document.addEventListener('input', e => { if (e.target.id === 'q') { state.query = e.target.value; renderList(); } });
document.addEventListener('focusout', () => setTimeout(() => {
  if (state.pending && !($('#list') && $('#list').contains(document.activeElement))) { state.pending = false; renderList(); }
}, 0));
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('edit')) e.target.blur(); });

function setTabFromHash() { state.tab = location.hash === '#invites' ? 'invites' : 'dashboard'; renderMain(); }
window.addEventListener('hashchange', setTabFromHash);

/* ---------- Boot ---------- */
async function signedIn(user) {
  if (!allowedEmail(user.email)) { await sb.auth.signOut(); return render('Only ' + DOMAINS_TEXT + ' accounts can use this tracker.', true); }
  state.user = user;
  render();
  await refresh();
}

async function boot() {
  state.tab = location.hash === '#invites' ? 'invites' : 'dashboard';
  if (DEMO) { await signedIn({ email: 'demo@' + ALLOWED_DOMAINS[0] }); return; }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  sb.channel('invites-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invites' }, p => {
      if (p.eventType === 'DELETE') state.invites = state.invites.filter(x => x.id !== p.old.id);
      else upsertLocal(p.new);
      dataChanged();
    })
    .subscribe();
  const { data: { session } } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((_ev, s) => {
    const u = s?.user || null;
    if ((u?.id) === (state.user?.id)) return;
    if (u && !allowedEmail(u.email)) { sb.auth.signOut(); state.user = null; return render('Only ' + DOMAINS_TEXT + ' accounts can use this tracker.', true); }
    if (u) signedIn(u); else { state.user = null; state.invites = []; state.loaded = false; render(); }
  });
  if (session?.user) signedIn(session.user); else render();
}
boot();
