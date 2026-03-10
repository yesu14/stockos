import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ChevronLeft, Calendar } from 'lucide-react'

function getDateRange(mode) {
  const today = new Date()
  const fmt = d => d.toISOString().slice(0, 10)
  if (mode === '7') return { from: fmt(new Date(today - 6 * 86400000)), to: fmt(today) }
  if (mode === '30') return { from: fmt(new Date(today - 29 * 86400000)), to: fmt(today) }
  if (mode === '180') return { from: fmt(new Date(today - 179 * 86400000)), to: fmt(today) }
  return null
}

export default function SalesReportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mode, setMode] = useState('7')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [dailyData, setDailyData] = useState([])  // [{date, sales, revenue, profit}]
  const [loading, setLoading] = useState(false)
  const [currentDateIdx, setCurrentDateIdx] = useState(0)
  const headerRef = useRef(null)

  useEffect(() => { loadReport() }, [mode])

  async function loadReport() {
    setLoading(true)
    const range = mode === 'custom' ? { from: customFrom, to: customTo } : getDateRange(mode)
    if (!range?.from || !range?.to) return setLoading(false)

    const { data } = await supabase
      .from('sales')
      .select('sale_date, quantity, sale_price, margin')
      .eq('created_by', user.id)
      .gte('sale_date', range.from)
      .lte('sale_date', range.to)
      .order('sale_date', { ascending: false })

    // 날짜별 집계
    const map = {}
    ;(data || []).forEach(s => {
      if (!map[s.sale_date]) map[s.sale_date] = { date: s.sale_date, revenue: 0, profit: 0, items: 0 }
      map[s.sale_date].revenue += (s.sale_price || 0) * (s.quantity || 0)
      map[s.sale_date].profit += (s.margin || 0) * (s.quantity || 0)
      map[s.sale_date].items += s.quantity || 0
    })

    const sorted = Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
    setDailyData(sorted)
    setCurrentDateIdx(0)
    setLoading(false)
  }

  function handleCustomSearch() {
    if (!customFrom || !customTo) return
    const from = new Date(customFrom), to = new Date(customTo)
    if ((to - from) > 365 * 86400000) return alert('최대 1년 범위까지 가능합니다')
    loadReport()
  }

  // 스크롤로 날짜 변경
  useEffect(() => {
    const container = document.getElementById('scroll-container')
    if (!container || dailyData.length === 0) return

    const sections = dailyData.map((_, i) => document.getElementById(`day-${i}`))
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.id.replace('day-', ''))
          setCurrentDateIdx(idx)
        }
      })
    }, { threshold: 0.5 })

    sections.forEach(s => s && observer.observe(s))
    return () => observer.disconnect()
  }, [dailyData])

  const current = dailyData[currentDateIdx]

  return (
    <div className="max-w-3xl space-y-0">
      {/* 고정 헤더 */}
      <div ref={headerRef} className="sticky top-0 z-10 bg-surface-950 pb-4 space-y-4 pt-1">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales')} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
          <h1 className="text-xl font-bold text-white">매출 조회</h1>
        </div>

        {/* 현재 날짜 매출 */}
        {current && (
          <div className="bg-surface-900 border border-primary-500/30 rounded-2xl p-4">
            <p className="text-sm font-semibold text-primary-400 mb-3">{current.date}</p>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-xs text-surface-400">매출</p><p className="text-lg font-bold text-white">₩{current.revenue.toLocaleString()}</p></div>
              <div><p className="text-xs text-surface-400">순이익</p><p className="text-lg font-bold text-emerald-400">₩{current.profit.toLocaleString()}</p></div>
              <div><p className="text-xs text-surface-400">판매수량</p><p className="text-lg font-bold text-surface-200">{current.items}개</p></div>
            </div>
          </div>
        )}

        {/* 기간 선택 */}
        <div className="flex flex-wrap items-center gap-2">
          {[['7', '최근 1주일'], ['30', '최근 30일'], ['180', '최근 180일'], ['custom', '기간 선택']].map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === k ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
            <span className="text-surface-500">~</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
            <button onClick={handleCustomSearch} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">
              조회
            </button>
          </div>
        )}
      </div>

      {/* 스크롤 영역 */}
      <div id="scroll-container" className="space-y-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : dailyData.length === 0 ? (
          <div className="text-center py-16 text-surface-500">
            <Calendar size={40} className="mx-auto mb-2 opacity-30" />
            <p>판매 기록이 없습니다</p>
          </div>
        ) : dailyData.map((day, idx) => (
          <DaySection key={day.date} day={day} idx={idx} userId={user.id} />
        ))}
      </div>
    </div>
  )
}

function DaySection({ day, idx, userId }) {
  const [sales, setSales] = useState([])
  const [open, setOpen] = useState(idx === 0)

  useEffect(() => {
    if (open && sales.length === 0) loadDaySales()
  }, [open])

  async function loadDaySales() {
    const { data } = await supabase.from('sales').select(`
      id, quantity, sale_price, margin,
      product_skus(
        products(name),
        o1:option1_id(option_value), o2:option2_id(option_value)
      )
    `).eq('sale_date', day.date).eq('created_by', userId)
    setSales(data || [])
  }

  return (
    <div id={`day-${idx}`} className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-800/30 transition-colors">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">{day.date}</span>
          <span className="text-xs text-surface-500">{day.items}개 판매</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-surface-200 font-mono">₩{day.revenue.toLocaleString()}</span>
          <span className="text-emerald-400 font-mono">+₩{day.profit.toLocaleString()}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-surface-800">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-800/30 text-xs text-surface-500">
              <th className="px-4 py-2 text-left">상품</th>
              <th className="px-4 py-2 text-left">옵션</th>
              <th className="px-4 py-2 text-center">수량</th>
              <th className="px-4 py-2 text-right">매출</th>
              <th className="px-4 py-2 text-right">이익</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-800/50">
              {sales.map(s => {
                const opt = [s.product_skus?.o1?.option_value, s.product_skus?.o2?.option_value].filter(Boolean).join('/')
                return (
                  <tr key={s.id} className="hover:bg-surface-800/20">
                    <td className="px-4 py-2.5 text-surface-200">{s.product_skus?.products?.name}</td>
                    <td className="px-4 py-2.5 text-surface-400 text-xs">{opt || '-'}</td>
                    <td className="px-4 py-2.5 text-center text-surface-300">{s.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-surface-200 font-mono text-xs">₩{(s.sale_price * s.quantity).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-400 font-mono text-xs">₩{(s.margin * s.quantity).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
