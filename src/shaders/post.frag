// Final pass: room transitions, scroll-velocity streaks and chromatic aberration, vignette, film grain.
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uVel;
uniform vec2 uRes;
uniform float uRoom; // which room we're entering: 0 helix, 1 ring, 2 tunnel, 3 stack
uniform float uPh;   // -1 → 1 across the room's title card (0 = the card itself)
uniform float uTr;   // 0 → 1 → 0 envelope: only strong while moving between galaxy and room
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }

void main() {
  vec2 c = vUv - .5;
  float asp = uRes.x / uRes.y;
  // room III rides a warp: borrow the speed streaks for its transition
  float vel = uRoom > 1.5 && uRoom < 2.5 ? max(uVel, uTr * .9) : uVel;
  float ab = .0012 + vel * .014;
  vec3 col;
  col.r = texture2D(tDiffuse, vUv + c * ab).r;
  col.g = texture2D(tDiffuse, vUv).g;
  col.b = texture2D(tDiffuse, vUv - c * ab).b;
  // speed streaks: a short radial blur that only appears while scrolling fast
  if (vel > .02) {
    vec3 acc = col;
    for (int i = 1; i <= 5; i++) acc += texture2D(tDiffuse, vUv - c * vel * .035 * float(i) / 5.).rgb;
    col = acc / 6.;
  }

  if (uTr > .001) {
    float k = (uPh + 1.) * .5; // 0 → 1 across the whole passage
    if (uRoom < .5) {
      // I · a band of gold light sweeps across, like sun through a library window
      float pos = vUv.x * .8 + vUv.y * .45, band = exp(-pow((pos - mix(-.35, 1.6, k)) * 5., 2.));
      col += vec3(1., .76, .42) * band * .5 * uTr;
      col *= 1. + .12 * uTr;
    } else if (uRoom < 1.5) {
      // II · ink blooms out of the page and drains away
      float n = fbm(vec2(c.x * asp, c.y) * 3.2 + uTime * .04), cover = uTr * 1.15 - length(c) * .5;
      float ink = smoothstep(n - .06, n + .06, cover), rim = smoothstep(n - .12, n, cover) - ink;
      col = mix(col, vec3(.07, .012, .02), ink * .88);
      col += vec3(.55, .08, .12) * rim * .6;
    } else if (uRoom < 2.5) {
      // III · streaks of light pull past toward a vanishing point
      float a = atan(c.y, c.x), r = length(c * vec2(asp, 1.));
      float lines = pow(hash(vec2(floor(a * 90.), 1.)), 14.) * smoothstep(.12, .7, r);
      float flow = fract(r * 2.5 - uTime * 1.6 + hash(vec2(floor(a * 90.), 3.)));
      col += vec3(.45, .95, 1.) * lines * smoothstep(.0, .3, flow) * (1. - flow) * 2.2 * uTr;
    } else {
      // IV · the screen turns like a page: a crease sweeps across, the folded side in shadow
      float x0 = mix(1.15, -.15, k), d = vUv.x - x0 + (vUv.y - .5) * .12;
      float folded = smoothstep(.0, -.02, d);
      col *= 1. - folded * .45 * uTr;
      col += vec3(1., .95, .85) * exp(-pow(d * 55., 2.)) * .35 * uTr; // highlight on the crease
      col *= 1. - exp(-max(d, 0.) * 9.) * .25 * uTr * (1. - folded); // the page casts a soft shadow ahead
    }
  }

  float v = smoothstep(.95, .25, length(c * vec2(asp, 1.) * .85));
  col *= mix(.5, 1., v);
  col += (hash(vUv * uRes + fract(uTime) * 91.7) - .5) * .03;
  gl_FragColor = vec4(col, 1.);
}
