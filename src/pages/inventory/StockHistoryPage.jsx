import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, Search, Package, ChevronDown, ChevronRight, X } from 'lucide-react'

const TYPE_LABEL = {
  inbound:  { label: '입고',    color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  outbound: { label: '출고',    color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  manual:   { label: '수동조정', color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  sale:     { label: '판매',    color: 'text-purple-400',  bg: 'bg-purple-500/15' },
}

export default function StockHistoryPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [skusByProduct, setSkusByProduct] = useState({})
  const [loading, setLoading] = useState(true)
  // expandedCats: default collapsed
  const [expandedCats, setExpandedCats] = useState({})
  const [expandedProds, setExpandedProds] = useState({})
  const [expandedSkus, setExpandedSkus] = useState({})
  const [logsBySkuId, setLogsBySkuId] = useState({})
  const [logsLoading, setLogsLoading] = useState({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cats }, { data: prods }, { data: skus }] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
      supabase.from('products').select('id, name, category_id, image_url').eq('is_active', true).order('name'),
      supabase.from('product_skus').select('id, stock, product_id, o1:option1_id(option_name, option_value, sort_order), o2:option2_id(option_name, option_value, sort_order)').eq('is_active', true)
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    const map = {}
    ;(skus || []).forEach(s => { if (!map[s.product_id]) map[s.product_id] = []; map[s.product_id].push(s) })
    setSkusByProduct(map)
    setLoading(false)
  }

  async function loadLogs(skuId) {
    if (expandedSkus[skuId]) { setExpandedSkus(p => ({ ...p, [skuId]: false })); return }
    setExpandedSkus(p => ({ ...p, [skuId]: true }))
    if (logsBySkuId[skuId]) return // already loaded
    setLogsLoading(p => ({ ...p, [skuId]: true }))
    const { data } = await supabase.from('stock_logs')
      .select('id, change_type, quantity_before, quantity_change, quantity_after, user_name, note, created_at')
      .eq('product_sku_id', skuId)
      .order('created_at', { ascending: false })
      .limit(100)
    setLogsBySkuId(p => ({ ...p, [skuId]: data || [] }))
    setLogsLoading(p => ({ ...p, [skuId]: false }))
  }

  function skuLabel(sku) {
    return [sku?.o1?.option_value, sku?.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
  }
  function sortedSkus(prod) {
    return [...(skusByProduct[prod.id] || [])].sort((a,b)=>{
      const o1a=a.o1?.sort_order??999, o1b=b.o1?.sort_order??999
      if(o1a!==o1b) return o1a-o1b
      return (a.o2?.sort_order??999)-(b.o2?.sort_order??999)
    })
  }

  // Build tree with search filter
  const tree = useMemo(() => {
    const q = search.trim().toLowerCase()
    const catMap = {}
    categories.forEach(c => { catMap[c.id] = { ...c, products: [] } })

    const filteredProds = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products
    filteredProds.forEach(p => {
      if (p.category_id && catMap[p.category_id]) catMap[p.category_id].products.push(p)
      else {
        if (!catMap['__none__']) catMap['__none__'] = { id: '__none__', name: '미분류', products: [] }
        catMap['__none__'].products.push(p)
      }
    })
    return Object.values(catMap).filter(c => c.products.length > 0)
  }, [categories, products, search])

  // When search changes, expand matching categories
  useEffect(() => {
    if (search.trim()) {
      const exp = {}
      tree.forEach(c => { exp[c.id] = true })
      setExpandedCats(exp)
    }
  }, [search])

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/inventory')} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">재고 이력</h1>
          <p className="text-surface-400 text-xs mt-0.5">카테고리 › 상품 › 옵션별 재고 변동 내역</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="상품명 검색..."
          className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"><X size={13} /></button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          {tree.map(cat => {
            const catOpen = expandedCats[cat.id] ?? false
            return (
              <div key={cat.id} className="border-b border-surface-800 last:border-0">
                {/* 카테고리 행 */}
                <button onClick={() => setExpandedCats(p => ({ ...p, [cat.id]: !catOpen }))}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-surface-800/20 hover:bg-surface-800/40 transition-colors text-left">
                  {catOpen ? <ChevronDown size={15} className="text-surface-400 shrink-0" /> : <ChevronRight size={15} className="text-surface-400 shrink-0" />}
                  <span className="font-semibold text-white text-sm">{cat.name}</span>
                  <span className="text-xs text-surface-500">({cat.products.length}개 상품)</span>
                </button>

                {catOpen && cat.products.map(prod => {
                  const skus = sortedSkus(prod)
                  const prodOpen = expandedProds[prod.id] ?? false
                  return (
                    <div key={prod.id} className="border-t border-surface-800/40">
                      <button onClick={() => setExpandedProds(p => ({ ...p, [prod.id]: !prodOpen }))}
                        className="w-full flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-surface-800/10 transition-colors text-left">
                        {prodOpen ? <ChevronDown size={13} className="text-surface-500 shrink-0" /> : <ChevronRight size={13} className="text-surface-500 shrink-0" />}
                        {prod.image_url
                          ? <img src={prod.image_url} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                          : <div className="w-7 h-7 rounded-lg bg-surface-800 flex items-center justify-center shrink-0"><Package size={11} className="text-surface-600" /></div>
                        }
                        <span className="text-sm font-medium text-white">{prod.name}</span>
                        <span className="text-xs text-surface-600">({skus.length}개 옵션)</span>
                      </button>

                      {prodOpen && skus.map(sku => {
                        const skuOpen = expandedSkus[sku.id] ?? false
                        const logs = logsBySkuId[sku.id] || []
                        const isLoadingLogs = logsLoading[sku.id]
                        return (
                          <div key={sku.id} className="border-t border-surface-800/20">
                            <button onClick={() => loadLogs(sku.id)}
                              className={`w-full flex items-center gap-3 pl-16 pr-4 py-2 transition-colors text-left ${skuOpen ? 'bg-primary-500/8' : 'hover:bg-surface-800/10'}`}>
                              {skuOpen ? <ChevronDown size={12} className="text-primary-400 shrink-0" /> : <ChevronRight size={12} className="text-surface-500 shrink-0" />}
                              <span className="flex-1 text-sm text-surface-200">{skuLabel(sku)}</span>
                              <span className={'text-sm font-mono font-bold ' + (sku.stock < 10 ? 'text-red-400' : 'text-emerald-400')}>{sku.stock}</span>
                              <span className="text-xs text-surface-500 ml-1">현재재고</span>
                            </button>

                            {skuOpen && (
                              <div className="bg-surface-950 border-t border-surface-800/40">
                                {isLoadingLogs ? (
                                  <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
                                ) : logs.length === 0 ? (
                                  <div className="text-center py-5 text-surface-500 text-xs">변동 기록 없음</div>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-surface-800 text-surface-500">
                                        <th className="pl-16 pr-3 py-2.5 text-left">날짜</th>
                                        <th className="px-3 py-2.5 text-center">유형</th>
                                        <th className="px-3 py-2.5 text-center">변경 전</th>
                                        <th className="px-3 py-2.5 text-center">변화량</th>
                                        <th className="px-3 py-2.5 text-center">변경 후</th>
                                        <th className="px-3 py-2.5 text-left hidden sm:table-cell">담당자</th>
                                        <th className="px-3 py-2.5 text-left hidden md:table-cell">메모</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-800/50">
                                      {logs.map(log => {
                                        const type = TYPE_LABEL[log.change_type] || { label: log.change_type, color: 'text-surface-400', bg: 'bg-surface-700' }
                                        return (
                                          <tr key={log.id} className="hover:bg-surface-800/20 transition-colors">
                                            <td className="pl-16 pr-3 py-2 text-surface-400 whitespace-nowrap">
                                              {new Date(log.created_at).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${type.bg} ${type.color}`}>{type.label}</span>
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono text-surface-300">{log.quantity_before ?? '-'}</td>
                                            <td className="px-3 py-2 text-center font-mono font-bold">
                                              <span className={log.quantity_change > 0 ? 'text-emerald-400' : log.quantity_change < 0 ? 'text-red-400' : 'text-surface-500'}>
                                                {log.quantity_change > 0 ? `+${log.quantity_change}` : log.quantity_change}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono font-bold text-white">{log.quantity_after ?? '-'}</td>
                                            <td className="px-3 py-2 text-surface-500 hidden sm:table-cell">{log.user_name || '-'}</td>
                                            <td className="px-3 py-2 text-surface-500 hidden md:table-cell max-w-32 truncate">{log.note || '-'}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
          {tree.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-surface-500">
              <Package size={36} className="mb-2 opacity-20" />
              <p className="text-sm">{search ? '검색 결과가 없습니다' : '상품이 없습니다'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
