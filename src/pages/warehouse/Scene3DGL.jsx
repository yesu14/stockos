// ═══════════════════════════════════════════════════════════
//  상품찾기 — 새 3D 창고 뷰어 (WebGL, 원근 카메라)
//  왼쪽 끌기=돌리기 · 오른쪽 끌기(또는 Shift+끌기, ✋ 이동 모드)=바닥을 잡고 이동 · 휠=커서 위치로 확대 · 방향키/WASD=이동
//  마우스를 올리면 그 박스 번호가 나오고, 누르면 박스 창이 열려요. 단면/층/간격/반투명으로 안쪽 박스도 볼 수 있어요.
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, Minus, RotateCcw, RotateCw, Maximize2, Minimize2, Move, SlidersHorizontal } from 'lucide-react'
import { useFullscreen } from './ui'
import ViewPicker from './ViewPicker'
import { hexToRgb, rgbToHex, locationText } from './whLogic'
import { DARK_PALETTE, LIGHT_PALETTE, SPREAD_DEFAULT, wallHeight, tierGeom } from './render3d'
import { createRenderer } from './gl3d'
import { createThreeRenderer, loadThree } from './three3d'
import * as C from './cam3d'

const FONT = 'system-ui, -apple-system, "Segoe UI", "Noto Sans KR", "Malgun Gothic", sans-serif'
const ease = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const FACE_MIN_AREA = 220     // 박스 면에 쓴 번호가 읽힐 만큼 크게 보이는 면적(px²) — 이보다 작으면 읽히지 않아서 찾은 박스에만 안내 표시를 남김
const NUM_MIN_AREA = 150      // 보이는 면적(px²)이 이보다 작으면 면에 번호를 쓰지 않음
const TAG_MIN_PITCH = 30      // 한 칸이 화면에서 이보다 작으면 번호표(가려진 박스)를 띄우지 않음 (작은 3D 화면이 번호표로 뒤덮이지 않게)

function readTheme() {
  const root = document.documentElement, light = root.classList.contains('theme-light'), base = light ? LIGHT_PALETTE : DARK_PALETTE
  const num = v => getComputedStyle(root).getPropertyValue(v).trim().split(/\s+/).map(Number), ok = a => a.length === 3 && a.every(Number.isFinite)
  const f = num('--surface-800'), b = num('--surface-950')
  return { light, pal: ok(f) ? { ...base, floor: rgbToHex(f[0], f[1], f[2]) } : base, bg: ok(b) ? b.map(v => v / 255) : hexToRgb(base.bg).map(v => v / 255) }
}
function defaultCam(model, aspect, spread) {
  const wh = model.warehouse, W = wh.width, H = wh.height, wallH = Math.max(wallHeight(model, spread), 3)
  return C.fitSphere({ ...C.DEFAULT_ANGLES, dist: 10, tx: 0, ty: 0, tz: 0 }, [W / 2, H / 2, wallH * 0.3], 0.5 * Math.hypot(W, H, wallH * 0.6), aspect)
}
function presetCam(kind, model, aspect, spread) {
  const wh = model.warehouse, W = wh.width, H = wh.height
  if (kind === 'top') return C.fitTopRect(defaultCam(model, aspect, spread), W, H, aspect)
  const d = defaultCam(model, aspect, spread)
  return kind === 'front' ? { ...d, yaw: Math.PI / 2, pitch: 0.2 } : { ...d, yaw: 0, pitch: 0.2 }
}

export default function Scene3DGL({ model, highlight, focus, activeZoneId, onPickBox, onPickZone, onFail, engine = 'gl', onEngine }) {
  const wh = model.warehouse
  const { ref: frameRef, full, toggle } = useFullscreen()
  const boxRef = useRef(null), glRef = useRef(null), ovRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [spread, setSpread] = useState(SPREAD_DEFAULT), [maxTier, setMaxTier] = useState(0), [xray, setXray] = useState(false)
  const [sec, setSec] = useState(0), [numMode, setNumMode] = useState(engine === 'three' ? 'all' : 'auto'), [panMode, setPanMode] = useState(false), [panel, setPanel] = useState(false)
  const [lowDetail, setLowDetail] = useState(false), [error, setError] = useState(''), [themeKey, setThemeKey] = useState(0), [ready, setReady] = useState(0)
  const framing = useRef('home')                       // 처음/위에서/앞에서/옆에서 중 지금 보는 방식 (직접 움직이면 null → 화면 크기가 바뀌어도 그대로 둠)
  const R = useRef(null), cam = useRef(null), camKey = useRef(null), tween = useRef(null), dirty = useRef(true), visDirty = useRef(true), moveUntil = useRef(0), lastDraw = useRef(0)
  const gesture = useRef(null), pointers = useRef(new Map()), hover = useRef({ index: -1, x: 0, y: 0 }), vis = useRef([]), hits = useRef({ pills: [], labels: [] }), lowRef = useRef(false)
  const theme = useMemo(() => readTheme(), [themeKey])
  const tiersList = useMemo(() => Array.from({ length: Math.max(1, ...model.boxes.map(b => b.tier)) }, (_, i) => i + 1), [model.boxes])
  const tapRef = useRef(null)                           // 방금 한 탭(누르고 뗌): 창은 클릭 이벤트 때 열어서, 폰의 '고스트 클릭'이 새 창을 닫지 않게
  const L = useRef({}); L.current = { model, highlight, focus, size, theme, spread, maxTier, xray, sec, numMode, panMode }
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
  useEffect(() => { if (maxTier > tiersList.length) setMaxTier(0) }, [tiersList.length]) // eslint-disable-line

  const flyTo = useCallback((to, ms = 520) => { if (cam.current) { tween.current = { from: { ...cam.current }, to, t0: performance.now(), ms } } else { cam.current = to; dirty.current = true } }, [])
  const markMove = () => { framing.current = null; dirty.current = true; visDirty.current = true; moveUntil.current = performance.now() + 140 }
  const secObj = () => { const r = R.current, s = L.current.sec; if (!r || !s || !cam.current) return null; const [a, b] = r.depthRangeOf(cam.current); return { on: true, dist: a + (s / 100) * (b - a) } }
  const ghostPick = () => !(L.current.highlight && L.current.highlight.size)

  // 엔진 시작 / 정리 (engine: 'gl' = 직접 만든 WebGL, 'three' = Three.js — 인터넷에서 불러오는 동안 잠깐 기다림)
  useEffect(() => {
    const cvs = glRef.current; if (!cvs) return
    let alive = true, r = null
    const lost = e => { e.preventDefault(); setError('3D 화면이 멈췄어요 (기기 메모리가 부족할 수 있어요)'); onFail?.(new Error('context lost')) }
    cvs.addEventListener('webglcontextlost', lost)
    ;(async () => {
      try { r = engine === 'three' ? createThreeRenderer(cvs, await loadThree()) : createRenderer(cvs) }
      catch (e) { if (alive) { setError(e?.message || '3D 를 시작하지 못했어요'); onFail?.(e) } return }
      if (!alive) { r.dispose(); return }
      R.current = r; dirty.current = true; setReady(n => n + 1)
    })()
    return () => { alive = false; cvs.removeEventListener('webglcontextlost', lost); if (R.current) { R.current.dispose(); R.current = null } }
  }, []) // eslint-disable-line
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const ro = new ResizeObserver(([en]) => { const r = en.contentRect; setSize(s => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height })) })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const r = R.current; if (!r || size.w < 40) return
    r.setSize(size.w, size.h, dpr); const ov = ovRef.current; if (ov) { ov.width = Math.round(size.w * dpr); ov.height = Math.round(size.h * dpr) }
    const Lc = L.current; if (framing.current && Lc.model.warehouse && cam.current && !tween.current) cam.current = framing.current === 'home' ? defaultCam(Lc.model, size.w / size.h, Lc.spread) : presetCam(framing.current, Lc.model, size.w / size.h, Lc.spread)
    dirty.current = visDirty.current = true
  }, [size.w, size.h, dpr, ready])
  useEffect(() => {
    const mo = new MutationObserver(() => setThemeKey(k => k + 1)); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); return () => mo.disconnect()
  }, [])
  // 데이터가 바뀌면 장면 다시 만들기
  useEffect(() => { const r = R.current; if (!r || !wh) return; r.setEnv(model, spread, theme.pal, activeZoneId); dirty.current = true }, [model, spread, activeZoneId, theme, wh?.width, wh?.height, ready]) // eslint-disable-line
  useEffect(() => { const r = R.current; if (!r || !wh) return; r.setBoxes(model, { spread, maxTier, highlight, focusId: focus?.boxId || null, xray }); dirty.current = visDirty.current = true }, [model, spread, maxTier, highlight, focus?.boxId, xray, wh?.id, ready]) // eslint-disable-line
  // 처음 / 창고 크기가 바뀌면 카메라를 꼭 맞게 (보던 각도는 유지)
  useEffect(() => {
    if (!wh || size.w < 60) return
    const key = `${wh.id}:${wh.width}x${wh.height}`; if (camKey.current === key) return
    const first = !camKey.current || camKey.current.split(':')[0] !== wh.id; camKey.current = key
    const to = defaultCam(model, size.w / size.h, spread)
    if (first || !cam.current) { cam.current = to; framing.current = 'home' } else flyTo({ ...to, yaw: cam.current.yaw, pitch: cam.current.pitch }, 400)
    dirty.current = true
  }, [wh?.id, wh?.width, wh?.height, size.w, size.h]) // eslint-disable-line
  // 검색 결과를 누르면 그 박스/구역으로 날아가기
  useEffect(() => {
    if (!focus || !cam.current || size.w < 60 || !R.current) return
    const aspect = size.w / size.h, inst = R.current.inst
    framing.current = null
    if (focus.boxId && inst && inst.indexById.has(focus.boxId)) {
      const m = inst.meta[inst.indexById.get(focus.boxId)]
      flyTo({ ...cam.current, tx: m.cx, ty: m.cy, tz: m.cz, dist: clamp(Math.max(m.pitch * 4.2, 7), C.DIST_MIN, 60) })
    } else if (focus.zoneId) {
      const z = model.zonesById.get(focus.zoneId); if (!z) return
      const hz = Math.max(z.tiers * tierGeom(z, spread).pz, 2), c = C.fitSphere(cam.current, [z.x + z.w / 2, z.y + z.h / 2, hz / 2], 0.5 * Math.hypot(z.w, z.h, hz), aspect, 1.25); flyTo(c)
    }
  }, [focus?.nonce]) // eslint-disable-line

  // 마우스 올림 / 클릭 판정
  const local = e => { const r = boxRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const inRect = (p, q) => Math.abs(p[0] - q.x) <= q.w / 2 && Math.abs(p[1] - q.y) <= q.h / 2
  const hoverAt = p => {
    const r = R.current; if (!r || performance.now() < moveUntil.current) return
    const idx = r.idAtLast(p[0], p[1]), h = hover.current
    if (idx !== h.index || (idx >= 0 && (Math.abs(h.x - p[0]) > 3 || Math.abs(h.y - p[1]) > 3))) { hover.current = { index: idx, x: p[0], y: p[1] }; dirty.current = true }
    if (boxRef.current) boxRef.current.style.cursor = idx >= 0 ? 'pointer' : (L.current.panMode ? 'move' : 'grab')
  }
  const handleClick = p => {
    const r = R.current, { size: sz, model: mdl } = L.current; if (!r || !cam.current) return
    const pill = hits.current.pills.find(q => inRect(p, q)); if (pill) { onPickZone?.(pill.id); return }
    const lab = hits.current.labels.find(q => inRect(p, q)); if (lab) { onPickBox?.(lab.id); return }
    const idx = r.pick(cam.current, sz.w / sz.h, p[0], p[1], secObj(), ghostPick()); if (idx >= 0) { onPickBox?.(r.inst.meta[idx].id); return }
    const g = C.hitPlaneZ(C.rayAt(cam.current, sz.w / sz.h, sz.w, sz.h, p[0], p[1]), 0)
    if (g) { const z = mdl.zones.find(z => g[0] >= z.x && g[0] <= z.x + z.w && g[1] >= z.y && g[1] <= z.y + z.h); if (z) onPickZone?.(z.id) }
  }
  const fireTap = () => { const t = tapRef.current; if (!t) return; tapRef.current = null; clearTimeout(t.timer); handleClick(t.p) }
  // 포인터: 왼쪽 끌기 = 돌리기, 오른쪽/가운데/Shift/Ctrl/✋ = 이동, 두 손가락 = 확대 + 이동
  const onPointerDown = e => {
    if (e.target.closest('[data-ctl]')) return
    boxRef.current.focus?.({ preventScroll: true }); boxRef.current.setPointerCapture?.(e.pointerId)
    const p = local(e); pointers.current.set(e.pointerId, p); tween.current = null
    if (tapRef.current) { clearTimeout(tapRef.current.timer); tapRef.current = null }
    if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; gesture.current = { type: 'pinch', a0: a, b0: b, cam0: cam.current }; return }
    if (pointers.current.size === 1) gesture.current = { type: e.shiftKey || e.ctrlKey || e.button === 2 || e.button === 1 || L.current.panMode ? 'pan' : 'orbit', start: p, last: p, cam0: cam.current, moved: false, button: e.button }
  }
  const onPointerMove = e => {
    const p = local(e)
    if (!pointers.current.has(e.pointerId)) { if (e.pointerType === 'mouse' && !gesture.current) hoverAt(p); return }
    pointers.current.set(e.pointerId, p)
    const g = gesture.current, { size: sz } = L.current; if (!g || !cam.current) return
    const aspect = sz.w / sz.h
    if (g.type === 'pinch') {
      if (pointers.current.size < 2) return
      const [a, b] = [...pointers.current.values()], m0 = [(g.a0[0] + g.b0[0]) / 2, (g.a0[1] + g.b0[1]) / 2], m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const ratio = Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(1, Math.hypot(g.a0[0] - g.b0[0], g.a0[1] - g.b0[1]))
      cam.current = C.panGrab(C.zoomAt(g.cam0, 1 / ratio, aspect, sz.w, sz.h, m0[0], m0[1]), aspect, sz.w, sz.h, m0, m1); markMove(); return
    }
    if (!g.moved && Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) < 5) return
    g.moved = true; hover.current = { index: -1, x: 0, y: 0 }
    cam.current = g.type === 'pan' ? C.panGrab(g.cam0, aspect, sz.w, sz.h, g.start, p) : C.orbit(cam.current, p[0] - g.last[0], p[1] - g.last[1])
    g.last = p; markMove()
  }
  const onPointerUp = e => {
    const had = pointers.current.delete(e.pointerId), g = gesture.current
    if (g?.type === 'pinch') { if (pointers.current.size < 2) gesture.current = null; visDirty.current = dirty.current = true; return }
    if (!had || !g) return
    gesture.current = null; visDirty.current = dirty.current = true
    if (!g.moved && g.button !== 2) { clearTimeout(tapRef.current?.timer); tapRef.current = { p: local(e), timer: setTimeout(() => fireTap(), 400) } }      // 실제 열기는 곧 오는 click 이벤트에서 (안 오면 0.4초 뒤에)
  }
  const onPointerCancel = e => { pointers.current.delete(e.pointerId); gesture.current = null; visDirty.current = dirty.current = true }
  const onPointerLeave = () => { if (hover.current.index >= 0) { hover.current = { index: -1, x: 0, y: 0 }; dirty.current = true } }
  useEffect(() => {                                    // 휠: 커서 위치로 확대/축소 (페이지가 같이 스크롤되지 않게 직접 등록)
    const el = boxRef.current; if (!el) return
    const onWheel = e => {
      e.preventDefault(); if (!cam.current) return
      tween.current = null; const r = el.getBoundingClientRect(), sz = L.current.size
      cam.current = C.zoomAt(cam.current, Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), sz.w / sz.h, sz.w, sz.h, e.clientX - r.left, e.clientY - r.top); markMove()
    }
    el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 버튼 / 키보드
  const zoomBy = f => { if (!cam.current) return; const sz = L.current.size; tween.current = null; cam.current = C.zoomAt(cam.current, f, sz.w / sz.h, sz.w, sz.h, sz.w / 2, sz.h / 2); markMove() }
  const turn = d => { framing.current = null; if (cam.current) flyTo({ ...cam.current, yaw: cam.current.yaw + d }, 340) }
  const preset = kind => { const sz = L.current.size; framing.current = kind; if (wh && sz.w) flyTo(kind === 'home' ? defaultCam(model, sz.w / sz.h, spread) : presetCam(kind, model, sz.w / sz.h, spread)) }
  const onKeyDown = e => {
    if (e.target !== e.currentTarget || e.altKey || e.metaKey || e.ctrlKey || !cam.current) return
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, S = e.shiftKey ? 140 : 60, sz = L.current.size
    const mv = { ArrowUp: [0, S], w: [0, S], ArrowDown: [0, -S], s: [0, -S], ArrowLeft: [S, 0], a: [S, 0], ArrowRight: [-S, 0], d: [-S, 0] }[k]
    if (mv) { e.preventDefault(); tween.current = null; cam.current = C.panGrab(cam.current, sz.w / sz.h, sz.w, sz.h, [sz.w / 2, sz.h / 2], [sz.w / 2 + mv[0], sz.h / 2 + mv[1]]); markMove(); return }
    if (k === 'q') { e.preventDefault(); turn(-Math.PI / 12) } else if (k === 'e') { e.preventDefault(); turn(Math.PI / 12) }
    else if (k === '+' || k === '=') { e.preventDefault(); zoomBy(1 / 1.2) } else if (k === '-' || k === '_') { e.preventDefault(); zoomBy(1.2) }
  }

  // 그리기 반복: 바뀐 게 있을 때만 (검색한 박스가 깜빡일 때는 천천히)
  useEffect(() => {
    let raf = 0
    const overlay = (now, moving) => {
      const ov = ovRef.current, r = R.current, Lc = L.current; if (!ov || !r || !r.inst || !cam.current) return
      const W = Lc.size.w, H = Lc.size.h, aspect = W / H, ctx = ov.getContext('2d'), P = C.makeProjector(cam.current, aspect, W, H), meta = r.inst.meta
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const placed = [], shown = [], tagsShown = [], faces = []; hits.current = { pills: [], labels: [] }
      const free = q => !placed.some(o => Math.abs(o.x - q.x) < (o.w + q.w) / 2 && Math.abs(o.y - q.y) < (o.h + q.h) / 2) && q.x > -q.w && q.y > -q.h && q.x < W + q.w && q.y < H + q.h
      const rrect = (x, y, w, h, rad) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, rad) : ctx.rect(x - w / 2, y - h / 2, w, h) }
      const pill = (x, y, text, size, o = {}) => {
        ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(text).width, w = tw + (o.dot ? size * 1.9 : size * 1.1), h = size * 1.55
        rrect(x, y, w, h, h / 2); ctx.fillStyle = o.fill || Lc.theme.pal.pillBg; ctx.globalAlpha = o.alpha ?? 1; ctx.fill(); ctx.lineWidth = o.border ? 2 : 1; ctx.strokeStyle = o.border || 'rgba(0,0,0,0.28)'; ctx.stroke()
        if (o.dot) { ctx.beginPath(); ctx.arc(x - w / 2 + size * 0.85, y, size * 0.32, 0, Math.PI * 2); ctx.fillStyle = o.dot; ctx.fill() }
        ctx.fillStyle = Lc.theme.pal.pillText; ctx.fillText(text, x + (o.dot ? size * 0.45 : 0), y + 0.5); ctx.globalAlpha = 1
        return { x, y, w, h }
      }
      // 1) 구역 이름표 (구역 위쪽)
      for (const z of Lc.model.zones) {
        const hz = Math.max(...z.lines.flatMap(l => [...l.stacks.values()].map(s => s.length)), 0) * tierGeom(z, Lc.spread).pz, [x, y, , front] = P([z.x + z.w / 2, z.y + z.h / 2, hz + 0.6]); if (!front) continue
        const q = pill(x, y - 10, z.name, 12, { dot: z.color, border: z.id === Lc.activeZoneId ? '#f59e0b' : null }); placed.push(q); hits.current.pills.push({ ...q, id: z.id })
      }
      // 2) 번호 (실제로 보이는 박스는 보이는 곳 위에) — 움직이는 동안은 숨김
      const hl = Lc.highlight && Lc.highlight.size ? Lc.highlight : null, fid = Lc.focus?.boxId || null
      const list = (moving || Lc.numMode === 'off') ? [] : vis.current.slice().sort((a, b) => ((hl && hl.has(meta[b.index]?.id)) - (hl && hl.has(meta[a.index]?.id))) || b.px - a.px)
      let maxPx = 0; const labeledIdx = new Set(), ft = !!r.faceText                // 면에 번호를 쓴 박스 (번호표를 또 붙이지 않음)
      for (const v of list) {
        const m = meta[v.index]; if (!m) continue; maxPx = Math.max(maxPx, v.px)
        const special = (hl && hl.has(m.id)) || m.id === fid
        if (ft && v.px >= FACE_MIN_AREA) { faces.push(m.number); labeledIdx.add(v.index); continue }   // 번호가 박스 면에 직접 그려져 읽힘 → 따로 표시하지 않음
        if (ft && !special) continue                                                                       // 너무 작아서 안 읽힘 (확대하면 보임)
        if (!ft && v.px < NUM_MIN_AREA && !special) continue
        const size = clamp(Math.sqrt(v.px) * 0.4, special ? 11 : 9, 18)
        ctx.font = `700 ${size}px ${FONT}`; const w = ctx.measureText(m.number).width + size * 1.1, q = { x: v.x, y: v.y, w, h: size * 1.55 }
        if (!special && !free(q)) continue
        placed.push(pill(v.x, v.y, m.number, size, { border: special ? '#f59e0b' : null, alpha: 0.94 })); hits.current.labels.push({ ...q, id: m.id }); shown.push(m.number); labeledIdx.add(v.index)
      }
      // 3) 가려진 박스(또는 너무 작게 보이는 박스)의 번호표: 박스 가운데 위치에 띄우고, 밀리면 선으로 이어줌
      if (!moving && Lc.numMode === 'all') {
        const focalPx = (H / 2) / Math.tan(C.FOV / 2), cand = []
        meta.forEach((m, i) => {
          const special = (hl && hl.has(m.id)) || m.id === fid
          if (labeledIdx.has(i)) return                              // 이미 면에 번호가 있음
          if (hl && !special) return                                 // 검색 중에는 찾은 박스만 번호 (나머지는 흐리게 두기만)
          const [x, y, w, front] = P([m.cx, m.cy, m.cz]); if (!front) return
          const pitchPx = (m.pitch * focalPx) / w; if (pitchPx < TAG_MIN_PITCH && !special) return
          cand.push({ i, m, x, y, w, special })
        })
        cand.sort((a, b) => (b.special - a.special) || a.w - b.w)
        const OFFS = []; for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) OFFS.push([i * 0.5, j * 0.5]); OFFS.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]))
        let n = 0
        for (const c of cand) {
          if (n > 500) break
          ctx.font = `700 11px ${FONT}`; const tw = ctx.measureText(c.m.number).width + 12, th = 17
          for (const [fx, fy] of OFFS) {
            const ox = fx * (tw + 3), oy = fy * (th + 3); if (Math.hypot(ox, oy) > 52) continue
            const q = { x: c.x + ox, y: c.y + oy, w: tw, h: th }; if (!free(q)) continue
            if (Math.hypot(ox, oy) > 6) { ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(q.x, q.y); ctx.lineWidth = 1.2; ctx.strokeStyle = c.special ? '#f59e0b' : 'rgba(255,255,255,0.55)'; ctx.stroke(); ctx.beginPath(); ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2); ctx.fillStyle = c.special ? '#f59e0b' : '#fff'; ctx.fill() }
            placed.push(pill(q.x, q.y, c.m.number, 11, { border: c.special ? '#f59e0b' : null, alpha: 0.96 })); hits.current.labels.push({ ...q, id: c.m.id }); tagsShown.push(c.m.number); n++; break
          }
        }
      }
      // 4) 마우스를 올린 박스 안내
      const hv = hover.current
      if (!moving && hv.index >= 0 && meta[hv.index]) {
        const m = meta[hv.index], text = `박스 ${m.number}  ·  ${locationText(m.box)}`; ctx.font = `700 12px ${FONT}`
        const w = ctx.measureText(text).width + 18, h = 24, x = clamp(hv.x + 14 + w / 2, w / 2 + 4, W - w / 2 - 4), y = clamp(hv.y - 22, h / 2 + 4, H - h / 2 - 4)
        rrect(x, y, w, h, 12); ctx.fillStyle = 'rgba(17,24,39,0.92)'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 0.5)
      }
      const low = !moving && Lc.numMode !== 'off' && vis.current.length > 0 && shown.length === 0 && tagsShown.length === 0 && faces.length === 0 && maxPx < (ft ? FACE_MIN_AREA : NUM_MIN_AREA)
      if (low !== lowRef.current) { lowRef.current = low; setLowDetail(low) }
      ov.dataset.labels = shown.join(','); ov.dataset.tags = tagsShown.join(','); ov.dataset.faces = faces.join(','); ov.dataset.visible = String(vis.current.length); ov.dataset.hover = hv.index >= 0 && meta[hv.index] ? meta[hv.index].number : ''
    }
    const loop = t => {
      raf = requestAnimationFrame(loop)
      if (document.hidden) return
      const r = R.current, Lc = L.current; if (!r || !cam.current || !Lc.model.warehouse || Lc.size.w < 40) return
      const tw = tween.current
      if (tw) { const k = Math.min(1, (t - tw.t0) / tw.ms); cam.current = C.lerpCam(tw.from, tw.to, ease(k)); dirty.current = true; visDirty.current = true; moveUntil.current = performance.now() + 100; if (k >= 1) tween.current = null }
      const pulsing = !!((Lc.highlight && Lc.highlight.size) || Lc.focus?.boxId)
      if (!dirty.current && !visDirty.current && !(pulsing && t - lastDraw.current > 66)) return
      lastDraw.current = t; dirty.current = false
      const aspect = Lc.size.w / Lc.size.h, sec = secObj(), moving = performance.now() < moveUntil.current || !!gesture.current
      r.draw({ cam: cam.current, aspect, time: t / 1000, bg: Lc.theme.bg, hover: hover.current.index, sec, showText: Lc.numMode !== 'off', gridColor: Lc.theme.light ? [0.1, 0.14, 0.25] : [1, 1, 1], gridAlpha: Lc.theme.light ? 0.14 : 0.16 })
      if (visDirty.current && !moving) { vis.current = r.visibility(cam.current, aspect, sec, ghostPick()); visDirty.current = false }
      overlay(t, moving)
    }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [dpr]) // eslint-disable-line
  useEffect(() => { dirty.current = visDirty.current = true }, [sec, numMode, panMode, theme])

  const btn = 'h-8 px-2.5 rounded-xl bg-surface-900/95 border border-surface-700 text-surface-200 text-[11px] font-bold shadow-lg backdrop-blur hover:bg-surface-800 active:scale-95 transition-all'
  const sq = 'w-9 h-9 rounded-2xl bg-surface-900/95 border border-surface-700 text-surface-200 flex items-center justify-center shadow-lg backdrop-blur hover:bg-surface-800 active:scale-90 transition-all'
  const on = '!bg-primary-500 !border-primary-500'
  const chip = a => `px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${a ? 'bg-primary-500 border-primary-500 text-white' : 'bg-surface-800 border-surface-700 text-surface-200 hover:bg-surface-700'}`
  return (
    <div ref={frameRef} className={full ? 'fixed inset-0 z-[90] flex flex-col gap-2 p-3 bg-surface-950' : 'flex flex-col gap-2'}>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <span className="text-lg">🧊</span><h2 className="font-bold text-white text-sm">3D 창고</h2>
        <div className="flex-1" />
        {wh && <button type="button" className={`${btn} ${panel ? on : ''}`} style={panel ? { color: '#fff' } : undefined} aria-pressed={panel} onClick={() => setPanel(v => !v)}><span className="inline-flex items-center gap-1"><SlidersHorizontal size={13} /> 보기 설정</span></button>}
        {onEngine && <ViewPicker value={engine === 'three' ? 'three' : 'gl'} onChange={onEngine} />}
        {full && <button type="button" className={btn} onClick={toggle}>닫기 ✕</button>}
      </div>
      <div ref={boxRef} data-testid="scene3d" tabIndex={0} onKeyDown={onKeyDown}
        className={`relative rounded-[28px] overflow-hidden border border-surface-700 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${full ? 'flex-1 min-h-0' : 'h-[320px] sm:h-[380px]'}`}
        style={{ background: 'rgb(var(--surface-950))', cursor: panMode ? 'move' : 'grab' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onPointerLeave={onPointerLeave} onClick={e => { if (e.target.closest('[data-ctl]')) return; fireTap() }} onContextMenu={e => e.preventDefault()}>
        <canvas ref={glRef} data-testid="scene3d-canvas" style={{ width: size.w, height: size.h }} className="absolute inset-0" />
        <canvas ref={ovRef} data-testid="scene3d-overlay" style={{ width: size.w, height: size.h }} className="absolute inset-0 pointer-events-none" />
        {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-surface-950/90"><div><div className="text-4xl mb-2">⚠️</div><p className="text-sm font-bold text-white">{error}</p>{onEngine && <button type="button" className={`${btn} mt-3`} onClick={() => onEngine('classic')}>예전 3D 로 보기</button>}</div></div>}
        {!wh && <div className="absolute inset-0 flex items-center justify-center p-6 text-center pointer-events-none"><div><div className="text-5xl mb-2">🧊</div><p className="text-sm font-bold text-white">창고를 그리면 여기에 3D로 보여요</p></div></div>}
        {wh && !error && <>
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          <div data-ctl className="flex gap-1.5 flex-wrap min-w-0">
            {[['home', '처음'], ['top', '위에서'], ['front', '앞에서'], ['side', '옆에서']].map(([k, label]) => <button key={k} type="button" className={btn} aria-label={`${label} 보기`} onClick={() => preset(k)}>{label}</button>)}
          </div>
          <div data-ctl className="flex gap-1.5 shrink-0">
            <button type="button" className={`${btn} ${panMode ? on : ''}`} style={panMode ? { color: '#fff' } : undefined} aria-label="이동 모드" aria-pressed={panMode} title="켜면 끌어서 이동해요 (오른쪽 버튼이 없는 태블릿/폰용)" onClick={() => setPanMode(v => !v)}><span className="inline-flex items-center gap-1"><Move size={13} /> 이동</span></button>
            <button type="button" className={sq + ' !w-8 !h-8 !rounded-xl'} aria-label="전체화면" title={full ? '전체화면 닫기' : '전체화면'} onClick={toggle}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
          </div>
          </div>
          <div data-ctl className="absolute right-3 bottom-3 grid grid-cols-2 gap-1.5">
            <button type="button" className={sq} aria-label="확대" onClick={() => zoomBy(1 / 1.3)}><Plus size={16} /></button>
            <button type="button" className={sq} aria-label="축소" onClick={() => zoomBy(1.3)}><Minus size={16} /></button>
            <button type="button" className={sq} aria-label="왼쪽으로 돌리기" onClick={() => turn(-Math.PI / 4)}><RotateCcw size={16} /></button>
            <button type="button" className={sq} aria-label="오른쪽으로 돌리기" onClick={() => turn(Math.PI / 4)}><RotateCw size={16} /></button>
          </div>
          <div className="absolute left-3 bottom-3 max-w-[58%] px-3 py-1.5 rounded-2xl bg-surface-900/90 border border-surface-700 text-[11px] leading-snug text-surface-300 backdrop-blur pointer-events-none">
            {panMode ? '✋ 끌면 이동해요 · 휠로 확대' : '왼쪽 끌기: 돌리기 · 오른쪽 끌기: 이동 · 휠: 확대'}
            <span className="block text-surface-400">마우스를 올리면 번호가 보여요</span>
            {lowDetail && <span className="block text-primary-300 font-bold">🔍 확대하면 번호가 보여요</span>}
          </div>
        </>}
      </div>
      {/* 보기 설정: 3D 화면을 가리지 않게 화면 아래 줄에 */}
      {wh && panel && (
        <div data-testid="scene3d-settings" className="shrink-0 rounded-3xl bg-surface-900 border border-surface-700 p-3.5 space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs font-black text-white">⚙️ 보기 설정</span><button type="button" onClick={() => setPanel(false)} className="text-surface-400 hover:text-white text-xs px-1" aria-label="설정 닫기">✕</button></div>
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-surface-200 mb-1"><span>박스 간격</span><span className="text-surface-400">{Math.round(spread * 100)}%</span></div>
            <input type="range" min="0" max="100" step="5" value={Math.round(spread * 100)} onChange={e => setSpread(Number(e.target.value) / 100)} className="w-full accent-primary-500" aria-label="박스 간격" />
            <div className="flex justify-between text-[10px] text-surface-500"><span>붙임</span><span>넓게</span></div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-surface-200 mb-1"><span>단면 <span className="font-normal text-surface-400">(앞쪽부터 지워서 안쪽 보기)</span></span><span className="text-surface-400">{sec ? `${sec}%` : '끔'}</span></div>
            <input type="range" min="0" max="95" step="1" value={sec} onChange={e => setSec(Number(e.target.value))} className="w-full accent-primary-500" aria-label="단면" />
            <div className="flex justify-between text-[10px] text-surface-500"><span>끔</span><span>안쪽까지</span></div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-surface-200 mb-1">층 보기 <span className="font-normal text-surface-400">(고른 층까지만 보여요)</span></div>
            <div className="flex flex-wrap gap-1">{[0, ...tiersList].map(n => <button key={n} type="button" onClick={() => setMaxTier(n)} className={chip(maxTier === n)}>{n === 0 ? '전체' : `${n}층`}</button>)}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-surface-200 mb-1">번호</div>
            <div className="flex flex-wrap gap-1">{[['auto', '박스 면에만'], ['all', '가려진 박스도'], ['off', '끄기']].map(([k, label]) => <button key={k} type="button" onClick={() => setNumMode(k)} className={chip(numMode === k)}>{label}</button>)}</div>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-surface-200 cursor-pointer"><input type="checkbox" checked={xray} onChange={e => setXray(e.target.checked)} /> 반투명으로 보기 <span className="text-surface-500">(모든 박스가 비쳐 보여요)</span></label>
          <p className="text-[10px] text-surface-500 leading-relaxed">3D 화면을 한 번 누른 뒤: 방향키 / W A S D = 이동 · Q E = 돌리기 · + − = 확대 (Shift 를 같이 누르면 크게)</p>
        </div>)}
    </div>
  )
}
