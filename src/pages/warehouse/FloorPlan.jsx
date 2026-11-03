// ═══════════════════════════════════════════════════════════
//  상품찾기 — 평면도 편집기 (게임처럼 그리고, 옮기고, 붙이는 화면)
//  SVG 로 그림. 좌표 계산은 planMath.js(테스트됨), 규칙 검사는 whLogic.js
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Plus, Minus, RotateCcw, RotateCw, Maximize2, Minimize2, Trash2, Settings, Package, Crosshair } from 'lucide-react'
import { Btn, FixtureIcon, useFullscreen } from './ui'
import {
  SNAP, MIN_ZONE, LIMITS, REASON_TEXT, FIXTURE_LABEL, checkZoneRect, checkOfficeSpot, snapToWall, fixtureAnchor, fixtureLen,
  shade, rgba, clamp, round2, snap, OFFICE_W, OFFICE_H, planBoxMove,
} from './whLogic'
import * as M from './planMath'

const WALL_ANGLE = { top: 0, bottom: 180, left: -90, right: 90 }
const css = v => `rgb(var(${v}))`
const OFF_HW = OFFICE_W / 2 + 0.2, OFF_HH = OFFICE_H / 2 + 0.2          // 사무실이 창고 밖으로 나가지 않는 한계
const HINTS = {
  select: '박스를 끌어서 다른 칸·구역으로 옮겨요 (누르면 열려요). 구역은 빈 곳을 끌어 옮겨요',
  wh: '끌어서 창고 크기를 정해요 🏭 (나중에 테두리의 노란 점을 끌면 바꿀 수 있어요)',
  zone: '창고 안에서 끌어서 구역을 그려보세요 ▭',
  window: '벽 가까이를 눌러서 창문을 붙여요',
  door: '벽 가까이를 눌러서 출입구를 붙여요',
  office: '창고 안을 눌러서 사무실을 놓아요',
}

// ── 시설물 그림 (월드 단위, 가운데가 기준, 안쪽이 +y) ──
function WallGlyph({ kind, len, selected, ghost }) {
  const th = kind === 'door' ? 1.1 : 0.8
  return (
    <g opacity={ghost ? 0.65 : 1}>
      {kind === 'door' && <path d={`M${-len / 2} 0 L${len / 2} 0 A${len} ${len} 0 0 1 ${-len / 2} ${len} Z`} fill="rgba(217,162,115,0.22)" stroke="#9b6b3e" strokeWidth={0.06} strokeDasharray="0.3 0.22" />}
      <rect x={-len / 2} y={-th / 2} width={len} height={th} rx={0.24} fill={kind === 'window' ? '#bfe6ff' : '#d9a273'} stroke={kind === 'window' ? '#5aa9d6' : '#9b6b3e'} strokeWidth={0.1} />
      {kind === 'window' && <><path d={`M0 ${-th / 2}V${th / 2}`} stroke="#5aa9d6" strokeWidth={0.08} /><path d={`M${-len / 2 + 0.3} ${-th * 0.2}L${-len / 2 + 0.85} ${-th * 0.3}`} stroke="#fff" strokeWidth={0.1} strokeLinecap="round" /></>}
      {kind === 'door' && <circle cx={len / 2 - 0.5} cy={0} r={0.2} fill="#f6e3a1" stroke="#9b6b3e" strokeWidth={0.06} />}
      {selected && <rect x={-len / 2 - 0.25} y={-th / 2 - 0.25} width={len + 0.5} height={th + 0.5} rx={0.4} fill="none" stroke="#f59e0b" strokeWidth={0.14} />}
    </g>
  )
}
function OfficeGlyph({ rot, selected, ghost, bad }) {
  return (
    <g opacity={ghost ? 0.65 : 1} transform={`scale(${OFFICE_W / 3.2})`}>
      <rect x={-1.6} y={-1.3} width={3.2} height={2.6} rx={0.45} fill="#d8c6ff" stroke="#a98cf0" strokeWidth={0.12} />
      <path d="M-1.9 -0.7 L0 -1.75 L1.9 -0.7 Z" fill="#a98cf0" stroke="#8b6cdc" strokeWidth={0.1} strokeLinejoin="round" />
      <rect x={-1.1} y={-0.55} width={0.75} height={0.65} rx={0.15} fill="#fff" /><rect x={0.35} y={-0.55} width={0.75} height={0.65} rx={0.15} fill="#fff" />
      <rect x={-0.35} y={0.2} width={0.7} height={1.0} rx={0.18} fill="#8b6cdc" />
      <g transform={`translate(0 1.75) rotate(${-rot / 1})`}><text textAnchor="middle" dominantBaseline="central" fontSize={0.62} fontWeight="700" style={{ fill: css('--surface-100') }}>사무실</text></g>
      {selected && <rect x={-2.1} y={-1.95} width={4.2} height={4.3} rx={0.5} fill="none" stroke="#f59e0b" strokeWidth={0.14} />}
      {bad && <rect x={-2.1} y={-1.95} width={4.2} height={4.3} rx={0.5} fill="rgba(239,68,68,0.28)" stroke="#ef4444" strokeWidth={0.16} strokeDasharray="0.5 0.35" />}
    </g>
  )
}
function FixtureShape({ f, W, H, rot, selected, ghost }) {
  const a = fixtureAnchor(f, W, H)
  if (f.kind === 'office') return <g transform={`translate(${a.x} ${a.y})`}><OfficeGlyph rot={rot} selected={selected} ghost={ghost} bad={f.bad} /></g>
  const len = fixtureLen(f.kind, W, H, a.wall)
  return <g transform={`translate(${a.x} ${a.y}) rotate(${WALL_ANGLE[a.wall]})`}><WallGlyph kind={f.kind} len={len} selected={selected} ghost={ghost} /></g>
}

// ── 구역 (칸 구조 + 쌓인 박스를 층마다 하나씩, 맨 위층이 위) ──
function ZoneShape({ z, highlight, focusBoxId, dragBoxId, dim, rot, zoomQ, selected, canEdit }) {
  const m = Math.min(z.cw, z.ch), cellPx = m * zoomQ
  const strokes = cellPx >= 7
  const pad = m * 0.06, hl = highlight && highlight.size ? highlight : null
  const cells = []
  z.lines.forEach((ln, li) => {
    for (let s = 1; s <= ln.slot_count; s++) {
      const st = ln.stacks.get(s)
      const x = z.x + (s - 1) * z.cw + pad, y = z.y + li * z.ch + pad, w = z.cw - 2 * pad, h = z.ch - 2 * pad
      const rx = Math.min(m * 0.14, 0.45)
      // 칸 자리: 비어 있어도 어디가 칸인지 보이게
      cells.push(<rect key={`bg-${li}-${s}`} x={x} y={y} width={w} height={h} rx={rx} fill={rgba(z.color, st && st.length ? 0.1 : 0.16)} stroke={strokes ? rgba(shade(z.color, 0.7), 0.55) : 'none'} strokeWidth={0.05} strokeDasharray="0.22 0.2" />)
      if (!st || !st.length) continue
      const n = st.length, gap = Math.min(h * 0.03, 0.08), mh = (h - gap * (n - 1)) / n
      const wPx = w * zoomQ, miniPx = mh * zoomQ
      if (miniPx < 5.5) {          // 너무 작아서 층마다 나눌 수 없을 때: 한 덩어리 + 층 수 (확대하면 박스가 하나씩 보임)
        const top = st[st.length - 1], isHl = hl && st.some(b => hl.has(b.id)), isFocus = focusBoxId && st.some(b => b.id === focusBoxId), faded = hl && !isHl
        const label = String(top.box_number), fs = Math.min(m * 0.34, (w * 0.86) / Math.max(1.6, label.length * 0.62))
        cells.push(
          <g key={`c-${li}-${s}`} data-hit={`box:${top.id}`} opacity={faded ? 0.3 : 1} style={{ cursor: canEdit ? 'grab' : 'pointer' }}>
            <rect x={x} y={y} width={w} height={h} rx={rx} fill={shade(z.color, 1.04)} stroke={isFocus ? '#ff4f93' : isHl ? '#f59e0b' : shade(z.color, 0.6)} strokeWidth={isFocus || isHl ? Math.min(m * 0.08, 0.16) : 0.06} className={isHl || isFocus ? 'wh-pulse' : undefined} />
            {cellPx >= 16 && <g transform={`translate(${x + w / 2} ${y + h / 2}) rotate(${-rot})`}><text textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="800" style={{ fill: '#2b3445' }}>{label}</text></g>}
            {cellPx >= 16 && n >= 2 && <g transform={`translate(${x + w} ${y}) rotate(${-rot})`}><circle r={m * 0.17} fill="#fff" stroke={shade(z.color, 0.6)} strokeWidth={0.05} /><text textAnchor="middle" dominantBaseline="central" fontSize={m * 0.2} fontWeight="800" style={{ fill: '#2b3445' }}>{n}</text></g>}
          </g>)
        continue
      }
      st.slice().reverse().forEach((b, i) => {          // 맨 위층이 위, 1층이 아래
        const by = y + i * (mh + gap), isHl = hl && hl.has(b.id), isFocus = focusBoxId === b.id, faded = hl && !isHl
        const label = String(b.box_number), showText = miniPx >= 8.5 && wPx >= 14
        const fs = Math.min(mh * 0.72, (w * 0.9) / Math.max(1.5, label.length * 0.62))
        cells.push(
          <g key={b.id} data-hit={`box:${b.id}`} opacity={dragBoxId === b.id ? 0.25 : faded ? 0.3 : 1} style={{ cursor: canEdit ? 'grab' : 'pointer' }}>
            <rect x={x} y={by} width={w} height={mh} rx={Math.min(rx, mh * 0.3)} fill={shade(z.color, i % 2 ? 1.0 : 1.08)} stroke={isFocus ? '#ff4f93' : isHl ? '#f59e0b' : shade(z.color, 0.6)} strokeWidth={isFocus || isHl ? Math.min(m * 0.08, 0.16) : 0.05} className={isHl || isFocus ? 'wh-pulse' : undefined} />
            {showText && <g transform={`translate(${x + w / 2} ${by + mh / 2}) rotate(${-rot})`}><text textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="800" style={{ fill: '#2b3445' }}>{label}</text></g>}
            <title>{`박스 ${label} · ${b.tier}층`}</title>
          </g>)
      })
    }
  })
  const name = z.name
  const em = [...name].reduce((s, ch) => s + (ch.charCodeAt(0) > 0x2e80 ? 1.06 : 0.62), 0)       // 글자 폭(em): 한글은 넓고 영문/숫자는 좁다
  const fs = clamp(Math.min(1.0, (z.w * 0.9) / Math.max(3, em + 1.6)), 0.5, 1.0)
  const ph = fs * 1.55, pw = ph * 0.95 + em * fs + ph * 0.5
  return (
    <g data-hit={`zone:${z.id}`} opacity={dim ? 0.35 : 1} style={{ cursor: 'pointer' }}>
      <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={0.45} fill={rgba(z.color, 0.26)} stroke={selected ? '#f59e0b' : shade(z.color, 0.8)} strokeWidth={selected ? 0.22 : 0.14} />
      {cells}
      <g transform={`translate(${z.x + pw / 2 + 0.35} ${z.y - ph / 2 - 0.12}) rotate(${-rot})`}>
        <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} rx={ph / 2} fill="#fff" stroke={shade(z.color, 0.8)} strokeWidth={0.07} />
        <circle cx={-pw / 2 + ph * 0.5} cy={0} r={ph * 0.2} fill={z.color} />
        <text x={-pw / 2 + ph * 0.85} y={0} dominantBaseline="central" fontSize={fs} fontWeight="800" style={{ fill: '#334155' }}>{name}</text>
      </g>
    </g>
  )
}

// ── 바뀌지 않는 큰 부분은 한 번만 그림 (확대/이동 중에 다시 그리지 않도록) ──
const WorldLayer = memo(function WorldLayer({ model, highlight, focusBoxId, dragBoxId, dragZoneId, dragFxId, selZoneId, selFxId, rot, zoomQ, canEdit }) {
  const wh = model.warehouse
  if (!wh) return null
  const W = wh.width, H = wh.height
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} rx={0.6} style={{ fill: css('--surface-800') }} />
      <rect x={0} y={0} width={W} height={H} fill="url(#wh-dots)" pointerEvents="none" />
      <rect x={0} y={0} width={W} height={H} rx={0.6} fill="none" strokeWidth={1.1} pointerEvents="stroke" data-hit="wh" style={{ stroke: css('--surface-500'), cursor: 'pointer' }} />
      {model.fixtures.map(f => {
        const a = fixtureAnchor(f, W, H)
        return (
          <g key={f.id} data-hit={`fx:${f.id}`} opacity={dragFxId === f.id ? 0.3 : 1} style={{ cursor: 'pointer' }}>
            <FixtureShape f={f} W={W} H={H} rot={rot} selected={selFxId === f.id} />
            <circle cx={a.x} cy={a.y} r={f.kind === 'office' ? OFFICE_W / 2 : Math.max(1.5, fixtureLen(f.kind, W, H, a.wall) / 2)} fill="transparent" />
          </g>)
      })}
      {model.zones.map(z => <ZoneShape key={z.id} z={z} highlight={highlight} focusBoxId={focusBoxId} dragBoxId={dragBoxId} dim={dragZoneId === z.id} rot={rot} zoomQ={zoomQ} selected={selZoneId === z.id} canEdit={canEdit} />)}
    </g>
  )
})

// 박스를 끄는 중: 따라다니는 박스 + 놓을 칸(초록=가능, 빨강=불가) + 어디에 몇 층으로 놓이는지
function BoxDragOverlay({ drag, model, rot }) {
  const box = model.boxesById.get(drag.id); if (!box) return null
  const src = model.zonesById.get(box.zone_id), gw = Math.max(1.8, (src?.cw || 2) * 0.8), gh = Math.max(1, gw * 0.5)
  const { cell, plan } = drag
  let marker = null
  if (cell) {
    const { zone, line, slot } = cell, cx0 = zone.x + (slot - 1) * zone.cw, cy0 = zone.y + line.idx * zone.ch, ok = !!plan?.ok
    const text = plan ? (plan.ok ? `${zone.name} · ${line.no}번째 줄 · ${slot}번째 칸 · ${plan.toTier}층${plan.falls ? ` (위 ${plan.falls}개는 내려와요)` : ''}` : plan.text) : ''
    const fs = 0.8, tw = [...text].reduce((t, ch) => t + (ch.charCodeAt(0) > 0x2e80 ? 1.06 : 0.6), 0) * fs + 1.4
    marker = (
      <g>
        <rect x={cx0} y={cy0} width={zone.cw} height={zone.ch} rx={0.2} fill={ok ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)'} stroke={ok ? '#22c55e' : '#ef4444'} strokeWidth={0.16} />
        {text && <g transform={`translate(${cx0 + zone.cw / 2} ${zone.y >= 3.4 ? zone.y - 2.4 : zone.y + zone.h + 1.1}) rotate(${-rot})`}>
          <rect x={-tw / 2} y={-fs * 0.8} width={tw} height={fs * 1.6} rx={fs * 0.8} fill="#fff" stroke={ok ? '#22c55e' : '#ef4444'} strokeWidth={0.07} />
          <text y={0} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="800" style={{ fill: ok ? '#166534' : '#b91c1c' }}>{text}</text>
        </g>}
      </g>)
  }
  const label = String(box.box_number)
  return (
    <g pointerEvents="none">
      {marker}
      <g transform={`translate(${drag.x} ${drag.y})`}>
        <rect x={-gw / 2} y={-gh / 2} width={gw} height={gh} rx={gh * 0.25} fill={box.zoneColor} stroke="#f59e0b" strokeWidth={0.14} opacity={0.92} />
        <g transform={`rotate(${-rot})`}><text textAnchor="middle" dominantBaseline="central" fontSize={Math.min(gh * 0.7, (gw * 0.8) / Math.max(1.5, label.length * 0.62))} fontWeight="800" style={{ fill: '#2b3445' }}>{label}</text></g>
      </g>
    </g>)
}

// 창고가 화면에 꼭 맞게. 오른쪽의 확대/축소 버튼 줄에 모서리 손잡이가 가려지지 않게 오른쪽을 조금 비워 둠
const fitWarehouseView = (w, h, size, rot) => {
  const v = M.fitView({ x: 0, y: 0, w, h }, size.w - 56, size.h, rot, 0.92)
  const [cx, cy] = M.s2w(v, size.w, size.h, size.w / 2 + 28, size.h / 2)
  return { ...v, cx, cy }
}
const hitOf = el => {
  const n = el?.closest?.('[data-hit]'); if (!n) return null
  const s = n.getAttribute('data-hit'), i = s.indexOf(':')
  return i < 0 ? { kind: s, id: null } : { kind: s.slice(0, i), id: s.slice(i + 1) }
}

export default function FloorPlan({ model, canEdit, highlight, focus, onSelectZone, onNotify, actions }) {
  const wh = model.warehouse
  const { ref: frameRef, full, toggle } = useFullscreen()
  const boxRef = useRef(null), svgRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })        // 실제로 측정되기 전에는 맞추지 않음 (기본값으로 맞추면 폰에서 잘려 보임)
  const [view, setViewState] = useState({ cx: 20, cy: 13, zoom: 14, rot: 0 })
  const viewRef = useRef(view)
  const setView = useCallback(v => { viewRef.current = typeof v === 'function' ? v(viewRef.current) : v; setViewState(viewRef.current) }, [])
  const [tool, setTool] = useState('select')
  const [sel, setSel] = useState(null)          // {type:'zone'|'fx'|'wh', id}
  const [draft, setDraft] = useState(null)      // 그리는 중인 사각형
  const [drag, setDrag] = useState(null)        // 옮기는/크기 바꾸는 중 미리보기
  const [ghost, setGhost] = useState(null)      // 붙이기 미리보기
  const [boxDrag, setBoxDrag] = useState(null)  // 박스를 끌고 있는 중: { id, x, y, cell, plan }
  const pts = useRef(new Map()), gesture = useRef(null), anim = useRef(0), inited = useRef(null)
  const prevSize = useRef(null), rescale = useRef(false), firstFull = useRef(true)

  // 화면 크기
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const ro = new ResizeObserver(([en]) => { const r = en.contentRect; setSize(s => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height })) })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  // 처음(또는 창고가 새로 생겼을 때) 창고가 꼭 맞게
  useEffect(() => {
    if (size.w < 60) return
    const key = wh?.id || 'none'; if (inited.current === key) return
    inited.current = key
    setView(fitWarehouseView(wh ? wh.width : 40, wh ? wh.height : 26, size, viewRef.current.rot))
  }, [size.w, size.h, wh?.id, setView])
  // 전체화면으로 바꾸면 화면이 커진 비율만큼 확대해서, 보던 장면이 그대로 더 크게 보이게
  useEffect(() => { if (firstFull.current) { firstFull.current = false; return } rescale.current = true }, [full])
  useEffect(() => {
    const p = prevSize.current; prevSize.current = size
    if (!rescale.current || !p || p.w < 60 || size.w < 60) return
    rescale.current = false
    const r = Math.min(size.w / p.w, size.h / p.h)
    setView(v => ({ ...v, zoom: clamp(v.zoom * r, M.ZOOM_MIN, M.ZOOM_MAX) }))
  }, [size.w, size.h, setView])
  // 마우스 휠 확대 (페이지가 같이 스크롤되지 않게 직접 등록)
  useEffect(() => {
    const el = svgRef.current; if (!el) return
    const onWheel = e => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setView(v => M.zoomAt(v, r.width, r.height, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setView])
  useEffect(() => () => cancelAnimationFrame(anim.current), [])
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') { setTool('select'); setSel(null); setDraft(null); setGhost(null); onSelectZone?.(null) } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onSelectZone])

  const animateTo = useCallback((to, ms = 380) => {
    cancelAnimationFrame(anim.current)
    const from = viewRef.current, t0 = performance.now()
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      setView({ cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, zoom: from.zoom * Math.pow(to.zoom / from.zoom, e), rot: from.rot })
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }, [setView])
  // 탭으로 창을 열 때: 손을 뗀 순간이 아니라 click 이벤트 때 열기 (폰은 손을 뗀 직후 같은 자리에 클릭이 한 번 더 와서, 방금 열린 창의 배경을 눌러 닫아버림)
  const pendingTap = useRef(null)
  const deferTap = fn => { clearTimeout(pendingTap.current?.timer); const t = { fn, timer: setTimeout(() => { if (pendingTap.current === t) { pendingTap.current = null; fn() } }, 400) }; pendingTap.current = t }
  const onSvgClick = () => { const t = pendingTap.current; if (!t) return; clearTimeout(t.timer); pendingTap.current = null; t.fn() }
  // 창고 크기가 바뀌어서(끌어서든 설정 창에서든) 모서리가 화면 밖으로 나갔으면 전체가 보이게 다시 맞춤
  const lastWh = useRef(null)
  useEffect(() => {
    if (!wh || size.w < 60) { lastWh.current = null; return }
    const key = `${wh.id}:${wh.width}x${wh.height}`, prev = lastWh.current; lastWh.current = key
    if (!prev || prev === key || prev.split(':')[0] !== wh.id) return
    const v = viewRef.current, m = 6
    const off = [[0, 0], [wh.width, 0], [wh.width, wh.height], [0, wh.height]].some(([x, y]) => { const [sx, sy] = M.w2s(v, size.w, size.h, x, y); return sx < m || sy < m || sx > size.w - m || sy > size.h - m })
    if (off) animateTo(fitWarehouseView(wh.width, wh.height, size, v.rot))
  }, [wh?.id, wh?.width, wh?.height]) // eslint-disable-line
  // 검색 결과를 누르면 그 구역으로 부드럽게 이동
  useEffect(() => {
    if (!focus || size.w < 60) return
    const z = focus.boxId ? model.zonesById.get(model.boxesById.get(focus.boxId)?.zone_id) : model.zonesById.get(focus.zoneId)
    if (!z) return
    const to = M.fitView({ x: z.x, y: z.y, w: z.w, h: z.h }, size.w, size.h, viewRef.current.rot, 0.5)
    animateTo({ ...to, zoom: clamp(to.zoom, 6, 60) })
  }, [focus?.nonce]) // eslint-disable-line

  const changeTool = t => { setTool(t); setDraft(null); setGhost(null); if (t !== 'select') { setSel(null); onSelectZone?.(null) } }
  const select = s => { setSel(s); onSelectZone?.(s?.type === 'zone' ? s.id : null) }

  // ── 포인터(마우스/터치/펜) ──
  const local = e => { const r = svgRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const toWorld = p => M.s2w(viewRef.current, size.w, size.h, p[0], p[1])
  const bounds = wh ? { w: wh.width, h: wh.height } : null
  const calcGhost = w => {
    if (!wh) return null
    if (tool === 'office') { const x = round2(clamp(snap(w[0], SNAP), OFF_HW, wh.width - OFF_HW)), y = round2(clamp(snap(w[1], SNAP), OFF_HH, wh.height - OFF_HH)); return { kind: 'office', x, y, bad: !checkOfficeSpot({ x, y }, model).ok } }
    const s = snapToWall({ x: w[0], y: w[1] }, wh.width, wh.height)
    return { kind: tool, wall: s.wall, pos: s.pos }
  }

  const onPointerDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return
    if (pendingTap.current) { clearTimeout(pendingTap.current.timer); pendingTap.current = null }
    svgRef.current.setPointerCapture?.(e.pointerId)
    const p = local(e); pts.current.set(e.pointerId, p)
    if (pts.current.size === 2) {                                            // 두 손가락: 확대/이동
      cancelAnimationFrame(anim.current)
      const [a, b] = [...pts.current.values()]
      gesture.current = { type: 'pinch', a0: a, b0: b, view0: viewRef.current }
      setDrag(null); setDraft(null); setGhost(null); return
    }
    if (pts.current.size > 2) return
    cancelAnimationFrame(anim.current)
    const w = toWorld(p), hit = hitOf(e.target)
    const base = { startScreen: p, start: w, startView: viewRef.current, moved: false }
    if (tool === 'wh' || tool === 'zone') {
      if (tool === 'wh' && wh) return
      gesture.current = { ...base, type: 'draw', kind: tool }
      const rect = M.drawRect(w, w, tool === 'zone' ? bounds : null, SNAP)
      setDraft({ kind: tool, rect, valid: false }); return
    }
    if (tool === 'window' || tool === 'door' || tool === 'office') {
      gesture.current = { ...base, type: 'stamp' }; setGhost(calcGhost(w)); return
    }
    // 선택 도구
    if (hit?.kind === 'zone-resize' && canEdit) { const z = model.zonesById.get(hit.id); if (z) { gesture.current = { ...base, type: 'resize-zone', id: z.id, orig: { x: z.x, y: z.y, w: z.w, h: z.h } }; return } }
    if (hit?.kind === 'wh-resize' && canEdit && wh) { gesture.current = { ...base, type: 'resize-wh', edge: hit.id, orig: { x0: 0, y0: 0, x1: wh.width, y1: wh.height } }; return }
    if (hit?.kind === 'box') {                       // 박스 하나를 누름: 끌면 옮기기, 그냥 누르면 열기
      const b = model.boxesById.get(hit.id)
      if (b) { gesture.current = { ...base, type: canEdit ? 'drag-box' : 'tap-box', id: b.id }; return }
    }
    if (hit?.kind === 'fx') {
      const f = model.fixtures.find(x => x.id === hit.id)
      if (f) { select({ type: 'fx', id: f.id }); gesture.current = { ...base, type: canEdit ? 'drag-fx' : 'tap', id: f.id, kind: f.kind }; return }
    }
    if (hit?.kind === 'zone') {
      const z = model.zonesById.get(hit.id)
      if (z) {
        const wasSel = sel?.type === 'zone' && sel.id === z.id
        select({ type: 'zone', id: z.id })
        gesture.current = { ...base, type: canEdit ? 'drag-zone' : 'tap-zone', id: z.id, wasSel, orig: { x: z.x, y: z.y, w: z.w, h: z.h } }; return
      }
    }
    gesture.current = { ...base, type: 'pan', hit: hit?.kind === 'wh' ? 'wh' : null }
  }

  const onPointerMove = e => {
    const known = pts.current.has(e.pointerId)
    if (!known) { if (e.pointerType === 'mouse' && (tool === 'window' || tool === 'door' || tool === 'office')) setGhost(calcGhost(toWorld(local(e)))); return }
    const p = local(e); pts.current.set(e.pointerId, p)
    const g = gesture.current; if (!g) return
    const { w: vw, h: vh } = size
    if (g.type === 'pinch') {
      if (pts.current.size < 2) return
      const [a, b] = [...pts.current.values()]
      const m0 = [(g.a0[0] + g.b0[0]) / 2, (g.a0[1] + g.b0[1]) / 2], m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      let v = M.zoomAt(g.view0, vw, vh, m0[0], m0[1], M.dist(a, b) / Math.max(1, M.dist(g.a0, g.b0)))
      v = M.panByScreen(v, vw, vh, m1[0] - m0[0], m1[1] - m0[1]); setView(v); return
    }
    const dScreen = M.dist(p, g.startScreen)
    if (!g.moved && dScreen > 5) g.moved = true
    const w = toWorld(p)
    switch (g.type) {
      case 'pan': if (g.moved) setView(M.panByScreen(g.startView, vw, vh, p[0] - g.startScreen[0], p[1] - g.startScreen[1])); break
      case 'drag-zone': {
        if (!g.moved) break
        const rect = M.moveRect(g.orig, w[0] - g.start[0], w[1] - g.start[1], bounds, SNAP), chk = checkZoneRect(rect, model, g.id)
        g.last = { rect, ok: chk.ok, reason: chk.reason }; setDrag({ type: 'zone', id: g.id, rect, valid: chk.ok }); break
      }
      case 'resize-zone': {
        const rect = M.resizeRect(g.orig, w[0] - g.start[0], w[1] - g.start[1], bounds, SNAP, MIN_ZONE), chk = checkZoneRect(rect, model, g.id)
        g.moved = true; g.last = { rect, ok: chk.ok, reason: chk.reason }; setDrag({ type: 'zone', id: g.id, rect, valid: chk.ok }); break
      }
      case 'resize-wh': {
        const ext = model.zones.length ? M.zoneExtent(model.zones) : null
        const r = M.resizeBounds(g.orig, g.edge, w[0] - g.start[0], w[1] - g.start[1], ext, { minW: LIMITS.whMin[0], minH: LIMITS.whMin[1], maxW: LIMITS.whMax[0], maxH: LIMITS.whMax[1] }, SNAP)
        g.moved = true; g.last = r; setDrag({ type: 'wh', rect: r }); break
      }
      case 'drag-fx': {
        if (!g.moved || !wh) break
        const patch = g.kind === 'office' ? { x: round2(clamp(snap(w[0], SNAP), OFF_HW, wh.width - OFF_HW)), y: round2(clamp(snap(w[1], SNAP), OFF_HH, wh.height - OFF_HH)) } : snapToWall({ x: w[0], y: w[1] }, wh.width, wh.height)
        g.last = patch; setDrag({ type: 'fx', id: g.id, kind: g.kind, patch: g.kind === 'office' ? { ...patch, bad: !checkOfficeSpot(patch, model, g.id).ok } : patch }); break
      }
      case 'drag-box': {
        if (!g.moved) break
        const zone = M.zoneAt(model.zones, w[0], w[1]), c = zone && M.cellAt(zone, w[0], w[1])
        const cell = c && c.slot ? { zone, line: zone.lines[c.lineIdx], slot: c.slot } : null
        const plan = cell ? planBoxMove(model, g.id, { zoneId: zone.id, lineId: cell.line.id, slot: cell.slot }) : null
        g.last = { cell, plan }; setBoxDrag({ id: g.id, x: w[0], y: w[1], cell, plan }); break
      }
      case 'draw': {
        const rect = M.drawRect(g.start, w, g.kind === 'zone' ? bounds : null, SNAP)
        let valid, reason
        if (g.kind === 'zone') { const c = checkZoneRect(rect, model); valid = c.ok; reason = c.reason }
        else { valid = rect.w >= LIMITS.whMin[0] && rect.h >= LIMITS.whMin[1]; reason = valid ? null : 'wh-small' }
        g.moved = true; g.last = { rect, valid, reason }; setDraft({ kind: g.kind, rect, valid }); break
      }
      case 'stamp': g.moved = true; setGhost(calcGhost(w)); break
      default: break
    }
  }

  const finish = (e, cancelled) => {
    const had = pts.current.has(e.pointerId); pts.current.delete(e.pointerId)
    const g = gesture.current
    if (g?.type === 'pinch') { if (pts.current.size < 2) gesture.current = null; return }
    if (!had || !g) return
    gesture.current = null
    const p = local(e), w = toWorld(p)
    setDrag(null); setDraft(null); setBoxDrag(null)
    if (cancelled) { setGhost(null); return }
    switch (g.type) {
      case 'pan':
        if (!g.moved) { if (g.hit === 'wh' && wh) select({ type: 'wh', id: wh.id }); else select(null) }
        break
      case 'tap-box': case 'drag-box': {
        if (!g.moved) { deferTap(() => actions.openBox(g.id)); break }                                        // 그냥 눌렀으면 박스 열기
        const l = g.last
        if (l?.plan?.ok) actions.moveBox(g.id, { zoneId: l.cell.zone.id, lineId: l.cell.line.id, slot: l.cell.slot })
        else if (l?.plan) onNotify?.(l.plan.text)
        break
      }
      case 'tap-zone': case 'drag-zone': {
        if (g.moved && g.last) { if (g.last.ok) actions.moveZone(g.id, g.last.rect); else onNotify?.(REASON_TEXT[g.last.reason] || '여기에는 놓을 수 없어요') }
        else if (!g.moved && g.wasSel) { const z = model.zonesById.get(g.id), c = z && M.cellAt(z, w[0], w[1]); deferTap(() => actions.openZone(g.id, c?.lineIdx)) }
        break
      }
      case 'resize-zone': if (g.last) { if (g.last.ok) actions.moveZone(g.id, g.last.rect); else onNotify?.(REASON_TEXT[g.last.reason] || '그 크기로는 바꿀 수 없어요') } break
      case 'resize-wh': {
        const r = g.last
        if (r && (r.x0 !== g.orig.x0 || r.y0 !== g.orig.y0 || r.x1 !== g.orig.x1 || r.y1 !== g.orig.y1)) {
          const dx = -r.x0 + 0, dy = -r.y0 + 0                       // 왼쪽/위를 옮기면 좌표의 원점이 바뀜 → 화면은 제자리에 있도록 보는 중심도 같이 옮김
          if (dx || dy) setView(v => ({ ...v, cx: v.cx + dx, cy: v.cy + dy }))
          Promise.resolve(actions.resizeWarehouse(r)).then(ok => { if (!ok && (dx || dy)) setView(v => ({ ...v, cx: v.cx - dx, cy: v.cy - dy })) })     // 저장이 안 되면 되돌림
        }
        break
      }
      case 'drag-fx': if (g.moved && g.last) { const { bad, ...patch } = g.last; actions.moveFixture(g.id, patch) } break      // 사무실이 구역과 겹치면 저장 단계에서 거절하고 알려줌
      case 'draw': {
        const r = g.last
        if (!r) break
        if (r.valid) { if (g.kind === 'wh') actions.createWarehouse(r.rect); else actions.requestCreateZone(r.rect); setTool('select') }
        else onNotify?.(g.kind === 'wh' ? REASON_TEXT['wh-small'] : (REASON_TEXT[r.reason] || '여기에는 그릴 수 없어요'))
        break
      }
      case 'stamp': { const gh = calcGhost(w); setGhost(null); if (gh) { const { bad, ...f } = gh; actions.addFixture(f) } break }
      default: break
    }
  }

  // ── 화면 ──
  const zoomQ = Math.pow(2, Math.round(Math.log2(view.zoom) * 3) / 3)
  const selZone = sel?.type === 'zone' ? model.zonesById.get(sel.id) : null
  const selFx = sel?.type === 'fx' ? model.fixtures.find(f => f.id === sel.id) : null
  const handleR = Math.max(0.55, 15 / view.zoom)
  const dragZone = drag?.type === 'zone' ? model.zonesById.get(drag.id) : null
  const tools = [
    ['select', '선택', 'select', true], ['wh', '창고 그리기', 'warehouse', !wh], ['zone', '구역 그리기', 'zone', !!wh],
    ['window', '창문', 'window', !!wh], ['door', '출입구', 'door', !!wh], ['office', '사무실', 'office', !!wh],
  ].filter(t => t[3])

  return (
    <div ref={frameRef} className={full ? 'fixed inset-0 z-[90] flex flex-col gap-2 p-3 bg-surface-950' : 'flex flex-col h-full gap-2'}>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2 mr-1"><span className="text-lg">🗺️</span><h2 className="font-bold text-white text-sm">평면도</h2></div>
        {canEdit && tools.map(([k, label, icon]) => (
          <button key={k} type="button" onClick={() => changeTool(k)}
            className={`inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-2xl text-xs font-bold border transition-all active:scale-95 ${tool === k ? 'bg-primary-500 border-primary-500 shadow-lg shadow-primary-500/25' : 'bg-surface-800 border-surface-700 text-surface-200 hover:bg-surface-700'}`}
            style={tool === k ? { color: '#fff' } : undefined}>
            <FixtureIcon kind={icon} size={18} />{label}
          </button>))}
        {canEdit && wh && (
          <button type="button" onClick={() => { changeTool('select'); select({ type: 'wh', id: wh.id }) }}
            className={`inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-2xl text-xs font-bold border transition-all active:scale-95 ${sel?.type === 'wh' ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/25' : 'bg-surface-800 border-surface-700 text-surface-200 hover:bg-surface-700'}`}
            style={sel?.type === 'wh' ? { color: '#fff' } : undefined}>
            <Maximize2 size={15} />창고 크기
          </button>)}
        <div className="flex-1" />
        {full && <Btn size="sm" variant="soft" onClick={toggle}>닫기 ✕</Btn>}
      </div>

      <div ref={boxRef} className="relative flex-1 min-h-[300px] rounded-[28px] overflow-hidden border border-surface-700" style={{ background: css('--surface-950') }}>
        <svg ref={svgRef} data-testid="plan-svg" width={size.w} height={size.h} className="absolute inset-0 touch-none select-none"
          style={{ cursor: tool === 'select' ? 'grab' : 'crosshair' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={e => finish(e, false)} onClick={onSvgClick} onPointerCancel={e => finish(e, true)}
          onContextMenu={e => e.preventDefault()}>
          <defs>
            <pattern id="wh-dots" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0.5" cy="0.5" r="0.045" style={{ fill: css('--surface-400'), opacity: 0.5 }} /></pattern>
            <pattern id="wh-bg" width="2" height="2" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.05" style={{ fill: css('--surface-500'), opacity: 0.35 }} /></pattern>
            <style>{`@keyframes whpulse{0%,100%{opacity:1}50%{opacity:.35}}.wh-pulse{animation:whpulse 1.1s ease-in-out infinite}`}</style>
          </defs>
          <g transform={M.viewTransform(view, size.w, size.h)}>
            <rect x={-300} y={-300} width={640} height={640} fill="url(#wh-bg)" pointerEvents="none" />
            <WorldLayer model={model} highlight={highlight} focusBoxId={focus?.boxId || null} dragBoxId={boxDrag?.id || null} canEdit={canEdit} dragZoneId={dragZone?.id || null} dragFxId={drag?.type === 'fx' ? drag.id : null}
              selZoneId={selZone?.id || null} selFxId={selFx?.id || null} rot={view.rot} zoomQ={zoomQ} />

            {/* 창고 선택 표시 + 크기 조절 손잡이: 모서리 4개 + 가장자리 4개 (끌어서 가로/세로를 자유롭게) */}
            {wh && sel?.type === 'wh' && (() => {
              const R = drag?.type === 'wh' ? drag.rect : { x0: 0, y0: 0, x1: wh.width, y1: wh.height }
              const cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, L = handleR * 2.6, T = handleR * 1.1
              const handles = [['nw', R.x0, R.y0, 'nwse-resize'], ['n', cx, R.y0, 'ns-resize'], ['ne', R.x1, R.y0, 'nesw-resize'], ['e', R.x1, cy, 'ew-resize'],
                ['se', R.x1, R.y1, 'nwse-resize'], ['s', cx, R.y1, 'ns-resize'], ['sw', R.x0, R.y1, 'nesw-resize'], ['w', R.x0, cy, 'ew-resize']]
              const label = `가로 ${round2(R.x1 - R.x0)}m × 세로 ${round2(R.y1 - R.y0)}m`, fs = Math.max(0.8, 13 / view.zoom), tw = label.length * fs * 0.8 + fs * 1.6
              return (
                <g>
                  <rect x={R.x0} y={R.y0} width={R.x1 - R.x0} height={R.y1 - R.y0} rx={0.6} fill="none" stroke="#f59e0b" strokeWidth={0.2} strokeDasharray="0.6 0.4" pointerEvents="none" />
                  {canEdit && handles.map(([id, x, y, cur]) => id.length === 2
                    ? <circle key={id} cx={x} cy={y} r={handleR} fill="#f59e0b" stroke="#fff" strokeWidth={handleR * 0.18} data-hit={`wh-resize:${id}`} style={{ cursor: cur }} />
                    : <rect key={id} x={x - (id === 'n' || id === 's' ? L / 2 : T / 2)} y={y - (id === 'n' || id === 's' ? T / 2 : L / 2)} width={id === 'n' || id === 's' ? L : T} height={id === 'n' || id === 's' ? T : L} rx={T / 2} fill="#f59e0b" stroke="#fff" strokeWidth={handleR * 0.16} data-hit={`wh-resize:${id}`} style={{ cursor: cur }} />)}
                  {drag?.type === 'wh' && <g pointerEvents="none" transform={`translate(${cx} ${cy}) rotate(${-view.rot})`}>
                    <rect x={-tw / 2} y={-fs * 0.95} width={tw} height={fs * 1.9} rx={fs * 0.95} fill="#fff" stroke="#f59e0b" strokeWidth={fs * 0.08} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="800" style={{ fill: '#92400e' }}>{label}</text>
                  </g>}
                </g>)
            })()}
            {/* 선택한 구역의 크기 조절 손잡이 */}
            {selZone && canEdit && !drag && <circle cx={selZone.x + selZone.w} cy={selZone.y + selZone.h} r={handleR} fill="#f59e0b" stroke="#fff" strokeWidth={handleR * 0.18} data-hit={`zone-resize:${selZone.id}`} style={{ cursor: 'nwse-resize' }} />}
            {/* 옮기는/크기 바꾸는 중인 구역 미리보기 */}
            {dragZone && drag.rect && <g pointerEvents="none">
              <rect x={drag.rect.x} y={drag.rect.y} width={drag.rect.w} height={drag.rect.h} rx={0.45} fill={drag.valid ? rgba(dragZone.color, 0.5) : 'rgba(239,68,68,0.35)'} stroke={drag.valid ? '#f59e0b' : '#ef4444'} strokeWidth={0.22} strokeDasharray="0.5 0.35" />
              <g transform={`translate(${drag.rect.x + drag.rect.w / 2} ${drag.rect.y + drag.rect.h / 2}) rotate(${-view.rot})`}>
                <text textAnchor="middle" dominantBaseline="central" fontSize={Math.min(1.1, drag.rect.w / 5)} fontWeight="800" style={{ fill: drag.valid ? '#334155' : '#b91c1c' }}>{dragZone.name}</text>
              </g>
            </g>}
            {/* 구역/창고 그리는 중 */}
            {draft && draft.rect.w > 0 && <g pointerEvents="none">
              <rect x={draft.rect.x} y={draft.rect.y} width={draft.rect.w} height={draft.rect.h} rx={0.45} fill={draft.valid ? 'rgba(125,211,252,0.35)' : 'rgba(239,68,68,0.3)'} stroke={draft.valid ? '#38bdf8' : '#ef4444'} strokeWidth={0.2} strokeDasharray="0.5 0.35" />
              <g transform={`translate(${draft.rect.x + draft.rect.w / 2} ${draft.rect.y + draft.rect.h / 2}) rotate(${-view.rot})`}>
                <text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(0.7, Math.min(1.3, draft.rect.w / 7))} fontWeight="800" style={{ fill: css('--surface-100') }}>{round2(draft.rect.w)} × {round2(draft.rect.h)}</text>
              </g>
            </g>}
            {/* 붙이기 미리보기 / 옮기는 중인 시설물 */}
            {wh && ghost && <g pointerEvents="none"><FixtureShape f={ghost} W={wh.width} H={wh.height} rot={view.rot} ghost /></g>}
            {wh && drag?.type === 'fx' && <g pointerEvents="none"><FixtureShape f={{ kind: drag.kind, ...drag.patch }} W={wh.width} H={wh.height} rot={view.rot} ghost /></g>}
            {boxDrag && <BoxDragOverlay drag={boxDrag} model={model} rot={view.rot} />}
          </g>
        </svg>

        {/* 창고가 아직 없을 때 */}
        {!wh && tool !== 'wh' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
            <div className="text-center max-w-xs pointer-events-auto">
              <div className="text-6xl mb-3">🏭</div>
              <p className="text-base font-bold text-white">{canEdit ? '창고를 그려볼까요?' : '아직 창고가 없어요'}</p>
              <p className="text-xs text-surface-400 mt-1.5 leading-relaxed">{canEdit ? '창고는 하나만 그릴 수 있어요. 그린 뒤에 구역과 박스를 채워요.' : '관리자나 매니저가 창고를 그리면 여기에 보여요.'}</p>
              {canEdit && <Btn variant="primary" className="mt-4" onClick={() => changeTool('wh')}><FixtureIcon kind="warehouse" size={18} /> 창고 그리기</Btn>}
            </div>
          </div>)}

        {/* 선택한 것 */}
        {sel && (selZone || selFx || (sel.type === 'wh' && wh)) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 max-w-[94%] flex items-center gap-1.5 flex-wrap justify-center px-3 py-2 rounded-2xl bg-surface-900/95 border border-surface-700 shadow-xl backdrop-blur">
            {selZone && <>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: selZone.color }} />
              <span className="text-xs font-bold text-white mr-1">{selZone.name}</span>
              <span className="text-[11px] text-surface-400 mr-1">박스 {selZone.boxCount}개</span>
              <Btn size="sm" variant="primary" onClick={() => actions.openZone(selZone.id)}><Package size={13} /> 열기</Btn>
              {canEdit && <Btn size="sm" variant="soft" onClick={() => actions.editZone(selZone.id)}><Settings size={13} /> 설정</Btn>}
              {canEdit && <Btn size="sm" variant="danger" title="구역 삭제" onClick={() => actions.deleteZone(selZone.id)}><Trash2 size={13} /></Btn>}
            </>}
            {selFx && <>
              <FixtureIcon kind={selFx.kind} size={18} /><span className="text-xs font-bold text-white mr-1">{FIXTURE_LABEL[selFx.kind]}</span>
              {canEdit ? <Btn size="sm" variant="danger" onClick={() => { actions.removeFixture(selFx.id); setSel(null) }}><Trash2 size={13} /> 삭제</Btn> : <span className="text-[11px] text-surface-400">보기만 가능해요</span>}
            </>}
            {sel.type === 'wh' && wh && <>
              <span className="text-xs font-bold text-white mr-1">🏭 {wh.name} · 가로 {wh.width}m × 세로 {wh.height}m</span>
              {canEdit && <span className="text-[11px] text-surface-400 mr-1">노란 점을 끌어서 크기 조절</span>}
              {canEdit && <Btn size="sm" variant="soft" onClick={() => actions.editWarehouse()}><Settings size={13} /> 설정</Btn>}
              {canEdit && <Btn size="sm" variant="danger" title="창고 삭제" onClick={() => actions.deleteWarehouse()}><Trash2 size={13} /></Btn>}
            </>}
          </div>)}

        {/* 안내 문구 */}
        <div className="absolute left-3 bottom-3 max-w-[60%] px-3 py-1.5 rounded-2xl bg-surface-900/90 border border-surface-700 text-[11px] text-surface-300 backdrop-blur">
          {canEdit ? HINTS[tool] : '구역을 눌러 열어보세요. 끌면 움직이고, 두 손가락(휠)으로 확대해요'}
        </div>

        {/* 확대/축소/회전/전체화면 */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
          {[
            [<Plus size={16} />, '확대', () => setView(v => M.zoomAt(v, size.w, size.h, size.w / 2, size.h / 2, 1.3))],
            [<Minus size={16} />, '축소', () => setView(v => M.zoomAt(v, size.w, size.h, size.w / 2, size.h / 2, 1 / 1.3))],
            [<RotateCcw size={16} />, '왼쪽으로 회전', () => setView(v => M.rotateView(v, -90))],
            [<RotateCw size={16} />, '오른쪽으로 회전', () => setView(v => M.rotateView(v, 90))],
            [<Crosshair size={16} />, '창고 전체 보기', () => animateTo(fitWarehouseView(wh ? wh.width : 40, wh ? wh.height : 26, size, viewRef.current.rot))],
            [full ? <Minimize2 size={16} /> : <Maximize2 size={16} />, full ? '전체화면 닫기' : '전체화면', toggle],
          ].map(([icon, label, fn], i) => (
            <button key={i} type="button" title={label} aria-label={label} onClick={fn}
              className="w-10 h-10 rounded-2xl bg-surface-900/95 border border-surface-700 text-surface-200 flex items-center justify-center shadow-lg backdrop-blur hover:bg-surface-800 active:scale-90 transition-all">{icon}</button>))}
        </div>
      </div>
    </div>
  )
}
