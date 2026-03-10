import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Save, Search, GitBranch, Download, ChevronRight, ChevronDown, Package, Eye, X } from 'lucide-react'
import ExcelJS from 'exceljs'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

// ── 상세보기 + 재고수정 모달 ─────────────────────────────
function SkuDetailModal({ product, onClose, onSaved, currentUser }) {
  const [skus] = useState(() =>
    [...(product.product_skus || [])].sort((a, b) => {
      const d1 = (a.o1?.sort_order ?? 999) - (b.o1?.sort_order ?? 999)
      if (d1 !== 0) return d1
      return (a.o2?.sort_order ?? 999) - (b.o2?.sort_order ?? 999)
    })
  )
  const [edits, setEdits] = useState({})
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
  const pendingCount = Object.keys(edits).filter(k => edits[k] !== '').length

  function getSku(o1val, o2val) {
    if (o1val === 'Default') return skus[0]
    return skus.find(s => s.o1?.option_value === o1val && (o2val ? s.o2?.option_value === o2val : !s.o2))
  }

  function setEdit(skuId, val) {
    setEdits(p => ({ ...p, [skuId]: val.replace(/[^0-9]/g, '') }))
  }

  function applyBulk() {
    if (!bulkVal) return
    const next = {}
    skus.forEach(s => { next[s.id] = bulkVal })
    setEdits(next)
  }

  async function handleSave() {
    const entries = Object.entries(edits).filter(([, v]) => v !== '')
    if (!entries.length) return toast.error('수정할 재고를 입력하세요')
    setSaving(true)
    try {
      for (const [skuId, newStock] of entries) {
        const sku = skus.find(s => s.id === skuId)
        const optLabel = [sku?.o1?.option_value, sku?.o2?.option_value].filter(Boolean).join('/')
        await supabase.from('product_skus').update({ stock: Number(newStock), updated_at: new Date().toISOString() }).eq('id', skuId)
        await supabase.from('stock_logs').insert({
          product_sku_id: skuId, change_type: 'manual',
          quantity_before: sku?.stock ?? 0,
          quantity_change: Number(newStock) - (sku?.stock ?? 0),
          quantity_after: Number(newStock),
          option_label: optLabel,
          user_name: currentUser?.email || '',
          created_by: currentUser?.id || null,
          note: '수동 조정'
        })
      }
      toast.success(entries.length + '개 항목 저장 완료')
      setEdits({})
      if (onSaved) onSaved()
      onClose()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  function stockColor(n) {
    return n <= 5 ? 'text-red-400' : n < 10 ? 'text-yellow-400' : 'text-emerald-400'
  }

  function renderCell(sku, cellKey) {
    if (!sku) return <td key={cellKey} className="px-2 py-2 text-center text-surface-600 text-xs">-</td>
    const adj = edits[sku.id]
    return (
      <td key={cellKey} className="px-2 py-2">
        <div className={"text-center text-xs mb-1 font-mono font-bold " + stockColor(sku.stock)}>
          재고 {sku.stock}
        </div>
        <input type="number" min="0" value={adj ?? ''}
          onChange={e => setEdit(sku.id, e.target.value)}
          placeholder="새 재고"
          className={"w-full text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none transition-colors " + (adj !== undefined && adj !== '' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700')} />
      </td>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4">
      <div
        className="bg-surface-900 border border-surface-700 rounded-2xl w-full flex flex-col shadow-2xl"
        style={{ maxWidth: hasOpt2 ? '100vw' : '640px', maxHeight: '98vh', height: hasOpt2 ? '98vh' : 'auto' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800 shrink-0">
          <div>
            <h3 className="font-semibold text-white">{product.name}</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              재고 조회 및 수정 (현재재고 표시 → 아래 입력란에 새 재고 입력)
              {product.storage_location_text && <span className="ml-2">· {product.storage_location_text}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white p-1"><X size={18} /></button>
        </div>
        {/* 일괄 적용 */}
        <div className="px-5 pt-4 pb-0 shrink-0">
          <div className="flex items-center gap-3 p-3 bg-surface-800/60 rounded-xl flex-wrap">
            <span className="text-xs text-surface-400 shrink-0">일괄 적용:</span>
            <input type="number" min="0" value={bulkVal}
              onChange={e => setBulkVal(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="수량"
              className="w-28 bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-primary-500" />
            <button onClick={applyBulk}
              className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">
              전체 적용
            </button>
            {pendingCount > 0 && (
              <span className="text-xs text-primary-400 ml-auto">{pendingCount}개 수정 대기</span>
            )}
          </div>
        </div>
        {/* 그리드 */}
        <div className="p-5 flex-1 flex flex-col min-h-0">
          <div className="rounded-xl border border-surface-700" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table className="border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface-800">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-400 border-b border-surface-700 sticky left-0 bg-surface-800 min-w-32 z-20">
                    {hasOpt2
                      ? `${opt1Vals[0]?.option_name || '옵션1'} \\ ${opt2Vals[0]?.option_name || '옵션2'}`
                      : (opt1Vals[0]?.option_name || '옵션')}
                  </th>
                  {hasOpt2
                    ? opt2Vals.map(v2 => (
                        <th key={v2.option_value} className="px-3 py-2.5 text-center text-xs font-semibold text-surface-300 border-b border-surface-700 min-w-28">
                          {v2.option_value}
                        </th>
                      ))
                    : <th className="px-3 py-2.5 text-center text-xs font-semibold text-surface-400 border-b border-surface-700 min-w-32">재고 / 수정</th>
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
        {/* 버튼 */}
        <div className="px-5 py-4 border-t border-surface-800 flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium">
            닫기
          </button>
          {pendingCount > 0 && (
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold">
              <Save size={15} />{saving ? '저장 중...' : `${pendingCount}개 저장`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────
export default function InventoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adjustments, setAdjustments] = useState({})
  const [searchName, setSearchName] = useState('')
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})
  const [detailProduct, setDetailProduct] = useState(null)

  useEffect(() => { loadInventory() }, [])

  async function loadInventory() {
    setLoading(true)
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
      supabase.from('products').select(`
        id, name, image_url, storage_location_text, factory, category_id,
        categories(id, name),
        product_skus(
          id, stock,
          o1:option1_id(option_name, option_value, sort_order),
          o2:option2_id(option_name, option_value, sort_order)
        )
      `).eq('is_active', true).order('sort_order')
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    const ce = {}
    ;(cats || []).forEach(c => { ce[c.id] = true })
    ce['__none__'] = true
    setExpCats(ce)
    setLoading(false)
  }

  function getSortedSkus(skus) {
    return [...(skus || [])].sort((a, b) => {
      const d1 = (a.o1?.sort_order ?? 999) - (b.o1?.sort_order ?? 999)
      if (d1 !== 0) return d1
      return (a.o2?.sort_order ?? 999) - (b.o2?.sort_order ?? 999)
    })
  }

  const filteredProds = useMemo(() => {
    if (!searchName) return products
    return products.filter(p => p.name.toLowerCase().includes(searchName.toLowerCase()))
  }, [products, searchName])

  const tree = useMemo(() => {
    const catMap = {}
    categories.forEach(c => { catMap[c.id] = { cat: c, products: [] } })
    catMap['__none__'] = { cat: { id: '__none__', name: '미분류' }, products: [] }
    filteredProds.forEach(p => {
      const key = p.category_id || '__none__'
      if (!catMap[key]) catMap[key] = { cat: { id: key, name: '미분류' }, products: [] }
      catMap[key].products.push(p)
    })
    return Object.values(catMap).filter(g => g.products.length > 0)
  }, [categories, filteredProds])

  async function saveAdjustments() {
    const entries = Object.entries(adjustments).filter(([, v]) => v !== '' && v !== undefined)
    if (!entries.length) return toast.error('수정할 재고를 입력하세요')
    setSaving(true)
    try {
      for (const [skuId, newStock] of entries) {
        const { data: sku } = await supabase.from('product_skus')
          .select('stock, o1:option1_id(option_value), o2:option2_id(option_value)')
          .eq('id', skuId).single()
        const optLabel = [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join('/')
        await supabase.from('product_skus').update({ stock: Number(newStock), updated_at: new Date().toISOString() }).eq('id', skuId)
        await supabase.from('stock_logs').insert({
          product_sku_id: skuId, change_type: 'manual',
          quantity_before: sku.stock, quantity_change: Number(newStock) - sku.stock,
          quantity_after: Number(newStock), option_label: optLabel,
          user_name: user?.email || '', created_by: user?.id || null, note: '수동 조정'
        })
      }
      toast.success(entries.length + '개 항목 저장 완료')
      setAdjustments({})
      loadInventory()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function downloadProductExcel(product) {
    try {
      const skus = getSortedSkus(product.product_skus || [])
      const totalStock = skus.reduce((s, sk) => s + (sk.stock || 0), 0)
      const opt1Map = new Map(), opt2Map = new Map()
      skus.forEach(s => {
        opt1Map.set(s.o1?.option_value || 'Default', s.o1 || { option_value: 'Default', sort_order: 0 })
        if (s.o2) opt2Map.set(s.o2.option_value, s.o2)
      })
      const opt1Vals = [...opt1Map.values()].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      const opt2Vals = [...opt2Map.values()].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      const hasOpt2 = opt2Vals.length > 0

      const wb = new ExcelJS.Workbook()
      wb.creator = 'StockOS'
      const ws = wb.addWorksheet(product.name.replace(/[:/\\[\]*?]/g, '').slice(0, 31) || 'Sheet')

      // 상품정보: 바다색 강조5 = #4472C4
      const INFO_BG = 'FF4472C4'
      const INFO_BORDER = { style: 'thin', color: { argb: 'FF2E5FA3' } }
      const infoBorderAll = { top: INFO_BORDER, bottom: INFO_BORDER, left: INFO_BORDER, right: INFO_BORDER }
      const infoRows = [
        ['상품명', product.name],
        ['카테고리', product.categories?.name || ''],
        ['보관위치', product.storage_location_text || ''],
        ['총 재고', totalStock],
        []
      ]
      infoRows.forEach((r, idx) => {
        const row = ws.addRow(r)
        if (r.length > 0 && r[0]) {
          row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } }
          row.getCell(1).border = infoBorderAll
          row.getCell(2).font = { color: { argb: 'FFFFFFFF' }, bold: idx === 3, size: 10 }
          row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } }
          row.getCell(2).border = infoBorderAll
        }
      })

      // 옵션 헤더: 황록색 강조3 40% 더 밝게 = #A9D18E
      const OPT_BG = 'FFA9D18E'
      const DATA_BORDER = { style: 'thin', color: { argb: 'FF999999' } }
      const cellBorder = { top: DATA_BORDER, bottom: DATA_BORDER, left: DATA_BORDER, right: DATA_BORDER }

      if (!hasOpt2) {
        const hRow = ws.addRow([opt1Vals[0]?.option_name || '옵션', '재고'])
        hRow.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FF000000' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OPT_BG } }
          cell.alignment = { horizontal: 'center' }
          cell.border = cellBorder
        })
        hRow.getCell(1).alignment = { horizontal: 'left' }
        opt1Vals.forEach(v1 => {
          const sku = skus.find(s => (s.o1?.option_value || 'Default') === v1.option_value)
          const dr = ws.addRow([v1.option_value, sku?.stock ?? null])
          dr.getCell(1).font = { bold: true }
          dr.getCell(2).alignment = { horizontal: 'center' }
          if (typeof sku?.stock === 'number' && sku.stock <= 5) dr.getCell(2).font = { bold: true, color: { argb: 'FFEF4444' } }
          dr.eachCell(cell => { cell.border = cellBorder })
        })
      } else {
        const o1Name = opt1Vals[0]?.option_name || '옵션1'
        const o2Name = opt2Vals[0]?.option_name || '옵션2'
        const hRow = ws.addRow([o1Name + ' \\ ' + o2Name, ...opt2Vals.map(v => v.option_value)])
        hRow.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FF000000' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OPT_BG } }
          cell.alignment = { horizontal: 'center' }
          cell.border = cellBorder
        })
        hRow.getCell(1).alignment = { horizontal: 'left' }
        opt1Vals.forEach(v1 => {
          const cells = [v1.option_value]
          opt2Vals.forEach(v2 => {
            const sku = skus.find(s =>
              (s.o1?.option_value || 'Default') === v1.option_value &&
              s.o2?.option_value === v2.option_value
            )
            cells.push(sku !== undefined ? sku.stock : null)
          })
          const dr = ws.addRow(cells)
          dr.getCell(1).font = { bold: true }
          for (let ci = 2; ci <= cells.length; ci++) {
            dr.getCell(ci).alignment = { horizontal: 'center' }
            const val = cells[ci - 1]
            if (typeof val === 'number' && val <= 5) dr.getCell(ci).font = { bold: true, color: { argb: 'FFEF4444' } }
          }
          dr.eachCell(cell => { cell.border = cellBorder })
        })
      }

      // 셀 너비 자동
      ws.columns.forEach(col => {
        let maxLen = 8
        col.eachCell({ includeEmpty: false }, cell => {
          const v = cell.value
          const len = v ? (typeof v === 'number' ? String(v).length : String(v).length * 1.5) : 0
          if (len > maxLen) maxLen = len
        })
        col.width = Math.min(maxLen + 2, 40)
      })

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `재고_${product.name}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('엑셀 다운로드 완료')
    } catch (err) {
      console.error(err)
      toast.error('엑셀 다운로드 실패: ' + err.message)
    }
  }

  const pendingCount = Object.keys(adjustments).filter(k => adjustments[k] !== '').length

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">재고 관리</h1>
          <p className="text-surface-400 text-sm mt-0.5">{products.length}개 상품</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/inventory/history')}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-300 hover:text-white rounded-xl text-sm font-medium transition-colors">
            <GitBranch size={14} /> 재고이력
          </button>
          {pendingCount > 0 && (
            <button onClick={saveAdjustments} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              <Save size={14} />{saving ? '저장 중...' : `${pendingCount}개 저장`}
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
        <input value={searchName} onChange={e => setSearchName(e.target.value)}
          placeholder="상품명 검색..."
          className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-surface-500">
          <Package size={40} className="mb-2 opacity-20" />
          <p className="text-sm">상품이 없습니다</p>
        </div>
      ) : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-800/60 border-b border-surface-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">상품 / 옵션</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase w-24">재고</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase w-36">재고 수정</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase w-40">기능</th>
              </tr>
            </thead>
            <tbody>
              {tree.map(({ cat, products: catProds }) => {
                const catOpen = expCats[cat.id] ?? true
                const catTotal = catProds.reduce((s, p) => s + (p.product_skus || []).reduce((ss, sk) => ss + (sk.stock || 0), 0), 0)
                return [
                  <tr key={`cat-${cat.id}`}
                    className="bg-surface-800/50 border-b border-surface-700/60 cursor-pointer hover:bg-surface-800 transition-colors"
                    onClick={() => setExpCats(p => ({ ...p, [cat.id]: !catOpen }))}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {catOpen ? <ChevronDown size={13} className="text-surface-500" /> : <ChevronRight size={13} className="text-surface-500" />}
                        <span className="text-xs font-bold uppercase tracking-wide text-surface-300">{cat.name}</span>
                        <span className="text-xs text-surface-600 font-normal">({catProds.length})</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={"text-xs font-mono font-bold " + (catTotal < 20 ? 'text-yellow-500' : 'text-surface-500')}>{catTotal}</span>
                    </td>
                    <td /><td />
                  </tr>,
                  ...(!catOpen ? [] : catProds.map(product => {
                    const skus = getSortedSkus(product.product_skus || [])
                    const prodOpen = expProds[product.id] ?? false
                    const totalStock = skus.reduce((s, sk) => s + (sk.stock || 0), 0)
                    const hasOpt = skus.some(s => s.o1)
                    return [
                      <tr key={`prod-${product.id}`} className="border-b border-surface-800/40 hover:bg-surface-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 pl-5">
                            {hasOpt
                              ? <button onClick={() => setExpProds(p => ({ ...p, [product.id]: !prodOpen }))}
                                  className="text-surface-500 hover:text-white shrink-0 p-0.5">
                                  {prodOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                              : <span className="w-5 shrink-0" />
                            }
                            {product.image_url
                              ? <img src={product.image_url} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                              : <Package size={14} className="text-surface-600 shrink-0" />
                            }
                            <span className="font-medium text-white">{product.name}</span>
                            {product.storage_location_text && (
                              <span className="text-xs text-surface-600 ml-1">{product.storage_location_text}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={"font-mono font-bold " + (totalStock <= 5 ? 'text-red-400' : totalStock < 10 ? 'text-yellow-400' : 'text-emerald-400')}>
                            {totalStock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-surface-600 text-xs">—</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                            <button onClick={() => setDetailProduct(product)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-surface-800 hover:bg-primary-500/20 hover:text-primary-400 text-surface-400 rounded-lg text-xs transition-colors whitespace-nowrap">
                              <Eye size={11} /> 상세
                            </button>
                            <button onClick={() => downloadProductExcel(product)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-surface-800 hover:bg-emerald-600 text-surface-400 hover:text-white rounded-lg text-xs transition-colors whitespace-nowrap">
                              <Download size={11} /> 엑셀
                            </button>
                          </div>
                        </td>
                      </tr>,
                      ...(!prodOpen ? [] : skus.map(sku => {
                        const label = [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
                        const adj = adjustments[sku.id]
                        return (
                          <tr key={`sku-${sku.id}`}
                            className={"border-b border-surface-800/20 " + (adj !== undefined && adj !== '' ? 'bg-primary-500/5' : 'hover:bg-surface-800/10')}>
                            <td className="px-4 py-2">
                              <div className="pl-16 text-surface-400 text-xs flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-surface-700 shrink-0" />
                                {label}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={"font-mono text-sm font-bold " + (sku.stock <= 5 ? 'text-red-400' : sku.stock < 10 ? 'text-yellow-400' : 'text-surface-300')}>
                                {sku.stock}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" value={adj ?? ''}
                                onChange={e => setAdjustments(p => ({ ...p, [sku.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                placeholder="새 재고"
                                className={"w-full text-center bg-surface-800 border rounded-xl px-3 py-1.5 text-sm text-white font-mono focus:outline-none transition-colors " + (adj !== undefined && adj !== '' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700')} />
                            </td>
                            <td />
                          </tr>
                        )
                      }))
                    ]
                  }))
                ]
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailProduct && (
        <SkuDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onSaved={loadInventory}
          currentUser={user}
        />
      )}
    </div>
  )
}
