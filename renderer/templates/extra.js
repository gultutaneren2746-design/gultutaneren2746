// Ek 3D şablonlar: lake, depth, peak, tunnel, underground, crowd, ruins, timeline, quake
import { kit } from '../engine.js';

const {
  THREE, T, clamp, lerp, smooth, easeOutCubic, easeInOut, easeOutBack, rng, perlin, col, canvasTex, softDot,
  baseScene, lights, terrain, snowfall, marker, turkishFlag, person, outlinedText, fitSize,
} = kit;

const yearFmt = (y) => (y < 0 ? `MÖ ${Math.abs(y)}` : String(y));

// ------------------------------------------------------------ ortak: dalgalı su yüzeyi
function water({ size = 400, seg = 110, color = '#1d6fa5', opacity = 0.93, amp = 0.35, freq = 1 } = {}) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const base = g.attributes.position.array.slice();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.45, flatShading: true, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  return {
    obj: mesh,
    update(t) {
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        const x = base[i] * freq, z = base[i + 2] * freq;
        a[i + 1] = Math.sin(x * 0.08 + t * 1.2) * amp + Math.cos(z * 0.11 + t * 0.9) * amp * 0.7 + Math.sin((x + z) * 0.21 + t * 2) * amp * 0.3;
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
    },
  };
}

function gradientBackdrop(w, h, stops, z = -40) {
  const tex = canvasTex(8, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: false, depthWrite: false }));
  m.position.z = z; m.renderOrder = -2;
  return m;
}

// ============================================================ 1) GÖL (Van Gölü, Tuz Gölü…)
// params: waterColor | color:"pink", salt (bool: tuz kabuğu), time ("day"|"dusk"), snow (bool), pin {label, sub}, height
T.lake = (p, dur) => {
  const salt = !!p.salt, pink = p.color === 'pink';
  const dusk = p.time === 'dusk';
  const B = baseScene(dusk ? { top: '#2b3a6b', bottom: '#f4a98a', fog: '#e7b8a0', near: 160, far: 950 }
    : { top: '#3b7bd0', bottom: '#e3eef8', fog: '#dce7f2', near: 160, far: 950 });
  const ter = terrain({
    seed: p.seed ?? 41, size: 1000, seg: 150, h: p.height ?? (salt ? 60 : 120), scale: 0.0042,
    snowLine: p.snow ? 0.4 : 0.8, snowCover: p.snow ? 0.25 : 0,
    flat: { x: 0, z: -80, r: 150, y: -5 },
    ...(salt ? { grass: '#e9e2d6', dirt: '#f4f0ea', rock: '#b9ad9c' } : {}),
  });
  B.scene.add(ter.mesh);
  lights(B.scene, { sun: dusk ? '#ffc49a' : '#fff2dd', pos: [150, 120, 60], size: 200 });
  const wcol = p.waterColor || (pink ? '#ee8fb0' : salt ? '#cfe3ee' : '#1d6fa5');
  const w = water({ size: 1000, color: wcol, amp: salt ? 0.05 : 0.4, opacity: salt ? 0.85 : 0.93 });
  B.scene.add(w.obj);
  if (salt) {
    // tuz kabuğu: altıgen plakalar
    const r = rng(5);
    const N = 1600;
    const hex = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.25, 6), new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.6, flatShading: true }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2, rad = 40 + Math.pow(r(), 0.6) * 260;
      pos.set(Math.cos(a) * rad, 0.15, -80 + Math.sin(a) * rad);
      const s = 0.8 + r() * 2.2; sc.set(s, 1, s); q.setFromEuler(new THREE.Euler(0, r() * 3, 0));
      m4.compose(pos, q, sc); hex.setMatrixAt(i, m4);
    }
    hex.receiveShadow = true; B.scene.add(hex);
  }
  let pin = null;
  if (p.pin) { pin = marker(); pin.obj.position.set(0, 0.5, -80); B.scene.add(pin.obj); }
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(lt / dur);
    if (pin) {
      const ang = 0.4 + lt * 0.1, r = lerp(220, 120, k);
      B.cam.position.set(Math.sin(ang) * r, lerp(70, 35, k), -80 + Math.cos(ang) * r);
      B.cam.lookAt(0, 15, -80);
      pin.update(lt, clamp((lt - 0.3) / 0.6));
      S.labels = p.pin.label ? [{ pos: new THREE.Vector3(0, 12, -80), text: p.pin.label, sub: p.pin.sub, alpha: clamp((lt - 0.7) / 0.4) }] : [];
    } else {
      const z = 170 - lt * 14;
      B.cam.position.set(Math.sin(lt * 0.3) * 12, salt ? lerp(34, 18, k) : lerp(22, 9, k), z);
      B.cam.lookAt(Math.sin(lt * 0.3) * 6, 0, z - 90);
    }
    w.update(lt);
  };
  return S;
};

// ============================================================ 2) DERİNLİK KESİTİ (göl / deniz / boğaz)
// params: value (m, en derin nokta), refs [{label, value}] (kıyas için yukarıdan sarkan siluetler), label, color
T.depth = (p, dur) => {
  const D = p.value ?? 450, H = 40, k = H / D;
  const B = baseScene({ top: '#7fb6e6', bottom: '#cfe6f7', fov: 50 });
  const scene = B.scene;
  B.sky.visible = false;
  scene.add(gradientBackdrop(400, 140, [[0, '#8cc4ee'], [0.38, '#d6ecfa'], [0.4, '#2b84c0'], [0.65, '#0d3d6e'], [1, '#020b1a']], -30));
  scene.children[scene.children.length - 1].position.y = -H / 2 + 6;
  scene.add(new THREE.HemisphereLight('#bfe4ff', '#0a1a30', 1.0));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(10, 40, 30); scene.add(sun);
  // yüzey
  const w = water({ size: 260, seg: 80, color: p.color || '#2f8fd0', amp: 0.35, opacity: 0.95 });
  w.obj.scale.set(1, 1, 0.12); w.obj.position.set(0, 0, -6); scene.add(w.obj);
  // taban profili
  const n = perlin(p.seed ?? 3);
  const shape = new THREE.Shape();
  shape.moveTo(-130, 4);
  for (let x = -130; x <= 130; x += 2) {
    const u = clamp(1 - Math.pow(Math.abs(x) / 62, 2));
    const y = x < -62 || x > 62 ? 3 + Math.abs(x) * 0.03 : -H * Math.pow(u, 0.6) + n(x * 0.06, 0.5) * 2.5 * u;
    shape.lineTo(x, Math.min(3, y));
  }
  shape.lineTo(130, -H - 30); shape.lineTo(-130, -H - 30); shape.closePath();
  const bedGeo = new THREE.ExtrudeGeometry(shape, { depth: 24, bevelEnabled: false }); bedGeo.translate(0, 0, -20);
  const bed = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({ color: '#5d4c3a', roughness: 1, flatShading: true }));
  scene.add(bed);
  // kıyas siluetleri (yüzeyden aşağı)
  const refs = (p.refs || []).map((r, i) => {
    const h = r.value * k;
    const x = -11 - i * 8;
    const geo = new THREE.CylinderGeometry(2.4, 0.4, h, 4); geo.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#9fd4ff', emissiveIntensity: 0.4, transparent: true, opacity: 0.55 }));
    m.position.set(x, 0, 2); scene.add(m);
    return { r, h, x, m };
  });
  // sonda
  const probe = new THREE.Group();
  const yel = new THREE.MeshStandardMaterial({ color: '#ffd400', emissive: '#7a5d00', emissiveIntensity: 0.4, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.4, 6, 16), yel); body.rotation.z = Math.PI / 2; probe.add(body);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 1.2), yel); fin.position.x = -1.9; probe.add(fin);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.6), yel); tower.position.y = 0.9; probe.add(tower);
  const lamp = new THREE.PointLight('#fff2c0', 80, 25, 2); lamp.position.set(1.8, -0.5, 1); probe.add(lamp);
  probe.position.set(6, 0, 3); scene.add(probe);
  // derinlik çizgisi
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(6, 0, 3), new THREE.Vector3(6, -H, 3)]);
  const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.6, gapSize: 0.4 }));
  line.computeLineDistances(); scene.add(line);
  const bub = snowfall({ count: 500, box: [70, H + 10, 10], size: 0.25, speed: [-3, -1], drift: 0.4, color: '#cfeeff', seed: 7, opacity: 0.6 });
  scene.add(bub.obj);
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const kk = easeInOut(clamp((lt - 0.2) / (dur * 0.82)));
    const py = -H * kk + Math.sin(lt * 2) * 0.15;
    probe.position.y = py; probe.rotation.z = Math.sin(lt * 1.3) * 0.05;
    lineGeo.setFromPoints([new THREE.Vector3(6, 0, 3), new THREE.Vector3(6, py, 3)]); line.computeLineDistances();
    B.cam.position.set(-2 + Math.sin(lt * 0.2) * 2, lerp(-6, -H * 0.62, kk), 70);
    B.cam.lookAt(-2, lerp(-10, -H * 0.62, kk), 0);
    w.update(lt); bub.update(lt, new THREE.Vector3(0, -H / 2, 0));
    S.live = -D * kk;
    S.labels = [];
    for (let i = 1; i <= 4; i++) {
      const dm = Math.round((D * i) / 4);
      S.labels.push({ pos: new THREE.Vector3(7.5, -dm * k, 3), text: `-${dm.toLocaleString('tr-TR')} m`, kind: 'tick', alpha: 0.85 });
    }
    refs.forEach((rf, i) => S.labels.push({ pos: new THREE.Vector3(rf.x, -rf.h - 3, 2), text: rf.r.label, sub: `${rf.r.value.toLocaleString('tr-TR')} m`, alpha: clamp((lt - 0.6 - i * 0.4) / 0.4) }));
    if (p.label) S.labels.push({ pos: new THREE.Vector3(1, py - 4, 3), text: p.label, alpha: clamp((lt - 1) / 0.4) });
  };
  return S;
};

// ============================================================ 3) TEK ZİRVE (Ağrı Dağı…)
// params: height (m, zirve), base (m, sayaç başlangıcı), twin (bool: ikinci küçük zirve), label, climber (bool), flag (bool)
T.peak = (p, dur) => {
  const H = 70;
  const B = baseScene({ top: '#2f66b8', bottom: '#dbe8f5', fog: '#d4e1ee', near: 200, far: 900 });
  const cone = (x, z, cx, cz, h, R) => { const r = Math.hypot(x - cx, z - cz); return h * Math.pow(clamp(1 - r / R), 1.6); };
  const ter = terrain({
    seed: p.seed ?? 77, size: 700, seg: 200, h: H, snowLine: 0.5, grass: '#8c8455', dirt: '#7d6a50',
    heightFn: (x, z, n, n2) => {
      let y = cone(x, z, 0, 0, H, 120);
      if (p.twin !== false) y = Math.max(y, cone(x, z, 95, -40, H * 0.55, 70));
      const rough = (n(x * 0.045, z * 0.045) * 0.6 + n(x * 0.12, z * 0.12) * 0.25);
      return Math.max(0, y + rough * 10 * (0.25 + y / H) + (n2(x * 0.01, z * 0.01) + 0.5) * 6);
    },
  });
  B.scene.add(ter.mesh);
  lights(B.scene, { pos: [160, 200, 120], size: 220 });
  const top = new THREE.Vector3(0, ter.height(0, 0), 0);
  if (p.flag !== false) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), new THREE.MeshStandardMaterial({ color: '#ddd' }));
    pole.position.copy(top).add(new THREE.Vector3(0, 3, 0)); B.scene.add(pole);
  }
  const flag = turkishFlag(); flag.obj.scale.setScalar(0.9); flag.obj.position.copy(top).add(new THREE.Vector3(2.0, 5, 0));
  if (p.flag !== false) B.scene.add(flag.obj);
  // bulut halkası
  const r = rng(9); const N = 220; const cp = new Float32Array(N * 3); const cb = [];
  for (let i = 0; i < N; i++) { const a = r() * Math.PI * 2, rad = 70 + r() * 80; cb.push([a, rad, H * 0.42 + (r() - 0.5) * 8]); }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  const clouds = new THREE.Points(cg, new THREE.PointsMaterial({ size: 26, map: softDot(), color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
  clouds.frustumCulled = false; B.scene.add(clouds);
  // tırmanış rotası
  const path = [];
  for (let i = 0; i <= 200; i++) { const u = i / 200; const a = u * Math.PI * 3.2 + 0.6; const rad = 110 * Math.pow(1 - u, 1.1) + 1; const x = Math.cos(a) * rad, z = Math.sin(a) * rad; path.push(new THREE.Vector3(x, ter.height(x, z) + 0.6, z)); }
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: kit.ACCENT }), path.length);
  const m4 = new THREE.Matrix4(); path.forEach((v, i) => { m4.makeTranslation(v.x, v.y, v.z); dots.setMatrixAt(i, m4); });
  if (p.climber !== false) B.scene.add(dots);
  const climber = person({ coat: '#e0433c', bag: '#333', scale: 1.4 });
  if (p.climber !== false) B.scene.add(climber);
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(lt / dur);
    const ang = 0.5 + lt * 0.1, rad = lerp(260, 150, k);
    B.cam.position.set(Math.sin(ang) * rad, lerp(15, H + 25, k), Math.cos(ang) * rad);
    B.cam.lookAt(0, lerp(H * 0.35, H * 0.85, k), 0);
    for (let i = 0; i < N; i++) { const [a, rr, y] = cb[i]; const aa = a + lt * 0.03; cp[i * 3] = Math.cos(aa) * rr; cp[i * 3 + 1] = y; cp[i * 3 + 2] = Math.sin(aa) * rr; }
    cg.attributes.position.needsUpdate = true;
    const u = clamp(k * 0.98); const idx = Math.floor(u * (path.length - 1));
    climber.position.copy(path[idx]); dots.count = idx + 1;
    flag.update(lt);
    S.live = lerp(p.base ?? 0, p.height ?? 5137, k);
    S.labels = p.label ? [{ pos: top.clone().add(new THREE.Vector3(0, 12, 0)), text: p.label, sub: p.sub, alpha: clamp((lt - 0.6) / 0.4) }] : [];
  };
  return S;
};

// ============================================================ 4) TÜNEL
// params: length_km (sayaç hedefi), color ("#ffb648" ışık rengi), exit (bool: sonda çıkış ışığı)
T.tunnel = (p, dur) => {
  const speed = p.speed ?? 26, L = speed * dur + 200;
  const B = baseScene({ top: '#05070c', bottom: '#0b0f18', fog: '#0a0d14', near: 15, far: 170 });
  B.sky.visible = false; B.scene.background = col('#0a0d14');
  const scene = B.scene;
  scene.add(new THREE.HemisphereLight('#8090a8', '#202020', 0.35));
  const wallTex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#7b7d80'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#5c5e61'; g.lineWidth = 4;
    for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; const r = rng(1); for (let i = 0; i < 200; i++) g.fillRect(r() * 256, r() * 256, 3, 3);
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(6, L / 8);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, L, 28, 1, true, -Math.PI * 0.62, Math.PI * 1.24),
    new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.85 }));
  shell.rotation.x = Math.PI / 2; shell.rotation.y = Math.PI; shell.position.set(0, 2.2, -L / 2 + 20); scene.add(shell);
  const roadTex = canvasTex(128, 256, (g) => {
    g.fillStyle = '#2b2c2f'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#e8e8e8'; g.fillRect(60, 0, 8, 120);
    g.fillStyle = '#d9b400'; g.fillRect(4, 0, 5, 256); g.fillRect(119, 0, 5, 256);
  });
  roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, L / 12);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(11, L), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.6, metalness: 0.2 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, -3.2, -L / 2 + 20); scene.add(road);
  const lc = p.color || '#ffd08a';
  const nL = Math.floor(L / 7);
  const lampM = new THREE.MeshStandardMaterial({ color: lc, emissive: lc, emissiveIntensity: 3 });
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.18, 2.2), lampM, nL * 2);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < nL; i++) for (const s of [0, 1]) { m4.makeTranslation(s ? 3.2 : -3.2, 8.3, 20 - i * 7); lamps.setMatrixAt(i * 2 + s, m4); }
  scene.add(lamps);
  const exitsM = new THREE.MeshStandardMaterial({ color: '#21c46b', emissive: '#18c060', emissiveIntensity: 2 });
  const nE = Math.floor(L / 60); const exitsI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.8, 1.6), exitsM, nE);
  for (let i = 0; i < nE; i++) { m4.makeTranslation(-6.2, 1.5, -i * 60); exitsI.setMatrixAt(i, m4); }
  scene.add(exitsI);
  const pl = [0, 1, 2].map(() => { const l = new THREE.PointLight(lc, 70, 30, 2); scene.add(l); return l; });
  let exit = null;
  if (p.exit !== false) {
    exit = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }));
    exit.position.set(0, 2.2, -speed * dur - 30); scene.add(exit);
  }
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const z = -lt * speed;
    B.cam.position.set(Math.sin(lt * 0.6) * 0.6 - 1.6, 0.2 + Math.sin(lt * 7) * 0.03, z);
    B.cam.lookAt(-1.6 + Math.sin(lt * 0.6 + 0.4) * 0.8, 0.4, z - 30);
    pl.forEach((l, i) => l.position.set(0, 6, z - 6 - i * 16));
    if (exit) { const near = clamp((lt - (dur - 2.2)) / 2.2); exit.visible = near > 0; exit.position.z = z - lerp(160, 30, near * near); }
    S.live = lerp(0, p.length_km ?? 10, easeInOut(lt / dur));
  };
  return S;
};

// ============================================================ 5) YER ALTI ŞEHRİ (kesit)
// params: levels (kat sayısı), depth (m), people (kat başına kişi), surface ("cappadocia"|"plain"), label
T.underground = (p, dur) => {
  const LV = p.levels ?? 8, LH = 7, W = 46, DEP = p.depth ?? 85;
  const totalH = LV * LH;
  const B = baseScene({ top: '#4e86c9', bottom: '#f3d9b5', fov: 50 });
  const scene = B.scene;
  scene.add(new THREE.HemisphereLight('#ffe8cc', '#3a2010', 0.7));
  const sun = new THREE.DirectionalLight('#fff0d8', 1.6); sun.position.set(20, 60, 40); scene.add(sun);
  const tuff = new THREE.MeshStandardMaterial({ color: '#c79f74', roughness: 1, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#3b2717', roughness: 1 });
  // arka duvar ve dış kaya
  const back = new THREE.Mesh(new THREE.BoxGeometry(W + 30, totalH + 10, 2), dark); back.position.set(0, -totalH / 2 - 3, -6); scene.add(back);
  for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(15, totalH + 10, 14), tuff); side.position.set(s * (W / 2 + 7.5), -totalH / 2 - 3, 0); scene.add(side); }
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(W + 30, 6, 14), tuff); bottom.position.set(0, -totalH - 4, 0); scene.add(bottom);
  // yüzey
  const ground = new THREE.Mesh(new THREE.BoxGeometry(W + 200, 2, 200), new THREE.MeshStandardMaterial({ color: '#b98d5f', roughness: 1 }));
  ground.position.set(0, 0, -92); scene.add(ground);
  const ground2 = new THREE.Mesh(new THREE.BoxGeometry(W + 30, 2, 14), new THREE.MeshStandardMaterial({ color: '#b98d5f', roughness: 1 })); ground2.position.set(0, 0, 0); scene.add(ground2);
  if (p.surface !== 'plain') {
    const r = rng(3);
    for (let i = 0; i < 14; i++) {
      const h = 6 + r() * 10, x = (r() - 0.5) * 120, z = -10 - r() * 60;
      const c = new THREE.Mesh(new THREE.ConeGeometry(2 + r() * 1.5, h, 10), tuff); c.position.set(x, h / 2, z); scene.add(c);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 10), dark); cap.position.set(x, h + 0.4, z); scene.add(cap);
    }
  }
  // katlar
  const lampM = new THREE.MeshStandardMaterial({ color: '#ffb648', emissive: '#ff9a2a', emissiveIntensity: 3 });
  const people = [];
  for (let l = 0; l < LV; l++) {
    const y = -(l + 1) * LH;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2, 12), tuff); floor.position.set(0, y - 0.6 + 1, 0); scene.add(floor);
    const nRooms = 3 + (l % 2);
    for (let rI = 0; rI <= nRooms; rI++) {
      const x = -W / 2 + (rI * W) / nRooms;
      if (rI > 0 && rI < nRooms) { const pil = new THREE.Mesh(new THREE.BoxGeometry(1.6, LH - 1.2, 10), tuff); pil.position.set(x, y + LH / 2 + 0.4, -0.5); scene.add(pil); }
      if (rI < nRooms) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), lampM); lamp.position.set(x + W / nRooms / 2, y + LH - 1.6, -4); scene.add(lamp);
      }
    }
    // döner taş kapı
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.8, 24), new THREE.MeshStandardMaterial({ color: '#a8875e', roughness: 1, flatShading: true }));
    stone.rotation.x = Math.PI / 2; stone.position.set(l % 2 ? W / 2 - 3 : -W / 2 + 3, y + 3.3, 2); scene.add(stone);
    // merdiven
    const st = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 2.5), tuff); st.position.set(l % 2 ? -W / 2 + 6 : W / 2 - 6, y + LH / 2 + 0.5, 2); st.rotation.z = (l % 2 ? 1 : -1) * 0.6; scene.add(st);
    for (let k = 0; k < (p.people ?? 2); k++) {
      const pp = person({ coat: ['#7a3b2a', '#4b5d3a', '#6b4e8a', '#8a6a2a'][(l + k) % 4], scale: 0.9, skin: '#d9a77c' });
      pp.position.set(-W / 2 + 6 + ((k * 13 + l * 7) % (W - 12)), y + 0.4, -1.5); scene.add(pp); people.push(pp);
    }
  }
  // havalandırma bacası
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(2, totalH + 2, 2), new THREE.MeshStandardMaterial({ color: '#1a0f08' }));
  shaft.position.set(W / 2 - 1.5, -totalH / 2 + 1, -3); scene.add(shaft);
  const torches = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ff9a3a', 90, 30, 2); scene.add(l); return l; });
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(clamp((lt - 0.2) / (dur * 0.85)));
    const cy = lerp(4, -totalH + 6, k);
    B.cam.position.set(Math.sin(lt * 0.25) * 4, cy + 2, 48);
    B.cam.lookAt(0, cy - 1, 0);
    torches.forEach((l, i) => { l.position.set(-14 + i * 14, cy - 2 + Math.sin(lt * 9 + i) * 0.2, 4); l.intensity = 80 + Math.sin(lt * 17 + i * 3) * 12; });
    people.forEach((pp, i) => { pp.rotation.y = Math.sin(lt * 0.7 + i) * 0.8; });
    S.live = -DEP * k;
    S.labels = [];
    for (let l = 0; l < LV; l++) {
      const yy = -(l + 1) * LH + LH / 2;
      if (Math.abs(yy - cy) < 18) S.labels.push({ pos: new THREE.Vector3(-W / 2 - 2, yy, 6), text: `${l + 1}. kat`, kind: 'tick', alpha: 0.9 });
    }
  };
  return S;
};

// ============================================================ 6) KALABALIK (nüfus)
// params: people (gösterilecek figür, ≤600), count (sayaç hedefi), snow (bool)
T.crowd = (p, dur) => {
  const N = Math.min(600, p.people ?? 320);
  const B = baseScene({ top: '#3f78c9', bottom: '#e1ebf5', fog: '#dbe5ef', near: 80, far: 400 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: p.snow ? '#eef3f8' : '#86a35a', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; B.scene.add(ground);
  lights(B.scene, { pos: [40, 80, 30], size: 60 });
  const r = rng(12);
  // köy evleri
  const nH = 60;
  const houses = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.9 }), nH);
  const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(3.4, 2.2, 4), new THREE.MeshStandardMaterial({ color: '#b8382c', flatShading: true }), nH);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  for (let i = 0; i < nH; i++) {
    const a = r() * Math.PI * 2, rad = 38 + r() * 70; const rot = r() * Math.PI;
    q.setFromEuler(new THREE.Euler(0, rot, 0)); v.set(Math.cos(a) * rad, 1.5, Math.sin(a) * rad); m4.compose(v, q, s); houses.setMatrixAt(i, m4);
    q.setFromEuler(new THREE.Euler(0, rot + Math.PI / 4, 0)); v.y = 4.1; m4.compose(v, q, s); roofs.setMatrixAt(i, m4);
  }
  houses.castShadow = true; B.scene.add(houses, roofs);
  // insanlar
  const bodyG = new THREE.CapsuleGeometry(0.42, 0.9, 4, 8); bodyG.translate(0, 0.95, 0);
  const headG = new THREE.SphereGeometry(0.33, 10, 8); headG.translate(0, 1.98, 0);
  const bodies = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), N);
  const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ color: '#e8b896', roughness: 0.7 }), N);
  const pal = ['#e0433c', '#2f7de1', '#2fb36b', '#f0a030', '#8a4fd8', '#e05a9b', '#2a2f45', '#14a6a6'];
  const pos = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2.39996, rad = 1.25 * Math.sqrt(i + 1);
    pos.push([Math.cos(a) * rad, Math.sin(a) * rad, r() * Math.PI * 2]);
    bodies.setColorAt(i, col(pal[Math.floor(r() * pal.length)]));
  }
  bodies.castShadow = true; B.scene.add(bodies, heads);
  const target = p.count ?? N;
  const S = { ...B, labels: [] };
  const grow = dur * 0.7;
  S.update = (lt) => {
    const k = easeInOut(lt / dur);
    let visible = 0;
    for (let i = 0; i < N; i++) {
      const ti = 0.2 + Math.pow(i / N, 0.85) * grow;
      const sc = easeOutBack(clamp((lt - ti) / 0.35));
      if (sc > 0.01) visible++;
      const [x, z, rot] = pos[i];
      q.setFromEuler(new THREE.Euler(0, rot, 0)); v.set(x, Math.abs(Math.sin(lt * 6 + i)) * 0.08 * (sc > 0.99 ? 1 : 0), z); s.setScalar(Math.max(0.0001, sc));
      m4.compose(v, q, s); bodies.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
    }
    bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    const ang = lt * 0.12 + 0.3, rad = lerp(16, 60, k);
    B.cam.position.set(Math.sin(ang) * rad, lerp(5, 55, k), Math.cos(ang) * rad);
    B.cam.lookAt(0, 0, 0);
    S.live = (visible / N) * target;
  };
  return S;
};

// ============================================================ 7) ANTİK TAPINAK (Göbeklitepe tipi T-dikili taşlar)
// params: pillars (çevre dikilitaş sayısı), label, time ("dusk"|"day")
function reliefTex(seed) {
  return canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#c9b18a'; g.fillRect(0, 0, w, h);
    const r = rng(seed); g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 300; i++) g.fillRect(r() * w, r() * h, 2 + r() * 4, 2 + r() * 4);
    g.strokeStyle = 'rgba(70,50,30,0.75)'; g.lineWidth = 5; g.lineCap = 'round';
    // kollar ve kemer (merkez dikilitaş motifi)
    g.beginPath(); g.moveTo(20, 120); g.quadraticCurveTo(10, 300, 50, 330); g.lineTo(78, 330); g.stroke();
    g.beginPath(); g.moveTo(108, 120); g.quadraticCurveTo(118, 300, 78, 330); g.stroke();
    g.beginPath(); g.moveTo(12, 360); g.lineTo(116, 360); g.moveTo(12, 372); g.lineTo(116, 372); g.stroke();
    // hayvan kabartması (stilize tilki/yaban domuzu)
    const ax = 64, ay = 440;
    g.beginPath(); g.ellipse(ax, ay, 34, 16, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(ax + 30, ay - 6); g.lineTo(ax + 48, ay - 20); g.lineTo(ax + 50, ay - 4); g.stroke();
    g.beginPath(); g.moveTo(ax - 20, ay + 14); g.lineTo(ax - 24, ay + 34); g.moveTo(ax + 18, ay + 14); g.lineTo(ax + 22, ay + 34); g.moveTo(ax - 34, ay); g.lineTo(ax - 50, ay - 14); g.stroke();
  });
}

T.ruins = (p, dur) => {
  const dusk = p.time !== 'day';
  const B = baseScene(dusk ? { top: '#4a6fa5', bottom: '#f2c48d', fog: '#e8c39a', near: 90, far: 500 } : { top: '#4b86d0', bottom: '#efe6d4', fog: '#e9e0cc', near: 90, far: 500 });
  const ter = terrain({ seed: p.seed ?? 63, size: 500, seg: 140, h: 28, scale: 0.008, snowLine: 2, grass: '#b59a63', dirt: '#a8875a', rock: '#8c7a62', flat: { x: 0, z: 0, r: 22 } });
  B.scene.add(ter.mesh);
  lights(B.scene, { sun: dusk ? '#ffcf9a' : '#fff4e0', sunI: dusk ? 2.4 : 2.8, pos: dusk ? [-60, 35, 40] : [40, 80, 30], size: 40, target: [0, ter.flatY, 0] });
  const y0 = ter.flatY - 2.5;
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(17, 15, 3, 40), new THREE.MeshStandardMaterial({ color: '#9c7f58', roughness: 1 }));
  pit.position.set(0, y0 + 0.4, 0); pit.receiveShadow = true; B.scene.add(pit);
  const stoneM = new THREE.MeshStandardMaterial({ color: '#c2a57c', roughness: 1, flatShading: true });
  const wallN = 40; const r = rng(4);
  for (let i = 0; i < wallN; i++) {
    const a = (i / wallN) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2 + r() * 0.8, 1.4), stoneM);
    b.position.set(Math.cos(a) * 14.5, y0 + 2.6, Math.sin(a) * 14.5); b.rotation.y = -a + Math.PI / 2; b.castShadow = true; B.scene.add(b);
  }
  const relief = [reliefTex(1), reliefTex(2)];
  function tPillar(scale, seed) {
    const g = new THREE.Group();
    const mats = [stoneM, stoneM, stoneM, stoneM, new THREE.MeshStandardMaterial({ map: relief[seed % 2], roughness: 1 }), stoneM];
    const stem = new THREE.Mesh(new THREE.BoxGeometry(1.3, 5.2, 0.55), mats); stem.position.y = 2.6; g.add(stem);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.65), stoneM); top.position.set(0.5, 5.7, 0); g.add(top);
    g.scale.setScalar(scale); g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  const n = p.pillars ?? 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const pl = tPillar(0.9 + r() * 0.15, i); pl.position.set(Math.cos(a) * 12, y0 + 1.6, Math.sin(a) * 12); pl.rotation.y = -a - Math.PI / 2; B.scene.add(pl);
  }
  for (const s of [-1, 1]) { const c = tPillar(1.45, 0); c.position.set(s * 2.4, y0 + 1.6, 0); B.scene.add(c); }
  const dust = snowfall({ count: 700, box: [60, 25, 60], size: 0.25, speed: [-0.4, 0.4], drift: 3, color: '#ffe2b0', seed: 5, opacity: 0.6 });
  B.scene.add(dust.obj);
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(lt / dur);
    const ang = (p.angle ?? 0.6) + lt * 0.12, rad = lerp(46, 26, k);
    B.cam.position.set(Math.sin(ang) * rad, y0 + lerp(22, 9, k), Math.cos(ang) * rad);
    B.cam.lookAt(0, y0 + 4, 0);
    dust.update(lt, new THREE.Vector3(0, y0 + 10, 0));
    S.labels = p.label ? [{ pos: new THREE.Vector3(0, y0 + 13, 0), text: p.label, sub: p.sub, alpha: clamp((lt - 0.6) / 0.4) }] : [];
  };
  return S;
};

// ============================================================ 8) ZAMAN ÇİZGİSİ (geçmişe yolculuk)
// params: marks [{label, year (MÖ için negatif), highlight}], now (varsayılan 2025)
T.timeline = (p, dur) => {
  const now = p.now ?? 2025;
  const marks = (p.marks || []).slice().sort((a, b) => b.year - a.year);
  const maxAge = Math.max(1, ...marks.map((m) => now - m.year));
  const Z = 170, kz = Z / maxAge;
  const B = baseScene({ top: '#050816', bottom: '#1a1440', fov: 55 });
  const scene = B.scene;
  scene.fog = new THREE.Fog('#120e2e', 40, 160);
  scene.add(new THREE.AmbientLight('#8070ff', 0.6));
  const grid = new THREE.GridHelper(400, 160, '#3b2f8f', '#231c5c'); grid.position.set(0, 0, -Z / 2); scene.add(grid);
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, Z + 40, 12), new THREE.MeshBasicMaterial({ color: kit.ACCENT }));
  axis.rotation.x = Math.PI / 2; axis.position.set(0, 0.2, -Z / 2 + 10); scene.add(axis);
  // yıl tikleri (her 1000 yılda)
  const step = maxAge > 5000 ? 1000 : maxAge > 1000 ? 500 : 100;
  const nT = Math.floor(maxAge / step);
  const tickI = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#9f95ff' }), nT + 1);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i <= nT; i++) { m4.makeTranslation(0, 0.2, -i * step * kz); tickI.setMatrixAt(i, m4); }
  scene.add(tickI);
  const pillars = marks.map((m, i) => {
    const hl = !!m.highlight; const c = hl ? kit.ACCENT : ['#4fb4ff', '#ff6fae', '#7dffb0', '#b08cff'][i % 4];
    const h = hl ? 12 : 7; const x = (i % 2 ? 1 : -1) * 4.5; const z = -(now - m.year) * kz;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, h, 16), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 }));
    pil.position.set(x, h / 2, z); scene.add(pil);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: c })); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.1, z); scene.add(ring);
    const link = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x), 0.1, 0.1), new THREE.MeshBasicMaterial({ color: c })); link.position.set(x / 2, 0.2, z); scene.add(link);
    const l = new THREE.PointLight(c, 40, 20, 2); l.position.set(x, 3, z); scene.add(l);
    return { m, x, z, h, ring };
  });
  const stars = snowfall({ count: 1200, box: [120, 60, 220], size: 0.35, speed: [-0.2, 0.2], drift: 1, color: '#b9b0ff', seed: 21, opacity: 0.7 });
  scene.add(stars.obj);
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const k = easeInOut(clamp((lt - 0.2) / (dur * 0.85)));
    const cz = lerp(14, -Z + 42, k);
    B.cam.position.set(Math.sin(lt * 0.3) * 1.5, 11, cz);
    B.cam.lookAt(0, 1.5, cz - 45);
    stars.update(lt, new THREE.Vector3(0, 25, -Z / 2));
    pillars.forEach((pp, i) => pp.ring.scale.setScalar(1 + ((lt * 0.8 + i * 0.3) % 1) * 1.5));
    S.live = Math.round(now - clamp(-(cz - 42 * k) / kz, 0, maxAge));
    S.labels = pillars.map((pp) => ({ pos: new THREE.Vector3(pp.x, pp.h + 2.2, pp.z), text: pp.m.label, sub: yearFmt(pp.m.year), alpha: clamp((cz - pp.z - 14) / 6) * clamp((110 - (cz - pp.z)) / 20) }));
  };
  return S;
};

// ============================================================ 9) DEPREM (şehir + fay + sismograf)
// params: magnitude (büyüklük), label, city ("dense"|"sparse")
T.quake = (p, dur) => {
  const M = p.magnitude ?? 7;
  const B = baseScene({ top: '#71859d', bottom: '#d9cfc2', fog: '#d6ccc0', near: 70, far: 320 });
  lights(B.scene, { sun: '#fff0dc', pos: [50, 90, 40], size: 70 });
  const plateM = new THREE.MeshStandardMaterial({ color: '#8c8f7a', roughness: 1 });
  const plates = [-1, 1].map((s) => { const b = new THREE.Mesh(new THREE.BoxGeometry(80, 6, 140), plateM); b.position.set(s * 40.4, -3, 0); b.receiveShadow = true; B.scene.add(b); return b; });
  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 140), new THREE.MeshBasicMaterial({ color: '#1a0f08' })); crack.position.y = -3.05; B.scene.add(crack);
  const r = rng(8);
  const nB = p.city === 'sparse' ? 90 : 220;
  const bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), nB);
  const pal = ['#e9e1d3', '#d9c7a8', '#c9d3dc', '#e4cfc4', '#bfc8b5', '#f0e6d2'];
  const info = [];
  for (let i = 0; i < nB; i++) {
    let x; do { x = (r() - 0.5) * 70; } while (Math.abs(x) < 3);
    const z = (r() - 0.5) * 110, h = 2 + Math.pow(r(), 2) * 16, w = 2.5 + r() * 3;
    info.push({ x, z, h, w, d: 2.5 + r() * 3, ph: r() * 6.28, side: Math.sign(x) });
    bld.setColorAt(i, col(pal[i % pal.length]));
  }
  bld.castShadow = true; bld.receiveShadow = true; B.scene.add(bld);
  const dust = snowfall({ count: 900, box: [80, 20, 120], size: 1.6, speed: [-2, -0.5], drift: 3, color: '#cbb89c', seed: 4, opacity: 0.35 });
  B.scene.add(dust.obj); dust.obj.visible = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const t0 = 0.6;
  const env = (t) => (t < t0 ? 0 : clamp((t - t0) / 0.3) * Math.exp(-(t - t0) / (dur * 0.45)));
  const wave = (t) => {
    let y = 0; const e = env(t);
    y += Math.sin(t * 38) * 0.5 + Math.sin(t * 61 + 1) * 0.3 + Math.sin(t * 97 + 2) * 0.2;
    return y * e + Math.sin(t * 25) * 0.03;
  };
  const S = { ...B, labels: [] };
  S.update = (lt) => {
    const e = env(lt) * (M / 7);
    const slip = clamp((lt - t0) / 1.2) * 2.5 * (M / 7);
    plates[1].position.z = slip; crack.scale.x = 1 + clamp((lt - t0) / 1) * 2.5;
    for (let i = 0; i < nB; i++) {
      const b = info[i];
      const sx = Math.sin(lt * 31 + b.ph) * 0.35 * e, tilt = Math.sin(lt * 23 + b.ph) * 0.04 * e;
      q.setFromEuler(new THREE.Euler(tilt, 0, tilt * 0.7));
      v.set(b.x + sx, b.h / 2, b.z + (b.side > 0 ? slip : 0)); s.set(b.w, b.h, b.d);
      m4.compose(v, q, s); bld.setMatrixAt(i, m4);
    }
    bld.instanceMatrix.needsUpdate = true;
    dust.obj.visible = lt > t0 + 0.3; dust.update(lt, new THREE.Vector3(0, 8, 0));
    const ang = 0.7 + lt * 0.06;
    const sh = e * 0.6;
    B.cam.position.set(Math.sin(ang) * 85 + Math.sin(lt * 47) * sh, 55 + Math.sin(lt * 53) * sh, Math.cos(ang) * 85);
    B.cam.lookAt(0, 3, 0);
    S.live = M * clamp((lt - t0) / 1.0);
  };
  // 2D sismograf şeridi
  S.draw2d = (g, W, H, lt) => {
    const y0 = H * 0.5, h = H * 0.07, x0 = W * 0.06, w = W * 0.88;
    g.fillStyle = 'rgba(10,14,25,0.55)'; g.beginPath(); g.roundRect(x0 - 20, y0 - h * 1.5, w + 40, h * 3, 24); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w, y0); g.stroke();
    const span = 3.0; const N = 360;
    g.strokeStyle = kit.ACCENT2; g.lineWidth = 5; g.lineJoin = 'round'; g.beginPath();
    let started = false;
    for (let i = 0; i <= N; i++) {
      const tt = lt - span + (i / N) * span; if (tt < 0) continue;
      const x = x0 + (i / N) * w, y = y0 - wave(tt) * h * (M / 7);
      if (started) g.lineTo(x, y); else { g.moveTo(x, y); started = true; }
    }
    g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x0 + w, y0 - wave(lt) * h * (M / 7), 9, 0, 7); g.fill();
    outlinedText('SİSMOGRAF', x0 + 10, y0 - h * 1.15, { size: 30, align: 'left', fill: '#ffffff', sw: 0.12, shadow: false });
  };
  return S;
};
