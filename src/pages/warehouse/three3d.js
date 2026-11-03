// ═══════════════════════════════════════════════════════════
//  상품찾기 — Three.js 3D 뷰어 (그리기 + 광선(Raycaster) 판정 담당)
//  Three.js 는 인터넷(jsDelivr)에서 한 번 불러와요 (설치 필요 없음). 불러오지 못하면 기본 3D 로 자동으로 바뀌어요.
//  조작(왼쪽=돌리기 · 오른쪽=이동 · 휠=확대, OrbitControls 와 같은 방식), 번호표, 설정 창은 Scene3DGL 과 같은 코드를 씀.
//  좌표: 평면도는 y 가 아래로 늘어나는데 Three.js 는 y 가 위쪽이라, 그릴 때 y 를 뒤집어서(−y) 평면도와 같은 방향으로 보이게 함.
// ═══════════════════════════════════════════════════════════
import { buildEnv, buildInstances } from './gl3d'
import { basisOf, makeProjector, depthRange, FOV, NEAR, FAR } from './cam3d'

export const THREE_VERSION = '0.160.0'
export const THREE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`
let loading = null
export function loadThree() {
  if (!loading) loading = import(/* @vite-ignore */ THREE_URL).catch(e => { loading = null; throw e })
  return loading
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const LIGHT = (() => { const v = [-0.4, -0.5, 0.77], l = Math.hypot(...v); return v.map(x => x / l) })()
const shade = (nx, ny, nz) => 0.52 + 0.48 * (0.5 + 0.5 * clamp(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], -1, 1))   // 조명 없이 면마다 밝기를 미리 정해 둠
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const AMBER = [1, 0.72, 0.15], PINK = [1, 0.31, 0.58], WHITE = [1, 1, 1]
const baseColor = m => (m.state === 1 ? mix(m.rgb, AMBER, 0.3) : m.state === 2 ? mix(m.rgb, PINK, 0.38) : m.rgb)

export function createThreeRenderer(canvas, T) {
  T.ColorManagement.enabled = false                                  // 우리가 정한 색을 변환 없이 그대로
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = T.LinearSRGBColorSpace
  const scene = new T.Scene(), camera = new T.PerspectiveCamera((FOV * 180) / Math.PI, 1, NEAR, FAR)
  camera.up.set(0, 0, 1)                                              // 위쪽 = z
  const raycaster = new T.Raycaster()
  const boxGeo = new T.BoxGeometry(1, 1, 1)                          // 단위 상자 (박스마다 크기/위치만 바꿔 한 번에 그림)
  { const nrm = boxGeo.getAttribute('normal'), n = nrm.count, col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { const s = shade(nrm.array[i * 3], -nrm.array[i * 3 + 1], nrm.array[i * 3 + 2]); col[i * 3] = s; col[i * 3 + 1] = s; col[i * 3 + 2] = s }
    boxGeo.setAttribute('color', new T.BufferAttribute(col, 3)) }
  const S = { env: [], grid: null, solid: null, ghost: null, inst: null, base: [], hidden: [], special: [], secOn: false, cssW: 1, cssH: 1, lastCam: null, lastAspect: 1, lastSec: null, lastGhost: false, hover: -1, wallH: 3 }
  const tmp = { m: new T.Matrix4(), q: new T.Quaternion(), p: new T.Vector3(), s: new T.Vector3(), c: new T.Color(), ndc: new T.Vector2() }
  const free = o => { scene.remove(o); if (o.geometry && o.geometry !== boxGeo) o.geometry.dispose(); if (o.material) o.material.dispose() }
  const meshOf = i => (S.inst && i < S.inst.nSolid ? [S.solid, i] : [S.ghost, i - (S.inst ? S.inst.nSolid : 0)])
  const place = (mesh, local, m, hide) => { const k = hide ? 1e-5 : 1; tmp.p.set(m.cx, -m.cy, m.cz); tmp.s.set(m.sx * k, m.sy * k, m.sz * k); tmp.m.compose(tmp.p, tmp.q, tmp.s); mesh.setMatrixAt(local, tmp.m) }
  const paint = (i, c) => { const [mesh, li] = meshOf(i); if (!mesh) return; tmp.c.setRGB(c[0], c[1], c[2]); mesh.setColorAt(li, tmp.c); mesh.instanceColor.needsUpdate = true }

  function setEnv(model, spread, pal, activeZoneId) {
    for (const o of S.env) free(o); S.env = []; if (S.grid) { free(S.grid); S.grid = null }
    if (!model.warehouse) return
    const e = buildEnv(model, spread, pal, activeZoneId); S.wallH = e.wallH
    const W = model.warehouse.width, H = model.warehouse.height
    const add = (data, trans) => {
      const n = data.length / 10; if (!n) return
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 4)
      for (let t = 0; t < n; t += 3) for (let k = 0; k < 3; k++) {
        const a = (t + (k === 0 ? 0 : k === 1 ? 2 : 1)) * 10, d = t + k            // 삼각형 꼭짓점 순서를 뒤집음 (y 를 뒤집으면 거울상이라 앞뒤가 바뀌어서)
        pos[d * 3] = data[a]; pos[d * 3 + 1] = -data[a + 1]; pos[d * 3 + 2] = data[a + 2]
        const s = shade(data[a + 3], data[a + 4], data[a + 5])
        col[d * 4] = data[a + 6] * s; col[d * 4 + 1] = data[a + 7] * s; col[d * 4 + 2] = data[a + 8] * s; col[d * 4 + 3] = data[a + 9]
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 4))
      const mat = new T.MeshBasicMaterial({ vertexColors: true, transparent: !!trans, depthWrite: !trans, side: T.FrontSide, polygonOffset: !!trans, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
      const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = trans ? 1 : 0; scene.add(mesh); S.env.push(mesh)
    }
    add(e.floor, false); add(e.solid, false); add(e.trans, true)
    const lines = []                                                                   // 바닥 눈금 (1m 간격)
    for (let x = 0; x <= W + 1e-6; x += 1) lines.push(x, 0, 0.012, x, -H, 0.012)
    for (let y = 0; y <= H + 1e-6; y += 1) lines.push(0, -y, 0.012, W, -y, 0.012)
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(new Float32Array(lines), 3))
    S.grid = new T.LineSegments(lg, new T.LineBasicMaterial({ color: new T.Color(1, 1, 1), transparent: true, opacity: 0.16, depthWrite: false })); S.grid.frustumCulled = false; scene.add(S.grid)
  }
  function setBoxes(model, o) {
    for (const k of ['solid', 'ghost']) if (S[k]) { free(S[k]); S[k] = null }
    const inst = buildInstances(model, o); S.inst = inst; S.hidden = new Array(inst.meta.length).fill(false); S.secOn = false; S.hover = -1
    S.base = inst.meta.map(baseColor); S.special = []; inst.meta.forEach((m, i) => { if (m.state > 0) S.special.push(i) })
    const make = (from, count, ghost) => {
      if (!count) return null
      const mat = new T.MeshBasicMaterial({ vertexColors: true, transparent: ghost, opacity: ghost ? inst.meta[from].a : 1, depthWrite: !ghost })
      const mesh = new T.InstancedMesh(boxGeo, mat, count); mesh.frustumCulled = false; mesh.renderOrder = ghost ? 2 : 0
      for (let i = 0; i < count; i++) { place(mesh, i, inst.meta[from + i], false); const c = S.base[from + i]; tmp.c.setRGB(c[0], c[1], c[2]); mesh.setColorAt(i, tmp.c) }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; scene.add(mesh); return mesh
    }
    S.solid = make(0, inst.nSolid, false); S.ghost = make(inst.nSolid, inst.nGhost, true)
    return inst
  }
  function setSize(cssW, cssH, dpr) { S.cssW = cssW; S.cssH = cssH; renderer.setPixelRatio(dpr); renderer.setSize(cssW, cssH, false) }
  function setCam(cam, aspect) {
    const { eye } = basisOf(cam)
    camera.position.set(eye[0], -eye[1], eye[2]); camera.lookAt(cam.tx, -cam.ty, cam.tz)
    camera.aspect = aspect; camera.updateProjectionMatrix(); camera.updateMatrixWorld()
  }
  function applySection(cam, sec) {                                     // 단면: 앞쪽 박스를 지움 (보이지 않게 아주 작게 줄임)
    const on = !!(sec && sec.on); if (!on && !S.secOn) return
    S.secOn = on
    const { eye, fwd } = basisOf(cam), meta = S.inst.meta; let ch = false
    for (let i = 0; i < meta.length; i++) {
      const m = meta[i], hide = on && ((m.cx - eye[0]) * fwd[0] + (m.cy - eye[1]) * fwd[1] + (m.cz - eye[2]) * fwd[2]) < sec.dist
      if (hide !== S.hidden[i]) { S.hidden[i] = hide; const [mesh, li] = meshOf(i); if (mesh) { place(mesh, li, m, hide); ch = true } }
    }
    if (ch) { if (S.solid) S.solid.instanceMatrix.needsUpdate = true; if (S.ghost) S.ghost.instanceMatrix.needsUpdate = true }
  }
  function updateColors(time, hover) {                                  // 검색한 박스 깜빡임 + 마우스를 올린 박스 밝게
    const pulse = 0.5 + 0.5 * Math.sin(time * 5)
    for (const i of S.special) paint(i, mix(S.base[i], S.inst.meta[i].state === 1 ? AMBER : PINK, 0.22 * pulse))
    if (hover !== S.hover) { if (S.hover >= 0 && S.base[S.hover] && !S.special.includes(S.hover)) paint(S.hover, S.base[S.hover]); S.hover = hover }
    if (hover >= 0 && S.base[hover]) paint(hover, mix(S.base[hover], WHITE, 0.3))
  }
  function draw(a) {
    setCam(a.cam, a.aspect); S.lastCam = a.cam; S.lastAspect = a.aspect; S.lastSec = a.sec
    if (S.inst) { applySection(a.cam, a.sec); updateColors(a.time || 0, a.hover ?? -1) }
    if (S.grid) { const g = a.gridColor || [1, 1, 1]; S.grid.material.color.setRGB(g[0], g[1], g[2]); S.grid.material.opacity = a.gridAlpha ?? 0.16 }
    renderer.setClearColor(tmp.c.setRGB(a.bg[0], a.bg[1], a.bg[2]), 1)
    renderer.render(scene, camera)
  }
  /** 화면의 (cssX, cssY) 를 지나는 광선(Raycaster)에 처음 닿는 박스의 번호(인스턴스 순번), 없으면 -1 */
  function pick(cam, aspect, cssX, cssY, sec, withGhost) {
    if (!S.inst) return -1
    setCam(cam, aspect); tmp.ndc.set((cssX / S.cssW) * 2 - 1, 1 - (cssY / S.cssH) * 2); raycaster.setFromCamera(tmp.ndc, camera)
    let best = -1, bd = Infinity
    const test = (mesh, base) => { if (!mesh) return; for (const h of raycaster.intersectObject(mesh, false)) { const idx = base + h.instanceId; if (S.hidden[idx]) continue; if (h.distance < bd) { bd = h.distance; best = idx } break } }
    test(S.solid, 0); if (withGhost) test(S.ghost, S.inst.nSolid)
    return best
  }
  const idAtLast = (x, y) => (S.lastCam ? pick(S.lastCam, S.lastAspect, x, y, S.lastSec, S.lastGhost) : -1)
  /** 지금 화면에서 보이는 박스들 (앞의 박스가 가운데 점을 덮고 있으면 가려진 것으로 봄) + 번호를 붙일 위치 */
  function visibility(cam, aspect, sec, withGhost) {
    S.lastGhost = !!withGhost; if (!S.inst) return []
    const W = S.cssW, H = S.cssH, P = makeProjector(cam, aspect, W, H), meta = S.inst.meta, limit = withGhost ? meta.length : S.inst.nSolid, items = []
    for (let i = 0; i < limit; i++) {
      if (S.hidden[i]) continue
      const m = meta[i]; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, front = true
      for (const dx of [-0.5, 0.5]) for (const dy of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) { const q = P([m.cx + dx * m.sx, m.cy + dy * m.sy, m.cz + dz * m.sz]); if (!q[3]) front = false; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]) }
      if (!front || x1 < 0 || y1 < 0 || x0 > W || y0 > H) continue
      const c = P([m.cx, m.cy, m.cz]); items.push({ i, x0, x1, y0, y1, cx: c[0], cy: c[1], d: c[2] })
    }
    items.sort((a, b) => a.d - b.d)
    const out = []
    for (let a = 0; a < items.length; a++) {
      const it = items[a]; let covered = false
      for (let b = 0; b < a; b++) { const o = items[b]; if (it.cx > o.x0 && it.cx < o.x1 && it.cy > o.y0 && it.cy < o.y1) { covered = true; break } }
      if (!covered) out.push({ index: it.i, px: (it.x1 - it.x0) * (it.y1 - it.y0) * 0.5, x: clamp(it.cx, 2, W - 2), y: clamp(it.cy, 2, H - 2) })
    }
    return out
  }
  function dispose() {
    for (const o of S.env) free(o); if (S.grid) free(S.grid); for (const k of ['solid', 'ghost']) if (S[k]) free(S[k])
    boxGeo.dispose(); renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss()
  }
  return { canvas, setEnv, setBoxes, setSize, draw, pick, visibility, idAtLast, dispose, depthRangeOf: cam => (S.inst && S.inst.bbox ? depthRange(cam, S.inst.bbox) : [0, 1]), get inst() { return S.inst }, get wallH() { return S.wallH } }
}
