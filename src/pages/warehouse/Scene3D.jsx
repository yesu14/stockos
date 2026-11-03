// ═══════════════════════════════════════════════════════════
//  상품찾기 — 3D 창고 뷰어 (캔버스)
//  왼쪽 끌기=돌리기, 오른쪽 끌기(또는 Shift+끌기, ✋ 이동 모드)=바닥 위 좌우앞뒤 이동, 휠/두 손가락=확대, 방향키·WASD=이동, 클릭=박스 선택
// ═══════════════════════════════════════════════════════════
import ViewPicker from './ViewPicker'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, Minus, RotateCcw, RotateCw, Maximize2, Minimize2, Crosshair, Layers, Move, SlidersHorizontal } from 'lucide-react'
import { Btn, useFullscreen } from './ui'
import { rgbToHex, clamp } from './whLogic'
import {
  buildScene, drawScene, hitTest, defaultCamera, zoomCamera, rotateCamera, focusCamera, panGround,
  DARK_PALETTE, LIGHT_PALETTE, PITCH_MAX, SCALE_MIN, SCALE_MAX, SPREAD_DEFAULT,
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

export default function Scene3D({ model, highlight, focus, activeZoneId, onPickBox, onPickZone, onEngine }) {
  const wh = model.warehouse
  const { ref: frameRef, full, toggle } = useFullscreen()
  const boxRef = useRef(null), canvasRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })        // 실제로 측정되기 전에는 맞추지 않음
  const [topView, setTopView] = useState(false)
  const [numbers, setNumbers] = useState(true)          // 번호 모두 보기 (가려진 박스도 번호표로 보여줌)
  const [spread, setSpread] = useState(SPREAD_DEFAULT)   // 박스 간격 (0 = 붙임 ~ 1 = 아주 넓게)
  const [maxTier, setMaxTier] = useState(0)              // 층 보기: 0 = 전체, n = n층까지만
  const [xray, setXray] = useState(false)                // 속 보기 (박스를 반투명하게)
  const [links, setLinks] = useState(true)                // 층 연결 점선 (위층 박스를 바로 아래 박스와 이어서 보여줌)
  const [panMode, setPanMode] = useState(false)          // ✋ 이동 모드: 왼쪽 끌기/한 손가락으로도 이동 (오른쪽 버튼이 없는 터치 화면용)
  const [panel, setPanel] = useState(false)
  const [lowDetail, setLowDetail] = useState(false)       // 박스가 너무 작아서 번호표를 생략한 상태
  const tiersList = useMemo(() => Array.from({ length: Math.max(1, ...model.boxes.map(b => b.tier)) }, (_, i) => i + 1), [model.boxes])
  useEffect(() => { if (maxTier > tiersList.length) setMaxTier(0) }, [tiersList.length]) // eslint-disable-line
  const cam = useRef(null), scene = useRef(null), dirty = useRef(true), tween = useRef(null), pal = useRef(DARK_PALETTE)
  const lowRef = useRef(false), pointers = useRef(new Map()), gesture = useRef(null), camKey = useRef(null), lastDraw = useRef(0)
  const prevSize = useRef(null), rescale = useRef(false), firstFull = useRef(true)
  const latest = useRef({}); latest.current = { model, highlight, focus, activeZoneId, size, numbers, spread, maxTier, xray, links }
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
    const to = defaultCamera(model, size, spread)
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
  useEffect(() => { dirty.current = true }, [model, highlight, focus?.boxId, activeZoneId, numbers, spread, maxTier, xray, links])
  // 검색 결과를 누르면 그 박스/구역으로 이동
  useEffect(() => {
    if (!focus || !cam.current || size.w < 60) return
    const to = focusCamera(cam.current, model, focus, size, spread)
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
      scene.current = buildScene(L.model, cam.current, L.size, { palette: pal.current, highlight: L.highlight, focusId: L.focus?.boxId || null, activeZoneId: L.activeZoneId, allNumbers: L.numbers, spread: L.spread, maxTier: L.maxTier, xray: L.xray, links: L.links })
      drawScene(ctx, scene.current, L.size, { pulse: 0.5 + 0.5 * Math.sin(t / 230) })
      const low = !!(L.numbers && scene.current.stats?.lod); if (low !== lowRef.current) { lowRef.current = low; setLowDetail(low) }
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
    boxRef.current.focus?.({ preventScroll: true })                      // 방향키로 움직일 수 있게
    const p = local(e); pointers.current.set(e.pointerId, p); tween.current = null
    if (tapRef.current) { clearTimeout(tapRef.current.timer); tapRef.current = null }
    if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; gesture.current = { type: 'pinch', a0: a, b0: b, cam0: cam.current }; return }
    if (pointers.current.size === 1) gesture.current = { type: e.shiftKey || e.ctrlKey || e.button === 2 || e.button === 1 || panMode ? 'pan' : 'rotate', start: p, last: p, moved: false }
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
      cam.current = panGround(z, m1[0] - m0[0], m1[1] - m0[1]); dirty.current = true; return
    }
    const dx = p[0] - g.last[0], dy = p[1] - g.last[1]
    if (!g.moved && Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) < 5) return
    g.moved = true; g.last = p
    cam.current = g.type === 'pan' ? panGround(cam.current, dx, dy) : rotateCamera(cam.current, dx * 0.008, dy * 0.006)
    setTopView(cam.current.pitch > PITCH_MAX - 0.05); dirty.current = true
  }
  const tapRef = useRef(null)
  const fireTap = () => {
    const t = tapRef.current; if (!t) return; tapRef.current = null; clearTimeout(t.timer)
    if (!scene.current) return
    const hit = hitTest(scene.current, t.p[0], t.p[1])
    if (hit?.type === 'box') onPickBox?.(hit.id); else if (hit?.type === 'zone') onPickZone?.(hit.id)
  }
  const onPointerUp = e => {
    const had = pointers.current.has(e.pointerId); pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g?.type === 'pinch') { if (pointers.current.size < 2) gesture.current = null; return }
    if (!had || !g) return
    gesture.current = null
    if (!g.moved && scene.current) { clearTimeout(tapRef.current?.timer); tapRef.current = { p: local(e), timer: setTimeout(() => fireTap(), 400) } }      // 창은 click 이벤트 때 열기 (폰 고스트 클릭 방지)
  }
  const onPointerCancel = e => { pointers.current.delete(e.pointerId); gesture.current = null }

  // 버튼
  const zoomBy = f => { if (!cam.current) return; tween.current = null; cam.current = zoomCamera(cam.current, f, size); dirty.current = true }
  const turn = d => { if (cam.current) tweenTo({ ...cam.current, yaw: cam.current.yaw + d }, 320) }
  const toggleTop = () => { if (!cam.current) return; const top = cam.current.pitch < PITCH_MAX - 0.05; setTopView(top); tweenTo({ ...cam.current, pitch: top ? PITCH_MAX : 0.78 }, 380) }
  const reset = () => { setTopView(false); tweenTo(defaultCamera(model, size, spread), 450) }
  // 키보드: 3D 화면을 한 번 누른 뒤 방향키/WASD = 앞뒤좌우 이동, Q/E = 돌리기, +/- = 확대 (Shift 를 누르면 크게)
  const onKeyDown = e => {
    if (e.target !== e.currentTarget || e.altKey || e.metaKey || e.ctrlKey || !cam.current) return
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, STEP = e.shiftKey ? 140 : 60
    const mv = { ArrowUp: [0, STEP], w: [0, STEP], ArrowDown: [0, -STEP], s: [0, -STEP], ArrowLeft: [STEP, 0], a: [STEP, 0], ArrowRight: [-STEP, 0], d: [-STEP, 0] }[k]
    if (mv) { e.preventDefault(); tween.current = null; cam.current = panGround(cam.current, mv[0], mv[1]); dirty.current = true; return }
    if (k === 'q') { e.preventDefault(); turn(-Math.PI / 12) } else if (k === 'e') { e.preventDefault(); turn(Math.PI / 12) }
    else if (k === '+' || k === '=') { e.preventDefault(); zoomBy(1.2) } else if (k === '-' || k === '_') { e.preventDefault(); zoomBy(1 / 1.2) }
  }
  const chip = on => `px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${on ? 'bg-primary-500 border-primary-500 text-white' : 'bg-surface-800 border-surface-700 text-surface-200 hover:bg-surface-700'}`
  const ctl = 'w-9 h-9 rounded-2xl bg-surface-900/95 border border-surface-700 text-surface-200 flex items-center justify-center shadow-lg backdrop-blur hover:bg-surface-800 active:scale-90 transition-all'

  return (
    <div ref={frameRef} className={full ? 'fixed inset-0 z-[90] flex flex-col gap-2 p-3 bg-surface-950' : 'flex flex-col gap-2'}>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg">🧊</span><h2 className="font-bold text-white text-sm">3D 창고 <span className="text-[10px] font-normal text-surface-400">(예전 방식)</span></h2>
        <div className="flex-1" />
        {onEngine ? <ViewPicker value="classic" onChange={onEngine} /> : <span className="text-[10px] text-surface-500">이 기기에서는 새 3D 를 쓸 수 없어요</span>}
        {full && <Btn size="sm" variant="soft" onClick={toggle}>닫기 ✕</Btn>}
      </div>
      <div ref={boxRef} data-testid="scene3d" tabIndex={0} onKeyDown={onKeyDown} className={`relative rounded-[28px] overflow-hidden border border-surface-700 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${full ? 'flex-1 min-h-0' : 'h-[300px] sm:h-[340px]'}`}
        style={{ background: 'rgb(var(--surface-950))', cursor: 'grab' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={e => { if (e.target.closest('[data-ctl]')) return; fireTap() }} onPointerCancel={onPointerCancel} onContextMenu={e => e.preventDefault()}>
        <canvas ref={canvasRef} data-testid="scene3d-canvas" width={Math.round(size.w * dpr)} height={Math.round(size.h * dpr)} style={{ width: size.w, height: size.h }} className="absolute inset-0" />
        {!wh && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center pointer-events-none">
            <div><div className="text-5xl mb-2">🧊</div><p className="text-sm font-bold text-white">창고를 그리면 여기에 3D로 보여요</p></div>
          </div>)}
        {wh && <>
          <div className="absolute left-3 bottom-3 max-w-[52%] px-3 py-1.5 rounded-2xl bg-surface-900/90 border border-surface-700 text-[11px] leading-snug text-surface-300 backdrop-blur pointer-events-none">
            {panMode ? '✋ 끌면 이동해요 · 휠로 확대' : '왼쪽 끌기: 돌리기 · 오른쪽 끌기: 이동 · 휠: 확대'}
            {lowDetail && <span className="block text-primary-300 font-bold">🔍 확대하면 번호가 보여요</span>}
          </div>
          <div data-ctl className="absolute right-3 bottom-3 grid grid-cols-2 gap-1.5">
            <button type="button" className={ctl} title="확대" aria-label="확대" onClick={() => zoomBy(1.3)}><Plus size={16} /></button>
            <button type="button" className={ctl} title="축소" aria-label="축소" onClick={() => zoomBy(1 / 1.3)}><Minus size={16} /></button>
            <button type="button" className={ctl} title="왼쪽으로 돌리기" aria-label="왼쪽으로 돌리기" onClick={() => turn(-Math.PI / 4)}><RotateCcw size={16} /></button>
            <button type="button" className={ctl} title="오른쪽으로 돌리기" aria-label="오른쪽으로 돌리기" onClick={() => turn(Math.PI / 4)}><RotateCw size={16} /></button>
            <button type="button" className={`${ctl} ${panMode ? '!bg-primary-500 !border-primary-500' : ''}`} style={panMode ? { color: '#fff' } : undefined} title="이동 모드 (켜면 끌어서 이동)" aria-label="이동 모드" aria-pressed={panMode} onClick={() => setPanMode(v => !v)}><Move size={16} /></button>
            <button type="button" className={`${ctl} ${topView ? '!bg-primary-500 !border-primary-500' : ''}`} style={topView ? { color: '#fff' } : undefined} title="위에서 보기" aria-label="위에서 보기" aria-pressed={topView} onClick={toggleTop}><Layers size={16} /></button>
            <button type="button" className={`${ctl} text-[11px] font-black ${numbers ? '!bg-primary-500 !border-primary-500' : ''}`} style={numbers ? { color: '#fff' } : undefined} title="번호 모두 보기" aria-label="번호 모두 보기" onClick={() => setNumbers(v => !v)}>123</button>
            <button type="button" className={`${ctl} ${panel ? '!bg-primary-500 !border-primary-500' : ''}`} style={panel ? { color: '#fff' } : undefined} title="보기 설정 (박스 간격, 층 보기, 속 보기)" aria-label="보기 설정" aria-pressed={panel} onClick={() => setPanel(v => !v)}><SlidersHorizontal size={16} /></button>
            <button type="button" className={ctl} title="처음 시점" aria-label="처음 시점" onClick={reset}><Crosshair size={16} /></button>
            <button type="button" className={ctl} title={full ? '전체화면 닫기' : '전체화면'} aria-label="전체화면" onClick={toggle}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
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
            <div className="text-[11px] font-bold text-surface-200 mb-1">층 보기 <span className="font-normal text-surface-400">(고른 층까지만 보여요)</span></div>
            <div className="flex flex-wrap gap-1">
              {[0, ...tiersList].map(n => <button key={n} type="button" onClick={() => setMaxTier(n)} className={chip(maxTier === n)}>{n === 0 ? '전체' : `${n}층`}</button>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <label className="flex items-center gap-2 text-[11px] text-surface-200 cursor-pointer"><input type="checkbox" checked={numbers} onChange={e => setNumbers(e.target.checked)} /> 번호표 모두 보기 <span className="text-surface-500">(가려진 박스도)</span></label>
            <label className="flex items-center gap-2 text-[11px] text-surface-200 cursor-pointer"><input type="checkbox" checked={xray} onChange={e => setXray(e.target.checked)} /> 속 보기 <span className="text-surface-500">(반투명하게)</span></label>
            <label className="flex items-center gap-2 text-[11px] text-surface-200 cursor-pointer"><input type="checkbox" checked={links} onChange={e => setLinks(e.target.checked)} /> 층 연결 점선 <span className="text-surface-500">(위층 박스를 바로 아래 박스와 이어 보여요)</span></label>
          </div>
          <p className="text-[10px] text-surface-500 leading-relaxed">3D 화면을 한 번 누른 뒤: 방향키 / W A S D = 이동 · Q E = 돌리기 · + − = 확대 (Shift 를 같이 누르면 크게)</p>
        </div>)}
    </div>
  )
}
