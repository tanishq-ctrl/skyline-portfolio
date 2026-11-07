// The hero: a procedural Dubai skyline at dusk. The front row of towers is a
// real bar chart of results from data.js (height = log10 of the number,
// grouped by employer). Scrolling dolly-zooms the camera until the city
// flattens into that chart.
import {
  WebGLRenderer, Scene, PerspectiveCamera, BoxGeometry, InstancedBufferGeometry,
  InstancedBufferAttribute, ShaderMaterial, Mesh, PlaneGeometry, SphereGeometry, BackSide,
  DoubleSide, BufferGeometry, Float32BufferAttribute, Points, LineSegments, Vector3, Vector2,
  Box3, Raycaster, AdditiveBlending, ColorManagement, LinearSRGBColorSpace,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { METRICS, PLACES, placeById } from './data.js';

ColorManagement.enabled = false;

const K = 12; // world units per order of magnitude
const BAR_W = 4.4;
const STEP = 6.6;
const GROUP_GAP = 9;
const SHORE_Z = 5;

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Chart layout ─────────────────────────────────────────────── */
export function chartLayout() {
  const groups = PLACES.filter((p) => METRICS.some((m) => m.place === p.id));
  const bars = [];
  const groupSpans = [];
  let x = 0;
  groups.forEach((g, gi) => {
    if (gi) x += GROUP_GAP;
    const start = x;
    METRICS.forEach((m, i) => {
      if (m.place !== g.id) return;
      bars.push({ i, m, x, h: K * Math.log10(m.v) });
      x += STEP;
    });
    groupSpans.push({ place: g, from: start, to: x - STEP });
  });
  const mid = (bars[0].x + bars[bars.length - 1].x) / 2;
  bars.forEach((b) => (b.x -= mid));
  groupSpans.forEach((s) => { s.from -= mid; s.to -= mid; });
  return { bars, groupSpans, half: bars[bars.length - 1].x + BAR_W / 2 };
}

/* ── Shaders ──────────────────────────────────────────────────── */
const COMMON = /* glsl */ `
  uniform float uTime; uniform float uIntro; uniform float uChart; uniform float uMirror;
  float easeOut(float t){ return 1.0 - pow(1.0 - t, 3.0); }
  float growOf(vec4 info, float z){
    float g = easeOut(clamp((uIntro - info.y) / 0.45, 0.0, 1.0));
    if (info.z < 0.5 || info.z > 1.5) {
      float delay = clamp((-z - 14.0) / 320.0, 0.0, 1.0) * 0.55 + info.x * 0.04;
      float s = clamp((uChart - delay) / 0.4, 0.0, 1.0);
      g *= 1.0 - s * s * (3.0 - 2.0 * s);
    }
    return g;
  }
`;

const BUILDING_VS = /* glsl */ `
  attribute vec3 aPos; attribute vec3 aSize; attribute vec4 aInfo; attribute vec3 aTint;
  ${COMMON}
  varying vec3 vLocal; varying vec3 vN; varying vec3 vWorld; varying vec4 vInfo;
  varying vec3 vTint; varying vec3 vSize; varying float vGrow;
  void main(){
    float g = growOf(aInfo, aPos.z);
    vec3 p = position * aSize;
    p.y *= g;
    vec3 w = aPos + p;
    if (uMirror > 0.5) w.y = -w.y;
    vLocal = p; vN = normal; vWorld = w; vInfo = aInfo; vTint = aTint; vSize = aSize; vGrow = g;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;

const BUILDING_FS = /* glsl */ `
  uniform float uTime; uniform float uChart; uniform float uMirror; uniform float uHover;
  uniform vec3 uFacade; uniform vec3 uHaze; uniform vec3 uWater;
  varying vec3 vLocal; varying vec3 vN; varying vec3 vWorld; varying vec4 vInfo;
  varying vec3 vTint; varying vec3 vSize; varying float vGrow;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main(){
    bool metric = vInfo.z > 0.5 && vInfo.z < 1.5;
    float top = vSize.y * vGrow;
    float hN = clamp(vLocal.y / max(vSize.y, 1.0), 0.0, 1.0);
    vec3 col;
    if (vN.y > 0.5) {
      col = uFacade * 0.7;
      if (metric) col += vTint * 0.35;
    } else {
      float side = abs(vN.x) > 0.5 ? 1.0 : 0.0;
      float u = side > 0.5 ? vLocal.z : vLocal.x;
      float face = side > 0.5 ? sign(vN.x) + 2.0 : sign(vN.z) + 5.0;
      vec2 cell = metric ? vec2(0.74, 1.0) : vec2(0.95, 1.2);
      vec2 c = vec2(u + 40.0, vLocal.y) / cell;
      vec2 id = floor(c); vec2 f = fract(c);
      float win = smoothstep(0.12, 0.22, f.x) * smoothstep(0.88, 0.78, f.x)
                * smoothstep(0.2, 0.3, f.y) * smoothstep(0.86, 0.76, f.y);
      float r = hash(id + vec2(vInfo.x * 91.7 + face * 13.1, face * 7.3));
      float floorDark = step(0.16, hash(vec2(id.y * 1.3, vInfo.x * 33.0 + face)));
      float ratio = metric ? 0.5 : 0.3;
      float lit = step(1.0 - ratio, r) * floorDark;
      float flick = step(0.992, hash(id * 1.7 + vInfo.x)) * step(0.5, fract(uTime * 0.07 + r * 9.0));
      lit = max(lit - flick, 0.0);
      vec3 warm = vec3(1.0, 0.68, 0.34);
      vec3 cool = vec3(0.72, 0.84, 1.0);
      vec3 wc = metric ? vTint : mix(warm, cool, step(0.84, hash(id + 3.1)));
      float bright = 0.55 + 0.75 * hash(id + 9.7);
      vec3 sharp = wc * bright * lit * win;
      vec2 fw = fwidth(c);
      float detail = 1.0 - smoothstep(0.3, 0.75, max(fw.x, fw.y));
      vec3 windows = mix(wc * ratio * 0.42, sharp, detail);
      vec3 facade = uFacade * (0.5 + 0.6 * hN) * (side > 0.5 ? 0.78 : 1.0);
      col = facade + windows * (metric ? 0.9 : 1.0);
      if (metric) {
        float fin = smoothstep(0.86, 0.98, fract((u + 40.0) / 0.74));
        col += vTint * fin * 0.06;
        float crown = smoothstep(top - 1.5, top - 1.1, vLocal.y);
        col = mix(col, vTint * 1.3, crown);
        float scanY = mod(uTime * 5.0 + vInfo.x * 60.0, max(top, 1.0) * 1.6);
        col += vTint * exp(-abs(vLocal.y - scanY) * 1.6) * 0.35;
        col = mix(col, vTint * (0.42 + 0.3 * hN) + windows * 0.5, uChart * 0.7);
      }
    }
    if (metric && abs(vInfo.w - uHover) < 0.5) col = col * 1.12 + vTint * 0.1;
    float depth = smoothstep(-15.0, -330.0, vWorld.z);
    float low = 1.0 - smoothstep(0.0, 30.0, abs(vWorld.y));
    col = mix(col, uHaze, depth * 0.82 + low * depth * 0.15);
    if (uMirror > 0.5) {
      col = mix(col * 0.5, uWater, smoothstep(0.0, 70.0, -vWorld.y) * 0.7);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_VS = /* glsl */ `
  varying vec3 vDir;
  void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SKY_FS = /* glsl */ `
  uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform float uTime;
  varying vec3 vDir;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.16, h));
    col = mix(col, uZenith, smoothstep(0.14, 0.6, h));
    col = mix(col, uGlow, (1.0 - smoothstep(-0.01, 0.07, h)) * 0.85);
    vec2 sp = vec2(atan(d.z, d.x) * 180.0, h * 260.0);
    vec2 id = floor(sp);
    float s = step(0.9965, hash(id)) * smoothstep(0.12, 0.5, h);
    float tw = 0.6 + 0.4 * sin(uTime * 1.3 + hash(id + 1.0) * 40.0);
    col += vec3(0.9, 0.88, 1.0) * s * tw * 0.55 * smoothstep(0.5, 0.0, length(fract(sp) - 0.5));
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const GROUND_FS = /* glsl */ `
  uniform vec3 uGround; uniform vec3 uRoad; uniform vec3 uHaze; uniform float uChart;
  varying vec3 vW;
  void main(){
    vec2 g = mod(vW.xz + vec2(9.0, 3.0), 22.0);
    float road = (1.0 - smoothstep(0.0, 1.2, abs(g.x - 2.0))) + (1.0 - smoothstep(0.0, 1.2, abs(g.y - 2.0)));
    float promenade = 1.0 - smoothstep(0.0, 1.6, abs(vW.z - 3.8));
    vec3 col = uGround + uRoad * clamp(road, 0.0, 1.0) * 0.32 + uRoad * promenade * 0.5;
    float depth = smoothstep(-10.0, -330.0, vW.z);
    col = mix(col, uHaze, depth * 0.85);
    gl_FragColor = vec4(col, 1.0);
  }
`;
const WORLD_VS = /* glsl */ `
  varying vec3 vW;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const WATER_FS = /* glsl */ `
  uniform vec3 uWater; uniform vec3 uGlint; uniform float uTime; uniform vec3 uCam;
  varying vec3 vW;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    vec3 v = normalize(uCam - vW);
    float graze = 1.0 - abs(v.y);
    float n = noise(vec2(vW.x * 0.08, vW.z * 0.9 - uTime * 0.6)) * noise(vec2(vW.x * 0.03 + uTime * 0.05, vW.z * 0.25));
    float alpha = mix(0.93, 0.5, graze);
    alpha = clamp(alpha + (n - 0.25) * 0.35, 0.35, 0.97);
    vec3 col = uWater + uGlint * smoothstep(0.42, 0.62, n) * 0.25;
    gl_FragColor = vec4(col, alpha);
  }
`;

const TRAFFIC_VS = /* glsl */ `
  attribute float aLane; attribute float aOffset; attribute float aSpeed;
  uniform float uTime; uniform float uPx;
  varying vec3 vColor;
  void main(){
    float x = mod(aOffset + aSpeed * uTime + 320.0, 640.0) - 320.0;
    vec3 p = vec3(x, 0.4, aLane < 0.5 ? 3.3 : 4.3);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uPx * 150.0 / max(-mv.z, 1.0), uPx * 1.2, uPx * 5.0);
    vColor = aLane < 0.5 ? vec3(1.0, 0.92, 0.78) : vec3(1.0, 0.28, 0.2);
  }
`;
const BEACON_VS = /* glsl */ `
  attribute vec3 aPos; attribute vec4 aInfo; attribute float aH;
  ${COMMON}
  uniform float uPx;
  varying vec3 vColor;
  void main(){
    float g = growOf(aInfo, aPos.z);
    vec3 p = vec3(aPos.x, aH * g + 0.6, aPos.z);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float blink = step(0.55, fract(uTime * 0.55 + aInfo.x));
    gl_PointSize = clamp(uPx * 260.0 / max(-mv.z, 1.0), uPx * 1.5, uPx * 6.0) * blink * step(0.98, g);
    vColor = vec3(1.0, 0.18, 0.15);
  }
`;
const DOT_FS = /* glsl */ `
  varying vec3 vColor;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vColor * a * 1.6, a);
  }
`;
const LINE_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  void main(){ gl_FragColor = vec4(uColor, uOpacity); }
`;

/* ── City generation ──────────────────────────────────────────── */
function buildCity(layout, mobile) {
  const rand = rng(20260807);
  const items = [];
  const hues = Object.fromEntries(PLACES.map((p) => [p.id, hex(p.hue)]));

  layout.bars.forEach((b, k) => {
    items.push({
      pos: [b.x, 0, 0], size: [BAR_W, b.h, BAR_W],
      info: [rand(), 0.08 + k * 0.04, 1, b.i], tint: hues[b.m.place].toArray(),
    });
  });

  // Landmark: a stepped supertall in the distance (generic, not a real tower).
  const lx = 34, lz = -205;
  [[16, 70], [12, 118], [9, 158], [6, 192], [3.2, 222], [1.2, 262]].forEach(([w, h], t) => {
    items.push({ pos: [lx, 0, lz], size: [w, h, w], info: [0.2 + t * 0.05, 0.5 + t * 0.06, 2, -1], tint: [1, 0.7, 0.36] });
  });

  const clusters = [[-40, -70, 45, 2.2], [70, -140, 50, 2.6], [-130, -215, 55, 1.8], [lx, lz, 40, 1.6]];
  const block = 22, road = 4;
  const density = mobile ? 0.55 : 1;
  for (let bx = -300; bx < 300; bx += block) {
    for (let bz = -14; bz > -330; bz -= block) {
      const lots = 1 + Math.floor(rand() * 4);
      for (let l = 0; l < lots; l++) {
        if (rand() > density) continue;
        const w = 4 + rand() * 9, d = 4 + rand() * 9;
        const x = bx + road + w / 2 + rand() * Math.max(0, block - road - w);
        const z = bz - road - d / 2 - rand() * Math.max(0, block - road - d);
        if (Math.abs(x - lx) < 14 && Math.abs(z - lz) < 14) continue;
        let h = 5 + Math.pow(rand(), 2.2) * 34;
        for (const [cx, cz, r, boost] of clusters) {
          const dd = (x - cx) ** 2 + (z - cz) ** 2;
          h *= 1 + boost * Math.exp(-dd / (2 * r * r)) * (0.4 + rand() * 0.8);
        }
        if (z > -50) h *= 0.55;
        const dist = Math.hypot(x, z);
        items.push({ pos: [x, 0, z], size: [w, h, d], info: [rand(), 0.12 + Math.min(1, dist / 340) * 0.55 + rand() * 0.35, 0, -1], tint: [1, 0.7, 0.36] });
      }
    }
  }
  return items;
}

function buildingGeometry(items) {
  const box = new BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const g = new InstancedBufferGeometry();
  g.index = box.index;
  g.attributes.position = box.attributes.position;
  g.attributes.normal = box.attributes.normal;
  const pos = new Float32Array(items.length * 3), size = new Float32Array(items.length * 3);
  const info = new Float32Array(items.length * 4), tint = new Float32Array(items.length * 3);
  items.forEach((it, i) => {
    pos.set(it.pos, i * 3); size.set(it.size, i * 3); info.set(it.info, i * 4); tint.set(it.tint, i * 3);
  });
  g.setAttribute('aPos', new InstancedBufferAttribute(pos, 3));
  g.setAttribute('aSize', new InstancedBufferAttribute(size, 3));
  g.setAttribute('aInfo', new InstancedBufferAttribute(info, 4));
  g.setAttribute('aTint', new InstancedBufferAttribute(tint, 3));
  g.instanceCount = items.length;
  return g;
}

/* ── Public API ───────────────────────────────────────────────── */
export function initSkyline({ canvas, stage, overlay, tip, copy, reduced }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const px = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.5);
  // Keep the drawing buffer inside a pixel budget, then let the frame rate
  // nudge resolution down (or back up) so the scroll stays at 60 fps.
  const BUDGET = mobile ? 1.3e6 : 2.1e6;
  let quality = 1;
  const pixelRatio = () => Math.max(0.6, Math.min(px, Math.sqrt(BUDGET / (W * H))) * quality);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x0e1330, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(46, 1, 0.5, 4000);
  const layout = chartLayout();

  const uniforms = {
    uTime: { value: 0 }, uIntro: { value: reduced ? 3 : 0 }, uChart: { value: 0 },
    uMirror: { value: 0 }, uHover: { value: -1 },
    uFacade: { value: hex('#141A3A') }, uHaze: { value: hex('#2B2650') }, uWater: { value: hex('#0B1030') },
  };

  // Sky
  const sky = new Mesh(new SphereGeometry(1800, 32, 16), new ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: BackSide, depthWrite: false,
    uniforms: {
      uZenith: { value: hex('#0A0F2C') }, uMid: { value: hex('#1B1C48') },
      uHorizon: { value: hex('#3A2C58') }, uGlow: { value: hex('#7A4E66') }, uTime: uniforms.uTime,
    },
  }));
  scene.add(sky);

  // Ground and water
  const ground = new Mesh(new PlaneGeometry(900, 420), new ShaderMaterial({
    vertexShader: WORLD_VS, fragmentShader: GROUND_FS,
    uniforms: { uGround: { value: hex('#0C1028') }, uRoad: { value: hex('#FFB45E') }, uHaze: uniforms.uHaze, uChart: uniforms.uChart },
  }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, SHORE_Z - 210);
  scene.add(ground);

  const camPos = new Vector3();
  const water = new Mesh(new PlaneGeometry(1800, 900), new ShaderMaterial({
    vertexShader: WORLD_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false,
    uniforms: { uWater: uniforms.uWater, uGlint: { value: hex('#8FA6D8') }, uTime: uniforms.uTime, uCam: { value: camPos } },
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, SHORE_Z + 450);
  scene.add(water);

  // Buildings, and their reflection under the water
  const items = buildCity(layout, mobile);
  const geo = buildingGeometry(items);
  const mat = new ShaderMaterial({ vertexShader: BUILDING_VS, fragmentShader: BUILDING_FS, uniforms });
  const city = new Mesh(geo, mat);
  city.frustumCulled = false;
  scene.add(city);
  const mirrorUniforms = { ...uniforms, uMirror: { value: 1 } };
  const mirror = new Mesh(geo, new ShaderMaterial({ vertexShader: BUILDING_VS, fragmentShader: BUILDING_FS, uniforms: mirrorUniforms, side: DoubleSide }));
  mirror.frustumCulled = false;
  scene.add(mirror);

  // Traffic on the waterfront road, which doubles as the chart's x-axis
  const nCars = mobile ? 160 : 320;
  const tGeo = new BufferGeometry();
  const tr = rng(7);
  const lane = new Float32Array(nCars), off = new Float32Array(nCars), spd = new Float32Array(nCars);
  for (let i = 0; i < nCars; i++) {
    lane[i] = i % 2; off[i] = tr() * 640; spd[i] = (lane[i] ? -1 : 1) * (7 + tr() * 6);
  }
  tGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(nCars * 3), 3));
  tGeo.setAttribute('aLane', new Float32BufferAttribute(lane, 1));
  tGeo.setAttribute('aOffset', new Float32BufferAttribute(off, 1));
  tGeo.setAttribute('aSpeed', new Float32BufferAttribute(spd, 1));
  const traffic = new Points(tGeo, new ShaderMaterial({
    vertexShader: TRAFFIC_VS, fragmentShader: DOT_FS, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: uniforms.uTime, uPx: { value: px } },
  }));
  traffic.frustumCulled = false;
  scene.add(traffic);

  // Aviation beacons on the tall towers
  const tall = items.filter((it) => it.size[1] > 48 && it.info[2] !== 2);
  const bGeo = new BufferGeometry();
  bGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(tall.length * 3), 3));
  bGeo.setAttribute('aPos', new Float32BufferAttribute(tall.flatMap((t) => t.pos), 3));
  bGeo.setAttribute('aInfo', new Float32BufferAttribute(tall.flatMap((t) => t.info), 4));
  bGeo.setAttribute('aH', new Float32BufferAttribute(tall.map((t) => t.size[1]), 1));
  const beacons = new Points(bGeo, new ShaderMaterial({
    vertexShader: BEACON_VS, fragmentShader: DOT_FS, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { ...uniforms, uPx: { value: px } },
  }));
  beacons.frustumCulled = false;
  scene.add(beacons);

  // Chart gridlines (one per order of magnitude), shown only as the chart
  const gridMat = new ShaderMaterial({
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: LINE_FS, transparent: true, depthWrite: false,
    uniforms: { uColor: { value: hex('#9FB0E0') }, uOpacity: { value: 0 } },
  });
  const gl = [];
  const x0 = -layout.half - 7, x1 = layout.half + 4;
  for (let k = 0; k <= 6; k++) gl.push(x0, k * K, -2.6, x1, k * K, -2.6);
  const grid = new LineSegments(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(gl, 3)), gridMat);
  scene.add(grid);

  // Post-processing: bloom makes the lit windows glow (skipped on phones)
  let composer = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.6, 0.5, 0.8);
    // Bloom is a blur: computing it at half resolution looks the same and
    // costs a quarter of the fill rate.
    const setBloomSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => setBloomSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    composer.addPass(bloom);
  }

  /* ── HTML overlay: bar values, axis ticks, group names ── */
  const labels = layout.bars.map((b) => {
    const el = document.createElement('div');
    el.className = 'bar-label';
    el.style.setProperty('--hue', placeById[b.m.place].hue);
    el.innerHTML = `<span class="full">${b.m.show}</span><span class="short">${b.m.short}</span>`;
    overlay.appendChild(el);
    return el;
  });
  const ticks = ['1', '10', '100', '1k', '10k', '100k', '1M'].map((t) => {
    const el = document.createElement('div');
    el.className = 'tick';
    el.textContent = t;
    overlay.appendChild(el);
    return el;
  });
  const groupEls = layout.groupSpans.map((s) => {
    const el = document.createElement('div');
    el.className = 'group-label';
    el.style.setProperty('--hue', s.place.hue);
    el.innerHTML = `<b>${s.place.name}</b> ${s.place.years}`;
    overlay.appendChild(el);
    return el;
  });

  /* ── Camera rig: city view → chart view as a dolly zoom ── */
  let W = 1, H = 1, aspect = 1;
  const A = { target: new Vector3(), dir: new Vector3(), fov: 46, width: 1 };
  const B = { target: new Vector3(), dir: new Vector3(0, 0, 1), fov: 13, width: 1 };
  function rigFor() {
    const portrait = aspect < 0.9;
    const posA = portrait ? new Vector3(-14, 15, 150) : new Vector3(-34, 15, 118);
    A.target.copy(portrait ? new Vector3(4, 6, -30) : new Vector3(6, 6, -34));
    A.fov = portrait ? 50 : 38;
    A.dir.copy(posA).sub(A.target);
    const dA = A.dir.length(); A.dir.normalize();
    A.width = 2 * dA * Math.tan((A.fov * Math.PI) / 360);
    // Fit the whole chart (bars, labels under the axis, tick labels on the
    // left) into the part of the screen the caption leaves free.
    const t = Math.tan((B.fov * Math.PI) / 360);
    const chartW = (layout.half + (portrait ? 13 : 9)) * 2, chartH = 6.3 * K + 26;
    const cx = portrait ? -3.5 : -1.5, cy = 6.3 * K / 2 - 2;
    const box = copy?.getBoundingClientRect();
    if (portrait) {
      const topFrac = box ? Math.min(0.45, (box.bottom + 16) / H) : 0.3;
      const dB = Math.max(chartH / 2 / t / (1 - topFrac - 0.04), chartW / 2 / (t * aspect));
      const vh = 2 * dB * t;
      B.target.set(cx, cy + (topFrac / 2) * vh, 0);
      B.width = vh;
    } else {
      const leftFrac = box ? Math.min(0.42, (box.right + 24) / W) : 0.34;
      const dB = Math.max(chartH / 2 / t / 0.92, chartW / 2 / (t * aspect * (1 - leftFrac)));
      const vw = 2 * dB * t * aspect;
      B.target.set(cx - (leftFrac / 2) * vw, cy + 2, 0);
      B.width = 2 * dB * t;
    }
  }

  const look = new Vector3(), dir = new Vector3(), pointer = new Vector2(), pSmooth = new Vector2();
  let progress = 0, eShown = 0, eCss = -1;
  function placeCamera(e, time) {
    const fov = Math.exp(lerp(Math.log(A.fov), Math.log(B.fov), e));
    const width = lerp(A.width, B.width, e);
    const dist = width / (2 * Math.tan((fov * Math.PI) / 360));
    look.lerpVectors(A.target, B.target, e);
    dir.copy(A.dir).lerp(B.dir, e).normalize();
    camera.position.copy(look).addScaledVector(dir, dist);
    const free = 1 - e;
    if (!reduced) {
      camera.position.x += (Math.sin(time * 0.06) * 3 + pSmooth.x * 5) * free;
      camera.position.y += (pSmooth.y * 2.2) * free;
    }
    camera.position.y += Math.sin(e * Math.PI) * 18 * (1 - e * 0.3);
    camera.fov = fov;
    camera.near = Math.max(0.5, dist * 0.02);
    camera.updateProjectionMatrix();
    camera.lookAt(look);
    sky.position.copy(camera.position);
    camPos.copy(camera.position);
  }

  function applyResolution() {
    const pr = pixelRatio();
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); }
    canvas.dataset.q = `${quality.toFixed(2)}@${pr.toFixed(2)}`;
  }
  // Step resolution down while the average frame misses 60 fps. Never step
  // back up: at 60 Hz a frame never reads faster than 16.7 ms, so "fast
  // enough" can't be told apart from "just enough", and flip-flopping
  // reallocates buffers (a visible hitch).
  let acc = 0, n = 0, seen = 0;
  function adapt(ms) {
    if (++seen < 90 || ms > 100) return; // skip shader warm-up and tab switches
    acc += ms; n++;
    if (n < 45) return;
    const avg = acc / n; acc = 0; n = 0;
    if (avg > 18.5 && quality > 0.6) { quality *= 0.85; applyResolution(); }
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); aspect = W / H;
    applyResolution();
    camera.aspect = aspect;
    rigFor();
  }

  /* ── Hover: which tower is under the pointer ── */
  const ray = new Raycaster();
  const boxes = layout.bars.map((b) => ({ b, box: new Box3() }));
  let hover = -1, pinned = false;
  function towerGrow(k) {
    const t = Math.min(1, Math.max(0, (uniforms.uIntro.value - (0.08 + k * 0.04)) / 0.45));
    return 1 - Math.pow(1 - t, 3);
  }
  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const ndc = new Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = -1, bestD = Infinity;
    const hit = new Vector3();
    boxes.forEach(({ b, box }, k) => {
      const h = b.h * towerGrow(k);
      box.min.set(b.x - BAR_W / 2 - 0.6, 0, -BAR_W / 2);
      box.max.set(b.x + BAR_W / 2 + 0.6, h + 1, BAR_W / 2);
      if (ray.ray.intersectBox(box, hit)) {
        const d = hit.distanceTo(camera.position);
        if (d < bestD) { bestD = d; best = k; }
      }
    });
    return best;
  }
  function showTip(k, cx, cy) {
    hover = k;
    uniforms.uHover.value = k < 0 ? -1 : layout.bars[k].i;
    if (k < 0) { tip.hidden = true; return; }
    const { m } = layout.bars[k];
    const place = placeById[m.place];
    tip.style.setProperty('--hue', place.hue);
    tip.innerHTML = `<strong>${m.show}</strong> <span>${m.what}</span><p>${m.more[0].toUpperCase() + m.more.slice(1)}.</p><small>${place.full}</small>`;
    tip.hidden = false;
    const r = stage.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = cx - r.left + 18, y = cy - r.top - th - 14;
    if (x + tw > r.width - 12) x = cx - r.left - tw - 18;
    if (y < 70) y = cy - r.top + 22;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  canvas.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (e.pointerType === 'mouse' && !pinned) showTip(pick(e.clientX, e.clientY), e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => { if (!pinned) showTip(-1); });
  canvas.addEventListener('click', (e) => {
    const k = pick(e.clientX, e.clientY);
    pinned = k >= 0 && !(pinned && k === hover);
    showTip(pinned ? k : -1, e.clientX, e.clientY);
  });
  canvas.style.cursor = 'crosshair';

  /* ── Overlay positions ── */
  const v = new Vector3();
  function project(x, y, z) {
    v.set(x, y, z).project(camera);
    return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
  }
  function placeOverlay(alpha) {
    overlay.style.opacity = alpha.toFixed(3);
    overlay.style.visibility = alpha < 0.01 ? 'hidden' : 'visible';
    if (alpha < 0.01) return;
    layout.bars.forEach((b, k) => {
      const [sx, sy] = project(b.x, b.h, BAR_W / 2);
      labels[k].style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    });
    ticks.forEach((el, k) => {
      const [sx, sy] = project(-layout.half - 7.5, k * K, -2.6);
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    });
    layout.groupSpans.forEach((s, k) => {
      const [sx, sy] = project((s.from + s.to) / 2, 0, BAR_W / 2);
      groupEls[k].style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    });
  }

  /* ── Loop ── */
  let running = false, last = performance.now(), introStart = -1, time = 0;
  function frame(now) {
    if (!running) return;
    const ms = now - last;
    const dt = Math.min(0.05, ms / 1000);
    last = now;
    adapt(ms);
    if (!reduced) time += dt;
    uniforms.uTime.value = time;
    if (introStart < 0) introStart = now;
    if (!reduced) uniforms.uIntro.value = Math.min(3, (now - introStart) / 1000 / 2.2);
    pSmooth.lerp(pointer, 1 - Math.exp(-dt * 2.5));
    const target = reduced ? (progress > 0.4 ? 1 : 0) : smooth(0.1, 0.6, progress);
    eShown += (target - eShown) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
    if (Math.abs(target - eShown) < 0.0005) eShown = target;
    if (Math.abs(eShown - eCss) > 0.0008 || (eShown !== eCss && (eShown === 0 || eShown === 1))) {
      eCss = eShown;
      stage.style.setProperty('--e', eShown.toFixed(4));
    }
    uniforms.uChart.value = smooth(0.2, 0.85, eShown);
    gridMat.uniforms.uOpacity.value = smooth(0.75, 1, eShown) * 0.16;
    placeCamera(eShown, time);
    placeOverlay(smooth(0.82, 0.98, eShown));
    if (composer) composer.render(); else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function stop() { running = false; }

  resize();
  addEventListener('resize', resize);
  document.fonts?.ready.then(resize);
  const io = new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()), { threshold: 0 });
  io.observe(stage);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();

  return {
    setProgress(p) { progress = p; },
    get chartAmount() { return eShown; },
  };
}

/* ── Fallback when WebGL is unavailable: the same chart as SVG ── */
export function svgChart() {
  const { bars, groupSpans, half } = chartLayout();
  const s = 5, top = 6.6 * K;
  const w = (half + 10) * 2 * s, h = (top + 18) * s;
  const X = (x) => (x + half + 10) * s, Y = (y) => (top - y + 4) * s;
  const rects = bars.map((b) => {
    const hue = placeById[b.m.place].hue;
    return `<rect x="${X(b.x - BAR_W / 2)}" y="${Y(b.h)}" width="${BAR_W * s}" height="${b.h * s}" fill="${hue}" opacity=".85"><title>${b.m.show} ${b.m.what}</title></rect>
      <text x="${X(b.x)}" y="${Y(b.h) - 8}" text-anchor="middle" fill="${hue}" font-size="20">${b.m.short}</text>`;
  }).join('');
  const groups = groupSpans.map((g) => `<text x="${X((g.from + g.to) / 2)}" y="${Y(0) + 34}" text-anchor="middle" fill="${g.place.hue}" font-size="20">${g.place.name}</text>`).join('');
  return `<svg class="svg-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Bar chart of results by employer">${rects}${groups}
    <line x1="${X(-half - 4)}" x2="${X(half + 4)}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9FB0E0" stroke-opacity=".5"/></svg>`;
}
