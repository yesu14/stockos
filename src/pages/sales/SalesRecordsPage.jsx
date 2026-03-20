import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, ChevronDown, ChevronRight, Trash2, Edit2, X, Save,
  Search, Package, Calendar, ArrowLeft, CheckSquare, Square
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── 체크박스 (indeterminate 지원) ─────────────────────────
function Chk({ state, onChange }) {
  const ref = el => { if (el) el.indeterminate = state === 'partial' }
  return (
    <input type="checkbox" ref={ref}
      checked={state === true || state === 'partial'} onChange={onChange}
      className="w-4 h-4 accent-primary-500 cursor-pointer shrink-0" />
  )
}

// ── 달력 날짜 선택 ─────────────────────────────────────────
function DatePicker({ value, onChange, markedDates = new Set() }) {
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5,7)) - 1 : new Date().getMonth())

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const today = new Date().toISOString().slice(0, 10)

  function prevMonth() { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11) } else setViewMonth(m => m-1) }
  function nextMonth() { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0) } else setViewMonth(m => m+1) }

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 hover:bg-surface-700 rounded-lg text-surface-400 hover:text-white transition-colors">‹</button>
        <span className="text-sm font-semibold text-white">{viewYear}년 {viewMonth + 1}월</span>
        <button onClick={nextMonth} className="p-1.5 hover:bg-surface-700 rounded-lg text-surface-400 hover:text-white transition-colors">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['일','월','화','수','목','금','토'].map(d => (
          <div key={d} className="text-center text-xs text-surface-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSelected = value === dateStr
          const isToday = dateStr === today
          const hasData = markedDates.has(dateStr)
          return (
            <button key={day} onClick={() => onChange(dateStr)}
              className={'relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-xs transition-colors ' +
                (isSelected ? 'bg-primary-500 text-white font-bold' :
                 isToday ? 'bg-surface-700 text-primary-400 font-semibold' :
                 'hover:bg-surface-700 text-surface-300')}>
              {day}
              {hasData && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-yellow-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── StockGrid (판매 수량 입력용) ──────────────────────────
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
        <input type="number" min="0" value={bulkValue}
          onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
          onChange={e => onBulkChange(e.target.value.replace(/[^0-9]/g,''))} placeholder="수량"
          className="w-28 bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-primary-500" />
        <button onClick={onBulkApply} className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">전체 적용</button>
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
                : <th className="px-3 py-2.5 text-center text-xs font-semibold text-surface-400 border-b border-surface-700 min-w-28">판매수량</th>}
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
                  const curSale = sku.currentSaleQty || 0
                  return (
                    <td key={v2.option_value} className="px-2 py-2">
                      <div className="text-center text-xs text-surface-500 mb-0.5">재고 {sku.stock}</div>
                      {curSale > 0 && <div className="text-center text-xs text-primary-400 mb-0.5">기존판매 {curSale}</div>}
                      <input type="number" min="0" value={val}
                        onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
                        onChange={e => onChange(sku.id, e.target.value.replace(/[^0-9]/g,''))} placeholder="0"
                        className={'w-full text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none ' + (val > 0 ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700')} />
                    </td>)
                }) : (() => {
                  const sku = getSku(v1.option_value, null)
                  if (!sku) return <td className="px-3 py-2.5 text-center text-surface-600">-</td>
                  const val = values[sku.id] ?? ''
                  const curSale = sku.currentSaleQty || 0
                  return (
                    <td key="single" className="px-2 py-2">
                      <div className="text-center text-xs text-surface-500 mb-0.5">재고 {sku.stock}</div>
                      {curSale > 0 && <div className="text-center text-xs text-primary-400 mb-0.5">기존판매 {curSale}</div>}
                      <input type="number" min="0" value={val}
                        onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
                        onChange={e => onChange(sku.id, e.target.value.replace(/[^0-9]/g,''))} placeholder="0"
                        className={'w-full text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none ' + (val > 0 ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700')} />
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

// ── 판매 추가 전체화면 페이지 ─────────────────────────────
function SaleAddPage({ onClose, onSaved, currentUser }) {
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [skusByProduct, setSkusByProduct] = useState({})
  const [saleDateSales, setSaleDateSales] = useState({}) // skuId -> existing sale
  const [allSaleDates, setAllSaleDates] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState({})
  const [activeGrid, setActiveGrid] = useState(null)
  const [gridValues, setGridValues] = useState({})
  const [bulkVal, setBulkVal] = useState('')
  const [saleItems, setSaleItems] = useState([]) // { sku, product, qty, existingSaleId }
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadBase() }, [])
  useEffect(() => { if (saleDate) loadDateSales() }, [saleDate])

  async function loadBase() {
    setLoading(true)
    const [{ data: cats }, { data: prods }, { data: skus }, { data: saleDates }] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
      supabase.from('products').select('id, name, sale_price, margin, category_id').eq('is_active', true).order('sort_order'),
      supabase.from('product_skus').select('id, stock, product_id, o1:option1_id(option_name, option_value, sort_order), o2:option2_id(option_name, option_value, sort_order)').eq('is_active', true),
      supabase.from('sales').select('sale_date').eq('created_by', currentUser.id)
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    const sbp = {}
    ;(skus || []).forEach(s => { if (!sbp[s.product_id]) sbp[s.product_id] = []; sbp[s.product_id].push(s) })
    setSkusByProduct(sbp)
    const dates = new Set((saleDates || []).map(s => s.sale_date))
    setAllSaleDates(dates)
    setLoading(false)
  }

  async function loadDateSales() {
    const { data } = await supabase.from('sales')
      .select('id, quantity, product_sku_id')
      .eq('sale_date', saleDate)
      .eq('created_by', currentUser.id)
    const map = {}
    ;(data || []).forEach(s => { map[s.product_sku_id] = s })
    setSaleDateSales(map)
    // Re-build saleItems from date data
    const items = (data || []).map(s => {
      const sku = Object.values(skusByProduct).flat().find(sk => sk.id === s.product_sku_id)
      const prod = products.find(p => p.id === sku?.product_id)
      if (!sku || !prod) return null
      return { sku, product: prod, qty: s.quantity, existingSaleId: s.id }
    }).filter(Boolean)
    setSaleItems(items)
  }

  function skuLabel(sku) { return [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join(' / ') || 'Default' }

  // Filtered product tree
  const filteredProds = useMemo(() => {
    if (!search.trim()) return products
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [products, search])

  const catMap = useMemo(() => {
    const m = {}
    categories.forEach(c => { m[c.id] = [] })
    filteredProds.forEach(p => {
      const cid = p.category_id || '__none__'
      if (!m[cid]) m[cid] = []
      m[cid].push(p)
    })
    return m
  }, [categories, filteredProds])

  const existingSkuIds = useMemo(() => new Set(saleItems.map(it => it.sku.id)), [saleItems])

  function available(prod) { return (skusByProduct[prod.id] || []).filter(s => !existingSkuIds.has(s.id)) }
  function prodState(prod) {
    const skus = available(prod)
    if (!skus.length) return false
    const n = skus.filter(s => checked[s.id]).length
    return n === 0 ? false : n === skus.length ? true : 'partial'
  }
  function catState(prods) {
    const skus = prods.flatMap(available)
    if (!skus.length) return false
    const n = skus.filter(s => checked[s.id]).length
    return n === 0 ? false : n === skus.length ? true : 'partial'
  }
  function toggleSku(skuId) { if (existingSkuIds.has(skuId)) return; setChecked(p => ({ ...p, [skuId]: !p[skuId] })) }
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
      if (prod && sku) items.push({ sku, product: prod, qty: 0, existingSaleId: null })
    })
    setSaleItems(p => [...p, ...items]); setChecked({})
    toast.success(`${items.length}개 추가됨`)
  }

  function openGrid(prod) {
    const skus = (skusByProduct[prod.id] || []).map(sku => ({
      ...sku,
      currentSaleQty: saleDateSales[sku.id]?.quantity || 0
    }))
    setActiveGrid({ product: prod, skus, hasOpt2: skus.some(s => s.o2) })
    setGridValues({})
    setBulkVal('')
  }

  function handleGridAdd() {
    const toAdd = (activeGrid?.skus || []).filter(s => (parseInt(gridValues[s.id]) || 0) > 0)
    if (!toAdd.length) return toast.error('0보다 큰 수량을 입력하세요')
    const newItems = []
    toAdd.forEach(s => {
      const existing = saleItems.find(it => it.sku.id === s.id)
      const qty = parseInt(gridValues[s.id]) || 0
      if (existing) {
        setSaleItems(p => p.map(it => it.sku.id === s.id ? { ...it, qty } : it))
      } else {
        newItems.push({ sku: s, product: activeGrid.product, qty, existingSaleId: saleDateSales[s.id]?.id || null })
      }
    })
    if (newItems.length) setSaleItems(p => [...p, ...newItems])
    setActiveGrid(null); setGridValues({})
    toast.success('판매 목록에 추가됨')
  }

  const selectedCount = Object.values(checked).filter(Boolean).length

  async function handleSave() {
    if (!saleDate) return toast.error('판매 날짜를 선택하세요')
    const validItems = saleItems.filter(it => it.qty > 0)
    if (!validItems.length) return toast.error('판매수량을 입력하세요')
    setSaving(true)
    try {
      for (const item of validItems) {
        const { data: freshSku } = await supabase.from('product_skus').select('stock, products(sale_price, margin)').eq('id', item.sku.id).single()
        const salePrice = freshSku?.products?.sale_price || item.product?.sale_price || 0
        const margin = freshSku?.products?.margin || item.product?.margin || 0
        const existingForDate = saleDateSales[item.sku.id]
        if (existingForDate) {
          // Update existing record for this date
          const diff = item.qty - existingForDate.quantity
          await supabase.from('sales').update({ quantity: item.qty, updated_at: new Date().toISOString() }).eq('id', existingForDate.id)
          await supabase.from('product_skus').update({ stock: (freshSku?.stock || 0) - diff }).eq('id', item.sku.id)
        } else {
          await supabase.from('sales').insert({ product_sku_id: item.sku.id, quantity: item.qty, sale_price: salePrice, margin, sale_date: saleDate, created_by: currentUser.id })
          await supabase.from('product_skus').update({ stock: (freshSku?.stock || 0) - item.qty }).eq('id', item.sku.id)
        }
      }
      toast.success('판매 저장 완료')
      onSaved()
      onClose()
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-surface-950 z-50 flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-surface-900 border-b border-surface-800 shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-surface-800 text-surface-400 hover:text-white rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-white">판매 추가</h1>
        <div className="flex-1" />
        <button onClick={handleSave} disabled={saving || !saleDate}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
          <Save size={15} />{saving ? '저장 중...' : '판매 저장'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden grid lg:grid-cols-2 gap-0">
        {/* 왼쪽: 상품 선택 */}
        <div className="flex flex-col border-r border-surface-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-800 shrink-0">
            <h2 className="text-sm font-semibold text-white mb-2">상품 선택</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="상품 검색..."
                  className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
              </div>
              {selectedCount > 0 && (
                <button onClick={addChecked} className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-semibold shrink-0">
                  <Plus size={12} /> {selectedCount}개 추가
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : Object.entries(catMap).map(([catId, prods]) => {
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
                          <button onClick={() => openGrid(prod)} className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-500/15 hover:bg-primary-500/25 text-primary-400 rounded-lg text-xs font-medium transition-colors shrink-0">
                            <Plus size={11} /> 상세보기
                          </button>
                        </div>
                        {prodOpen && skus.map(sku => {
                          const alreadyIn = existingSkuIds.has(sku.id)
                          const hasSale = !!saleDateSales[sku.id]
                          return (
                            <div key={sku.id} className={'flex items-center gap-2 pl-12 pr-3 py-1.5 border-t border-surface-800/20 ' + (alreadyIn ? 'opacity-50' : '')}>
                              <Chk state={alreadyIn ? false : !!checked[sku.id]} onChange={() => toggleSku(sku.id)} />
                              <span className="flex-1 text-xs text-surface-300">{skuLabel(sku)}</span>
                              {hasSale && <span className="text-xs text-primary-400/70">판매{saleDateSales[sku.id].quantity}</span>}
                              <span className="text-xs text-surface-500 font-mono">재고 {sku.stock}</span>
                              {alreadyIn && <span className="text-xs text-primary-400">추가됨</span>}
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

        {/* 오른쪽: 판매 날짜 + 판매 목록 */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-800 shrink-0">
            <h2 className="text-sm font-semibold text-white mb-2">판매 날짜 <span className="text-red-400">*</span></h2>
            <DatePicker value={saleDate} onChange={setSaleDate} markedDates={allSaleDates} />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-sm font-semibold text-white mb-3">판매 목록</h2>
            {saleItems.length === 0 ? (
              <div className="text-center py-8 text-surface-500 text-xs">왼쪽에서 상품을 선택하세요</div>
            ) : (
              <div className="space-y-2">
                {saleItems.map((item, idx) => (
                  <div key={item.sku.id} className="flex items-center gap-2 bg-surface-800/40 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                      <p className="text-xs text-surface-400">{skuLabel(item.sku)}</p>
                    </div>
                    <input type="number" min="0" value={item.qty || ''}
                      onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
                      onChange={e => {
                        const v = parseInt(e.target.value.replace(/[^0-9]/g,'')) || 0
                        setSaleItems(p => p.map((it, i) => i === idx ? { ...it, qty: v } : it))
                      }}
                      placeholder="0"
                      className="w-20 text-center bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-primary-500" />
                    <button onClick={() => setSaleItems(p => p.filter((_, i) => i !== idx))}
                      className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상세보기 그리드 모달 */}
      {activeGrid && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-2 sm:p-4">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full flex flex-col shadow-2xl" style={{ maxWidth: activeGrid.hasOpt2 ? '100vw' : '640px', maxHeight: '98vh', height: activeGrid.hasOpt2 ? '98vh' : 'auto' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800 shrink-0">
              <div>
                <h3 className="font-semibold text-white">{activeGrid.product.name}</h3>
                <p className="text-xs text-surface-500 mt-0.5">판매수량 입력 — {saleDate}</p>
              </div>
              <button onClick={() => setActiveGrid(null)} className="text-surface-400 hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="p-5 flex-1 flex flex-col min-h-0">
              <StockGrid skus={activeGrid.skus} values={gridValues} onChange={(id, v) => setGridValues(p => ({ ...p, [id]: v }))}
                bulkValue={bulkVal} onBulkChange={setBulkVal}
                onBulkApply={() => { if (!bulkVal) return; const n = {}; activeGrid.skus.forEach(s => { n[s.id] = bulkVal }); setGridValues(n) }} />
            </div>
            <div className="px-5 py-4 border-t border-surface-800 flex gap-3 shrink-0">
              <button onClick={() => setActiveGrid(null)} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium">취소</button>
              <button onClick={handleGridAdd} className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-xl text-sm font-semibold">
                <Plus size={15} /> 판매 목록에 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 메인: 판매 기록 리스트 ────────────────────────────────
export default function SalesRecordsPage() {
  const { user } = useAuth()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchName, setSearchName] = useState('')
  const [expandedMonths, setExpandedMonths] = useState({})
  const [expandedDates, setExpandedDates] = useState({})
  const [expandedCats, setExpandedCats] = useState({})
  const [expandedProds, setExpandedProds] = useState({})
  const [checked, setChecked] = useState({}) // saleId -> bool
  const [showAddPage, setShowAddPage] = useState(false)
  const [editSale, setEditSale] = useState(null) // { sale, mode: 'qty' }

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase.from('sales')
      .select(`id, quantity, sale_price, margin, sale_date, product_sku_id, created_at,
        product_skus(
          products(id, name, category_id, categories(name)),
          o1:option1_id(option_value),
          o2:option2_id(option_value)
        )`)
      .eq('created_by', user.id)
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })
    setSales(data || [])
    setLoading(false)
  }

  async function deleteSale(saleId) {
    const sale = sales.find(s => s.id === saleId)
    if (!sale || !confirm('삭제 시 재고가 복구됩니다. 계속하시겠습니까?')) return
    try {
      const { data: sku } = await supabase.from('product_skus').select('stock').eq('id', sale.product_sku_id).single()
      await supabase.from('product_skus').update({ stock: (sku?.stock || 0) + sale.quantity }).eq('id', sale.product_sku_id)
      await supabase.from('sales').delete().eq('id', saleId)
      toast.success('삭제 완료'); loadAll()
    } catch(err) { toast.error(err.message) }
  }

  async function deleteMultiple(ids) {
    if (!ids.length || !confirm(`${ids.length}개 판매를 삭제하시겠습니까? 재고가 복구됩니다.`)) return
    try {
      for (const id of ids) {
        const sale = sales.find(s => s.id === id)
        if (!sale) continue
        const { data: sku } = await supabase.from('product_skus').select('stock').eq('id', sale.product_sku_id).single()
        await supabase.from('product_skus').update({ stock: (sku?.stock || 0) + sale.quantity }).eq('id', sale.product_sku_id)
        await supabase.from('sales').delete().eq('id', id)
      }
      toast.success(`${ids.length}개 삭제 완료`); setChecked({}); loadAll()
    } catch(err) { toast.error(err.message) }
  }

  async function updateSaleQty(sale, newQty) {
    const diff = newQty - sale.quantity
    try {
      await supabase.from('sales').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', sale.id)
      const { data: sku } = await supabase.from('product_skus').select('stock').eq('id', sale.product_sku_id).single()
      await supabase.from('product_skus').update({ stock: (sku?.stock || 0) - diff }).eq('id', sale.product_sku_id)
      toast.success('수정 완료'); setEditSale(null); loadAll()
    } catch(err) { toast.error(err.message) }
  }

  function skuLabel(sale) {
    return [sale.product_skus?.o1?.option_value, sale.product_skus?.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
  }

  const filtered = useMemo(() => {
    if (!searchName.trim()) return sales
    const q = searchName.toLowerCase()
    return sales.filter(s => (s.product_skus?.products?.name || '').toLowerCase().includes(q))
  }, [sales, searchName])

  // Build tree: month -> date -> catId -> prodId -> [sales]
  const tree = useMemo(() => {
    const months = {}
    filtered.forEach(sale => {
      const month = (sale.sale_date || '').slice(0, 7)
      const date = sale.sale_date || ''
      const catId = sale.product_skus?.products?.category_id || '__none__'
      const catName = sale.product_skus?.products?.categories?.name || '미분류'
      const prodId = sale.product_skus?.products?.id || '__none__'
      const prodName = sale.product_skus?.products?.name || '알 수 없음'

      if (!months[month]) months[month] = { dates: {} }
      if (!months[month].dates[date]) months[month].dates[date] = { cats: {} }
      const dateNode = months[month].dates[date]
      if (!dateNode.cats[catId]) dateNode.cats[catId] = { name: catName, prods: {} }
      const catNode = dateNode.cats[catId]
      if (!catNode.prods[prodId]) catNode.prods[prodId] = { name: prodName, sales: [] }
      catNode.prods[prodId].sales.push(sale)
    })
    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  // Checkbox helpers
  const checkedIds = Object.keys(checked).filter(id => checked[id])

  function chkState(ids) {
    const n = ids.filter(id => checked[id]).length
    return n === 0 ? false : n === ids.length ? true : 'partial'
  }
  function toggleAll(ids) {
    const allOn = ids.every(id => checked[id])
    setChecked(p => { const n = { ...p }; ids.forEach(id => { n[id] = !allOn }); return n })
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {showAddPage && (
        <SaleAddPage onClose={() => setShowAddPage(false)} onSaved={loadAll} currentUser={user} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">판매 기록</h1>
          <p className="text-surface-400 text-sm mt-0.5">전체 판매 이력</p>
        </div>
        <button onClick={() => setShowAddPage(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors">
          <Plus size={15} /> 판매 추가
        </button>
      </div>

      {checkedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
          <span className="text-sm text-red-400 font-medium">{checkedIds.length}개 선택됨</span>
          <button onClick={() => deleteMultiple(checkedIds)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-colors">
            <Trash2 size={12} /> 선택 삭제
          </button>
          <button onClick={() => setChecked({})} className="text-xs text-surface-400 hover:text-white ml-auto">취소</button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
        <input value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="상품명 검색..."
          className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : tree.length === 0 ? (
        <div className="text-center py-16 text-surface-500"><Package size={36} className="mx-auto mb-2 opacity-20" /><p className="text-sm">판매 기록이 없습니다</p></div>
      ) : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-800/60 border-b border-surface-800">
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">항목</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase w-20">수량</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase w-24">관리</th>
              </tr>
            </thead>
            <tbody>
              {tree.map(([month, { dates }]) => {
                const [y, m] = month.split('-')
                const monthOpen = expandedMonths[month] ?? false
                const allSaleIds = Object.values(dates).flatMap(d => Object.values(d.cats).flatMap(c => Object.values(c.prods).flatMap(p => p.sales.map(s => s.id))))
                const monthQty = allSaleIds.reduce((s, id) => s + (sales.find(sl => sl.id === id)?.quantity || 0), 0)
                return [
                  // ── 월 행 ──────────────────────────────────
                  <tr key={`m-${month}`} className="bg-surface-800/60 border-b border-surface-700/60 hover:bg-surface-800 transition-colors cursor-pointer">
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <Chk state={chkState(allSaleIds)} onChange={() => toggleAll(allSaleIds)} />
                    </td>
                    <td className="px-4 py-2.5" onClick={() => setExpandedMonths(p => ({ ...p, [month]: !monthOpen }))}>
                      <div className="flex items-center gap-2">
                        {monthOpen ? <ChevronDown size={13} className="text-surface-500" /> : <ChevronRight size={13} className="text-surface-500" />}
                        <span className="text-sm font-bold text-surface-200">{y}년 {parseInt(m)}월</span>
                        <span className="text-xs text-surface-600">({Object.keys(dates).length}일)</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-primary-400">{monthQty}</td>
                    <td />
                  </tr>,
                  // ── 날짜 행들 ─────────────────────────────
                  ...(!monthOpen ? [] : Object.entries(dates).sort((a, b) => b[0].localeCompare(a[0])).flatMap(([date, { cats }]) => {
                    const dateOpen = expandedDates[date] ?? false
                    const dateSaleIds = Object.values(cats).flatMap(c => Object.values(c.prods).flatMap(p => p.sales.map(s => s.id)))
                    const dateQty = dateSaleIds.reduce((s, id) => s + (sales.find(sl => sl.id === id)?.quantity || 0), 0)
                    return [
                      <tr key={`d-${date}`} className="border-b border-surface-800/40 hover:bg-surface-800/20 transition-colors cursor-pointer">
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <Chk state={chkState(dateSaleIds)} onChange={() => toggleAll(dateSaleIds)} />
                        </td>
                        <td className="px-4 py-2.5" onClick={() => setExpandedDates(p => ({ ...p, [date]: !dateOpen }))}>
                          <div className="flex items-center gap-2 pl-4">
                            {dateOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
                            <Calendar size={11} className="text-surface-500" />
                            <span className="text-sm font-semibold text-white">{date}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-surface-300">{dateQty}</td>
                        <td />
                      </tr>,
                      ...(!dateOpen ? [] : Object.entries(cats).flatMap(([catId, { name: catName, prods }]) => {
                        const catKey = `${date}-${catId}`
                        const catOpen2 = expandedCats[catKey] ?? false
                        const catSaleIds = Object.values(prods).flatMap(p => p.sales.map(s => s.id))
                        const catQty = catSaleIds.reduce((s, id) => s + (sales.find(sl => sl.id === id)?.quantity || 0), 0)
                        return [
                          <tr key={`c-${catKey}`} className="border-b border-surface-800/30 hover:bg-surface-800/10 transition-colors cursor-pointer">
                            <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                              <Chk state={chkState(catSaleIds)} onChange={() => toggleAll(catSaleIds)} />
                            </td>
                            <td className="px-4 py-2" onClick={() => setExpandedCats(p => ({ ...p, [catKey]: !catOpen2 }))}>
                              <div className="flex items-center gap-2 pl-9">
                                {catOpen2 ? <ChevronDown size={11} className="text-surface-500" /> : <ChevronRight size={11} className="text-surface-500" />}
                                <span className="text-xs font-semibold text-surface-400 uppercase tracking-wide">{catName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center font-mono text-surface-400 text-xs">{catQty}</td>
                            <td />
                          </tr>,
                          ...(!catOpen2 ? [] : Object.entries(prods).flatMap(([prodId, { name: prodName, sales: prodSales }]) => {
                            const prodKey = `${catKey}-${prodId}`
                            const prodOpen2 = expandedProds[prodKey] ?? false
                            const prodSaleIds = prodSales.map(s => s.id)
                            const prodQty = prodSales.reduce((s, sale) => s + sale.quantity, 0)
                            return [
                              <tr key={`p-${prodKey}`} className="border-b border-surface-800/20 hover:bg-surface-800/10 transition-colors cursor-pointer">
                                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                  <Chk state={chkState(prodSaleIds)} onChange={() => toggleAll(prodSaleIds)} />
                                </td>
                                <td className="px-4 py-2" onClick={() => setExpandedProds(p => ({ ...p, [prodKey]: !prodOpen2 }))}>
                                  <div className="flex items-center gap-2 pl-14">
                                    {prodOpen2 ? <ChevronDown size={11} className="text-surface-500" /> : <ChevronRight size={11} className="text-surface-500" />}
                                    <span className="text-sm font-medium text-white">{prodName}</span>
                                    <span className="text-xs text-surface-600">({prodSales.length})</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-center font-mono text-surface-300 font-bold">{prodQty}</td>
                                <td />
                              </tr>,
                              ...(!prodOpen2 ? [] : prodSales.map(sale => {
                                const isEditing = editSale?.sale?.id === sale.id
                                return (
                                  <tr key={`s-${sale.id}`} className="border-b border-surface-800/10 hover:bg-surface-800/5 transition-colors">
                                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                      <Chk state={!!checked[sale.id]} onChange={() => setChecked(p => ({ ...p, [sale.id]: !p[sale.id] }))} />
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-2 pl-20">
                                        <span className="w-1 h-1 rounded-full bg-surface-700 shrink-0" />
                                        <span className="text-xs text-surface-400">{skuLabel(sale)}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      {isEditing ? (
                                        <EditQtyCell sale={sale} onSave={updateSaleQty} onCancel={() => setEditSale(null)} />
                                      ) : (
                                        <button onClick={() => setEditSale({ sale })} className="font-mono font-bold text-white text-sm hover:text-primary-400 transition-colors">{sale.quantity}</button>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <button onClick={() => deleteSale(sale.id)}
                                        className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors">
                                        <Trash2 size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                )
                              }))
                            ]
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

function EditQtyCell({ sale, onSave, onCancel }) {
  const [qty, setQty] = useState(String(sale.quantity))
  return (
    <div className="flex items-center gap-1 justify-center">
      <input type="number" min="0" value={qty}
        onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
        onChange={e => setQty(e.target.value.replace(/[^0-9]/g,''))}
        autoFocus className="w-16 text-center bg-surface-800 border border-primary-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
      <button onClick={() => { const v = parseInt(qty); if (!isNaN(v) && v >= 0) onSave(sale, v) }}
        className="p-1 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"><Save size={10} /></button>
      <button onClick={onCancel} className="p-1 bg-surface-700 text-surface-300 rounded-lg"><X size={10} /></button>
    </div>
  )
}
