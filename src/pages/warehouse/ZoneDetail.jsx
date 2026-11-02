// 구역 안: 줄을 고르면 선반을 앞에서 본 모습(칸 × 층)으로 보여주고, 박스를 올리고 열 수 있음
import { useState, useEffect } from 'react'
import { Plus, Minus, Trash2, Settings } from 'lucide-react'
import { Modal, Btn } from './ui'
import { shade, rgba, nextBoxNumber, stackAt } from './whLogic'

export default function ZoneDetail({ zoneId, initialLine = 0, model, canEdit, highlight, actions, prompt, onOpenBox, onEditZone, onClose }) {
  const zone = model.zonesById.get(zoneId)
  const [li, setLi] = useState(initialLine || 0)
  useEffect(() => { if (!zone) onClose() }, [zone]) // eslint-disable-line
  if (!zone) return null
  const idx = Math.min(li, zone.lines.length - 1), line = zone.lines[idx]
  const hl = highlight && highlight.size ? highlight : null
  const slots = Array.from({ length: line.slot_count }, (_, i) => i + 1)
  const tiers = Array.from({ length: zone.tiers }, (_, i) => zone.tiers - i)      // 위 → 아래

  const addBox = async (slot, tier) => {
    const text = await prompt({
      icon: '📦', title: '박스 놓기', subtitle: `${zone.name} · ${line.no}번째 줄 · ${slot}번째 칸 · ${tier}층`, label: '박스 번호',
      placeholder: `비워두면 자동으로 ${nextBoxNumber(model.boxes)}번`, hint: '번호는 창고 전체에서 하나뿐이어야 해요 (구역이 달라도 겹치면 안 돼요)', confirmText: '놓기',
    })
    if (text === null) return
    await actions.addBox(zone.id, line.id, slot, text)
  }
  const totalBoxes = zone.boxCount

  return (
    <Modal onClose={onClose} accent={zone.color} width="max-w-3xl" icon="🧸" title={zone.name}
      subtitle={`${zone.lines.length}줄 · 최대 ${zone.maxSlots}칸 · ${zone.tiers}층까지 · 박스 ${totalBoxes}개`}
      footer={<>
        {canEdit && <Btn variant="soft" onClick={() => onEditZone(zone.id)}><Settings size={14} /> 구역 설정</Btn>}
        <Btn variant="primary" onClick={onClose}>닫기</Btn>
      </>}>
      {/* 줄 고르기 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {zone.lines.map((l, i) => {
          const n = [...l.stacks.values()].reduce((s, st) => s + st.length, 0), on = i === idx
          return (
            <button key={l.id} type="button" onClick={() => setLi(i)}
              className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all active:scale-95 ${on ? 'shadow-lg' : 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'}`}
              style={on ? { background: zone.color, borderColor: shade(zone.color, 0.75), color: '#2b3445' } : undefined}>
              {l.no}번째 줄 <span className="opacity-70 font-semibold">· {n}</span>
            </button>)
        })}
        {canEdit && <button type="button" onClick={() => actions.addLine(zone.id)} className="shrink-0 px-3 py-2 rounded-2xl text-xs font-bold border border-dashed border-surface-600 text-surface-400 hover:border-primary-500 hover:text-primary-400 flex items-center gap-1"><Plus size={13} /> 줄 추가</button>}
      </div>

      {/* 줄 설정 */}
      <div className="flex items-center gap-2 flex-wrap mt-2 mb-3 px-3 py-2.5 rounded-2xl bg-surface-800/60 border border-surface-700">
        <span className="text-xs font-bold text-white">{line.no}번째 줄</span>
        <span className="text-xs text-surface-400">박스 놓을 칸</span>
        {canEdit ? (
          <div className="inline-flex items-center gap-1.5">
            <button type="button" onClick={() => actions.setLineSlots(line.id, line.slot_count - 1)} disabled={line.slot_count <= 1} className="w-8 h-8 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 flex items-center justify-center disabled:opacity-30 active:scale-90"><Minus size={14} /></button>
            <span className="w-8 text-center text-sm font-black text-white">{line.slot_count}</span>
            <button type="button" onClick={() => actions.setLineSlots(line.id, line.slot_count + 1)} disabled={line.slot_count >= 60} className="w-8 h-8 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 flex items-center justify-center disabled:opacity-30 active:scale-90"><Plus size={14} /></button>
          </div>) : <span className="text-sm font-black text-white">{line.slot_count}개</span>}
        <div className="flex-1" />
        {canEdit && zone.lines.length > 1 && <Btn size="sm" variant="ghost" onClick={() => actions.deleteLine(line.id)}><Trash2 size={13} /> 이 줄 삭제</Btn>}
      </div>

      {/* 선반을 앞에서 본 모습: 칸(가로) × 층(세로) */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="inline-block min-w-full">
          {tiers.map(t => (
            <div key={t} className="flex items-stretch gap-2 mb-2">
              <div className="w-9 shrink-0 flex items-center justify-end pr-1 text-[11px] font-bold text-surface-500">{t}층</div>
              {slots.map(s => {
                const st = stackAt(line, s), box = st[t - 1], canAdd = canEdit && !box && st.length === t - 1
                const isHl = box && hl && hl.has(box.id)
                if (box) return (
                  <button key={s} type="button" onClick={() => onOpenBox(box.id)} title={`박스 ${box.box_number} 열기`}
                    className={`relative w-[72px] h-[60px] shrink-0 rounded-2xl text-left overflow-hidden transition-all active:scale-95 hover:-translate-y-0.5 ${hl && !isHl ? 'opacity-35' : ''}`}
                    style={{ background: shade(zone.color, 1.04), border: `2px solid ${isHl ? '#f59e0b' : shade(zone.color, 0.65)}`, boxShadow: isHl ? '0 0 0 3px rgba(245,158,11,.4)' : '0 2px 0 ' + shade(zone.color, 0.6) }}>
                    <div className="absolute left-0 right-0 top-0 h-[7px]" style={{ background: 'rgba(255,255,255,0.55)' }} />
                    <div className="relative px-2 pt-3 text-[15px] font-black leading-none truncate" style={{ color: '#2b3445' }}>{box.box_number}</div>
                    <div className="absolute left-2 bottom-1 text-[10px] font-bold" style={{ color: '#2b3445', opacity: 0.75 }}>{box.itemCount ? `${box.itemCount}종 · ${box.totalQty}개` : '비어있음'}</div>
                  </button>)
                if (canAdd) return (
                  <button key={s} type="button" onClick={() => addBox(s, t)} title="여기에 박스 놓기"
                    className="w-[72px] h-[60px] shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-90 hover:scale-105"
                    style={{ border: `2px dashed ${shade(zone.color, 0.7)}`, background: rgba(zone.color, 0.12), color: shade(zone.color, 0.6) }}>
                    <Plus size={22} strokeWidth={3} />
                  </button>)
                return <div key={s} className="w-[72px] h-[60px] shrink-0 rounded-2xl border border-dotted border-surface-700 opacity-40" title={st.length < t - 1 ? '아래층에 박스가 있어야 올릴 수 있어요' : ''} />
              })}
            </div>))}
          <div className="flex items-center gap-2">
            <div className="w-9 shrink-0" />
            {slots.map(s => <div key={s} className="w-[72px] shrink-0 text-center text-[11px] font-bold text-surface-400">{s}번 칸</div>)}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-surface-500 mt-3 leading-relaxed">💡 아래층에 박스가 있어야 그 위에 올릴 수 있어요. 박스를 누르면 상품을 담고 번호를 바꿀 수 있어요.{!canEdit && ' (보기만 가능해요)'}</p>
    </Modal>
  )
}
