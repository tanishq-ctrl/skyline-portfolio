// Build-time HTML for every content section, so the page reads fully without
// JavaScript and search engines see real text. Used by scripts/build.mjs.
import { ROLES, METRICS, PROJECTS, INTERNAL, SKILLS, EDUCATION, CERTS, PLACES, placeById } from './data.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const host = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');

export function metricList() {
  return METRICS.map((m) => `<li>${esc(m.show)} ${esc(m.what)}, ${esc(placeById[m.place].full)}: ${esc(m.more)}.</li>`).join('\n');
}

export function ledger() {
  return ROLES.map((r, i) => {
    const p = placeById[r.place];
    return `<li class="row" style="--hue:${p.hue}">
  <h3 class="row-h">
    <button class="row-head" type="button" aria-expanded="${i === 0}" aria-controls="role-${r.place}">
      <span class="row-dates">${esc(r.dates)}</span>
      <span class="row-role"><strong>${esc(r.title)}</strong><span>${esc(r.company)}</span></span>
      <span class="row-fig"><b>${esc(r.figure)}</b><span>${esc(r.figureLabel)}</span></span>
      <span class="row-toggle" aria-hidden="true"></span>
    </button>
  </h3>
  <div class="row-body" id="role-${r.place}"${i === 0 ? '' : ' hidden'}>
    <p>${esc(r.summary)}</p>
    <ul>${r.points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </div>
</li>`;
  }).join('\n');
}

export function work() {
  return PROJECTS.map((pr) => {
    const p = placeById[pr.place];
    const shots = pr.shots;
    const alt = (i) => (pr.alts?.[i] ? `${pr.name}: ${pr.alts[i]}` : `${pr.name}, screenshot ${i + 1} of ${shots.length}`);
    return `<article class="work" id="work-${pr.id}" style="--hue:${p.hue}">
  <div class="work-media">
    <figure class="frame"${pr.ratio ? ` style="--ar: ${pr.ratio}"` : ''}>
      <img src="/assets/shots/${shots[0]}.webp" alt="${esc(alt(0))}" width="1600" height="1000" loading="lazy" decoding="async">
    </figure>
    ${shots.length > 1 ? `<div class="thumbs" role="group" aria-label="${esc(pr.name)} screenshots">
      ${shots.map((s, i) => `<button type="button" class="thumb" data-src="/assets/shots/${s}.webp" data-alt="${esc(alt(i))}" aria-pressed="${i === 0}" aria-label="Show screenshot ${i + 1}"><img src="/assets/shots/${s}.webp" alt="" width="160" height="100" loading="lazy" decoding="async"></button>`).join('')}
    </div>` : ''}
  </div>
  <div class="work-text">
    <h3>${esc(pr.name)}</h3>
    <p class="work-line">${esc(pr.line)}</p>
    <p>${esc(pr.body)}</p>
    <dl class="facts">
      <div><dt>Built at</dt><dd>${esc(p.full)}, ${pr.year}</dd></div>
      <div><dt>Stack</dt><dd>${esc(pr.stack)}</dd></div>
      <div><dt>Result</dt><dd>${esc(pr.result)}</dd></div>
      ${pr.extra ? `<div><dt>${esc(pr.extra[0])}</dt><dd>${esc(pr.extra[1])}</dd></div>` : ''}
    </dl>
    ${pr.url ? `<a class="go" href="${esc(pr.url)}" target="_blank" rel="noopener">Open ${esc(host(pr.url))}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sr-only"> (opens in a new tab)</span></a>` : `<p class="internal-note">${esc(pr.note)}</p>`}
  </div>
</article>`;
  }).join('\n');
}

export function internal() {
  return INTERNAL.map((t) => `<li><b>${esc(t.fig)}</b><h4>${esc(t.name)}</h4><p>${esc(t.note)}</p></li>`).join('\n');
}

export function matrix() {
  const cols = PLACES;
  const head = `<tr><th scope="col" class="m-skill">Skill</th>${cols.map((c) => `<th scope="col" style="--hue:${c.hue}"><span>${esc(c.name)}</span><small>${esc(c.years)}</small></th>`).join('')}</tr>`;
  const rows = SKILLS.map((s) => `<tr><th scope="row" class="m-skill">${esc(s.skill)}</th>${cols.map((c) => {
    const ev = s.at[c.id];
    if (!ev) return '<td class="m-empty"><span aria-hidden="true"></span><span class="sr-only">Not used here</span></td>';
    return `<td><button type="button" class="m-cell" style="--hue:${c.hue}" data-skill="${esc(s.skill)}" data-place="${esc(c.full)}" data-ev="${esc(ev)}" aria-label="${esc(s.skill)} at ${esc(c.name)}: ${esc(ev)}"></button></td>`;
  }).join('')}</tr>`).join('\n');
  return `<table class="matrix"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

export function study() {
  const ed = EDUCATION.map((e) => `<li><h3>${esc(e.degree)}</h3><p class="where">${esc(e.school)}, ${esc(e.dates)}</p><p>${esc(e.note)}</p></li>`).join('');
  const certs = CERTS.map((c) => `<li><span class="c-name">${esc(c.name)}</span><span class="c-by">${esc(c.by)}${c.when ? `, ${esc(c.when)}` : ''}</span></li>`).join('');
  return { ed, certs };
}

export function legend() {
  return PLACES.filter((p) => p.id !== 'study').map((p) => `<li style="--hue:${p.hue}">${esc(p.name)}</li>`).join('');
}
