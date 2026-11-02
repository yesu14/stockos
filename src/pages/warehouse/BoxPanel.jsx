// 박스 열기: 번호 바꾸기 / 담긴 상품(옵션) 수량 편집·삭제 / 상품 담기 / 박스 삭제
import { useState, useEffect, useRef } from 'react'
import { MapPin, Plus, Trash2, Minus } from 'lucide-react'
import { Modal, Btn, EmptyNote, StockBadge, inputCls } from './ui'
import SkuThumb from '../../components/ui/SkuThumb'
import { locationText } from './whLogic'

function QtyInput({ value, onCommit, disabled, max = Infinity }) {
  const [v, setV] = useState(String(value))
  useEffect(() => setV(String(value)), [value])
  const commit = raw => {
    if (raw === '') { setV(String(value)); return }
    let q = Math.floor(Number(raw))
    if (!(q >= 1)) { setV(String(value)); onCommit(0); return }     // 0 이하: 값은 그대로 두고 "1개 이상이어야 해요" 안내
    if (q > max) q = Math.max(value, max)                          // 재고를 넘게 입력하면 담을 수 있는 최대(또는 지금 값)로
    if (q !== value) onCommit(q); else setV(String(value))
  }
  const b = 'w-8 h-8 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 flex items-center justify-center disabled:opacity-30 active:scale-90'
  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" className={b} disabled={disabled || value <= 1} onClick={() => commit(value - 1)} aria-label="하나 줄이기"><Minus size={13} /></button>
      <input value={v} disabled={disabled} inputMode="numeric" onChange={e => setV(e.target.value.replace(/[^0-9]/g, ''))} onBlur={() => commit(v)}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="w-14 h-8 text-center text-sm font-bold rounded-xl bg-surface-800 border border-surface-700 text-white focus:outline-none focus:border-primary-500" />
      <button type="button" className={b} disabled={disabled || value >= max} onClick={() => commit(value + 1)} aria-label="하나 늘리기" title={value >= max ? '재고를 넘을 수 없어요' : undefined}><Plus size={13} /></button>
    </div>
  )
}

export default function BoxPanel({ boxId, model, canEdit, actions, onAddProducts, onLocate, onClose }) {
  const box = model.boxesById.get(boxId)
  const [num, setNum] = useState(box?.box_number ?? '')
  const [armed, setArmed] = useState(null)
  const timer = useRef(0)
  useEffect(() => { if (!box) onClose() }, [box]) // eslint-disable-line
  useEffect(() => { if (box) setNum(box.box_number) }, [box?.box_number]) // eslint-disable-line
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!box) return null

  const arm = id => { setArmed(id); clearTimeout(timer.current); timer.current = setTimeout(() => setArmed(null), 3000) }
  const changed = String(num).trim() !== String(box.box_number)
  const kinds = box.items.length, total = box.totalQty

  return (
    <Modal onClose={onClose} level={1} accent={box.zoneColor} width="max-w-xl" icon="📦" title={`박스 ${box.box_number}`} subtitle={locationText(box)}
      footer={<>
        <Btn variant="soft" onClick={() => onLocate(box.id)}><MapPin size={14} /> 위치 보기</Btn>
        {canEdit && <Btn variant="primary" onClick={() => onAddProducts(box.id)}><Plus size={14} /> 상품 담기</Btn>}
        {canEdit && <Btn variant="danger" size="icon" title="박스 삭제" onClick={async () => { const ok = await actions.deleteBox(box.id); if (ok === true) onClose() }}><Trash2 size={15} /></Btn>}
      </>}>
      {canEdit && (
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">박스 번호</label>
            <input value={num} onChange={e => setNum(e.target.value)} maxLength={24} className={inputCls}
              onKeyDown={e => { if (e.key === 'Enter' && changed) actions.renameBox(box.id, num) }} />
          </div>
          {changed && <Btn variant="primary" onClick={() => actions.renameBox(box.id, num)}>번호 바꾸기</Btn>}
        </div>)}

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-surface-300">담긴 상품</p>
        <p className="text-[11px] text-surface-500">{kinds}종 · 총 {total}개</p>
      </div>

      {kinds === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-700"><EmptyNote emoji="🫙" title="아직 비어있는 박스예요">{canEdit ? '아래 "상품 담기"로 옵션별 상품과 수량을 담아보세요.' : ''}</EmptyNote></div>
      ) : (
        <ul className="space-y-2">
          {box.items.map(it => (
            <li key={it.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-800/60 border border-surface-700">
              <SkuThumb url={it.image} size={46} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{it.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-primary-500/15 text-primary-400">{it.label || '기본'}</span>
                  {it.stock != null && <span className="text-[10px] text-surface-500">재고 {it.stock} · 전체 박스 {it.placed}</span>}
                  <StockBadge stock={it.stock} placed={it.placed} />
                  {it.removed && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>삭제된 상품</span>}
                </div>
              </div>
              <QtyInput value={it.quantity} disabled={!canEdit} max={it.stock == null ? Infinity : it.stock - (it.placed - it.quantity)} onCommit={q => actions.setQty(it.id, q)} />
              {canEdit && (armed === it.id
                ? <button type="button" onClick={() => { setArmed(null); actions.removeItem(it.id) }} className="px-2.5 h-8 rounded-xl text-[11px] font-bold shrink-0" style={{ background: '#ef4444', color: '#fff' }}>빼기?</button>
                : <button type="button" onClick={() => arm(it.id)} title="박스에서 빼기" className="w-8 h-8 rounded-xl text-surface-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center shrink-0"><Trash2 size={15} /></button>)}
            </li>))}
        </ul>)}
    </Modal>
  )
}
