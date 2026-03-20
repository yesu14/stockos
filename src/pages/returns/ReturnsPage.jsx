import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  LineChart, Line, ResponsiveContainer, Legend
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  RotateCcw, Package, Search, ChevronDown, ChevronRight,
  X, Trash2, Plus, Save, Pencil, ClipboardList, BarChart2,
  Building2, Info, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import ReturnSourcesPage from './ReturnSourcesPage'

function skuLabel(sku) {
  return [sku?.o1?.option_value, sku?.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
}
function Chk({ state, onChange }) {
  const ref = el => { if (el) el.indeterminate = state === 'partial' }
  return <input type="checkbox" ref={ref} checked={state === true || state === 'partial'} onChange={onChange} className="w-4 h-4 accent-rose-500 cursor-pointer shrink-0" />
}

// ── 툴팁 ─────────────────────────────────────────────────
function Tip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info size={13} className="text-yellow-400 cursor-help" />
      {show && (
        <span className="absolute left-5 top-0 z-50 w-56 bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-xs text-surface-200 shadow-xl whitespace-normal leading-relaxed">
          {text}
        </span>
      )}
    </span>
  )
}

// ── 상품 그리드 ──────────────────────────────────────────
function StockGrid({ skus, values, onChange, bulkValue, onBulkChange, onBulkApply }) {
  const opt1Vals = useMemo(() => {
    const seen = new Map()
    skus.forEach(s => { if (s.o1) seen.set(s.o1.option_value, s.o1); else seen.set('Default', { option_value: 'Default' }) })
    return [...seen.values()].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [skus])
  const opt2Vals = useMemo(() => {
    const seen = new Map()
    skus.forEach(s => { if (s.o2) seen.set(s.o2.option_value, s.o2) })
    return [...seen.values()].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [skus])
  const hasOpt2 = opt2Vals.length > 0
  function getSku(o1val, o2val) {
    if (o1val === 'Default') return skus[0]
    return skus.find(s => s.o1?.option_value === o1val && (o2val ? s.o2?.option_value === o2val : !s.o2))
  }
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-3 p-3 bg-surface-800/60 rounded-xl flex-wrap shrink-0">
        <span className="text-xs text-surface-400 shrink-0">일괄 적용:</span>
        <input type="number" min="0" value={bulkValue} onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
          onChange={e => onBulkChange(e.target.value.replace(/[^0-9]/g, ''))} placeholder="수량"
          className="w-28 bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-rose-500" />
        <button onClick={onBulkApply} className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors">전체 적용</button>
      </div>
      <div className="rounded-xl border border-surface-700" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table className="border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-800">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-400 border-b border-surface-700 sticky left-0 bg-surface-800 min-w-28 z-20">
                {hasOpt2 ? `${opt1Vals[0]?.option_name || '옵션1'} \\ ${opt2Vals[0]?.option_name || '옵션2'}` : (opt1Vals[0]?.option_name || '옵션')}
              </th>
              {hasOpt2
                ? opt2Vals.map(v2 => <th key={v2.option_value} className="px-3 py-2.5 text-center text-xs font-semibold text-surface-300 border-b border-surface-700 min-w-28">{v2.option_value}</th>)
                : <th className="px-3 py-2.5 text-center text-xs font-semibold text-surface-400 border-b border-surface-700 min-w-28">반품수량</th>}
            </tr>
          </thead>
          <tbody>
            {opt1Vals.map(v1 => (
              <tr key={v1.option_value} className="border-b border-surface-700/40 last:border-0 hover:bg-surface-800/20">
                <td className="px-3 py-2.5 text-sm font-medium text-surface-200 sticky left-0 bg-surface-900 border-r border-surface-700/40">{v1.option_value}</td>
                {hasOpt2 ? opt2Vals.map(v2 => {
                  const sku = getSku(v1.option_value, v2.option_value)
                  if (!sku) return <td key={v2.option_value} className="px-3 py-2.5 text-center text-surface-600 text-xs">-</td>
                  const val = values[sku.id] ?? ''
                  return (
                    <td key={v2.option_value} className="px-2 py-2">
                      <div className="text-center text-xs text-surface-500 mb-1">재고 {sku.stock}</div>
                      <input type="number" min="0" value={val} onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
                        onChange={e => onChange(sku.id, e.target.value.replace(/[^0-9]/g, ''))} placeholder="0"
                        className={'w-full text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none ' + (val > 0 ? 'border-rose-500 bg-rose-500/10' : 'border-surface-700')} />
                    </td>)
                }) : (() => {
                  const sku = getSku(v1.option_value, null)
                  if (!sku) return <td className="px-3 py-2.5 text-center text-surface-600">-</td>
                  const val = values[sku.id] ?? ''
                  return (
                    <td key="single" className="px-2 py-2">
                      <div className="text-center text-xs text-surface-500 mb-1">재고 {sku.stock}</div>
                      <input type="number" min="0" value={val} onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
                        onChange={e => onChange(sku.id, e.target.value.replace(/[^0-9]/g, ''))} placeholder="0"
                        className={'w-full text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none ' + (val > 0 ? 'border-rose-500 bg-rose-500/10' : 'border-surface-700')} />
                    </td>)
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 상품 선택 트리 ──────────────────────────────────────────
function ProductTreeSelector({ categories, products, skusByProduct, existingSkuIds = new Set(), onAddItems }) {
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})
  const [checked, setChecked] = useState({})
  const [activeGrid, setActiveGrid] = useState(null)
  const [gridValues, setGridValues] = useState({})
  const [bulkVal, setBulkVal] = useState('')
  const [search, setSearch] = useState('')

  const filteredProds = useMemo(() => {
    if (!search.trim()) return products
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [products, search])

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = [] })
  filteredProds.forEach(p => {
    const cid = p.category_id || '__none__'
    if (!catMap[cid]) catMap[cid] = []
    catMap[cid].push(p)
  })

  function available(prod) { return (skusByProduct[prod.id] || []).filter(s => !existingSkuIds.has(s.id)) }
  function prodState(prod) {
    const skus = available(prod); if (!skus.length) return false
    const n = skus.filter(s => checked[s.id]).length
    return n === 0 ? false : n === skus.length ? true : 'partial'
  }
  function catState(prods) {
    const skus = prods.flatMap(available); if (!skus.length) return false
    const n = skus.filter(s => checked[s.id]).length
    return n === 0 ? false : n === skus.length ? true : 'partial'
  }
  function toggleSku(skuId) {
    if (existingSkuIds.has(skuId)) { toast.error('이미 반품 목록에 있는 옵션입니다'); return }
    setChecked(p => ({ ...p, [skuId]: !p[skuId] }))
  }
  function toggleProd(prod) {
    const skus = available(prod); const allOn = skus.every(s => checked[s.id])
    const next = { ...checked }; skus.forEach(s => { next[s.id] = !allOn }); setChecked(next)
  }
  function toggleCat(prods) {
    const skus = prods.flatMap(available); const allOn = skus.every(s => checked[s.id])
    const next = { ...checked }; skus.forEach(s => { next[s.id] = !allOn }); setChecked(next)
  }
  function addChecked() {
    const ids = Object.keys(checked).filter(id => checked[id])
    if (!ids.length) return toast.error('체크박스로 옵션을 선택하세요')
    const items = []
    ids.forEach(skuId => {
      const prod = products.find(p => (skusByProduct[p.id] || []).some(s => s.id === skuId))
      const sku = (skusByProduct[prod?.id] || []).find(s => s.id === skuId)
      if (prod && sku) items.push({ product: prod, catId: prod.category_id || '__none__', sku, currentStock: sku.stock, retQty: 0, finalStock: sku.stock })
    })
    onAddItems(items); setChecked({}); toast.success(`${items.length}개 추가됨`)
  }
  function openGrid(prod) { setActiveGrid({ product: prod, skus: skusByProduct[prod.id] || [], hasOpt2: (skusByProduct[prod.id] || []).some(s => s.o2) }); setGridValues({}); setBulkVal('') }
  function handleGridAdd() {
    const items = (activeGrid?.skus || []).filter(s => {
      if (existingSkuIds.has(s.id)) { toast.error(`'${skuLabel(s)}'는 이미 반품 목록에 있습니다`); return false }
      return (parseInt(gridValues[s.id]) || 0) > 0
    }).map(s => ({ product: activeGrid.product, catId: activeGrid.product.category_id || '__none__', sku: s, currentStock: s.stock, retQty: parseInt(gridValues[s.id]) || 0, finalStock: s.stock + (parseInt(gridValues[s.id]) || 0) }))
    if (!items.length) return toast.error('0보다 큰 수량을 입력하세요')
    onAddItems(items); setActiveGrid(null); setGridValues({}); toast.success(`${items.length}개 추가됨`)
  }
  const selectedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="상품 검색..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-rose-500" />
        </div>
        {selectedCount > 0 && (
          <button onClick={addChecked} className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold transition-colors">
            <Plus size={12} /> {selectedCount}개 추가
          </button>
        )}
      </div>
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden max-h-[65vh] overflow-y-auto">
        {Object.entries(catMap).map(([catId, prods]) => {
          if (!prods.length) return null
          const catName = catId === '__none__' ? '미분류' : (categories.find(c => c.id === catId)?.name || '카테고리')
          const catOpen = expCats[catId] ?? false
          return (
            <div key={catId} className="border-b border-surface-800 last:border-0">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                <Chk state={catState(prods)} onChange={() => toggleCat(prods)} />
                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpCats(p => ({ ...p, [catId]: !catOpen }))}>
                  {catOpen ? <ChevronDown size={14} className="text-surface-400" /> : <ChevronRight size={14} className="text-surface-400" />}
                  <span className="font-semibold text-white text-sm">{catName}</span>
                  <span className="text-xs text-surface-500">({prods.length})</span>
                </div>
              </div>
              {catOpen && prods.map(prod => {
                const skus = skusByProduct[prod.id] || []
                const prodOpen = expProds[prod.id] ?? false
                return (
                  <div key={prod.id} className="border-t border-surface-800/40">
                    <div className="flex items-center gap-2 pl-6 pr-3 py-2 hover:bg-surface-800/10">
                      <Chk state={prodState(prod)} onChange={() => toggleProd(prod)} />
                      <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpProds(p => ({ ...p, [prod.id]: !prodOpen }))}>
                        {prodOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
                        <span className="text-sm text-white">{prod.name}</span>
                        <span className="text-xs text-surface-600">({skus.length})</span>
                      </div>
                      <button onClick={() => openGrid(prod)} className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg text-xs font-medium transition-colors shrink-0">
                        <Plus size={11} /> 상세보기
                      </button>
                    </div>
                    {prodOpen && skus.map(sku => {
                      const alreadyIn = existingSkuIds.has(sku.id)
                      return (
                        <div key={sku.id} className={'flex items-center gap-2 pl-12 pr-3 py-1.5 border-t border-surface-800/20 ' + (alreadyIn ? 'opacity-40' : '')}>
                          <Chk state={alreadyIn ? false : !!checked[sku.id]} onChange={() => toggleSku(sku.id)} />
                          <span className="flex-1 text-xs text-surface-300">{skuLabel(sku)}</span>
                          <span className="text-xs text-surface-500 font-mono">재고 {sku.stock}</span>
                          {alreadyIn && <span className="text-xs text-rose-400/70">추가됨</span>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {activeGrid && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full flex flex-col shadow-2xl" style={{ maxWidth: activeGrid.hasOpt2 ? '100vw' : '640px', maxHeight: '98vh', height: activeGrid.hasOpt2 ? '98vh' : 'auto' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800 shrink-0">
              <div><h3 className="font-semibold text-white">{activeGrid.product.name}</h3><p className="text-xs text-surface-500 mt-0.5">반품수량 입력</p></div>
              <button onClick={() => setActiveGrid(null)} className="text-surface-400 hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="p-5 flex-1 flex flex-col min-h-0">
              <StockGrid skus={activeGrid.skus} values={gridValues} onChange={(id, v) => setGridValues(p => ({ ...p, [id]: v }))}
                bulkValue={bulkVal} onBulkChange={setBulkVal}
                onBulkApply={() => { if (!bulkVal) return; const n = {}; activeGrid.skus.forEach(s => { n[s.id] = bulkVal }); setGridValues(n) }} />
            </div>
            <div className="px-5 py-4 border-t border-surface-800 flex gap-3 shrink-0">
              <button onClick={() => setActiveGrid(null)} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium">취소</button>
              <button onClick={handleGridAdd} className="flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold">
                <Plus size={15} /> 반품 목록에 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 반품 목록 트리테이블 ──────────────────────────────────
function ReturnItemsTree({ items, onUpdateQty, onDeleteItems, categoryMap, productMap, isDisposal = false }) {
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})
  const [checked, setChecked] = useState({})

  const tree = useMemo(() => {
    const cats = {}
    items.forEach(item => {
      const catId = item.catId || '__none__'
      const prodId = item.product?.id || '__none__'
      if (!cats[catId]) cats[catId] = {}
      if (!cats[catId][prodId]) cats[catId][prodId] = []
      cats[catId][prodId].push(item)
    })
    return cats
  }, [items])

  function catState(catId) {
    const ids = Object.values(tree[catId] || {}).flat().map(it => it.sku.id)
    if (!ids.length) return false
    const n = ids.filter(id => checked[id]).length
    return n === 0 ? false : n === ids.length ? true : 'partial'
  }
  function prodState(catId, prodId) {
    const its = tree[catId]?.[prodId] || []; if (!its.length) return false
    const n = its.filter(it => checked[it.sku.id]).length
    return n === 0 ? false : n === its.length ? true : 'partial'
  }
  function toggleCat(catId) {
    const ids = Object.values(tree[catId] || {}).flat().map(it => it.sku.id)
    const allOn = ids.every(id => checked[id])
    const next = { ...checked }; ids.forEach(id => { next[id] = !allOn }); setChecked(next)
  }
  function toggleProd(catId, prodId) {
    const ids = (tree[catId]?.[prodId] || []).map(it => it.sku.id)
    const allOn = ids.every(id => checked[id])
    const next = { ...checked }; ids.forEach(id => { next[id] = !allOn }); setChecked(next)
  }
  const checkedIds = Object.keys(checked).filter(id => checked[id])

  return (
    <div className="space-y-2">
      {checkedIds.length > 0 && (
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-surface-400">{checkedIds.length}개 선택됨</span>
          <button onClick={() => { onDeleteItems(checkedIds); setChecked({}) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-xl text-xs font-medium transition-colors">
            <Trash2 size={12} /> 선택 삭제
          </button>
        </div>
      )}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-0 px-3 py-2 bg-surface-800/60 border-b border-surface-700">
          <div className="text-xs font-semibold text-surface-400 uppercase">옵션</div>
          <div className="text-xs font-semibold text-surface-400 uppercase text-center">현재재고</div>
          <div className="text-xs font-semibold text-rose-400 uppercase text-center">반품수량</div>
          <div className="text-xs font-semibold text-emerald-400 uppercase text-center">반품후재고</div>
          <div />
        </div>
        {Object.keys(tree).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-surface-500">
            <Package size={28} className="mb-2 opacity-30" /><p className="text-xs">왼쪽에서 상품을 선택하세요</p>
          </div>
        ) : Object.entries(tree).map(([catId, catProds]) => {
          const catName = catId === '__none__' ? '미분류' : (categoryMap[catId] || '카테고리')
          const catOpen = expCats[catId] ?? true
          const catQty = Object.values(catProds).flat().reduce((s, it) => s + (it.retQty || 0), 0)
          return (
            <div key={catId} className="border-b border-surface-800 last:border-0">
              <div className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-0 px-3 py-2.5 bg-surface-800/30">
                <div className="flex items-center gap-2">
                  <Chk state={catState(catId)} onChange={() => toggleCat(catId)} />
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpCats(p => ({ ...p, [catId]: !catOpen }))}>
                    {catOpen ? <ChevronDown size={13} className="text-surface-500" /> : <ChevronRight size={13} className="text-surface-500" />}
                    <span className="text-xs font-semibold text-surface-300 uppercase tracking-wide">{catName}</span>
                  </div>
                </div>
                <div /><div className="text-center text-xs font-mono text-rose-400 font-bold self-center">{catQty}</div><div /><div />
              </div>
              {catOpen && Object.entries(catProds).map(([prodId, its]) => {
                const prodName = productMap[prodId] || its[0]?.product?.name || '상품'
                const prodOpen = expProds[`${catId}-${prodId}`] ?? true
                const prodQty = its.reduce((s, it) => s + (it.retQty || 0), 0)
                return (
                  <div key={prodId} className="border-t border-surface-800/40">
                    <div className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-0 pl-6 pr-3 py-2 hover:bg-surface-800/10">
                      <div className="flex items-center gap-2">
                        <Chk state={prodState(catId, prodId)} onChange={() => toggleProd(catId, prodId)} />
                        <div className="flex items-center gap-1 cursor-pointer min-w-0" onClick={() => setExpProds(p => ({ ...p, [`${catId}-${prodId}`]: !prodOpen }))}>
                          {prodOpen ? <ChevronDown size={11} className="text-surface-600 shrink-0" /> : <ChevronRight size={11} className="text-surface-600 shrink-0" />}
                          <span className="text-sm font-medium text-white truncate">{prodName}</span>
                        </div>
                      </div>
                      <div /><div className="text-center text-xs font-mono text-rose-400 font-bold self-center">{prodQty}</div><div /><div />
                    </div>
                    {prodOpen && its.map(item => {
                      const label = skuLabel(item.sku)
                      const qty = item.retQty
                      const afterStock = isDisposal ? item.currentStock - qty : item.currentStock + qty
                      return (
                        <div key={item.sku.id} className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-0 pl-12 pr-3 py-2 border-t border-surface-800/20 hover:bg-surface-800/5 items-center">
                          <div className="flex items-center gap-2">
                            <Chk state={!!checked[item.sku.id]} onChange={() => setChecked(p => ({ ...p, [item.sku.id]: !p[item.sku.id] }))} />
                            <span className="text-xs text-surface-300">{label}</span>
                          </div>
                          <div className="text-center text-xs font-mono text-surface-400">{item.currentStock}</div>
                          <div className="px-1">
                            <input type="number" min="0" value={qty}
                              onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
                              onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0; onUpdateQty(item.sku.id, v) }}
                              className="w-full text-center bg-surface-800 border border-rose-500/40 rounded-lg px-1 py-1 text-xs text-white font-mono focus:outline-none focus:border-rose-500" />
                          </div>
                          <div className={'text-center text-xs font-mono font-bold ' + (afterStock < 0 ? 'text-red-400' : 'text-emerald-400')}>{afterStock}</div>
                          <button onClick={() => onDeleteItems([item.sku.id])} className="p-1 hover:bg-red-500/10 text-surface-600 hover:text-red-400 rounded transition-colors">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {items.length > 0 && (
        <div className="flex justify-end text-xs text-surface-500 px-1">
          <span>총 수량: <span className="text-rose-400 font-bold font-mono">{items.reduce((s, it) => s + it.retQty, 0)}</span></span>
        </div>
      )}
    </div>
  )
}

// ── 반품 정보 폼 ──────────────────────────────────────────
function ReturnInfoForm({ values, onChange, sources }) {
  return (
    <div className="grid grid-cols-2 gap-3">

      <div className="col-span-2">
        <label className="text-xs text-surface-400 mb-1 block">반품처 <span className="text-red-400">*</span></label>
        <select value={values.sourceId || ''} onChange={e => onChange('sourceId', e.target.value)}
          className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500">
          <option value="">반품처 선택...</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* 폐기 옵션 */}
      <div className="col-span-2 bg-surface-800/40 border border-surface-700/60 rounded-xl p-3 space-y-2">
        <p className="text-xs text-surface-400 font-medium mb-2">처리 방식 (선택사항)</p>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input type="checkbox" checked={values.disposalType === 'return_disposal'} onChange={e => onChange('disposalType', e.target.checked ? 'return_disposal' : null)}
            className="w-4 h-4 accent-orange-500 cursor-pointer shrink-0" />
          <span className="text-sm text-surface-300 group-hover:text-white transition-colors">반품 상품 폐기</span>
          <Tip text="반품된 상품을 폐기합니다. 재고와 재고이력은 변동없이, 반품이력과 폐기이력에만 기록됩니다." />
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input type="checkbox" checked={values.disposalType === 'existing_disposal'} onChange={e => onChange('disposalType', e.target.checked ? 'existing_disposal' : null)}
            className="w-4 h-4 accent-red-500 cursor-pointer shrink-0" />
          <span className="text-sm text-surface-300 group-hover:text-white transition-colors">기존 상품 폐기</span>
          <Tip text="창고에 보관 중인 기존 재고를 폐기합니다. 재고에서 1개씩 차감(-1)되며, 재고이력에 '기존상품폐기'로 기록됩니다." />
        </label>
        {values.disposalType === 'existing_disposal' && (
          <p className="text-xs text-orange-400 flex items-center gap-1.5 mt-1">
            <AlertTriangle size={11} /> 기존상품폐기: 각 옵션 재고에서 반품수량만큼 차감됩니다
          </p>
        )}
      </div>

      <div>
        <label className="text-xs text-surface-400 mb-1 block">반품일자</label>
        <input type="date" value={values.returnDate} onChange={e => onChange('returnDate', e.target.value)}
          className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500" />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1 block">고객명</label>
        <input type="text" value={values.customerName || ''} onChange={e => onChange('customerName', e.target.value)}
          placeholder="고객명 (선택)" className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-rose-500" />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1 block">택배비 (원)</label>
        <input type="number" min="0" value={values.shippingCost || ''} onChange={e => onChange('shippingCost', e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="0" className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-rose-500" />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1 block">메모</label>
        <input type="text" value={values.note || ''} onChange={e => onChange('note', e.target.value)}
          placeholder="메모 (선택)" className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-rose-500" />
      </div>
    </div>
  )
}

// ── 반품 저장 공통 로직 ───────────────────────────────────
async function performReturnSave({ user, items, info, orderId = null }) {
  const validItems = items.filter(it => it.retQty > 0)
  if (!info.sourceId) { toast.error('반품처를 선택하세요'); return false }
  if (!validItems.length) { toast.error('반품수량을 1 이상 입력하세요'); return false }

  const orderNumber = orderId ? null : 'RET-' + Date.now().toString(36).toUpperCase()
  const totalQty = validItems.reduce((s, it) => s + it.retQty, 0)
  const disposalType = info.disposalType || null

  let order
  if (orderId) {
    const { error } = await supabase.from('return_orders').update({
      return_source_id: info.sourceId,
      return_date: info.returnDate, customer_name: info.customerName?.trim() || null,
      shipping_cost: info.shippingCost ? parseInt(info.shippingCost) : null,
      note: info.note?.trim() || null, total_quantity: totalQty,
      disposal_type: disposalType, updated_at: new Date().toISOString()
    }).eq('id', orderId)
    if (error) throw error
    await supabase.from('return_items').delete().eq('return_order_id', orderId)
    await supabase.from('disposal_logs').delete().eq('return_order_id', orderId)
    order = { id: orderId, order_number: info.orderNumber || '' }
  } else {
    const { data, error } = await supabase.from('return_orders').insert({
      order_number: orderNumber,
      return_source_id: info.sourceId, return_date: info.returnDate,
      customer_name: info.customerName?.trim() || null,
      shipping_cost: info.shippingCost ? parseInt(info.shippingCost) : null,
      note: info.note?.trim() || null, total_quantity: totalQty,
      disposal_type: disposalType, created_by: user.id
    }).select().single()
    if (error) throw error
    order = data
  }

  for (const item of validItems) {
    await supabase.from('return_items').insert({ return_order_id: order.id, product_sku_id: item.sku.id, quantity: item.retQty, final_stock: item.finalStock })

    if (disposalType === 'return_disposal') {
      // 재고/재고이력 변동 없음 - 폐기이력만 추가
      await supabase.from('disposal_logs').insert({ return_order_id: order.id, product_sku_id: item.sku.id, quantity: item.retQty, disposal_type: 'return_disposal', note: `반품상품폐기 ${order.order_number || orderId}`, created_by: user.id })
    } else if (disposalType === 'existing_disposal') {
      // 재고 -1 (각 옵션마다)
      const { data: freshSku } = await supabase.from('product_skus').select('stock').eq('id', item.sku.id).single()
      const curStock = freshSku?.stock || 0
      const newStock = curStock - item.retQty
      await supabase.from('product_skus').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', item.sku.id)
      await supabase.from('stock_logs').insert({ product_sku_id: item.sku.id, change_type: 'return', quantity_before: curStock, quantity_change: -item.retQty, quantity_after: newStock, option_label: skuLabel(item.sku), user_name: user?.email || '', created_by: user.id, note: '기존상품폐기 ' + (order.order_number || orderId) })
      await supabase.from('disposal_logs').insert({ return_order_id: order.id, product_sku_id: item.sku.id, quantity: item.retQty, disposal_type: 'existing_disposal', note: `기존상품폐기 ${order.order_number || orderId}`, created_by: user.id })
    } else {
      // 일반 반품: 재고 증가
      const { data: freshSku } = await supabase.from('product_skus').select('stock').eq('id', item.sku.id).single()
      const curStock = freshSku?.stock || 0
      const newStock = curStock + item.retQty
      await supabase.from('product_skus').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', item.sku.id)
      await supabase.from('stock_logs').insert({ product_sku_id: item.sku.id, change_type: 'return', quantity_before: curStock, quantity_change: item.retQty, quantity_after: newStock, option_label: skuLabel(item.sku), user_name: user?.email || '', created_by: user.id, note: '반품 ' + (order.order_number || orderId) })
    }
  }
  return order.order_number || orderId
}

// ── 신규 반품 ─────────────────────────────────────────────
function NewReturn({ categories, products, skusByProduct, sources, onDone }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [info, setInfo] = useState({ sourceId: '', returnDate: new Date().toISOString().slice(0, 10), customerName: '', shippingCost: '', note: '', disposalType: null })
  const [saving, setSaving] = useState(false)

  const existingSkuIds = useMemo(() => new Set(items.map(it => it.sku.id)), [items])
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const productMap = Object.fromEntries(products.map(p => [p.id, p.name]))

  function addItems(newItems) {
    const toAdd = newItems.filter(ni => !existingSkuIds.has(ni.sku.id))
    if (toAdd.length) setItems(p => [...p, ...toAdd])
  }
  function updateQty(skuId, qty) { setItems(p => p.map(it => it.sku.id === skuId ? { ...it, retQty: qty, finalStock: it.currentStock + qty } : it)) }
  function deleteItems(skuIds) { const s = new Set(skuIds); setItems(p => p.filter(it => !s.has(it.sku.id))) }

  async function save() {
    setSaving(true)
    try {
      const result = await performReturnSave({ user, items, info })
      if (result) { toast.success('반품 완료! ' + result); onDone() }
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const isDisposal = info.disposalType === 'existing_disposal'

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">상품 선택</h3>
        <ProductTreeSelector categories={categories} products={products} skusByProduct={skusByProduct} existingSkuIds={existingSkuIds} onAddItems={addItems} />
      </div>
      <div className="space-y-4">
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">반품 목록</h3>
          <ReturnItemsTree items={items} onUpdateQty={updateQty} onDeleteItems={deleteItems} categoryMap={categoryMap} productMap={productMap} isDisposal={isDisposal} />
        </div>
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">반품 정보</h3>
          <ReturnInfoForm values={info} onChange={(k, v) => {
            if (k === 'disposalType') {
              setInfo(p => ({ ...p, disposalType: p.disposalType === v ? null : v }))
            } else {
              setInfo(p => ({ ...p, [k]: v }))
            }
          }} sources={sources} />
        </div>
        <button onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-2xl font-semibold transition-colors">
          <Save size={16} />{saving ? '저장 중...' : '반품 저장'}
        </button>
      </div>
    </div>
  )
}

// ── 기존 반품 수정 (SalesRecordsPage 스타일) ──────────────
function EditReturn({ categories, products, skusByProduct, sources, onDone }) {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  // Tree expansion state
  const [expandedMonths, setExpandedMonths] = useState({})
  const [expandedDates, setExpandedDates] = useState({})
  const [expandedProds, setExpandedProds] = useState({})
  const [checkedOrders, setCheckedOrders] = useState({})  // orderId -> bool
  // Edit panel state
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [info, setInfo] = useState({ sourceId: '', returnDate: '', customerName: '', shippingCost: '', note: '', disposalType: null, orderNumber: '' })
  const [saving, setSaving] = useState(false)
  const [addingProduct, setAddingProduct] = useState(false)
  const [deleting, setDeleting] = useState(new Set())
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase.from('return_orders')
      .select('id, order_number, return_date, total_quantity, return_source_id, customer_name, shipping_cost, note, disposal_type, created_at, return_sources(name), return_items(quantity, product_sku_id, product_skus(products(id, name), o1:option1_id(option_value), o2:option2_id(option_value)))')
      .order('return_date', { ascending: false }).order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function selectOrder(order) {
    setSelectedOrder(order)
    setInfo({ sourceId: order.return_source_id || '', returnDate: order.return_date || '', customerName: order.customer_name || '', shippingCost: order.shipping_cost ? String(order.shipping_cost) : '', note: order.note || '', disposalType: order.disposal_type || null, orderNumber: order.order_number })
    setLoadingItems(true); setAddingProduct(false)
    const { data } = await supabase.from('return_items')
      .select('id, quantity, final_stock, product_sku_id, product_skus(stock, products(id, name, category_id), o1:option1_id(option_name, option_value, sort_order), o2:option2_id(option_name, option_value, sort_order))')
      .eq('return_order_id', order.id)
    setOrderItems((data || []).map(it => ({
      id: it.id, product: it.product_skus?.products || {},
      catId: it.product_skus?.products?.category_id || '__none__',
      sku: { id: it.product_sku_id, stock: it.product_skus?.stock || 0, o1: it.product_skus?.o1, o2: it.product_skus?.o2 },
      currentStock: it.product_skus?.stock || 0, retQty: it.quantity || 0, finalStock: it.final_stock || 0
    })))
    setLoadingItems(false)
  }

  const existingSkuIds = useMemo(() => new Set(orderItems.map(it => it.sku.id)), [orderItems])
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const productMap = Object.fromEntries(products.map(p => [p.id, p.name]))

  function addItems(newItems) {
    const toAdd = newItems.filter(ni => !existingSkuIds.has(ni.sku.id))
    if (toAdd.length) setOrderItems(p => [...p, ...toAdd])
  }
  function updateQty(skuId, qty) { setOrderItems(p => p.map(it => it.sku.id === skuId ? { ...it, retQty: qty, finalStock: it.currentStock + qty } : it)) }
  function deleteItems(skuIds) { const s = new Set(skuIds); setOrderItems(p => p.filter(it => !s.has(it.sku.id))) }

  async function saveOrder() {
    if (!selectedOrder) return
    setSaving(true)
    try {
      const result = await performReturnSave({ user, items: orderItems, info, orderId: selectedOrder.id })
      if (result) { toast.success('수정 완료'); loadOrders(); setAddingProduct(false) }
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function deleteOrder(id) {
    if (!confirm('반품을 삭제하시겠습니까?')) return
    setDeleting(p => new Set([...p, id]))
    try {
      const { data: its } = await supabase.from('return_items').select('product_sku_id, quantity').eq('return_order_id', id)
      const { data: orderData } = await supabase.from('return_orders').select('disposal_type').eq('id', id).single()
      for (const it of (its || [])) {
        if (!orderData?.disposal_type || orderData.disposal_type === 'existing_disposal') {
          const { data: sku } = await supabase.from('product_skus').select('stock').eq('id', it.product_sku_id).single()
          const adj = orderData?.disposal_type === 'existing_disposal' ? it.quantity : -it.quantity
          await supabase.from('product_skus').update({ stock: (sku?.stock || 0) + adj }).eq('id', it.product_sku_id)
        }
      }
      await supabase.from('return_items').delete().eq('return_order_id', id)
      await supabase.from('disposal_logs').delete().eq('return_order_id', id)
      await supabase.from('return_orders').delete().eq('id', id)
      if (selectedOrder?.id === id) { setSelectedOrder(null); setOrderItems([]) }
      toast.success('삭제 완료'); loadOrders()
    } catch (err) { toast.error(err.message) }
    finally { setDeleting(p => { const n = new Set(p); n.delete(id); return n }) }
  }

  async function deleteMultiple(ids) {
    if (!ids.length || !confirm(`${ids.length}개 반품을 삭제하시겠습니까?`)) return
    for (const id of ids) await deleteOrder(id)
    setCheckedOrders({})
  }

  // Build tree: month -> date -> order (1 order per date)
  const filtered = useMemo(() => {
    if (!searchQ.trim()) return orders
    const q = searchQ.toLowerCase()
    return orders.filter(o => (o.order_number || '').toLowerCase().includes(q) || (o.return_sources?.name || '').toLowerCase().includes(q))
  }, [orders, searchQ])

  const tree = useMemo(() => {
    const months = {}
    filtered.forEach(order => {
      const month = (order.return_date || order.created_at?.slice(0,10) || '').slice(0, 7)
      const date = order.return_date || order.created_at?.slice(0,10) || ''
      if (!months[month]) months[month] = {}
      months[month][date] = order  // one order per date
    })
    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const checkedIds = Object.keys(checkedOrders).filter(id => checkedOrders[id])

  function chkState(ids) {
    const n = ids.filter(id => checkedOrders[id]).length
    return n === 0 ? false : n === ids.length ? true : 'partial'
  }
  function toggleAll(ids) {
    const allOn = ids.every(id => checkedOrders[id])
    setCheckedOrders(p => { const n = { ...p }; ids.forEach(id => { n[id] = !allOn }); return n })
  }

  const isDisposal = info.disposalType === 'existing_disposal'

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-5">
      {/* 왼쪽: 트리 리스트 */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="반품번호, 반품처 검색..."
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-rose-500" />
          </div>
          {checkedIds.length > 0 && (
            <button onClick={() => deleteMultiple(checkedIds)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-xl text-xs font-medium transition-colors whitespace-nowrap">
              <Trash2 size={12} /> {checkedIds.length}개 삭제
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
            {tree.length === 0 ? (
              <p className="text-center py-8 text-surface-500 text-sm">반품 내역이 없습니다</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {tree.map(([month, dates]) => {
                    const [y, m] = month.split('-')
                    const monthOpen = expandedMonths[month] ?? false
                    const monthOrderIds = Object.values(dates).map(o => o.id)
                    const monthQty = Object.values(dates).reduce((s, o) => s + (o.total_quantity || 0), 0)
                    return [
                      // 월 행
                      <tr key={`m-${month}`} className="bg-surface-800/60 border-b border-surface-700/40 hover:bg-surface-800 transition-colors cursor-pointer">
                        <td className="px-2 py-2.5 w-8" onClick={e => e.stopPropagation()}>
                          <Chk state={chkState(monthOrderIds)} onChange={() => toggleAll(monthOrderIds)} />
                        </td>
                        <td className="px-2 py-2.5" onClick={() => setExpandedMonths(p => ({ ...p, [month]: !monthOpen }))}>
                          <div className="flex items-center gap-2">
                            {monthOpen ? <ChevronDown size={13} className="text-surface-500" /> : <ChevronRight size={13} className="text-surface-500" />}
                            <span className="text-sm font-bold text-surface-200">{y}년 {parseInt(m)}월</span>
                            <span className="text-xs text-surface-600">({Object.keys(dates).length}건)</span>
                            <span className="text-xs font-mono text-rose-400 ml-auto">{monthQty}개</span>
                          </div>
                        </td>
                        <td className="w-16" />
                      </tr>,
                      // 날짜+반품 행
                      ...(!monthOpen ? [] : Object.entries(dates).sort((a, b) => b[0].localeCompare(a[0])).flatMap(([date, order]) => {
                        const dateOpen = expandedDates[date] ?? false
                        const [,, dd] = date.split('-')
                        const items = order.return_items || []
                        // Group items by product
                        const prodMap = {}
                        items.forEach(it => {
                          const pn = it.product_skus?.products?.name || '상품'
                          if (!prodMap[pn]) prodMap[pn] = []
                          prodMap[pn].push(it)
                        })
                        return [
                          // 날짜 행
                          <tr key={`d-${date}`} className={"border-b border-surface-800/30 hover:bg-surface-800/20 transition-colors cursor-pointer " + (selectedOrder?.id === order.id ? 'bg-rose-500/8 border-l-2 border-l-rose-500' : '')}>
                            <td className="px-2 py-2.5 w-8" onClick={e => e.stopPropagation()}>
                              <Chk state={!!checkedOrders[order.id]} onChange={() => setCheckedOrders(p => ({ ...p, [order.id]: !p[order.id] }))} />
                            </td>
                            <td className="px-2 py-2.5 pl-6" onClick={() => setExpandedDates(p => ({ ...p, [date]: !dateOpen }))}>
                              <div className="flex items-center gap-2">
                                {dateOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
                                <span className="text-sm font-semibold text-white">{parseInt(m)}월 {parseInt(dd)}일</span>
                                {order.return_sources?.name && <span className="text-xs text-surface-500">· {order.return_sources.name}</span>}
                                {order.disposal_type && <span className={'text-[10px] px-1.5 py-0.5 rounded-full ' + (order.disposal_type === 'return_disposal' ? 'bg-orange-500/15 text-orange-400' : 'bg-red-500/15 text-red-400')}>{order.disposal_type === 'return_disposal' ? '반품폐기' : '기존폐기'}</span>}
                              </div>
                              <div className="text-xs text-surface-600 ml-6 mt-0.5">{order.order_number}</div>
                            </td>
                            <td className="px-2 py-2.5 text-right pr-3">
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-xs font-mono text-rose-400 font-bold">{order.total_quantity}개</span>
                                <button onClick={e => { e.stopPropagation(); selectOrder(order) }}
                                  className="flex items-center gap-1 px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                                  <Pencil size={10} /> 편집
                                </button>
                                <button onClick={e => { e.stopPropagation(); deleteOrder(order.id) }} disabled={deleting.has(order.id)}
                                  className="p-1 hover:bg-red-500/10 text-surface-600 hover:text-red-400 rounded transition-colors">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>,
                          // 상품 행 (열린 경우)
                          ...(!dateOpen ? [] : Object.entries(prodMap).flatMap(([prodName, pitems]) => {
                            const prodKey = `${date}-${prodName}`
                            const prodOpen = expandedProds[prodKey] ?? false
                            const prodQty = pitems.reduce((s, it) => s + (it.quantity || 0), 0)
                            return [
                              <tr key={`p-${prodKey}`} className="border-b border-surface-800/20 hover:bg-surface-800/10 cursor-pointer" onClick={() => setExpandedProds(p => ({ ...p, [prodKey]: !prodOpen }))}>
                                <td />
                                <td className="px-2 py-1.5 pl-10">
                                  <div className="flex items-center gap-2">
                                    {prodOpen ? <ChevronDown size={11} className="text-surface-500" /> : <ChevronRight size={11} className="text-surface-500" />}
                                    <span className="text-xs font-medium text-white">{prodName}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-right pr-3 text-xs font-mono text-surface-400">{prodQty}</td>
                              </tr>,
                              ...(!prodOpen ? [] : pitems.map(it => {
                                const opt = [it.product_skus?.o1?.option_value, it.product_skus?.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
                                return (
                                  <tr key={`i-${it.product_sku_id}`} className="border-b border-surface-800/10 hover:bg-surface-800/5">
                                    <td />
                                    <td className="px-2 py-1.5 pl-16">
                                      <div className="flex items-center gap-1.5 text-xs text-surface-400">
                                        <span className="w-1 h-1 rounded-full bg-surface-700 shrink-0" />
                                        {opt}
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-right pr-3 text-xs font-mono text-white font-bold">{it.quantity}</td>
                                  </tr>
                                )
                              }))
                            ]
                          }))
                        ]
                      }))
                    ]
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* 오른쪽: 편집 패널 */}
      {!selectedOrder ? (
        <div className="flex items-center justify-center bg-surface-900 border border-surface-800 rounded-2xl text-surface-500 min-h-48">
          <div className="text-center"><RotateCcw size={32} className="mx-auto mb-2 opacity-20" /><p className="text-sm">왼쪽 목록에서 편집 버튼을 클릭하세요</p></div>
        </div>
      ) : (
        <div className="space-y-4">
          {addingProduct ? (
            <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">상품 추가</h3>
                <button onClick={() => setAddingProduct(false)} className="text-surface-400 hover:text-white"><X size={16} /></button>
              </div>
              <ProductTreeSelector categories={categories} products={products} skusByProduct={skusByProduct} existingSkuIds={existingSkuIds} onAddItems={addItems} />
            </div>
          ) : (
            <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">반품 목록</h3>
                  <p className="text-xs text-surface-500">{selectedOrder.order_number}</p>
                </div>
                <button onClick={() => setAddingProduct(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-xl text-xs font-medium transition-colors">
                  <Plus size={12} /> 상품 추가
                </button>
              </div>
              {loadingItems ? (
                <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <ReturnItemsTree items={orderItems} onUpdateQty={updateQty} onDeleteItems={deleteItems} categoryMap={categoryMap} productMap={productMap} isDisposal={isDisposal} />
              )}
            </div>
          )}
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">반품 정보</h3>
            <ReturnInfoForm values={info} onChange={(k, v) => {
              if (k === 'disposalType') setInfo(p => ({ ...p, disposalType: p.disposalType === v ? null : v }))
              else setInfo(p => ({ ...p, [k]: v }))
            }} sources={sources} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSelectedOrder(null)} className="px-4 py-3 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-2xl text-sm font-medium">
              취소
            </button>
            <button onClick={saveOrder} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-2xl font-semibold transition-colors">
              <Save size={16} />{saving ? '저장 중...' : '반품 수정 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 반품 이력 ──────────────────────────────────────────────
function ReturnHistory() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))
  const [expandedMonths, setExpandedMonths] = useState({})
  const [expandedDates, setExpandedDates] = useState({})
  const [expandedProds, setExpandedProds] = useState({})

  const years = useMemo(() => {
    const y = new Date().getFullYear()
    return [y, y-1, y-2, y-3].map(String)
  }, [])

  useEffect(() => { load() }, [yearFilter])

  async function load() {
    setLoading(true)
    let q = supabase.from('return_orders')
      .select('id, order_number, return_date, total_quantity, disposal_type, customer_name, return_sources(name), return_items(quantity, product_sku_id, product_skus(products(id, name), o1:option1_id(option_value), o2:option2_id(option_value)))')
      .order('return_date', { ascending: false }).order('created_at', { ascending: false })
    if (yearFilter) q = q.gte('return_date', `${yearFilter}-01-01`).lte('return_date', `${yearFilter}-12-31`)
    const { data } = await q
    setRecords(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    if (!searchQ.trim()) return records
    const q = searchQ.toLowerCase()
    return records.filter(r =>
      (r.order_number || '').toLowerCase().includes(q) ||
      (r.return_sources?.name || '').toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q)
    )
  }, [records, searchQ])

  const tree = useMemo(() => {
    const months = {}
    filtered.forEach(order => {
      const month = (order.return_date || '').slice(0, 7)
      const date = order.return_date || ''
      if (!months[month]) months[month] = {}
      months[month][date] = order
    })
    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const DISPOSAL_BADGE = {
    return_disposal: <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400">반품폐기</span>,
    existing_disposal: <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">기존폐기</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 shrink-0">
          <option value="">전체</option>
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="반품번호, 반품처, 고객명 검색..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-rose-500" />
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : tree.length === 0 ? (
        <div className="text-center py-16 text-surface-500"><RotateCcw size={36} className="mx-auto mb-2 opacity-20" /><p className="text-sm">반품 이력이 없습니다</p></div>
      ) : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-800/60 border-b border-surface-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">항목</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase w-20">수량</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-surface-400 uppercase w-28">반품처</th>
              </tr>
            </thead>
            <tbody>
              {tree.map(([month, dates]) => {
                const [y, m] = month.split('-')
                const monthOpen = expandedMonths[month] ?? false
                const monthQty = Object.values(dates).reduce((s, o) => s + (o.total_quantity || 0), 0)
                return [
                  <tr key={`m-${month}`} className="bg-surface-800/50 border-b border-surface-700/60 cursor-pointer hover:bg-surface-800 transition-colors"
                    onClick={() => setExpandedMonths(p => ({ ...p, [month]: !monthOpen }))}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {monthOpen ? <ChevronDown size={13} className="text-surface-500" /> : <ChevronRight size={13} className="text-surface-500" />}
                        <span className="text-sm font-bold text-surface-200">{y}년 {parseInt(m)}월</span>
                        <span className="text-xs text-surface-600">({Object.keys(dates).length}건)</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-rose-400 text-sm">{monthQty}</td>
                    <td />
                  </tr>,
                  ...(!monthOpen ? [] : Object.entries(dates).sort((a, b) => b[0].localeCompare(a[0])).flatMap(([date, order]) => {
                    const [,, dd] = date.split('-')
                    const dateOpen = expandedDates[date] ?? false
                    const items = order.return_items || []
                    const prodMap = {}
                    items.forEach(it => {
                      const pn = it.product_skus?.products?.name || '상품'
                      if (!prodMap[pn]) prodMap[pn] = []
                      prodMap[pn].push(it)
                    })
                    return [
                      <tr key={`d-${date}`} className="border-b border-surface-800/40 hover:bg-surface-800/20 cursor-pointer transition-colors"
                        onClick={() => setExpandedDates(p => ({ ...p, [date]: !dateOpen }))}>
                        <td className="px-4 py-2.5 pl-8">
                          <div className="flex items-center gap-2">
                            {dateOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
                            <span className="font-medium text-white text-sm">{parseInt(m)}월 {parseInt(dd)}일</span>
                            {order.customer_name && <span className="text-xs text-surface-500">· {order.customer_name}</span>}
                            {order.disposal_type && DISPOSAL_BADGE[order.disposal_type]}
                          </div>
                          <div className="text-xs text-surface-600 ml-6 mt-0.5">{order.order_number}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-rose-400 font-bold">{order.total_quantity}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-surface-500">{order.return_sources?.name || '-'}</td>
                      </tr>,
                      ...(!dateOpen ? [] : Object.entries(prodMap).flatMap(([prodName, pitems]) => {
                        const prodKey = `${date}-${prodName}`
                        const prodOpen = expandedProds[prodKey] ?? false
                        const prodQty = pitems.reduce((s, it) => s + (it.quantity || 0), 0)
                        return [
                          <tr key={`p-${prodKey}`} className="border-b border-surface-800/20 hover:bg-surface-800/10 cursor-pointer"
                            onClick={() => setExpandedProds(p => ({ ...p, [prodKey]: !prodOpen }))}>
                            <td className="px-4 py-2 pl-14">
                              <div className="flex items-center gap-2">
                                {prodOpen ? <ChevronDown size={11} className="text-surface-500" /> : <ChevronRight size={11} className="text-surface-500" />}
                                <span className="text-xs font-medium text-white">{prodName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center font-mono text-surface-400 text-xs">{prodQty}</td>
                            <td />
                          </tr>,
                          ...(!prodOpen ? [] : pitems.map(it => {
                            const opt = [it.product_skus?.o1?.option_value, it.product_skus?.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
                            return (
                              <tr key={`i-${it.product_sku_id}`} className="border-b border-surface-800/10 hover:bg-surface-800/5">
                                <td className="px-4 py-1.5 pl-20">
                                  <div className="flex items-center gap-1.5 text-xs text-surface-400">
                                    <span className="w-1 h-1 rounded-full bg-surface-700 shrink-0" />
                                    {opt}
                                  </div>
                                </td>
                                <td className="px-4 py-1.5 text-center font-mono font-bold text-white text-sm">{it.quantity}</td>
                                <td />
                              </tr>
                            )
                          }))
                        ]
                      }))
                    ]
                  }))
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 반품 통계 ──────────────────────────────────────────────

// ── 메인 ─────────────────────────────────────────────────
const TABS = [
  { key: 'new', label: '신규 반품', icon: Plus },
  { key: 'edit', label: '기존 반품 수정', icon: Pencil },
  { key: 'history', label: '반품 이력', icon: ClipboardList },
  { key: 'sources', label: '반품처', icon: Building2 },
]

export default function ReturnsPage() {
  const [tab, setTab] = useState('new')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [skusByProduct, setSkusByProduct] = useState({})
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState(0)

  useEffect(() => { loadBase() }, [])

  async function loadBase() {
    setLoading(true)
    const [{ data: cats }, { data: prods }, { data: skus }, { data: srcs }] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
      supabase.from('products').select('id, name, category_id').eq('is_active', true).order('sort_order'),
      supabase.from('product_skus').select('id, stock, product_id, o1:option1_id(option_name, option_value, sort_order), o2:option2_id(option_name, option_value, sort_order)').eq('is_active', true),
      supabase.from('return_sources').select('*').order('name')
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    const sbp = {}
    ;(skus || []).forEach(s => { if (!sbp[s.product_id]) sbp[s.product_id] = []; sbp[s.product_id].push(s) })
    setSkusByProduct(sbp)
    setSources(srcs || [])
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5 max-w-6xl">
      <div><h1 className="text-2xl font-bold text-white">반품 관리</h1><p className="text-surface-400 text-sm mt-0.5">반품 처리 및 이력 관리</p></div>
      <div className="flex gap-2 flex-wrap border-b border-surface-800 pb-0">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ' +
                (tab === t.key ? 'border-rose-500 text-rose-400' : 'border-transparent text-surface-400 hover:text-white')}>
              <Icon size={14} />{t.label}
            </button>
          )
        })}
      </div>
      {tab === 'new' && <NewReturn key={newKey} categories={categories} products={products} skusByProduct={skusByProduct} sources={sources} onDone={() => { setNewKey(k => k + 1); loadBase() }} />}
      {tab === 'edit' && <EditReturn categories={categories} products={products} skusByProduct={skusByProduct} sources={sources} onDone={loadBase} />}
      {tab === 'history' && <ReturnHistory />}
      {tab === 'sources' && <ReturnSourcesPage embedded onDone={loadBase} />}
    </div>
  )
}
