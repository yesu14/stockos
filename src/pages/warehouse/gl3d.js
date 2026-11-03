// ═══════════════════════════════════════════════════════════
//  상품찾기 — 3D 그리기 엔진 (WebGL2, 외부 라이브러리 없음)
//  박스는 GPU 로 한 번에(인스턴싱) 그리고, 깊이 버퍼로 앞뒤를 정확히 가림 처리함.
//  ID 렌더링(박스마다 고유 색)으로 ① 클릭/마우스 올림 판정 ② 실제로 보이는 박스와 보이는 위치(번호를 붙일 곳)를 알아냄.
// ═══════════════════════════════════════════════════════════
import { hexToRgb, fixtureLen, officeRect } from './whLogic'
import { tierGeom, wallHeight, SPREAD_DEFAULT } from './render3d'
import { viewProjection, basisOf, depthRange } from './cam3d'

// ── 박스 면에 쓰는 번호 글자판 ─────────────────────────────
const GFONT = 'system-ui, -apple-system, "Segoe UI", "Noto Sans KR", "Malgun Gothic", sans-serif'
const G_CW = 60, G_CH = 96, G_COLS = 16, G_MAX = 256, TXT_MAX = 8          // 글자 칸(폭×높이), 한 줄 칸 수, 최대 글자 종류, 박스 하나에 쓸 최대 글자 수
const STRIDE = 19                                                          // 박스 하나의 데이터 수: 위치3 크기3 색4 상태1 + 글자 8
function buildAtlas(chars) {
  const rows = Math.max(1, Math.ceil(chars.length / G_COLS)), cv = document.createElement('canvas'); cv.width = G_COLS * G_CW; cv.height = rows * G_CH
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `800 ${Math.round(G_CH * 0.66)}px ${GFONT}`
  chars.forEach((c, i) => {
    const x = (i % G_COLS) * G_CW + G_CW / 2, y = Math.floor(i / G_COLS) * G_CH + G_CH * 0.78, w = ctx.measureText(c).width
    if (w > G_CW * 0.78) { ctx.save(); ctx.translate(x, y); ctx.scale((G_CW * 0.78) / w, 1); ctx.fillText(c, 0, 0); ctx.restore() } else ctx.fillText(c, x, y)
  })
  return { cv, rows }
}
const LIGHT = (() => { const v = [-0.4, -0.5, 0.77], l = Math.hypot(...v); return v.map(x => x / l) })()
const rgbf = hex => hexToRgb(hex).map(v => v / 255)

// ── 셰이더 ──────────────────────────────────────────────────
const ENV_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNormal; layout(location=2) in vec4 aColor;
uniform mat4 uVP;
out vec3 vN; out vec4 vColor; out vec3 vWorld;
void main() { vN = aNormal; vColor = aColor; vWorld = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`
const ENV_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec4 vColor; in vec3 vWorld;
uniform vec3 uLight; uniform float uGrid; uniform vec3 uGridColor; uniform float uGridAlpha;
out vec4 o;
void main() {
  float s = 0.52 + 0.48 * (0.5 + 0.5 * clamp(dot(normalize(vN), uLight), -1.0, 1.0));
  vec3 col = vColor.rgb * s;
  if (uGrid > 0.5) {
    vec2 fw = max(fwidth(vWorld.xy), vec2(1e-5));
    vec2 g = abs(fract(vWorld.xy - 0.5) - 0.5) / fw;
    float l = 1.0 - min(min(g.x, g.y), 1.0);
    float fade = clamp(1.0 - max(fw.x, fw.y) * 1.6, 0.0, 1.0);
    col = mix(col, uGridColor, l * uGridAlpha * fade);
  }
  o = vec4(col, vColor.a);
}`
const BOX_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNormal; layout(location=2) in vec2 aUv;
layout(location=3) in vec3 iCenter; layout(location=4) in vec3 iSize; layout(location=5) in vec4 iColor; layout(location=6) in float iState;
layout(location=7) in vec4 iC0; layout(location=8) in vec4 iC1;
uniform mat4 uVP; uniform vec3 uEye; uniform vec3 uFwd; uniform float uSecOn; uniform float uSecDist; uniform float uIdBase;
out vec3 vN; out vec2 vUv; out vec4 vColor; out float vState; out vec3 vId; flat out float vIdx;
out vec3 vLocal; out vec3 vHalf; flat out vec4 vC0; flat out vec4 vC1;
void main() {
  vec3 world = iCenter + aPos * iSize;
  float depth = dot(iCenter - uEye, uFwd);
  float idx = uIdBase + float(gl_InstanceID);
  int id = int(idx) + 1;
  vN = aNormal; vUv = aUv; vColor = iColor; vState = iState; vIdx = idx;
  vLocal = aPos * iSize; vHalf = iSize * 0.5; vC0 = iC0; vC1 = iC1;
  vId = vec3(float(id & 255), float((id >> 8) & 255), float((id >> 16) & 255)) / 255.0;
  bool hidden = uSecOn > 0.5 && depth < uSecDist;
  gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : uVP * vec4(world, 1.0);
}`
const BOX_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec2 vUv; in vec4 vColor; in float vState; in vec3 vId; flat in float vIdx;
in vec3 vLocal; in vec3 vHalf; flat in vec4 vC0; flat in vec4 vC1;
uniform vec3 uLight; uniform float uPass; uniform float uTime; uniform float uHover;
uniform sampler2D uGlyph; uniform vec2 uGlyphGrid; uniform float uShowText;
out vec4 o;
// 박스의 한 면(법선 n)의 한가운데에 번호를 그림. 옆면은 위쪽이 위, 윗면은 평면도와 같은 방향(오른쪽=+x, 위쪽=평면도 위), 어느 면에서도 거울처럼 뒤집히지 않음
float faceText(vec3 n) {
  if (uShowText < 0.5) return 0.0;
  float cnt = step(0.0, vC0.x) + step(0.0, vC0.y) + step(0.0, vC0.z) + step(0.0, vC0.w) + step(0.0, vC1.x) + step(0.0, vC1.y) + step(0.0, vC1.z) + step(0.0, vC1.w);
  if (cnt < 0.5) return 0.0;
  vec3 tx, ty;
  if (n.z > 0.5) { tx = vec3(1.0, 0.0, 0.0); ty = vec3(0.0, -1.0, 0.0); }
  else if (n.z < -0.5) { tx = vec3(1.0, 0.0, 0.0); ty = vec3(0.0, 1.0, 0.0); }
  else { tx = vec3(n.y, -n.x, 0.0); ty = vec3(0.0, 0.0, 1.0); }
  vec2 p = vec2(dot(vLocal, tx), dot(vLocal, ty));
  vec2 hf = vec2(dot(abs(tx), vHalf), dot(abs(ty), vHalf));
  const float CA = 0.5, SQ = 0.8;     // 글자 간격(높이 대비) / 글자 칸의 가운데 80% 만 씀 (숫자 사이가 벌어지지 않게)
  float th = min(hf.y * 2.0 * 0.56, hf.x * 2.0 * 0.86 / (cnt * CA));
  float u = p.x / (CA * th) + cnt * 0.5, fy = p.y / th + 0.5, ci = floor(u), fx = u - ci;
  vec2 dx = vec2(dFdx(u), dFdx(fy)), dy = vec2(dFdy(u), dFdy(fy));
  float thPx = th / max(length(vec2(dFdx(p.y), dFdy(p.y))), 1e-6);
  float fade = smoothstep(4.0, 8.0, thPx);       // 글자가 너무 작아 뭉개질 때는 서서히 사라짐 (멀리서 지저분한 점처럼 보이지 않게)
  if (fade <= 0.0) return 0.0;
  int ki = int(clamp(ci, 0.0, cnt - 1.0));
  float gi = ki < 4 ? vC0[ki] : vC1[ki - 4];
  float gc = mod(gi, uGlyphGrid.x), gr = floor(gi / uGlyphGrid.x);
  vec2 uv = vec2((gc + 0.5 + (fx - 0.5) * SQ) / uGlyphGrid.x, (gr + 1.0 - fy) / uGlyphGrid.y);
  vec2 gx = vec2(dx.x * SQ / uGlyphGrid.x, -dx.y / uGlyphGrid.y), gy = vec2(dy.x * SQ / uGlyphGrid.x, -dy.y / uGlyphGrid.y);
  float inside = step(0.0, ci) * step(ci, cnt - 1.0) * step(abs(fy - 0.5), 0.5);
  return textureGrad(uGlyph, uv, gx, gy).a * inside * fade;
}
void main() {
  if (uPass > 0.5) { o = vec4(vId, 1.0); return; }
  float s = 0.52 + 0.48 * (0.5 + 0.5 * clamp(dot(normalize(vN), uLight), -1.0, 1.0));
  vec3 col = vColor.rgb * s;
  vec2 d = min(vUv, 1.0 - vUv); float e = min(d.x, d.y);
  float w = max(fwidth(e) * 1.4, 0.003);
  float line = 1.0 - smoothstep(w * 0.4, w * 1.4, e);
  col = mix(col, col * 0.4, line * 0.85);
  float a = vColor.a, pulse = 0.5 + 0.5 * sin(uTime * 5.0);
  if (vState > 0.5 && vState < 1.5) { col = mix(col, vec3(1.0, 0.72, 0.15), 0.3 + 0.22 * pulse); col = mix(col, vec3(0.42, 0.26, 0.0), line * 0.6); }
  if (vState > 1.5) { col = mix(col, vec3(1.0, 0.31, 0.58), 0.38 + 0.2 * pulse); }
  if (abs(vIdx - uHover) < 0.5) col = mix(col, vec3(1.0), 0.3);
  float tm = faceText(normalize(vN));
  col = mix(col, vec3(0.07, 0.10, 0.17), tm);
  if (a < 0.999 && a > 0.2) a = max(a, tm * 0.9);        // 반투명(속 보기)일 때도 번호는 또렷하게
  if (a < 0.999) a = max(a, line * 0.6);
  o = vec4(col, a);
}`

function compile(gl, type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('셰이더 오류: ' + gl.getShaderInfoLog(sh))
  return sh
}
function program(gl, vs, fs, names) {
  const p = gl.createProgram(); gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('셰이더 연결 오류: ' + gl.getProgramInfoLog(p))
  const u = {}; for (const n of names) u[n] = gl.getUniformLocation(p, n)
  return { p, u }
}

// ── 환경 모양 (바닥, 벽, 창문, 출입문, 사무실, 구역 바닥색) ─────────────────
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
function quad(out, p0, p1, p2, p3, n, c) {                       // n: 앞면이 보여야 하는 방향. 꼭짓점 순서가 반대면 자동으로 뒤집음
  const cr = cross3(sub3(p1, p0), sub3(p2, p0)), flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0
  const ps = flip ? [p0, p3, p2, p1] : [p0, p1, p2, p3]
  for (const i of [0, 1, 2, 0, 2, 3]) out.push(ps[i][0], ps[i][1], ps[i][2], n[0], n[1], n[2], c[0], c[1], c[2], c[3])
}
function box(out, x0, x1, y0, y1, z0, z1, c) {
  quad(out, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], c); quad(out, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], c)
  quad(out, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], c); quad(out, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], c)
  quad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c); quad(out, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], c)
}
export function buildEnv(model, spread, pal, activeZoneId) {
  const wh = model.warehouse, W = wh.width, H = wh.height, wallH = Math.max(wallHeight(model, spread), 3), T = 0.3
  const col = (hex, a = 1) => [...rgbf(hex), a]
  const floor = [], solid = [], trans = []
  quad(floor, [0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0], [0, 0, 1], col(pal.floor))
  const wc = col(pal.wall)
  quad(solid, [0, 0, 0], [W, 0, 0], [W, 0, wallH], [0, 0, wallH], [0, 1, 0], wc); quad(solid, [0, H, 0], [W, H, 0], [W, H, wallH], [0, H, wallH], [0, -1, 0], wc)
  quad(solid, [0, 0, 0], [0, H, 0], [0, H, wallH], [0, 0, wallH], [1, 0, 0], wc); quad(solid, [W, 0, 0], [W, H, 0], [W, H, wallH], [W, 0, wallH], [-1, 0, 0], wc)
  const rc = col(pal.wallRim), rz = wallH - 0.14
  box(solid, -T, W + T, -T, 0, rz, wallH, rc); box(solid, -T, W + T, H, H + T, rz, wallH, rc); box(solid, -T, 0, 0, H, rz, wallH, rc); box(solid, W, W + T, 0, H, rz, wallH, rc)
  for (const fx of model.fixtures) {                              // 창문 / 출입문: 벽에 붙은 얇은 상자
    if (fx.kind === 'office' || !fx.wall) continue
    const len = fixtureLen(fx.kind, W, H, fx.wall), pos = fx.pos ?? 0.5, horiz = fx.wall === 'top' || fx.wall === 'bottom'
    const c0 = (horiz ? pos * W : pos * H) - len / 2, c1 = c0 + len, win = fx.kind === 'window'
    const z0 = win ? wallH * 0.45 : 0, z1 = win ? wallH * 0.82 : Math.min(wallH * 0.9, 4.4), d = win ? 0.1 : 0.14
    const slab = (a0, a1, zz0, zz1, dd, c) => {
      if (fx.wall === 'top') box(solid, a0, a1, 0, dd, zz0, zz1, c); else if (fx.wall === 'bottom') box(solid, a0, a1, H - dd, H, zz0, zz1, c)
      else if (fx.wall === 'left') box(solid, 0, dd, a0, a1, zz0, zz1, c); else box(solid, W - dd, W, a0, a1, zz0, zz1, c)
    }
    slab(c0, c1, z0, z1, d, col(win ? pal.window : pal.door))
    if (win) { const m = (c0 + c1) / 2, zm = (z0 + z1) / 2, e = col(pal.windowEdge); slab(m - 0.05, m + 0.05, z0, z1, d + 0.03, e); slab(c0, c1, zm - 0.05, zm + 0.05, d + 0.03, e) }
    else { const k = c1 - len * 0.16; slab(k - 0.1, k + 0.1, z1 * 0.42, z1 * 0.42 + 0.2, d + 0.12, col('#f6e3a1')) }
  }
  for (const fx of model.fixtures) if (fx.kind === 'office') {      // 사무실: 몸체 + 지붕
    const r = officeRect({ x: fx.x ?? W / 2, y: fx.y ?? H / 2 }), bodyH = Math.min(wallH * 0.85, 3.8)
    box(solid, r.x, r.x + r.w, r.y, r.y + r.h, 0, bodyH, col(pal.office))
    box(solid, r.x - 0.35, r.x + r.w + 0.35, r.y - 0.35, r.y + r.h + 0.35, bodyH, bodyH + 0.5, col(pal.officeRoof))
  }
  for (const z of model.zones) {                                    // 구역 바닥색 + 칸 구분선
    const act = activeZoneId === z.id
    quad(trans, [z.x, z.y, 0.03], [z.x + z.w, z.y, 0.03], [z.x + z.w, z.y + z.h, 0.03], [z.x, z.y + z.h, 0.03], [0, 0, 1], [...rgbf(z.color), act ? 0.55 : 0.32])
    const mark = [...rgbf(z.color).map(v => v * 0.55), 0.7], lw = 0.045
    z.lines.forEach((ln, li) => {
      const y0 = z.y + li * z.ch, y1 = y0 + z.ch, xe = z.x + ln.slot_count * z.cw
      for (const yy of [y0, y1]) quad(trans, [z.x, yy - lw, 0.04], [xe, yy - lw, 0.04], [xe, yy + lw, 0.04], [z.x, yy + lw, 0.04], [0, 0, 1], mark)
      for (let s = 0; s <= ln.slot_count; s++) { const xx = z.x + s * z.cw; quad(trans, [xx - lw, y0, 0.04], [xx + lw, y0, 0.04], [xx + lw, y1, 0.04], [xx - lw, y1, 0.04], [0, 0, 1], mark) }
    })
    const edge = act ? [1, 0.72, 0.15, 1] : [...rgbf(z.color).map(v => v * 0.8), 1], eh = act ? 0.12 : 0.07
    box(solid, z.x - eh, z.x + z.w + eh, z.y - eh, z.y + eh, 0, eh * 1.2, edge); box(solid, z.x - eh, z.x + z.w + eh, z.y + z.h - eh, z.y + z.h + eh, 0, eh * 1.2, edge)
    box(solid, z.x - eh, z.x + eh, z.y, z.y + z.h, 0, eh * 1.2, edge); box(solid, z.x + z.w - eh, z.x + z.w + eh, z.y, z.y + z.h, 0, eh * 1.2, edge)
  }
  return { floor: new Float32Array(floor), solid: new Float32Array(solid), trans: new Float32Array(trans), wallH }
}

// ── 박스 (인스턴스) ──────────────────────────────────────────
export const INST_FLOATS = 11
export function buildInstances(model, o = {}) {
  const spread = o.spread ?? SPREAD_DEFAULT, maxTier = o.maxTier || 0, hl = o.highlight && o.highlight.size ? o.highlight : null
  const solid = [], ghost = []
  for (const z of model.zones) {
    const G = tierGeom(z, spread), mx = z.cw * G.mf, my = z.ch * G.mf, rgb = rgbf(z.color)
    z.lines.forEach((ln, li) => {
      for (const [s, all] of ln.stacks) for (const b of all) {
        if (maxTier && b.tier > maxTier) continue
        const x0 = z.x + (s - 1) * z.cw + mx, x1 = z.x + s * z.cw - mx, y0 = z.y + li * z.ch + my, y1 = z.y + (li + 1) * z.ch - my
        const z0 = (b.tier - 1) * G.pz, z1 = z0 + G.boxH
        const isHl = !!(hl && hl.has(b.id)), isFocus = o.focusId === b.id
        const isGhost = !isHl && !isFocus && !!(hl || o.xray)
        const k = b.tier % 2 ? 1 : 0.92
        ;(isGhost ? ghost : solid).push({ id: b.id, number: b.box_number, box: b, zoneId: z.id, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cz: (z0 + z1) / 2, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0,
          rgb: [rgb[0] * k, rgb[1] * k, rgb[2] * k], a: isGhost ? (hl ? 0.13 : 0.3) : 1, state: isFocus ? 2 : isHl ? 1 : 0, ghost: isGhost, pitch: Math.min(z.cw, z.ch) })
      }
    })
  }
  const meta = solid.concat(ghost), f = new Float32Array(meta.length * INST_FLOATS)
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  meta.forEach((m, i) => {
    f.set([m.cx, m.cy, m.cz, m.sx, m.sy, m.sz, m.rgb[0], m.rgb[1], m.rgb[2], m.a, m.state], i * INST_FLOATS)
    lo = [Math.min(lo[0], m.cx - m.sx / 2), Math.min(lo[1], m.cy - m.sy / 2), Math.min(lo[2], m.cz - m.sz / 2)]; hi = [Math.max(hi[0], m.cx + m.sx / 2), Math.max(hi[1], m.cy + m.sy / 2), Math.max(hi[2], m.cz + m.sz / 2)]
  })
  return { f32: f, meta, nSolid: solid.length, nGhost: ghost.length, bbox: meta.length ? { min: lo, max: hi } : null, indexById: new Map(meta.map((m, i) => [m.id, i])) }
}

// ── 그리기 엔진 ────────────────────────────────────────────
export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' })
  if (!gl) throw new Error('이 기기에서는 3D(WebGL2)를 쓸 수 없어요')
  const envP = program(gl, ENV_VS, ENV_FS, ['uVP', 'uLight', 'uGrid', 'uGridColor', 'uGridAlpha'])
  const boxP = program(gl, BOX_VS, BOX_FS, ['uVP', 'uEye', 'uFwd', 'uSecOn', 'uSecDist', 'uIdBase', 'uLight', 'uPass', 'uTime', 'uHover', 'uGlyph', 'uGlyphGrid', 'uShowText'])
  // 단위 상자: 면마다 4 꼭짓점 (위치, 법선, uv)
  const cubeV = [], cubeI = []
  for (const [n, u, v] of [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]]) {
    const base = cubeV.length / 8
    for (const [su, sv, uu, vv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) cubeV.push(0.5 * n[0] + 0.5 * su * u[0] + 0.5 * sv * v[0], 0.5 * n[1] + 0.5 * su * u[1] + 0.5 * sv * v[1], 0.5 * n[2] + 0.5 * su * u[2] + 0.5 * sv * v[2], n[0], n[1], n[2], uu, vv)
    cubeI.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const cubeVB = gl.createBuffer(), cubeIB = gl.createBuffer(), instB = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeV), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIB); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeI), gl.STATIC_DRAW)
  const boxVao = base => {                                          // base: 인스턴스 시작 번호 (단단한 박스 / 반투명 박스가 같은 버퍼를 나눠 씀)
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVB); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIB)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24)
    gl.bindBuffer(gl.ARRAY_BUFFER, instB); const st = STRIDE * 4, off = base * st
    for (const [loc, size, o] of [[3, 3, 0], [4, 3, 12], [5, 4, 24], [6, 1, 40], [7, 4, 44], [8, 4, 60]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, st, off + o); gl.vertexAttribDivisor(loc, 1) }
    gl.bindVertexArray(null); return vao
  }
  const envVao = data => {
    const vao = gl.createVertexArray(), buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24)
    gl.bindVertexArray(null); return { vao, buf, count: data.length / 10 }
  }
  const S = { env: null, inst: null, vaoSolid: null, vaoGhost: null, fboS: null, fboF: null, buf: null, glyph: null }
  const freeEnv = () => { if (S.env) for (const g of ['floor', 'solid', 'trans']) { gl.deleteVertexArray(S.env[g].vao); gl.deleteBuffer(S.env[g].buf) } }
  const makeFbo = (w, h) => {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h)
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('3D 버퍼를 만들 수 없어요')
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { fb, tex, rb, w, h }
  }
  const freeFbo = f => { if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); gl.deleteRenderbuffer(f.rb) } }

  function setEnv(model, spread, pal, activeZoneId) {
    freeEnv(); if (!model.warehouse) { S.env = null; return }
    const e = buildEnv(model, spread, pal, activeZoneId); S.env = { floor: envVao(e.floor), solid: envVao(e.solid), trans: envVao(e.trans), wallH: e.wallH }
  }
  /** 번호에 쓰인 글자가 글자판에 모두 있게 함 (없는 글자가 생기면 글자판을 다시 만듦) */
  function ensureGlyphs(meta) {
    const need = new Set(['?']); for (const m of meta) for (const ch of [...String(m.number ?? '')].slice(0, TXT_MAX)) need.add(ch)
    if (S.glyph && [...need].every(c => S.glyph.map.has(c))) return
    const chars = [...new Set([...(S.glyph ? S.glyph.map.keys() : []), ...need])].slice(0, G_MAX), { cv, rows } = buildAtlas(chars)
    if (S.glyph) gl.deleteTexture(S.glyph.tex)
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    S.glyph = { tex, rows, map: new Map(chars.map((c, i) => [c, i])) }
  }
  /** 글자판을 3번 자리에 붙임 — 박스 판별용 임시 그림판(0번 자리를 씀)과 같은 텍스처를 읽고 쓰는 일이 없게 항상 전용 자리를 씀 */
  function bindGlyph() {
    if (!S.glyph) return
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, S.glyph.tex); gl.uniform1i(boxP.u.uGlyph, 3); gl.uniform2f(boxP.u.uGlyphGrid, G_COLS, S.glyph.rows); gl.activeTexture(gl.TEXTURE0)
  }
  function setBoxes(model, o) {
    const inst = buildInstances(model, o); S.inst = inst
    ensureGlyphs(inst.meta)
    const n = inst.meta.length, packed = new Float32Array(Math.max(1, n) * STRIDE).fill(-1), q = S.glyph.map.get('?')
    inst.meta.forEach((m, i) => {
      packed.set(inst.f32.subarray(i * INST_FLOATS, (i + 1) * INST_FLOATS), i * STRIDE)
      const cs = [...String(m.number ?? '')].slice(0, TXT_MAX)
      for (let k = 0; k < TXT_MAX; k++) packed[i * STRIDE + INST_FLOATS + k] = k < cs.length ? (S.glyph.map.get(cs[k]) ?? q) : -1
    })
    gl.bindBuffer(gl.ARRAY_BUFFER, instB); gl.bufferData(gl.ARRAY_BUFFER, packed, gl.DYNAMIC_DRAW)
    if (S.vaoSolid) { gl.deleteVertexArray(S.vaoSolid); gl.deleteVertexArray(S.vaoGhost) }
    S.vaoSolid = boxVao(0); S.vaoGhost = boxVao(inst.nSolid)
    return inst
  }
  function setSize(cssW, cssH, dpr) { canvas.width = Math.max(2, Math.round(cssW * dpr)); canvas.height = Math.max(2, Math.round(cssH * dpr)); S.dpr = dpr; S.cssW = cssW; S.cssH = cssH; freeFbo(S.fboF); S.fboF = null }

  const camUniforms = (cam, aspect, sec) => {
    const { vp } = viewProjection(cam, aspect), { eye, fwd } = basisOf(cam)
    gl.uniformMatrix4fv(boxP.u.uVP, false, new Float32Array(vp)); gl.uniform3fv(boxP.u.uEye, eye); gl.uniform3fv(boxP.u.uFwd, fwd); gl.uniform3fv(boxP.u.uLight, LIGHT)
    gl.uniform1f(boxP.u.uSecOn, sec && sec.on ? 1 : 0); gl.uniform1f(boxP.u.uSecDist, sec ? sec.dist : 0)
    return vp
  }
  const drawBoxes = (which) => {
    const inst = S.inst; if (!inst) return
    const n = which === 'solid' ? inst.nSolid : inst.nGhost; if (!n) return
    gl.bindVertexArray(which === 'solid' ? S.vaoSolid : S.vaoGhost); gl.uniform1f(boxP.u.uIdBase, which === 'solid' ? 0 : inst.nSolid)
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, n)
  }
  const drawEnv = g => { gl.bindVertexArray(g.vao); gl.drawArrays(gl.TRIANGLES, 0, g.count) }

  function draw(a) {   // a: { cam, aspect, time, bg:[r,g,b], pal, hover, sec:{on,dist} }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(a.bg[0], a.bg[1], a.bg[2], 1); gl.clearDepth(1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW)             // 월드가 거울상이라 앞면 방향이 반대
    if (S.env) {
      gl.useProgram(envP.p); const { vp } = viewProjection(a.cam, a.aspect)
      gl.uniformMatrix4fv(envP.u.uVP, false, new Float32Array(vp)); gl.uniform3fv(envP.u.uLight, LIGHT); gl.uniform3fv(envP.u.uGridColor, a.gridColor || [1, 1, 1]); gl.uniform1f(envP.u.uGridAlpha, a.gridAlpha ?? 0.16)
      gl.uniform1f(envP.u.uGrid, 1); drawEnv(S.env.floor); gl.uniform1f(envP.u.uGrid, 0); drawEnv(S.env.solid)
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2)
      drawEnv(S.env.trans); gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND)
    }
    gl.useProgram(boxP.p); camUniforms(a.cam, a.aspect, a.sec); gl.uniform1f(boxP.u.uPass, 0); gl.uniform1f(boxP.u.uTime, a.time || 0); gl.uniform1f(boxP.u.uHover, a.hover ?? -1)
    gl.uniform1f(boxP.u.uShowText, a.showText === false ? 0 : 1); bindGlyph()
    drawBoxes('solid')
    if (S.inst && S.inst.nGhost) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); drawBoxes('ghost'); gl.depthMask(true); gl.disable(gl.BLEND) }
    gl.bindVertexArray(null)
  }
  /** 박스마다 고유 색으로 그려서 화면의 각 점이 어느 박스인지 알아냄. withGhost: 반투명 박스도 눌리게 */
  function renderIds(fbo, cam, aspect, sec, withGhost) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb); gl.viewport(0, 0, fbo.w, fbo.h); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW)
    gl.useProgram(boxP.p); camUniforms(cam, aspect, sec); gl.uniform1f(boxP.u.uPass, 1); gl.uniform1f(boxP.u.uTime, 0); gl.uniform1f(boxP.u.uHover, -1); bindGlyph()
    drawBoxes('solid'); if (withGhost) drawBoxes('ghost')
    gl.bindVertexArray(null)
  }
  const fullFbo = () => { if (!S.fboF || S.fboF.w !== canvas.width || S.fboF.h !== canvas.height) { freeFbo(S.fboF); S.fboF = makeFbo(canvas.width, canvas.height) } return S.fboF }
  /** 화면의 (cssX, cssY) 에 있는 박스의 번호(인스턴스 순번), 없으면 -1 — 실제 크기로 그려서 정확히 */
  function pick(cam, aspect, cssX, cssY, sec, withGhost) {
    const f = fullFbo(); renderIds(f, cam, aspect, sec, withGhost)
    const px = Math.min(f.w - 1, Math.max(0, Math.floor(cssX * (f.w / S.cssW)))), py = Math.min(f.h - 1, Math.max(0, f.h - 1 - Math.floor(cssY * (f.h / S.cssH)))), out = new Uint8Array(4)
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out); gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    const id = out[0] | (out[1] << 8) | (out[2] << 16); return id ? id - 1 : -1
  }
  /** 지금 화면에서 실제로 보이는 박스들: 박스마다 보이는 점의 개수와 (번호를 붙일) 보이는 곳의 위치. 작은 크기로 그려서 빠르게 */
  function visibility(cam, aspect, sec, withGhost, scale = 0.5) {
    const vw = Math.max(200, Math.min(640, Math.round(canvas.width * scale))), vh = Math.max(60, Math.round(vw * canvas.height / canvas.width))
    if (!S.fboS || S.fboS.w !== vw || S.fboS.h !== vh) { freeFbo(S.fboS); S.fboS = makeFbo(vw, vh) }
    renderIds(S.fboS, cam, aspect, sec, withGhost)
    const buf = new Uint8Array(vw * vh * 4); gl.readPixels(0, 0, vw, vh, gl.RGBA, gl.UNSIGNED_BYTE, buf); gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    S.last = { buf, vw, vh }
    const n = S.inst ? S.inst.meta.length : 0, cnt = new Float32Array(n + 1), sx = new Float64Array(n + 1), sy = new Float64Array(n + 1)
    for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) { const i = (y * vw + x) * 4, id = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16); if (id && id <= n) { cnt[id]++; sx[id] += x + 0.5; sy[id] += (vh - 1 - y) + 0.5 } }
    const kx = S.cssW / vw, ky = S.cssH / vh, area = kx * ky, at = (x, y) => { x = Math.round(x - 0.5); y = vh - 1 - Math.round(y - 0.5); if (x < 0 || y < 0 || x >= vw || y >= vh) return 0; const i = (y * vw + x) * 4; return buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16) }
    const list = []
    for (let id = 1; id <= n; id++) if (cnt[id]) {
      let cx = sx[id] / cnt[id], cy = sy[id] / cnt[id]
      if (at(cx, cy) !== id) {                                       // 가운데가 다른 박스에 가려져 있으면 가장 가까운 '보이는 점'으로
        let best = null, bd = 1e9; const R = 8
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (at(cx + dx, cy + dy) === id && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = [dx, dy] }
        if (best) { cx += best[0]; cy += best[1] }
      }
      list.push({ index: id - 1, px: cnt[id] * area, x: cx * kx, y: cy * ky })
    }
    return list
  }
  /** 마지막 visibility() 결과에서 (cssX, cssY) 의 박스 번호(인스턴스 순번) — GPU 를 다시 쓰지 않아서 마우스를 움직일 때마다 불러도 됨 */
  function idAtLast(cssX, cssY) {
    const L = S.last; if (!L) return -1
    const x = Math.floor(cssX * L.vw / S.cssW), y = L.vh - 1 - Math.floor(cssY * L.vh / S.cssH)
    if (x < 0 || y < 0 || x >= L.vw || y >= L.vh) return -1
    const i = (y * L.vw + x) * 4, id = L.buf[i] | (L.buf[i + 1] << 8) | (L.buf[i + 2] << 16); return id ? id - 1 : -1
  }
  function dispose() {
    freeEnv(); freeFbo(S.fboS); freeFbo(S.fboF); if (S.vaoSolid) { gl.deleteVertexArray(S.vaoSolid); gl.deleteVertexArray(S.vaoGhost) }
    if (S.glyph) gl.deleteTexture(S.glyph.tex); gl.deleteBuffer(cubeVB); gl.deleteBuffer(cubeIB); gl.deleteBuffer(instB); gl.deleteProgram(envP.p); gl.deleteProgram(boxP.p)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
  return { gl, canvas, faceText: true, setEnv, setBoxes, setSize, draw, pick, visibility, idAtLast, dispose, depthRangeOf: (cam) => (S.inst && S.inst.bbox ? depthRange(cam, S.inst.bbox) : [0, 1]), get inst() { return S.inst }, get wallH() { return S.env ? S.env.wallH : 3 } }
}
