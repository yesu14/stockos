// 박스 옮기기 창: 구역 → 줄 → 칸을 골라서 옮김 (끌어서 옮기기가 어려운 폰/태블릿, 정확히 옮기고 싶을 때)
import { useState, useMemo } from 'react'
import { Modal, Btn, Field, inputCls } from './ui'
import { planBoxMove, stackAt, locationText } from './whLogic'

export default function MoveBoxDialog({ boxId, model, onSubmit, onClose }) {
  const box = model.boxesById.get(boxId)
  const [zoneId, setZoneId] = useState(box?.zone_id), [lineId, setLineId] = useState(box?.line_id), [slot, setSlot] = useState(box?.slot_no || 1)
  const [busy, setBusy] = useState(false)
  const zone = model.zonesById.get(zoneId), line = zone?.lines.find(l => l.id === lineId) || zone?.lines[0]
  const plan = useMemo(() => (box && zone && line ? planBoxMove(model, boxId, { zoneId, lineId: line.id, slot: Math.min(slot, line.slot_count) }) : null), [model, boxId, zoneId, line, slot, box, zone])
  if (!box || !zone || !line) return null
  const pickZone = id => { const z = model.zonesById.get(id); setZoneId(id); setLineId(z.lines[0]?.id); setSlot(1) }
  const pickLine = id => { setLineId(id); const l = zone.lines.find(x => x.id === id); if (slot > l.slot_count) setSlot(1) }
  const go = async () => { setBusy(true); try { await onSubmit({ zoneId, lineId: line.id, slot: Math.min(slot, line.slot_count) }) } finally { setBusy(false) } }
  return (
    <Modal onClose={onClose} level={2} accent={zone.color} icon="↔️" title={`박스 ${box.box_number} 옮기기`} subtitle={`지금 위치: ${locationText(box)}`}
      footer={<><Btn variant="soft" onClick={onClose}>취소</Btn><Btn variant="primary" disabled={!plan?.ok || busy} onClick={go}>{busy ? '옮기는 중…' : '여기로 옮기기'}</Btn></>}>
      <div className="space-y-4">
        <Field label="구역">
          <select value={zoneId} onChange={e => pickZone(e.target.value)} className={inputCls}>{model.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="줄">
            <select value={line.id} onChange={e => pickLine(e.target.value)} className={inputCls}>{zone.lines.map(l => <option key={l.id} value={l.id}>{l.no}번째 줄 (칸 {l.slot_count}개)</option>)}</select>
          </Field>
          <Field label="칸">
            <select value={Math.min(slot, line.slot_count)} onChange={e => setSlot(Number(e.target.value))} className={inputCls}>
              {Array.from({ length: line.slot_count }, (_, i) => i + 1).map(n => { const h = stackAt(line, n).length; return <option key={n} value={n}>{n}번 칸 (현재 {h}층{h >= zone.tiers && !(box.line_id === line.id && box.slot_no === n) ? ' · 가득' : ''})</option> })}
            </select>
          </Field>
        </div>
        <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed" style={plan?.ok ? { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#16a34a' } : { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>
          {plan?.ok
            ? <>✅ <b>{plan.target.zoneName} · {plan.target.lineNo}번째 줄 · {plan.target.slot}번째 칸 · {plan.toTier}층</b> 맨 위에 놓여요.{plan.falls > 0 && <> 원래 자리에서 위에 있던 박스 {plan.falls}개는 한 층씩 내려와요.</>}</>
            : <>⚠️ {plan?.text || '옮길 수 없어요'}</>}
        </div>
      </div>
    </Modal>
  )
}
