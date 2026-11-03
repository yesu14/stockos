// ═══════════════════════════════════════════════════════════
//  상품찾기 — 3D 카메라 계산 (원근 카메라). 화면/GPU 없이 시험할 수 있는 순수 함수만 모아둠
//  좌표: x = 가로, y = 세로(줄), z = 위. 카메라는 목표점(tx,ty,tz) 둘레를 돈다
//        yaw = 좌우 돌기, pitch = 위아래 각도, dist = 목표점까지 거리
// ═══════════════════════════════════════════════════════════
export const FOV = (48 * Math.PI) / 180          // 세로 시야각
export const NEAR = 0.06, FAR = 2500
export const PITCH_MIN = 0.03, PITCH_MAX = Math.PI / 2 - 0.002
export const DIST_MIN = 0.8, DIST_MAX = 900

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const len = a => Math.hypot(a[0], a[1], a[2])
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }

/** 카메라의 방향 벡터들 (목표점 → 카메라 방향 e, 오른쪽, 위쪽, 앞쪽, 카메라 위치) */
export function basisOf(cam) {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw)
  const e = [cp * cy, cp * sy, sp]
  const right = [sy, -cy, 0], up = [-sp * cy, -sp * sy, cp]
  const eye = [cam.tx + cam.dist * e[0], cam.ty + cam.dist * e[1], cam.tz + cam.dist * e[2]]
  return { e, right, up, fwd: [-e[0], -e[1], -e[2]], eye }
}

/** 4x4 행렬 곱 (열 우선, WebGL 방식) */
export function mul4(A, B) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += A[k * 4 + r] * B[c * 4 + k]; o[c * 4 + r] = s }
  return o
}
export function viewProjection(cam, aspect) {
  const { e, right, up, eye } = basisOf(cam)
  const V = [right[0], up[0], e[0], 0, right[1], up[1], e[1], 0, right[2], up[2], e[2], 0, -dot(right, eye), -dot(up, eye), -dot(e, eye), 1]
  const f = 1 / Math.tan(FOV / 2), nf = 1 / (NEAR - FAR)
  const P = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (FAR + NEAR) * nf, -1, 0, 0, 2 * FAR * NEAR * nf, 0]
  return { view: V, proj: P, vp: mul4(P, V) }
}

/** 점들을 화면 좌표로 바꾸는 함수 (여러 점을 바꿀 때 행렬을 한 번만 계산). 반환: [x, y, 깊이, 앞에 있는지] */
export function makeProjector(cam, aspect, W, H) {
  const { vp } = viewProjection(cam, aspect)
  return p => {
    const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]
    return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H, w, w > NEAR]
  }
}

/** 화면의 한 점(px, py)을 지나는 시선 (시작점 o, 방향 d) */
export function rayAt(cam, aspect, W, H, px, py) {
  const { right, up, fwd, eye } = basisOf(cam), t = Math.tan(FOV / 2)
  const nx = (px / W) * 2 - 1, ny = 1 - (py / H) * 2
  return { o: eye, d: norm([fwd[0] + nx * t * aspect * right[0] + ny * t * up[0], fwd[1] + nx * t * aspect * right[1] + ny * t * up[1], fwd[2] + nx * t * aspect * right[2] + ny * t * up[2]]) }
}
/** 시선이 높이 z 의 평면과 만나는 점 (앞쪽에서 만날 때만) */
export function hitPlaneZ(ray, z) {
  if (Math.abs(ray.d[2]) < 1e-9) return null
  const k = (z - ray.o[2]) / ray.d[2]
  return k > 0 ? [ray.o[0] + k * ray.d[0], ray.o[1] + k * ray.d[1], z] : null
}
/** 시선과 상자(중심 c, 크기 s)의 교차: 가까운 거리 t, 없으면 null (CPU 쪽 확인/대체용) */
export function rayBox(ray, c, s) {
  let t0 = 0, t1 = Infinity
  for (let i = 0; i < 3; i++) {
    const lo = c[i] - s[i] / 2, hi = c[i] + s[i] / 2
    if (Math.abs(ray.d[i]) < 1e-12) { if (ray.o[i] < lo || ray.o[i] > hi) return null; continue }
    let a = (lo - ray.o[i]) / ray.d[i], b = (hi - ray.o[i]) / ray.d[i]; if (a > b) [a, b] = [b, a]
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null
  }
  return t0
}

// ── 조작 ────────────────────────────────────────────────────
/** 왼쪽 끌기: 목표점 둘레로 돌기 */
export const orbit = (cam, dx, dy) => ({ ...cam, yaw: cam.yaw + dx * 0.0075, pitch: clamp(cam.pitch + dy * 0.006, PITCH_MIN, PITCH_MAX) })

/** 오른쪽 끌기: 바닥을 잡고 끌기. cam0(끌기 시작 때의 카메라)에서 from 에 있던 바닥 점이 to 로 따라오도록 목표점을 옮김 */
export function panGrab(cam0, aspect, W, H, from, to) {
  const P0 = hitPlaneZ(rayAt(cam0, aspect, W, H, from[0], from[1]), cam0.tz), P1 = hitPlaneZ(rayAt(cam0, aspect, W, H, to[0], to[1]), cam0.tz)
  if (P0 && P1) return { ...cam0, tx: cam0.tx + P0[0] - P1[0], ty: cam0.ty + P0[1] - P1[1] }
  const k = (2 * Math.tan(FOV / 2) * cam0.dist) / H, { right, fwd } = basisOf(cam0), f = norm([fwd[0], fwd[1], 0])      // 거의 수평으로 볼 때 바닥에 안 닿으면 끈 만큼 비례해서
  const dx = to[0] - from[0], dy = to[1] - from[1]
  return { ...cam0, tx: cam0.tx + f[0] * dy * k - right[0] * dx * k, ty: cam0.ty + f[1] * dy * k - right[1] * dx * k }
}

/** 휠/핀치 확대: 커서 아래의 바닥 점이 화면에서 그대로 있도록 그 점 쪽으로 다가감 (factor < 1 이면 확대) */
export function zoomAt(cam, factor, aspect, W, H, px, py) {
  const dist2 = clamp(cam.dist * factor, DIST_MIN, DIST_MAX), f = dist2 / cam.dist
  const ray = rayAt(cam, aspect, W, H, px, py), { e, eye } = basisOf(cam)
  let P = hitPlaneZ(ray, 0)
  if (!P || len(sub(P, eye)) > cam.dist * 6) P = add(ray.o, mul(ray.d, cam.dist))                // 바닥에 안 닿으면 목표점 거리쯤의 점
  const C = add(eye, mul(sub(P, eye), 1 - f))
  return { ...cam, dist: dist2, tx: C[0] - dist2 * e[0], ty: C[1] - dist2 * e[1], tz: Math.max(0, C[2] - dist2 * e[2]) }
}

/** 구(중심 c, 반지름 r)가 화면에 꼭 들어오게 거리를 맞춤 */
export function fitSphere(cam, c, r, aspect, margin = 1.12) {
  const half = Math.min(FOV / 2, Math.atan(Math.tan(FOV / 2) * aspect))
  return { ...cam, tx: c[0], ty: c[1], tz: c[2], dist: clamp((r * margin) / Math.sin(half), DIST_MIN, DIST_MAX) }
}
/** 위에서 내려다볼 때(평면도와 같은 방향) 가로 W × 세로 H 직사각형이 화면에 꼭 들어오는 카메라 */
export function fitTopRect(cam, W, H, aspect, margin = 1.08) {
  const t = Math.tan(FOV / 2)
  return { ...cam, yaw: Math.PI / 2, tx: W / 2, ty: H / 2, tz: 0, pitch: PITCH_MAX, dist: clamp(Math.max(H / 2 / t, W / 2 / (t * aspect)) * margin, DIST_MIN, DIST_MAX) }
}
/** 지금 시점에서 앞→뒤 방향으로 상자(bb)가 차지하는 깊이 범위 [가까운 쪽, 먼 쪽] (단면 슬라이더용) */
export function depthRange(cam, bb) {
  const { eye, fwd } = basisOf(cam); let lo = Infinity, hi = -Infinity
  for (const x of [bb.min[0], bb.max[0]]) for (const y of [bb.min[1], bb.max[1]]) for (const z of [bb.min[2], bb.max[2]]) { const d = dot(sub([x, y, z], eye), fwd); lo = Math.min(lo, d); hi = Math.max(hi, d) }
  return [lo, hi]
}
/** 두 카메라 사이를 부드럽게 (k: 0~1). 회전은 가까운 방향으로, 거리는 비율로 */
export function lerpCam(a, b, k) {
  const TWO = Math.PI * 2, dy = ((b.yaw - a.yaw + Math.PI) % TWO + TWO) % TWO - Math.PI
  return { yaw: a.yaw + dy * k, pitch: a.pitch + (b.pitch - a.pitch) * k, dist: a.dist * Math.pow(b.dist / a.dist, k), tx: a.tx + (b.tx - a.tx) * k, ty: a.ty + (b.ty - a.ty) * k, tz: a.tz + (b.tz - a.tz) * k }
}
export const DEFAULT_ANGLES = { yaw: Math.PI / 2 - 0.55, pitch: 0.62 }
