// ═══════════════════════════════════════════════════════════
//  상품찾기(창고) — 순수 로직 (화면/DB 와 무관, 테스트 가능)
//  좌표 단위: "칸" (창고 가로·세로, 구역 위치·크기 모두 이 단위)
// ═══════════════════════════════════════════════════════════

export const MIN_ZONE = 2          // 구역 최소 크기
export const SNAP = 0.5            // 구역/시설물 위치 맞춤 단위
export const LIMITS = {
  slots: [1, 60],                  // 한 줄에 놓을 박스 수
  lines: [1, 40],                  // 줄 수
  tiers: [1, 12],                  // 층수
  whMin: [8, 6],
  whMax: [150, 150],
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const snap = (v, step = SNAP) => Math.round(v / step) * step
export const round2 = v => Math.round(v * 100) / 100

// ── 색상 ────────────────────────────────────────────────────
export const ZONE_COLORS = [
  '#7dd3fc', '#fda4af', '#fcd34d', '#86efac', '#c4b5fd', '#fdba74',
  '#5eead4', '#f9a8d4', '#a5b4fc', '#bef264', '#fca5a5', '#93c5fd',
]

export function hexToRgb(h) {
  const s = String(h || '#999999').replace('#', '')
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s
  const n = parseInt(f, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
/** f<1 어둡게, f>1 밝게(흰색 쪽으로) */
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex)
  if (f <= 1) return rgbToHex(r * f, g * f, b * f)
  const t = Math.min(1, f - 1)
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t)
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b)
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t)
}
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})` }
function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255)
}
/** 아직 다른 구역이 쓰지 않는 색 (구역마다 색이 달라야 함) */
export function pickFreeColor(zones) {
  const used = new Set(zones.map(z => String(z.color).toLowerCase()))
  const free = ZONE_COLORS.find(c => !used.has(c))
  if (free) return free
  for (let h = 0; h < 360; h += 17) { const c = hslToHex(h, 70, 78); if (!used.has(c)) return c }
  return ZONE_COLORS[0]
}
export function nextZoneName(zones) {
  const used = new Set(zones.map(z => z.name))
  for (let i = 0; i < 26; i++) { const n = String.fromCharCode(65 + i) + '구역'; if (!used.has(n)) return n }
  let k = 27; while (used.has(`구역${k}`)) k++
  return `구역${k}`
}

// ── 사각형 ──────────────────────────────────────────────────
export function normRect(x1, y1, x2, y2) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}
export function overlaps(a, b) {
  const e = 1e-6
  return a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.h - e && b.y < a.y + a.h - e
}
export function insideRect(r, W, H) {
  const e = 1e-6
  return r.x >= -e && r.y >= -e && r.x + r.w <= W + e && r.y + r.h <= H + e
}
export const OFFICE_W = 6, OFFICE_H = 4.9           // 사무실 크기 (예전 3.2 × 2.6 의 약 1.9배)
export const officeRect = f => ({ x: (f.x ?? 0) - OFFICE_W / 2, y: (f.y ?? 0) - OFFICE_H / 2, w: OFFICE_W, h: OFFICE_H })

/** 구역 위치/크기가 올바른지: 창고 안, 최소 크기, 다른 구역·사무실과 겹치지 않음 */
export function checkZoneRect(rect, model, exceptId) {
  const wh = model.warehouse
  if (!wh) return { ok: false, reason: 'no-warehouse' }
  if (rect.w < MIN_ZONE - 1e-6 || rect.h < MIN_ZONE - 1e-6) return { ok: false, reason: 'too-small' }
  if (!insideRect(rect, wh.width, wh.height)) return { ok: false, reason: 'outside' }
  for (const z of model.zones) if (z.id !== exceptId && overlaps(rect, z)) return { ok: false, reason: 'overlap', with: z }
  for (const f of model.fixtures) if (f.kind === 'office' && overlaps(rect, officeRect(f))) return { ok: false, reason: 'office' }
  return { ok: true }
}
/** 사무실을 놓을 수 있는 자리인지: 창고 안, 구역/다른 사무실과 겹치지 않음 */
export function checkOfficeSpot(pt, model, exceptId) {
  const wh = model.warehouse
  if (!wh) return { ok: false, reason: 'no-warehouse' }
  const r = officeRect(pt)
  if (!insideRect(r, wh.width, wh.height)) return { ok: false, reason: 'outside' }
  for (const z of model.zones) if (overlaps(r, z)) return { ok: false, reason: 'office-on-zone' }
  for (const f of model.fixtures) if (f.kind === 'office' && f.id !== exceptId && overlaps(r, officeRect(f))) return { ok: false, reason: 'office-on-office' }
  return { ok: true }
}
export const REASON_TEXT = {
  'too-small': '구역이 너무 작아요',
  outside: '창고 밖으로 나갈 수 없어요',
  overlap: '다른 구역과 겹쳐요',
  office: '사무실과 겹쳐요',
  'office-on-zone': '구역과 겹치지 않는 곳에 놓아주세요',
  'office-on-office': '다른 사무실과 겹쳐요',
  'no-warehouse': '먼저 창고를 그려주세요',
  'wh-small': `창고가 너무 작아요 (최소 ${LIMITS.whMin[0]} × ${LIMITS.whMin[1]} m)`,
  'wh-big': `창고가 너무 커요 (최대 ${LIMITS.whMax[0]} × ${LIMITS.whMax[1]} m)`,
  'zone-out': '구역이 창고 밖으로 나가요. 먼저 구역을 옮기거나 줄여주세요',
}

// ── 시설물(창문/출입구/사무실) ───────────────────────────────
export const FIXTURE_LABEL = { window: '창문', door: '출입구', office: '사무실' }
export const FIXTURE_SIZE = { window: 2.4, door: 4.6 }      // 벽 따라 차지하는 길이 (출입문은 예전 2.2 의 2배)
export function fixtureLen(kind, W, H, wall) {
  const wallLen = (wall === 'top' || wall === 'bottom') ? W : H
  return Math.min(FIXTURE_SIZE[kind] || 2, wallLen * 0.35)
}
/** 월드 좌표 한 점 → 가장 가까운 벽과 벽 위 위치(0~1) */
export function snapToWall(pt, W, H) {
  const d = { top: pt.y, bottom: H - pt.y, left: pt.x, right: W - pt.x }
  let wall = 'top'
  for (const k of ['bottom', 'left', 'right']) if (d[k] < d[wall]) wall = k
  const horizontal = wall === 'top' || wall === 'bottom'
  const pos = clamp(horizontal ? pt.x / W : pt.y / H, 0.04, 0.96)
  return { wall, pos: round2(pos) }
}
/** 시설물의 월드 위치 */
export function fixtureAnchor(f, W, H) {
  if (f.kind === 'office') return { x: f.x ?? W / 2, y: f.y ?? H / 2, wall: null }
  const pos = f.pos ?? 0.5
  switch (f.wall) {
    case 'bottom': return { x: pos * W, y: H, wall: 'bottom' }
    case 'left': return { x: 0, y: pos * H, wall: 'left' }
    case 'right': return { x: W, y: pos * H, wall: 'right' }
    default: return { x: pos * W, y: 0, wall: 'top' }
  }
}

// ── 박스 번호 ───────────────────────────────────────────────
export const normNumber = s => String(s ?? '').trim().replace(/\s+/g, ' ')
export const numberKey = s => normNumber(s).toLowerCase()
/** 번호를 정하지 않았을 때 기본값: 지금 있는 숫자 번호 중 가장 큰 값 + 1 */
export function nextBoxNumber(boxes) {
  let max = 0
  for (const b of boxes) {
    const s = normNumber(b.box_number)
    if (/^\d{1,9}$/.test(s)) max = Math.max(max, parseInt(s, 10))
  }
  return String(max + 1)
}
export function findBoxByNumber(boxes, number, exceptId) {
  const k = numberKey(number)
  return boxes.find(b => b.id !== exceptId && numberKey(b.box_number) === k) || null
}

// ── 박스 안 상품 식별 (SKU 가 다시 만들어져도 같은 옵션이면 같은 상품) ──
export const itemKey = i => `${i.product_id || '_'}|${normNumber(i.opt1)}|${normNumber(i.opt2)}`

// ═══════════════════════════════════════════════════════════
//  원본(DB 행) → 화면용 모델
// ═══════════════════════════════════════════════════════════
export const emptyRaw = () => ({ warehouse: null, fixtures: [], zones: [], lines: [], boxes: [], items: [] })

/**
 * live: { loaded:boolean, map: Map(itemKey → {name,label,image_url,stock}) }  (상품 현재 정보, 없어도 됨)
 */
export function buildModel(raw, live) {
  const liveMap = live?.map, liveLoaded = !!live?.loaded, liveProducts = live?.products   // products: 현재 정보를 조회한 상품 id 모음
  const itemsByBox = new Map()
  const placed = new Map()                                   // 옵션(상품+옵션값)별로 모든 박스에 담긴 수량 합계
  for (const it of raw.items) { const k = itemKey(it); placed.set(k, (placed.get(k) || 0) + (it.quantity || 0)) }
  for (const it of raw.items) {
    const lv = liveMap?.get(itemKey(it))
    const dec = {
      ...it,
      name: lv?.name ?? it.product_name ?? '(이름 없음)',
      label: lv?.label ?? it.option_label ?? '',
      image: lv?.image_url ?? it.image_url ?? null,
      stock: lv?.stock ?? null,
      placed: placed.get(itemKey(it)) || 0,
      removed: liveLoaded && !lv && (!liveProducts || liveProducts.has(it.product_id)),
    }
    if (!itemsByBox.has(it.box_id)) itemsByBox.set(it.box_id, [])
    itemsByBox.get(it.box_id).push(dec)
  }
  const linesByZone = new Map(), boxesByLine = new Map()
  for (const l of raw.lines) { if (!linesByZone.has(l.zone_id)) linesByZone.set(l.zone_id, []); linesByZone.get(l.zone_id).push(l) }
  for (const b of raw.boxes) { if (!boxesByLine.has(b.line_id)) boxesByLine.set(b.line_id, []); boxesByLine.get(b.line_id).push(b) }

  const boxes = [], boxesById = new Map(), zonesById = new Map(), linesById = new Map()
  const zones = raw.zones.map(z => {
    const ls = (linesByZone.get(z.id) || []).slice().sort((a, b) => a.position - b.position)
    const lines = ls.map((ln, idx) => {
      const stacks = new Map()
      for (const b of boxesByLine.get(ln.id) || []) {
        const dec = {
          ...b, zoneName: z.name, zoneColor: z.color, lineNo: idx + 1, lineIdx: idx,
          items: itemsByBox.get(b.id) || [],
        }
        dec.itemCount = dec.items.length
        dec.totalQty = dec.items.reduce((s, i) => s + (i.quantity || 0), 0)
        if (!stacks.has(b.slot_no)) stacks.set(b.slot_no, [])
        stacks.get(b.slot_no).push(dec)
        boxes.push(dec); boxesById.set(dec.id, dec)
      }
      for (const arr of stacks.values()) arr.sort((a, b) => a.tier - b.tier)
      const line = { ...ln, idx, no: idx + 1, stacks }
      linesById.set(ln.id, line)
      return line
    })
    const maxSlots = Math.max(1, ...lines.map(l => l.slot_count))
    const L = Math.max(1, lines.length)
    const zone = { ...z, lines, maxSlots, cw: z.w / maxSlots, ch: z.h / L,
      boxCount: lines.reduce((s, l) => s + [...l.stacks.values()].reduce((a, st) => a + st.length, 0), 0) }
    zonesById.set(z.id, zone)
    return zone
  })
  return { warehouse: raw.warehouse, fixtures: raw.fixtures, zones, zonesById, linesById, boxes, boxesById, itemsByBox, placed }
}

export const stackAt = (line, slot) => line.stacks.get(slot) || []

/** 재고(시스템)와 박스 합계 비교: ok=일치, short=아직 안 담은 재고가 있음, over=박스가 재고보다 많음 */
export function stockStatus(stock, placed) {
  if (stock == null) return { kind: 'unknown', diff: 0 }
  const diff = stock - placed
  return { kind: diff === 0 ? 'ok' : diff > 0 ? 'short' : 'over', diff }
}
/** 더 담을 수 있는 수량 (재고 − 이미 박스에 있는 수량). 재고를 모르면 null */
export const roomFor = (stock, placed) => (stock == null ? null : Math.max(0, stock - placed))
export const locationText = b => `${b.zoneName} · ${b.lineNo}번째 줄 · ${b.slot_no}번째 칸 · ${b.tier}층`
export const boxesAbove = (model, box) => {
  const z = model.zonesById.get(box.zone_id); if (!z) return []
  const line = z.lines.find(l => l.id === box.line_id); if (!line) return []
  return stackAt(line, box.slot_no).filter(b => b.tier > box.tier)
}
/** 구역 설정을 바꿀 때 사라지게 될 박스 */
export function boxesLostBy(zone, { tiers, lineCount, slotCount }) {
  const lost = []
  zone.lines.forEach((ln, idx) => {
    const lineGone = lineCount != null && idx >= lineCount
    const slots = slotCount != null ? slotCount : ln.slot_count
    for (const [slot, st] of ln.stacks) for (const b of st) {
      if (lineGone || slot > slots || (tiers != null && b.tier > tiers)) lost.push(b)
    }
  })
  return lost
}

// ═══════════════════════════════════════════════════════════
//  창고 크기 바꾸기: 가장자리/모서리를 끌어서 가로·세로를 자유롭게 (왼쪽/위를 옮기면 구역도 같이 따라가서 제자리에 있음)
//  rect = { x0, y0, x1, y1 } : 지금 좌표(창고 왼쪽 위 = 0, 0)에서 본 새 창고 범위
// ═══════════════════════════════════════════════════════════
export function checkWarehouseRect(model, rect) {
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0, eps = 1e-6
  if (w < LIMITS.whMin[0] - eps || h < LIMITS.whMin[1] - eps) return { ok: false, reason: 'wh-small' }
  if (w > LIMITS.whMax[0] + eps || h > LIMITS.whMax[1] + eps) return { ok: false, reason: 'wh-big' }
  for (const z of model.zones) if (z.x < rect.x0 - eps || z.y < rect.y0 - eps || z.x + z.w > rect.x1 + eps || z.y + z.h > rect.y1 + eps) return { ok: false, reason: 'zone-out', zone: z.name }
  return { ok: true, width: round2(w), height: round2(h), dx: round2(-rect.x0) + 0, dy: round2(-rect.y0) + 0 }      // + 0 : -0 을 0 으로
}
/** 사무실이 창고 밖으로 나가지 않게 안쪽으로 (옮긴 만큼 dx, dy 를 더한 뒤) */
export const officeInside = (f, W, H, dx = 0, dy = 0) => ({
  x: round2(clamp((f.x ?? 0) + dx, OFFICE_W / 2 + 0.2, W - OFFICE_W / 2 - 0.2)),
  y: round2(clamp((f.y ?? 0) + dy, OFFICE_H / 2 + 0.2, H - OFFICE_H / 2 - 0.2)),
})

// ═══════════════════════════════════════════════════════════
//  박스 옮기기 (다른 칸 / 다른 줄 / 다른 구역)
//  규칙: 옮긴 자리의 맨 위에 놓이고, 원래 자리에서 그 위에 있던 박스는 한 층씩 내려앉음 (공중에 뜬 박스가 생기지 않게)
//  target: { zoneId, lineId, slot }
// ═══════════════════════════════════════════════════════════
export function planBoxMove(model, boxId, target) {
  const no = (reason, text) => ({ ok: false, reason, text })
  const box = model.boxesById.get(boxId)
  if (!box) return no('no-box', '박스를 찾을 수 없어요')
  const zone = model.zonesById.get(target.zoneId), line = model.linesById.get(target.lineId)
  if (!zone || !line || line.zone_id !== zone.id) return no('no-target', '놓을 자리를 찾을 수 없어요')
  const slot = target.slot
  if (!(slot >= 1 && slot <= line.slot_count)) return no('no-slot', '그 칸은 없어요')
  const sameStack = box.line_id === line.id && box.slot_no === slot
  const tStack = stackAt(line, slot)
  const toTier = (sameStack ? tStack.length - 1 : tStack.length) + 1
  if (toTier > zone.tiers) return no('full', `${zone.name} ${line.no}번째 줄 ${slot}번째 칸은 가득 찼어요 (최대 ${zone.tiers}층)`)
  const srcStack = stackAt(model.linesById.get(box.line_id), box.slot_no)
  const above = srcStack.filter(b => b.tier > box.tier)
  if (sameStack && !above.length) return no('same', '이미 그 칸의 맨 위에 있어요')
  const steps = []
  if (!sameStack) {
    steps.push({ id: box.id, patch: { zone_id: zone.id, line_id: line.id, slot_no: slot, tier: toTier } })
    for (const b of above) steps.push({ id: b.id, patch: { tier: b.tier - 1 } })                  // 낮은 층부터 한 칸씩 내려옴 (비어 있는 자리로만 움직여서 겹치지 않음)
  } else {                                                                                     // 같은 칸 안에서 맨 위로: 잠깐 치워 두고 → 위 박스들이 내려오고 → 맨 위에 올림
    steps.push({ id: box.id, patch: { tier: srcStack.length + 100 } })
    for (const b of above) steps.push({ id: b.id, patch: { tier: b.tier - 1 } })
    steps.push({ id: box.id, patch: { tier: toTier } })
  }
  return { ok: true, same: sameStack, fromTier: box.tier, toTier, falls: above.length, steps, target: { zoneName: zone.name, lineNo: line.no, slot } }
}
/** 충돌/중단으로 층에 빈틈이 생긴 칸을 찾아 1,2,3… 으로 다시 붙일 계획 (낮은 층부터 → 겹치지 않음) */
export function stackRepairs(raw) {
  const groups = new Map()
  for (const b of raw.boxes) { const k = `${b.line_id}|${b.slot_no}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b) }
  const fixes = []
  for (const arr of groups.values()) { arr.sort((a, b) => a.tier - b.tier); arr.forEach((b, i) => { if (b.tier !== i + 1) fixes.push({ id: b.id, tier: i + 1 }) }) }
  return fixes
}

// ═══════════════════════════════════════════════════════════
//  검색 (박스 번호 / 상품명 / 옵션)
// ═══════════════════════════════════════════════════════════
const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

export function searchAll(model, query) {
  const q = norm(query)
  const out = { query: q, boxHits: [], productHits: [], ids: new Set() }
  if (!q) return out

  // 1) 박스 번호
  for (const b of model.boxes) {
    const n = numberKey(b.box_number)
    let rank = -1
    if (n === q) rank = 0; else if (n.startsWith(q)) rank = 1; else if (n.includes(q)) rank = 2
    if (rank >= 0) out.boxHits.push({ box: b, rank })
  }
  out.boxHits.sort((a, b) => a.rank - b.rank || String(a.box.box_number).localeCompare(String(b.box.box_number), 'ko', { numeric: true }))

  // 2) 상품 (여러 단어는 모두 포함해야 함)
  const terms = q.split(' ')
  const groups = new Map()
  for (const b of model.boxes) for (const it of b.items) {
    const hay = norm(`${it.name} ${it.label}`)
    if (!terms.every(t => hay.includes(t))) continue
    const k = itemKey(it)
    if (!groups.has(k)) groups.set(k, { key: k, name: it.name, label: it.label, image: it.image, total: 0, stock: it.stock, removed: it.removed, entries: [] })
    const g = groups.get(k)
    g.total += it.quantity || 0
    g.entries.push({ box: b, qty: it.quantity || 0, itemId: it.id })
  }
  out.productHits = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.label.localeCompare(b.label, 'ko'))
  for (const g of out.productHits) g.entries.sort((a, b) => a.box.zoneName.localeCompare(b.box.zoneName, 'ko') || a.box.lineNo - b.box.lineNo || a.box.slot_no - b.box.slot_no || a.box.tier - b.box.tier)

  for (const h of out.boxHits) out.ids.add(h.box.id)
  for (const g of out.productHits) for (const e of g.entries) out.ids.add(e.box.id)
  return out
}

// ═══════════════════════════════════════════════════════════
//  원본 상태 리듀서 — 서버 저장 결과를 화면 상태에 반영 (삭제 연쇄 포함)
// ═══════════════════════════════════════════════════════════
function dropBoxes(raw, pred) {
  const gone = new Set(raw.boxes.filter(pred).map(b => b.id))
  if (!gone.size) return raw
  return { ...raw, boxes: raw.boxes.filter(b => !gone.has(b.id)), items: raw.items.filter(i => !gone.has(i.box_id)) }
}
const patchBy = (arr, row) => arr.map(x => (x.id === row.id ? { ...x, ...row } : x))

export function rawReducer(raw, op) {
  switch (op.type) {
    case 'load': return op.raw
    case 'wh/set': return { ...raw, warehouse: op.row }
    case 'wh/clear': return emptyRaw()
    case 'fx/add': return { ...raw, fixtures: [...raw.fixtures, op.row] }
    case 'fx/patch': return { ...raw, fixtures: patchBy(raw.fixtures, op.row) }
    case 'fx/remove': return { ...raw, fixtures: raw.fixtures.filter(f => f.id !== op.id) }
    case 'zone/add': return { ...raw, zones: [...raw.zones, op.zone], lines: [...raw.lines, ...op.lines] }
    case 'zone/patch': return { ...raw, zones: patchBy(raw.zones, op.row) }
    case 'zone/remove': return dropBoxes({ ...raw, zones: raw.zones.filter(z => z.id !== op.id), lines: raw.lines.filter(l => l.zone_id !== op.id) }, b => b.zone_id === op.id)
    case 'zone/trimTiers': return dropBoxes(raw, b => b.zone_id === op.zoneId && b.tier > op.tiers)
    case 'line/add': return { ...raw, lines: [...raw.lines, op.row] }
    case 'line/patch': return { ...raw, lines: patchBy(raw.lines, op.row) }
    case 'line/remove': return dropBoxes({ ...raw, lines: raw.lines.filter(l => l.id !== op.id) }, b => b.line_id === op.id)
    case 'line/trim': return dropBoxes(raw, b => b.line_id === op.lineId && b.slot_no > op.slots)
    case 'box/add': return { ...raw, boxes: [...raw.boxes, op.row] }
    case 'box/patch': return { ...raw, boxes: patchBy(raw.boxes, op.row) }
    case 'box/removeStack': return dropBoxes(raw, b => b.line_id === op.lineId && b.slot_no === op.slotNo && b.tier >= op.fromTier)
    case 'items/add': return { ...raw, items: [...raw.items, ...op.rows] }
    case 'item/patch': return { ...raw, items: patchBy(raw.items, op.row) }
    case 'item/remove': return { ...raw, items: raw.items.filter(i => i.id !== op.id) }
    default: return raw
  }
}
