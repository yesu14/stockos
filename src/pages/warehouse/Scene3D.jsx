// ═══════════════════════════════════════════════════════════
//  상품찾기 — 3D 창고 뷰어 (캔버스)
//  끌기=회전, 두 손가락/휠=확대, 오른쪽 버튼·Shift+끌기=이동, 클릭=박스 선택
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Minus, RotateCcw, RotateCw, Maximize2, Minimize2, Crosshair, Layers } from 'lucide-react'
import { Btn, useFullscreen } from './ui'
import { rgbToHex, clamp } from './whLogic'
import {
  buildScene, drawScene, hitTest, defaultCamera, zoomCamera, rotateCamera, focusCamera,
  DARK_PALETTE, LIGHT_PALETTE, PITCH_MAX, SCALE_MIN, SCALE_MAX,
} from './render3d'

function readPalette() {
  const root = document.documentElement
  const base = root.classList.contains('theme-light') ? LIGHT_PALETTE : DARK_PALETTE
  const v = getComputedStyle(root).getPropertyValue('--surface-800').trim().split(/\s+/).map(Number)
  return v.length === 3 && v.every(Number.isFinite) ? { ...base, floor: rgbToHex(v[0], v[1], v[2]) } : base
}
const ease = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
function lerpCam(a, b, e) {
  return {
    yaw: a.yaw + (b.yaw - a.yaw) * e, pitch: a.pitch + (b.pitch - a.pitch) * e,
    scale: a.scale * Math.pow(b.scale / a.scale, e), panX: a.panX + (b.panX - a.panX) * e, panY: a.panY + (b.panY - a.panY) * e,
    tx: a.tx + (b.tx - a.tx) * e, ty: a.ty + (b.ty - a.ty) * e, tz: a.tz + (b.tz - a.tz) * e,
  }
}
const TWO_PI = Math.PI * 2

export default function Scene3D({ model, highlight, focus, activeZoneId, onPickBox, onPickZone }) {
  const wh = model.warehouse
  const { ref: frameRef, full, toggle } = useFullscreen()
  const boxRef = useRef(null), canvasRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })        // 실제로 측정되기 전에는 맞추지 않음
  const [topView, setTopView] = useState(false)
  const [numbers, setNumbers] = useState(true)          // 번호 모두 보기 (가려진 박스도 번호표로 보여줌)
  const cam = useRef(null), scene = useRef(null), dirty = useRef(true), tween = useRef(null), pal = useRef(DARK_PALETTE)
  const pointers = useRef(new Map()), gesture = useRef(null), camKey = useRef(null), lastDraw = useRef(0)
  const prevSize = useRef(null), rescale = useRef(false), firstFull = useRef(true)
  const latest = useRef({}); latest.current = { model, highlight, focus, activeZoneId, size, numbers }
  const dpr = typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1

  const tweenTo = useCallback((to, ms = 420) => {
    const from = cam.current; if (!from) { cam.current = to; dirty.current = true; return }
    const d = ((to.yaw - from.yaw + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI          // 가장 짧은 방향으로 회전
    tween.current = { from, to: { ...to, yaw: from.yaw + d }, t0: performance.now(), ms }
  }, [])

  // 화면 크기
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const ro = new ResizeObserver(([en]) => { const r = en.contentRect; setSize(s => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height })); dirty.current = true })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  // 창고가 생기거나 크기가 바뀌면 카메라를 꼭 맞게
  useEffect(() => {
    if (!wh || size.w < 60) return
    const key = `${wh.id}:${wh.width}x${wh.height}`
    if (camKey.current === key) return
    camKey.current = key
    const to = defaultCamera(model, size)
    if (cam.current) tweenTo({ ...to, yaw: cam.current.yaw, pitch: cam.current.pitch }, 350); else cam.current = to
    dirty.current = true
  }, [wh?.id, wh?.width, wh?.height, size.w, size.h]) // eslint-disable-line
  // 전체화면으로 바꾸면 화면이 커진 비율만큼 확대해서, 보던 장면이 그대로 더 크게 보이게
  useEffect(() => { if (firstFull.current) { firstFull.current = false; return } rescale.current = true }, [full])
  useEffect(() => {
    const p = prevSize.current; prevSize.current = size
    if (!rescale.current || !p || p.w < 60 || size.w < 60 || !cam.current) return
    rescale.current = false
    const r = Math.min(size.w / p.w, size.h / p.h), c = cam.current
    cam.current = { ...c, scale: clamp(c.scale * r, SCALE_MIN, SCALE_MAX), panX: c.panX * r, panY: c.panY * r }; dirty.current = true
  }, [size.w, size.h])
  // 데이터/강조가 바뀌면 다시 그리기
  useEffect(() => { dirty.current = true }, [model, highlight, focus?.boxId, activeZoneId, numbers])
  // 검색 결과를 누르면 그 박스/구역으로 이동
  useEffect(() => {
    if (!focus || !cam.current || size.w < 60) return
    const to = focusCamera(cam.current, model, focus, size)
    tweenTo({ ...to, yaw: cam.current.yaw, pitch: cam.current.pitch })
  }, [focus?.nonce]) // eslint-disable-line
  // 테마가 바뀌면 색 다시 읽기
  useEffect(() => {
    pal.current = readPalette()
    const mo = new MutationObserver(() => { pal.current = readPalette(); dirty.current = true })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  // 그리기 반복 (바뀐 게 있을 때만, 강조 깜빡임은 천천히)
  useEffect(() => {
    let raf = 0
    const loop = t => {
      raf = requestAnimationFrame(loop)
      if (document.hidden) return
      const L = latest.current, tw = tween.current
      if (tw) { const k = Math.min(1, (t - tw.t0) / tw.ms); cam.current = lerpCam(tw.from, tw.to, ease(k)); dirty.current = true; if (k >= 1) tween.current = null }
      const pulsing = !!((L.highlight && L.highlight.size) || L.focus?.boxId || L.activeZoneId)
      if (!dirty.current && !(pulsing && t - lastDraw.current > 70)) return
      const cvs = canvasRef.current
      if (!cvs || !cam.current || !L.model.warehouse) return
      dirty.current = false; lastDraw.current = t
      const ctx = cvs.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      scene.current = buildScene(L.model, cam.current, L.size, { palette: pal.current, highlight: L.highlight, focusId: L.focus?.boxId || null, activeZoneId: L.activeZoneId, allNumbers: L.numbers })
      drawScene(ctx, scene.current, L.size, { pulse: 0.5 + 0.5 * Math.sin(t / 230) })
    }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [dpr])

  // 마우스 휠 확대
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const onWheel = e => {
      e.preventDefault(); if (!cam.current) return
      tween.current = null
      const r = el.getBoundingClientRect()
      cam.current = zoomCamera(cam.current, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), latest.current.size, e.clientX - r.left, e.clientY - r.top); dirty.current = true
    }
    el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 포인터
  const local = e => { const r = boxRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const onPointerDown = e => {
    if (e.target.closest('[data-ctl]')) return
    boxRef.current.setPointerCapture?.(e.pointerId)
    const p = local(e); pointers.current.set(e.pointerId, p); tween.current = null
    if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; gesture.current = { type: 'pinch', a0: a, b0: b, cam0: cam.current }; return }
    if (pointers.current.size === 1) gesture.current = { type: e.shiftKey || e.button === 2 || e.button === 1 ? 'pan' : 'rotate', start: p, last: p, moved: false }
  }
  const onPointerMove = e => {
    if (!pointers.current.has(e.pointerId) || !cam.current) return
    const p = local(e); pointers.current.set(e.pointerId, p)
    const g = gesture.current; if (!g) return
    if (g.type === 'pinch') {
      if (pointers.current.size < 2) return
      const [a, b] = [...pointers.current.values()]
      const m0 = [(g.a0[0] + g.b0[0]) / 2, (g.a0[1] + g.b0[1]) / 2], m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const ratio = Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(1, Math.hypot(g.a0[0] - g.b0[0], g.a0[1] - g.b0[1]))
      const z = zoomCamera(g.cam0, ratio, latest.current.size, m0[0], m0[1])
      cam.current = { ...z, panX: z.panX + (m1[0] - m0[0]), panY: z.panY + (m1[1] - m0[1]) }; dirty.current = true; return
    }
    const dx = p[0] - g.last[0], dy = p[1] - g.last[1]
    if (!g.moved && Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) < 5) return
    g.moved = true; g.last = p
    cam.current = g.type === 'pan' ? { ...cam.current, panX: cam.current.panX + dx, panY: cam.current.panY + dy } : rotateCamera(cam.current, dx * 0.008, dy * 0.006)
    setTopView(cam.current.pitch > PITCH_MAX - 0.05); dirty.current = true
  }
  const onPointerUp = e => {
    const had = pointers.current.has(e.pointerId); pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g?.type === 'pinch') { if (pointers.current.size < 2) gesture.current = null; return }
    if (!had || !g) return
    gesture.current = null
    if (!g.moved && scene.current) {
      const [x, y] = local(e), hit = hitTest(scene.current, x, y)
      if (hit?.type === 'box') onPickBox?.(hit.id); else if (hit?.type === 'zone') onPickZone?.(hit.id)
    }
  }
  const onPointerCancel = e => { pointers.current.delete(e.pointerId); gesture.current = null }

  // 버튼
  const zoomBy = f => { if (!cam.current) return; tween.current = null; cam.current = zoomCamera(cam.current, f, size); dirty.current = true }
  const turn = d => { if (cam.current) tweenTo({ ...cam.current, yaw: cam.current.yaw + d }, 320) }
  const toggleTop = () => { if (!cam.current) return; const top = cam.current.pitch < PITCH_MAX - 0.05; setTopView(top); tweenTo({ ...cam.current, pitch: top ? PITCH_MAX : 0.78 }, 380) }
  const reset = () => { setTopView(false); tweenTo(defaultCamera(model, size), 450) }
  const ctl = 'w-9 h-9 rounded-2xl bg-surface-900/95 border border-surface-700 text-surface-200 flex items-center justify-center shadow-lg backdrop-blur hover:bg-surface-800 active:scale-90 transition-all'

  return (
    <div ref={frameRef} className={full ? 'fixed inset-0 z-[90] flex flex-col gap-2 p-3 bg-surface-950' : 'flex flex-col gap-2'}>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg">🧊</span><h2 className="font-bold text-white text-sm">3D 창고</h2>
        <div className="flex-1" />
        {full && <Btn size="sm" variant="soft" onClick={toggle}>닫기 ✕</Btn>}
      </div>
      <div ref={boxRef} data-testid="scene3d" className={`relative rounded-[28px] overflow-hidden border border-surface-700 touch-none select-none ${full ? 'flex-1 min-h-0' : 'h-[300px] sm:h-[340px]'}`}
        style={{ background: 'rgb(var(--surface-950))', cursor: 'grab' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onContextMenu={e => e.preventDefault()}>
        <canvas ref={canvasRef} data-testid="scene3d-canvas" width={Math.round(size.w * dpr)} height={Math.round(size.h * dpr)} style={{ width: size.w, height: size.h }} className="absolute inset-0" />
        {!wh && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center pointer-events-none">
            <div><div className="text-5xl mb-2">🧊</div><p className="text-sm font-bold text-white">창고를 그리면 여기에 3D로 보여요</p></div>
          </div>)}
        {wh && <>
          <div className="absolute left-3 bottom-3 max-w-[58%] px-3 py-1.5 rounded-2xl bg-surface-900/90 border border-surface-700 text-[11px] text-surface-300 backdrop-blur pointer-events-none">끌어서 돌리고, 두 손가락(휠)으로 확대해요</div>
          <div data-ctl className="absolute right-3 bottom-3 flex flex-col gap-1.5">
            <button type="button" className={ctl} title="확대" aria-label="확대" onClick={() => zoomBy(1.3)}><Plus size={16} /></button>
            <button type="button" className={ctl} title="축소" aria-label="축소" onClick={() => zoomBy(1 / 1.3)}><Minus size={16} /></button>
            <button type="button" className={ctl} title="왼쪽으로 돌리기" aria-label="왼쪽으로 돌리기" onClick={() => turn(-Math.PI / 4)}><RotateCcw size={16} /></button>
            <button type="button" className={ctl} title="오른쪽으로 돌리기" aria-label="오른쪽으로 돌리기" onClick={() => turn(Math.PI / 4)}><RotateCw size={16} /></button>
            <button type="button" className={`${ctl} ${topView ? '!bg-primary-500 !border-primary-500' : ''}`} style={topView ? { color: '#fff' } : undefined} title="위에서 보기" aria-label="위에서 보기" onClick={toggleTop}><Layers size={16} /></button>
            <button type="button" className={`${ctl} text-[11px] font-black ${numbers ? '!bg-primary-500 !border-primary-500' : ''}`} style={numbers ? { color: '#fff' } : undefined} title="번호 모두 보기" aria-label="번호 모두 보기" onClick={() => setNumbers(v => !v)}>123</button>
            <button type="button" className={ctl} title="처음 시점" aria-label="처음 시점" onClick={reset}><Crosshair size={16} /></button>
            <button type="button" className={ctl} title={full ? '전체화면 닫기' : '전체화면'} aria-label="전체화면" onClick={toggle}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          </div>
        </>}
      </div>
    </div>
  )
}
