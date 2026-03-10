import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, Search } from 'lucide-react'

export default function StockLogsPage() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('stock_logs')
      .select(`
        id, quantity_before, quantity_after, quantity_change,
        option_label, user_name, created_at, change_type,
        product_skus(
          products(name),
          o1:option1_id(option_value),
          o2:option2_id(option_value)
        )
      `)
      .eq('change_type', 'manual')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data || [])
    setLoading(false)
  }

  function getProductName(log) {
    return log.product_skus?.products?.name || '-'
  }

  function getOptionLabel(log) {
    if (log.option_label) return log.option_label
    const sku = log.product_skus
    if (!sku) return '-'
    return [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join('/') || '-'
  }

  const filtered = logs.filter(log => {
    if (!search) return true
    const name = getProductName(log).toLowerCase()
    const opt = getOptionLabel(log).toLowerCase()
    const user = (log.user_name || '').toLowerCase()
    const q = search.toLowerCase()
    return name.includes(q) || opt.includes(q) || user.includes(q)
  })

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/inventory')} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">재고 수정기록</h1>
          <p className="text-surface-400 text-xs mt-0.5">수동 재고 변경 이력 · 최근 500건</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="상품명, 옵션, 유저 검색..."
          className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
      </div>

      {/* 테이블 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-800/50 border-b border-surface-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">상품명</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">옵션</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase">변경 전</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase">변경 후</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase">변화량</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">변경자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-surface-500 text-sm">기록이 없습니다</td></tr>
              ) : filtered.map(log => {
                const change = (log.quantity_after || 0) - (log.quantity_before || 0)
                return (
                  <tr key={log.id} className="hover:bg-surface-800/20 transition-colors">
                    <td className="px-4 py-3 text-surface-100 font-medium">{getProductName(log)}</td>
                    <td className="px-4 py-3 text-surface-400">{getOptionLabel(log)}</td>
                    <td className="px-4 py-3 text-center font-mono text-surface-300">{log.quantity_before ?? '-'}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-white">{log.quantity_after ?? '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono text-sm font-medium ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-surface-500'}`}>
                        {change > 0 ? `+${change}` : change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-surface-400 text-xs">{log.user_name || '-'}</td>
                    <td className="px-4 py-3 text-surface-500 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
