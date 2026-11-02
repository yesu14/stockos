// 박스에 상품 담기: 현재 시스템의 카테고리/상품 목록에서 "옵션" 단위로 체크하고 수량 입력
import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { Modal, Btn, EmptyNote, inputCls } from './ui'
import { itemKey, roomFor } from './whLogic'
import SkuThumb from '../../components/ui/SkuThumb'

const SHOW = 60

export default function ProductPicker({ boxLabel, loadCatalog, placed, onConfirm, onClose }) {
  const [cat, setCat] = useState('all'), [q, setQ] = useState('')
  const [data, setData] = useState(null), [err, setErr] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const [picked, setPicked] = useState(() => new Map())          // skuId → 수량
  const [limit, setLimit] = useState(SHOW), [busy, setBusy] = useState(false)
  useEffect(() => { let off = false; loadCatalog().then(d => { if (!off) setData(d) }).catch(e => { if (!off) setErr(e.message || '상품 목록을 불러오지 못했어요') }); return () => { off = true } }, [loadCatalog])
  useEffect(() => setLimit(SHOW), [q, cat])

  const term = q.trim().toLowerCase()
  const list = useMemo(() => {
    if (!data) return []
    return data.products.filter(p => (cat === 'all' || p.category_id === cat) &&
      (!term || p.name.toLowerCase().includes(term) || p.skus.some(s => s.label.toLowerCase().includes(term))))
  }, [data, cat, term])
  const catName = useMemo(() => new Map((data?.categories || []).map(c => [c.id, c.name])), [data])
  const skuById = useMemo(() => { const m = new Map(); for (const p of data?.products || []) for (const s of p.skus) m.set(s.id, { s, p }); return m }, [data])

  // 재고(시스템) − 이미 박스에 담긴 수량 = 더 담을 수 있는 수량
  const inBoxes = (p, s) => (placed && placed.get(itemKey({ product_id: p.id, opt1: s.opt1, opt2: s.opt2 }))) || 0
  const roomOf = (p, s) => roomFor(s.stock ?? 0, inBoxes(p, s))
  const toggle = (id, room) => { if (room < 1) return; setPicked(m => { const n = new Map(m); n.has(id) ? n.delete(id) : n.set(id, 1); return n }) }
  const setQty = (id, v, room) => setPicked(m => { const n = new Map(m); n.set(id, v === '' ? '' : String(Math.min(room, Number(v)))); return n })       // 가능 수량을 넘게 입력하면 가능한 최대로
  const toggleProduct = p => setPicked(m => {
    const n = new Map(m), pick = p.skus.filter(s => roomOf(p, s) >= 1), all = pick.length > 0 && pick.every(s => n.has(s.id))
    for (const s of pick) all ? n.delete(s.id) : (n.has(s.id) || n.set(s.id, 1)); return n
  })
  const isOpen = p => open.has(p.id) || (term && list.length <= 30)
  const flip = id => setOpen(o => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n })

  const count = picked.size
  const totalQty = [...picked.values()].reduce((s, v) => s + (Number(v) || 0), 0)
  const bad = [...picked.values()].some(v => !(Math.floor(Number(v)) >= 1))
  const confirm = async () => {
    const entries = [...picked.entries()].map(([id, qty]) => { const x = skuById.get(id); return { sku: { id, product_id: x.p.id, opt1: x.s.opt1, opt2: x.s.opt2, label: x.s.label, image_url: x.s.image_url }, productName: x.p.name, qty: Math.floor(Number(qty)) } })
    setBusy(true); try { await onConfirm(entries) } finally { setBusy(false) }
  }

  return (
    <Modal onClose={onClose} level={2} width="max-w-2xl" icon="🧺" title="상품 담기" subtitle={`${boxLabel}에 담을 옵션을 골라주세요 (여러 개 체크 가능)`}
      footer={<>
        <span className="mr-auto text-xs text-surface-400">{count ? <><b className="text-white">{count}개</b> 옵션 · 총 <b className="text-white">{totalQty}</b>개</> : '옵션을 체크하면 수량을 정할 수 있어요'}</span>
        <Btn variant="soft" onClick={onClose}>취소</Btn>
        <Btn variant="primary" disabled={!count || bad || busy} onClick={confirm}>{busy ? '담는 중…' : '박스에 담기'}</Btn>
      </>}>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="상품 이름이나 옵션으로 찾기" className={`${inputCls} pl-10`} />
      </div>
      {data && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-1">
          {[{ id: 'all', name: '전체' }, ...data.categories].map(c => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition-all ${cat === c.id ? 'bg-primary-500 border-primary-500' : 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'}`}
              style={cat === c.id ? { color: '#fff' } : undefined}>{c.name}</button>))}
        </div>)}

      {err ? <EmptyNote emoji="😵" title="상품 목록을 불러오지 못했어요">{err}</EmptyNote>
        : !data ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : list.length === 0 ? <EmptyNote emoji="🔍" title="찾는 상품이 없어요">다른 이름으로 찾아보거나 카테고리를 바꿔보세요.</EmptyNote>
        : (
          <div className="space-y-2">
            {list.slice(0, limit).map(p => {
              const sel = p.skus.filter(s => picked.has(s.id)).length, allOn = sel === p.skus.length
              return (
                <div key={p.id} className="rounded-3xl border border-surface-700 bg-surface-800/40 overflow-hidden">
                  <div className="flex items-center gap-2.5 p-2.5 cursor-pointer" onClick={() => flip(p.id)}>
                    {isOpen(p) ? <ChevronDown size={16} className="text-surface-400 shrink-0" /> : <ChevronRight size={16} className="text-surface-400 shrink-0" />}
                    <SkuThumb url={p.image_url || p.skus.find(s => s.image_url)?.image_url} size={40} zoom={false} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-surface-500">{catName.get(p.category_id) || '미분류'} · 옵션 {p.skus.length}개{sel ? ` · ${sel}개 선택` : ''}</p>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); toggleProduct(p) }} className="shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold border border-surface-700 text-surface-300 hover:bg-surface-700">{allOn ? '모두 해제' : '모두 선택'}</button>
                  </div>
                  {isOpen(p) && (
                    <ul className="border-t border-surface-700 divide-y divide-surface-800">
                      {p.skus.map(s => {
                        const on = picked.has(s.id), have = inBoxes(p, s), room = roomOf(p, s), blocked = room < 1
                        return (
                          <li key={s.id} className={`flex items-center gap-2.5 px-3 py-2 ${on ? 'bg-primary-500/10' : ''} ${blocked ? 'opacity-60' : ''}`}>
                            <button type="button" disabled={blocked} onClick={() => toggle(s.id, room)} aria-label={on ? '선택 해제' : '선택'} title={blocked ? '더 담을 수 있는 재고가 없어요' : undefined}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${on ? 'bg-primary-500 border-primary-500' : 'border-surface-600'} ${blocked ? 'cursor-not-allowed' : ''}`}>{on && <Check size={14} strokeWidth={3} style={{ color: '#fff' }} />}</button>
                            <SkuThumb url={s.image_url} size={36} />
                            <div className={`min-w-0 flex-1 ${blocked ? '' : 'cursor-pointer'}`} onClick={() => toggle(s.id, room)}>
                              <p className="text-sm font-semibold text-surface-100 truncate">{s.label}</p>
                              <p className="text-[10px] text-surface-500">재고 {s.stock} · 박스에 {have} · <b style={{ color: blocked ? '#dc2626' : '#059669' }}>{blocked ? '더 담을 수 없어요' : `${room}개 담을 수 있어요`}</b></p>
                            </div>
                            {on && (
                              <div className="flex items-center gap-1 shrink-0">
                                <input value={picked.get(s.id)} inputMode="numeric" onChange={e => setQty(s.id, e.target.value.replace(/[^0-9]/g, ''), room)} onFocus={e => e.target.select()}
                                  className={`w-16 h-9 text-center text-sm font-bold rounded-xl bg-surface-800 border text-white focus:outline-none ${Math.floor(Number(picked.get(s.id))) >= 1 ? 'border-surface-600 focus:border-primary-500' : 'border-red-500'}`} />
                                <button type="button" onClick={() => setQty(s.id, String(room), room)} title="담을 수 있는 최대 수량" className="px-2 h-9 rounded-xl text-[11px] font-bold border border-surface-700 text-primary-400 hover:bg-primary-500/10">최대</button>
                              </div>)}
                          </li>)
                      })}
                    </ul>)}
                </div>)
            })}
            {list.length > limit && <button type="button" onClick={() => setLimit(l => l + SHOW)} className="w-full py-2.5 rounded-2xl text-xs font-bold border border-dashed border-surface-600 text-surface-400 hover:text-primary-400">상품 더 보기 ({list.length - limit}개 남음)</button>}
          </div>)}
    </Modal>
  )
}
