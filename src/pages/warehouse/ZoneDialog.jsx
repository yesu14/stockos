// 구역 만들기 / 구역 설정
import { useState, useMemo } from 'react'
import { Modal, Btn, Field, Stepper, inputCls } from './ui'
import { ZONE_COLORS, LIMITS, pickFreeColor, nextZoneName, boxesLostBy, shade, rgba } from './whLogic'

export default function ZoneDialog({ mode, zone, rect, model, onSubmit, onClose }) {
  const edit = mode === 'edit'
  const [name, setName] = useState(edit ? zone.name : nextZoneName(model.zones))
  const [color, setColor] = useState(edit ? zone.color : pickFreeColor(model.zones))
  const [slotCount, setSlotCount] = useState(edit ? zone.maxSlots : 6)
  const [lineCount, setLineCount] = useState(edit ? zone.lines.length : 3)
  const [tiers, setTiers] = useState(edit ? zone.tiers : 4)
  const [applySlots, setApplySlots] = useState(false)
  const [busy, setBusy] = useState(false)

  const usedBy = useMemo(() => { const m = new Map(); for (const z of model.zones) if (!edit || z.id !== zone.id) m.set(String(z.color).toLowerCase(), z.name); return m }, [model.zones, edit, zone])
  const palette = useMemo(() => { const all = [...ZONE_COLORS]; for (const z of model.zones) if (!all.includes(z.color)) all.push(z.color); if (!all.includes(color)) all.push(color); return all }, [model.zones, color])
  const lost = edit ? boxesLostBy(zone, { tiers: tiers < zone.tiers ? tiers : null, lineCount: lineCount < zone.lines.length ? lineCount : null, slotCount: applySlots ? slotCount : null }).length : 0
  const r = edit ? zone : rect
  const cols = Math.min(slotCount, 14), rows = Math.min(lineCount, 8)

  const submit = async () => {
    setBusy(true)
    try { await onSubmit({ name, color, slotCount: Number(slotCount) || 0, lineCount: Number(lineCount) || 0, tiers: Number(tiers) || 0, applySlots: edit ? applySlots : true, rect }) } finally { setBusy(false) }
  }
  return (
    <Modal onClose={onClose} accent={color} icon={edit ? '⚙️' : '🧱'} title={edit ? '구역 설정' : '새 구역 만들기'}
      subtitle={r ? `크기 ${Math.round(r.w * 10) / 10} × ${Math.round(r.h * 10) / 10} 칸` : undefined}
      footer={<><Btn variant="soft" onClick={onClose}>취소</Btn><Btn variant="primary" onClick={submit} disabled={busy}>{busy ? '저장 중…' : edit ? '저장' : '구역 만들기'}</Btn></>}>
      <div className="space-y-4">
        <Field label="구역 이름"><input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="예: A구역 (장난감)" className={inputCls} /></Field>
        <Field label="구역 색상" hint="구역마다 색이 달라야 해요 (이미 쓰는 색은 고를 수 없어요)">
          <div className="flex flex-wrap gap-2">
            {palette.map(c => {
              const used = usedBy.get(String(c).toLowerCase()), on = c.toLowerCase() === color.toLowerCase()
              return (
                <button key={c} type="button" disabled={!!used} onClick={() => setColor(c)} title={used ? `${used}에서 사용 중` : '선택'}
                  className={`relative w-9 h-9 rounded-2xl border-2 transition-all ${on ? 'scale-110 border-white shadow-lg' : 'border-transparent'} ${used ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'}`}
                  style={{ background: c, boxShadow: on ? `0 0 0 3px ${rgba(c, 0.45)}` : undefined }}>
                  {used && <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: '#334155' }}>✕</span>}
                  {on && <span className="absolute inset-0 flex items-center justify-center text-sm font-black" style={{ color: '#334155' }}>✓</span>}
                </button>)
            })}
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="가로 박스 수" hint="한 줄에 놓을 박스"><Stepper value={slotCount} min={LIMITS.slots[0]} max={LIMITS.slots[1]} onChange={v => { setSlotCount(v); setApplySlots(true) }} /></Field>
          <Field label="세로 박스 수" hint="줄 수"><Stepper value={lineCount} min={LIMITS.lines[0]} max={LIMITS.lines[1]} onChange={setLineCount} /></Field>
          <Field label="박스 층수" hint="최대 쌓는 높이"><Stepper value={tiers} min={LIMITS.tiers[0]} max={LIMITS.tiers[1]} onChange={setTiers} /></Field>
        </div>
        {/* 미리보기 */}
        <div className="rounded-3xl p-3 border border-surface-700 bg-surface-800/40">
          <p className="text-[11px] font-semibold text-surface-400 mb-2">미리보기 · {lineCount}줄 × {slotCount}칸 · {tiers}층까지</p>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: rows * cols }).map((_, i) => <div key={i} className="aspect-[5/4] rounded-lg" style={{ background: shade(color, 1.04), border: `1.5px solid ${shade(color, 0.7)}` }} />)}
          </div>
          {(slotCount > cols || lineCount > rows) && <p className="text-[10px] text-surface-500 mt-1.5">※ 미리보기는 일부만 보여줘요</p>}
        </div>
        {edit && <p className="text-[11px] text-surface-500 leading-relaxed">줄마다 칸 수를 다르게 하려면 저장 후 구역을 열어서 줄별로 바꾸세요. 가로 박스 수를 바꾸면 <b>모든 줄</b>에 적용돼요.</p>}
        {lost > 0 && <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>⚠️ 이렇게 줄이면 박스 <b>{lost}개</b>가 사라져요. 저장할 때 한 번 더 물어볼게요.</div>}
      </div>
    </Modal>
  )
}
