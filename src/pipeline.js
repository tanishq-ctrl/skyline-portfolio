// "Run the pipeline": 1,080 spreadsheets with mismatched layouts travel through
// the stages of an ETL pipeline and land in one database.
const N = 800; // number of files shown in the replay
const DUP_RATE = 0.15; // illustrative share of duplicates removed in the replay
const SPREAD = 4.4; // seconds over which files leave the pile
const TRAVEL = 2.6; // seconds each file takes to reach the database
const SCHEMA = ['#6E86C8', '#C98AB8', '#7FB8A4', '#C8A46E', '#8E7FD0', '#B87C6E'];
const UNIFIED = '#FFB45E';
const DUP = '#E5655C';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function initPipeline(root, { reduced }) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const btn = root.querySelector('[data-run]');
  const out = {
    files: root.querySelector('[data-files]'),
    records: root.querySelector('[data-records]'),
    time: root.querySelector('[data-time]'),
  };

  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const P = Array.from({ length: N }, (_, i) => {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand());
    return {
      px: 0.5 + Math.cos(a) * r * 0.5, py: 0.5 + Math.sin(a) * r * 0.5,
      rot: (rand() - 0.5) * 1.4, hue: SCHEMA[Math.floor(rand() * SCHEMA.length)],
      w: 0.7 + rand() * 0.6, lane: 0.08 + rand() * 0.84,
      start: 0, dup: rand() < DUP_RATE, order: rand(),
    };
  });
  P.sort((a, b) => a.order - b.order).forEach((p, i) => (p.start = (i / N) * SPREAD));
  const keep = P.filter((p) => !p.dup).length;

  let W = 0, H = 0, dpr = 1, L = null;
  function layout() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const narrow = W < 640;
    L = {
      pile: { x: W * 0.03, y: H * 0.2, w: W * (narrow ? 0.22 : 0.22), h: H * 0.62 },
      gates: [W * 0.36, W * 0.5, W * 0.64],
      db: { x: W * 0.865, top: H * 0.24, bottom: H * 0.8, rx: W * (narrow ? 0.085 : 0.07) },
      lanes: { top: H * 0.24, h: H * 0.56 },
      size: narrow ? 3.2 : 5.2,
      narrow,
    };
    L.db.ry = L.db.rx * 0.3;
  }

  const labels = [
    ['1', 'Extract'], ['2', 'Map columns'], ['3', 'Clean'], ['4', 'Remove duplicates'], ['5', 'Load'],
  ];

  function drawStage() {
    ctx.save();
    ctx.font = `500 ${L.narrow ? 10 : 12.5}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const xs = [L.pile.x + L.pile.w / 2, ...L.gates, L.db.x];
    xs.forEach((x, i) => {
      ctx.fillStyle = 'rgba(239,230,214,0.72)';
      const [n, t] = labels[i];
      if (L.narrow) {
        ctx.fillText(n, x, 18);
      } else {
        ctx.fillText(`${n}  ${t}`, x, 22);
      }
      if (i > 0 && i < 4) {
        ctx.strokeStyle = 'rgba(159,176,224,0.22)';
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x, H - 18); ctx.stroke();
      }
    });
    ctx.restore();
  }

  function drawDB(fill, files) {
    const { x, top, bottom, rx, ry } = L.db;
    const level = bottom - (bottom - top) * fill;
    ctx.save();
    // body
    ctx.fillStyle = 'rgba(20,26,58,0.9)';
    ctx.strokeStyle = 'rgba(159,176,224,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, bottom, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(x - rx, top);
    ctx.ellipse(x, top, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // contents
    if (fill > 0) {
      const g = ctx.createLinearGradient(0, level, 0, bottom);
      g.addColorStop(0, 'rgba(255,180,94,0.95)');
      g.addColorStop(1, 'rgba(255,180,94,0.35)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, bottom, rx - 1, ry - 1, 0, 0, Math.PI);
      ctx.lineTo(x - rx + 1, level);
      ctx.ellipse(x, level, rx - 1, ry - 1, 0, Math.PI, 0, true);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(14,19,48,0.35)';
      for (let y = bottom - 6; y > level + 4; y -= 7) {
        ctx.beginPath(); ctx.ellipse(x, y, rx - 1, ry - 1, 0, 0.15, Math.PI - 0.15); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,214,160,0.95)';
      ctx.beginPath(); ctx.ellipse(x, level, rx - 1, ry - 1, 0, 0, Math.PI * 2); ctx.fill();
    }
    files();
    ctx.strokeStyle = 'rgba(159,176,224,0.6)';
    ctx.beginPath(); ctx.ellipse(x, top, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function fileAt(p, t) {
    const sx = L.pile.x + p.px * L.pile.w, sy = L.pile.y + p.py * L.pile.h;
    if (t < p.start) return { x: sx, y: sy, rot: p.rot, color: p.hue, w: p.w, a: 1 };
    const u = (t - p.start) / TRAVEL;
    if (u >= 1) return null;
    const ex = L.db.x + (p.lane - 0.5) * L.db.rx * 0.9, ey = L.level;
    const x = sx + (ex - sx) * ease(u);
    const laneY = L.lanes.top + p.lane * L.lanes.h;
    let y = sy + (laneY - sy) * smooth(0, 0.3, u);
    y += (ey - y) * smooth(0.8, 1, u);
    const [g2, g3, g4] = L.gates;
    let color = x < g2 ? p.hue : UNIFIED;
    let rot = x < g3 ? p.rot * (1 - smooth(g3 - 60, g3, x)) : 0;
    let w = x < g3 ? p.w : 1;
    let a = 1;
    if (p.dup && x > g4 - 4) {
      color = DUP;
      const k = (x - g4) / 46;
      if (k > 1) return null;
      a = 1 - Math.max(0, k);
      y += Math.max(0, k) * 30;
    }
    const shrink = 1 - smooth(0.88, 1, u) * 0.8;
    return { x, y, rot, color, w: w * shrink, a };
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawStage();
    let left = 0, loaded = 0;
    for (const p of P) {
      if (t >= p.start) left++;
      if (!p.dup && t >= p.start + TRAVEL) loaded++;
    }
    const fill = loaded / keep;
    L.level = L.db.bottom - (L.db.bottom - L.db.top) * fill;
    const s = L.size;
    drawDB(fill, () => {
      for (const p of P) {
        const f = fileAt(p, t);
        if (!f) continue;
        ctx.save();
        ctx.globalAlpha = f.a * 0.92;
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillStyle = f.color;
        ctx.fillRect((-s * f.w) / 2, (-s * 1.3 * f.w) / 2, s * f.w, s * 1.3 * f.w);
        ctx.restore();
      }
    });
    out.files.textContent = left.toLocaleString('en-US');
    out.records.textContent = `${(fill * 1.2).toFixed(1)}M`;
    return fill;
  }

  let t0 = -1, raf = 0, done = false;
  function tick(now) {
    if (t0 < 0) t0 = now;
    const t = (now - t0) / 1000;
    const fill = draw(t);
    if (fill >= 1) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  function finish() {
    done = true;
    root.classList.add('is-done');
    out.time.innerHTML = '<s>days</s> minutes';
    btn.textContent = 'Run it again';
    btn.disabled = false;
  }
  function run() {
    cancelAnimationFrame(raf);
    root.classList.remove('is-done');
    root.classList.add('is-running');
    out.time.textContent = 'days';
    btn.disabled = true;
    btn.textContent = 'Running';
    if (reduced) { draw(SPREAD + TRAVEL + 1); finish(); return; }
    t0 = -1;
    raf = requestAnimationFrame(tick);
  }
  btn.addEventListener('click', run);

  function redraw() {
    layout();
    draw(done ? SPREAD + TRAVEL + 1 : -1);
  }
  new ResizeObserver(redraw).observe(canvas);
  (document.fonts?.ready || Promise.resolve()).then(redraw);
}
