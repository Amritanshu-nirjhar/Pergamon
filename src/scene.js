import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import postFrag from './shaders/post.frag?raw';
import backdropFrag from './shaders/backdrop.frag?raw';
import {BOOKS, CHAPTERS} from './books.js';
import {H as CH_H, paintCover, paintSpine, paintBack, paintTitlePage, edgeCanvas, endpaperCanvas} from './covers.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = u => u * u * (3 - 2 * u);

const N = BOOKS.length, R = 5, FRONT = R + 1.4;
const FMT = {hc: [1.6, 2.35], pb: [1.45, 2.2], tall: [1.5, 2.55], small: [1.3, 1.9], wide: [1.9, 2.25]};
const BASE = new THREE.Color('#0b0a09'), HERO_GLOW = new THREE.Color('#2b2219');

// Each room arranges its books differently; the active book (d = 0) always lands at FRONT.
const FORM = {
  helix(b, d, pop, p, e) {
    const th = d * .5, r = R + pop * 1.4;
    p.set(Math.sin(th) * r, -d * 1.3, Math.cos(th) * r);
    e.set(0, th + d * .3, 0);
  },
  ring(b, d, pop, p, e) {
    const n = CHAPTERS[b.c].size, dw = ((d % n) + n * 1.5) % n - n / 2, th = dw * Math.PI * 2 / n, rr = 4.2;
    p.set(Math.sin(th) * rr, (1 - Math.cos(th)) * 1.1, R - rr + Math.cos(th) * rr + pop * 1.4 - (1 - pop) * 1.5);
    e.set(0, th, 0);
  },
  tunnel(b, d, pop, p, e) {
    const side = b.i % 2 ? 1 : -1, k = Math.min(1, Math.abs(d));
    p.set(side * (d > 0 ? 3.2 : 4.5) * k, Math.sin(b.i * 1.7) * 1.4 * k, FRONT - d * (d > 0 ? 6 : 8.5)); // passed books fly behind the camera
    e.set(Math.sin(b.i) * .15 * k, -side * .55 * k, Math.sin(b.i * 2.3) * .25 * k);
  },
  stack(b, d, pop, p, e, cumF) {
    // a pile lying flat, spines facing out; the active book is pulled out and stood up
    const tx = 2.6 + Math.sin(b.i * 3.3) * .12, ty = -(cum[b.i] - cumF) * 1.02, tz = R - 4.5;
    p.set(tx * (1 - pop), ty * (1 - pop), tz + (FRONT - tz) * pop);
    e.set(-Math.PI / 2 * (1 - pop), (Math.PI / 2 + Math.sin(b.i * 7.1) * .18) * (1 - pop), 0);
  },
};
const cum = [];

// The galaxy every book returns to between rooms
function park(i, t, sw, p, e, away, intro) {
  // while a room is open the galaxy backs off into the fog so it never crowds the active books
  const rr = (3 + i / N * 10.5) * (1 + away * 1.8), a = (i % 3) * 2.094 + rr * .45 + sw, y = Math.sin(i * 12.9) * .7;
  const x = Math.cos(a) * rr, z = Math.sin(a) * rr, tilt = .45;
  p.set(x, y * Math.cos(tilt) - z * Math.sin(tilt) - 1, y * Math.sin(tilt) + z * Math.cos(tilt) - 2 - away * 30);
  if (intro < 1) { p.multiplyScalar(1 + (1 - intro) * 2.5); p.z -= (1 - intro) * 40 } // fly in from deep space
  e.set(t * .2 + i + (1 - intro) * 6, t * .13 + i * 2, i * .5);
}

// `lite` (phones, or ?lite) drops shadows, bloom and the costlier materials so the scroll stays fluid
export async function createScene(canvas, onProgress, {lite = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  let dpr = Math.min(devicePixelRatio, lite ? 1.25 : 1.5), slow = 0;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps cover colours true to their design
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BASE.clone(), 14, 38);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .55;

  const camera = new THREE.PerspectiveCamera(35, 1, .1, 200);
  const key = new THREE.DirectionalLight('#fff1dc', 1.9); key.position.set(4, 6, 9);
  key.castShadow = !lite;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40});
  key.shadow.bias = -.0004; key.shadow.normalBias = .02;
  const rim = new THREE.DirectionalLight(CHAPTERS[0].mood, 3); rim.position.set(-6, 3, -6);
  scene.add(key, rim, new THREE.AmbientLight('#ffffff', .15));

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (c, srgb = true) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };
  const endT = tex(endpaperCanvas()); endT.wrapS = endT.wrapT = THREE.RepeatWrapping; endT.repeat.set(7, 10);
  const edgeTex = (srgb, top) => {
    const t = tex(edgeCanvas(), srgb);
    if (top) { t.center.set(.5, .5); t.rotation = Math.PI / 2 }
    return t;
  };
  const edgeMap = [edgeTex(true, false), edgeTex(true, true)], edgeBump = [edgeTex(false, false), edgeTex(false, true)];
  const paper = new THREE.MeshStandardMaterial({color: '#e9e1cf', roughness: .95});
  const gilt = [0, 1].map(k => new THREE.MeshStandardMaterial({color: '#d2ac58', metalness: .9, roughness: .32, bumpMap: edgeBump[k], bumpScale: .6}));
  const FIN = {
    matte: {roughness: .78},
    gloss: {roughness: .32, clearcoat: 1, clearcoatRoughness: .08},
    foil: {roughness: .5, sheen: .5, sheenRoughness: .8, sheenColor: '#777'},
    cloth: {roughness: .92, sheen: 1, sheenRoughness: .7, sheenColor: '#888'},
  };

  function makeBook(b) {
    const [w, h] = FMT[b.fmt], hard = b.fmt !== 'pb', bt = hard ? .045 : .014, ov = hard ? .05 : 0;
    const dep = .1 + b.p / 1700 + 2 * bt;
    // hardcovers get a rounded spine; `joint` is where the boards meet it
    const bulge = hard ? Math.min(.13, dep * .32) : 0, joint = hard ? bulge : bt;
    const arc = hard ? Math.PI * Math.sqrt((bulge ** 2 + (dep / 2) ** 2) / 2) : dep;
    const sw = clamp(Math.round(CH_H * arc / h), 40, 320);
    const fin = lite ? {roughness: FIN[b.fx].roughness} : FIN[b.fx];
    const skin = ({map, metal, bump}) => new (lite ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial)({
      map: tex(map), metalnessMap: metal && tex(metal, false), metalness: metal ? 1 : 0,
      bumpMap: bump && tex(bump, false), bumpScale: b.fx === 'cloth' ? 2 : 1.4, ...fin,
    });
    const edge = new THREE.MeshStandardMaterial({color: b.bg, roughness: .7});
    const endp = new THREE.MeshStandardMaterial({map: endT, color: new THREE.Color(b.acc).lerp(new THREE.Color('#fff'), .35), roughness: .9});
    const aged = parseInt(b.y.replace(/^\D+/, '')) < 1900 || b.y.includes('BCE');
    const pages = b.fx === 'foil' ? gilt : [0, 1].map(k => new THREE.MeshStandardMaterial({
      map: edgeMap[k], bumpMap: edgeBump[k], bumpScale: .5, roughness: .9, color: aged ? '#efdcb4' : '#fffaf0',
    }));
    const titleMat = paper.clone();
    const board = (bw) => new RoundedBoxGeometry(bw, h, bt, 2, Math.min(.012, bt * .45));

    const root = new THREE.Group(), body = new THREE.Group(), pivot = new THREE.Group();
    // box faces: +x, -x, +y, -y, +z, -z
    const block = new THREE.Mesh(new RoundedBoxGeometry(w - joint - ov, h - 2 * ov - .01, dep - 2 * bt - .004, 2, .006),
      [pages[0], paper, pages[1], pages[1], titleMat, paper]);
    block.position.x = (joint - ov) / 2;
    const spineSkin = skin(paintSpine(b, sw));
    let spine;
    if (hard) {
      const g = new THREE.CylinderGeometry(1, 1, h, 32, 1, false, Math.PI, Math.PI); // half-cylinder facing -x
      g.scale(bulge, 1, dep / 2);
      spine = new THREE.Mesh(g, [spineSkin, edge, edge]);
      spine.position.x = -w / 2 + bulge;
    } else {
      spine = new THREE.Mesh(new THREE.BoxGeometry(bt, h, dep), [edge, spineSkin, edge, edge, edge, edge]);
      spine.position.x = -w / 2 + bt / 2;
    }
    const cover = paintCover(b);
    const front = new THREE.Mesh(board(w - joint), [edge, edge, edge, edge, skin(cover), endp]);
    front.position.x = (w - joint) / 2;
    pivot.position.set(-w / 2 + joint, 0, dep / 2 - bt / 2);
    pivot.add(front);
    const backB = new THREE.Mesh(board(w - joint), [edge, edge, edge, edge, endp, skin(paintBack(b))]);
    backB.position.set(joint / 2, 0, -dep / 2 + bt / 2);
    body.add(block, spine, pivot, backB);
    if (hard && (b.fx === 'foil' || b.fx === 'cloth')) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(.045, .6, .004),
        new THREE.MeshPhysicalMaterial({color: b.fx === 'foil' ? '#8c1c24' : b.acc, roughness: .5, sheen: 1, sheenColor: '#fff'}));
      ribbon.position.set(w * .12, -h / 2 + ov - .22, dep / 2 - bt - .006);
      ribbon.rotation.z = .07;
      body.add(ribbon);
    }
    root.add(body);
    root.traverse(o => { o.userData.i = b.i; o.castShadow = o.receiveShadow = !lite });
    scene.add(root);
    return {root, body, pivot, titleMat, cover: cover.map, w, dep, wt: 0, o: 0, page: false};
  }

  const BK = [];
  for (const b of BOOKS) {
    BK.push(makeBook(b));
    onProgress(BK.length);
    await new Promise(requestAnimationFrame);
  }
  BK.reduce((acc, bk, i) => (cum[i] = acc + bk.dep / 2, acc + bk.dep), 0);
  const colors = BOOKS.map(b => new THREE.Color(b.acc));
  const moods = CHAPTERS.map(c => new THREE.Color(c.mood));

  const dust = (() => {
    const p = new Float32Array((lite ? 600 : 1800) * 3);
    for (let i = 0; i < p.length; i++) p[i] = (Math.random() - .5) * 70;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({size: .05, color: '#e9dcc0', transparent: true, opacity: .55, depthWrite: false}));
  })();
  scene.add(dust);

  // full-screen backdrop drawn first, behind everything
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false,
    uniforms: {uBase: {value: BASE.clone()}, uGlow: {value: HERO_GLOW.clone()}, uCenter: {value: new THREE.Vector2(.5, .5)}, uRes: {value: new THREE.Vector2(1, 1)}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }',
    fragmentShader: backdropFrag,
  }));
  backdrop.frustumCulled = false; backdrop.renderOrder = -1;
  scene.add(backdrop);
  const bd = backdrop.material.uniforms;
  const pal = CHAPTERS.map(c => [new THREE.Color(c.base), new THREE.Color(c.glow)]);

  // MSAA render target: the composer would otherwise drop the canvas antialiasing
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, {samples: lite ? 2 : 4, type: THREE.HalfFloatType}));
  composer.addPass(new RenderPass(scene, camera));
  if (!lite) composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .28, .5, 1.1));
  const post = new ShaderPass({
    uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uVel: {value: 0}, uRes: {value: new THREE.Vector2(1, 1)}, uRoom: {value: 0}, uPh: {value: 0}, uTr: {value: 0}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: postFrag,
  });
  composer.addPass(post);
  composer.addPass(new OutputPass());

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h;
    post.uniforms.uRes.value.set(w, h);
    bd.uRes.value.set(w, h);
  }
  addEventListener('resize', resize); resize();

  const hp = new THREE.Vector3(), pp = new THREE.Vector3(), he = new THREE.Euler(0, 0, 0, 'YXZ'), pe = new THREE.Euler();
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), baseT = new THREE.Color(), glowT = new THREE.Color(), accT = new THREE.Color();
  const ray = new THREE.Raycaster(), roots = BK.map(b => b.root);
  let cmx = 0, cmy = 0, cloud = 1, last = 0, swirl = 0;

  return {
    cover: i => BK[i].cover, // the painted cover canvas, reused by the library grid
    pick(ndc) {
      ray.setFromCamera(ndc, camera);
      for (const hit of ray.intersectObjects(roots, true)) {
        const i = hit.object.userData.i;
        if (cloud > .5 || BK[i].wt > .5) return i;
      }
      return -1;
    },
    ensurePage(i) {
      const bk = BK[i];
      if (bk.page) return;
      bk.titleMat.map = tex(paintTitlePage(BOOKS[i])); bk.titleMat.color.set('#d9d1c0'); bk.titleMat.needsUpdate = true; bk.page = true;
    },
    update(s) {
      const {t, f, chap, idx, open, w, h} = s, desk = w > 900;
      cloud = s.cloud;
      // frame-rate independent easing: `ease(.05)` behaves like a 5%-per-frame lerp at 60fps
      const dt = Math.min(s.now - (last || s.now), .1), ease = r => 1 - Math.pow(1 - r, dt * 60);
      last = s.now;
      // adaptive resolution: if frames keep running long, trade pixel density for fluid motion
      slow = slow * .97 + (dt > 1 / 48 ? .03 : 0);
      if (slow > .5 && dpr > 1) { dpr = Math.max(1, dpr - .25); slow = 0; renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); resize() }
      // scroll speed drives the motion: the galaxy spins up, books bank into the turn, the lens widens
      const spin = s.spin || 0, aspin = Math.min(Math.abs(spin), 4);
      swirl += dt * (.035 + aspin * .12);
      cmx += (s.mx - cmx) * ease(.05); cmy += (s.my - cmy) * ease(.05);
      const fl = Math.floor(f), cumF = cum[fl] + (cum[Math.min(fl + 1, N - 1)] - cum[fl]) * (f - fl);

      BK.forEach((bk, i) => {
        const b = BOOKS[i], d = i - f, pop = Math.max(0, 1 - Math.abs(d));
        bk.wt += ((1 - cloud) * (b.c === chap ? 1 : 0) - bk.wt) * (s.reduce ? 1 : ease(.07));
        bk.o += ((open && i === idx ? 1 : 0) - bk.o) * ease(.08);
        FORM[CHAPTERS[b.c].form](b, d, pop, hp, he, cumF);
        he.y += Math.sin(t * .8 + i) * .06 * pop * (1 - bk.o);
        he.x += Math.sin(t * .6 + i) * .03;
        he.y += cmx * .28 * pop * (1 - bk.o); he.x += cmy * .14 * pop; // the active book leans toward the cursor
        he.z += spin * .05 * (1 - bk.o); he.x -= spin * .035 * (1 - bk.o);
        park(i, t, swirl, pp, pe, 1 - cloud, s.intro);
        qa.setFromEuler(he); qb.setFromEuler(pe);
        bk.root.position.lerpVectors(pp, hp, bk.wt);
        bk.root.quaternion.slerpQuaternions(qb, qa, bk.wt);
        // parked books shrink away while a room is open instead of hanging around as silhouettes
        const sc = cloud + (1 + pop * .2 - cloud) * bk.wt;
        bk.root.scale.setScalar(Math.max(sc, 1e-3)); bk.root.visible = sc > .01;
        const eo = smooth(bk.o);
        bk.pivot.rotation.y = -eo * Math.PI * .95;
        bk.body.position.x = eo * bk.w * .5;
      });

      const oo = smooth(BK[idx].o);
      const iv = 1 - s.intro, hero = s.hero || 0;
      camera.position.set(cmx * 1.1, -cmy * .7 + cloud * 3.5, (desk ? 14 : 17.5) + cloud * 5 + oo * (desk ? .6 : 3) + iv * 6);
      camera.lookAt(0, -cloud * .8, 0);
      camera.rotateZ(spin * .012 + iv * .3); // a slow roll as the intro swoops in, a slight bank when scrolling fast
      camera.fov = 35 + aspin * 1.3 + iv * 14;
      // on the hero the galaxy drifts right/up, leaving the headline and buttons a clear field
      camera.setViewOffset(w, h, desk ? -w * (.17 - .07 * cloud + .1 * hero) : 0, desk ? 0 : h * (.17 * (1 - cloud) + .12 * hero), w, h);
      camera.updateProjectionMatrix();

      rim.color.lerp(moods[chap], ease(.05));
      baseT.copy(BASE).lerp(pal[chap][0], 1 - cloud);
      // mix in sRGB: in linear space even a small share of a bright accent swamps the dark room glow
      accT.copy(colors[idx]).convertLinearToSRGB();
      glowT.copy(HERO_GLOW).lerp(pal[chap][1], 1 - cloud).convertLinearToSRGB().lerp(accT, .08 * (1 - cloud)).convertSRGBToLinear();
      bd.uBase.value.lerp(baseT, ease(.05)); bd.uGlow.value.lerp(glowT, ease(.05));
      bd.uCenter.value.set(desk ? .5 + .17 * (1 - cloud) + .1 * (s.hero || 0) : .5, desk ? .52 : .5 + .17 * (1 - cloud));
      scene.fog.color.copy(bd.uBase.value);
      dust.rotation.y = t * .015; dust.position.y = f * .25;

      post.uniforms.uTime.value = t; post.uniforms.uVel.value = s.vel;
      post.uniforms.uRoom.value = s.room ?? 0; post.uniforms.uPh.value = s.ph ?? 0; post.uniforms.uTr.value = s.tr ?? 0;
      composer.render();
    },
  };
}
