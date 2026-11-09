// Gallery backdrop: a soft spotlight behind the active book over the room's base tone.
uniform vec3 uBase;
uniform vec3 uGlow;
uniform vec2 uCenter;
uniform vec2 uRes;
varying vec2 vUv;

void main() {
  vec2 p = vUv - uCenter;
  p.x *= uRes.x / uRes.y;
  float spot = exp(-dot(p, p) * 2.4);
  vec3 col = mix(uBase, uGlow, spot);
  // a faint floor-like band below the spotlight gives the space some depth
  col += uGlow * .12 * smoothstep(.35, 0., abs(vUv.y - uCenter.y + .3)) * (1. - smoothstep(0., .9, abs(p.x)));
  gl_FragColor = vec4(col, 1.);
}
