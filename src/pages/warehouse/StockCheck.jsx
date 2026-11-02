// 재고 대조: 시스템 재고(현재재고)와 박스에 담은 수량을 옵션별로 비교
import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Modal, Btn, EmptyNote, StockBadge, inputCls } from './ui'
import SkuThumb from '../../components/ui/SkuThumb'
import { itemKey, stockStatus } from './whLogic'

const FILTERS = [['diff', '맞춰야 할 것'], ['short', '미배치'], ['over', '재고보다 많음'], ['ok', '일치'], ['gone', '삭제된 상품'], ['all', '전체']]
const SHOW = 60

export default function StockCheck({ model, loadCatalog, onFind, onClose }) {
  const [data, setData] = useState(null), [err, setErr] = useState('')
  const [filter, setFilter] = useState('diff'), [q, setQ] = useState(''), [limit, setLimit] = useState(SHOW)
  useEffect(() => { let off = false; loadCatalog().then(d => { if (!off) setData(d) }).catch(e => { if (!off) setErr(e.message || '상품 목록을 불러오지 못했어요') }); return () => { off = true } }, [loadCatalog])
  useEffect(() => setLimit(SHOW), [filter, q])

  const rows = useMemo(() => {
    if (!data) return []
    const out = [], seen = new Set()
    for (const p of data.products) for (const s of p.skus) {
      const key = itemKey({ product_id: p.id, opt1: s.opt1, opt2: s.opt2 }), placed = model.placed.get(key) || 0
      seen.add(key)
      if (!(s.stock > 0) && placed === 0) continue                                       // 재고도 없고 담은 것도 없으면 대조할 게 없음
      out.push({ key, name: p.name, label: s.label, image: s.image_url || p.image_url, stock: s.stock ?? 0, placed, ...stockStatus(s.stock ?? 0, placed) })
    }
    for (const b of model.boxes) for (const it of b.items) {                              // 상품이 삭제/비활성이 됐는데 박스에는 남아 있는 것
      const k = itemKey(it); if (seen.has(k)) continue; seen.add(k)
      out.push({ key: k, name: it.name, label: it.label, image: it.image, stock: null, placed: model.placed.get(k) || 0, kind: 'gone', diff: 0 })
    }
    return out
  }, [data, model])

  const count = k => rows.filter(r => r.kind === k).length
  const unplaced = rows.filter(r => r.kind === 'short').reduce((s, r) => s + r.diff, 0)
  const term = q.trim().toLowerCase()
  const shown = rows.filter(r => (filter === 'all' || (filter === 'diff' ? r.kind === 'short' || r.kind === 'over' : r.kind === filter)) && (!term || `${r.name} ${r.label}`.toLowerCase().includes(term)))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.name.localeCompare(b.name, 'ko'))
  const counts = { diff: count('short') + count('over'), short: count('short'), over: count('over'), ok: count('ok'), gone: count('gone'), all: rows.length }

  return (
    <Modal onClose={onClose} width="max-w-2xl" icon="⚖️" title="재고 대조" subtitle="시스템 재고(현재재고)와 박스에 담은 수량을 옵션별로 비교해요">
      {err ? <EmptyNote emoji="😵" title="불러오지 못했어요">{err}</EmptyNote>
        : !data ? <div className="flex justify-center py-14"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : (<>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[['일치', counts.ok, '#059669'], ['미배치', counts.short, '#d97706'], ['재고보다 많음', counts.over, '#dc2626']].map(([l, n, c]) => (
              <div key={l} className="rounded-2xl border border-surface-700 bg-surface-800/50 px-3 py-2 text-center"><p className="text-[10px] text-surface-400">{l}</p><p className="text-lg font-black" style={{ color: c }}>{n}</p></div>))}
          </div>
          {unplaced > 0 && <p className="text-[11px] text-surface-400 mb-3">아직 박스에 담지 않은 재고가 모두 <b className="text-white">{unplaced.toLocaleString()}개</b> 있어요.</p>}
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="상품 이름이나 옵션으로 찾기" className={`${inputCls} pl-10`} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-1">
            {FILTERS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                className={`shrink-0 px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all ${filter === k ? 'bg-primary-500 border-primary-500' : 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'}`}
                style={filter === k ? { color: '#fff' } : undefined}>{label} <span className="opacity-70">{counts[k]}</span></button>))}
          </div>
          {shown.length === 0
            ? <EmptyNote emoji={filter === 'diff' ? '🎉' : '🔍'} title={filter === 'diff' && !term ? '맞춰야 할 것이 없어요!' : '해당하는 옵션이 없어요'}>{filter === 'diff' && !term ? '재고와 박스에 담은 수량이 모두 일치해요.' : '다른 조건으로 찾아보세요.'}</EmptyNote>
            : (
              <ul className="space-y-1.5">
                {shown.slice(0, limit).map(r => (
                  <li key={r.key} className="flex items-center gap-2.5 p-2 rounded-2xl bg-surface-800/50 border border-surface-700">
                    <SkuThumb url={r.image} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{r.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-primary-500/15 text-primary-400">{r.label || '기본'}</span>
                        {r.kind === 'gone' ? <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>삭제된 상품</span> : <StockBadge stock={r.stock} placed={r.placed} />}
                      </div>
                    </div>
                    <div className="text-right shrink-0 leading-tight"><p className="text-[10px] text-surface-500">재고 {r.stock ?? '-'}</p><p className="text-[10px] text-surface-500">박스 {r.placed}</p></div>
                    {r.placed > 0 && <Btn size="sm" variant="soft" onClick={() => onFind(r.name)}>찾기</Btn>}
                  </li>))}
                {shown.length > limit && <button type="button" onClick={() => setLimit(l => l + SHOW)} className="w-full py-2.5 rounded-2xl text-xs font-bold border border-dashed border-surface-600 text-surface-400 hover:text-primary-400">더 보기 ({shown.length - limit}개 남음)</button>}
              </ul>)}
        </>)}
    </Modal>
  )
}
