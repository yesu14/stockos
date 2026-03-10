import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ChevronLeft, Plus, Trash2, Star, CheckSquare, Square } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FavoritesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState({})

  useEffect(() => { loadFavorites() }, [])

  async function loadFavorites() {
    setLoading(true)
    const { data } = await supabase
      .from('favorites')
      .select(`id, created_at, product_skus(id, stock, products(id, name, storage_location_text), o1:option1_id(option_name, option_value), o2:option2_id(option_name, option_value))`)
      .eq('user_id', user.id)

    const weekAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10)
    const skuIds = (data||[]).map(f => f.product_skus?.id).filter(Boolean)
    let salesMap = {}
    if (skuIds.length > 0) {
      const { data: salesData } = await supabase.from('sales').select('product_sku_id, quantity').in('product_sku_id', skuIds).gte('sale_date', weekAgo)
      ;(salesData||[]).forEach(s => { salesMap[s.product_sku_id] = (salesMap[s.product_sku_id]||0) + s.quantity })
    }
    const sorted = (data||[]).sort((a,b) => (salesMap[b.product_skus?.id]||0) - (salesMap[a.product_skus?.id]||0))
    setFavorites(sorted)
    setLoading(false)
  }

  function getSkuLabel(fav) {
    const sku = fav.product_skus
    if (!sku) return '-'
    return [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join(' / ') || 'Default'
  }

  async function deleteSelected() {
    const ids = Object.keys(selected).filter(id => selected[id])
    if (!ids.length) return toast.error('삭제할 항목을 선택하세요')
    const { error } = await supabase.from('favorites').delete().in('id', ids)
    if (error) toast.error(error.message)
    else { toast.success('삭제 완료'); setSelected({}); loadFavorites() }
  }

  async function deleteSingle(id) {
    const { error } = await supabase.from('favorites').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('삭제 완료'); loadFavorites() }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length
  const allSelected = favorites.length > 0 && selectedCount === favorites.length

  function toggleAll() {
    if (allSelected) { setSelected({}) }
    else { const next = {}; favorites.forEach(f => { next[f.id] = true }); setSelected(next) }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sales')} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">상품 즐겨찾기</h1>
          <p className="text-surface-400 text-xs mt-0.5">자주 판매하는 상품을 등록하면 오늘판매 페이지에 우선 표시됩니다</p>
        </div>
        <button onClick={() => navigate('/sales/favorites/add')}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={15} /> 즐겨찾기 추가
        </button>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between bg-surface-800 border border-surface-700 rounded-xl px-4 py-3">
          <span className="text-sm text-surface-300">{selectedCount}개 선택됨</span>
          <button onClick={deleteSelected} className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm font-medium transition-colors">
            <Trash2 size={14} /> 선택 삭제
          </button>
        </div>
      )}

      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-surface-800/50 border-b border-surface-800 text-xs font-semibold text-surface-400 uppercase tracking-wide items-center">
          <div className="col-span-1 flex items-center">
            <button onClick={toggleAll} className="text-surface-400 hover:text-white transition-colors">
              {allSelected ? <CheckSquare size={15} className="text-primary-400" /> : <Square size={15} />}
            </button>
          </div>
          <div className="col-span-4">상품명</div>
          <div className="col-span-4">옵션</div>
          <div className="col-span-2">재고</div>
          <div className="col-span-1 text-right">삭제</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-surface-500">
            <Star size={36} className="mb-2 opacity-30" />
            <p className="text-sm">즐겨찾기가 없습니다</p>
            <p className="text-xs mt-1">"즐겨찾기 추가" 버튼을 눌러 추가하세요</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {favorites.map(fav => (
              <div key={fav.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-surface-800/20 items-center">
                <div className="col-span-1">
                  <input type="checkbox" checked={selected[fav.id] || false}
                    onChange={() => setSelected(p => ({ ...p, [fav.id]: !p[fav.id] }))}
                    className="accent-primary-500 w-4 h-4 cursor-pointer" />
                </div>
                <div className="col-span-4 text-sm text-surface-100 font-medium">{fav.product_skus?.products?.name || '-'}</div>
                <div className="col-span-4 text-sm text-surface-400">{getSkuLabel(fav)}</div>
                <div className="col-span-2 text-sm text-surface-400">{fav.product_skus?.stock ?? '-'}</div>
                <div className="col-span-1 text-right">
                  <button onClick={() => deleteSingle(fav.id)} className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
