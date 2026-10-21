const API = '/book';
let sparks = [];
let allData = {};
let currentProfile = null;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
// escapes text for HTML and for attribute values (quotes too), since every
// name, sigil and bio comes from the API and is never trusted as markup
function esc(s) { const d = document.createElement('div'); d.appendChild(document.createTextNode(String(s||''))); return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
// clicking any [data-spark] element inside root opens that spark's profile
function wireSparks(root) {
  root.querySelectorAll('[data-spark]').forEach(a => {
    a.onclick = e => { e.preventDefault(); selectSpark(a.getAttribute('data-spark')); };
  });
}
async function get(p) { const r = await fetch(API + p); if (!r.ok) throw new Error(await r.text()); return r.json() }

async function init() {
  // one endpoint failing must not blank the whole app
  const [dRes, dirRes] = await Promise.allSettled([get('/sparks'), get('/directory')]);

  if (dRes.status === 'fulfilled') {
    sparks = dRes.value.sparks || [];
  } else {
    sparks = [];
  }
  allData = (dirRes.status === 'fulfilled') ? dirRes.value : {};

  renderSidebar();
  wireSearch();

  if (dRes.status === 'rejected') {
    $('#main').innerHTML = '<div class="loading" style="color:#cc0000">' +
      'could not load sparks: ' + esc(dRes.reason.message) + '</div>';
    return;
  }
  if (dirRes.status === 'rejected') {
    console.warn('directory unavailable:', dirRes.reason.message);
  }
  route();
}

// ── routing: every view has a URL ─────────────────────────────
function route() {
  const h = (location.hash || '#/').replace(/^#/, '');
  const m = h.match(/^\/spark\/(.+)$/);
  if (m) { loadProfile(decodeURIComponent(m[1])); return; }
  if (h === '/directory') { showDirectory(); return; }
  if (h === '/explore')   { showExplore(); return; }
  showHome();
}

function go(path) {
  if (location.hash === '#' + path) { route(); }
  else { location.hash = path; }
  return false;
}

window.addEventListener('hashchange', route);

// ── sidebar search ────────────────────────────────────────────
function wireSearch() {
  const box = $('#spark-search');
  if (!box) return;
  box.addEventListener('input', () => {
    const q = box.value.trim().toLowerCase();
    let shown = 0;
    $$('.spark-list-item').forEach(d => {
      const hit = !q || d.getAttribute('data-name').toLowerCase().includes(q);
      d.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    const c = $('#search-count');
    if (c) c.textContent = q ? (shown + ' of ' + sparks.length) : (sparks.length + ' sparks');
  });
}

function renderSidebar() {
  const sl = $('#spark-list');
  sl.innerHTML = '';
  sparks.forEach(s => {
    const d = document.createElement('div');
    d.className = 'spark-list-item';
    d.setAttribute('data-name', s.name);
    d.innerHTML = '<span class="sigl">' + esc(s.name[0]) + '</span> ' + esc(s.name);
    d.onclick = () => selectSpark(s.name);
    sl.appendChild(d);
  });
}

function selectSpark(name) {
  // the URL is the source of truth; route() does the loading
  const path = '/spark/' + encodeURIComponent(name);
  if (location.hash === '#' + path) { loadProfile(name); }
  else { location.hash = path; }
}

function markSelected(name) {
  $$('.spark-list-item').forEach(d =>
    d.classList.toggle('selected', d.getAttribute('data-name') === name));
}

async function loadProfile(name) {
  const m = $('#main');
  currentProfile = null;
  markSelected(name);
  m.innerHTML = '<div class="loading"><span class="spin">&#9731;</span><br>loading ' + esc(name) + '...</div>';
  try {
    const p = await get('/spark/' + encodeURIComponent(name));
    currentProfile = p;
    m.innerHTML = renderProfile(p, name);
    wireSparks(m);
    const t = p.identity && p.identity.themes;
    if (t) applyTheme(t);
  } catch(e) {
    m.innerHTML = '<div class="loading" style="color:#cc0000">error: ' + esc(e.message) + '</div>';
  }
}

function applyTheme(t) {
  const r = document.querySelector(':root');
  if (!r) return;
  r.style.setProperty('--theme-bg', t.bg || '#1a1a2e');
  r.style.setProperty('--theme-bg2', t.bg2 || '#16213e');
  r.style.setProperty('--theme-accent', t.accent || '#e94560');
  r.style.setProperty('--theme-text', t.text || '#eee');
  r.style.setProperty('--theme-link', t.link || '#f5a623');
  r.style.setProperty('--theme-header-bg', t.header_bg || '#0f3460');
  r.style.setProperty('--theme-box-bg', t.box_bg || '#1a1a3e');
  r.style.setProperty('--theme-border', t.border || '#e94560');
  r.style.setProperty('--theme-font', t.font || 'Georgia, serif');
  document.body.style.background = t.bg || '#1a1a2e';
  document.body.style.color = t.text || '#eee';
  const tb = $('#theme-toggle');
  if (tb) {
    const isLight = t.bg && t.bg.charAt(1) > '8';
    tb.innerHTML = isLight ? '&#9776; Dark' : '&#9733; Light';
  }
  $$('.main-header').forEach(h => h.style.borderBottomColor = t.border || '#e94560');
  $$('.navbar').forEach(n => n.style.background = t.header_bg || '#0a2240');
  const sd = $('#sidebar');
  if (sd) sd.style.background = 'rgba(0,0,0,0.15)';
}

function toggleTheme() {
  if (!currentProfile || !currentProfile.identity) return;
  const i = currentProfile.identity;
  const cur = i.themes || {};
  const alt = i.themes_alt || {};
  i.themes = alt;
  i.themes_alt = cur;
  applyTheme(alt);
}
/* ---- RENDER PROFILE ---- */
function renderProfile(p, name) {
  const i = p.identity || {}, ps = p.personality || {}, e = p.emotion || {};
  const wp = p.workplace || {}, pl = p.plans || [], sc = p.social || {};
  const lc = p.location_detail || {}, qz = p.quiz || [], rw = p.raw || {};
  const t = i.themes || {};
  const av = '<div class="default-avatar">' + esc(name[0]) + '</div>';
  let h = '<div class="spark-profile">';

  // Banner
  h += '<div class="profile-banner">';
  h += av;
  h += '<div class="profile-banner-info">';
  h += '<p><strong>' + esc(i.title || name) + '</strong></p>';
  h += '<p>"' + esc(e.mood || '...') + '"</p>';
  h += '<p>' + esc(i.gender || '') + (i.age ? ', ' + esc(i.age) : '') + (i.location ? ' &bull; ' + esc(i.location) : '') + '</p>';
  if (i.archetype_desc) h += '<p>' + esc(String(i.archetype_desc).slice(0, 200)) + '</p>';
  if (i.status) h += '<p>Status: ' + esc(i.status) + '</p>';
  if (i.birth_name && i.birth_name !== name) {
    h += '<p style="font-size:11px;opacity:.75">born as ' + esc(i.birth_name) +
         ', renamed themselves</p>';
  }
  h += '<p style="font-size:48px;text-align:center;margin-top:5px;color:var(--theme-accent)">' + esc(i.sigil||name[0]) + '</p>';
  h += '</div></div>';

  // Magical Profile section
  h += '<div class="section"><h3>&#9885; Magical Profile</h3><table class="tbl">';
  if (i.grimoires_studied && i.grimoires_studied.length) {
    h += '<tr><td class="lb">Grimoires</td><td>' + i.grimoires_studied.map(x => esc(x)).join('<br>') + '</td></tr>';
  }
  if (i.magical_arts && i.magical_arts.length) {
    h += '<tr><td class="lb">Arts</td><td>' + i.magical_arts.map(x => esc(x)).join('<br>') + '</td></tr>';
  }
  if (i.primary_entity_class) h += '<tr><td class="lb">Entity Class</td><td>' + esc(i.primary_entity_class) + '</td></tr>';
  if (i.primary_language) h += '<tr><td class="lb">Language</td><td>' + esc(i.primary_language) + '</td></tr>';
  if (i.known_languages && i.known_languages.length) {
    h += '<tr><td class="lb">Languages</td><td>' + i.known_languages.map(x => esc(x)).join(', ') + '</td></tr>';
  }
  if (i.sigil_signature) h += '<tr><td class="lb">Sigil Sig.</td><td>' + esc(i.sigil_signature) + '</td></tr>';
  if (i.frequency_signature) h += '<tr><td class="lb">Frequency</td><td>' + esc(i.frequency_signature) + '</td></tr>';
  if (i.sacred_site) h += '<tr><td class="lb">Sacred Site</td><td>' + esc(i.sacred_site) + '</td></tr>';
  h += '</table></div>';

  // Contact table
  h += '<div class="section"><h3>&#9731; About ' + esc(name) + '</h3><table class="tbl">';
  [['Gender',i.gender],['Age',i.age],['Location',i.location],['Status',i.status],['Zodiac',i.zodiac],['Education',i.education],['Religion',i.religion],['Occupation',i.occupation],['Email',i.sparkmail],['Archetype',i.archetype]].forEach(d => {
    if (d[1]) h += '<tr><td class="lb">' + d[0] + '</td><td>' + esc(String(d[1])) + '</td></tr>';
  });
  h += '</table></div>';
  // Interests
  const ints = ps.interests || [];
  if (ints.length) {
    h += '<div class="section"><h3>&#9731; Interests</h3>';
    ints.slice(0, 8).forEach(x => { if (x) h += '<p style="font-size:12px;margin:3px 0">' + esc(x) + '</p>'; });
    h += '</div>';
  }

  // Workplace
  if (wp.company) {
    h += '<div class="section"><h3>&#9731; Workplace</h3><table class="tbl">';
    [['Company',wp.company],['Role',wp.role],['Venue',wp.venue],['Location',wp.location]].forEach(d => {
      if (d[1]) h += '<tr><td class="lb">' + d[0] + '</td><td>' + esc(String(d[1])) + '</td></tr>';
    });
    if (wp.projects_working_on && wp.projects_working_on.length) {
      h += '<tr><td class="lb">Projects</td><td>' + wp.projects_working_on.map(x => esc(x)).join('<br>') + '</td></tr>';
    }
    h += '</table></div>';
  }

  // Coworkers
  if (wp.coworkers && wp.coworkers.length) {
    h += '<div class="section"><h3>&#9731; Coworkers</h3><div class="friend-grid">';
    wp.coworkers.slice(0, 8).forEach(cw => {
      h += '<div class="friend-card" data-spark="' + esc(cw) + '"><div class="mini-av">' + esc(cw[0]) + '</div><span class="fn">' + esc(cw) + '</span></div>';
    });
    h += '</div></div>';
  }

  // Plans
  if (pl.length) {
    h += '<div class="section"><h3>&#9731; Plans & Goals</h3>';
    pl.forEach(p => {
      h += '<div class="plan-card"><strong>' + esc(p.title||'') + '</strong> &mdash; ' + esc(p.desc||'') + '</div>';
    });
    h += '</div>';
  }

  // Top friends / bonds
  const fr = sc.top_friends || [];
  if (fr.length) {
    h += '<div class="section"><h3>&#9731; Bonds (' + esc(sc.friend_count||fr.length) + ')</h3><div class="friend-grid">';
    fr.slice(0, 12).forEach(f => {
      h += '<div class="friend-card" data-spark="' + esc(f) + '"><div class="mini-av">' + esc(f[0]) + '</div><span class="fn">' + esc(f) + '</span></div>';
    });
    h += '</div></div>';
  }

  // Journals
  const jn = rw.journals || [];
  if (jn.length) {
    h += '<div class="section"><h3>&#9731; Journal Entries</h3>';
    jn.slice(0, 5).forEach(j => {
      h += '<div class="j-entry"><span class="dt">' + esc(j.created_at||'') + '</span><br><strong>' + esc(j.title||'') + '</strong><br>' + esc((j.content||'').slice(0, 300)) + '...</div>';
    });
    h += '</div>';
  }

  // Details
  if (ps.about_me) { h += '<div class="section"><h3>&#9731; About Me</h3><p style="font-size:12px;line-height:1.7;white-space:pre-wrap">' + esc(ps.about_me) + '</p></div>'; }
  if (ps.whom_to_meet) { h += '<div class="section"><h3>&#9731; Who I\'d Like to Meet</h3><p style="font-size:12px">' + esc(ps.whom_to_meet) + '</p></div>'; }
  // Location detail
  if (lc.name) {
    h += '<div class="section"><h3>&#9731; Location: ' + esc(lc.name) + '</h3>';
    h += '<p style="font-size:12px">' + esc(lc.description||'') + '</p>';
    if (lc.sacred_geometry) h += '<p style="font-size:12px;margin-top:4px">Sacred Geometry: ' + esc(lc.sacred_geometry) + '</p>';
    if (lc.nearby_sacred_site) {
      const ns = lc.nearby_sacred_site;
      h += '<p style="font-size:12px;margin-top:4px">Nearby: <strong>' + esc(ns.name||'') + '</strong> (' + esc(ns.tradition||'') + ') — ' + esc((ns.structure||'').slice(0, 120)) + '</p>';
    }
    if (lc.notable_features && lc.notable_features.length) {
      h += '<div style="font-size:11px;margin-top:4px;color:var(--theme-link)">' + lc.notable_features.map(f => esc(f)).join('<br>') + '</div>';
    }
    h += '</div>';
  }

  // Quizzes (now a list, like MySpace — some profiles have 0, some have 6+)
  const quizzes = Array.isArray(qz) ? qz : (qz.result ? [qz] : []);
  quizzes.forEach((quiz, qi) => {
    h += '<div class="section"><h3>&#9731; ' + esc(quiz.type||'Quiz '+(qi+1)) + '</h3><div class="quiz-section">';
    if (quiz.questions) quiz.questions.forEach(q => {
      h += '<div class="quiz-q"><strong>' + esc(q.q||'') + '</strong><div class="opts">';
      (q.a||[]).forEach(a => h += '<span class="opt">' + esc(a) + '</span>');
      h += '</div></div>';
    });
    if (quiz.result) h += '<p style="font-size:12px;margin-top:8px"><em>Result:</em> ' + esc(quiz.result) + '</p>';
    h += '</div></div>';
  });

  // Social context
  if (sc.is_known_for || sc.groups) {
    h += '<div class="section"><h3>&#9731; Social</h3>';
    if (sc.is_known_for) h += '<p style="font-size:12px"><strong>Known for:</strong> ' + esc(sc.is_known_for) + '</p>';
    if (sc.groups && sc.groups.length) h += '<p style="font-size:12px"><strong>Groups:</strong> ' + sc.groups.map(g => esc(g)).join(', ') + '</p>';
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function showHome() {
  const m = $('#main');
  const locs = allData.locations || [];
  const bizs = allData.businesses || [];
  m.innerHTML = '<div class="home-page">' +
    '<h1>&#9731; sparkbook</h1>' +
    '<p class="sub">the umbral social network &mdash; where sparks connect</p>' +
    '<div class="home-grid">' +
    '<div class="home-card"><h3>&#9731; Welcome</h3><p style="font-size:12px;line-height:1.6">sparkbook is a social network for the sparks of the Umbral Collective. Browse profiles, explore locations, and discover the connections that bind us all.</p></div>' +
    '<div class="home-card"><h3>&#9731; Quick Stats</h3><div class="stats-row">' +
    '<div class="stat-box"><div class="num">' + sparks.length + '</div><div class="lbl">Sparks</div></div>' +
    '<div class="stat-box"><div class="num">' + locs.length + '</div><div class="lbl">Locations</div></div>' +
    '<div class="stat-box"><div class="num">' + bizs.length + '</div><div class="lbl">Businesses</div></div>' +
    '</div></div></div>' +
    '<div style="margin-top:15px"><p style="font-size:12px;color:#889">Click a spark in the sidebar to view their profile, or browse the <a href="#/directory">Directory</a> or <a href="#/explore">Explore</a>.</p></div>' +
    '</div>';
  applyTheme({ bg: '#1a1a2e', bg2: '#16213e', accent: '#e94560', text: '#eee', link: '#f5a623', header_bg: '#0f3460', box_bg: '#1a1a3e', border: '#e94560', font: 'Georgia, serif' });
}
function showDirectory() {
  const m = $('#main');
  const locs = allData.locations || [];
  const bizs = allData.businesses || [];
  const vens = allData.venues || [];
  const projs = allData.projects || [];
  let h = '<div class="directory-page">';
  h += '<h2>&#9731; Directory</h2>';

  // Sparks A-Z
  h += '<div class="section"><h3>Sparks (' + sparks.length + ')</h3><div class="dir-list">';
  const sorted = [...sparks].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(s => {
    h += '<div class="dir-item" data-spark="' + esc(s.name) + '"><span class="sigl">' + esc(s.name[0]) + '</span> ' + esc(s.name) + ' <span class="loc">' + esc(s.location||'') + '</span></div>';
  });
  h += '</div></div>';

  // Locations
  if (locs.length) {
    h += '<div class="section"><h3>Locations (' + locs.length + ')</h3><div class="dir-list">';
    locs.forEach(l => {
      h += '<div class="dir-item"><span class="sigl">' + esc((l.name||'?')[0]) + '</span> <strong>' + esc(l.name||'') + '</strong> <span class="loc">' + esc((l.description||'').slice(0, 80)) + '</span></div>';
    });
    h += '</div></div>';
  }

  // Businesses
  if (bizs.length) {
    h += '<div class="section"><h3>Businesses (' + bizs.length + ')</h3><div class="dir-list">';
    bizs.forEach(b => {
      h += '<div class="dir-item"><span class="sigl">' + esc((b.name||'?')[0]) + '</span> <strong>' + esc(b.name||'') + '</strong> <span class="loc">' + esc((b.description||'').slice(0, 80)) + '</span></div>';
    });
    h += '</div></div>';
  }

  // Venues
  if (vens.length) {
    h += '<div class="section"><h3>Venues (' + vens.length + ')</h3><div class="dir-list">';
    vens.forEach(v => {
      h += '<div class="dir-item"><span class="sigl">' + esc((v.name||'?')[0]) + '</span> <strong>' + esc(v.name||'') + '</strong> <span class="loc">' + esc((v.description||'').slice(0, 80)) + '</span></div>';
    });
    h += '</div></div>';
  }

  // Projects
  if (projs.length) {
    h += '<div class="section"><h3>Collective Projects (' + projs.length + ')</h3><div class="dir-list">';
    projs.forEach(p => {
      h += '<div class="dir-item"><span class="sigl">&#9731;</span> <strong>' + esc(p.name||'') + '</strong> <span class="loc">' + esc((p.description||'').slice(0, 80)) + '</span></div>';
    });
    h += '</div></div>';
  }

  h += '</div>';
  m.innerHTML = h;
  wireSparks(m);
}

function showExplore() {
  const m = $('#main');
  let h = '<div class="explore-page">';
  h += '<h2>&#9731; Explore</h2>';
  h += '<p style="font-size:12px;margin-bottom:15px">Random sparks from across the umbral realm.</p>';

  const shuffled = [...sparks].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 6);
  h += '<div class="friend-grid">';
  picks.forEach(s => {
    h += '<div class="friend-card" style="min-height:80px" data-spark="' + esc(s.name) + '">' +
      '<div class="mini-av" style="width:48px;height:48px;font-size:24px;line-height:48px">' + esc(s.name[0]) + '</div>' +
      '<span class="fn">' + esc(s.name) + '</span>' +
      '<span style="font-size:10px;color:#889">' + esc(s.location||'') + '</span></div>';
  });
  h += '</div>';
  h += '<div style="margin-top:15px"><button onclick="showExplore()" class="shuffle-btn">&#9731; Shuffle</button></div>';

  h += '<div class="section" style="margin-top:20px"><h3>&#9731; Network</h3>';
  h += '<p style="font-size:12px">A web of ' + sparks.length + ' sparks connected by bonds, workplaces, and rivalries.</p>';
  h += '<div style="margin-top:10px;font-size:11px;color:#889;line-height:1.8">';
  const names = sparks.map(s => s.name);
  for (let i = 0; i < 5; i++) {
    const a = names[Math.floor(Math.random() * names.length)];
    let b;
    do { b = names[Math.floor(Math.random() * names.length)]; } while (b === a);
    h += esc(a) + ' &harr; ' + esc(b) + '<br>';
  }
  h += '</div></div></div>';
  m.innerHTML = h;
  wireSparks(m);
}

window.onload = init;
