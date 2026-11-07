import { initSkyline, svgChart } from './skyline.js';
import { initPipeline } from './pipeline.js';
import { initConsole } from './console.js';
import { PERSON } from './data.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ── Hero: skyline and scroll progress ── */
const hero = $('.hero');
const stage = $('[data-stage]');
let sky = null;
try {
  sky = initSkyline({ canvas: $('.sky', stage), stage, overlay: $('.chart-overlay', stage), tip: $('.tip', stage), copy: $('.chart-copy', stage), reduced });
} catch (e) {
  console.warn('Skyline failed to start', e);
}
if (!sky) {
  stage.classList.add('no-webgl');
  hero.classList.add('flat');
  $('.sky', stage).remove();
  stage.insertAdjacentHTML('beforeend', `<div class="fallback" aria-hidden="true">${svgChart()}</div>`);
}

const nav = $('[data-nav]');
function onScroll() {
  const total = hero.offsetHeight - innerHeight;
  const p = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / Math.max(total, 1)));
  sky?.setProgress(p);
  nav.classList.toggle('solid', hero.getBoundingClientRect().bottom < 64);
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ── Nav: mark the section in view ── */
const navLinks = $$('.nav nav a');
const spy = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    navLinks.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${en.target.id}`)));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
['experience', 'work', 'query', 'contact'].forEach((id) => spy.observe(document.getElementById(id)));

/* ── Ledger rows open and close ── */
$$('.row-head').forEach((btn) => {
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
  });
});

/* ── Work: screenshot switcher ── */
$$('.work').forEach((w) => {
  const img = $('.frame img', w);
  $$('.thumb', w).forEach((t) => {
    t.addEventListener('click', () => {
      $$('.thumb', w).forEach((x) => x.setAttribute('aria-pressed', String(x === t)));
      img.src = t.dataset.src;
      img.alt = t.dataset.alt;
    });
  });
});

/* ── Skills matrix: show the evidence behind a dot ── */
const ev = $('[data-evidence]');
let pinned = null;
function showEvidence(cell) {
  ev.style.setProperty('--hue', cell.style.getPropertyValue('--hue'));
  ev.innerHTML = '';
  const name = Object.assign(document.createElement('p'), { className: 'ev-skill', textContent: cell.dataset.skill });
  const place = Object.assign(document.createElement('p'), { className: 'ev-place', textContent: cell.dataset.place });
  const text = Object.assign(document.createElement('p'), { className: 'ev-text', textContent: cell.dataset.ev });
  ev.append(name, place, text);
}
$$('.m-cell').forEach((c) => {
  c.setAttribute('aria-pressed', 'false');
  c.addEventListener('mouseenter', () => showEvidence(c));
  c.addEventListener('focus', () => showEvidence(c));
  c.addEventListener('click', () => {
    if (pinned) pinned.setAttribute('aria-pressed', 'false');
    pinned = c;
    c.setAttribute('aria-pressed', 'true');
    showEvidence(c);
  });
});
$('.matrix')?.addEventListener('mouseleave', () => { if (pinned) showEvidence(pinned); });

/* ── Offer sheet: live preview and a drafted email ── */
const form = $('[data-offer]');
if (form) {
  const fields = { company: 'Your company', role: PERSON.role, name: 'you' };
  const sync = () => {
    Object.entries(fields).forEach(([k, fallback]) => {
      const v = form.elements[k].value.trim();
      $$(`[data-o="${k}"]`).forEach((el) => (el.textContent = v || fallback));
    });
  };
  form.addEventListener('input', sync);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const company = form.elements.company.value.trim();
    const role = form.elements.role.value.trim() || 'a data role';
    const name = form.elements.name.value.trim();
    const subject = company ? `${role} at ${company}` : `About ${role}`;
    const body = [
      `Hi ${PERSON.first},`,
      '',
      company ? `We're hiring for ${role} at ${company} and would like to talk.` : `I'd like to talk to you about ${role}.`,
      '',
      name ? `Best,\n${name}` : 'Best,',
    ].join('\n');
    location.href = `mailto:${PERSON.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

/* ── Sections that load their own code ── */
const pipe = $('[data-pipeline]');
if (pipe) initPipeline(pipe, { reduced });
const con = $('[data-console]');
if (con) initConsole(con);
