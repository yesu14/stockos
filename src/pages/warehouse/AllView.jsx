// ═══════════════════════════════════════════════════════════
//  전체보기 — 모든 구역을 "줄별 선반 그림"으로 한눈에 보고, 박스 위치를 바로 바꿈
//   구역 → 줄 → 층(위→아래) × 칸.
//   · 박스를 누르면 안에 든 상품 / 상품 담기
//   · 박스를 끌어서 다른 자리에 놓으면 옮기기 (빈 자리) 또는 서로 바꾸기 / 끼워 넣기 (박스가 있는 자리)
//   · 폰/태블릿: "위치 바꾸기" 를 켜고 → 옮길 박스를 누르고 → 놓을 자리를 누름
//   · 옮긴 직후 "되돌리기"
//   embedded: 박스 창의 "↔ 이동" 안에서 쓰는 모양 (옮길 박스가 정해져 있고, 놓을 자리만 고름)
// ═══════════════════════════════════════════════════════════
import { Fragment, useState, useMemo, useEffect, useRef } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Btn, Modal } from './ui'
import { buildRacks, planPlace, locationText, rgba, shade } from './whLogic'

const INK = '#334155'

export default function AllView({ model, canEdit = false, highlight = null, focus = null, onOpenBox, onPlace, onUndo, tabs = null, full = false, onToggleFull, onSwitchFull, switchLabel,
  embedded = false, movingId = null, onDone }) {
  const [zoneSel, setZoneSel] = useState('all'), [shut, setShut] = useState(() => new Set()), [moveMode, setMoveMode] = useState(false), [pick, setPick] = useState(null)
  const [drag, setDrag] = useState(null), [over, setOver] = useState(''), [ask, setAsk] = useState(null), [last, setLast] = useState(null), [busy, setBusy] = useState(false)
  const scroller = useRef(null), dragging = useRef(null)            // 지금 끌고 있는 박스 (끌기가 끝났는데 미룬 상태 변경이 뒤늦게 실행되지 않게)
  const holding = embedded ? movingId : (drag || (moveMode ? pick : null)), held = holding ? model.boxesById.get(holding) : null
  useEffect(() => { if (zoneSel !== 'all' && !model.zonesById.has(zoneSel)) setZoneSel('all') }, [model, zoneSel])
  useEffect(() => { if (!last) return; const t = setTimeout(() => setLast(null), 20000); return () => clearTimeout(t) }, [last])
  const racks = useMemo(() => buildRacks(model, zoneSel === 'all' ? null : zoneSel), [model, zoneSel])
  const marked = useMemo(() => (highlight ? [...highlight].filter(id => model.boxesById.has(id)) : []), [highlight, model])

  const reveal = id => {                                                             // 그 박스가 보이게: 접힌 구역은 펴고, 화면 가운데로
    const b = model.boxesById.get(id); if (!b) return
    setShut(s => { if (!s.has(b.zone_id)) return s; const n = new Set(s); n.delete(b.zone_id); return n })
    if (zoneSel !== 'all' && zoneSel !== b.zone_id) setZoneSel('all')
    setTimeout(() => scroller.current?.querySelector(`[data-box="${id}"]`)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }), 90)
  }
  useEffect(() => { if (!embedded && focus?.boxId) reveal(focus.boxId) }, [focus?.boxId]) // eslint-disable-line

  const cellTarget = (cell, line, zone) => ({ zoneId: zone.id, lineId: line.id, slot: cell.slot, tier: cell.kind === 'box' ? cell.tier : undefined })
  const doPlace = async (id, target, mode) => {
    setBusy(true)
    try {
      const plan = await onPlace?.(id, target, mode)
      if (plan) { setLast({ text: plan.done, undo: plan.undo }); setPick(null); setAsk(null); if (embedded) onDone?.(plan) }
    } finally { setBusy(false); dragging.current = null; setDrag(null); setOver('') }
  }
  const land = (cell, line, zone, id = holding) => {                                  // 놓을 자리를 눌렀거나 끌어다 놓았을 때
    if (!id || busy || !canEdit || cell.kind === 'void' || !model.boxesById.has(id)) return
    if (cell.kind === 'box') {
      if (cell.box.id === id) { setPick(null); return }
      setAsk({ boxId: id, target: cellTarget(cell, line, zone), other: cell.box }); return                       // 박스가 있는 자리 → 서로 바꾸기 / 끼워 넣기 고르기
    }
    doPlace(id, cellTarget(cell, line, zone), 'insert')                                                            // 빈 자리 → 바로 옮김
  }
  const chipClick = (box, cell, line, zone) => {
    if (embedded) { if (box.id !== movingId) land(cell, line, zone, movingId); return }
    if (moveMode) { if (!pick) setPick(box.id); else if (pick === box.id) setPick(null); else land(cell, line, zone, pick); return }
    onOpenBox?.(box.id)                                                                                            // 기본: 안에 든 상품 / 상품 담기
  }
  const undo = async () => { if (!last?.undo || busy) return; setBusy(true); try { if (await onUndo?.(last.undo)) setLast(null) } finally { setBusy(false) } }

  const zoneChip = on => `shrink-0 px-2.5 h-8 rounded-xl text-[11px] font-bold border transition-all inline-flex items-center gap-1.5 ${on ? 'bg-primary-500 border-primary-500' : 'bg-surface-800 border-surface-700 text-surface-200 hover:bg-surface-700'}`
  const root = embedded ? 'flex flex-col gap-2 min-h-0' : (full ? 'flex flex-col gap-2 flex-1 min-h-0' : 'flex flex-col h-full gap-2 min-h-0')
  const total = model.boxes.length

  return (
    <div className={root} data-testid="allview">
      {!embedded && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {tabs}
          {canEdit && (
            <button type="button" aria-pressed={moveMode} onClick={() => { setMoveMode(v => !v); setPick(null) }} title="켜면: 옮길 박스를 누르고 → 놓을 자리를 눌러요 (끌어서 놓아도 돼요)"
              className={`h-8 px-3 rounded-xl text-[11px] font-bold border transition-all inline-flex items-center gap-1.5 ${moveMode ? 'bg-amber-500 border-amber-500' : 'bg-surface-800 border-surface-700 text-surface-200 hover:bg-surface-700'}`} style={moveMode ? { color: '#1f2937' } : undefined}>
              ↔ 위치 바꾸기{moveMode ? ' 켜짐' : ''}
            </button>)}
          {marked.length > 0 && <button type="button" onClick={() => reveal(marked[0])} className="h-8 px-3 rounded-xl text-[11px] font-bold border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20">🔎 찾은 박스 {marked.length}개 보기</button>}
          <div className="flex-1" />
          {full && onSwitchFull && <Btn size="sm" variant="soft" onClick={onSwitchFull} title="3D 전체화면으로 바꾸기">🧊 3D 전체화면</Btn>}
          {full ? <Btn size="sm" variant="soft" onClick={onToggleFull}>닫기 ✕</Btn>
            : <button type="button" onClick={onToggleFull} title="전체화면" aria-label="전체화면" className="w-8 h-8 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 flex items-center justify-center hover:bg-surface-700"><Maximize2 size={14} /></button>}
        </div>)}

      <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pb-0.5" role="group" aria-label="구역 고르기">
        <button type="button" aria-pressed={zoneSel === 'all'} onClick={() => setZoneSel('all')} className={zoneChip(zoneSel === 'all')} style={zoneSel === 'all' ? { color: '#fff' } : undefined}>전체 <span className="opacity-70">{total}</span></button>
        {model.zones.map(z => <button key={z.id} type="button" aria-pressed={zoneSel === z.id} onClick={() => setZoneSel(z.id)} className={zoneChip(zoneSel === z.id)} style={zoneSel === z.id ? { color: '#fff' } : undefined}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: z.color }} />{z.name} <span className="opacity-70">{z.boxCount}</span></button>)}
      </div>

      {(canEdit || embedded) && (
        <div className="shrink-0 h-10">                                   {/* 높이 고정: 끌기를 시작해서 안내가 바뀌어도 아래 내용이 밀려 내려가지 않게 (놓을 자리가 도망가지 않게) */}
          {(holding || (moveMode && !embedded)) ? (
            <div role="status" data-testid="allview-hint" className="h-full flex items-center gap-2 rounded-2xl border border-primary-500/40 bg-primary-500/10 px-3 text-[11px] leading-tight text-primary-300">
              <span className="flex-1 min-w-0" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {held ? <>📦 박스 <b>{held.box_number}</b> 를 놓을 자리를 누르세요 · <b>빈 자리</b>는 옮기기, <b>박스가 있는 자리</b>는 서로 바꾸기/끼워 넣기</> : '옮길 박스를 누르세요 (끌어서 놓아도 돼요)'}
              </span>
              {!embedded && held && <button type="button" onClick={() => { setPick(null); dragging.current = null; setDrag(null) }} className="shrink-0 px-2 h-7 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 text-[11px] font-bold">취소</button>}
            </div>)
            : (!embedded && <p className="h-full flex items-center px-1 text-[11px] leading-tight text-surface-500">박스를 <b className="text-surface-300 mx-0.5">누르면</b> 안에 든 상품, <b className="text-surface-300 mx-0.5">끌어서 다른 자리에 놓으면</b> 위치가 바뀌어요. 폰에서는 위의 “위치 바꾸기”를 켜세요.</p>)}
        </div>)}

      <div ref={scroller} className="flex-1 min-h-0 overflow-auto rounded-2xl border border-surface-700 bg-surface-950/40 p-2 space-y-3" data-testid="allview-scroll">
        {racks.length === 0 && <p className="text-center text-sm text-surface-400 py-10">구역이 아직 없어요. 평면도에서 구역을 먼저 그려 주세요.</p>}
        {racks.map(({ zone, lines }) => {
          const open = !shut.has(zone.id)
          return (
            <section key={zone.id} data-zone={zone.id}>
              <button type="button" aria-expanded={open} onClick={() => setShut(s => { const n = new Set(s); if (n.has(zone.id)) n.delete(zone.id); else n.add(zone.id); return n })} className="w-full flex items-center gap-2 text-left px-1 py-1 rounded-lg hover:bg-surface-800/60">
                <span className="text-surface-400 text-xs w-3">{open ? '▾' : '▸'}</span><span className="w-3 h-3 rounded-full shrink-0" style={{ background: zone.color }} />
                <span className="text-sm font-black text-white">{zone.name}</span><span className="text-[11px] text-surface-400">박스 {zone.boxCount}개 · {lines.length}줄 · 최대 {zone.tiers}층</span>
              </button>
              {open && <div className="mt-1.5 space-y-2.5">
                {lines.map(({ line, rows, boxCount }) => (
                  <div key={line.id} data-line={line.id} className="rounded-2xl border border-surface-700 bg-surface-900/60 p-2">
                    <div className="flex items-center justify-between mb-1.5 px-0.5"><span className="text-xs font-bold text-surface-200">{line.no}번째 줄</span><span className="text-[10px] text-surface-500">칸 {line.slot_count}개 · 박스 {boxCount}개</span></div>
                    <div className="overflow-x-auto pb-1">
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `34px repeat(${line.slot_count}, minmax(58px, 112px))` }}>
                        <div />{Array.from({ length: line.slot_count }, (_, k) => <div key={k} className="text-center text-[10px] text-surface-500 font-semibold">{k + 1}칸</div>)}
                        {rows.map(row => (
                          <Fragment key={row.tier}>
                            <div className="sticky left-0 z-10 bg-surface-900/90 flex items-center justify-center text-[10px] font-semibold text-surface-400">{row.tier}층</div>
                            {row.cells.map(cell => {
                              const key = `${zone.id}:${line.id}:${cell.slot}:${cell.tier}`, b = cell.box
                              return (
                                <div key={key} data-cell={key} data-kind={cell.kind} className="min-h-[46px] flex"
                                  onDragOver={e => { if (cell.kind !== 'void' && canEdit) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }} onDragEnter={() => cell.kind !== 'void' && setOver(key)}
                                  onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setOver(''); if (id) land(cell, line, zone, id) }}>
                                  {cell.kind === 'box' && (
                                    <button type="button" data-box={b.id} draggable={canEdit && !embedded && !busy}
                                      onDragStart={e => { if (!canEdit || embedded) { e.preventDefault(); return } e.dataTransfer.setData('text/plain', b.id); e.dataTransfer.effectAllowed = 'move'; const id = b.id; dragging.current = id; setTimeout(() => { if (dragging.current === id) setDrag(id) }, 0) }}      /* 끌기 이미지를 만드는 순간에는 화면을 건드리지 않고, 시작된 다음에 상태를 바꿈 (바로 바꾸면 브라우저가 끌기를 취소하거나 멈출 수 있음) */ onDragEnd={() => { dragging.current = null; setDrag(null); setOver('') }}
                                      onClick={() => chipClick(b, cell, line, zone)}
                                      aria-label={`박스 ${b.box_number}, ${locationText(b)}, ${b.items.length ? `상품 ${b.items.length}종` : '비어있음'}`}
                                      className={`w-full min-h-[46px] rounded-xl border px-1 py-1 flex flex-col items-center justify-center gap-0.5 select-none transition-all ${holding === b.id ? 'opacity-50 ring-2 ring-primary-400' : ''} ${holding && holding !== b.id ? 'hover:ring-2 hover:ring-primary-400 cursor-pointer' : 'hover:brightness-110 hover:-translate-y-px'} ${highlight?.has(b.id) ? 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)]' : ''} ${focus?.boxId === b.id ? 'ring-2 ring-pink-400 animate-pulse' : ''} ${over === key && holding !== b.id ? 'ring-2 ring-primary-300 scale-[1.03]' : ''}`}
                                      style={{ background: rgba(zone.color, 0.92), borderColor: shade(zone.color, 0.62), color: INK }}>
                                      <span className="text-[13px] font-bold leading-none">{b.box_number}</span>
                                      <span className="text-[10px] leading-none opacity-70">{b.items.length ? `상품 ${b.items.length}종` : '비어있음'}</span>
                                    </button>)}
                                  {cell.kind === 'next' && (
                                    <button type="button" data-next aria-disabled={!holding || !canEdit} tabIndex={holding ? 0 : -1} onClick={() => land(cell, line, zone)} aria-label={`${zone.name} ${line.no}번째 줄 ${cell.slot}번째 칸 ${cell.tier}층 빈 자리`}
                                      className={`w-full min-h-[46px] rounded-xl border-2 border-dashed flex items-center justify-center text-[11px] font-bold transition-all ${holding ? `cursor-pointer ${over === key ? 'border-primary-300 bg-primary-500/30 text-white' : 'border-primary-400/80 bg-primary-500/10 text-primary-300 hover:bg-primary-500/25'}` : 'border-surface-700/60 text-surface-700 cursor-default'}`}>
                                      {holding ? '여기에 놓기' : ''}
                                    </button>)}
                                </div>)
                            })}
                          </Fragment>))}
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-surface-700/70" aria-hidden />
                    </div>
                  </div>))}
              </div>}
            </section>)
        })}
      </div>

      {last && !embedded && (
        <div role="status" data-testid="allview-last" className="shrink-0 flex items-center gap-2 flex-wrap rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          <span>✅ {last.text}</span><div className="flex-1" />
          {last.undo && <Btn size="sm" variant="soft" disabled={busy} onClick={undo}>↩ 되돌리기</Btn>}
          <button type="button" aria-label="알림 닫기" onClick={() => setLast(null)} className="px-1 text-emerald-300/80 hover:text-emerald-200">✕</button>
        </div>)}

      {ask && (() => {
        const A = model.boxesById.get(ask.boxId), B = ask.other, swap = A ? planPlace(model, A.id, ask.target, 'swap') : null, ins = A ? planPlace(model, A.id, ask.target, 'insert') : null
        if (!A) return null
        const row = (ok, icon, title, text, onClick, id) => (
          <button type="button" id={id} disabled={!ok || busy} onClick={onClick} className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${ok ? 'border-surface-600 bg-surface-800 hover:bg-surface-700 hover:border-primary-400' : 'border-surface-700 bg-surface-900 opacity-60 cursor-not-allowed'}`}>
            <p className="text-sm font-bold text-white">{icon} {title}</p><p className={`text-[11px] mt-0.5 leading-relaxed ${ok ? 'text-surface-300' : 'text-red-400'}`}>{text}</p>
          </button>)
        return (
          <Modal onClose={() => { setAsk(null); dragging.current = null; setDrag(null); setOver('') }} level={3} accent={B.zoneColor} icon="🔁" title={`박스 ${A.box_number} → 박스 ${B.box_number} 가 있는 자리`} subtitle={locationText(B)}
            footer={<Btn variant="soft" onClick={() => { setAsk(null); dragging.current = null; setDrag(null); setOver('') }}>취소</Btn>}>
            <p className="text-sm text-surface-200 mb-3">그 자리에는 박스 <b className="text-white">{B.box_number}</b> 가 있어요. 어떻게 할까요?</p>
            <div className="space-y-2">
              {row(!!swap?.ok, '🔁', '서로 바꾸기', swap?.text, () => doPlace(A.id, ask.target, 'swap'))}
              {row(!!ins?.ok, '⤵️', '이 층에 끼워 넣기', ins?.text, () => doPlace(A.id, ask.target, 'insert'))}
            </div>
          </Modal>)
      })()}
    </div>
  )
}
