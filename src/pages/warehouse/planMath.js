// ═══════════════════════════════════════════════════════════
//  평면도 좌표 계산 (순수 함수) — 화면 ↔ 월드 변환, 확대/이동/회전, 드래그 규칙
//  view = { cx, cy, zoom, rot }  cx,cy: 화면 가운데에 보이는 월드 좌표, rot: 도(°)
//  SVG 변환식과 같음:  translate(vw/2,vh/2) rotate(rot) scale(zoom) translate(-cx,-cy)
// ═══════════════════════════════════════════════════════════
import { clamp, snap, normRect } from './whLogic'

export const ZOOM_MIN = 2, ZOOM_MAX = 140
const rad = d => (d * Math.PI) / 180

export function w2s(view, vw, vh, x, y) {
  const dx = (x - view.cx) * view.zoom, dy = (y - view.cy) * view.zoom
  const c = Math.cos(rad(view.rot)), s = Math.sin(rad(view.rot))
  return [vw / 2 + dx * c - dy * s, vh / 2 + dx * s + dy * c]
}
export function s2w(view, vw, vh, sx, sy) {
  const dx = sx - vw / 2, dy = sy - vh / 2
  const c = Math.cos(rad(view.rot)), s = Math.sin(rad(view.rot))
  return [view.cx + (dx * c + dy * s) / view.zoom, view.cy + (-dx * s + dy * c) / view.zoom]
}
export const viewTransform = (view, vw, vh) =>
  `translate(${vw / 2} ${vh / 2}) rotate(${view.rot}) scale(${view.zoom}) translate(${-view.cx} ${-view.cy})`

/** 화면의 (sx,sy) 아래에 있는 월드 점이 그대로 있도록 확대/축소 */
export function zoomAt(view, vw, vh, sx, sy, factor) {
  const zoom = clamp(view.zoom * factor, ZOOM_MIN, ZOOM_MAX)
  const [wx, wy] = s2w(view, vw, vh, sx, sy)
  const [ux, uy] = s2w({ cx: 0, cy: 0, zoom, rot: view.rot }, vw, vh, sx, sy)
  return { ...view, zoom, cx: wx - ux, cy: wy - uy }
}
/** 손가락(마우스)을 (dx,dy)만큼 끌면 내용이 따라오도록 */
export function panByScreen(view, vw, vh, dx, dy) {
  const [cx, cy] = s2w(view, vw, vh, vw / 2 - dx, vh / 2 - dy)
  return { ...view, cx, cy }
}
export function rotateView(view, deg) { return { ...view, rot: ((view.rot + deg) % 360 + 360) % 360 } }

/** 월드의 사각형이 화면에 꼭 맞게 */
export function fitView(rect, vw, vh, rot = 0, margin = 0.9) {
  const c = Math.cos(rad(rot)), s = Math.sin(rad(rot))
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of [[0, 0], [rect.w, 0], [rect.w, rect.h], [0, rect.h]]) {
    const rx = x * c - y * s, ry = x * s + y * c
    minX = Math.min(minX, rx); maxX = Math.max(maxX, rx); minY = Math.min(minY, ry); maxY = Math.max(maxY, ry)
  }
  const zoom = clamp(Math.min((vw * margin) / Math.max(maxX - minX, 1e-6), (vh * margin) / Math.max(maxY - minY, 1e-6)), ZOOM_MIN, ZOOM_MAX)
  return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, zoom, rot }
}

// ── 드래그 규칙 ─────────────────────────────────────────────
/** 구역 옮기기: 격자에 맞추고 창고 안으로 */
export function moveRect(orig, dx, dy, bounds, step) {
  return { ...orig, x: clamp(snap(orig.x + dx, step), 0, Math.max(0, bounds.w - orig.w)), y: clamp(snap(orig.y + dy, step), 0, Math.max(0, bounds.h - orig.h)) }
}
/** 오른쪽 아래 모서리로 크기 바꾸기 */
export function resizeRect(orig, dx, dy, bounds, step, min) {
  const bw = bounds ? bounds.w - orig.x : Infinity, bh = bounds ? bounds.h - orig.y : Infinity
  return { ...orig, w: clamp(snap(orig.w + dx, step), Math.min(min, bw), bw), h: clamp(snap(orig.h + dy, step), Math.min(min, bh), bh) }
}
/** 끌어서 새 사각형 그리기 (bounds 가 있으면 그 안으로) */
export function drawRect(a, b, bounds, step) {
  let [x1, y1, x2, y2] = [snap(a[0], step), snap(a[1], step), snap(b[0], step), snap(b[1], step)]
  if (bounds) { x1 = clamp(x1, 0, bounds.w); x2 = clamp(x2, 0, bounds.w); y1 = clamp(y1, 0, bounds.h); y2 = clamp(y2, 0, bounds.h) }
  return normRect(x1, y1, x2, y2)
}
/** 구역들이 차지하는 범위 (창고를 이보다 작게 줄일 수 없음) */
export const zoneExtent = zones => ({ left: Math.min(...zones.map(z => z.x)), top: Math.min(...zones.map(z => z.y)), right: Math.max(...zones.map(z => z.x + z.w)), bottom: Math.max(...zones.map(z => z.y + z.h)) })
/** 창고 가장자리/모서리(edge: n e s w ne se sw nw)를 (dx, dy)만큼 끌었을 때의 새 범위 {x0,y0,x1,y1}.
 *  step 단위로 맞추고, 최소/최대 크기를 지키며, 구역이 있는 곳까지는 줄이지 않음 */
export function resizeBounds(orig, edge, dx, dy, ext, lim, step = 0.5) {
  const sn = v => Math.round(v / step) * step, cl = (v, a, b) => Math.max(a, Math.min(b, v))      // 범위가 뒤집히면 앞(a)이 이김
  let { x0, y0, x1, y1 } = orig
  if (edge.includes('w')) x0 = sn(orig.x0 + dx)
  if (edge.includes('e')) x1 = sn(orig.x1 + dx)
  if (edge.includes('n')) y0 = sn(orig.y0 + dy)
  if (edge.includes('s')) y1 = sn(orig.y1 + dy)
  if (edge.includes('e')) x1 = cl(x1, Math.max(x0 + lim.minW, ext ? ext.right : -Infinity), x0 + lim.maxW)
  if (edge.includes('w')) x0 = cl(x0, x1 - lim.maxW, Math.min(x1 - lim.minW, ext ? ext.left : Infinity))
  if (edge.includes('s')) y1 = cl(y1, Math.max(y0 + lim.minH, ext ? ext.bottom : -Infinity), y0 + lim.maxH)
  if (edge.includes('n')) y0 = cl(y0, y1 - lim.maxH, Math.min(y1 - lim.minH, ext ? ext.top : Infinity))
  return { x0, y0, x1, y1 }
}
/** (월드 좌표) 점이 들어 있는 구역 */
export const zoneAt = (zones, wx, wy) => zones.find(z => wx >= z.x && wx <= z.x + z.w && wy >= z.y && wy <= z.y + z.h) || null
/** 구역 안에서 (월드 좌표) 어느 줄/칸인지 */
export function cellAt(zone, wx, wy) {
  if (wx < zone.x || wy < zone.y || wx > zone.x + zone.w || wy > zone.y + zone.h) return null
  const li = Math.min(zone.lines.length - 1, Math.floor((wy - zone.y) / zone.ch))
  const slot = Math.min(zone.maxSlots, Math.floor((wx - zone.x) / zone.cw) + 1)
  const ln = zone.lines[li]
  if (!ln || slot > ln.slot_count) return { lineIdx: li, slot: null }
  return { lineIdx: li, slot }
}
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
