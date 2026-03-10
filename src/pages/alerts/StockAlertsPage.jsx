import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Bell, BellOff, Save, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

// ── 공통 트리 데이터 빌더 ──────────────────────────────────
function buildTree(categories, products, skusByProduct) {
  const tree = categories.map(cat => ({
    cat,
    products: products
      .filter(p => p.category_id === cat.id)
      .map(p => ({ ...p, skus: skusByProduct[p.id] || [] }))
  }))
  const uncatProds = products
    .filter(p => !p.category_id)
    .map(p => ({ ...p, skus: skusByProduct[p.id] || [] }))
  return { tree, uncatProds }
}

// ── 재고부족 현황 탭 ──────────────────────────────────────
function AlertsTab({ categories, products, skusByProduct, alertsBySkuId }) {
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})
  const { tree, uncatProds } = buildTree(categories, products, skusByProduct)

  // 부족 SKU만
  const lowSkus = useMemo(() => {
    const set = new Set()
    Object.values(alertsBySkuId).forEach(a => {
      if (a.is_active) set.add(a.product_sku_id)
    })
    return set
  }, [alertsBySkuId])

  function isLowSku(sku) {
    // 5개 이하면 무조건 부족
    if (sku.stock <= 5) return true
    // 알림 설정된 경우 threshold 이하면 부족
    const a = alertsBySkuId[sku.id]
    if (a && a.is_active && sku.stock <= a.threshold) return true
    return false
  }

  function getAlertReason(sku) {
    if (sku.stock <= 5) return `재고 ${sku.stock}개 (5개 이하 긴급)`
    const a = alertsBySkuId[sku.id]
    if (a && a.is_active) return `재고 ${sku.stock}개 / 기준 ${a.threshold}개`
    return `재고 ${sku.stock}개`
  }

  function catHasLow(prods) {
    return prods.some(p => p.skus.some(s => isLowSku(s)))
  }

  function prodHasLow(prod) {
    return prod.skus.some(s => isLowSku(s))
  }

  const allLowSkus = []
  ;[...tree.flatMap(t => t.products), ...uncatProds].forEach(p =>
    p.skus.forEach(s => { if (isLowSku(s)) allLowSkus.push({ prod: p, sku: s, alert: alertsBySkuId[s.id] }) })
  )

  if (allLowSkus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-surface-900 border border-surface-800 rounded-2xl">
        <CheckCircle size={48} className="text-emerald-400 mb-3 opacity-60" />
        <p className="text-white font-semibold">모든 재고가 정상입니다</p>
        <p className="text-surface-500 text-sm mt-1">모든 재고가 5개 초과이며 알림 기준 이상입니다</p>
      </div>
    )
  }

  const renderProds = (prods) => prods.filter(prodHasLow).map(prod => {
    const lowSkusList = prod.skus.filter(s => isLowSku(s))
    const prodOpen = expProds[prod.id]
    return (
      <div key={prod.id}>
        <div
          onClick={() => setExpProds(p => ({ ...p, [prod.id]: !p[prod.id] }))}
          className="flex items-center gap-2 pl-8 pr-4 py-2.5 hover:bg-surface-800/20 cursor-pointer transition-colors border-b border-surface-800/30 last:border-0"
        >
          {prodOpen ? <ChevronDown size={13} className="text-surface-500 shrink-0" /> : <ChevronRight size={13} className="text-surface-500 shrink-0" />}
          <span className="flex-1 text-sm font-medium text-white">{prod.name}</span>
          <span className="text-xs font-semibold text-red-400">{lowSkusList.length}개 옵션 부족</span>
        </div>
        {prodOpen && lowSkusList.map(sku => {
          const a = alertsBySkuId[sku.id]
          const label = [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
          const reason = getAlertReason(sku)
          return (
            <div key={sku.id} className="flex items-center gap-3 pl-16 pr-4 py-2.5 bg-red-500/5 border-b border-red-500/10 last:border-0">
              <AlertTriangle size={12} className="text-red-400 shrink-0" />
              <span className="flex-1 text-sm text-surface-200">{label}</span>
              <span className="text-red-400 font-mono font-bold text-base">{sku.stock}</span>
              <span className="text-xs text-surface-500">{sku.stock <= 5 ? '(5개 이하 긴급)' : `/ 기준 ${a?.threshold}`}</span>
            </div>
          )
        })}
      </div>
    )
  })

  return (
    <div className="space-y-3">
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        {tree.filter(({ products: p }) => catHasLow(p)).map(({ cat, products: prods }) => {
          const catOpen = expCats[cat.id] ?? true
          return (
            <div key={cat.id} className="border-b border-surface-800 last:border-0">
              <div onClick={() => setExpCats(p => ({ ...p, [cat.id]: !catOpen }))}
                className="flex items-center gap-2 px-4 py-3 bg-surface-800/20 hover:bg-surface-800/40 cursor-pointer transition-colors">
                {catOpen ? <ChevronDown size={15} className="text-surface-400" /> : <ChevronRight size={15} className="text-surface-400" />}
                <span className="font-semibold text-white text-sm flex-1">{cat.name}</span>
                <span className="text-xs text-red-400 font-semibold">{prods.filter(prodHasLow).length}개 상품 부족</span>
              </div>
              {catOpen && renderProds(prods)}
            </div>
          )
        })}
        {uncatProds.filter(prodHasLow).length > 0 && (
          <div className="border-b border-surface-800 last:border-0">
            <div onClick={() => setExpCats(p => ({ ...p, __none__: !p.__none__ }))}
              className="flex items-center gap-2 px-4 py-3 bg-surface-800/20 hover:bg-surface-800/40 cursor-pointer transition-colors">
              {expCats.__none__ ? <ChevronDown size={15} className="text-surface-400" /> : <ChevronRight size={15} className="text-surface-400" />}
              <span className="font-semibold text-surface-400 text-sm flex-1">미분류</span>
            </div>
            {expCats.__none__ && renderProds(uncatProds)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 체크박스 컴포넌트 ────────────────────────────────────
function Checkbox({ state, onChange }) {
  const ref = (el) => { if (el) el.indeterminate = state === 'indeterminate' }
  return <input type="checkbox" ref={ref} checked={state === true} onChange={onChange}
    className="w-4 h-4 rounded accent-primary-500 cursor-pointer shrink-0" />
}

// ── 알림 기준 설정 탭 ─────────────────────────────────────
function SettingsTab({ categories, products, skusByProduct, alertsBySkuId, onAlertsChange }) {
  const { user } = useAuth()
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})
  const [localAlerts, setLocalAlerts] = useState({})  // skuId -> { threshold, is_active, id, product_sku_id }
  const [checked, setChecked] = useState({})           // skuId -> bool
  const [bulkVal, setBulkVal] = useState('')
  const [saving, setSaving] = useState(false)
  const { tree, uncatProds } = buildTree(categories, products, skusByProduct)

  useEffect(() => { setLocalAlerts({ ...alertsBySkuId }) }, [alertsBySkuId])

  function setThreshold(skuId, val) {
    setLocalAlerts(p => ({ ...p, [skuId]: { ...(p[skuId] || { is_active: true, product_sku_id: skuId }), threshold: val } }))
  }

  // 체크박스 - cat/prod/sku
  function allSkuIds(prods) { return prods.flatMap(p => (skusByProduct[p.id] || []).map(s => s.id)) }
  function toggleCat(cat, prods) {
    const ids = allSkuIds(prods)
    const allChecked = ids.every(id => checked[id])
    const next = { ...checked }; ids.forEach(id => { next[id] = !allChecked }); setChecked(next)
  }
  function toggleProd(prod) {
    const ids = (skusByProduct[prod.id] || []).map(s => s.id)
    const allChecked = ids.every(id => checked[id])
    const next = { ...checked }; ids.forEach(id => { next[id] = !allChecked }); setChecked(next)
  }
  function catCheckedState(prods) {
    const ids = allSkuIds(prods)
    if (!ids.length) return false
    const n = ids.filter(id => checked[id]).length
    return n === 0 ? false : n === ids.length ? true : 'indeterminate'
  }
  function prodCheckedState(prod) {
    const ids = (skusByProduct[prod.id] || []).map(s => s.id)
    if (!ids.length) return false
    const n = ids.filter(id => checked[id]).length
    return n === 0 ? false : n === ids.length ? true : 'indeterminate'
  }

  async function applyBulk() {
    const v = bulkVal.trim()
    if (!v || isNaN(Number(v))) return toast.error('숫자를 입력하세요')
    const selectedIds = Object.keys(checked).filter(id => checked[id])
    if (!selectedIds.length) return toast.error('체크박스를 선택하세요')
    setSaving(true)
    let saved = 0
    try {
      for (const skuId of selectedIds) {
        const existing = localAlerts[skuId]
        if (existing?.id) {
          await supabase.from('stock_alerts').update({ threshold: Number(v), is_active: true, updated_at: new Date().toISOString() }).eq('id', existing.id)
          setLocalAlerts(p => ({ ...p, [skuId]: { ...existing, threshold: Number(v), is_active: true } }))
        } else {
          const { data } = await supabase.from('stock_alerts').insert({ product_sku_id: skuId, threshold: Number(v), is_active: true, created_by: user?.id }).select().single()
          if (data) setLocalAlerts(p => ({ ...p, [skuId]: { id: data.id, product_sku_id: skuId, threshold: Number(v), is_active: true } }))
        }
        saved++
      }
      toast.success(`${saved}개 옵션에 기준수량 ${v} 저장됨`)
      setBulkVal(''); setChecked({})
      onAlertsChange()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function saveSingle(skuId) {
    const a = localAlerts[skuId]
    if (!a || a.threshold === '' || a.threshold === undefined) return
    setSaving(true)
    try {
      if (a.id) {
        await supabase.from('stock_alerts').update({ threshold: Number(a.threshold), is_active: a.is_active, updated_at: new Date().toISOString() }).eq('id', a.id)
      } else {
        const { data } = await supabase.from('stock_alerts').insert({ product_sku_id: skuId, threshold: Number(a.threshold), is_active: a.is_active ?? true, created_by: user?.id }).select().single()
        if (data) setLocalAlerts(p => ({ ...p, [skuId]: { ...a, id: data.id } }))
      }
      toast.success('저장됨'); onAlertsChange()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(skuId) {
    const a = localAlerts[skuId]
    if (!a?.id) return
    const next = !a.is_active
    setLocalAlerts(p => ({ ...p, [skuId]: { ...a, is_active: next } }))
    await supabase.from('stock_alerts').update({ is_active: next }).eq('id', a.id)
    toast.success(next ? '알림 켜짐' : '알림 꺼짐'); onAlertsChange()
  }

  const renderProds = (prods) => prods.map(prod => {
    const skus = skusByProduct[prod.id] || []
    if (!skus.length) return null
    const prodOpen = expProds[prod.id]
    const pState = prodCheckedState(prod)
    return (
      <div key={prod.id}>
        <div className="flex items-center gap-2 pl-6 pr-4 py-2 hover:bg-surface-800/10 border-b border-surface-800/20 last:border-0">
          <Checkbox state={pState} onChange={() => toggleProd(prod)} />
          <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpProds(p => ({ ...p, [prod.id]: !p[prod.id] }))}>
            {prodOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
            <span className="text-sm text-white">{prod.name}</span>
            <span className="text-xs text-surface-600">({skus.length}개 옵션)</span>
          </div>
        </div>
        {prodOpen && skus.map(sku => {
          const label = [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
          const a = localAlerts[sku.id] || {}
          const isLow = a.is_active && sku.stock <= Number(a.threshold || 0)
          return (
            <div key={sku.id} className={'flex items-center gap-2 pl-14 pr-4 py-2 border-b border-surface-800/10 last:border-0 ' + (isLow ? 'bg-red-500/5' : '')}>
              <Checkbox state={!!checked[sku.id]} onChange={() => setChecked(p => ({ ...p, [sku.id]: !p[sku.id] }))} />
              <span className="flex-1 text-sm text-surface-300">{label}</span>
              <span className={'text-xs font-mono font-bold w-8 text-right ' + (isLow ? 'text-red-400' : 'text-emerald-400')}>{sku.stock}</span>
              <span className="text-xs text-surface-600 w-6 text-center">→</span>
              <input type="number" min="0" value={a.threshold ?? ''} onChange={e => setThreshold(sku.id, e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="미설정"
                className={'w-20 text-center bg-surface-800 border rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none ' + (isLow ? 'border-red-500/50' : 'border-surface-700 focus:border-primary-500')} />
              {a.id && (
                <button onClick={() => toggleActive(sku.id)}
                  className={'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ' + (a.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-700 text-surface-500')}>
                  {a.is_active ? <Bell size={10} /> : <BellOff size={10} />}
                </button>
              )}
              <button onClick={() => saveSingle(sku.id)} disabled={saving || a.threshold === '' || a.threshold === undefined}
                className="flex items-center gap-1 px-2 py-1 bg-primary-500/20 hover:bg-primary-500/30 disabled:opacity-40 text-primary-400 rounded-lg text-xs transition-colors">
                <Save size={10} /> 저장
              </button>
            </div>
          )
        })}
      </div>
    )
  })

  return (
    <div className="space-y-4">
      {/* 일괄 적용 */}
      <div className="flex items-center gap-3 p-4 bg-surface-900 border border-surface-800 rounded-2xl flex-wrap">
        <span className="text-sm font-semibold text-white">일괄 적용</span>
        <span className="text-xs text-surface-400">체크박스 선택 후 기준수량 입력</span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-xs text-surface-400">{Object.values(checked).filter(Boolean).length}개 선택됨</span>
          <input type="number" min="0" value={bulkVal} onChange={e => setBulkVal(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="기준수량 입력"
            className="w-32 text-center bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500" />
          <button onClick={applyBulk} disabled={saving || !bulkVal}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors">
            {saving ? '저장 중...' : '일괄 적용'}
          </button>
        </div>
      </div>

      {/* 트리 테이블 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-800/50 border-b border-surface-800 text-xs text-surface-400 font-semibold">
          <div className="w-4" />
          <span className="flex-1">카테고리 / 상품 / 옵션</span>
          <span className="w-12 text-right">현재재고</span>
          <span className="w-4" />
          <span className="w-20 text-center">알림기준</span>
          <span className="w-8" />
          <span className="w-10" />
        </div>

        {[...tree, ...(uncatProds.length ? [{ cat: { id: '__none__', name: '미분류' }, products: uncatProds }] : [])].map(({ cat, products: prods }) => {
          const skusExist = prods.some(p => (skusByProduct[p.id] || []).length > 0)
          if (!skusExist) return null
          const catOpen = expCats[cat.id] ?? false
          const catState = catCheckedState(prods)
          return (
            <div key={cat.id} className="border-b border-surface-800 last:border-0">
              <div className="flex items-center gap-2 px-4 py-3 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                <Checkbox state={catState} onChange={() => toggleCat(cat, prods)} />
                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpCats(p => ({ ...p, [cat.id]: !catOpen }))}>
                  {catOpen ? <ChevronDown size={15} className="text-surface-400" /> : <ChevronRight size={15} className="text-surface-400" />}
                  <span className="font-semibold text-white text-sm">{cat.name}</span>
                  <span className="text-xs text-surface-500">({prods.length}개 상품)</span>
                </div>
              </div>
              {catOpen && renderProds(prods)}
            </div>
          )
        })}
      </div>
    </div>
  )

}

// ── 메인 ─────────────────────────────────────────────────
export default function StockAlertsPage() {
  const [tab, setTab] = useState('alerts')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [skusByProduct, setSkusByProduct] = useState({})
  const [alertsBySkuId, setAlertsBySkuId] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: cats }, { data: prods }, { data: skus }, { data: alertData }] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
      supabase.from('products').select('id, name, category_id').eq('is_active', true).order('name'),
      supabase.from('product_skus').select('id, stock, product_id, option1_id, option2_id').eq('is_active', true),
      supabase.from('stock_alerts').select('*')
    ])
    setCategories(cats || [])
    setProducts(prods || [])

    // Fetch option values separately (avoid FK join issues)
    const allOptIds = new Set()
    ;(skus || []).forEach(s => { if (s.option1_id) allOptIds.add(s.option1_id); if (s.option2_id) allOptIds.add(s.option2_id) })
    let optMap = {}
    if (allOptIds.size > 0) {
      const { data: optRows } = await supabase.from('product_options').select('id, option_name, option_value, sort_order').in('id', [...allOptIds])
      ;(optRows || []).forEach(o => { optMap[o.id] = o })
    }

    const skuMap = {}
    ;(skus || []).forEach(s => {
      const enriched = {
        ...s,
        o1: s.option1_id ? optMap[s.option1_id] : null,
        o2: s.option2_id ? optMap[s.option2_id] : null,
      }
      if (!skuMap[s.product_id]) skuMap[s.product_id] = []
      skuMap[s.product_id].push(enriched)
    })
    setSkusByProduct(skuMap)
    const alertMap = {}
    ;(alertData || []).forEach(a => { alertMap[a.product_sku_id] = a })
    setAlertsBySkuId(alertMap)
    setLoading(false)
  }

  const lowCount = useMemo(() => {
    const allSkus = Object.values(skusByProduct).flat()
    let n = 0
    allSkus.forEach(sku => {
      // 5개 이하 무조건
      if (sku.stock <= 5) { n++; return }
      // 알림 설정된 경우 threshold 이하
      const a = alertsBySkuId[sku.id]
      if (a && a.is_active && sku.stock <= a.threshold) n++
    })
    return n
  }, [alertsBySkuId, skusByProduct])

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell size={22} className="text-red-400" /> 재고부족 알리미
          </h1>
          <p className="text-surface-400 text-sm mt-0.5">옵션별 재고 부족 알림을 설정하세요</p>
        </div>
        {lowCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-red-400 font-semibold text-sm">현재 {lowCount}개 옵션 재고 부족</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('alerts')}
          className={'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ' + (tab === 'alerts' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-surface-800 text-surface-400 hover:text-white')}>
          <AlertTriangle size={14} /> 재고 부족 현황
          {lowCount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{lowCount}</span>}
        </button>
        <button onClick={() => setTab('settings')}
          className={'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ' + (tab === 'settings' ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-surface-800 text-surface-400 hover:text-white')}>
          알림 기준 설정
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : tab === 'alerts' ? (
        <AlertsTab categories={categories} products={products} skusByProduct={skusByProduct} alertsBySkuId={alertsBySkuId} />
      ) : (
        <SettingsTab categories={categories} products={products} skusByProduct={skusByProduct} alertsBySkuId={alertsBySkuId} onAlertsChange={loadAll} />
      )}
    </div>
  )
}
