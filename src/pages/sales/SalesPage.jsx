import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Star, BarChart2, Search, Save, SlidersHorizontal, ChevronRight, ChevronDown, Trash2, Eye, X, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'

const TODAY = new Date().toISOString().slice(0, 10)
const ALL_COLS = [
  { key: 'location', label: '위치' },
  { key: 'sale_price', label: '판매가' },
  { key: 'margin', label: '마진' },
]

// ── 상품 상세 판매 모달 (입고관리 StockGrid와 동일 구조) ──
function SaleGridModal({ product, skus, onClose, onSave }) {
  const [values, setValues] = useState({})
  const [bulkVal, setBulkVal] = useState('')
  const [saving, setSaving] = useState(false)

  const opt1Vals = useMemo(() => {
    const seen = new Map()
    skus.forEach(s => {
      if (s.o1) seen.set(s.o1.option_value, s.o1)
      else seen.set('Default', { option_value: 'Default', sort_order: 0 })
    })
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

  function applyBulk() {
    if (!bulkVal) return
    const next = {}
    skus.forEach(s => { next[s.id] = bulkVal })
    setValues(next)
  }

  const hasAny = Object.values(values).some(v => v && parseInt(v) > 0)

  async function handleSave() {
    const entries = Object.entries(values).filter(([, v]) => v && parseInt(v) > 0)
    if (!entries.length) return toast.error('판매수량을 입력하세요')
    setSaving(true)
    try {
      await onSave(entries.map(([id, v]) => ({ skuId: id, qty: parseInt(v) })))
      onClose()
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  function renderCell(sku, key) {
    if (!sku) return <td key={key} className="px-3 py-2.5 text-center text-surface-600 text-xs">-</td>
    const val = values[sku.id] ?? ''
    return (
      <td key={key} className="px-2 py-2">
        <div className={"text-center text-xs mb-1 font-mono font-bold " + (sku.stock <= 5 ? 'text-red-400' : sku.stock < 10 ? 'text-yellow-400' : 'text-surface-400')}>
          재고 {sku.stock}
        </div>
        <input type="number" min="0" value={val}
          onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
          onChange={e => setValues(p => ({ ...p, [sku.id]: e.target.value.replace(/[^0-9]/g, '') }))}
          placeholder="0"
          className={"w-full text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none transition-colors " + (val > 0 ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700')} />
      </td>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full flex flex-col shadow-2xl"
        style={{ maxWidth: hasOpt2 ? '100vw' : '640px', maxHeight: '98vh', height: hasOpt2 ? '98vh' : 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800 shrink-0">
          <div>
            <h3 className="font-semibold text-white">{product.name}</h3>
            <p className="text-xs text-surface-500 mt-0.5">판매수량 입력 (0이면 제외됨)</p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white p-1"><X size={18} /></button>
        </div>
        {/* 일괄 적용 */}
        <div className="px-5 pt-4 shrink-0">
          <div className="flex items-center gap-3 p-3 bg-surface-800/60 rounded-xl flex-wrap">
            <span className="text-xs text-surface-400 shrink-0">일괄 적용:</span>
            <input type="number" min="0" value={bulkVal}
              onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
              onChange={e => setBulkVal(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="수량"
              className="w-28 bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-primary-500" />
            <button onClick={applyBulk} className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">전체 적용</button>
          </div>
        </div>
        {/* 그리드 */}
        <div className="p-5 flex-1 flex flex-col min-h-0">
          <div className="rounded-xl border border-surface-700" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table className="border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface-800">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-400 border-b border-surface-700 sticky left-0 bg-surface-800 min-w-32 z-20">
                    {hasOpt2 ? `${opt1Vals[0]?.option_name || '옵션1'} \\ ${opt2Vals[0]?.option_name || '옵션2'}` : (opt1Vals[0]?.option_name || '옵션')}
                  </th>
                  {hasOpt2
                    ? opt2Vals.map(v2 => <th key={v2.option_value} className="px-3 py-2.5 text-center text-xs font-semibold text-surface-300 border-b border-surface-700 min-w-28">{v2.option_value}</th>)
                    : <th className="px-3 py-2.5 text-center text-xs font-semibold text-surface-400 border-b border-surface-700 min-w-28">판매수량</th>
                  }
                </tr>
              </thead>
              <tbody>
                {opt1Vals.map(v1 => (
                  <tr key={v1.option_value} className="border-b border-surface-700/40 last:border-0 hover:bg-surface-800/20">
                    <td className="px-3 py-2.5 text-sm font-medium text-surface-200 sticky left-0 bg-surface-900 border-r border-surface-700/40">
                      {v1.option_value}
                    </td>
                    {hasOpt2
                      ? opt2Vals.map(v2 => renderCell(getSku(v1.option_value, v2.option_value), v2.option_value))
                      : renderCell(getSku(v1.option_value, null), 'single')
                    }
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-surface-800 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium">취소</button>
          <button onClick={handleSave} disabled={saving || !hasAny}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Save size={15} />{saving ? '저장 중...' : '판매 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────
export default function SalesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [todaySales, setTodaySales] = useState([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [treeData, setTreeData] = useState([])
  const [favSkuIds, setFavSkuIds] = useState(new Set())
  const [favSkus, setFavSkus] = useState([])
  const [searchName, setSearchName] = useState('')
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedCats, setExpandedCats] = useState({})
  const [expandedProds, setExpandedProds] = useState({})
  const [visibleCols, setVisibleCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sales_cols')) || ALL_COLS.map(c => c.key) }
    catch(e) { return ALL_COLS.map(c => c.key) }
  })
  const [showColMenu, setShowColMenu] = useState(false)
  const [activeGrid, setActiveGrid] = useState(null) // { product, skus }
  const [skuMap, setSkuMap] = useState({})
  const [prodMap, setProdMap] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: cats }, { data: prods }, { data: skuData },
      { data: favData }, { data: salesData }
    ] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
      supabase.from('products').select('id, name, sale_price, cost_price, margin, storage_location_text, category_id').eq('is_active', true),
      supabase.from('product_skus').select('id, stock, product_id, o1:option1_id(option_name, option_value, sort_order), o2:option2_id(option_name, option_value, sort_order)').eq('is_active', true),
      supabase.from('favorites').select('id, product_sku_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('sales').select('id, quantity, sale_price, margin, product_sku_id, product_skus(products(name, storage_location_text), o1:option1_id(option_value), o2:option2_id(option_value))').eq('sale_date', TODAY).eq('created_by', user.id)
    ])

    const skuM = {}
    ;(skuData || []).forEach(s => { skuM[s.id] = s })
    const prodM = {}
    ;(prods || []).forEach(p => { prodM[p.id] = p })
    setSkuMap(skuM)
    setProdMap(prodM)

    const favSet = new Set((favData || []).map(f => f.product_sku_id))
    setFavSkuIds(favSet)

    const favList = (favData || []).map(f => {
      const sku = skuM[f.product_sku_id]
      if (!sku) return null
      return { ...sku, product: prodM[sku.product_id], favId: f.id }
    }).filter(Boolean)
    setFavSkus(favList)

    const catMap = {}
    ;(cats || []).forEach(c => { catMap[c.id] = { ...c, products: [] } })
    ;(prods || []).forEach(p => {
      const cid = p.category_id
      const skus = (skuData || []).filter(s => s.product_id === p.id).sort((a,b) => {
        const d1 = (a.o1?.sort_order??999)-(b.o1?.sort_order??999)
        if(d1!==0) return d1
        return (a.o2?.sort_order??999)-(b.o2?.sort_order??999)
      })
      const prodWithSkus = { ...p, skus }
      if (cid && catMap[cid]) catMap[cid].products.push(prodWithSkus)
      else {
        if (!catMap['__none__']) catMap['__none__'] = { id: '__none__', name: '미분류', products: [] }
        catMap['__none__'].products.push(prodWithSkus)
      }
    })
    setTreeData(Object.values(catMap).filter(c => c.products.length > 0))

    const sales = salesData || []
    setTodaySales(sales.sort((a, b) => b.quantity - a.quantity))
    setTotalRevenue(sales.reduce((s, r) => s + (r.sale_price || 0) * (r.quantity || 0), 0))
    setTotalProfit(sales.reduce((s, r) => s + (r.margin || 0) * (r.quantity || 0), 0))
    setLoading(false)
  }

  async function saveSale(sku, product) {
    const qty = parseInt(quantities[sku.id] || 0)
    if (!qty || qty <= 0) return toast.error('판매수량을 입력하세요')
    if (qty > sku.stock) return toast.error('재고 부족 (현재: ' + sku.stock + ')')
    try {
      const { data: freshSku } = await supabase.from('product_skus').select('stock, products(sale_price, margin)').eq('id', sku.id).single()
      const salePrice = freshSku?.products?.sale_price || product?.sale_price || 0
      const margin = freshSku?.products?.margin || product?.margin || 0
      const existing = todaySales.find(s => s.product_sku_id === sku.id)
      if (existing) {
        await supabase.from('sales').update({ quantity: existing.quantity + qty, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('sales').insert({ product_sku_id: sku.id, quantity: qty, sale_price: salePrice, margin, sale_date: TODAY, created_by: user.id })
      }
      await supabase.from('product_skus').update({ stock: (freshSku?.stock || sku.stock) - qty }).eq('id', sku.id)
      toast.success('저장 완료')
      setQuantities(p => ({ ...p, [sku.id]: '' }))
      loadAll()
    } catch(err) { toast.error(err.message) }
  }

  // 상세보기 모달에서 여러 SKU 한번에 저장
  async function saveGridSales(entries) {
    for (const { skuId, qty } of entries) {
      const sku = skuMap[skuId]
      const product = sku ? prodMap[sku.product_id] : null
      if (!sku || !product) continue
      if (qty > sku.stock) { toast.error(`재고 부족: ${product.name} (현재 ${sku.stock})`); continue }
      const { data: freshSku } = await supabase.from('product_skus').select('stock, products(sale_price, margin)').eq('id', skuId).single()
      const salePrice = freshSku?.products?.sale_price || product.sale_price || 0
      const margin = freshSku?.products?.margin || product.margin || 0
      const existing = todaySales.find(s => s.product_sku_id === skuId)
      if (existing) {
        await supabase.from('sales').update({ quantity: existing.quantity + qty, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('sales').insert({ product_sku_id: skuId, quantity: qty, sale_price: salePrice, margin, sale_date: TODAY, created_by: user.id })
      }
      await supabase.from('product_skus').update({ stock: (freshSku?.stock || sku.stock) - qty }).eq('id', skuId)
    }
    toast.success('판매 저장 완료')
    loadAll()
  }

  async function updateSaleQty(sale, newQty) {
    if (newQty < 0) return
    const diff = newQty - sale.quantity
    try {
      await supabase.from('sales').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', sale.id)
      const { data: sku } = await supabase.from('product_skus').select('stock').eq('id', sale.product_sku_id).single()
      await supabase.from('product_skus').update({ stock: sku.stock - diff }).eq('id', sale.product_sku_id)
      toast.success('수정 완료'); loadAll()
    } catch(err) { toast.error(err.message) }
  }

  async function deleteSaleRow(saleId) {
    const sale = todaySales.find(s => s.id === saleId)
    if (!sale || !confirm('삭제 시 재고가 복구됩니다. 계속하시겠습니까?')) return
    try {
      const { data: sku } = await supabase.from('product_skus').select('stock').eq('id', sale.product_sku_id).single()
      await supabase.from('product_skus').update({ stock: (sku?.stock || 0) + sale.quantity }).eq('id', sale.product_sku_id)
      await supabase.from('sales').delete().eq('id', saleId)
      toast.success('삭제 완료 (재고 복구됨)'); loadAll()
    } catch(err) { toast.error(err.message) }
  }

  function toggleCol(key) {
    const next = visibleCols.includes(key) ? visibleCols.filter(k => k !== key) : [...visibleCols, key]
    setVisibleCols(next); localStorage.setItem('sales_cols', JSON.stringify(next))
  }
  const show = k => visibleCols.includes(k)

  const filteredTree = useMemo(() => {
    if (!searchName.trim()) return treeData
    const q = searchName.toLowerCase()
    return treeData.map(cat => ({
      ...cat, products: cat.products.filter(p => p.name.toLowerCase().includes(q))
    })).filter(c => c.products.length > 0)
  }, [treeData, searchName])

  const filteredFavs = useMemo(() =>
    favSkus.filter(sku => !searchName || (sku.product?.name || '').toLowerCase().includes(searchName.toLowerCase())),
    [favSkus, searchName]
  )

  return (
    <div className="space-y-5 max-w-5xl" onClick={() => showColMenu && setShowColMenu(false)}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">오늘 판매</h1>
          <p className="text-surface-400 text-sm mt-0.5">{TODAY}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/sales/records')}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-300 hover:text-white rounded-xl text-sm font-medium transition-colors">
            <ClipboardList size={15} /> 판매기록
          </button>
          <button onClick={() => navigate('/sales/favorites')}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-300 hover:text-white rounded-xl text-sm font-medium transition-colors">
            <Star size={15} /> 즐겨찾기
          </button>
          <button onClick={() => navigate('/sales/report')}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors">
            <BarChart2 size={15} /> 매출조회
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
          <p className="text-xs text-surface-400 mb-1">오늘 매출</p>
          <p className="text-2xl font-bold text-white">&#8361;{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
          <p className="text-xs text-surface-400 mb-1">오늘 순이익</p>
          <p className="text-2xl font-bold text-emerald-400">&#8361;{totalProfit.toLocaleString()}</p>
        </div>
      </div>

      {/* 오늘 판매 목록 */}
      {todaySales.length > 0 && (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
            <h2 className="font-semibold text-white text-sm">오늘 판매 목록</h2>
            <div className="relative">
              <button onClick={e => { e.stopPropagation(); setShowColMenu(!showColMenu) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-400 rounded-lg text-xs transition-colors">
                <SlidersHorizontal size={12} /> 컬럼
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-9 bg-surface-900 border border-surface-700 rounded-xl p-3 z-20 shadow-2xl min-w-32" onClick={e => e.stopPropagation()}>
                  {ALL_COLS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-white text-surface-300 text-sm">
                      <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => toggleCol(col.key)} className="accent-primary-500" />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-800/40 border-b border-surface-800 text-xs font-semibold text-surface-400 uppercase">
                  <th className="px-3 py-2.5 text-left">상품명</th>
                  <th className="px-3 py-2.5 text-left">옵션</th>
                  {show('location') && <th className="px-3 py-2.5 text-left">위치</th>}
                  {show('sale_price') && <th className="px-3 py-2.5 text-right">판매가</th>}
                  {show('margin') && <th className="px-3 py-2.5 text-right">마진</th>}
                  <th className="px-3 py-2.5 text-center">판매수량</th>
                  <th className="px-3 py-2.5 text-center">수정</th>
                  <th className="px-3 py-2.5 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {todaySales.map(sale => (
                  <SaleRow key={sale.id} sale={sale} show={show} onUpdate={updateSaleQty} onDelete={deleteSaleRow} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 상품 목록 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800">
          <h2 className="font-semibold text-white text-sm shrink-0">상품 목록</h2>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="상품명 검색..."
              className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div>
            {/* 즐겨찾기 */}
            {filteredFavs.length > 0 && (
              <div className="border-b border-surface-800">
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 border-b border-amber-500/10">
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">즐겨찾기</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-800/20 text-xs text-surface-500">
                      <th className="px-4 py-2 text-left">상품명</th>
                      <th className="px-4 py-2 text-left">옵션</th>
                      <th className="px-4 py-2 text-center">재고</th>
                      <th className="px-4 py-2 text-center w-28">판매수량</th>
                      <th className="px-4 py-2 text-center">저장</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800/40">
                    {filteredFavs.map(sku => (
                      <SkuRow key={sku.id} sku={sku} product={sku.product}
                        qty={quantities[sku.id] || ''}
                        onQtyChange={v => setQuantities(p => ({ ...p, [sku.id]: v }))}
                        onSave={() => saveSale(sku, sku.product)} isFav />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* 카테고리 트리 */}
            {filteredTree.map(cat => (
              <div key={cat.id} className="border-b border-surface-800 last:border-0">
                <button onClick={() => setExpandedCats(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-800/20 transition-colors text-left">
                  {expandedCats[cat.id] ? <ChevronDown size={14} className="text-surface-400" /> : <ChevronRight size={14} className="text-surface-400" />}
                  <span className="text-sm font-semibold text-surface-200">{cat.name}</span>
                  <span className="text-xs text-surface-600 ml-1">({cat.products.length})</span>
                </button>
                {expandedCats[cat.id] && (cat.products || []).map(prod => (
                  <div key={prod.id}>
                    {/* 상품 행: 이름 + 상세보기 버튼 */}
                    <div className="flex items-center pl-8 pr-4 py-2 hover:bg-surface-800/10 transition-colors">
                      <button onClick={() => setExpandedProds(p => ({ ...p, [prod.id]: !p[prod.id] }))}
                        className="flex items-center gap-2 flex-1 text-left min-w-0">
                        {expandedProds[prod.id] ? <ChevronDown size={12} className="text-surface-500 shrink-0" /> : <ChevronRight size={12} className="text-surface-500 shrink-0" />}
                        <span className="text-sm text-white truncate">{prod.name}</span>
                        {prod.skus.some(s => favSkuIds.has(s.id)) && <Star size={9} className="text-amber-400 fill-amber-400 shrink-0" />}
                        <span className="text-xs text-surface-600 shrink-0">({prod.skus.length})</span>
                      </button>
                      {/* 상세보기 버튼 */}
                      <button onClick={() => setActiveGrid({ product: prod, skus: prod.skus })}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-800 hover:bg-primary-500/20 hover:text-primary-400 text-surface-400 rounded-lg text-xs transition-colors shrink-0 ml-2">
                        <Eye size={11} /> 상세보기
                      </button>
                    </div>
                    {expandedProds[prod.id] && (
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-surface-800/20">
                          {prod.skus.map(sku => (
                            <SkuRow key={sku.id} sku={sku} product={prod}
                              qty={quantities[sku.id] || ''}
                              onQtyChange={v => setQuantities(p => ({ ...p, [sku.id]: v }))}
                              onSave={() => saveSale(sku, prod)}
                              isFav={favSkuIds.has(sku.id)} indent />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세보기 모달 */}
      {activeGrid && (
        <SaleGridModal
          product={activeGrid.product}
          skus={activeGrid.skus}
          onClose={() => setActiveGrid(null)}
          onSave={saveGridSales}
        />
      )}
    </div>
  )
}

function SkuRow({ sku, product, qty, onQtyChange, onSave, isFav, indent }) {
  const opt = [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
  return (
    <tr className={'hover:bg-surface-800/20 transition-colors' + (isFav && !indent ? ' bg-amber-500/3' : '')}>
      <td className={(indent ? 'pl-16' : 'pl-4') + ' pr-3 py-2.5'}>
        {indent ? (
          <span className="text-surface-300 text-sm">{opt}</span>
        ) : (
          <div className="flex items-center gap-1.5">
            {isFav && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
            <span className="text-surface-100 text-sm">{product?.name}</span>
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-surface-400 text-sm">{indent ? '' : opt}</td>
      <td className="px-3 py-2.5 text-center">
        <span className={'font-mono text-sm ' + (sku.stock <= 5 ? 'text-red-400' : sku.stock < 10 ? 'text-yellow-400' : 'text-surface-300')}>{sku.stock}</span>
      </td>
      <td className="px-3 py-2.5">
        <input type="number" min="0" value={qty}
          onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
          onChange={e => onQtyChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="0"
          className="w-full text-center bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500" />
      </td>
      <td className="px-3 py-2.5 text-center">
        <button onClick={onSave} className="flex items-center gap-1 px-3 py-1.5 bg-primary-500/15 hover:bg-primary-500/25 text-primary-400 rounded-lg text-xs font-medium transition-colors mx-auto">
          <Save size={12} /> 저장
        </button>
      </td>
    </tr>
  )
}

function SaleRow({ sale, show, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [qty, setQty] = useState(sale.quantity)
  const sku = sale.product_skus
  const opt = [sku?.o1?.option_value, sku?.o2?.option_value].filter(Boolean).join(' / ')
  function handleSave() {
    const v = parseInt(qty)
    if (isNaN(v) || v < 0) return
    onUpdate(sale, v); setEditing(false)
  }
  return (
    <tr className="hover:bg-surface-800/20 transition-colors">
      <td className="px-3 py-2.5 text-surface-100 font-medium">{sku?.products?.name || '-'}</td>
      <td className="px-3 py-2.5 text-surface-400 text-sm">{opt || 'Default'}</td>
      {show('location') && <td className="px-3 py-2.5 text-surface-500 text-xs">{sku?.products?.storage_location_text || '-'}</td>}
      {show('sale_price') && <td className="px-3 py-2.5 text-right text-emerald-400 font-mono text-xs">&#8361;{Number(sale.sale_price).toLocaleString()}</td>}
      {show('margin') && <td className="px-3 py-2.5 text-right text-blue-400 font-mono text-xs">&#8361;{Number(sale.margin).toLocaleString()}</td>}
      <td className="px-3 py-2.5 text-center">
        {editing
          ? <input type="number" min="0" value={qty}
              onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
              onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))}
              autoFocus className="w-16 text-center bg-surface-800 border border-primary-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
          : <button onClick={() => setEditing(true)} className="font-bold text-white hover:text-primary-400 cursor-pointer">{sale.quantity}</button>
        }
      </td>
      <td className="px-3 py-2.5 text-center">
        {editing
          ? <button onClick={handleSave} className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors">저장</button>
          : <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-lg text-xs transition-colors">수정</button>
        }
      </td>
      <td className="px-3 py-2.5 text-center">
        <button onClick={() => onDelete(sale.id)} className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}
