import { BACK_HALF_X, BACK_HALF_Y, DIAL_HALF_X, DIAL_HALF_Y } from '../dial';

export const vertexSource = (flat: boolean) => /* glsl */ `#version 300 es
${flat ? '#define FLAT' : ''}
in vec3 position;
#ifndef FLAT
in vec3 normal;
in vec2 uv;
#endif
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out vec2 vUv;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vLocal = position;
#ifdef FLAT
  vNormal = vec3(0.0, 0.0, 1.0);
  vUv = vec2(0.0);
#else
  vNormal = mat3(modelMatrix) * normal;
  vUv = uv;
#endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** MODE: 0 metal, 1 leather, 2 dial, 3 sapphire glass, 4 engraved case back. */
export const fragmentSource = (mode: 0 | 1 | 2 | 3 | 4, flat: boolean) => /* glsl */ `#version 300 es
precision highp float;
${flat ? '#define FLAT' : ''}
#define MODE ${mode}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in vec2 vUv;
out vec4 outColor;
uniform vec3 cameraPosition;
uniform vec3 uAlbedo;
uniform vec3 uF0;
uniform float uRough;
uniform float uPhase;
uniform float uSprocket;
#if MODE == 2
uniform sampler2D tDial;
#endif
#if MODE == 4
uniform sampler2D tBack;
#endif

float softbox(vec3 d, vec3 axis, vec2 size, float soft) {
  float z = dot(d, axis);
  if (z < 0.02) return 0.0;
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), axis));
  vec3 up = cross(axis, right);
  vec2 p = vec2(dot(d, right), dot(d, up)) / z;
  vec2 q = abs(p) - size;
  return 1.0 - smoothstep(-soft, soft, max(q.x, q.y));
}

// A small photo studio: a big key softbox, a tall strip, a purple fill and a rim.
vec3 studio(vec3 d, float rough) {
  float soft = 0.04 + rough * 1.1;
  vec3 c = mix(vec3(0.03, 0.02, 0.05), vec3(0.2, 0.18, 0.3), smoothstep(-0.7, 0.9, d.y));
  c += vec3(1.0, 0.96, 0.9) * 2.6 * softbox(d, normalize(vec3(-0.5, 0.75, 0.6)), vec2(0.75, 0.5), soft);
  c += vec3(0.85, 0.9, 1.0) * 2.0 * softbox(d, normalize(vec3(0.95, 0.15, 0.3)), vec2(0.14, 0.95), soft);
  c += vec3(0.9, 0.6, 1.0) * 1.6 * softbox(d, normalize(vec3(-0.85, -0.25, 0.45)), vec2(0.35, 0.5), soft);
  c += vec3(1.0, 0.92, 0.8) * 1.4 * softbox(d, normalize(vec3(0.1, 0.3, -0.95)), vec2(0.9, 0.2), soft);
  return mix(c, vec3(0.35, 0.33, 0.42), clamp(rough * 0.7, 0.0, 0.8));
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
#ifdef FLAT
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
#else
  vec3 n = normalize(vNormal);
#endif
  vec3 v = normalize(cameraPosition - vWorld);
  n = faceforward(n, -v, n);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  vec3 r = reflect(-v, n);
  vec3 keyDir = normalize(vec3(-0.4, 0.8, 0.6));
  float key = max(dot(n, keyDir), 0.0);

#if MODE == 0
  vec3 fresnel = uF0 + (1.0 - uF0) * pow(1.0 - ndv, 5.0);
  vec3 col = studio(r, uRough) * fresnel + uAlbedo * 0.03;
  // Film-sprocket notches on the bezel's flat top.
  float hole = uSprocket * step(abs(fract(vUv.x * 88.0) - 0.5), 0.2) * step(abs(vUv.y - 0.417), 0.05);
  col = mix(col, vec3(0.02, 0.01, 0.03), hole * 0.9);
  outColor = vec4(pow(aces(col * 0.75), vec3(1.0 / 2.2)), 1.0);
#elif MODE == 1
  float grain = hash(floor(vLocal * 90.0));
  vec3 base = uAlbedo * (0.75 + 0.4 * grain);
  vec3 col = base * (0.14 + 0.85 * key);
  col += studio(r, 0.6) * 0.07;
  col += vec3(0.55, 0.35, 0.9) * pow(1.0 - ndv, 3.0) * 0.12;
  float line = min(abs(vUv.x - 0.14), abs(vUv.x - 0.36));
  float dash = step(0.5, fract(vUv.y * 38.0));
  float stitch = smoothstep(0.006, 0.0, line) * dash;
  col = mix(col, vec3(0.84, 0.74, 0.54), stitch * 0.9);
  outColor = vec4(pow(aces(col), vec3(1.0 / 2.2)), 1.0);
#elif MODE == 2
  vec2 uvd = vec2(vLocal.x / ${DIAL_HALF_X.toFixed(4)} * 0.5 + 0.5, vLocal.y / ${DIAL_HALF_Y.toFixed(4)} * 0.5 + 0.5);
  vec3 tex = pow(texture(tDial, uvd).rgb, vec3(2.2));
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 col = tex * (0.34 + 0.34 * key) + studio(r, 0.1) * fres * 0.3;
  outColor = vec4(pow(aces(col), vec3(1.0 / 2.2)), 1.0);
#elif MODE == 4
  // Seen from behind, so the engraving is mirrored left to right.
  vec2 uvb = vec2(0.5 - vLocal.x / ${BACK_HALF_X.toFixed(4)} * 0.5, vLocal.y / ${BACK_HALF_Y.toFixed(4)} * 0.5 + 0.5);
  float mask = texture(tBack, uvb).r;
  vec3 f0 = uF0 * mix(0.28, 1.0, mask);
  vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - ndv, 5.0);
  vec3 col = studio(r, mix(0.55, uRough, mask)) * fresnel + uAlbedo * 0.03;
  outColor = vec4(pow(aces(col * 0.75), vec3(1.0 / 2.2)), 1.0);
#else
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  float along = dot(vLocal.xy, vec2(0.6, -0.8));
  float sweep = uPhase * 3.2 - 1.6;
  float streak = smoothstep(0.16, 0.0, abs(along - sweep));
  float streak2 = smoothstep(0.05, 0.0, abs(along - sweep + 0.34));
  vec3 refl = studio(r, 0.02) * fres * 1.6 + vec3(0.92, 0.94, 1.0) * (streak * 0.3 + streak2 * 0.2);
  float a = clamp(0.03 + fres * 1.2 + streak * 0.3 + streak2 * 0.2, 0.0, 0.85);
  outColor = vec4(pow(aces(refl), vec3(1.0 / 2.2)), a);
#endif
}
`;
