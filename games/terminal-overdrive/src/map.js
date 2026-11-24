// map.js. Sunset container terminal. Procedural textures, no external files.
import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function concreteTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5a564e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${20 + Math.random() * 60 | 0},${18 + Math.random() * 55 | 0},${14 + Math.random() * 45 | 0},${0.12 + Math.random() * 0.2})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(30,28,24,0.25)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 12 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(20,18,16,0.55)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
    g.strokeStyle = 'rgba(214,178,60,0.85)'; g.lineWidth = 5; g.setLineDash([26, 18]);
    g.beginPath(); g.moveTo(40, 256); g.lineTo(472, 256); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3; g.strokeRect(20, 20, 472, 472);
  });
}
function containerTexture(base, rust) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 8, 0, 2, h); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${rust},${0.10 + Math.random() * 0.25})`; const s = 2 + Math.random() * 14; g.fillRect(Math.random() * w, Math.random() * h, s, s * 0.6); }
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = 'bold 15px monospace'; g.fillText('TO-' + (1000 + Math.random() * 9000 | 0), 14, 26);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 12, w, 12);
  });
}

function puddleTexture() {
  // Fake sky reflection painted into the puddle: warm sunset band at the
  // top, dark water below, dark vertical streaks for reflected containers,
  // and a bright sun glint. The uniform orange env map alone blends into
  // the ground, so the reflection has to be visible in the texture itself.
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#d97f38');
  grad.addColorStop(0.3, '#96502a');
  grad.addColorStop(0.55, '#22303e');
  grad.addColorStop(1, '#0c141d');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = 'rgba(10,14,18,0.55)';
    const x = 20 + i * 38 + Math.random() * 10;
    g.fillRect(x, 90, 14 + Math.random() * 12, 166);
  }
  g.fillStyle = 'rgba(255,230,170,0.85)';
  g.beginPath(); g.ellipse(128, 66, 30, 8, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 84, 256, 3);
  const t = new THREE.CanvasTexture(c);
  return t;
}
function sunTexture() {
  // Soft sun: bright core fading to transparent, no hard disc edge.
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,244,214,1)');
  grad.addColorStop(0.22, 'rgba(255,216,150,0.95)');
  grad.addColorStop(0.5, 'rgba(255,140,46,0.45)');
  grad.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function buildMap(scene, renderer) {
  const colliders = [];
  const spawnPoints = [];
  const sun = new THREE.DirectionalLight(0xffa04e, 2.2);
  sun.position.set(-60, 26, -80); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 220; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffb37a, 0x2c2620, 0.85); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x7a86b8, 0.35); fill.position.set(40, 30, 60); scene.add(fill);
  scene.fog = new THREE.Fog(0xd97b3f, 55, 190);
  scene.background = new THREE.Color(0x2a1a12);

  // Sky dome: gradient sphere with a glowing sun, horizon haze, and slow
  // procedural clouds, back side. The sun disc mesh sits at the same
  // direction, so the glow and the disc read as one sun.
  const skyGeo = new THREE.SphereGeometry(300, 24, 16);
  const skyUniforms = {
    top: { value: new THREE.Color(0x2e2a55) },
    mid: { value: new THREE.Color(0xe07b2e) },
    low: { value: new THREE.Color(0x3a1f16) },
    sunDir: { value: new THREE.Vector3(-150, 34, -230).normalize() },
    uTime: { value: 0 },
  };
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: skyUniforms,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; uniform float uTime;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(low, mid, smoothstep(-0.08, 0.12, h));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.0, 0.55, 0.18) * pow(s, 6.0) * 0.55;
        c += vec3(1.0, 0.9, 0.65) * pow(s, 48.0) * 0.9;
        c = mix(c, vec3(0.98, 0.62, 0.38), (1.0 - abs(h)) * 0.25 * smoothstep(0.25, 0.0, abs(h)));
        if (h > 0.04 && h < 0.62) {
          float n = noise(d * vec3(3.0, 6.0, 3.0) + vec3(uTime * 0.008, 0.0, uTime * 0.004));
          n = n * 0.6 + noise(d * vec3(7.0, 12.0, 7.0)) * 0.4;
          float cl = smoothstep(0.58, 0.82, n) * smoothstep(0.04, 0.18, h) * (1.0 - smoothstep(0.4, 0.62, h));
          vec3 cloudCol = mix(vec3(0.55, 0.35, 0.42), vec3(1.0, 0.72, 0.45), clamp(s * 1.4, 0.0, 1.0));
          c = mix(c, cloudCol, cl * 0.55);
        }
        gl_FragColor = vec4(c, 1.0);
      }` });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);
  // Low sun disc with a soft gradient glow, not a hard white circle.
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false }));
  sunDisc.position.set(-150, 34, -230); sunDisc.lookAt(0, 10, 0); scene.add(sunDisc);

  // Environment map for restrained reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xcc6a2a);
  const envMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 8, 8), new THREE.MeshBasicMaterial({ color: 0xcc6a2a, side: THREE.BackSide }));
  envScene.add(envMesh);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;

  // Ground: damp sheen after the drizzle, not bone dry concrete. The yard
  // ends at z = -38 so the harbor water beyond it is actually visible;
  // the old 220 long slab covered the water plane and hid the whole harbor.
  const gTex = concreteTexture(); gTex.repeat.set(10, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 148), new THREE.MeshStandardMaterial({ map: gTex, roughness: 0.6, metalness: 0.12, envMapIntensity: 0.55 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = 36; ground.receiveShadow = true; scene.add(ground);
  // Quay edge: low concrete curb flush with the yard, so the water beyond
  // it is visible instead of hiding behind a wall. The old 1.6 m wall
  // blocked the near water from eye height.
  const quayMat = new THREE.MeshStandardMaterial({ color: 0x6a655c, roughness: 0.8, metalness: 0.1 });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(220, 0.7, 2), quayMat);
  quay.position.set(0, -0.35, -38); quay.castShadow = true; scene.add(quay);
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.6, metalness: 0.5 });
  for (let x = -100; x <= 100; x += 20) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 10), bollardMat);
    b.position.set(x, 0.45, -37); b.castShadow = true; scene.add(b);
  }

  // Puddles. Painted sky reflection plus gloss, with a pale rim so the
  // water edge reads against the concrete. Material values alone did not
  // read as water because the env reflection was the same orange as the
  // ground.
  const puddleMat = new THREE.MeshStandardMaterial({ map: puddleTexture(), color: 0xffffff, roughness: 0.08, metalness: 0.85, envMapIntensity: 1.1 });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xd8e2ea, transparent: true, opacity: 0.18, depthWrite: false });
  const puddles = [];
  const puddleSpots = [[8, -6, 5], [-14, 10, 4], [20, 14, 6], [-4, -20, 4.5], [28, -12, 3.5], [-26, -8, 5], [-8, 26, 3], [-18, 24, 3]];
  for (const [x, z, r] of puddleSpots) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 24), puddleMat);
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.02, z); p.scale.x = 1.4; p.receiveShadow = true; scene.add(p); puddles.push(p);
    const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.97, r * 1.06, 24), rimMat);
    rim.rotation.x = -Math.PI / 2; rim.position.set(x, 0.025, z); rim.scale.x = 1.4; scene.add(rim);
  }

  // Containers.
  const palette = [['#8a3a26', '90,40,20'], ['#2e6f6a', '30,60,50'], ['#31597f', '30,50,80'], ['#a8762a', '120,80,20'], ['#5d6b54', '50,60,40'], ['#7a2e3d', '90,30,40']];
  const boxGeo = new THREE.BoxGeometry(6.1, 2.6, 2.5);
  function addContainer(x, z, y, rotY, ci) {
    const [base, rust] = palette[ci % palette.length];
    const m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ map: containerTexture(base, rust), roughness: 0.75, metalness: 0.35, envMapIntensity: 0.4 }));
    m.position.set(x, y, z); m.rotation.y = rotY; m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const hw = rotY === 0 ? 3.05 : 1.25, hd = rotY === 0 ? 1.25 : 3.05;
    colliders.push({ x, z, hx: hw, hz: hd, h: y + 1.3 });
    return m;
  }
  const stacks = [
    [-18, -14, 0, 0], [-18, -14, 2.6, 0], [-11, -16, 0, 0], [14, -18, 0, 0], [14, -18, 2.6, 0], [20, -18, 0, 0],
    [-28, 4, 0, 1], [-28, 4, 2.6, 1], [24, 6, 0, 1], [24, 6, 2.6, 1], [24, 6, 5.2, 1],
    [-8, 18, 0, 0], [-2, 18, 0, 0], [8, 22, 0, 0], [30, -2, 0, 1], [-34, -18, 0, 0], [-34, -18, 2.6, 0],
    [4, -28, 0, 0], [10, -28, 0, 0], [-14, 28, 0, 0], [18, 28, 0, 0], [34, 16, 0, 1], [-36, 14, 0, 1],
  ];
  stacks.forEach((s, i) => addContainer(s[0], s[1], s[2] + 1.3, s[3] ? Math.PI / 2 : 0, i));
  // A few single containers as low cover.
  addContainer(-6, -8, 1.3, 0, 2); addContainer(10, 2, 1.3, Math.PI / 2, 4); addContainer(-2, 8, 1.3, 0, 1); addContainer(16, -6, 1.3, 0, 0);

  // Gantry crane spanning the yard at z = -32.
  const craneMat = new THREE.MeshStandardMaterial({ color: 0x8c8578, roughness: 0.6, metalness: 0.6, envMapIntensity: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.7, metalness: 0.5 });
  function beam(w, h, d, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || craneMat); m.position.set(x, y, z); m.castShadow = true; scene.add(m); return m; }
  beam(2, 22, 2, -24, 11, -32); beam(2, 22, 2, 24, 11, -32);
  beam(2, 22, 2, -24, 11, -26); beam(2, 22, 2, 24, 11, -26);
  beam(52, 2.5, 3, 0, 22, -32); beam(52, 1.2, 1.2, 0, 19.5, -29.5);
  beam(6, 3, 4, -6, 20.4, -32, darkMat); // trolley
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 10, 6), darkMat); cable.position.set(-6, 14, -32); scene.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), new THREE.MeshStandardMaterial({ color: 0xb8641e, roughness: 0.55, metalness: 0.6 }));
  hook.position.set(-6, 8.6, -32); hook.castShadow = true; scene.add(hook);
  colliders.push({ x: -24, z: -32, hx: 1.4, hz: 1.4, h: 22 }); colliders.push({ x: 24, z: -32, hx: 1.4, hz: 1.4, h: 22 });
  colliders.push({ x: -24, z: -26, hx: 1.4, hz: 1.4, h: 22 }); colliders.push({ x: 24, z: -26, hx: 1.4, hz: 1.4, h: 22 });

  // Reach stacker as cover near center.
  const rs = new THREE.Group();
  const rsBody = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 2.6), new THREE.MeshStandardMaterial({ color: 0xc78a1e, roughness: 0.55, metalness: 0.45, envMapIntensity: 0.4 }));
  rsBody.position.y = 1.6; rsBody.castShadow = true; rs.add(rsBody);
  const rsCab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 2), new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.3, metalness: 0.6 }));
  rsCab.position.set(-1.2, 3.2, 0); rsCab.castShadow = true; rs.add(rsCab);
  const rsMast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.5, 0.6), darkMat); rsMast.position.set(2.4, 3.4, 0); rsMast.rotation.z = -0.5; rs.add(rsMast);
  const wheelGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.5, 14);
  [[-1.7, 0.75, 1.2], [-1.7, 0.75, -1.2], [1.7, 0.75, 1.2], [1.7, 0.75, -1.2]].forEach(([x, y, z]) => { const w = new THREE.Mesh(wheelGeo, darkMat); w.rotation.x = Math.PI / 2; w.position.set(x, y, z); rs.add(w); });
  rs.position.set(-10, 0, -2); rs.rotation.y = 0.5; scene.add(rs);
  colliders.push({ x: -10, z: -2, hx: 3, hz: 2.4, h: 4 });

  // Harbor: water, ships, distant cranes to the north (negative z beyond the fence).
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 100), new THREE.MeshStandardMaterial({ color: 0x35465e, roughness: 0.12, metalness: 0.8, envMapIntensity: 1.0 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.15, -90); scene.add(water);
  const shipMat = new THREE.MeshStandardMaterial({ color: 0x1e2a33, roughness: 0.6, metalness: 0.5 });
  [[-70, -78, 0.3], [30, -86, -0.2], [95, -76, 0.15]].forEach(([x, z, r]) => {
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(42, 6, 10), shipMat); hull.position.y = 2; ship.add(hull);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.6 })); bridge.position.set(14, 9, 0); ship.add(bridge);
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: palette[i % palette.length][0], roughness: 0.75 })); c.position.set(-14 + i * 6.5, 6.4, 0); c.scale.set(0.9, 0.8, 0.9); ship.add(c); }
    ship.position.set(x, 0, z); ship.rotation.y = r; ship.scale.setScalar(1.25); scene.add(ship);
  });
  for (let i = 0; i < 4; i++) {
    const dc = new THREE.Group();
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 26, 1.5), darkMat); l1.position.set(-8, 13, 0); dc.add(l1);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 26, 1.5), darkMat); l2.position.set(8, 13, 0); dc.add(l2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(22, 2, 2), darkMat); top.position.set(0, 26, 0); dc.add(top);
    dc.position.set(-90 + i * 60, 0, -80); dc.scale.setScalar(1.35); scene.add(dc);
  }
  // Perimeter fence posts south and east.
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x4a4a48, roughness: 0.8, metalness: 0.4 });
  for (let x = -40; x <= 40; x += 8) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), fenceMat); p.position.set(x, 1.5, 38); scene.add(p); }
  const fenceRail = new THREE.Mesh(new THREE.BoxGeometry(84, 0.2, 0.2), fenceMat); fenceRail.position.set(0, 2.8, 38); scene.add(fenceRail);

  // Rain: elongated falling streaks as line segments, not dots or squares.
  // Each drop is a short slanted line; 450 of them recycle around the player.
  const dropCount = 450;
  const dropGeo = new THREE.BufferGeometry();
  const dropPos = new Float32Array(dropCount * 6);
  const dropTop = new Float32Array(dropCount * 3);
  for (let i = 0; i < dropCount; i++) {
    dropTop[i * 3] = (Math.random() - 0.5) * 90;
    dropTop[i * 3 + 1] = Math.random() * 28;
    dropTop[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  function writeStreaks() {
    for (let i = 0; i < dropCount; i++) {
      const x = dropTop[i * 3], y = dropTop[i * 3 + 1], z = dropTop[i * 3 + 2];
      dropPos[i * 6] = x; dropPos[i * 6 + 1] = y; dropPos[i * 6 + 2] = z;
      dropPos[i * 6 + 3] = x + 0.07; dropPos[i * 6 + 4] = y - 0.55; dropPos[i * 6 + 5] = z + 0.02;
    }
    dropGeo.attributes.position.needsUpdate = true;
  }
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  writeStreaks();
  const drizzle = new THREE.LineSegments(dropGeo, new THREE.LineBasicMaterial({ color: 0xbdd2e8, transparent: true, opacity: 0.4 }));
  scene.add(drizzle);

  // Spawn points around the yard edges.
  [[-30, -24], [30, -24], [-32, 18], [32, 20], [0, -34], [-36, -6], [36, -10], [0, 34], [-20, 30], [22, 30], [-8, -30], [14, -30]].forEach(([x, z]) => spawnPoints.push(new THREE.Vector3(x, 0, z)));

  // Yard boundary for clamping.
  const bounds = { minX: -38, maxX: 38, minZ: -36, maxZ: 36 };
  return { colliders, spawnPoints, bounds, update(dt, playerPos) {
    skyUniforms.uTime.value += dt;
    for (let i = 0; i < dropCount; i++) {
      dropTop[i * 3 + 1] -= dt * 22;
      dropTop[i * 3] += dt * 1.6;
      if (dropTop[i * 3 + 1] < 0) {
        dropTop[i * 3 + 1] = 26 + Math.random() * 4;
        dropTop[i * 3] = playerPos.x + (Math.random() - 0.5) * 90;
        dropTop[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 90;
      }
    }
    writeStreaks();
  } };
}
