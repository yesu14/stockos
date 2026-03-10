import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ChevronLeft, Save, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InventoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const tableContainerRef = useRef(null)
  const [product, setProduct] = useState(null)
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [editedStocks, setEditedStocks] = useState({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  // 옵션 순서를 원래 입력 순서대로 고정
  const [opt1Values, setOpt1Values] = useState([])  // 입력 순서 고정
  const [opt2Values, setOpt2Values] = useState([])  // 입력 순서 고정
  const [opt1Name, setOpt1Name] = useState('')
  const [opt2Name, setOpt2Name] = useState('')
  const hasOpt2 = opt2Values.length > 0

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const { data: p } = await supabase.from('products').select('*, categories(name), subcategories(name)').eq('id', id).single()
    setProduct(p)

    // sort_order로 옵션 입력 순서 보존
    const { data: optData } = await supabase.from('product_options')
      .select('id, option_number, option_name, option_value, sort_order')
      .eq('product_id', id)
      .order('option_number').order('sort_order')

    const { data: skuData } = await supabase.from('product_skus').select(
      'id, stock, o1:option1_id(id, option_name, option_value, sort_order), o2:option2_id(id, option_name, option_value, sort_order)'
    ).eq('product_id', id).eq('is_active', true)

    setSkus(skuData || [])
    const init = {}
    skuData?.forEach(s => { init[s.id] = s.stock })
    setEditedStocks(init)

    // 입력 순서 (sort_order) 기준으로 옵션값 배열 구성
    const opt1 = (optData || []).filter(o => o.option_number === 1).sort((a,b) => a.sort_order - b.sort_order)
    const opt2 = (optData || []).filter(o => o.option_number === 2).sort((a,b) => a.sort_order - b.sort_order)
    if (opt1.length > 0) { setOpt1Name(opt1[0].option_name); setOpt1Values(opt1.map(o => o.option_value)) }
    if (opt2.length > 0) { setOpt2Name(opt2[0].option_name); setOpt2Values(opt2.map(o => o.option_value)) }
    setLoading(false)
  }

  function getSkuByOptions(o1val, o2val) {
    return skus.find(s => s.o1?.option_value === o1val && (o2val ? s.o2?.option_value === o2val : !s.o2))
  }

  function getChanges() {
    return skus
      .filter(s => editedStocks[s.id] !== undefined && Number(editedStocks[s.id]) !== s.stock)
      .map(s => {
        const label = [s.o1?.option_value, s.o2?.option_value].filter(Boolean).join('/')
        return { skuId: s.id, label, before: s.stock, after: Number(editedStocks[s.id]) }
      })
  }

  async function handleSave() {
    const changes = getChanges()
    if (changes.length === 0) return toast.error('변경된 항목이 없습니다')
    setShowConfirm(true)
  }

  async function confirmSave(finalChanges) {
    setSaving(true)
    try {
      for (const ch of finalChanges) {
        const sku = skus.find(s => s.id === ch.skuId)
        await supabase.from('product_skus').update({ stock: ch.after, updated_at: new Date().toISOString() }).eq('id', ch.skuId)
        await supabase.from('stock_logs').insert({
          product_sku_id: ch.skuId, change_type: 'manual',
          quantity_before: ch.before, quantity_change: ch.after - ch.before, quantity_after: ch.after,
          option_label: [sku?.o1?.option_value, sku?.o2?.option_value].filter(Boolean).join('/'),
          user_name: user?.email || '', created_by: user?.id, note: '상세보기 수동 조정'
        })
      }
      toast.success('저장 완료'); setShowConfirm(false); loadData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!product) return <div className="text-surface-400 p-8">상품을 찾을 수 없습니다</div>

  return (
    <div className="max-w-5xl pb-12">
      {/* 고정 헤더 */}
      <div className="sticky top-0 z-10 bg-surface-900 border border-surface-800 rounded-2xl p-4 mb-5">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/inventory')} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors shrink-0 mt-0.5"><ChevronLeft size={20} /></button>
          <div className="flex-1 flex items-center gap-4 min-w-0">
            {product.image_url && <img src={product.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white">{product.name}</h1>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-surface-400">
                {product.code && <span>코드: {product.code}</span>}
                {product.categories?.name && <span>{product.categories.name}</span>}
                {product.subcategories?.name && <span>{product.subcategories.name}</span>}
                {product.storage_location_text && <span>📍{product.storage_location_text}</span>}
                {product.factory && <span>🏭{product.factory}</span>}
              </div>
            </div>
          </div>
          <button onClick={handleSave}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shrink-0">
            <Save size={15} /> 저장
          </button>
        </div>
      </div>

      {/* 재고 테이블 - 수평 스크롤 + TH 고정 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        {/* 수평 스크롤 컨테이너 - overflow-x 항상 표시 */}
        <div
          ref={tableContainerRef}
          className="overflow-x-auto"
          style={{ overflowX: 'auto', overflowY: 'visible' }}
        >
          <div style={{ minWidth: hasOpt2 ? `${Math.max(400, opt2Values.length * 110 + 140)}px` : '300px' }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-surface-800 border-b border-surface-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase sticky left-0 bg-surface-800 min-w-28 border-r border-surface-700">
                    {hasOpt2 ? `${opt1Name} \\ ${opt2Name}` : (opt1Name || '옵션')}
                  </th>
                  {hasOpt2
                    ? opt2Values.map(v2 => (
                      <th key={v2} className="px-4 py-3 text-center text-xs font-semibold text-surface-300 min-w-28 whitespace-nowrap bg-surface-800">
                        {v2}
                      </th>
                    ))
                    : <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase min-w-28 bg-surface-800">재고</th>
                  }
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {opt1Values.map(v1 => (
                  <tr key={v1} className="hover:bg-surface-800/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-surface-200 sticky left-0 bg-surface-900 border-r border-surface-800 whitespace-nowrap">
                      {v1}
                    </td>
                    {hasOpt2
                      ? opt2Values.map(v2 => {
                        const sku = getSkuByOptions(v1, v2)
                        if (!sku) return <td key={v2} className="px-4 py-3 text-center text-surface-600 text-xs">-</td>
                        const changed = Number(editedStocks[sku.id]) !== sku.stock
                        return (
                          <td key={v2} className="px-4 py-3 text-center">
                            <input type="number" min="0"
                              value={editedStocks[sku.id] ?? sku.stock}
                              onChange={e => { const v = e.target.value.replace(/[^0-9]/g,''); setEditedStocks(p => ({...p,[sku.id]: v===''?0:Number(v)})) }}
                              className={`w-20 text-center bg-surface-800 border rounded-lg px-2 py-1.5 text-sm font-mono text-white focus:outline-none transition-colors ${changed ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 hover:border-surface-600'}`}
                            />
                          </td>
                        )
                      })
                      : (() => {
                        const sku = getSkuByOptions(v1, null)
                        if (!sku) return <td className="px-4 py-3 text-center text-surface-600">-</td>
                        const changed = Number(editedStocks[sku.id]) !== sku.stock
                        return (
                          <td className="px-4 py-3 text-center">
                            <input type="number" min="0"
                              value={editedStocks[sku.id] ?? sku.stock}
                              onChange={e => { const v = e.target.value.replace(/[^0-9]/g,''); setEditedStocks(p => ({...p,[sku.id]:v===''?0:Number(v)})) }}
                              className={`w-24 text-center bg-surface-800 border rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none transition-colors ${changed ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 hover:border-surface-600'}`}
                            />
                          </td>
                        )
                      })()
                    }
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* 항상 보이는 수평 스크롤바를 위한 하단 스크롤 미러 */}
        <style>{`
          .inventory-detail-scroll::-webkit-scrollbar { height: 8px; }
          .inventory-detail-scroll::-webkit-scrollbar-track { background: #1e293b; }
          .inventory-detail-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        `}</style>
      </div>

      {showConfirm && <ConfirmSaveModal changes={getChanges()} onSave={confirmSave} onClose={() => setShowConfirm(false)} saving={saving} />}
    </div>
  )
}

function ConfirmSaveModal({ changes, onSave, onClose, saving }) {
  const [localChanges, setLocalChanges] = useState(changes.map(c => ({...c})))
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800">
          <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-400" /><h3 className="font-semibold text-white">재고 변경 확인</h3></div>
          <button onClick={onClose} className="text-surface-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5">
          <p className="text-sm text-surface-400 mb-3">변경 후 수치를 최종 수정할 수 있습니다.</p>
          <div className="overflow-x-auto rounded-xl border border-surface-800 mb-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-800/50 border-b border-surface-800">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400">옵션</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-surface-400">변경 전</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-surface-400">변경 후 (클릭 수정)</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-800">
                {localChanges.map((ch, i) => (
                  <tr key={ch.skuId} className="hover:bg-surface-800/20">
                    <td className="px-4 py-2.5 text-surface-200">{ch.label}</td>
                    <td className="px-4 py-2.5 text-center text-surface-400 font-mono">{ch.before}</td>
                    <td className="px-4 py-2.5 text-center">
                      <input type="number" min="0" value={ch.after}
                        onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g,''))||0; setLocalChanges(p=>p.map((c,idx)=>idx===i?{...c,after:v}:c)) }}
                        className="w-20 text-center bg-surface-800 border border-primary-500/50 rounded-lg px-2 py-1 text-sm font-mono text-primary-300 focus:outline-none focus:border-primary-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium transition-colors">취소</button>
            <button onClick={() => onSave(localChanges)} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Save size={14} /> {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
