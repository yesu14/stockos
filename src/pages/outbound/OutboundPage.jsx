import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  PackageMinus, Package, Search, ChevronDown, ChevronRight,
  Truck, X, Trash2, Plus, Save, Pencil, Building2, Download, RefreshCw
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import ExcelJS from 'exceljs'
import toast from 'react-hot-toast'
import SuppliersPage from '../suppliers/SuppliersPage'

function skuLabel(sku) {
  return [sku?.o1?.option_value, sku?.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
}
function fmtMoney(n) {
  const v = Number(n || 0)
  if (v >= 1000000) return `₩${(v/1000000).toFixed(1)}M`
  if (v >= 1000) return `₩${(v/1000).toFixed(0)}K`
  return `₩${v}`
}

// ── 체크박스 ──────────────────────────────────────────────
function Chk({ state, onChange, className = '' }) {
  const ref = el => { if (el) el.indeterminate = state === 'partial' }
  return <input type="checkbox" ref={ref} checked={state === true || state === 'partial'} onChange={onChange}
    className={'w-4 h-4 accent-orange-500 cursor-pointer shrink-0 ' + className} />
}

// ── 일괄 수량 설정 바 ────────────────────────────────────
function BulkQtyBar({ items, onUpdateQty }) {
  const [bulkQty, setBulkQty] = useState('')
  function apply() {
    const qty = parseInt(bulkQty)
    if (!qty || qty <= 0) return toast.error('수량을 1 이상 입력하세요')
    items.forEach(it => onUpdateQty(it.sku.id, qty))
    toast.success(`전체 ${items.length}개 항목에 ${qty} 적용됨`)
    setBulkQty('')
  }
  return (
    <div className="flex items-center gap-2 p-2.5 bg-orange-500/8 border border-orange-500/20 rounded-xl flex-wrap">
      <span className="text-xs text-orange-400 shrink-0 font-semibold">📦 일괄 수량 설정</span>
      <input type="number" min="1" value={bulkQty}
        onChange={e => setBulkQty(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={e => e.key === 'Enter' && apply()}
        placeholder="수량 입력"
        className="w-28 bg-surface-700 border border-orange-500/40 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-orange-500" />
      <button onClick={apply}
        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors">
        전체 적용
      </button>
      <span className="text-xs text-surface-500 ml-auto">{items.length}개 항목</span>
    </div>
  )
}

// ── StockGrid 모달 ────────────────────────────────────────
function StockGrid({ skus, values, onChange, bulkValue, onBulkChange, onBulkApply }) {
  const opt1Vals = useMemo(() => {
    const seen = new Map()
    skus.forEach(s => { if (s.o1 && !seen.has(s.o1.option_value)) seen.set(s.o1.option_value, s.o1) })
    if (seen.size === 0) skus.forEach(() => seen.set('Default', { option_value: 'Default' }))
    return [...seen.values()].sort((a, b) => (a.sort_order||0)-(b.sort_order||0))
  }, [skus])
  const opt2Vals = useMemo(() => {
    const seen = new Map()
    skus.forEach(s => { if (s.o2) seen.set(s.o2.option_value, s.o2) })
    return [...seen.values()].sort((a, b) => (a.sort_order||0)-(b.sort_order||0))
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
        <input type="number" min="0" value={bulkValue} onChange={e => onBulkChange(e.target.value.replace(/[^0-9]/g, ''))} placeholder="수량"
          className="w-28 bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-orange-500" />
        <button onClick={onBulkApply} className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">전체 적용</button>
      </div>
      <div className="rounded-xl border border-surface-700" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table className="border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-800">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-400 border-b border-surface-700 sticky left-0 bg-surface-800 min-w-28 z-20">
                {hasOpt2 ? `${opt1Vals[0]?.option_name||'옵션1'} \\ ${opt2Vals[0]?.option_name||'옵션2'}` : (opt1Vals[0]?.option_name||'옵션')}
              </th>
              {hasOpt2
                ? opt2Vals.map(v2 => <th key={v2.option_value} className="px-3 py-2.5 text-center text-xs font-semibold text-surface-300 border-b border-surface-700 min-w-28">{v2.option_value}</th>)
                : <th className="px-3 py-2.5 text-center text-xs font-semibold text-surface-400 border-b border-surface-700 min-w-28">납품수량</th>
              }
            </tr>
          </thead>
          <tbody>
            {opt1Vals.map(v1 => (
              <tr key={v1.option_value} className="border-b border-surface-700/40 last:border-0 hover:bg-surface-800/20">
                <td className="px-3 py-2.5 text-sm font-medium text-surface-200 sticky left-0 bg-surface-900 border-r border-surface-700/40">{v1.option_value}</td>
                {hasOpt2
                  ? opt2Vals.map(v2 => {
                    const sku = getSku(v1.option_value, v2.option_value)
                    if (!sku) return <td key={v2.option_value} className="px-3 py-2.5 text-center text-surface-600 text-xs">-</td>
                    const val = values[sku.id] ?? ''
                    return (
                      <td key={v2.option_value} className="px-2 py-2">
                        <div className="text-center text-xs text-surface-500 mb-1">재고 {sku.stock}</div>
                        <input type="number" min="0" value={val} onChange={e => onChange(sku.id, e.target.value.replace(/[^0-9]/g, ''))} placeholder="0"
                          className={'w-full text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none ' + (val > 0 ? 'border-orange-500 bg-orange-500/10' : 'border-surface-700')} />
                      </td>)
                  })
                  : (() => {
                    const sku = getSku(v1.option_value, null)
                    if (!sku) return <td className="px-3 py-2.5 text-center text-surface-600">-</td>
                    const val = values[sku.id] ?? ''
                    return (
                      <td key="single" className="px-2 py-2">
                        <div className="text-center text-xs text-surface-500 mb-1">재고 {sku.stock}</div>
                        <input type="number" min="0" value={val} onChange={e => onChange(sku.id, e.target.value.replace(/[^0-9]/g, ''))} placeholder="0"
                          className={'w-full text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none ' + (val > 0 ? 'border-orange-500 bg-orange-500/10' : 'border-surface-700')} />
                      </td>)
                  })()
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 납품 목록 트리테이블 ──────────────────────────────────
function OutboundItemsTree({ items, onUpdateQty, onDeleteItems, categoryMap, productMap }) {
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
    const all = Object.values(tree[catId]||{}).flat()
    const n = all.filter(it => checked[it.sku.id]).length
    return n===0 ? false : n===all.length ? true : 'partial'
  }
  function prodState(catId, prodId) {
    const all = tree[catId]?.[prodId]||[]
    const n = all.filter(it => checked[it.sku.id]).length
    return n===0 ? false : n===all.length ? true : 'partial'
  }
  function toggleCat(catId) {
    const all = Object.values(tree[catId]||{}).flat()
    const allOn = all.every(it => checked[it.sku.id])
    const next = {...checked}; all.forEach(it => { next[it.sku.id] = !allOn }); setChecked(next)
  }
  function toggleProd(catId, prodId) {
    const all = tree[catId]?.[prodId]||[]
    const allOn = all.every(it => checked[it.sku.id])
    const next = {...checked}; all.forEach(it => { next[it.sku.id] = !allOn }); setChecked(next)
  }

  const selectedIds = Object.keys(checked).filter(id => checked[id])
  const allChecked = items.length > 0 && selectedIds.length === items.length

  function deleteSelected() {
    if (!selectedIds.length) return toast.error('삭제할 항목을 선택하세요')
    onDeleteItems(selectedIds); setChecked({})
  }
  function deleteCat(catId) {
    const ids = Object.values(tree[catId]||{}).flat().map(it => it.sku.id)
    onDeleteItems(ids); setChecked(p => { const n={...p}; ids.forEach(id => delete n[id]); return n })
  }
  function deleteProd(catId, prodId) {
    const ids = (tree[catId]?.[prodId]||[]).map(it => it.sku.id)
    onDeleteItems(ids); setChecked(p => { const n={...p}; ids.forEach(id => delete n[id]); return n })
  }

  if (!items.length) return (
    <div className="flex flex-col items-center justify-center py-10 text-surface-500 bg-surface-800/20 rounded-2xl border border-surface-800">
      <Package size={32} className="mb-2 opacity-30" /><p className="text-sm">왼쪽에서 상품을 추가하세요</p>
    </div>
  )

  return (
    <div className="space-y-2">
      <BulkQtyBar items={items} onUpdateQty={onUpdateQty} />
      <div className="flex items-center gap-2 flex-wrap">
        <Chk state={allChecked ? true : selectedIds.length > 0 ? 'partial' : false}
          onChange={() => { const next={}; if(!allChecked) items.forEach(it=>{next[it.sku.id]=true}); setChecked(next) }} />
        <span className="text-xs text-surface-400">{selectedIds.length > 0 ? `${selectedIds.length}개 선택됨` : '전체 선택'}</span>
        {selectedIds.length > 0 && (
          <button onClick={deleteSelected} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg text-xs font-medium transition-colors">
            <Trash2 size={11} /> 선택 삭제
          </button>
        )}
      </div>
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 border-b border-surface-800 text-xs text-surface-400 font-semibold">
          <div className="w-4" /><span className="flex-1">카테고리 / 상품 / 옵션</span>
          <span className="w-14 text-center">현재재고</span>
          <span className="w-24 text-center text-orange-400">납품수량 <span className="text-red-400">*</span></span>
          <span className="w-14 text-center text-emerald-400">납품후</span>
          <span className="w-6" />
        </div>
        {Object.entries(tree).map(([catId, prods]) => {
          const catName = catId==='__none__' ? '미분류' : (categoryMap[catId]||'카테고리')
          const catItems = Object.values(prods).flat()
          const catOpen = expCats[catId] ?? true
          return (
            <div key={catId} className="border-b border-surface-800 last:border-0">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                <Chk state={catState(catId)} onChange={() => toggleCat(catId)} />
                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpCats(p=>({...p,[catId]:!catOpen}))}>
                  {catOpen ? <ChevronDown size={14} className="text-surface-400"/> : <ChevronRight size={14} className="text-surface-400"/>}
                  <span className="font-semibold text-white text-sm">{catName}</span>
                  <span className="text-xs text-surface-500">({catItems.length}개)</span>
                </div>
                <button onClick={() => deleteCat(catId)} className="flex items-center gap-1 px-2 py-1 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                  <Trash2 size={11}/> 카테고리 삭제
                </button>
              </div>
              {catOpen && Object.entries(prods).map(([prodId, prodItems]) => {
                const prodName = productMap[prodId]||prodItems[0]?.product?.name||'상품'
                const prodOpen = expProds[`${catId}_${prodId}`] ?? true
                return (
                  <div key={prodId} className="border-t border-surface-800/50">
                    <div className="flex items-center gap-2 pl-6 pr-3 py-2 hover:bg-surface-800/10">
                      <Chk state={prodState(catId,prodId)} onChange={() => toggleProd(catId,prodId)} />
                      <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpProds(p=>({...p,[`${catId}_${prodId}`]:!prodOpen}))}>
                        {prodOpen ? <ChevronDown size={12} className="text-surface-500"/> : <ChevronRight size={12} className="text-surface-500"/>}
                        <span className="text-sm font-medium text-surface-200">{prodName}</span>
                        <span className="text-xs text-surface-600">({prodItems.length})</span>
                      </div>
                      <button onClick={() => deleteProd(catId,prodId)} className="flex items-center gap-1 px-2 py-1 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                        <Trash2 size={11}/> 상품 삭제
                      </button>
                    </div>
                    {prodOpen && prodItems.map(item => {
                      const qty = item.deductQty
                      const afterStock = item.currentStock - qty
                      const isZero = !qty || qty <= 0
                      return (
                        <div key={item.sku.id} className="flex items-center gap-2 pl-12 pr-3 py-2 border-t border-surface-800/20 hover:bg-surface-800/5">
                          <Chk state={!!checked[item.sku.id]} onChange={() => setChecked(p=>({...p,[item.sku.id]:!p[item.sku.id]}))} />
                          <span className="flex-1 text-xs text-surface-300">{skuLabel(item.sku)}</span>
                          <span className="w-14 text-center text-xs font-mono text-surface-400">{item.currentStock}</span>
                          <div className="w-24 relative">
                            <input type="number" min="0" value={qty}
                              onFocus={e => { if (e.target.value==='0') e.target.value='' }}
                              onChange={e => onUpdateQty(item.sku.id, parseInt(e.target.value.replace(/[^0-9]/g,''))||0)}
                              className={'w-full text-center bg-surface-800 border rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none ' + (isZero ? 'border-red-500/50 bg-red-500/5' : 'border-orange-500/40 focus:border-orange-500')} />
                            {isZero && <span className="absolute -top-3.5 left-0 text-[9px] text-red-400 whitespace-nowrap">필수</span>}
                          </div>
                          <span className={'w-14 text-center text-xs font-mono font-bold ' + (afterStock<0?'text-red-400':'text-emerald-400')}>{afterStock}</span>
                          <button onClick={() => { onDeleteItems([item.sku.id]); setChecked(p=>{const n={...p};delete n[item.sku.id];return n}) }}
                            className="w-6 flex items-center justify-center text-surface-600 hover:text-red-400 transition-colors">
                            <X size={13}/>
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
    </div>
  )
}

// ── 상품 선택 트리 ────────────────────────────────────────
function ProductTreeSelector({ categories, products, skusByProduct, existingSkuIds=new Set(), onAddItems }) {
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
  filteredProds.forEach(p => { const cid=p.category_id||'__none__'; if(!catMap[cid]) catMap[cid]=[]; catMap[cid].push(p) })

  function avail(prod) { return (skusByProduct[prod.id]||[]).filter(s => !existingSkuIds.has(s.id)) }
  function prodState(prod) { const skus=avail(prod); if(!skus.length) return false; const n=skus.filter(s=>checked[s.id]).length; return n===0?false:n===skus.length?true:'partial' }
  function catState(prods) { const skus=prods.flatMap(avail); if(!skus.length) return false; const n=skus.filter(s=>checked[s.id]).length; return n===0?false:n===skus.length?true:'partial' }
  function toggleSku(skuId) { if(existingSkuIds.has(skuId)){toast.error('이미 납품 목록에 있는 옵션입니다');return} setChecked(p=>({...p,[skuId]:!p[skuId]})) }
  function toggleProd(prod) { const skus=avail(prod); const allOn=skus.every(s=>checked[s.id]); const next={...checked}; skus.forEach(s=>{next[s.id]=!allOn}); setChecked(next) }
  function toggleCat(prods) { const skus=prods.flatMap(avail); const allOn=skus.every(s=>checked[s.id]); const next={...checked}; skus.forEach(s=>{next[s.id]=!allOn}); setChecked(next) }

  function addChecked() {
    const ids = Object.keys(checked).filter(id=>checked[id])
    if (!ids.length) return toast.error('체크박스로 옵션을 선택하세요')
    const items=[]
    ids.forEach(skuId => {
      const prod = products.find(p=>(skusByProduct[p.id]||[]).some(s=>s.id===skuId))
      const sku = (skusByProduct[prod?.id]||[]).find(s=>s.id===skuId)
      if(prod&&sku) items.push({product:prod,catId:prod.category_id||'__none__',sku,currentStock:sku.stock,deductQty:0,finalStock:sku.stock})
    })
    onAddItems(items); setChecked({}); toast.success(`${items.length}개 추가됨 (수량은 납품 목록에서 입력)`)
  }
  function openGrid(prod) { setActiveGrid({product:prod,skus:skusByProduct[prod.id]||[],hasOpt2:(skusByProduct[prod.id]||[]).some(s=>s.o2)}); setGridValues({}); setBulkVal('') }
  function handleGridAdd() {
    const items=(activeGrid?.skus||[]).filter(s=>{
      if(existingSkuIds.has(s.id)){toast.error(`'${skuLabel(s)}'는 이미 납품 목록에 있습니다`);return false}
      return (parseInt(gridValues[s.id])||0)>0
    }).map(s=>({product:activeGrid.product,catId:activeGrid.product.category_id||'__none__',sku:s,currentStock:s.stock,deductQty:parseInt(gridValues[s.id])||0,finalStock:s.stock-(parseInt(gridValues[s.id])||0)}))
    if(!items.length) return toast.error('0보다 큰 수량을 입력하세요')
    onAddItems(items); setActiveGrid(null); setGridValues({}); toast.success(`${items.length}개 추가됨`)
  }

  const selectedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="상품 검색..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-orange-500"/>
        </div>
        {selectedCount>0 && (
          <button onClick={addChecked} className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold transition-colors">
            <Plus size={12}/> {selectedCount}개 선택 추가
          </button>
        )}
      </div>
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden max-h-[65vh] overflow-y-auto">
        {Object.entries(catMap).map(([catId,prods]) => {
          if(!prods.length) return null
          const catName = catId==='__none__'?'미분류':(categories.find(c=>c.id===catId)?.name||'카테고리')
          const catOpen = expCats[catId] ?? false
          return (
            <div key={catId} className="border-b border-surface-800 last:border-0">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                <Chk state={catState(prods)} onChange={() => toggleCat(prods)}/>
                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpCats(p=>({...p,[catId]:!catOpen}))}>
                  {catOpen ? <ChevronDown size={14} className="text-surface-400"/> : <ChevronRight size={14} className="text-surface-400"/>}
                  <span className="font-semibold text-white text-sm">{catName}</span>
                  <span className="text-xs text-surface-500">({prods.length})</span>
                </div>
              </div>
              {catOpen && prods.map(prod => {
                const skus = skusByProduct[prod.id]||[]
                const prodOpen = expProds[prod.id] ?? false
                return (
                  <div key={prod.id} className="border-t border-surface-800/40">
                    <div className="flex items-center gap-2 pl-6 pr-3 py-2 hover:bg-surface-800/10">
                      <Chk state={prodState(prod)} onChange={() => toggleProd(prod)}/>
                      <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpProds(p=>({...p,[prod.id]:!prodOpen}))}>
                        {prodOpen ? <ChevronDown size={12} className="text-surface-500"/> : <ChevronRight size={12} className="text-surface-500"/>}
                        <span className="text-sm text-white">{prod.name}</span>
                        <span className="text-xs text-surface-600">({skus.length})</span>
                      </div>
                      <button onClick={() => openGrid(prod)} className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 rounded-lg text-xs font-medium transition-colors shrink-0">
                        <Plus size={11}/> 상세보기
                      </button>
                    </div>
                    {prodOpen && skus.map(sku => {
                      const alreadyIn = existingSkuIds.has(sku.id)
                      return (
                        <div key={sku.id} className={'flex items-center gap-2 pl-12 pr-3 py-1.5 border-t border-surface-800/20 '+(alreadyIn?'opacity-40':'')}>
                          <Chk state={alreadyIn?false:!!checked[sku.id]} onChange={() => toggleSku(sku.id)}/>
                          <span className="flex-1 text-xs text-surface-300">{skuLabel(sku)}</span>
                          <span className="text-xs text-surface-500 font-mono">재고 {sku.stock}</span>
                          {alreadyIn && <span className="text-xs text-orange-400/70">추가됨</span>}
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full flex flex-col shadow-2xl" style={{maxWidth:activeGrid.hasOpt2?'100vw':'640px',maxHeight:'98vh',height:activeGrid.hasOpt2?'98vh':'auto'}}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800 shrink-0">
              <div><h3 className="font-semibold text-white">{activeGrid.product.name}</h3><p className="text-xs text-surface-500 mt-0.5">납품수량 입력 (0이면 제외됨)</p></div>
              <button onClick={() => setActiveGrid(null)} className="text-surface-400 hover:text-white p-1"><X size={18}/></button>
            </div>
            <div className="p-5 flex-1 flex flex-col min-h-0">
              <StockGrid skus={activeGrid.skus} values={gridValues} onChange={(id,v) => setGridValues(p=>({...p,[id]:v}))}
                bulkValue={bulkVal} onBulkChange={setBulkVal}
                onBulkApply={() => { if(!bulkVal) return; const n={}; activeGrid.skus.forEach(s=>{n[s.id]=bulkVal}); setGridValues(n) }}/>
            </div>
            <div className="px-5 py-4 border-t border-surface-800 flex gap-3 shrink-0">
              <button onClick={() => setActiveGrid(null)} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium">취소</button>
              <button onClick={handleGridAdd} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold">
                <Plus size={15}/> 납품 목록에 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 납품 정보 폼 ──────────────────────────────────────────
function OutboundInfoForm({ values, onChange, suppliers }) {
  const fields = [
    { key: 'supplierId', label: '납품처', type: 'select' },
    { key: 'outboundDate', label: '납품일자', type: 'date', required: true },
    { key: 'boxCount', label: '박스 수량', type: 'number', placeholder: '0' },
    { key: 'truckType', label: '트럭', placeholder: '예: 5톤' },
    { key: 'deliveryAmount', label: '납품 금액', type: 'number', placeholder: '0', span: 2, required: true },
    { key: 'note', label: '메모', type: 'textarea', placeholder: '메모', span: 2 },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(({ key, label, type, placeholder, span, required }) => (
        <div key={key} className={span===2?'col-span-2':''}>
          <label className="text-xs text-surface-500 mb-1 block">
            {label}{required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          {type==='select' ? (
            <select value={values[key]??''} onChange={e => onChange(key, e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
              <option value="">선택...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : type==='textarea' ? (
            <textarea value={values[key]??''} onChange={e => onChange(key, e.target.value)} rows={2} placeholder={placeholder}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-orange-500 resize-none"/>
          ) : (
            <input type={type||'text'} min="0" value={values[key]??''}
              onChange={e => onChange(key, type==='number' ? e.target.value.replace(/[^0-9]/g,'') : e.target.value)}
              placeholder={placeholder}
              className={'w-full bg-surface-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none ' + (required && !values[key] ? 'border-red-500/40 focus:border-red-500' : 'border-surface-700 focus:border-orange-500')}/>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 신규 납품 ─────────────────────────────────────────────
function NewOutbound({ categories, products, skusByProduct, suppliers, onDone }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [info, setInfo] = useState({ supplierId:'', outboundDate: new Date().toISOString().slice(0,10), boxCount:'', truckType:'', deliveryAmount:'', note:'' })
  const [saving, setSaving] = useState(false)
  const categoryMap = Object.fromEntries(categories.map(c=>[c.id,c.name]))
  const productMap = Object.fromEntries(products.map(p=>[p.id,p.name]))
  const existingSkuIds = useMemo(() => new Set(items.map(it=>it.sku.id)), [items])

  function addItems(newItems) {
    setItems(prev => { const next=[...prev]; newItems.forEach(ni=>{const i=next.findIndex(it=>it.sku.id===ni.sku.id);if(i>=0)next[i]=ni;else next.push(ni)}); return next })
  }
  function updateQty(skuId, qty) { setItems(p=>p.map(it=>it.sku.id===skuId?{...it,deductQty:qty,finalStock:it.currentStock-qty}:it)) }
  function deleteItems(skuIds) { const s=new Set(skuIds); setItems(p=>p.filter(it=>!s.has(it.sku.id))) }

  async function confirmOutbound() {
    if (!items.length) return toast.error('납품할 상품을 추가하세요')
    const zeroItems = items.filter(it => !it.deductQty || it.deductQty <= 0)
    if (zeroItems.length > 0) {
      const names = zeroItems.slice(0,3).map(it=>`${it.product?.name} / ${skuLabel(it.sku)}`).join(', ')
      return toast.error(`납품수량 0 항목: ${names}`)
    }
    if (!info.deliveryAmount || parseInt(info.deliveryAmount) <= 0) return toast.error('납품 금액을 입력하세요 (필수, 0보다 커야 합니다)')
    for (const item of items) {
      if (item.finalStock < 0) return toast.error(`재고 부족: ${item.product?.name} - ${skuLabel(item.sku)}`)
    }
    setSaving(true)
    try {
      const orderNumber = 'OUT-' + Date.now().toString(36).toUpperCase()
      const totalQty = items.reduce((s,it)=>s+it.deductQty,0)
      const { data: order, error: oErr } = await supabase.from('inbound_orders').insert({
        order_number: orderNumber, order_type: 'outbound',
        supplier_id: info.supplierId||null, inbound_date: info.outboundDate,
        box_count: info.boxCount ? parseInt(info.boxCount) : null,
        truck_type: info.truckType||null,
        tax_paid: parseInt(info.deliveryAmount),
        note: info.note||null, created_by: user.id
      }).select().single()
      if (oErr) throw oErr
      await supabase.from('inbound_orders').update({ total_quantity: totalQty }).eq('id', order.id)
      for (const item of items) {
        await supabase.from('inbound_items').insert({ inbound_order_id: order.id, product_sku_id: item.sku.id, quantity: item.deductQty, final_stock: item.finalStock })
        await supabase.from('product_skus').update({ stock: item.finalStock, updated_at: new Date().toISOString() }).eq('id', item.sku.id)
        await supabase.from('stock_logs').insert({ product_sku_id: item.sku.id, change_type: 'outbound', quantity_before: item.currentStock, quantity_change: -item.deductQty, quantity_after: item.finalStock, option_label: skuLabel(item.sku), user_name: user?.email||'', created_by: user.id, note: '납품 '+orderNumber })
      }
      toast.success('납품 완료! '+orderNumber); onDone()
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
        <h2 className="font-semibold text-white mb-3 text-sm">상품 선택</h2>
        <ProductTreeSelector categories={categories} products={products} skusByProduct={skusByProduct} existingSkuIds={existingSkuIds} onAddItems={addItems}/>
      </div>
      <div className="space-y-4">
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
          <h2 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
            <Package size={15}/> 납품 목록 <span className="text-xs text-surface-500 font-normal">({items.length}개 옵션)</span>
          </h2>
          <OutboundItemsTree items={items} onUpdateQty={updateQty} onDeleteItems={deleteItems} categoryMap={categoryMap} productMap={productMap}/>
        </div>
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">납품 정보</h3>
          <OutboundInfoForm values={info} onChange={(k,v) => setInfo(p=>({...p,[k]:v}))} suppliers={suppliers}/>
        </div>
        <button onClick={confirmOutbound} disabled={saving||!items.length}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors">
          <PackageMinus size={18}/>{saving?'처리 중...':'납품하기'}
        </button>
      </div>
    </div>
  )
}

// ── 기존 납품 수정 ────────────────────────────────────────
function EditOutbound({ categories, products, skusByProduct, suppliers }) {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [expandedMonths, setExpandedMonths] = useState({})
  const [expandedDates, setExpandedDates] = useState({})
  const [expandedProds, setExpandedProds] = useState({})
  const [checkedOrders, setCheckedOrders] = useState({})
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [saving, setSaving] = useState(false)
  const [info, setInfo] = useState({})
  const [addingProduct, setAddingProduct] = useState(false)
  const [deleting, setDeleting] = useState(new Set())

  const categoryMap = Object.fromEntries(categories.map(c=>[c.id,c.name]))
  const productMap = Object.fromEntries(products.map(p=>[p.id,p.name]))
  const supplierMap = Object.fromEntries(suppliers.map(s=>[s.id,s.name]))

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase.from('inbound_orders')
      .select('id, order_number, inbound_date, total_quantity, supplier_id, truck_type, box_count, tax_paid, note, created_at, inbound_items(quantity, product_sku_id, product_skus(products(id,name), o1:option1_id(option_value), o2:option2_id(option_value)))')
      .eq('order_type','outbound')
      .order('inbound_date',{ascending:false}).order('created_at',{ascending:false}).limit(300)
    setOrders(data||[]); setLoading(false)
  }

  async function selectOrder(order) {
    setSelectedOrder(order); setLoadingItems(true); setAddingProduct(false)
    setInfo({ supplierId: order.supplier_id||'', outboundDate: order.inbound_date||'', boxCount: order.box_count||'', truckType: order.truck_type||'', deliveryAmount: order.tax_paid||'', note: order.note||'' })
    const { data } = await supabase.from('inbound_items')
      .select('id, quantity, final_stock, product_sku_id, product_skus(stock, products(id,name,category_id), o1:option1_id(option_name,option_value,sort_order), o2:option2_id(option_name,option_value,sort_order))')
      .eq('inbound_order_id', order.id)
    setOrderItems((data||[]).map(it => ({
      id: it.id, product: it.product_skus?.products||{},
      catId: it.product_skus?.products?.category_id||'__none__',
      sku: { id: it.product_sku_id, stock: it.product_skus?.stock||0, o1: it.product_skus?.o1, o2: it.product_skus?.o2 },
      currentStock: it.product_skus?.stock||0, deductQty: it.quantity||0, finalStock: it.final_stock||0
    })))
    setLoadingItems(false)
  }

  const existingSkuIds = useMemo(() => new Set(orderItems.map(it=>it.sku.id)), [orderItems])

  function addItems(newItems) { const toAdd=newItems.filter(ni=>!existingSkuIds.has(ni.sku.id)); if(toAdd.length) setOrderItems(p=>[...p,...toAdd]) }
  function updateQty(skuId, qty) { setOrderItems(p=>p.map(it=>it.sku.id===skuId?{...it,deductQty:qty,finalStock:it.currentStock-qty}:it)) }
  function deleteItems(skuIds) { const s=new Set(skuIds); setOrderItems(p=>p.filter(it=>!s.has(it.sku.id))) }

  async function saveOrder() {
    if (!selectedOrder) return
    const zeroItems = orderItems.filter(it => !it.deductQty || it.deductQty <= 0)
    if (zeroItems.length > 0) {
      const names = zeroItems.slice(0,3).map(it=>`${it.product?.name} / ${skuLabel(it.sku)}`).join(', ')
      return toast.error(`납품수량 0 항목: ${names}`)
    }
    if (!info.deliveryAmount || parseInt(info.deliveryAmount) <= 0) return toast.error('납품 금액을 입력하세요 (필수, 0보다 커야 합니다)')
    setSaving(true)
    try {
      const totalQty = orderItems.reduce((s,it)=>s+it.deductQty,0)
      await supabase.from('inbound_orders').update({
        supplier_id: info.supplierId||null, inbound_date: info.outboundDate,
        box_count: info.boxCount ? parseInt(info.boxCount) : null,
        truck_type: info.truckType||null,
        tax_paid: parseInt(info.deliveryAmount),
        note: info.note||null, total_quantity: totalQty
      }).eq('id', selectedOrder.id)
      await supabase.from('inbound_items').delete().eq('inbound_order_id', selectedOrder.id)
      for (const item of orderItems) {
        await supabase.from('inbound_items').insert({ inbound_order_id: selectedOrder.id, product_sku_id: item.sku.id, quantity: item.deductQty, final_stock: item.finalStock })
        await supabase.from('product_skus').update({ stock: item.finalStock, updated_at: new Date().toISOString() }).eq('id', item.sku.id)
      }
      toast.success('수정 완료'); loadOrders(); setAddingProduct(false)
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function deleteOrder(id) {
    if (!confirm('납품을 삭제하시겠습니까?')) return
    setDeleting(p=>new Set([...p,id]))
    try {
      await supabase.from('inbound_items').delete().eq('inbound_order_id',id)
      await supabase.from('inbound_orders').delete().eq('id',id)
      if(selectedOrder?.id===id){setSelectedOrder(null);setOrderItems([])}
      toast.success('삭제 완료'); loadOrders()
    } catch(err){toast.error(err.message)}
    finally{setDeleting(p=>{const n=new Set(p);n.delete(id);return n})}
  }

  async function deleteMultiple(ids) {
    if(!ids.length||!confirm(`${ids.length}개 납품을 삭제하시겠습니까?`)) return
    for(const id of ids){
      await supabase.from('inbound_items').delete().eq('inbound_order_id',id)
      await supabase.from('inbound_orders').delete().eq('id',id)
      if(selectedOrder?.id===id){setSelectedOrder(null);setOrderItems([])}
    }
    toast.success(`${ids.length}개 삭제 완료`); setCheckedOrders({}); loadOrders()
  }

  const filtered = useMemo(() => {
    if (!searchQ.trim()) return orders
    const q=searchQ.toLowerCase()
    return orders.filter(o=>(o.order_number||'').toLowerCase().includes(q)||(supplierMap[o.supplier_id]||'').toLowerCase().includes(q))
  }, [orders,searchQ])

  const tree = useMemo(() => {
    const months={}
    filtered.forEach(order => {
      const date=order.inbound_date||order.created_at?.slice(0,10)||''
      const month=date.slice(0,7)
      if(!months[month]) months[month]={}
      months[month][date]=order
    })
    return Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0]))
  }, [filtered])

  const checkedIds = Object.keys(checkedOrders).filter(id=>checkedOrders[id])
  function chkState(ids) { const n=ids.filter(id=>checkedOrders[id]).length; return n===0?false:n===ids.length?true:'partial' }
  function toggleAll(ids) { const allOn=ids.every(id=>checkedOrders[id]); setCheckedOrders(p=>{const n={...p};ids.forEach(id=>{n[id]=!allOn});return n}) }

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-5">
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"/>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="번호 또는 납품처 검색..."
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-orange-500"/>
          </div>
          {checkedIds.length > 0 && (
            <button onClick={() => deleteMultiple(checkedIds)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-xl text-xs font-medium transition-colors whitespace-nowrap">
              <Trash2 size={12}/> {checkedIds.length}개 삭제
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>
        ) : (
          <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
            {tree.length===0 ? <p className="text-center py-8 text-surface-500 text-sm">납품 이력 없음</p> : (
              <table className="w-full text-sm">
                <tbody>
                  {tree.map(([month, dates]) => {
                    const [y,m]=month.split('-')
                    const monthOpen=expandedMonths[month]??false
                    const monthOrderIds=Object.values(dates).map(o=>o.id)
                    const monthQty=Object.values(dates).reduce((s,o)=>s+(o.total_quantity||0),0)
                    return [
                      <tr key={`m-${month}`} className="bg-surface-800/60 border-b border-surface-700/40 hover:bg-surface-800 cursor-pointer">
                        <td className="px-2 py-2.5 w-8" onClick={e=>e.stopPropagation()}><Chk state={chkState(monthOrderIds)} onChange={() => toggleAll(monthOrderIds)}/></td>
                        <td className="px-2 py-2.5" onClick={() => setExpandedMonths(p=>({...p,[month]:!monthOpen}))}>
                          <div className="flex items-center gap-2">
                            {monthOpen?<ChevronDown size={13} className="text-surface-500"/>:<ChevronRight size={13} className="text-surface-500"/>}
                            <span className="text-sm font-bold text-surface-200">{y}년 {parseInt(m)}월</span>
                            <span className="text-xs text-surface-600">({Object.keys(dates).length}건)</span>
                            <span className="text-xs font-mono text-orange-400 ml-auto">{monthQty}개</span>
                          </div>
                        </td>
                        <td className="w-16"/>
                      </tr>,
                      ...(!monthOpen?[]:(Object.entries(dates).sort((a,b)=>b[0].localeCompare(a[0])).flatMap(([date,order]) => {
                        const dateOpen=expandedDates[date]??false
                        const [,,dd]=date.split('-')
                        const items=order.inbound_items||[]
                        const prodMap2={}
                        items.forEach(it=>{const pn=it.product_skus?.products?.name||'상품';if(!prodMap2[pn])prodMap2[pn]=[];prodMap2[pn].push(it)})
                        return [
                          <tr key={`d-${date}`} className={"border-b border-surface-800/30 hover:bg-surface-800/20 cursor-pointer "+(selectedOrder?.id===order.id?'bg-orange-500/8 border-l-2 border-l-orange-500':'')}>
                            <td className="px-2 py-2.5 w-8" onClick={e=>e.stopPropagation()}><Chk state={!!checkedOrders[order.id]} onChange={() => setCheckedOrders(p=>({...p,[order.id]:!p[order.id]}))}/></td>
                            <td className="px-2 py-2.5 pl-6" onClick={() => setExpandedDates(p=>({...p,[date]:!dateOpen}))}>
                              <div className="flex items-center gap-2">
                                {dateOpen?<ChevronDown size={12} className="text-surface-500"/>:<ChevronRight size={12} className="text-surface-500"/>}
                                <span className="text-sm font-semibold text-white">{parseInt(m)}월 {parseInt(dd)}일</span>
                                {order.supplier_id&&<span className="text-xs text-surface-500">· {supplierMap[order.supplier_id]}</span>}
                              </div>
                              <div className="flex items-center gap-3 ml-6 mt-0.5">
                                <span className="text-xs text-surface-600">{order.order_number}</span>
                                {order.tax_paid>0&&<span className="text-xs text-orange-400/70">₩{Number(order.tax_paid).toLocaleString()}</span>}
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-right pr-2">
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-xs font-mono text-orange-400 font-bold">{order.total_quantity}개</span>
                                <button onClick={e=>{e.stopPropagation();selectOrder(order)}} className="flex items-center gap-1 px-2 py-1 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 rounded-lg text-xs font-medium whitespace-nowrap">
                                  <Pencil size={10}/> 편집
                                </button>
                                <button onClick={e=>{e.stopPropagation();deleteOrder(order.id)}} disabled={deleting.has(order.id)} className="p-1 hover:bg-red-500/10 text-surface-600 hover:text-red-400 rounded">
                                  <Trash2 size={11}/>
                                </button>
                              </div>
                            </td>
                          </tr>,
                          ...(!dateOpen?[]:Object.entries(prodMap2).flatMap(([prodName,pitems]) => {
                            const prodKey=`${date}-${prodName}`
                            const prodOpen=expandedProds[prodKey]??false
                            const prodQty=pitems.reduce((s,it)=>s+(it.quantity||0),0)
                            return [
                              <tr key={`p-${prodKey}`} className="border-b border-surface-800/20 hover:bg-surface-800/10 cursor-pointer" onClick={() => setExpandedProds(p=>({...p,[prodKey]:!prodOpen}))}>
                                <td/><td className="px-2 py-1.5 pl-10"><div className="flex items-center gap-2">{prodOpen?<ChevronDown size={11} className="text-surface-500"/>:<ChevronRight size={11} className="text-surface-500"/>}<span className="text-xs font-medium text-white">{prodName}</span></div></td>
                                <td className="px-2 py-1.5 text-right pr-3 text-xs font-mono text-surface-400">{prodQty}</td>
                              </tr>,
                              ...(!prodOpen?[]:pitems.map(it => {
                                const opt=[it.product_skus?.o1?.option_value,it.product_skus?.o2?.option_value].filter(Boolean).join(' / ')||'Default'
                                return (
                                  <tr key={`i-${it.product_sku_id}`} className="border-b border-surface-800/10">
                                    <td/><td className="px-2 py-1.5 pl-16"><div className="flex items-center gap-1.5 text-xs text-surface-400"><span className="w-1 h-1 rounded-full bg-surface-700 shrink-0"/>{opt}</div></td>
                                    <td className="px-2 py-1.5 text-right pr-3 text-xs font-mono text-orange-400 font-bold">-{it.quantity}</td>
                                  </tr>
                                )
                              }))
                            ]
                          }))
                        ]
                      })))
                    ]
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {!selectedOrder ? (
        <div className="flex flex-col items-center justify-center py-20 text-surface-500 bg-surface-900 border border-surface-800 rounded-2xl">
          <Truck size={32} className="mb-2 opacity-30"/><p className="text-sm">왼쪽 목록에서 편집 버튼을 클릭하세요</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm">{selectedOrder.order_number} - 납품 목록</h2>
              <button onClick={() => setAddingProduct(!addingProduct)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 rounded-lg text-xs font-medium">
                <Plus size={12}/> 상품 추가
              </button>
            </div>
            {loadingItems
              ? <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>
              : <OutboundItemsTree items={orderItems} onUpdateQty={updateQty} onDeleteItems={deleteItems} categoryMap={categoryMap} productMap={productMap}/>
            }
          </div>
          {addingProduct && (
            <div className="bg-surface-900 border border-orange-500/30 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-orange-400">상품 추가</p>
                <button onClick={() => setAddingProduct(false)} className="text-surface-400 hover:text-white"><X size={15}/></button>
              </div>
              <ProductTreeSelector categories={categories} products={products} skusByProduct={skusByProduct} existingSkuIds={existingSkuIds} onAddItems={addItems}/>
            </div>
          )}
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">납품 정보</h3>
            <OutboundInfoForm values={info} onChange={(k,v) => setInfo(p=>({...p,[k]:v}))} suppliers={suppliers}/>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSelectedOrder(null)} className="px-4 py-3 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium">취소</button>
            <button onClick={saveOrder} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors">
              <Save size={16}/>{saving?'저장 중...':'수정 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 납품 이력 ─────────────────────────────────────────────
function OutboundHistory({ suppliers, categories }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [expandedMonths, setExpandedMonths] = useState({})
  const [expandedDates, setExpandedDates] = useState({})
  const [expandedProds, setExpandedProds] = useState({})
  const supplierMap = Object.fromEntries(suppliers.map(s=>[s.id,s.name]))
  const years = useMemo(() => { const y=new Date().getFullYear(); return [y,y-1,y-2,y-3].map(String) }, [])

  useEffect(() => { loadOrders() }, [yearFilter, selectedSupplier])

  async function loadOrders() {
    setLoading(true)
    let q = supabase.from('inbound_orders')
      .select('id, order_number, inbound_date, total_quantity, supplier_id, truck_type, box_count, tax_paid, created_at, inbound_items(id,quantity,final_stock,product_sku_id,product_skus(products(id,name,category_id),o1:option1_id(option_value),o2:option2_id(option_value)))')
      .eq('order_type','outbound').order('inbound_date',{ascending:false}).order('created_at',{ascending:false}).limit(300)
    if(yearFilter) q=q.gte('inbound_date',`${yearFilter}-01-01`).lte('inbound_date',`${yearFilter}-12-31`)
    if(selectedSupplier) q=q.eq('supplier_id',selectedSupplier)
    const { data } = await q
    setOrders(data||[]); setLoading(false)
  }

  const filtered = useMemo(() => {
    if(!search.trim()) return orders
    const q=search.toLowerCase()
    return orders.filter(o=>(o.order_number||'').toLowerCase().includes(q)||(supplierMap[o.supplier_id]||'').toLowerCase().includes(q))
  }, [orders,search])

  const tree = useMemo(() => {
    const months={}
    filtered.forEach(order => {
      const date=order.inbound_date||order.created_at?.slice(0,10)||''
      const month=date.slice(0,7)
      if(!months[month]) months[month]={}
      months[month][date]=order
    })
    return Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0]))
  }, [filtered])

  async function downloadExcel(order) {
    try {
      const { data: rawItems } = await supabase.from('inbound_items').select('id,quantity,product_sku_id').eq('inbound_order_id',order.id)
      if(!rawItems?.length) return toast.error('납품 항목이 없습니다')
      const skuIds=rawItems.map(it=>it.product_sku_id)
      const { data: skuRows } = await supabase.from('product_skus').select('id,product_id,o1:option1_id(option_name,option_value,sort_order),o2:option2_id(option_name,option_value,sort_order)').in('id',skuIds)
      const { data: prodRows } = await supabase.from('products').select('id,name,storage_location_text,category_id,categories(name)').in('id',[...new Set((skuRows||[]).map(s=>s.product_id))])
      const skuMap=Object.fromEntries((skuRows||[]).map(s=>[s.id,s]))
      const prodMap2=Object.fromEntries((prodRows||[]).map(p=>[p.id,p]))
      const items=rawItems.map(it=>{const sku=skuMap[it.product_sku_id]||{};const prod=prodMap2[sku.product_id]||{};return{...it,sku,prod}})
      const workbook=new ExcelJS.Workbook(); workbook.creator='StockOS'
      const grouped=new Map()
      items.forEach(it=>{const pid=it.prod.id||'unknown';if(!grouped.has(pid))grouped.set(pid,{prod:it.prod,items:[]});grouped.get(pid).items.push(it)})
      for(const {prod,items:pitems} of grouped.values()){
        const ws=workbook.addWorksheet((prod.name||'Sheet').replace(/[:/\[\]*?]/g,'').slice(0,31))
        const IB={top:{style:'thin',color:{argb:'FF2E5FA3'}},bottom:{style:'thin',color:{argb:'FF2E5FA3'}},left:{style:'thin',color:{argb:'FF2E5FA3'}},right:{style:'thin',color:{argb:'FF2E5FA3'}}}
        const CB={top:{style:'thin',color:{argb:'FF999999'}},bottom:{style:'thin',color:{argb:'FF999999'}},left:{style:'thin',color:{argb:'FF999999'}},right:{style:'thin',color:{argb:'FF999999'}}}
        const infoRows=[['납품번호',order.order_number||''],['납품일',order.inbound_date||''],['거래처',supplierMap[order.supplier_id]||''],['상품명',prod.name||''],['트럭',order.truck_type||''],['박스',order.box_count?String(order.box_count):''],['납품금액',order.tax_paid?`₩${Number(order.tax_paid).toLocaleString()}`:''],[]]
        infoRows.forEach(r=>{const row=ws.addRow(r);if(r.length>0&&r[0]){row.getCell(1).font={bold:true,color:{argb:'FFFFFFFF'},size:10};row.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4472C4'}};row.getCell(1).border=IB;row.getCell(2).font={color:{argb:'FFFFFFFF'},size:10};row.getCell(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4472C4'}};row.getCell(2).border=IB}})
        const opt1Map=new Map(),opt2Map=new Map()
        pitems.forEach(it=>{const s=it.sku;if(s.o1)opt1Map.set(s.o1.option_value,s.o1);else opt1Map.set('Default',{option_value:'Default',sort_order:0});if(s.o2)opt2Map.set(s.o2.option_value,s.o2)})
        const o1v=[...opt1Map.values()].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
        const o2v=[...opt2Map.values()].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
        const has2=o2v.length>0
        if(!has2){const hRow=ws.addRow(['옵션','납품수량']);hRow.eachCell(cell=>{cell.font={bold:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFA9D18E'}};cell.border=CB});o1v.forEach(v1=>{const item=pitems.find(it=>(it.sku.o1?.option_value||'Default')===v1.option_value);const dr=ws.addRow([v1.option_value,item?.quantity??0]);dr.getCell(2).alignment={horizontal:'center'};dr.eachCell(cell=>{cell.border=CB})})}
        else{const hRow=ws.addRow([`${o1v[0]?.option_name||'옵션1'}\\${o2v[0]?.option_name||'옵션2'}`,...o2v.map(v=>v.option_value)]);hRow.eachCell(cell=>{cell.font={bold:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFA9D18E'}};cell.alignment={horizontal:'center'};cell.border=CB});o1v.forEach(v1=>{const cells=[v1.option_value];o2v.forEach(v2=>{const found=pitems.find(it=>(it.sku.o1?.option_value||'Default')===v1.option_value&&it.sku.o2?.option_value===v2.option_value);cells.push(found?found.quantity:null)});const dr=ws.addRow(cells);dr.getCell(1).font={bold:true};for(let ci=2;ci<=cells.length;ci++)dr.getCell(ci).alignment={horizontal:'center'};dr.eachCell(cell=>{cell.border=CB})})}
        ws.columns.forEach(col=>{let maxLen=8;col.eachCell({includeEmpty:false},cell=>{const v=cell.value;const len=v?(typeof v==='number'?String(v).length:String(v).length*1.4):0;if(len>maxLen)maxLen=len});col.width=Math.min(maxLen+2,40)})
      }
      const buffer=await workbook.xlsx.writeBuffer()
      const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`납품_${order.order_number}_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(url)
      toast.success('엑셀 다운로드 완료')
    } catch(err){console.error(err);toast.error('다운로드 실패: '+err.message)}
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 shrink-0">
          <option value="">전체</option>{years.map(y=><option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={selectedSupplier} onChange={e=>setSelectedSupplier(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 shrink-0">
          <option value="">전체 납품처</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="번호 검색..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-orange-500"/>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>
      : tree.length===0 ? <p className="text-center py-10 text-surface-500 text-sm">납품 이력이 없습니다</p>
      : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-800/60 border-b border-surface-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400">항목</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 w-20">수량</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-surface-400 w-24">엑셀</th>
            </tr></thead>
            <tbody>
              {tree.map(([month,dates]) => {
                const [y,m]=month.split('-')
                const monthOpen=expandedMonths[month]??false
                const monthQty=Object.values(dates).reduce((s,o)=>s+(o.total_quantity||0),0)
                return [
                  <tr key={`m-${month}`} className="bg-surface-800/50 border-b border-surface-700/60 cursor-pointer hover:bg-surface-800" onClick={() => setExpandedMonths(p=>({...p,[month]:!monthOpen}))}>
                    <td className="px-4 py-2.5"><div className="flex items-center gap-2">{monthOpen?<ChevronDown size={13} className="text-surface-500"/>:<ChevronRight size={13} className="text-surface-500"/>}<span className="text-sm font-bold text-surface-200">{y}년 {parseInt(m)}월</span><span className="text-xs text-surface-600">({Object.keys(dates).length}건)</span></div></td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-orange-400 text-sm">{monthQty}</td><td/>
                  </tr>,
                  ...(!monthOpen?[]:Object.entries(dates).sort((a,b)=>b[0].localeCompare(a[0])).flatMap(([date,order]) => {
                    const [,,dd]=date.split('-')
                    const dateOpen=expandedDates[date]??false
                    const items=order.inbound_items||[]
                    const prodMap2={}
                    items.forEach(it=>{const pn=it.product_skus?.products?.name||'상품';if(!prodMap2[pn])prodMap2[pn]=[];prodMap2[pn].push(it)})
                    return [
                      <tr key={`d-${date}`} className="border-b border-surface-800/40 hover:bg-surface-800/20 cursor-pointer" onClick={() => setExpandedDates(p=>({...p,[date]:!dateOpen}))}>
                        <td className="px-4 py-2.5 pl-8">
                          <div className="flex items-center gap-2">{dateOpen?<ChevronDown size={12} className="text-surface-500"/>:<ChevronRight size={12} className="text-surface-500"/>}<span className="font-medium text-white text-sm">{parseInt(m)}월 {parseInt(dd)}일</span>{order.supplier_id&&<span className="text-xs text-surface-500">· {supplierMap[order.supplier_id]}</span>}</div>
                          <div className="flex items-center gap-3 ml-6 mt-0.5"><span className="text-xs text-surface-600">{order.order_number}</span>{order.tax_paid>0&&<span className="text-xs text-orange-400/70">₩{Number(order.tax_paid).toLocaleString()}</span>}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-orange-400 font-bold">{order.total_quantity}</td>
                        <td className="px-4 py-2.5 text-right" onClick={e=>e.stopPropagation()}><button onClick={()=>downloadExcel(order)} className="flex items-center gap-1 px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-medium ml-auto"><Download size={11}/> 엑셀</button></td>
                      </tr>,
                      ...(!dateOpen?[]:Object.entries(prodMap2).flatMap(([prodName,pitems]) => {
                        const prodKey=`${date}-${prodName}`
                        const prodOpen=expandedProds[prodKey]??false
                        const prodQty=pitems.reduce((s,it)=>s+(it.quantity||0),0)
                        return [
                          <tr key={`p-${prodKey}`} className="border-b border-surface-800/20 hover:bg-surface-800/10 cursor-pointer" onClick={() => setExpandedProds(p=>({...p,[prodKey]:!prodOpen}))}>
                            <td className="px-4 py-1.5 pl-14"><div className="flex items-center gap-2">{prodOpen?<ChevronDown size={11} className="text-surface-500"/>:<ChevronRight size={11} className="text-surface-500"/>}<span className="text-xs font-medium text-white">{prodName}</span></div></td>
                            <td className="px-4 py-1.5 text-center font-mono text-surface-400 text-xs">{prodQty}</td><td/>
                          </tr>,
                          ...(!prodOpen?[]:pitems.map(it => {
                            const opt=[it.product_skus?.o1?.option_value,it.product_skus?.o2?.option_value].filter(Boolean).join(' / ')||'Default'
                            return (<tr key={`i-${it.product_sku_id}`} className="border-b border-surface-800/10"><td className="px-4 py-1.5 pl-20"><div className="flex items-center gap-1.5 text-xs text-surface-400"><span className="w-1 h-1 rounded-full bg-surface-700 shrink-0"/>{opt}</div></td><td className="px-4 py-1.5 text-center font-mono font-bold text-orange-400 text-sm">-{it.quantity}</td><td/></tr>)
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

// ── 납품 차트 ─────────────────────────────────────────────

// ── 메인 ─────────────────────────────────────────────────
export default function OutboundPage() {
  const [mode, setMode] = useState(null)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [skusByProduct, setSkusByProduct] = useState({})
  const [suppliers, setSuppliers] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => { loadBaseData() }, [])

  async function reloadSuppliers() {
    const { data } = await supabase.from('suppliers').select('id, name').order('name')
    setSuppliers(data||[])
  }

  async function loadBaseData() {
    const [{ data:cats },{ data:prods },{ data:skus },{ data:supp }] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
      supabase.from('products').select('id, name, category_id').eq('is_active',true).order('name'),
      supabase.from('product_skus').select('id, stock, product_id, o1:option1_id(option_name,option_value,sort_order), o2:option2_id(option_name,option_value,sort_order)').eq('is_active',true),
      supabase.from('suppliers').select('id, name').order('name')
    ])
    setCategories(cats||[]); setProducts(prods||[]); setSuppliers(supp||[])
    const map={}; (skus||[]).forEach(s=>{if(!map[s.product_id])map[s.product_id]=[];map[s.product_id].push(s)})
    setSkusByProduct(map); setDataLoaded(true)
  }

  const TABS = [
    { key:'new', label:'신규 납품', icon: PackageMinus },
    { key:'edit', label:'기존 납품 수정', icon: Pencil },
    { key:'history', label:'납품 이력', icon: Truck },
    { key:'suppliers', label:'납품처 관리', icon: Building2 },
  ]

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">납품 관리</h1>
        <span className="text-xs bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-lg font-medium">납품·출고</span>
      </div>
      {mode===null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-2">
          {TABS.map(tab => {
            const Icon=tab.icon
            return (
              <button key={tab.key} onClick={() => { setMode(tab.key); if(tab.key!=='suppliers') reloadSuppliers() }}
                className="flex flex-col items-center gap-3 p-6 bg-surface-900 border border-surface-800 hover:border-orange-500/30 hover:bg-surface-800/50 rounded-2xl transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/15 flex items-center justify-center"><Icon size={24} className="text-orange-400"/></div>
                <p className="font-semibold text-white text-sm text-center">{tab.label}</p>
              </button>
            )
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => { setMode(null); reloadSuppliers() }} className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors">
              <ChevronRight size={14} className="rotate-180"/> 뒤로
            </button>
            <span className="text-surface-600">/</span>
            <span className="text-sm font-medium text-white">{TABS.find(t=>t.key===mode)?.label}</span>
          </div>
          {mode==='new' && dataLoaded && <NewOutbound categories={categories} products={products} skusByProduct={skusByProduct} suppliers={suppliers} onDone={() => setMode(null)}/>}
          {mode==='edit' && dataLoaded && <EditOutbound categories={categories} products={products} skusByProduct={skusByProduct} suppliers={suppliers}/>}
          {mode==='history' && dataLoaded && <OutboundHistory suppliers={suppliers} categories={categories}/>}
          {mode==='suppliers' && <SuppliersPage embedded/>}
        </>
      )}
    </div>
  )
}
