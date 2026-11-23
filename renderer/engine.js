// Shorts Factory – 3D sahne motoru + 2D kompozit (altyazı, başlıklar, geçişler).
// Tarayıcıda çalışır; render.mjs her kare için window.renderFrame(t) çağırır.
import * as THREE from 'three';

// ---------------------------------------------------------------- yardımcılar
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOutBack = (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function perlin(seed) {
  const r = rng(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  };
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y;
    return lerp(lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u),
      lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v);
  };
}

const col = (c) => new THREE.Color(c);

// ---------------------------------------------------------------- global durum
let TL, R, GL_W, GL_H, OUT_W, OUT_H, out, octx, vignette, grainTiles = [];
let ACCENT = '#FFD400', ACCENT2 = '#FF3B5C', FONT = 'Montserrat';
const built = new Map();
let spriteTex;

// ---------------------------------------------------------------- ortak 3D parçalar
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function softDot() {
  if (spriteTex) return spriteTex;
  spriteTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return spriteTex;
}

function skyDome(top, bottom, horizon = 0.15) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: col(top) }, bottom: { value: col(bottom) }, hz: { value: horizon } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform float hz; varying vec3 vP; void main(){ float h = clamp(vP.y*1.5+hz,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.75)),1.0);\n#include <colorspace_fragment>\n}',
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), m);
  s.renderOrder = -1; s.frustumCulled = false;
  return s;
}

function baseScene({ top = '#3f78c9', bottom = '#dce8f4', fog = null, near = 80, far = 700, fov = 50 } = {}) {
  const scene = new THREE.Scene();
  const sky = skyDome(top, bottom); scene.add(sky);
  if (fog) scene.fog = new THREE.Fog(fog, near, far);
  const cam = new THREE.PerspectiveCamera(fov, GL_W / GL_H, 0.1, 4000);
  return { scene, cam, sky };
}

function lights(scene, { sun = '#fff2dd', sunI = 2.6, pos = [80, 120, 60], sky = '#bcd4ff', ground = '#5b4b3c', hemiI = 1.1, shadow = true, size = 60, target = [0, 0, 0] } = {}) {
  const h = new THREE.HemisphereLight(sky, ground, hemiI); scene.add(h);
  const d = new THREE.DirectionalLight(sun, sunI); d.position.set(...pos); d.target.position.set(...target);
  scene.add(d); scene.add(d.target);
  if (shadow) {
    d.castShadow = true; d.shadow.mapSize.set(1024, 1024);
    const c = d.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 1; c.far = 600;
    d.shadow.bias = -0.0008; d.shadow.normalBias = 0.04;
  }
  return { h, d };
}

// Prosedürel low-poly arazi
function terrain(o = {}) {
  const { size = 600, seg = 180, h = 100, seed = 7, scale = 0.0065, snowLine = 0.45, flat = null, corridor = null,
    rock = '#6d625a', grass = '#8a7f52', snow = '#f3f6fb', dirt = '#7a6a55', snowCover = 0 } = o;
  const n = perlin(seed), n2 = perlin(seed + 101);
  function raw(x, z) {
    let ridge = 0, a = 1, f = scale, norm = 0;
    for (let i = 0; i < 5; i++) {
      const v = n(x * f, z * f);
      ridge += a * Math.pow(1 - Math.min(1, Math.abs(v) * 1.5), 2); norm += a; a *= 0.5; f *= 2.05;
    }
    ridge /= norm;
    const base = (n2(x * scale * 0.5, z * scale * 0.5) + 0.7) / 1.4;
    return Math.pow(clamp(0.62 * ridge + 0.38 * base), 1.7) * h;
  }
  const base = o.heightFn ? (x, z) => o.heightFn(x, z, n, n2) : raw;
  const flatY = flat ? (flat.y ?? base(flat.x, flat.z)) : 0;
  function height(x, z) {
    let y = base(x, z);
    if (flat) {
      const d = Math.hypot(x - flat.x, z - flat.z);
      const k = 1 - smooth(flat.r, flat.r * 2.2, d);
      y = lerp(y, flatY + n(x * 0.08, z * 0.08) * 0.4, k);
    }
    if (corridor) {
      const k = 1 - smooth(corridor.w, corridor.w * 3.5, Math.abs(x - corridor.x));
      y = lerp(y, corridor.y ?? 0, k);
    }
    return y;
  }
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  const geo = g.toNonIndexed(); g.dispose();
  geo.computeVertexNormals();
  const p = geo.attributes.position, nrm = geo.attributes.normal;
  const colors = new Float32Array(p.count * 3);
  const r = rng(seed + 3);
  const cR = col(rock), cG = col(grass), cS = col(snow), cD = col(dirt), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const ny = (nrm.getY(i) + nrm.getY(i + 1) + nrm.getY(i + 2)) / 3;
    const hn = y / h;
    const jitter = (r() - 0.5) * 0.08;
    const sl = snowLine - snowCover * 0.6;
    if ((hn + jitter > sl && ny > 0.55) || (snowCover > 0.7 && ny > 0.45)) tmp.copy(cS).offsetHSL(0, 0, -r() * 0.05);
    else if (ny < 0.7) tmp.copy(cR).offsetHSL(0, 0, (r() - 0.5) * 0.06);
    else tmp.copy(hn < 0.15 ? cD : cG).offsetHSL(0, 0, (r() - 0.5) * 0.06);
    for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = tmp.r; colors[(i + k) * 3 + 1] = tmp.g; colors[(i + k) * 3 + 2] = tmp.b; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true;
  return { mesh, height, flatY };
}

// Deterministik kar / parçacık yağışı (kamerayı takip eden kutu)
function snowfall({ count = 3000, box = [120, 80, 120], size = 0.55, speed = [4, 9], drift = 1.5, color = '#ffffff', seed = 5, opacity = 0.95 } = {}) {
  const r = rng(seed);
  const base = new Float32Array(count * 3), spd = new Float32Array(count), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = (r() - 0.5) * box[0]; base[i * 3 + 1] = r() * box[1]; base[i * 3 + 2] = (r() - 0.5) * box[2];
    spd[i] = lerp(speed[0], speed[1], r()); ph[i] = r() * 6.28;
  }
  const geo = new THREE.BufferGeometry();
  const posA = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
  const mat = new THREE.PointsMaterial({ size, map: softDot(), transparent: true, depthWrite: false, color, opacity, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  return {
    obj: pts,
    update(t, c, wind = 0) {
      for (let i = 0; i < count; i++) {
        let y = base[i * 3 + 1] - spd[i] * t; y = ((y % box[1]) + box[1]) % box[1];
        let x = base[i * 3] + Math.sin(t * 0.9 + ph[i]) * drift + wind * t; x = ((x + box[0] / 2) % box[0] + box[0]) % box[0] - box[0] / 2;
        let z = base[i * 3 + 2] + Math.cos(t * 0.7 + ph[i]) * drift;
        posA[i * 3] = c.x + x; posA[i * 3 + 1] = c.y - box[1] / 2 + y; posA[i * 3 + 2] = c.z + z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function marker(color = ACCENT) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 24), mat); cone.rotation.x = Math.PI; cone.position.y = 2.6;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(2.1, 24, 16), mat); ball.position.y = 5.6;
  const ringM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 48), ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3;
  const light = new THREE.PointLight(color, 60, 60, 2); light.position.y = 6;
  g.add(cone, ball, ring, light);
  return {
    obj: g, top: new THREE.Vector3(0, 9, 0),
    update(t, appear = 1) {
      const s = easeOutBack(appear); g.scale.setScalar(Math.max(0.0001, s));
      cone.position.y = 2.6 + Math.sin(t * 3) * 0.4; ball.position.y = cone.position.y + 3;
      const k = (t * 0.8) % 1; ring.scale.setScalar(1 + k * 4); ringM.opacity = 0.8 * (1 - k);
    },
  };
}

function turkishFlag() {
  const G = 200;
  const tex = canvasTex(300, 200, (g) => {
    g.fillStyle = '#E30A17'; g.fillRect(0, 0, 300, 200);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0.5 * G, 0.5 * G, 0.25 * G, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#E30A17'; g.beginPath(); g.arc(0.5625 * G, 0.5 * G, 0.2 * G, 0, Math.PI * 2); g.fill();
    const cx = 1.2208 * G - 0.125 * G * 0.2, cy = 0.5 * G, R0 = 0.125 * G, r0 = R0 * 0.382;
    g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + (i * Math.PI) / 5; const rr = i % 2 ? r0 : R0;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  });
  const geo = new THREE.PlaneGeometry(4.5, 3, 24, 12);
  const orig = geo.attributes.position.array.slice();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  m.castShadow = true;
  return {
    obj: m,
    update(t) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        const x = orig[i] + 2.25; const k = x / 4.5;
        a[i + 2] = Math.sin(x * 1.6 - t * 6) * 0.35 * k + Math.sin(x * 3.1 - t * 9 + orig[i + 1]) * 0.08 * k;
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    },
  };
}

function person({ coat = '#2d6cdf', skin = '#e8b896', hair = '#2b1d14', scale = 1, bag = null } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 14), new THREE.MeshStandardMaterial({ color: coat, roughness: 0.8 }));
  body.position.y = 0.95; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 14), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }));
  head.position.y = 1.98; head.castShadow = true;
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 }));
  hr.position.y = 2.02; hr.rotation.x = -0.25;
  g.add(body, head, hr);
  if (bag) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.25), new THREE.MeshStandardMaterial({ color: bag, roughness: 0.7 }));
    b.position.set(0, 1.1, -0.42); g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

function rocks(scene, ter, n, seed, area, avoid = 0) {
  const r = rng(seed);
  const m = new THREE.MeshStandardMaterial({ color: '#7d746c', flatShading: true, roughness: 1 });
  const geo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * area, z = (r() - 0.5) * area;
    if (Math.hypot(x, z) < avoid) continue;
    const s = 0.4 + r() * 1.6;
    const mesh = new THREE.Mesh(geo, m); mesh.scale.set(s, s * 0.7, s * (0.8 + r() * 0.5));
    mesh.position.set(x, ter.height(x, z) + s * 0.2, z); mesh.rotation.set(r() * 3, r() * 3, r() * 3);
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
}

function signTex(text, w = 1024, h = 160, bg = '#1e4fa3', fg = '#ffffff') {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = h * 0.5; g.font = `900 ${fs}px ${FONT}`;
    while (g.measureText(text).width > w * 0.88 && fs > 10) { fs -= 2; g.font = `900 ${fs}px ${FONT}`; }
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function schoolBuilding({ sign = 'İLKOKULU', wall = '#efe3c8', roof = '#b8382c' } = {}) {
  const g = new THREE.Group();
  const wallM = new THREE.MeshStandardMaterial({ color: wall, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(16, 5.5, 8), wallM); body.position.y = 2.75; body.castShadow = body.receiveShadow = true; g.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.8, 8.4), new THREE.MeshStandardMaterial({ color: '#8d8a86', roughness: 1 })); base.position.y = 0.4; g.add(base);
  const shape = new THREE.Shape(); shape.moveTo(-8.8, 0); shape.lineTo(8.8, 0); shape.lineTo(0, 3.6); shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 9.2, bevelEnabled: false }); roofGeo.translate(0, 0, -4.6);
  const roofM = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: roof, roughness: 0.7, flatShading: true }));
  roofM.position.y = 5.5; roofM.castShadow = true; g.add(roofM);
  // çatıda kar
  const snowGeo = new THREE.ExtrudeGeometry(shape, { depth: 9.3, bevelEnabled: false }); snowGeo.translate(0, 0, -4.65);
  const snowM = new THREE.Mesh(snowGeo, new THREE.MeshStandardMaterial({ color: '#f6f8fc', roughness: 0.9, flatShading: true }));
  snowM.scale.set(0.97, 0.45, 1); snowM.position.y = 5.5 + 3.6 * 0.6; g.add(snowM);
  const winM = new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffb648', emissiveIntensity: 1.4, roughness: 0.3 });
  const frameM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  for (const x of [-6, -3.2, 3.2, 6]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 0.2), frameM); f.position.set(x, 3, 4.02); g.add(f);
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.9, 0.22), winM); w.position.set(x, 3, 4.05); g.add(w);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.4, 0.25), new THREE.MeshStandardMaterial({ color: '#6b3f22', roughness: 0.8 }));
  door.position.set(0, 2.1, 4.05); g.add(door);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), new THREE.MeshStandardMaterial({ map: signTex(sign), roughness: 0.6 }));
  sg.position.set(0, 4.75, 4.16); g.add(sg);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 1), new THREE.MeshStandardMaterial({ color: '#8a5240', roughness: 1 }));
  chim.position.set(4.5, 7.8, -1.5); chim.castShadow = true; g.add(chim);
  return { obj: g, chimneyTop: new THREE.Vector3(4.5, 9.2, -1.5) };
}

function smoke({ count = 90, seed = 3 } = {}) {
  const r = rng(seed);
  const geo = new THREE.BufferGeometry(); const posA = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
  const ph = Array.from({ length: count }, () => r()); const off = Array.from({ length: count }, () => [r() - 0.5, r() - 0.5]);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.6, map: softDot(), color: '#c9cfd6', transparent: true, opacity: 0.35, depthWrite: false }));
  pts.frustumCulled = false;
  return {
    obj: pts,
    update(t, origin) {
      for (let i = 0; i < count; i++) {
        const k = (t * 0.25 + ph[i]) % 1;
        posA[i * 3] = origin.x + off[i][0] * (0.5 + k * 3) + k * 4; posA[i * 3 + 1] = origin.y + k * 12; posA[i * 3 + 2] = origin.z + off[i][1] * (0.5 + k * 3);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- SAHNE ŞABLONLARI
// Her şablon: (params, dur) => { scene, cam, sky?, update(lt), labels?: [{pos, text, sub}] }
const T = {};

// 1) Dağlar: uçuş veya işaretçi etrafında yörünge
T.mountains = (p, dur) => {
  const dusk = p.time === 'dusk';
  const pal = dusk ? { top: '#24305e', bottom: '#f0a37c', fog: '#d49a86' } : { top: '#3a73c4', bottom: '#dfe9f3', fog: '#d3dfec' };
  const B = baseScene({ ...pal, near: 120, far: 760 });
  const ter = terrain({ seed: p.seed ?? 11, h: p.height ?? 120, snowLine: p.snowLine ?? (p.winter === false ? 0.6 : 0.3), snowCover: p.snowCover ?? 0.35, flat: { x: 0, z: 0, r: 22 } });
  B.scene.add(ter.mesh);
  lights(B.scene, { sun: dusk ? '#ffc49a' : '#fff2dd', pos: [120, 140, 80], size: 160 });
  let pin = null;
  if (p.pin) { pin = marker(p.pin.color || ACCENT); pin.obj.position.set(0, ter.flatY, 0); B.scene.add(pin.obj); }
  const snow = p.snowfall ? snowfall({ count: 2500, box: [160, 90, 160], size: 0.9, seed: 9 }) : null;
  if (snow) B.scene.add(snow.obj);
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = lt / dur;
    if (pin || p.camera === 'orbit') {
      const ang = (p.angle ?? 0.7) + lt * 0.11;
      const r = lerp(p.r0 ?? 170, p.r1 ?? 75, easeInOut(k));
      B.cam.position.set(Math.sin(ang) * r, ter.flatY + lerp(90, 32, easeInOut(k)), Math.cos(ang) * r);
      B.cam.lookAt(0, ter.flatY + (p.lookUp ?? 20), 0);
    } else {
      const z = 240 - lt * 28, x = Math.sin(lt * 0.25) * 25;
      let gy = 0; for (let d = 0; d <= 90; d += 15) gy = Math.max(gy, ter.height(x, z - d));
      B.cam.position.set(x, gy + 28, z);
      B.cam.lookAt(x * 0.6, gy - 5, z - 110);
    }
    if (pin) {
      pin.update(lt, clamp((lt - 0.3) / 0.6));
      S.labels = p.pin.label ? [{ pos: pin.obj.position.clone().add(new THREE.Vector3(0, 11, 0)), text: p.pin.label, sub: p.pin.sub, alpha: clamp((lt - 0.7) / 0.4) }] : [];
    }
    if (snow) snow.update(lt, B.cam.position);
  };
  return S;
};

// 2) Okul binası, bayrak, baca dumanı, kar
T.school = (p, dur) => {
  const night = p.time === 'night';
  const B = baseScene(night ? { top: '#0b1430', bottom: '#2c3f6b', fog: '#26365c', near: 60, far: 420 } : { top: '#5d86bf', bottom: '#e6edf5', fog: '#dde6ef', near: 60, far: 460 });
  const ter = terrain({ seed: p.seed ?? 21, size: 500, seg: 160, h: 70, scale: 0.008, snowLine: 0.1, snowCover: p.snowCover ?? 0.85, flat: { x: 0, z: 0, r: 26 } });
  B.scene.add(ter.mesh);
  lights(B.scene, night ? { sun: '#9fb6ff', sunI: 0.6, hemiI: 0.5, pos: [-40, 80, 50], size: 40, target: [0, ter.flatY, 0] } : { pos: [50, 70, 45], size: 40, target: [0, ter.flatY, 0] });
  const sch = schoolBuilding({ sign: p.sign || 'İLKOKULU' });
  sch.obj.position.y = ter.flatY; B.scene.add(sch.obj);
  if (night) { const l = new THREE.PointLight('#ffb648', 80, 40, 2); l.position.set(0, ter.flatY + 3, 8); B.scene.add(l); }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 12, 10), new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 0.6, roughness: 0.3 }));
  pole.position.set(-11, ter.flatY + 6, 6); pole.castShadow = true; B.scene.add(pole);
  const flag = turkishFlag(); flag.obj.position.set(-11 + 2.25, ter.flatY + 10.3, 6); B.scene.add(flag.obj);
  const sm = smoke(); B.scene.add(sm.obj);
  const snow = snowfall({ count: 3000, box: [90, 50, 90], size: 0.35, speed: [2, 5], seed: 4 }); B.scene.add(snow.obj);
  rocks(B.scene, ter, 50, 8, 120, 24);
  const kids = (p.students ?? 0);
  const kidObjs = [];
  for (let i = 0; i < kids; i++) {
    const k = person({ coat: ['#e0433c', '#2f7de1', '#2fb36b', '#f0a030'][i % 4], scale: 0.75, bag: '#333' });
    k.position.set(-3 + i * 2.2, ter.flatY, 9 + i); k.rotation.y = Math.PI; B.scene.add(k); kidObjs.push(k);
  }
  const S = { ...B, labels: [] };
  const wp = sch.chimneyTop.clone(); wp.y += ter.flatY;
  S.update = (lt) => {
    const k = easeInOut(lt / dur);
    const ang = (p.angle ?? -0.5) + lt * (p.orbit ?? 0.09);
    const r = lerp(p.r0 ?? 46, p.r1 ?? 30, k);
    B.cam.position.set(Math.sin(ang) * r, ter.flatY + lerp(14, 7, k), Math.cos(ang) * r);
    B.cam.lookAt(0, ter.flatY + 4, 0);
    flag.update(lt); sm.update(lt, wp); snow.update(lt, B.cam.position);
    kidObjs.forEach((o, i) => { o.position.z = 9 + i - lt * 0.9; o.position.y = ter.flatY + Math.abs(Math.sin(lt * 7 + i)) * 0.1; });
    if (p.label) S.labels = [{ pos: new THREE.Vector3(0, ter.flatY + 13, 0), text: p.label, sub: p.sub, alpha: clamp((lt - 0.5) / 0.4) }];
  };
  return S;
};

// 3) Kıyas sütunları (3D bar chart)
T.bars = (p, dur) => {
  const B = baseScene({ top: '#0c1022', bottom: '#1d2a52', fov: 40 });
  const items = p.items || [];
  const max = Math.max(...items.map((i) => i.value)) || 1;
  const H = 18, bw = items.length > 4 ? 2.4 : 3.0, gap = items.length > 4 ? 1.2 : 1.8;
  const totalW = items.length * bw + (items.length - 1) * gap;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#141a33', roughness: 0.35, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; B.scene.add(floor);
  const grid = new THREE.GridHelper(200, 100, '#2c3a70', '#1f2a55'); grid.position.y = 0.01; B.scene.add(grid);
  lights(B.scene, { sky: '#8fa8ff', ground: '#151a30', hemiI: 0.9, pos: [20, 40, 30], size: 30 });
  const rim = new THREE.DirectionalLight('#6aa7ff', 1.2); rim.position.set(-30, 20, -30); B.scene.add(rim);
  const palette = ['#4f7cff', '#21c1d6', '#9b6bff', '#2fd37c', '#ff8a3d'];
  const bars = items.map((it, i) => {
    const color = it.highlight ? ACCENT : (it.color || palette[i % palette.length]);
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15, emissive: color, emissiveIntensity: it.highlight ? 0.35 : 0.08 });
    const geo = new THREE.BoxGeometry(bw, 1, bw); geo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true;
    mesh.position.x = -totalW / 2 + bw / 2 + i * (bw + gap);
    B.scene.add(mesh);
    if (it.highlight) { const l = new THREE.PointLight(ACCENT, 120, 30, 2); l.position.set(mesh.position.x, 4, 4); B.scene.add(l); }
    return { mesh, it, h: Math.max(0.15, (it.value / max) * H) };
  });
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(B.cam.fov / 2)) * B.cam.aspect);
  const dist = Math.max((totalW / 2 + 2.6) / Math.tan(hfov / 2), 30);
  const stagger = p.stagger ?? Math.min(0.9, (dur - 1.5) / Math.max(1, items.length));
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(lt / dur);
    B.cam.position.set(Math.sin(lt * 0.08) * 3, H * 0.62, dist * lerp(1.08, 0.98, k));
    B.cam.lookAt(0, H * 0.5, 0);
    S.labels = [];
    bars.forEach((b, i) => {
      const g = easeOutCubic((lt - 0.25 - i * stagger) / 0.9);
      b.mesh.scale.y = Math.max(0.001, b.h * g);
      const v = b.it.value * g;
      const x = b.mesh.position.x;
      const fmt = (b.it.prefix || '') + Math.round(v).toLocaleString('tr-TR') + (b.it.unit ?? p.unit ?? '');
      S.labels.push({ pos: new THREE.Vector3(x, b.h * g + 1.2, 0), text: fmt, kind: 'value', hl: !!b.it.highlight, alpha: clamp(g * 3) });
      S.labels.push({ pos: new THREE.Vector3(x, -1.0, bw / 2), text: b.it.label, kind: 'name', hl: !!b.it.highlight, alpha: clamp((lt - i * stagger) / 0.3) });
    });
  };
  return S;
};

// 4) Sınıf içi: sıralar, öğrenciler, öğretmen, soba, kara tahta
T.classroom = (p, dur) => {
  const B = baseScene({ top: '#e9dcc4', bottom: '#e9dcc4', fov: 55 });
  const scene = B.scene;
  scene.add(new THREE.HemisphereLight('#fff1dc', '#5a4230', 1.1));
  const key = new THREE.DirectionalLight('#dfeaff', 1.6); key.position.set(-12, 9, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); scene.add(key);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.4, 18), new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (g) => {
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#8a5a3b' : '#93623f'; g.fillRect(0, i * 32, 512, 32); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, i * 32, 512, 2); }
  }), roughness: 0.8 }));
  floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ color: '#cfdcc9', roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 0.4), wallM); back.position.set(0, 4.5, -9); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 18), wallM); left.position.set(-11, 4.5, 0); left.receiveShadow = true; scene.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 18), wallM); right.position.set(11, 4.5, 0); scene.add(right);
  // pencere (dışarıda kar)
  const winTex = canvasTex(256, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#cfe0f5'); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const r = rng(2); g.fillStyle = '#fff'; for (let i = 0; i < 120; i++) { g.beginPath(); g.arc(r() * 256, r() * 256, 1 + r() * 2.5, 0, 7); g.fill(); }
    g.fillStyle = '#e8eef6'; g.beginPath(); g.moveTo(0, 200); g.lineTo(80, 150); g.lineTo(160, 185); g.lineTo(256, 140); g.lineTo(256, 256); g.lineTo(0, 256); g.fill();
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ map: winTex })); win.position.set(-10.78, 5, -1); win.rotation.y = Math.PI / 2; scene.add(win);
  const wf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.25), new THREE.MeshStandardMaterial({ color: '#fff' })); wf.position.set(-10.7, 5, -1); scene.add(wf);
  // kara tahta
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6), new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(1024, 410, (g, w, h) => {
    g.fillStyle = '#1f3b2c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7a5532'; g.lineWidth = 22; g.strokeRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = String(p.board || '').split('\n');
    lines.forEach((ln, i) => { g.font = `800 ${i === 0 ? 120 : 64}px ${FONT}`; g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 120); });
  }) }));
  board.position.set(0, 5, -8.78); scene.add(board);
  const flagMini = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), new THREE.MeshStandardMaterial({ map: turkishFlag().obj.material.map }));
  flagMini.position.set(6.5, 6.6, -8.78); scene.add(flagMini);
  // soba
  const stoveM = new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.4 });
  const stove = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 20), stoveM); stove.position.set(8, 1.1, -5); stove.castShadow = true; scene.add(stove);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6, 12), stoveM); pipe.position.set(8, 5, -5); scene.add(pipe);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 3 }));
  glow.position.set(8, 1.0, -4.1); scene.add(glow);
  const fire = new THREE.PointLight('#ff8a3a', 40, 18, 2); fire.position.set(8, 1.5, -3.5); scene.add(fire);
  // sıralar + öğrenciler
  const n = p.students ?? 2;
  const deskM = new THREE.MeshStandardMaterial({ color: '#b07a4a', roughness: 0.7 });
  const coats = ['#e0433c', '#2f7de1', '#2fb36b', '#f0a030'];
  const studs = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 4.2;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1.6), deskM); desk.position.set(x, 1.6, -1.5); desk.castShadow = true; scene.add(desk);
    for (const dx of [-1.3, 1.3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.4), deskM); leg.position.set(x + dx, 0.8, -1.5); scene.add(leg); }
    const book = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: '#f4f4f4' })); book.position.set(x, 1.75, -1.6); scene.add(book);
    const s = person({ coat: coats[i % 4], scale: 0.85 }); s.position.set(x, 0, -0.3); s.rotation.y = Math.PI; scene.add(s); studs.push(s);
  }
  const teacher = person({ coat: '#3d3f55', scale: 1.05, hair: '#4a3020' }); teacher.position.set(-4.5, 0, -7.4); scene.add(teacher);
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(lt / dur);
    B.cam.position.set(lerp(5, -2, k), lerp(8.2, 7.0, k), lerp(13.5, 10.5, k));
    B.cam.lookAt(0, 2.6, -4.5);
    studs.forEach((s, i) => { s.rotation.z = Math.sin(lt * 2 + i * 2) * 0.03; });
    teacher.rotation.y = Math.sin(lt * 0.8) * 0.4; teacher.position.x = -4.5 + Math.sin(lt * 0.5) * 0.8;
    fire.intensity = 35 + Math.sin(lt * 23) * 5 + Math.sin(lt * 7.7) * 6;
  };
  return S;
};

// 5) Termometre (sıcaklık düşüşü), buz kristalleri
T.thermometer = (p, dur) => {
  const B = baseScene({ top: '#06132b', bottom: '#2b5d9a', fov: 42 });
  const scene = B.scene;
  scene.add(new THREE.HemisphereLight('#bfe0ff', '#0a1530', 1.0));
  const kl = new THREE.DirectionalLight('#e6f3ff', 2.2); kl.position.set(10, 20, 15); scene.add(kl);
  const rl = new THREE.PointLight('#6fc8ff', 80, 50, 2); rl.position.set(-8, 6, 6); scene.add(rl);
  const minT = p.min ?? -40, maxT = p.max ?? 30, L = 16;
  const yOf = (tc) => ((tc - minT) / (maxT - minT)) * L;
  const g = new THREE.Group(); scene.add(g);
  const glass = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, L, 8, 24), new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 }));
  glass.position.y = L / 2; g.add(glass);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.7, 32, 20), new THREE.MeshStandardMaterial({ color: '#ff2f3f', emissive: '#c2001a', emissiveIntensity: 0.6, roughness: 0.25 }));
  bulb.position.y = -1.2; g.add(bulb);
  const liqGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 20); liqGeo.translate(0, 0.5, 0);
  const liq = new THREE.Mesh(liqGeo, bulb.material); liq.position.y = -0.4; g.add(liq);
  const tickM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#88aacc', emissiveIntensity: 0.4 });
  const ticks = [];
  for (let tc = Math.ceil(minT / 10) * 10; tc <= maxT; tc += 10) {
    const tk = new THREE.Mesh(new THREE.BoxGeometry(tc === 0 ? 1.6 : 1.1, 0.12, 0.12), tickM); tk.position.set(1.6, yOf(tc), 0); g.add(tk);
    ticks.push(tc);
  }
  // buz kristalleri
  const r = rng(12); const ice = [];
  const iceM = new THREE.MeshStandardMaterial({ color: '#cfefff', emissive: '#4fb4ff', emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.3, flatShading: true, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + r() * 0.7, 0), iceM);
    m.position.set((r() - 0.5) * 30, r() * 26 - 4, -8 - r() * 20); m.userData = { s: r() * 2, r: r() }; scene.add(m); ice.push(m);
  }
  const snow = snowfall({ count: 1500, box: [50, 40, 40], size: 0.25, speed: [1, 3], seed: 2 }); scene.add(snow.obj);
  const from = p.from ?? 10, to = p.to ?? -30;
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(lt / dur);
    const tc = lerp(from, to, easeInOut(clamp((lt - 0.3) / Math.max(0.8, dur * 0.7))));
    liq.scale.y = Math.max(0.05, yOf(tc) + 0.4);
    g.rotation.y = Math.sin(lt * 0.5) * 0.35;
    B.cam.position.set(Math.sin(lt * 0.2) * 4, L * 0.45, lerp(36, 30, k)); B.cam.lookAt(0, L * 0.42, 0);
    ice.forEach((m) => { m.rotation.x = lt * (0.3 + m.userData.r); m.rotation.y = lt * 0.5 + m.userData.s; m.position.y += Math.sin(lt + m.userData.s) * 0.005; });
    snow.update(lt, new THREE.Vector3(0, L / 2, 0), 0.6);
    const wp = (tcv) => { const v = new THREE.Vector3(2.6, yOf(tcv), 0); return v.applyMatrix4(g.matrixWorld); };
    g.updateMatrixWorld();
    S.labels = ticks.filter((t) => t % 20 === 0 || t === 0).map((t) => ({ pos: wp(t), text: `${t}°`, kind: 'tick', alpha: 0.9 }));
    S.temp = tc; S.live = tc;
  };
  return S;
};

// 6) Karlı yol + iş makinesi + yürüyen kişi
function loader() {
  const g = new THREE.Group();
  const yel = new THREE.MeshStandardMaterial({ color: '#f2b705', roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.8 });
  const glassM = new THREE.MeshStandardMaterial({ color: '#7fa3c9', roughness: 0.1, metalness: 0.3, emissive: '#1d3350', emissiveIntensity: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 5.2), yel); body.position.set(0, 1.9, 0); g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.2), yel); cab.position.set(0, 3.7, 0.6); g.add(cab);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.4, 2.25), glassM); gl.position.set(0, 3.9, 0.6); g.add(gl);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 0.4), dark); blade.position.set(0, 1.0, -3.6); blade.rotation.x = -0.25; g.add(blade);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 2), yel); arm.position.set(1.1, 1.6, -2.4); g.add(arm);
  const arm2 = arm.clone(); arm2.position.x = -1.1; g.add(arm2);
  const wheels = [];
  for (const [x, z] of [[-1.5, -1.6], [1.5, -1.6], [-1.5, 1.7], [1.5, 1.7]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.8, 20), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.95, z); g.add(w); wheels.push(w);
  }
  const beaconM = new THREE.MeshStandardMaterial({ color: '#ff8a00', emissive: '#ff6a00', emissiveIntensity: 2 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.35, 12), beaconM); beacon.position.set(0, 4.9, 0.6); g.add(beacon);
  const bl = new THREE.PointLight('#ff7a00', 50, 20, 2); bl.position.set(0, 5.4, 0.6); g.add(bl);
  const hl = new THREE.SpotLight('#fff6dd', 120, 50, 0.5, 0.6, 1.5); hl.position.set(0, 3.2, -1); hl.target.position.set(0, 0, -20); g.add(hl, hl.target);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { obj: g, update(t) { wheels.forEach((w) => (w.rotation.x = -t * 3)); const f = (Math.sin(t * 12) > 0) ? 1 : 0.2; beaconM.emissiveIntensity = 0.5 + f * 2.5; bl.intensity = 10 + f * 60; } };
}

T.snowroad = (p, dur) => {
  const B = baseScene({ top: '#9fb0c4', bottom: '#eef2f6', fog: '#e4e9ef', near: 25, far: 220 });
  const ter = terrain({ seed: p.seed ?? 31, size: 500, seg: 150, h: 45, scale: 0.012, snowLine: 0, snowCover: 1, corridor: { x: 0, w: 6, y: 0 } });
  B.scene.add(ter.mesh);
  lights(B.scene, { sun: '#e9eef7', sunI: 1.2, hemiI: 1.4, sky: '#dbe6f3', ground: '#8e9aa8', pos: [30, 60, 20], size: 40 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 500, 1, 200), new THREE.MeshStandardMaterial({ map: canvasTex(64, 512, (g) => {
    g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, 64, 512); const r = rng(1); g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 300; i++) g.fillRect(r() * 64, r() * 512, 2 + r() * 8, 2 + r() * 8);
  }), roughness: 0.9 }));
  road.material.map.wrapT = THREE.RepeatWrapping; road.material.map.repeat.set(1, 20);
  road.rotation.x = -Math.PI / 2; road.position.y = 0.06; road.receiveShadow = true; B.scene.add(road);
  // kar setleri
  const bankM = new THREE.MeshStandardMaterial({ color: '#f5f8fc', roughness: 1, flatShading: true });
  const r = rng(6);
  for (let z = -240; z < 240; z += 3) for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + r() * 0.8, 0), bankM); m.scale.set(1.4, 0.6, 1.6); m.position.set(s * (4.2 + r() * 0.8), 0.3, z); m.receiveShadow = true; B.scene.add(m);
  }
  // kapanmış yol kısmı (makinenin önünde kar)
  const drift = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 200), bankM); drift.position.set(0, 0.5, -130); B.scene.add(drift);
  const ld = loader(); B.scene.add(ld.obj);
  const walker = person({ coat: '#3a3f58', bag: '#7a3b2a', scale: 1 }); walker.rotation.y = Math.PI; B.scene.add(walker);
  const spray = snowfall({ count: 400, box: [6, 4, 3], size: 0.3, speed: [-3, -1], drift: 2, seed: 8 }); B.scene.add(spray.obj);
  const snow = snowfall({ count: 4500, box: [70, 40, 70], size: 0.35, speed: [5, 10], drift: 2, seed: 3 }); B.scene.add(snow.obj);
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const z = 20 - lt * 3.2;
    ld.obj.position.set(0, 0, z); ld.update(lt);
    drift.position.z = z - 3.9 - 100;
    walker.position.set(0.6, Math.abs(Math.sin(lt * 5)) * 0.08, z + 7.5); walker.rotation.z = Math.sin(lt * 5) * 0.04;
    const k = easeInOut(lt / dur);
    B.cam.position.set(lerp(24, 15, k), lerp(8, 5.5, k), z + lerp(20, 11, k));
    B.cam.lookAt(0, 1.8, z + 5);
    spray.update(lt, new THREE.Vector3(0, 2, z - 4.5)); snow.update(lt, B.cam.position, -1.5);
    if (p.label) S.labels = [{ pos: new THREE.Vector3(0.6, 3, z + 7.5), text: p.label, alpha: clamp((lt - 0.8) / 0.4) }];
  };
  return S;
};

// 7) Dünya küresi (nokta küre) + pinler + yay
T.globe = (p, dur) => {
  const B = baseScene({ top: '#02040c', bottom: '#0a1630', fov: 40 });
  const scene = B.scene;
  scene.add(new THREE.AmbientLight('#4060a0', 0.8));
  const sl = new THREE.DirectionalLight('#ffffff', 1.6); sl.position.set(-20, 15, 30); scene.add(sl);
  const R0 = 10;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R0, 64, 48), new THREE.MeshStandardMaterial({ color: '#0b1d3d', emissive: '#061630', roughness: 0.6, metalness: 0.2 }));
  scene.add(sphere);
  const N = 9000, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.399963;
    pos[i * 3] = Math.cos(th) * rr * R0 * 1.004; pos[i * 3 + 1] = y * R0 * 1.004; pos[i * 3 + 2] = Math.sin(th) * rr * R0 * 1.004;
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: '#3fa9ff', size: 0.09, transparent: true, opacity: 0.55 })));
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R0 * 1.15, 48, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vN; void main(){ float i = pow(0.75 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.25,0.6,1.0,1.0)*i; }',
  }));
  scene.add(atm);
  // yıldızlar
  const st = new Float32Array(1500 * 3); const r = rng(77);
  for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(600 + r() * 300); st.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(st, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.5, sizeAttenuation: false })));
  const ll = (lat, lon, rad = R0) => {
    const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180);
    return new THREE.Vector3(-rad * Math.sin(phi) * Math.cos(th), rad * Math.cos(phi), rad * Math.sin(phi) * Math.sin(th));
  };
  const pins = (p.pins || []).map((pn, i) => {
    const c = pn.color || (i === 0 ? ACCENT : ACCENT2);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: c }));
    const v = ll(pn.lat, pn.lon); m.position.copy(v); scene.add(m);
    const ringM = new THREE.MeshBasicMaterial({ color: c, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), ringM); ring.position.copy(v.clone().multiplyScalar(1.002)); ring.lookAt(v.clone().multiplyScalar(2)); scene.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8 }));
    beam.position.copy(v.clone().normalize().multiplyScalar(R0 + 1.1)); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); scene.add(beam);
    return { pn, v, ring, ringM, m, beam };
  });
  let arc = null;
  if (pins.length >= 2) {
    const a = pins[0].v.clone().normalize(), b = pins[1].v.clone().normalize();
    const pts = [];
    for (let i = 0; i <= 64; i++) { const u = i / 64; const v = a.clone().lerp(b, u).normalize().multiplyScalar(R0 * (1 + 0.25 * Math.sin(Math.PI * u))); pts.push(v); }
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 128, 0.07, 8, false);
    arc = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: ACCENT })); scene.add(arc);
  }
  const dirA = pins[0] ? pins[0].v.clone().normalize() : new THREE.Vector3(0, 0.5, 1).normalize();
  const dirB = pins[1] ? pins[0].v.clone().add(pins[1].v).normalize() : dirA;
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(clamp(lt / (dur * 0.85)));
    const d = dirA.clone().lerp(dirB, k).normalize();
    const dist = lerp(p.zoomFrom ?? 46, p.zoomTo ?? (pins.length > 1 ? 34 : 26), easeInOut(clamp(lt / dur)));
    const sideways = new THREE.Vector3(0, 1, 0).cross(d).normalize().multiplyScalar(Math.sin(lt * 0.3) * 2);
    B.cam.position.copy(d.clone().multiplyScalar(dist).add(sideways)); B.cam.up.set(0, 1, 0); B.cam.lookAt(0, 0, 0);
    B.cam.position.y += 3;
    B.cam.lookAt(d.clone().multiplyScalar(R0 * 0.3));
    pins.forEach((pp, i) => {
      const kk = ((lt * 0.9) + i * 0.5) % 1; pp.ring.scale.setScalar(1 + kk * 3); pp.ringM.opacity = 1 - kk;
      const app = clamp((lt - 0.2 - i * 0.6) / 0.4); pp.m.scale.setScalar(app + 0.001); pp.beam.scale.y = app + 0.001;
    });
    if (arc) { const total = arc.geometry.index.count; const a = easeInOut(clamp((lt - 0.9) / 1.6)); arc.geometry.setDrawRange(0, Math.floor(total * a / 6) * 6); }
    S.labels = pins.map((pp, i) => ({ pos: pp.v.clone().normalize().multiplyScalar(R0 + 2.6), text: pp.pn.label, sub: pp.pn.sub, alpha: clamp((lt - 0.4 - i * 0.6) / 0.4) }));
  };
  return S;
};

// 8) 3D soru işareti (kanca + kapanış)
T.question = (p, dur) => {
  const B = baseScene({ top: '#0b0f1f', bottom: '#2a1c4f', fov: 40 });
  const scene = B.scene;
  scene.add(new THREE.HemisphereLight('#c8b8ff', '#1a1030', 0.8));
  const key = new THREE.DirectionalLight('#ffffff', 2.5); key.position.set(8, 10, 12); scene.add(key);
  const rimA = new THREE.PointLight(ACCENT2, 200, 40, 2); rimA.position.set(-8, 4, -4); scene.add(rimA);
  const rimB = new THREE.PointLight('#4fb4ff', 200, 40, 2); rimB.position.set(8, -2, -4); scene.add(rimB);
  const pts = [];
  for (let i = 0; i <= 40; i++) { const a = THREE.MathUtils.degToRad(165 - i * 5.6); pts.push(new THREE.Vector3(Math.cos(a) * 2.4, 3.2 + Math.sin(a) * 2.4, 0)); }
  pts.push(new THREE.Vector3(0.45, 0.5, 0), new THREE.Vector3(0.05, -0.3, 0), new THREE.Vector3(0, -0.9, 0));
  const curve = new THREE.CatmullRomCurve3(pts);
  const mat = new THREE.MeshPhysicalMaterial({ color: p.color || ACCENT, roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, emissive: p.color || ACCENT, emissiveIntensity: 0.12 });
  const q = new THREE.Group();
  q.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.62, 24, false), mat));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), mat); cap.position.copy(pts[0]); q.add(cap);
  const cap2 = cap.clone(); cap2.position.copy(pts[pts.length - 1]); q.add(cap2);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.78, 32, 20), mat); dot.position.y = -2.6; q.add(dot);
  q.position.y = -0.5; scene.add(q);
  const r = rng(4); const bokeh = [];
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08 + r() * 0.25, 12, 8), new THREE.MeshBasicMaterial({ color: [ACCENT, ACCENT2, '#4fb4ff', '#ffffff'][i % 4], transparent: true, opacity: 0.5 + r() * 0.5 }));
    m.position.set((r() - 0.5) * 26, (r() - 0.5) * 40, -4 - r() * 18); m.userData.s = r() * 6; scene.add(m); bokeh.push(m);
  }
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const s = easeOutBack(clamp(lt / 0.6)); q.scale.setScalar(Math.max(0.001, s));
    q.rotation.y = lt * 1.1 + (p.spin ?? 0);
    q.position.y = -0.5 + Math.sin(lt * 2) * 0.25;
    B.cam.position.set(0, 0.5, lerp(22, 17, easeInOut(lt / dur))); B.cam.lookAt(0, 0.3, 0);
    bokeh.forEach((m) => { m.position.y += 0.01; m.position.x += Math.sin(lt + m.userData.s) * 0.004; });
  };
  return S;
};

// ---------------------------------------------------------------- 2D katman
function setFont(px, weight = 900) { octx.font = `${weight} ${px}px ${FONT}`; }

function outlinedText(txt, x, y, { size = 80, fill = '#fff', stroke = '#000', sw = 0.16, align = 'center', shadow = true, weight = 900 } = {}) {
  setFont(size, weight); octx.textAlign = align; octx.textBaseline = 'middle';
  octx.lineJoin = 'round'; octx.miterLimit = 2;
  if (shadow) { octx.save(); octx.fillStyle = 'rgba(0,0,0,0.45)'; octx.strokeStyle = 'rgba(0,0,0,0.45)'; octx.lineWidth = size * sw; octx.strokeText(txt, x + size * 0.04, y + size * 0.07); octx.restore(); }
  octx.strokeStyle = stroke; octx.lineWidth = size * sw; octx.strokeText(txt, x, y);
  octx.fillStyle = fill; octx.fillText(txt, x, y);
}

function fitSize(txt, size, maxW, weight = 900) {
  setFont(size, weight);
  const w = octx.measureText(txt).width;
  return w > maxW ? size * (maxW / w) : size;
}

function roundRect(x, y, w, h, r) {
  octx.beginPath(); octx.moveTo(x + r, y); octx.arcTo(x + w, y, x + w, y + h, r); octx.arcTo(x + w, y + h, x, y + h, r);
  octx.arcTo(x, y + h, x, y, r); octx.arcTo(x, y, x + w, y, r); octx.closePath();
}

function pill(txt, cx, cy, { size = 44, bg = ACCENT, fg = '#111', alpha = 1 } = {}) {
  setFont(size, 900); const w = octx.measureText(txt).width + size * 1.1, h = size * 1.6;
  octx.save(); octx.globalAlpha *= alpha;
  octx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(cx - w / 2 + 5, cy - h / 2 + 7, w, h, h / 2); octx.fill();
  octx.fillStyle = bg; roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); octx.fill();
  octx.fillStyle = fg; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(txt, cx, cy + size * 0.04);
  octx.restore();
}

const up = (s) => (/\d/.test(String(s)) ? String(s) : String(s).toLocaleUpperCase('tr-TR'));

function drawLabels(S) {
  if (!S.labels || !S.labels.length) return;
  for (const L of S.labels) {
    if (!L.text || L.alpha <= 0) continue;
    const v = L.pos.clone().project(S.cam);
    if (v.z > 1) continue;
    const x = (v.x + 1) / 2 * OUT_W, y = (1 - v.y) / 2 * OUT_H;
    octx.save(); octx.globalAlpha = clamp(L.alpha);
    if (L.kind === 'value') outlinedText(up(L.text), x, y - 30, { size: fitSize(up(L.text), 64, 300), fill: L.hl ? ACCENT : '#fff' });
    else if (L.kind === 'name') {
      const lines = String(L.text).split('\n');
      lines.forEach((ln, i) => outlinedText(up(ln), x, y + 34 + i * 48, { size: fitSize(up(ln), 42, 260), fill: L.hl ? ACCENT : '#e8ecff' }));
    } else if (L.kind === 'tick') outlinedText(L.text, x + 40, y, { size: 44, fill: '#dff3ff', align: 'left' });
    else {
      pill(up(L.text), x, y, { size: 46 });
      if (L.sub) outlinedText(up(L.sub), x, y + 70, { size: 38 });
    }
    octx.restore();
  }
}

function fmtCount(c, v) {
  const d = c.decimals ?? 0;
  const n = d ? v : Math.round(v);
  let s;
  if (c.era) s = n < 0 ? `MÖ ${Math.abs(n)}` : String(n);
  else s = (c.sign && n > 0 ? '+' : '') + n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return (c.prefix || '') + s + (c.suffix || '');
}

function drawBig(sc, lt, S) {
  const o = sc.overlay; if (!o) return;
  const at = o.at ?? 0.25;
  const a = lt - at; if (a < 0) return;
  let txt = o.big || '';
  if (o.count) {
    const k = easeOutCubic(clamp(a / (o.count.dur ?? 1.4)));
    txt = fmtCount(o.count, lerp(o.count.from ?? 0, o.count.to, k));
  }
  if (o.temp && S.temp !== undefined) txt = fmtCount({ suffix: '°C' }, S.temp);
  if (o.live && S.live !== undefined) txt = fmtCount(o.live, S.live);
  const y = OUT_H * (o.y ?? 0.2);
  const s = easeOutBack(clamp(a / 0.35));
  octx.save(); octx.translate(OUT_W / 2, y); octx.scale(s, s);
  if (txt) {
    const size = fitSize(up(txt), o.size ?? 170, OUT_W * 0.9);
    outlinedText(up(txt), 0, 0, { size, fill: o.color || ACCENT, sw: 0.14 });
  }
  if (o.sub) pill(up(o.sub), 0, (o.big || o.count || o.temp || o.live) ? (o.size ?? 170) * 0.78 : 0, { size: 46, bg: '#ffffff', fg: '#111' });
  octx.restore();
}

function drawTitle(t) {
  const ti = TL.title; if (!ti) return;
  const end = TL.scenes[0].end;
  if (t > end) return;
  const a = clamp((end - t) / 0.25) * clamp(t / 0.2);
  const lines = ti.split('\n');
  octx.save(); octx.globalAlpha = a;
  lines.forEach((ln, i) => {
    const s = easeOutBack(clamp((t - i * 0.12) / 0.35));
    octx.save(); octx.translate(OUT_W / 2, OUT_H * 0.14 + i * 118); octx.scale(s, s);
    const txt = up(ln);
    outlinedText(txt, 0, 0, { size: fitSize(txt, 104, OUT_W * 0.9), fill: i % 2 ? ACCENT : '#ffffff', sw: 0.17 });
    octx.restore();
  });
  octx.restore();
}

function drawCaptions(t) {
  const caps = TL.captions; if (!caps) return;
  let c = null;
  for (const x of caps) if (t >= x.s && t < x.e) { c = x; break; }
  if (!c) return;
  const words = c.words.map((w) => ({ ...w, u: up(w.t) }));
  const base = TL.captionSize ?? 86;
  setFont(base);
  const space = octx.measureText(' ').width;
  let widths = words.map((w) => octx.measureText(w.u).width);
  let total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  const maxW = OUT_W * 0.86;
  let lines = [words.map((_, i) => i)];
  let size = base;
  if (total > maxW && words.length > 1) {
    let best = 1, bestDiff = 1e9;
    for (let i = 1; i < words.length; i++) {
      const l1 = widths.slice(0, i).reduce((a, b) => a + b, 0) + space * (i - 1);
      const l2 = widths.slice(i).reduce((a, b) => a + b, 0) + space * (words.length - i - 1);
      const d = Math.max(l1, l2); if (d < bestDiff) { bestDiff = d; best = i; }
    }
    lines = [words.slice(0, best).map((_, i) => i), words.slice(best).map((_, i) => i + best)];
    if (bestDiff > maxW) size = base * maxW / bestDiff;
  } else if (total > maxW) size = base * maxW / total;
  const pop = easeOutBack(clamp((t - c.s) / 0.14));
  const cy = OUT_H * (TL.captionY ?? 0.7);
  octx.save(); octx.translate(OUT_W / 2, cy); octx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop); octx.translate(-OUT_W / 2, -cy);
  setFont(size);
  const sp = octx.measureText(' ').width;
  lines.forEach((ln, li) => {
    const ws = ln.map((i) => octx.measureText(words[i].u).width);
    const lw = ws.reduce((a, b) => a + b, 0) + sp * (ln.length - 1);
    let x = OUT_W / 2 - lw / 2;
    const y = cy + (li - (lines.length - 1) / 2) * size * 1.18;
    ln.forEach((i, j) => {
      const w = words[i]; const ww = ws[j];
      const active = t >= w.s && (i === words.length - 1 || t < words[i + 1].s);
      const spoken = t >= w.s;
      const cx = x + ww / 2;
      let sc = 1;
      if (active) sc = 1 + 0.16 * Math.exp(-(t - w.s) * 9);
      octx.save(); octx.translate(cx, y); octx.scale(sc, sc);
      if (w.emph && spoken) {
        octx.fillStyle = ACCENT2; octx.save(); octx.rotate(-0.03);
        roundRect(-ww / 2 - size * 0.16, -size * 0.62, ww + size * 0.32, size * 1.2, size * 0.18); octx.fill(); octx.restore();
      }
      outlinedText(w.u, 0, 0, { size, fill: w.emph && spoken ? '#ffffff' : (active ? ACCENT : '#ffffff'), sw: 0.18 });
      octx.restore();
      x += ww + sp;
    });
  });
  octx.restore();
}

function shakeAt(t) {
  let sx = 0, sy = 0;
  for (const e of TL.events || []) {
    if (e.type !== 'impact') continue;
    const d = t - e.t; if (d < 0 || d > 0.6) continue;
    const a = (e.shake ?? 16) * Math.exp(-d * 9);
    sx += Math.sin(d * 90 + e.t) * a; sy += Math.cos(d * 70 + e.t * 2) * a;
  }
  return [sx, sy];
}

// ---------------------------------------------------------------- dışa açık API
window.initEngine = async (timeline) => {
  TL = timeline;
  OUT_W = TL.width; OUT_H = TL.height;
  GL_W = Math.round(OUT_W * (TL.renderScale ?? 0.6667) / 2) * 2; GL_H = Math.round(OUT_H * (TL.renderScale ?? 0.6667) / 2) * 2;
  ACCENT = TL.theme?.accent ?? ACCENT; ACCENT2 = TL.theme?.accent2 ?? ACCENT2;
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(GL_W, GL_H, false);
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = TL.exposure ?? 1.0;
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  out = document.createElement('canvas'); out.width = OUT_W; out.height = OUT_H; document.body.appendChild(out);
  octx = out.getContext('2d');
  vignette = document.createElement('canvas'); vignette.width = OUT_W; vignette.height = OUT_H;
  const vg = vignette.getContext('2d');
  const gr = vg.createRadialGradient(OUT_W / 2, OUT_H / 2, OUT_H * 0.25, OUT_W / 2, OUT_H / 2, OUT_H * 0.72);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); vg.fillStyle = gr; vg.fillRect(0, 0, OUT_W, OUT_H);
  const r = rng(99);
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); const id = g.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); grainTiles.push(octx.createPattern(c, 'repeat'));
  }
  await document.fonts.ready;
  return { GL_W, GL_H };
};

function sceneIndex(t) {
  const sc = TL.scenes;
  for (let i = 0; i < sc.length; i++) if (t < sc[i].end) return i;
  return sc.length - 1;
}

function getScene(i) {
  if (built.has(i)) return built.get(i);
  for (const [k, S] of built) if (k < i) { disposeScene(S.scene); built.delete(k); }
  const sc = TL.scenes[i];
  const fn = T[sc.visual.type] || T.question;
  const S = fn(sc.visual, sc.end - sc.start);
  built.set(i, S);
  return S;
}

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

window.renderFrame = (t, quality = 0.9) => {
  const i = sceneIndex(t);
  const sc = TL.scenes[i];
  const S = getScene(i);
  const lt = t - sc.start, dur = sc.end - sc.start;
  S.update(lt, dur, t);
  if (S.sky) S.sky.position.copy(S.cam.position);
  R.render(S.scene, S.cam);

  // ---- kompozit
  let zoom = 1, blur = 0, flash = 0, rot = 0;
  const n = TL.scenes.length;
  if (i > 0 && lt < 0.35) { const k = lt / 0.35; zoom = 1 + 0.2 * (1 - easeOutCubic(k)); blur = 1 - k; flash = 0.5 * Math.pow(1 - k, 2); rot = (i % 2 ? 1 : -1) * 0.035 * (1 - easeOutCubic(k)); }
  const outT = sc.end - t;
  if (i < n - 1 && outT < 0.2) { const k = 1 - outT / 0.2; zoom *= 1 + 0.14 * k * k; blur = Math.max(blur, k); }
  zoom *= 1 + 0.03 * (lt / Math.max(1, dur)); // yavaş Ken Burns
  const [sx, sy] = shakeAt(t);
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.fillStyle = '#000'; octx.fillRect(0, 0, OUT_W, OUT_H);
  octx.save();
  octx.translate(OUT_W / 2 + sx, OUT_H / 2 + sy); octx.rotate(rot); octx.scale(zoom, zoom); octx.translate(-OUT_W / 2, -OUT_H / 2);
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(R.domElement, 0, 0, OUT_W, OUT_H);
  if (blur > 0.05) {
    for (let j = 1; j <= 3; j++) {
      const z = 1 + 0.025 * j * blur; octx.globalAlpha = 0.28 * blur;
      octx.drawImage(R.domElement, OUT_W / 2 - OUT_W * z / 2, OUT_H / 2 - OUT_H * z / 2, OUT_W * z, OUT_H * z);
    }
    octx.globalAlpha = 1;
  }
  drawLabels(S);
  octx.restore();
  if (S.draw2d) { octx.save(); S.draw2d(octx, OUT_W, OUT_H, lt, dur); octx.restore(); }
  octx.drawImage(vignette, 0, 0);
  octx.save(); octx.globalAlpha = 0.045; octx.globalCompositeOperation = 'overlay';
  octx.fillStyle = grainTiles[Math.floor(t * TL.fps) % grainTiles.length]; octx.fillRect(0, 0, OUT_W, OUT_H); octx.restore();

  drawBig(sc, lt, S);
  drawTitle(t);
  drawCaptions(t);
  // ilerleme çubuğu
  octx.fillStyle = 'rgba(255,255,255,0.25)'; octx.fillRect(0, 0, OUT_W, 10);
  octx.fillStyle = ACCENT; octx.fillRect(0, 0, OUT_W * clamp(t / TL.duration), 10);
  if (flash > 0) { octx.fillStyle = `rgba(255,255,255,${flash})`; octx.fillRect(0, 0, OUT_W, OUT_H); }
  // son kare kararması
  const fadeOut = clamp((t - (TL.duration - 0.4)) / 0.4);
  if (fadeOut > 0) { octx.fillStyle = `rgba(0,0,0,${fadeOut})`; octx.fillRect(0, 0, OUT_W, OUT_H); }
  return out.toDataURL('image/jpeg', quality);
};

// ---------------------------------------------------------------- şablon eklentileri için dışa aktarım
export const kit = {
  THREE, T, clamp, lerp, smooth, easeOutCubic, easeInOut, easeOutBack, rng, perlin, col, canvasTex, softDot,
  skyDome, baseScene, lights, terrain, snowfall, marker, turkishFlag, person, rocks, signTex, outlinedText, pill, up, fitSize, roundRect,
  get ACCENT() { return ACCENT; }, get ACCENT2() { return ACCENT2; }, get FONT() { return FONT; }, get GL() { return [GL_W, GL_H]; },
};
