import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ChevronLeft, Search, Star, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FavoritesAddPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [skusByProduct, setSkusByProduct] = useState({})
  const [existingFavs, setExistingFavs] = useState(new Set())
  const [selected, setSelected] = useState({})
  const [saving, setSaving] = useState(false)
  const [instantSaving, setInstantSaving] = useState({}) // skuId -> bool
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cats }, { data: prods }, { data: skus }, { data: favData }] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
      supabase.from('products').select('id, name, category_id').eq('is_active', true).order('name'),
      supabase.from('product_skus').select('id, stock, product_id, o1:option1_id(option_name, option_value, sort_order), o2:option2_id(option_name, option_value, sort_order)').eq('is_active', true),
      supabase.from('favorites').select('product_sku_id').eq('user_id', user.id)
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    const skuMap = {}
    ;(skus || []).forEach(s => { if (!skuMap[s.product_id]) skuMap[s.product_id] = []; skuMap[s.product_id].push(s) })
    setSkusByProduct(skuMap)
    setExistingFavs(new Set((favData || []).map(f => f.product_sku_id)))
    setLoading(false)
  }

  const filteredProds = useMemo(() => {
    if (!search.trim()) return products
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [products, search])

  const tree = useMemo(() => {
    const map = {}
    categories.forEach(c => { map[c.id] = { ...c, products: [] } })
    filteredProds.forEach(p => {
      if (p.category_id && map[p.category_id]) map[p.category_id].products.push(p)
      else {
        if (!map['__none__']) map['__none__'] = { id: '__none__', name: '미분류', products: [] }
        map['__none__'].products.push(p)
      }
    })
    return Object.values(map).filter(c => c.products.length > 0)
  }, [categories, filteredProds])

  function skuLabel(sku) {
    return [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
  }

  // 체크박스 토글
  function toggleSku(skuId) {
    if (existingFavs.has(skuId)) return
    setSelected(p => ({ ...p, [skuId]: !p[skuId] }))
  }
  function toggleProd(prod) {
    const skus = (skusByProduct[prod.id] || []).filter(s => !existingFavs.has(s.id))
    const allOn = skus.every(s => selected[s.id])
    const next = { ...selected }; skus.forEach(s => { next[s.id] = !allOn }); setSelected(next)
  }
  function toggleCat(prods) {
    const skus = prods.flatMap(p => (skusByProduct[p.id] || []).filter(s => !existingFavs.has(s.id)))
    const allOn = skus.every(s => selected[s.id])
    const next = { ...selected }; skus.forEach(s => { next[s.id] = !allOn }); setSelected(next)
  }
  function prodState(prod) {
    const skus = (skusByProduct[prod.id] || []).filter(s => !existingFavs.has(s.id))
    if (!skus.length) return 'none'
    const n = skus.filter(s => selected[s.id]).length
    return n === 0 ? 'none' : n === skus.length ? 'all' : 'partial'
  }
  function catState(prods) {
    const skus = prods.flatMap(p => (skusByProduct[p.id] || []).filter(s => !existingFavs.has(s.id)))
    if (!skus.length) return 'none'
    const n = skus.filter(s => selected[s.id]).length
    return n === 0 ? 'none' : n === skus.length ? 'all' : 'partial'
  }

  function Chk({ state, onChange }) {
    const r = (el) => { if (el) el.indeterminate = state === 'partial' }
    return <input type="checkbox" ref={r} checked={state === 'all'} onChange={onChange} className="w-4 h-4 accent-amber-500 cursor-pointer shrink-0" />
  }

  // 즉시 별표 클릭 추가
  async function instantAdd(skuId) {
    if (existingFavs.has(skuId)) {
      // 이미 추가됨 - 제거
      setInstantSaving(p => ({ ...p, [skuId]: true }))
      try {
        await supabase.from('favorites').delete().eq('product_sku_id', skuId).eq('user_id', user.id)
        setExistingFavs(prev => { const n = new Set(prev); n.delete(skuId); return n })
        toast.success('즐겨찾기 제거됨')
      } catch (err) { toast.error(err.message) }
      finally { setInstantSaving(p => ({ ...p, [skuId]: false })) }
      return
    }
    setInstantSaving(p => ({ ...p, [skuId]: true }))
    try {
      const { error } = await supabase.from('favorites').insert({ product_sku_id: skuId, user_id: user.id })
      if (error) throw error
      setExistingFavs(prev => new Set([...prev, skuId]))
      setSelected(p => { const n = { ...p }; delete n[skuId]; return n })
      toast.success('즐겨찾기 추가됨 ⭐')
    } catch (err) { toast.error(err.message) }
    finally { setInstantSaving(p => ({ ...p, [skuId]: false })) }
  }

  // 선택 항목 일괄 추가
  async function saveSelected() {
    const ids = Object.keys(selected).filter(id => selected[id] && !existingFavs.has(id))
    if (!ids.length) return toast.error('추가할 옵션을 선택하세요')
    setSaving(true)
    try {
      const { error } = await supabase.from('favorites').insert(ids.map(id => ({ product_sku_id: id, user_id: user.id })))
      if (error) throw error
      toast.success(`${ids.length}개 즐겨찾기 추가됨`)
      navigate('/sales/favorites')
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sales/favorites')} className="flex items-center gap-1.5 text-surface-400 hover:text-white text-sm transition-colors">
          <ChevronLeft size={16} /> 돌아가기
        </button>
        <h1 className="text-xl font-bold text-white flex-1">즐겨찾기 추가</h1>
        {selectedCount > 0 && (
          <button onClick={saveSelected} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
            <Star size={14} /> {selectedCount}개 일괄 추가
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="상품명 검색..."
          className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-amber-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-800/50 border-b border-surface-800 text-xs font-semibold text-surface-400">
            <div className="w-4" />
            <span className="flex-1">카테고리 / 상품 / 옵션</span>
            <span className="w-16 text-center">현재재고</span>
            <span className="w-16 text-center">즐겨찾기</span>
          </div>

          {tree.map(cat => {
            const catOpen = expCats[cat.id] ?? false
            const cState = catState(cat.products)
            return (
              <div key={cat.id} className="border-b border-surface-800 last:border-0">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-800/15 hover:bg-surface-800/30 transition-colors">
                  <Chk state={cState} onChange={() => toggleCat(cat.products)} />
                  <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpCats(p => ({ ...p, [cat.id]: !catOpen }))}>
                    {catOpen ? <ChevronDown size={14} className="text-surface-400" /> : <ChevronRight size={14} className="text-surface-400" />}
                    <span className="font-semibold text-white text-sm">{cat.name}</span>
                    <span className="text-xs text-surface-500">({cat.products.length}개 상품)</span>
                  </div>
                </div>
                {catOpen && cat.products.map(prod => {
                  const skus = skusByProduct[prod.id] || []
                  const prodOpen = expProds[prod.id] ?? false
                  const pState = prodState(prod)
                  return (
                    <div key={prod.id} className="border-t border-surface-800/40">
                      <div className="flex items-center gap-2 pl-6 pr-4 py-2 hover:bg-surface-800/10 transition-colors">
                        <Chk state={pState} onChange={() => toggleProd(prod)} />
                        <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setExpProds(p => ({ ...p, [prod.id]: !prodOpen }))}>
                          {prodOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
                          <span className="text-sm font-medium text-white">{prod.name}</span>
                          <span className="text-xs text-surface-600">({skus.length})</span>
                        </div>
                      </div>
                      {prodOpen && skus.map(sku => {
                        const label = skuLabel(sku)
                        const isExisting = existingFavs.has(sku.id)
                        const isSaving = instantSaving[sku.id]
                        return (
                          <div key={sku.id} className="flex items-center gap-2 pl-12 pr-4 py-2 border-t border-surface-800/20">
                            <input type="checkbox" checked={isExisting || !!selected[sku.id]} disabled={isExisting}
                              onChange={() => toggleSku(sku.id)}
                              className="w-4 h-4 accent-amber-500 cursor-pointer shrink-0" />
                            <span className={'flex-1 text-sm ' + (isExisting ? 'text-amber-400/70' : 'text-surface-300')}>{label}</span>
                            <span className={'w-16 text-center text-sm font-mono ' + (sku.stock > 0 ? 'text-emerald-400' : 'text-red-400')}>{sku.stock}</span>
                            {/* 별표 즉시 추가/제거 버튼 */}
                            <button
                              onClick={() => instantAdd(sku.id)}
                              disabled={isSaving}
                              title={isExisting ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                              className={`w-16 flex items-center justify-center transition-colors disabled:opacity-50 ${isExisting ? 'text-amber-400 hover:text-amber-300' : 'text-surface-600 hover:text-amber-400'}`}>
                              <Star size={16} className={isExisting ? 'fill-amber-400' : ''} />
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
          {tree.length === 0 && <p className="text-center py-10 text-surface-500 text-sm">상품이 없습니다</p>}
        </div>
      )}
    </div>
  )
}
