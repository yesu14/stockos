// ═══════════════════════════════════════════════════════════
//  상품찾기 — 3D 렌더러 (외부 라이브러리 없음)
//  직교 투영 + 화가 알고리즘(먼 것부터 그리기). 캔버스로 그리고, 같은 장면을 SVG 로도 뽑을 수 있음(테스트용).
//  좌표: x → 오른쪽, y → 아래(평면도와 동일), z → 위
// ═══════════════════════════════════════════════════════════
import { TXT, FACES as FT_FACES, faceLayout, labelChars, GLYPH_FONT } from './faceText'
import { shade as shadeRaw, rgba as rgbaRaw, fixtureLen, clamp, officeRect } from './whLogic'

const _c = new Map()
const memo = (tag, fn) => (a, b) => { const k = tag + a + '|' + b; let v = _c.get(k); if (v === undefined) { if (_c.size > 4000) _c.clear(); v = fn(a, b); _c.set(k, v) } return v }
const shade = memo('s', shadeRaw), rgba = memo('r', rgbaRaw)

export const PITCH_MIN = 0.04
export const PITCH_MAX = Math.PI / 2
export const SCALE_MIN = 1.5
export const SCALE_MAX = 400

export const DARK_PALETTE = {
  bg: '#141826', floor: '#39435f', floorEdge: '#7f8cb0', grid: 'rgba(255,255,255,0.07)',
  wall: '#8d99b8', wallRim: '#c2cbe0', window: '#bfe6ff', windowEdge: '#6db3e0',
  door: '#d9a273', doorEdge: '#9b6b3e', office: '#d8c6ff', officeRoof: '#a98cf0',
  pillBg: 'rgba(255,255,255,0.93)', pillText: '#334155', boxText: '#2b3445', link: 'rgba(255,255,255,0.9)', linkCase: 'rgba(8,12,24,0.6)',
}
export const LIGHT_PALETTE = {
  bg: '#ffffff', floor: '#eef2f9', floorEdge: '#a5b1c9', grid: 'rgba(15,23,42,0.07)',
  wall: '#cfd8e8', wallRim: '#e8edf6', window: '#bfe6ff', windowEdge: '#6db3e0',
  door: '#d9a273', doorEdge: '#9b6b3e', office: '#d8c6ff', officeRoof: '#a98cf0',
  pillBg: 'rgba(255,255,255,0.96)', pillText: '#334155', boxText: '#2b3445', link: 'rgba(30,41,70,0.85)', linkCase: 'rgba(255,255,255,0.75)',
}

// ── 기하 ────────────────────────────────────────────────────
export const boxHeight = z => Math.min(z.cw, z.ch) * 0.82
export const SPREAD_DEFAULT = 0.8
export const TAG_MIN_PITCH = 26         // 한 칸이 화면에서 이만큼(px)보다 작으면 번호표를 생략
/** 박스 배치 치수. spread(0~1)가 클수록 박스 사이를 넓게 벌림 (옆으로도, 위아래 층 사이도).
 *  벌릴수록 박스를 가로·세로·높이 모두 비례해서 줄여서 작은 정육면체처럼 보이게 함 (가는 기둥처럼 보이지 않게).
 *  mf=칸 가장자리에서 띄우는 비율, boxH=박스 높이, pz=한 층 올라갈 때 높이 */
export function tierGeom(z, spread = SPREAD_DEFAULT) {
  const c = Math.min(z.cw, z.ch), bh = c * 0.82
  const mf = 0.035 + spread * 0.30, k = (1 - 2 * mf) / 0.93        // k: 박스가 줄어든 비율 (간격 0 일 때 1)
  const boxH = bh * 0.98 * k, gapV = bh * 0.02 + spread * c * 0.55
  return { bh, mf, boxH, pz: boxH + gapV }
}
export function wallHeight(model, spread = SPREAD_DEFAULT) {
  let h = 2.6
  for (const z of model.zones) h = Math.max(h, z.tiers * tierGeom(z, spread).pz + 0.3)
  return Math.min(h, 14)
}
/** 실제로 쌓인 가장 높은 곳 (카메라가 위쪽이 잘리지 않게 맞출 때 씀) */
export function stackHeight(model, spread = SPREAD_DEFAULT) {
  let h = 0
  for (const z of model.zones) { let m = 0; for (const ln of z.lines) for (const st of ln.stacks.values()) m = Math.max(m, st.length); h = Math.max(h, m * tierGeom(z, spread).pz) }
  return h
}
export function basis(cam) {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw)
  return { e: [cp * cy, cp * sy, sp], r: [sy, -cy, 0], u: [-sp * cy, -sp * sy, cp] }
}
function projector(cam, vp) {
  const B = basis(cam)
  const cx = vp.w / 2 + cam.panX, cy = vp.h / 2 + cam.panY
  const { r, u, e } = B
  return {
    B,
    p(x, y, z) {
      const dx = x - cam.tx, dy = y - cam.ty, dz = z - cam.tz
      return [cx + cam.scale * (dx * r[0] + dy * r[1] + dz * r[2]),
              cy - cam.scale * (dx * u[0] + dy * u[1] + dz * u[2]),
              -(dx * e[0] + dy * e[1] + dz * e[2])]
    },
  }
}
export function projectPoint(cam, vp, x, y, z) { return projector(cam, vp).p(x, y, z) }

const FACES = [
  { id: 'top', idx: [4, 5, 7, 6], n: [0, 0, 1], f: 1.12 },
  { id: 'px', idx: [1, 3, 7, 5], n: [1, 0, 0], f: 0.68 },
  { id: 'nx', idx: [0, 4, 6, 2], n: [-1, 0, 0], f: 0.82 },
  { id: 'py', idx: [2, 6, 7, 3], n: [0, 1, 0], f: 0.90 },
  { id: 'ny', idx: [0, 1, 5, 4], n: [0, -1, 0], f: 0.74 },
]
function cuboid(P, x0, x1, y0, y1, z0, z1) {
  return [P.p(x0, y0, z0), P.p(x1, y0, z0), P.p(x0, y1, z0), P.p(x1, y1, z0),
          P.p(x0, y0, z1), P.p(x1, y0, z1), P.p(x0, y1, z1), P.p(x1, y1, z1)]
}
const flat = pts => { const o = []; for (const p of pts) o.push(p[0], p[1]); return o }
function area(f) { let a = 0; for (let i = 0, n = f.length / 2; i < n; i++) { const j = (i + 1) % n; a += f[2 * i] * f[2 * j + 1] - f[2 * j] * f[2 * i + 1] } return Math.abs(a) / 2 }
function centroid(f) { let x = 0, y = 0, n = f.length / 2; for (let i = 0; i < n; i++) { x += f[2 * i]; y += f[2 * i + 1] } return [x / n, y / n] }
export function textW(text, size) {
  let w = 0
  for (const ch of String(text)) w += ch.charCodeAt(0) > 0x2e80 ? size * 1.0 : size * 0.6
  return w
}
const eyeSees = (n, e) => n[0] * e[0] + n[1] * e[1] + n[2] * e[2] > 1e-9

// ── 그리는 순서: 구역/사무실 사이 (겹치지 않는 사각형 → 분리축으로 앞뒤 판단) ──
function orderObjects(objs, e) {
  const n = objs.length
  const behind = Array.from({ length: n }, () => new Set())     // behind[j] = j 보다 먼저 그려야 하는(= j 뒤에 있는) 것들
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = objs[i].rect, b = objs[j].rect
    let best = 0, dir = 0
    const axis = (aLow, aHigh, bLow, bHigh, ea) => {
      let gap = 0, d = 0
      if (aHigh <= bLow + 1e-6) { gap = bLow - aHigh; d = ea > 0 ? 1 : ea < 0 ? -1 : 0 }
      else if (bHigh <= aLow + 1e-6) { gap = aLow - bHigh; d = ea > 0 ? -1 : ea < 0 ? 1 : 0 }
      return { score: gap * Math.abs(ea) + (d ? 1e-9 : 0), d }
    }
    const X = axis(a.x, a.x + a.w, b.x, b.x + b.w, e[0])
    const Y = axis(a.y, a.y + a.h, b.y, b.y + b.h, e[1])
    for (const c of [X, Y]) if (c.d && c.score > best) { best = c.score; dir = c.d }
    if (dir === 1) behind[j].add(i); else if (dir === -1) behind[i].add(j)
  }
  const depth = objs.map(o => -((o.rect.x + o.rect.w / 2) * e[0] + (o.rect.y + o.rect.h / 2) * e[1]))
  const done = new Array(n).fill(false), out = []
  for (let k = 0; k < n; k++) {
    let pick = -1
    for (let i = 0; i < n; i++) {
      if (done[i]) continue
      let ready = true
      for (const d of behind[i]) if (!done[d]) { ready = false; break }
      if (ready && (pick < 0 || depth[i] > depth[pick])) pick = i
    }
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || depth[i] > depth[pick])) pick = i   // 순환이면 가장 먼 것
    done[pick] = true; out.push(objs[pick])
  }
  return out
}

/** 이름표끼리 겹치면 아래로 조금씩 밀어서 모두 읽히게 */
function separateLabels(labels) {
  const placed = []
  for (const l of labels) {
    const hit = p => Math.abs(p.x - l.x) < (p.w + l.w) / 2 && Math.abs(p.y - l.y) < (p.h + l.h) / 2
    for (let i = 0; i < 8 && placed.some(hit); i++) l.y += l.h + 2
    placed.push(l)
  }
}

// ═══════════════════════════════════════════════════════════
//  장면 만들기
//  opts: { palette, highlight:Set(박스id), focusId, activeZoneId }
// ═══════════════════════════════════════════════════════════
/** 박스 한 면(바깥 방향 n)의 한가운데에 쓸 번호를 면의 기울기에 맞춰 비스듬히 그릴 수 있게, 글자 칸(local 픽셀) → 화면 변환 행렬을 만듦.
 *  규칙(크기·방향·간격)은 기본 3D · Three.js 와 같은 faceText.js. 글자가 너무 작게 보이면 null */
function faceTextItem(P, bm, n, cs, alpha) {
  const L = faceLayout(bm, n, cs.length), c = L.center, h = L.th / 2, CH = TXT.CH
  const at = (u, v) => P.p(c[0] + L.tx[0] * u + L.ty[0] * v, c[1] + L.tx[1] * u + L.ty[1] * v, c[2] + L.tx[2] * u + L.ty[2] * v)
  const o = at(0, 0), rr = at(h, 0), ll = at(-h, 0), up = at(0, h), dn = at(0, -h)
  const ax = (rr[0] - ll[0]) / CH, ay = (rr[1] - ll[1]) / CH, bx = (dn[0] - up[0]) / CH, by = (dn[1] - up[1]) / CH          // 글자 칸의 가로(→) · 세로(↓) 한 칸이 화면에서 가리키는 방향
  const hpx = Math.hypot(bx, by) * CH, capPx = hpx * TXT.CAP
  if (capPx < 5) return null
  return { k: 'ftext', m: [ax, ay, bx, by, o[0], o[1]], cs, capPx, wpx: cs.length * TXT.CA * hpx, cx: o[0], cy: o[1], alpha: alpha * Math.min(1, (capPx - 5) / 4) }
}

export function buildScene(model, cam, vp, opts = {}) {
  const wh = model.warehouse
  /** @type {any[]} */
  const items = []
  const P = projector(cam, vp)
  if (!wh) return { items, B: P.B }
  const pal = opts.palette || DARK_PALETTE
  const hl = opts.highlight && opts.highlight.size ? opts.highlight : null
  const { e } = P.B
  const spread = opts.spread ?? SPREAD_DEFAULT, maxTier = opts.maxTier || 0, xa = opts.xray ? 0.4 : 1
  const W = wh.width, H = wh.height, wallH = wallHeight(model, spread), T = 0.35

  const poly = (pts, fill, stroke, lw, extra) => items.push({ k: 'poly', pts: flat(pts), fill, stroke, lw: lw || 1, ...extra, ...(opts.depth ? { dep: pts.map(q => q[2]) } : null) })
  const line = (x0, y0, x1, y1, stroke, lw) => items.push({ k: 'line', pts: [x0, y0, x1, y1], stroke, lw })

  // 1) 바닥
  poly([P.p(0, 0, 0), P.p(W, 0, 0), P.p(W, H, 0), P.p(0, H, 0)], pal.floor, pal.floorEdge, 2)
  if (cam.scale >= 5) {
    for (let x = 2; x < W - 0.01; x += 2) { const a = P.p(x, 0, 0), b = P.p(x, H, 0); line(a[0], a[1], b[0], b[1], pal.grid, 1) }
    for (let y = 2; y < H - 0.01; y += 2) { const a = P.p(0, y, 0), b = P.p(W, y, 0); line(a[0], a[1], b[0], b[1], pal.grid, 1) }
  }

  // 2) 뒤쪽 벽 (카메라에서 안쪽 면이 보이는 벽만)
  const WALLS = [
    { id: 'top', b: [-T, W + T, -T, 0], inner: [0, 1, 0] },
    { id: 'bottom', b: [-T, W + T, H, H + T], inner: [0, -1, 0] },
    { id: 'left', b: [-T, 0, 0, H], inner: [1, 0, 0] },
    { id: 'right', b: [W, W + T, 0, H], inner: [-1, 0, 0] },
  ]
  const isBack = {}
  for (const w of WALLS) {
    isBack[w.id] = eyeSees(w.inner, e)
    if (!isBack[w.id]) continue
    const c = cuboid(P, w.b[0], w.b[1], w.b[2], w.b[3], 0, wallH)
    for (const f of FACES) if (eyeSees(f.n, e)) poly(f.idx.map(i => c[i]), f.id === 'top' ? pal.wallRim : shade(pal.wall, f.f), shade(pal.wall, 0.7), 1)
  }
  // 창문 / 출입구
  for (const fx of model.fixtures) {
    if (fx.kind === 'office' || !fx.wall) continue
    const len = fixtureLen(fx.kind, W, H, fx.wall), pos = fx.pos ?? 0.5
    const horizontal = fx.wall === 'top' || fx.wall === 'bottom'
    const c0 = (horizontal ? pos * W : pos * H) - len / 2, c1 = c0 + len
    const z0 = fx.kind === 'window' ? wallH * 0.45 : 0, z1 = fx.kind === 'window' ? wallH * 0.82 : Math.min(wallH * 0.9, 4.4)
    const fill = fx.kind === 'window' ? pal.window : pal.door, edge = fx.kind === 'window' ? pal.windowEdge : pal.doorEdge
    const at = (c, z) => fx.wall === 'top' ? P.p(c, 0.02, z) : fx.wall === 'bottom' ? P.p(c, H - 0.02, z) : fx.wall === 'left' ? P.p(0.02, c, z) : P.p(W - 0.02, c, z)
    if (isBack[fx.wall]) {
      poly([at(c0, z0), at(c1, z0), at(c1, z1), at(c0, z1)], fill, edge, 1.5)
      if (fx.kind === 'window') {
        const m = (c0 + c1) / 2, zm = (z0 + z1) / 2
        const a = at(m, z0), b = at(m, z1), cc = at(c0, zm), d = at(c1, zm)
        line(a[0], a[1], b[0], b[1], edge, 1.2); line(cc[0], cc[1], d[0], d[1], edge, 1.2)
      } else {
        const k = at(c1 - len * 0.18, z1 * 0.45)
        items.push({ k: 'dot', x: k[0], y: k[1], r: Math.max(1.5, cam.scale * 0.07), fill: '#f6e3a1' })
      }
    } else {   // 앞쪽 벽은 그리지 않고, 바닥에 표시만
      const d = 0.55
      const fl = (c, dd) => fx.wall === 'top' ? P.p(c, dd, 0.01) : fx.wall === 'bottom' ? P.p(c, H - dd, 0.01) : fx.wall === 'left' ? P.p(dd, c, 0.01) : P.p(W - dd, c, 0.01)
      poly([fl(c0, 0), fl(c1, 0), fl(c1, d), fl(c0, d)], fill, edge, 1.5, { alpha: 0.9 })
    }
  }

  // 3) 구역 / 사무실 (앞뒤 순서대로)
  const objs = model.zones.map(z => ({ type: 'zone', z, rect: { x: z.x, y: z.y, w: z.w, h: z.h } }))
  for (const fx of model.fixtures) if (fx.kind === 'office') {
    objs.push({ type: 'office', fx, rect: officeRect({ x: fx.x ?? W / 2, y: fx.y ?? H / 2 }) })
  }
  const ordered = orderObjects(objs, e)
  const labels = []; let tagCands = []; let nBoxes = 0, nReadable = 0, readableIds = [], lod = false

  for (const o of ordered) {
    if (o.type === 'office') {
      const { x, y, w, h } = o.rect, bodyH = Math.min(wallH * 0.85, 3.8)
      const body = cuboid(P, x, x + w, y, y + h, 0, bodyH)
      for (const f of FACES) if (eyeSees(f.n, e)) poly(f.idx.map(i => body[i]), f.id === 'top' ? shade(pal.office, 1.1) : shade(pal.office, f.f), shade(pal.office, 0.6), 1)
      const roof = cuboid(P, x - 0.35, x + w + 0.35, y - 0.35, y + h + 0.35, bodyH, bodyH + 0.5)
      for (const f of FACES) if (eyeSees(f.n, e)) poly(f.idx.map(i => roof[i]), f.id === 'top' ? shade(pal.officeRoof, 1.15) : shade(pal.officeRoof, f.f), shade(pal.officeRoof, 0.6), 1)
      const top = P.p(x + w / 2, y + h / 2, bodyH + 0.5)
      labels.push({ k: 'pill', x: top[0], y: top[1] - 14, w: 0, h: 0, text: '사무실', size: 12, fill: pal.pillBg, color: pal.pillText, dot: pal.officeRoof, hit: null })
      continue
    }
    const z = o.z
    const active = opts.activeZoneId === z.id
    poly([P.p(z.x, z.y, 0), P.p(z.x + z.w, z.y, 0), P.p(z.x + z.w, z.y + z.h, 0), P.p(z.x, z.y + z.h, 0)],
      rgba(z.color, 0.42), active ? '#f59e0b' : shade(z.color, 0.78), active ? 3.2 : 1.6, { hit: { type: 'zone', id: z.id }, glow: active })
    // 칸 구분선 (빈 칸도 구조가 보이게)
    const mark = rgba(shade(z.color, 0.55), 0.55)
    z.lines.forEach((ln, li) => {
      const y0 = z.y + li * z.ch, y1 = y0 + z.ch, xe = z.x + ln.slot_count * z.cw
      const a = P.p(z.x, y0, 0), b = P.p(xe, y0, 0); line(a[0], a[1], b[0], b[1], mark, 1)
      const c = P.p(z.x, y1, 0), d = P.p(xe, y1, 0); line(c[0], c[1], d[0], d[1], mark, 1)
      for (let s = 0; s <= ln.slot_count; s++) { const p = P.p(z.x + s * z.cw, y0, 0), q = P.p(z.x + s * z.cw, y1, 0); line(p[0], p[1], q[0], q[1], mark, 1) }
    })
    // 박스: 먼 줄/칸부터, 아래층부터
    const G = tierGeom(z, spread), mx = z.cw * G.mf, my = z.ch * G.mf
    const lineOrder = z.lines.map((_, i) => i); if (e[1] < 0) lineOrder.reverse()
    for (const li of lineOrder) {
      const ln = z.lines[li]
      const slots = []; for (let s = 1; s <= ln.slot_count; s++) slots.push(s); if (e[0] < 0) slots.reverse()
      for (const s of slots) {
        const all = ln.stacks.get(s); if (!all) continue
        const st = maxTier ? all.filter(b => b.tier <= maxTier) : all          // 층 자르기: n층까지만 보이게
        if (!st.length) continue
        const x0 = z.x + (s - 1) * z.cw + mx, x1 = z.x + s * z.cw - mx, y0 = z.y + li * z.ch + my, y1 = z.y + (li + 1) * z.ch - my
        let prev = null
        for (let k = 0; k < st.length; k++) {
          const b = st[k], tier = b.tier
          const z0 = (tier - 1) * G.pz, z1 = z0 + G.boxH
          const c = cuboid(P, x0, x1, y0, y1, z0, z1)
          const isHl = hl && hl.has(b.id), isFocus = opts.focusId === b.id
          const alpha = (hl && !isHl ? 0.28 : 1) * (opts.xray && (isHl || isFocus) ? 2.2 : xa)
          if (prev && opts.links !== false) {                // 층 연결 점선: 아래 박스 윗면 ↔ 이 박스 아랫면 사이 빈 공간 (이 박스를 그리기 전에 그려서, 앞쪽 박스가 가리면 가려짐)
            const la = Math.max(prev.alpha, alpha)
            if (z0 - prev.z1 > Math.min(z.cw, z.ch) * 0.06 && la >= 0.4) { const a0 = P.p((x0 + x1) / 2, (y0 + y1) / 2, prev.z1), a1 = P.p((x0 + x1) / 2, (y0 + y1) / 2, z0); items.push({ k: 'line', pts: [a0[0], a0[1], a1[0], a1[1]], stroke: pal.link, casing: pal.linkCase, lw: 1.8, dash: [4, 4], alpha: 0.35 + 0.55 * Math.min(1, la), link: true, from: prev.id, to: b.id }) }
          }
          prev = { z1, alpha, id: b.id }
          const hit = { type: 'box', id: b.id }
          const stroke = isFocus ? '#ff4f93' : isHl ? '#f59e0b' : shade(z.color, 0.55)
          const lw = isFocus ? 3 : isHl ? 2.4 : 1
          const topHidden = st[k + 1]?.tier === tier + 1 && G.pz - G.boxH < 1e-6
          let topFace = null
          for (const f of FACES) {                       // 카메라 쪽을 보는 면은 모두 그림 (옆 박스와 붙어 있어도 투명하게 비지 않음)
            if (!eyeSees(f.n, e)) continue
            const pts = f.idx.map(i => c[i]), fl = flat(pts)
            poly(pts, f.id === 'top' ? shade(z.color, 1.1) : shade(z.color, f.f), stroke, lw, { alpha: Math.min(1, alpha), hit, glow: isHl || isFocus })
            if (f.id === 'top') {
              topFace = fl
              if (!topHidden) {
                const ym = (y0 + y1) / 2, dy = (y1 - y0) * 0.11, zt = z1 + 0.002
                poly([P.p(x0, ym - dy, zt), P.p(x1, ym - dy, zt), P.p(x1, ym + dy, zt), P.p(x0, ym + dy, zt)], 'rgba(255,255,255,0.55)', null, 0, { alpha: Math.min(1, alpha), hit })
              }
            }
          }
          const num = String(b.box_number); nBoxes++
          // 번호: 카메라 쪽을 보는 모든 면의 한가운데에, 면의 기울기에 맞춰 비스듬히 씀 (기본 3D · Three.js 와 같은 규칙)
          let rec = null; const cs = labelChars(num), bm = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cz: (z0 + z1) / 2, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0 }
          if (cs.length) for (const fn of FT_FACES) {
            if (!eyeSees(fn, e)) continue
            const it = faceTextItem(P, bm, fn, cs, Math.min(1, alpha)); if (!it) continue
            it.id = b.id; items.push(it); if (!rec || it.capPx > rec.h) rec = { idx: items.length - 1, cx: it.cx, cy: it.cy, w: it.wpx, h: it.capPx }
          }
          if (opts.allNumbers) {                         // 번호표 후보: 자기 면에서 읽히면 필요 없고, 가려졌거나 면이 너무 작은 박스에만 띄움
            const cp = P.p((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
            tagCands.push({ id: b.id, text: num, x: cp[0], y: cp[1], d: cp[2], hl: isHl || isFocus, alpha: hl && !isHl ? 0.35 : 1, rec, occ: 0, pitch: Math.min(z.cw, z.ch) * cam.scale })
          }
        }
      }
    }
    // 구역 이름표 (가까운 쪽 바닥)
    let lx, ly
    if (Math.abs(e[1]) >= Math.abs(e[0])) { lx = z.x + z.w / 2; ly = e[1] > 0 ? Math.min(H - 0.15, z.y + z.h + 0.45) : Math.max(0.15, z.y - 0.45) }
    else { ly = z.y + z.h / 2; lx = e[0] > 0 ? Math.min(W - 0.15, z.x + z.w + 0.45) : Math.max(0.15, z.x - 0.45) }
    const lp = P.p(lx, ly, 0)
    labels.push({ k: 'pill', x: lp[0], y: lp[1], w: 0, h: 0, text: z.name, size: 12, fill: pal.pillBg, color: pal.pillText, dot: z.color, hit: { type: 'zone', id: z.id } })
  }
  for (const l of labels) { l.w = textW(l.text, l.size) + 26; l.h = l.size + 10 }  // 이름표는 글자 크기를 알아야 폭이 정해져서 마지막에 채움
  separateLabels(labels)
  for (const l of labels) items.push(l)
  if (tagCands.length) {                                  // 번호표 (가려진 박스부터, 이미 놓인 번호표/구역 이름표와 겹치면 근처 빈자리로): 앞쪽 박스부터, 이미 놓인 번호표/구역 이름표와 겹치면 건너뜀 (확대하면 더 많이 보임)
    const CELL = 40, bucket = new Map(), keys = r => { const out = []; for (let gx = Math.floor((r.x - r.w / 2) / CELL); gx <= Math.floor((r.x + r.w / 2) / CELL); gx++) for (let gy = Math.floor((r.y - r.h / 2) / CELL); gy <= Math.floor((r.y + r.h / 2) / CELL); gy++) out.push(gx + ',' + gy); return out }
    const clash = r => keys(r).some(k => (bucket.get(k) || []).some(q => Math.abs(q.x - r.x) < (q.w + r.w) / 2 && Math.abs(q.y - r.y) < (q.h + r.h) / 2))
    const add = r => keys(r).forEach(k => { if (!bucket.has(k)) bucket.set(k, []); bucket.get(k).push(r) })
    labels.forEach(add)
    // 번호가 자기 면 위에서 실제로 읽히는지: 나중에 그려진 다른 박스가 글자 위를 덮고 있으면 가려진 것 → 번호표가 필요
    const BK = 48, pg = new Map(), pk = (x, y) => Math.floor(x / BK) + ',' + Math.floor(y / BK)
    items.forEach((it, i) => {
      if (it.k !== 'poly' || it.hit?.type !== 'box' || !it.stroke) return
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      for (let j = 0; j < it.pts.length; j += 2) { x0 = Math.min(x0, it.pts[j]); x1 = Math.max(x1, it.pts[j]); y0 = Math.min(y0, it.pts[j + 1]); y1 = Math.max(y1, it.pts[j + 1]) }
      const q = { i, id: it.hit.id, pts: it.pts, x0, x1, y0, y1 }
      for (let gx = Math.floor(x0 / BK); gx <= Math.floor(x1 / BK); gx++) for (let gy = Math.floor(y0 / BK); gy <= Math.floor(y1 / BK); gy++) { const k = gx + ',' + gy; if (!pg.has(k)) pg.set(k, []); pg.get(k).push(q) }
    })
    const covered = (rec, id, x, y) => (pg.get(pk(x, y)) || []).some(q => q.i > rec.idx && q.id !== id && x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1 && inPoly(q.pts, x, y))
    for (const c of tagCands) {
      if (!c.rec) continue
      const r = c.rec, hw = r.w / 2, hh = r.h / 2
      const hits = [[r.cx, r.cy], [r.cx - hw, r.cy - hh], [r.cx + hw, r.cy - hh], [r.cx - hw, r.cy + hh], [r.cx + hw, r.cy + hh]].map(([x, y]) => covered(r, c.id, x, y))
      c.occ = hits[0] || hits.filter(Boolean).length >= 2 ? 1 : 0
    }
    readableIds = tagCands.filter(c => c.rec && !c.occ).map(c => c.id); nReadable = readableIds.length
    tagCands = tagCands.filter(c => !c.rec || c.occ)                 // 자기 면에서 읽히는 박스는 번호표 불필요
    const before = tagCands.length
    tagCands = tagCands.filter(c => c.hl || c.pitch >= TAG_MIN_PITCH)  // 박스가 화면에서 너무 작으면 번호표를 생략 (확대하면 나타남). 검색/선택한 박스는 예외
    lod = tagCands.length < before
    tagCands.sort((p, q) => (q.hl - p.hl) || (q.occ - p.occ) || (p.d - q.d))   // 강조된(검색된) 박스 → 가려진 박스 → 앞쪽 박스 순
    const SIZES = [{ f: 11, pad: 12, h: 17 }, { f: 9, pad: 9, h: 14 }]      // 자리가 없으면 작은 글자로 한 번 더
    const OFFS = []; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) OFFS.push([i * 0.5, j * 0.5])
    OFFS.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]))     // 제자리 → 가까운 빈자리 순
    for (const c of tagCands) {
      let done = false
      for (const S of SIZES) {
        const w = textW(c.text, S.f) + S.pad, h = S.h, gx = w + 3, gy = h + 3
        for (const [fx, fy] of OFFS) {
          const ox = fx * gx, oy = fy * gy
          if (Math.hypot(ox, oy) > 56) continue                   // 원래 박스에서 너무 멀리 밀려난 번호표는 헷갈리니 놓지 않음
          const r = { x: c.x + ox, y: c.y + oy, w, h }
          if (r.x < -w || r.y < -h || r.x > vp.w + w || r.y > vp.h + h || clash(r)) continue
          add(r); items.push({ k: 'tag', ...r, text: c.text, size: S.f, hl: c.hl, fill: pal.pillBg, color: pal.pillText, alpha: c.alpha, lead: Math.hypot(ox, oy) > 6 ? [c.x, c.y] : null, hit: { type: 'box', id: c.id } }); done = true; break
        }
        if (done) break
      }
    }
  }
  return { items, B: P.B, stats: { boxes: nBoxes, readable: nReadable, readableIds, lod, tags: items.filter(i => i.k === 'tag').length } }
}

// ── 클릭한 곳에 뭐가 있나 (가장 위에 그려진 것) ──
function inPoly(pts, x, y) {
  let c = false
  for (let i = 0, n = pts.length / 2, j = n - 1; i < n; j = i++) {
    const xi = pts[2 * i], yi = pts[2 * i + 1], xj = pts[2 * j], yj = pts[2 * j + 1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
export function hitTest(scene, x, y) {
  for (let i = scene.items.length - 1; i >= 0; i--) {
    const it = scene.items[i]
    if (!it.hit) continue
    if (it.k === 'poly' && inPoly(it.pts, x, y)) return it.hit
    if ((it.k === 'pill' || it.k === 'tag') && x >= it.x - it.w / 2 && x <= it.x + it.w / 2 && y >= it.y - it.h / 2 && y <= it.y + it.h / 2) return it.hit
  }
  return null
}

// ── 캔버스에 그리기 ──
const FONT = "'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif"
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}
export function drawScene(ctx, scene, vp, opts = {}) {
  const pulse = opts.pulse || 0
  ctx.clearRect(0, 0, vp.w, vp.h)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  for (const it of scene.items) {
    ctx.globalAlpha = it.alpha ?? 1
    if (it.k === 'poly') {
      ctx.beginPath(); ctx.moveTo(it.pts[0], it.pts[1])
      for (let i = 2; i < it.pts.length; i += 2) ctx.lineTo(it.pts[i], it.pts[i + 1])
      ctx.closePath()
      ctx.fillStyle = it.fill; ctx.fill()
      if (it.stroke && it.lw) {
        if (it.glow) { ctx.shadowColor = it.stroke; ctx.shadowBlur = 8 + 8 * pulse }
        ctx.strokeStyle = it.stroke; ctx.lineWidth = it.lw + (it.glow ? 1.2 * pulse : 0); ctx.stroke()
        ctx.shadowBlur = 0
      }
    } else if (it.k === 'line') {
      ctx.beginPath(); ctx.moveTo(it.pts[0], it.pts[1]); ctx.lineTo(it.pts[2], it.pts[3])
      if (it.dash) ctx.setLineDash(it.dash)
      if (it.casing) { ctx.strokeStyle = it.casing; ctx.lineWidth = it.lw + 2.4; ctx.stroke() }          // 점선 바깥 테두리 (밝은 면 위에서도 보이게)
      ctx.strokeStyle = it.stroke; ctx.lineWidth = it.lw; ctx.stroke(); if (it.dash) ctx.setLineDash([])
    } else if (it.k === 'ftext') {                  // 면 위의 번호: 면의 기울기대로 기울여 그림 (흰 테두리 → 글자 순서)
      const CH = TXT.CH, adv = TXT.CA * CH, base = (TXT.BASE - 0.5) * CH, lim = TXT.CW * TXT.SQ - CH * 0.1, ink = `rgb(${TXT.INK.join(',')})`
      ctx.save(); ctx.transform(it.m[0], it.m[1], it.m[2], it.m[3], it.m[4], it.m[5]); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.font = `900 ${Math.round(CH * 0.66)}px ${GLYPH_FONT}`
      it.cs.forEach((ch, i) => {
        const w = ctx.measureText(ch).width; ctx.save(); ctx.translate((i - (it.cs.length - 1) / 2) * adv, base); ctx.scale(w > lim ? lim / w : 1, 1)
        ctx.lineWidth = CH * 0.105; ctx.strokeStyle = '#ffffff'; ctx.strokeText(ch, 0, 0); ctx.fillStyle = ink; ctx.fillText(ch, 0, 0); ctx.lineWidth = CH * 0.03; ctx.strokeStyle = ink; ctx.strokeText(ch, 0, 0); ctx.restore()
      })
      ctx.restore()
    } else if (it.k === 'dot') {
      ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.fillStyle = it.fill; ctx.fill()
    } else if (it.k === 'text') {
      ctx.font = `${it.bold ? '700 ' : ''}${it.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = it.color; ctx.fillText(it.text, it.x, it.y)
    } else if (it.k === 'tag') {
      if (it.lead) { ctx.beginPath(); ctx.moveTo(it.lead[0], it.lead[1]); ctx.lineTo(it.x, it.y); ctx.lineWidth = 1.2; ctx.strokeStyle = it.hl ? '#f59e0b' : 'rgba(255,255,255,0.55)'; ctx.stroke(); ctx.beginPath(); ctx.arc(it.lead[0], it.lead[1], 2.2, 0, Math.PI * 2); ctx.fillStyle = it.hl ? '#f59e0b' : '#ffffff'; ctx.fill() }
      rr(ctx, it.x - it.w / 2, it.y - it.h / 2, it.w, it.h, it.h / 2); ctx.fillStyle = it.fill; ctx.fill()
      ctx.lineWidth = it.hl ? 2.2 : 1; ctx.strokeStyle = it.hl ? '#f59e0b' : 'rgba(0,0,0,0.28)'; ctx.stroke()
      ctx.font = `700 ${it.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = it.color; ctx.fillText(it.text, it.x, it.y + 0.5)
    } else if (it.k === 'pill') {
      ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2
      rr(ctx, it.x - it.w / 2, it.y - it.h / 2, it.w, it.h, it.h / 2); ctx.fillStyle = it.fill; ctx.fill()
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
      ctx.beginPath(); ctx.arc(it.x - it.w / 2 + 11, it.y, 4, 0, Math.PI * 2); ctx.fillStyle = it.dot; ctx.fill()
      ctx.font = `700 ${it.size}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = it.color; ctx.fillText(it.text, it.x - it.w / 2 + 20, it.y + 0.5)
    }
  }
  ctx.globalAlpha = 1
}

// ── SVG 로 내보내기 (브라우저 없이 결과를 확인하는 테스트용) ──
export function sceneToSvg(scene, vp, bg) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${vp.w}" height="${vp.h}" viewBox="0 0 ${vp.w} ${vp.h}"><rect width="100%" height="100%" fill="${bg}"/>`]
  for (const it of scene.items) {
    const a = it.alpha != null && it.alpha !== 1 ? ` opacity="${it.alpha}"` : ''
    if (it.k === 'poly') {
      const p = []; for (let i = 0; i < it.pts.length; i += 2) p.push(`${it.pts[i].toFixed(1)},${it.pts[i + 1].toFixed(1)}`)
      o.push(`<polygon points="${p.join(' ')}" fill="${it.fill}"${it.stroke && it.lw ? ` stroke="${it.stroke}" stroke-width="${it.lw}" stroke-linejoin="round"` : ''}${a}/>`)
    } else if (it.k === 'line') o.push(`<line x1="${it.pts[0]}" y1="${it.pts[1]}" x2="${it.pts[2]}" y2="${it.pts[3]}" stroke="${it.stroke}" stroke-width="${it.lw}"${it.dash ? ` stroke-dasharray="${it.dash.join(' ')}"` : ''}${a}/>`)
    else if (it.k === 'ftext') { const CH = TXT.CH, adv = TXT.CA * CH; o.push(`<g transform="matrix(${it.m.join(' ')})"${a}>${it.cs.map((ch, i) => `<text x="${((i - (it.cs.length - 1) / 2) * adv).toFixed(2)}" y="${((TXT.BASE - 0.5) * CH).toFixed(2)}" font-size="${Math.round(CH * 0.66)}" font-weight="900" text-anchor="middle" font-family="sans-serif" stroke="#fff" stroke-width="${(CH * 0.105).toFixed(1)}" fill="rgb(${TXT.INK.join(',')})" paint-order="stroke">${esc(ch)}</text>`).join('')}</g>`) }
    else if (it.k === 'dot') o.push(`<circle cx="${it.x}" cy="${it.y}" r="${it.r}" fill="${it.fill}"/>`)
    else if (it.k === 'text') o.push(`<text x="${it.x}" y="${it.y}" font-size="${it.size}" font-weight="700" fill="${it.color}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif"${a}>${esc(it.text)}</text>`)
    else if (it.k === 'tag') o.push(`${it.lead ? `<line x1="${it.lead[0]}" y1="${it.lead[1]}" x2="${it.x}" y2="${it.y}" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>` : ''}<rect x="${it.x - it.w / 2}" y="${it.y - it.h / 2}" width="${it.w}" height="${it.h}" rx="${it.h / 2}" fill="${it.fill}" stroke="${it.hl ? '#f59e0b' : 'rgba(0,0,0,0.28)'}"${a}/><text x="${it.x}" y="${it.y}" font-size="${it.size}" font-weight="700" fill="${it.color}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif"${a}>${esc(it.text)}</text>`)
    else if (it.k === 'pill') {
      o.push(`<rect x="${it.x - it.w / 2}" y="${it.y - it.h / 2}" width="${it.w}" height="${it.h}" rx="${it.h / 2}" fill="${it.fill}" stroke="rgba(0,0,0,0.15)"/><circle cx="${it.x - it.w / 2 + 11}" cy="${it.y}" r="4" fill="${it.dot}"/><text x="${it.x - it.w / 2 + 20}" y="${it.y}" font-size="${it.size}" font-weight="700" fill="${it.color}" dominant-baseline="central" font-family="sans-serif">${esc(it.text)}</text>`)
    }
  }
  o.push('</svg>'); return o.join('')
}

// ═══════════════════════════════════════════════════════════
//  카메라
// ═══════════════════════════════════════════════════════════
export function fitCamera(cam, model, vp, margin = 0.88, spread = SPREAD_DEFAULT) {
  const wh = model.warehouse; if (!wh) return cam
  const W = wh.width, H = wh.height, wallH = Math.max(wallHeight(model, spread), stackHeight(model, spread)), T = 0.35
  const t = { ...cam, scale: 1, panX: 0, panY: 0, tx: W / 2, ty: H / 2, tz: 0 }
  const P = projector(t, { w: 0, h: 0 })
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const x of [-T, W + T]) for (const y of [-T, H + T]) for (const z of [0, wallH]) {
    const [sx, sy] = P.p(x, y, z); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
  }
  const scale = clamp(Math.min((vp.w * margin) / (x1 - x0 || 1), (vp.h * margin) / (y1 - y0 || 1)), SCALE_MIN, SCALE_MAX)
  return { ...t, scale, panX: -scale * (x0 + x1) / 2, panY: -scale * (y0 + y1) / 2 }
}
export function defaultCamera(model, vp, spread = SPREAD_DEFAULT) {
  return fitCamera({ yaw: Math.PI / 2 - 0.55, pitch: 0.78, scale: 10, panX: 0, panY: 0, tx: 0, ty: 0, tz: 0 }, model, vp, 0.88, spread)
}
export function zoomCamera(cam, factor, vp, ax, ay) {
  const s2 = clamp(cam.scale * factor, SCALE_MIN, SCALE_MAX)
  const px = ax ?? vp.w / 2, py = ay ?? vp.h / 2
  const qx = (px - vp.w / 2 - cam.panX) / cam.scale, qy = (py - vp.h / 2 - cam.panY) / cam.scale
  return { ...cam, scale: s2, panX: px - vp.w / 2 - s2 * qx, panY: py - vp.h / 2 - s2 * qy }
}
/** 바닥을 끌어서 옮기기: 화면에서 (dx, dy)만큼 끌면 바닥 위의 점이 커서를 따라옴 → 좌우·앞뒤로 이동 (시점은 그대로) */
export function panGround(cam, dx, dy) {
  const { r, u } = basis(cam), s = cam.scale, det = Math.max(Math.sin(cam.pitch), 0.25)       // 거의 수평으로 볼 때는 앞뒤 이동이 과해지지 않게
  const gx = (-u[1] * dx / s - r[1] * dy / s) / det, gy = (u[0] * dx / s + r[0] * dy / s) / det
  return { ...cam, tx: cam.tx - gx, ty: cam.ty - gy }
}
export function rotateCamera(cam, dyaw, dpitch) {
  return { ...cam, yaw: cam.yaw + dyaw, pitch: clamp(cam.pitch + dpitch, PITCH_MIN, PITCH_MAX) }
}
/** 구역이나 박스가 화면 가운데에 크게 오도록 */
export function focusCamera(cam, model, target, vp, spread = SPREAD_DEFAULT) {
  const zone = target.boxId ? model.zonesById.get(model.boxesById.get(target.boxId)?.zone_id) : model.zonesById.get(target.zoneId)
  if (!zone) return cam
  const box = target.boxId ? model.boxesById.get(target.boxId) : null
  const G = tierGeom(zone, spread), bh = G.pz
  let cx = zone.x + zone.w / 2, cy = zone.y + zone.h / 2, cz = Math.min(zone.tiers * bh, 8) * 0.35
  if (box) { cx = zone.x + (box.slot_no - 0.5) * zone.cw; cy = zone.y + (box.lineIdx + 0.5) * zone.ch; cz = (box.tier - 1) * G.pz + G.boxH / 2 }
  const t = { ...cam, scale: 1, panX: 0, panY: 0, tx: cx, ty: cy, tz: cz }
  const P = projector(t, { w: 0, h: 0 })
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const x of [zone.x, zone.x + zone.w]) for (const y of [zone.y, zone.y + zone.h]) for (const z of [0, zone.tiers * bh]) {
    const [sx, sy] = P.p(x, y, z); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
  }
  const w = Math.max(x1 - x0, y1 - y0 > 0 ? 1 : 1), h = Math.max(y1 - y0, 1)
  const scale = clamp(Math.min((vp.w * 0.6) / w, (vp.h * 0.6) / h), SCALE_MIN, SCALE_MAX)
  return { ...t, scale, panX: 0, panY: 0 }
}
