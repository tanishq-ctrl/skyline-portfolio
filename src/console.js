// "Ask my career a question": a real SQLite database (sql.js, compiled to
// WebAssembly) built in the browser from data.js.
import { ROLES, METRICS, PROJECTS, SKILLS, EDUCATION, CERTS, PLACES, placeById, monthsBetween } from './data.js';

const PRESETS = [
  { q: 'What are the biggest numbers?', sql: `SELECT shown, what, role_id AS at\nFROM results\nORDER BY value DESC\nLIMIT 5;` },
  { q: 'How long was each job?', sql: `SELECT company, title, months\nFROM roles\nORDER BY started;` },
  { q: 'Where was Power BI used?', sql: `SELECT place, how\nFROM evidence\nWHERE skill LIKE '%Power BI%';` },
  { q: 'Which skills show up in the most places?', sql: `SELECT skill, COUNT(*) AS places\nFROM evidence\nGROUP BY skill\nHAVING places >= 3\nORDER BY places DESC, skill;` },
  { q: 'What can I open and try?', sql: `SELECT name, result, url\nFROM projects\nWHERE url IS NOT NULL;` },
  { q: 'Show the AI work', sql: `SELECT e.skill, e.place, e.how\nFROM evidence e\nJOIN skills s ON s.skill = e.skill\nWHERE s.area = 'AI';` },
];

const SCHEMA = {
  roles: ['id', 'company', 'title', 'started', 'ended', 'months'],
  results: ['role_id', 'value', 'shown', 'what', 'detail'],
  projects: ['name', 'role_id', 'year', 'stack', 'result', 'url'],
  skills: ['skill', 'area'],
  evidence: ['skill', 'place', 'how'],
  education: ['degree', 'school', 'dates', 'note'],
  certificates: ['name', 'issuer', 'status'],
};

function seed(SQL) {
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE roles (id TEXT PRIMARY KEY, company TEXT, title TEXT, started TEXT, ended TEXT, months INTEGER);
    CREATE TABLE results (role_id TEXT REFERENCES roles(id), value REAL, shown TEXT, what TEXT, detail TEXT);
    CREATE TABLE projects (name TEXT, role_id TEXT, year INTEGER, stack TEXT, result TEXT, url TEXT);
    CREATE TABLE skills (skill TEXT PRIMARY KEY, area TEXT);
    CREATE TABLE evidence (skill TEXT REFERENCES skills(skill), place TEXT, how TEXT);
    CREATE TABLE education (degree TEXT, school TEXT, dates TEXT, note TEXT);
    CREATE TABLE certificates (name TEXT, issuer TEXT, status TEXT);
  `);
  const ins = (sql, rows) => { const st = db.prepare(sql); rows.forEach((r) => st.run(r)); st.free(); };
  ins('INSERT INTO roles VALUES (?,?,?,?,?,?)', ROLES.map((r) => [r.place, r.company, r.title, r.from, r.to, monthsBetween(r.from, r.to)]));
  ins('INSERT INTO results VALUES (?,?,?,?,?)', METRICS.map((m) => [m.place, m.v, m.show, m.what, m.more]));
  ins('INSERT INTO projects VALUES (?,?,?,?,?,?)', PROJECTS.map((p) => [p.name, p.place, p.year, p.stack, p.result, p.url ?? null]));
  ins('INSERT INTO skills VALUES (?,?)', SKILLS.map((s) => [s.skill, s.cat]));
  ins('INSERT INTO evidence VALUES (?,?,?)', SKILLS.flatMap((s) => Object.entries(s.at).map(([pl, how]) => [s.skill, placeById[pl].name, how])));
  ins('INSERT INTO education VALUES (?,?,?,?)', EDUCATION.map((e) => [e.degree, e.school, e.dates, e.note]));
  ins('INSERT INTO certificates VALUES (?,?,?)', CERTS.map((c) => [c.name, c.by, c.when || null]));
  return db;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function initConsole(root) {
  const editor = root.querySelector('textarea');
  const runBtn = root.querySelector('[data-run]');
  const results = root.querySelector('[data-results]');
  const status = root.querySelector('[data-status]');
  const presetsEl = root.querySelector('[data-presets]');
  const schemaEl = root.querySelector('[data-schema]');
  let db = null, loading = null;

  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.textContent = p.q;
    b.addEventListener('click', () => {
      presetsEl.querySelectorAll('.preset').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      editor.value = p.sql;
      run();
    });
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    presetsEl.appendChild(b);
  });
  Object.entries(SCHEMA).forEach(([t, cols]) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t;
    b.addEventListener('click', () => {
      presetsEl.querySelectorAll('.preset').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      editor.value = `SELECT *\nFROM ${t}\nLIMIT 10;`;
      run();
    });
    li.append(b, Object.assign(document.createElement('span'), { textContent: cols.join(', ') }));
    schemaEl.appendChild(li);
  });
  editor.value = PRESETS[0].sql;

  function ensure() {
    if (!loading) {
      status.textContent = 'Loading SQLite (WebAssembly)…';
      loading = loadScript('/assets/vendor/sql-wasm.js')
        .then(() => window.initSqlJs({ locateFile: (f) => `/assets/vendor/${f}` }))
        .then((SQL) => { db = seed(SQL); runBtn.disabled = false; })
        .catch((e) => { status.textContent = `SQLite could not start (${e?.message || e}). Reload the page to try again.`; throw e; });
    }
    return loading;
  }

  function render(res, ms) {
    if (!res.length) {
      results.innerHTML = '';
      status.textContent = `No rows. The query ran in ${ms.toFixed(1)} ms.`;
      return;
    }
    const { columns, values } = res[res.length - 1];
    const shown = values.slice(0, 200);
    const numeric = columns.map((_, c) => shown.every((r) => r[c] === null || typeof r[c] === 'number'));
    const max = columns.map((_, c) => (numeric[c] ? Math.max(...shown.map((r) => Math.abs(r[c] ?? 0)), 1e-9) : 0));
    const head = `<tr>${columns.map((c, i) => `<th scope="col"${numeric[i] ? ' class="num"' : ''}>${esc(c)}</th>`).join('')}</tr>`;
    const body = shown.map((r) => `<tr>${r.map((v, c) => {
      if (v === null) return '<td class="null">null</td>';
      if (numeric[c]) {
        const w = (Math.abs(v) / max[c]) * 100;
        return `<td class="num"><span class="cell-bar" style="--w:${w.toFixed(1)}%"></span>${esc(Number.isInteger(v) ? v.toLocaleString('en-US') : v)}</td>`;
      }
      const s = String(v);
      if (/^https?:\/\//.test(s)) return `<td><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></td>`;
      if (placeById[s]) return `<td><span class="place-chip" style="--hue:${placeById[s].hue}">${esc(placeById[s].name)}</span></td>`;
      const pl = PLACES.find((p) => p.name === s);
      if (pl) return `<td><span class="place-chip" style="--hue:${pl.hue}">${esc(s)}</span></td>`;
      return `<td>${esc(s)}</td>`;
    }).join('')}</tr>`).join('');
    results.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
    const n = values.length;
    status.textContent = `${n} ${n === 1 ? 'row' : 'rows'} in ${ms.toFixed(1)} ms${n > 200 ? ', first 200 shown' : ''}.`;
  }

  async function run() {
    try { await ensure(); } catch { return; }
    const sql = editor.value.trim();
    if (!sql) { status.textContent = 'Write a query first, or pick a question.'; return; }
    const t = performance.now();
    try {
      const res = db.exec(sql);
      render(res, performance.now() - t);
      root.classList.remove('has-error');
    } catch (e) {
      root.classList.add('has-error');
      results.innerHTML = '';
      status.textContent = `SQLite says: ${e.message}. Tables you can query: ${Object.keys(SCHEMA).join(', ')}.`;
    }
  }

  runBtn.addEventListener('click', run);
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
  });
  runBtn.disabled = true;
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { io.disconnect(); ensure().then(run).catch(() => {}); }
  }, { rootMargin: '600px 0px' });
  io.observe(root);
}
