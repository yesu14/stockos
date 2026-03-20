import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend
} from 'recharts'
import {
  Package, AlertTriangle, ArrowDown, TrendingUp,
  ShoppingCart, RotateCcw, Boxes, RefreshCw
} from 'lucide-react'

const SALE_COLORS   = ['#0ea5e9','#38bdf8','#7dd3fc','#bae6fd','#93c5fd','#6ee7b7','#a5b4fc']
const RETURN_COLORS = ['#f97316','#fb923c','#fdba74','#fcd34d','#fca5a5','#f87171','#ef4444']

function CustomBarTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-white font-medium max-w-48 truncate">{payload[0].payload.fullLabel || payload[0].payload.label}</p>
      <p className="font-bold mt-0.5" style={{ color: payload[0].fill }}>{payload[0].value}개</p>
    </div>
  )
}
function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-surface-300 mb-1 font-medium">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: ₩{Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ activeProducts:0, totalSkus:0, lowStock:0, inboundCount:0, totalStock:0, totalValue:0 })
  const [salesRank, setSalesRank] = useState([])
  const [returnRank, setReturnRank] = useState([])
  const [revenueLine, setRevenueLine] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => { loadAll() }, [period])

  async function loadAll() {
    setLoading(true)
    try { await Promise.all([loadStats(), loadSalesRank(), loadReturnRank(), loadRevenueLine()]) }
    finally { setLoading(false) }
  }

  async function loadStats() {
    const { count: activeProducts } = await supabase.from('products').select('*', { count:'exact', head:true }).eq('is_active', true)
    const { data: skus } = await supabase.from('product_skus').select('id, stock, product_id').eq('is_active', true)
    const totalStock = skus?.reduce((s, sk) => s + (sk.stock||0), 0) || 0
    const { data: prods } = await supabase.from('products').select('id, sale_price').eq('is_active', true)
    const priceMap = Object.fromEntries((prods||[]).map(p=>[p.id, p.sale_price||0]))
    const totalValue = (skus||[]).reduce((s,sk) => s + (sk.stock||0)*(priceMap[sk.product_id]||0), 0)
    const { data: alerts } = await supabase.from('stock_alerts').select('product_sku_id, threshold').eq('is_active', true)
    const stockMap = Object.fromEntries((skus||[]).map(s=>[s.id, s.stock||0]))
    const lowStock = (alerts||[]).filter(a => (stockMap[a.product_sku_id]??0) <= a.threshold).length
    const { count: inboundCount } = await supabase.from('inbound_orders').select('*', { count:'exact', head:true }).eq('order_type','inbound')
    setStats({ activeProducts:activeProducts||0, totalSkus:skus?.length||0, lowStock, inboundCount:inboundCount||0, totalStock, totalValue })
  }

  async function loadSalesRank() {
    const from = new Date(Date.now() - parseInt(period)*86400000).toISOString().slice(0,10)
    const { data } = await supabase.from('sales')
      .select('quantity, product_sku_id, product_skus(products(name), o1:option1_id(option_value), o2:option2_id(option_value))')
      .gte('sale_date', from)
    const map = {}
    ;(data||[]).forEach(s => {
      const pname = s.product_skus?.products?.name||'상품'
      const o1 = s.product_skus?.o1?.option_value
      const o2 = s.product_skus?.o2?.option_value
      const label = [pname, o1, o2].filter(Boolean).join(' / ')
      map[label] = (map[label]||0) + (s.quantity||0)
    })
    setSalesRank(Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([label,qty]) => ({
      label: label.length>14 ? label.slice(0,14)+'…' : label,
      fullLabel: label, qty
    })))
  }

  async function loadReturnRank() {
    const from = new Date(Date.now() - parseInt(period)*86400000).toISOString().slice(0,10)
    const { data } = await supabase.from('return_orders')
      .select('return_date, return_items(quantity, product_sku_id, product_skus(products(name), o1:option1_id(option_value), o2:option2_id(option_value)))')
      .gte('return_date', from)
    const map = {}
    ;(data||[]).forEach(order => {
      ;(order.return_items||[]).forEach(it => {
        const pname = it.product_skus?.products?.name||'상품'
        const o1 = it.product_skus?.o1?.option_value
        const o2 = it.product_skus?.o2?.option_value
        const label = [pname, o1, o2].filter(Boolean).join(' / ')
        map[label] = (map[label]||0) + (it.quantity||0)
      })
    })
    setReturnRank(Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([label,qty]) => ({
      label: label.length>14 ? label.slice(0,14)+'…' : label,
      fullLabel: label, qty
    })))
  }

  async function loadRevenueLine() {
    const from = new Date(Date.now() - parseInt(period)*86400000).toISOString().slice(0,10)
    const { data } = await supabase.from('sales')
      .select('sale_date, quantity, sale_price, margin')
      .gte('sale_date', from)
      .order('sale_date')
    const map = {}
    ;(data||[]).forEach(s => {
      const d = s.sale_date
      if (!map[d]) map[d] = { date: d, label: d.slice(5), 매출: 0, 순이익: 0 }
      map[d]['매출'] += (s.sale_price||0) * (s.quantity||0)
      map[d]['순이익'] += (s.margin||0) * (s.quantity||0)
    })
    setRevenueLine(Object.values(map).sort((a,b)=>a.date.localeCompare(b.date)))
  }

  const periodLabel = { '7':'최근 7일', '30':'최근 30일', '90':'최근 90일' }[period]

  const fmtY = v => v>=1000000 ? `₩${(v/1000000).toFixed(1)}M` : v>=1000 ? `₩${(v/1000).toFixed(0)}K` : `₩${v}`

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">대시보드</h1>
          <p className="text-surface-400 text-sm mt-0.5">재고 현황 개요</p>
        </div>
        <div className="flex items-center gap-2">
          {['7','30','90'].map(d => (
            <button key={d} onClick={() => setPeriod(d)}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' + (period===d?'bg-primary-500 text-white':'bg-surface-800 text-surface-400 hover:text-white')}>
              {d}일
            </button>
          ))}
          <button onClick={loadAll} className="p-1.5 bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white rounded-lg transition-colors">
            <RefreshCw size={14} className={loading?'animate-spin':''} />
          </button>
        </div>
      </div>

      {/* 통계 카드 - 한 줄 5개 */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: Package,       label: '활성 상품',   value: stats.activeProducts.toLocaleString(),            sub: `${stats.totalSkus}개 SKU`,     color: 'text-white',        bg: 'bg-primary-500/10',  ic: 'text-primary-400'  },
          { icon: AlertTriangle, label: '재고 부족',   value: stats.lowStock.toLocaleString(),                   sub: '알림 기준 이하',               color: 'text-red-400',      bg: 'bg-red-500/10',      ic: 'text-red-400'      },
          { icon: ArrowDown,     label: '입고 건수',   value: stats.inboundCount.toLocaleString(),               sub: '전체 입고',                    color: 'text-blue-400',     bg: 'bg-blue-500/10',     ic: 'text-blue-400'     },
          { icon: Boxes,         label: '총 재고',     value: stats.totalStock.toLocaleString(),                 sub: '현재 재고',                    color: 'text-emerald-400',  bg: 'bg-emerald-500/10',  ic: 'text-emerald-400'  },
          { icon: TrendingUp,    label: '재고가치',    value: `₩${stats.totalValue>=1000000?(stats.totalValue/1000000).toFixed(1)+'M':stats.totalValue.toLocaleString()}`, sub: '판매가 기준', color: 'text-yellow-400', bg: 'bg-yellow-500/10', ic: 'text-yellow-400' },
        ].map(({ icon: Icon, label, value, sub, color, bg, ic }) => (
          <div key={label} className="bg-surface-900 border border-surface-800 rounded-xl p-3 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bg} shrink-0`}>
              <Icon size={16} className={ic} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-surface-500 truncate">{label}</p>
              <p className={`text-sm font-bold ${color} leading-tight`}>{value}</p>
              <p className="text-[10px] text-surface-600 truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {stats.lowStock > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-xs">{stats.lowStock}개 SKU의 재고가 알림 기준 이하입니다.</p>
        </div>
      )}

      {/* 1. 매출 라인 차트 - 전체 가로 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-primary-400" />
          <h2 className="text-base font-semibold text-white">일별 매출</h2>
          <span className="text-xs text-surface-500 ml-auto">{periodLabel}</span>
        </div>
        {loading ? (
          <div className="h-56 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : revenueLine.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-surface-500 text-sm">매출 데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueLine} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={45} />
              <YAxis tickFormatter={fmtY} tick={{ fill: '#94a3b8', fontSize: 10 }} width={65} />
              <Tooltip content={<CustomLineTooltip />} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
              <Line type="monotone" dataKey="매출" stroke="#0ea5e9" strokeWidth={2} dot={{ fill:'#0ea5e9', r:3 }} activeDot={{ r:5 }} />
              <Line type="monotone" dataKey="순이익" stroke="#22c55e" strokeWidth={2} dot={{ fill:'#22c55e', r:3 }} activeDot={{ r:5 }} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 2+3. 판매량 & 반품 순위 - 나란히 */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* 판매량 순위 */}
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={16} className="text-primary-400" />
            <h2 className="text-base font-semibold text-white">판매량 순위</h2>
            <span className="text-xs text-surface-500 ml-auto">{periodLabel}</span>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : salesRank.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-surface-500 text-sm">판매 데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={salesRank} margin={{ top: 5, right: 10, left: 5, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-35} textAnchor="end" height={90} interval={0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={30} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="qty" name="판매수량" radius={[4, 4, 0, 0]}>
                  {salesRank.map((_, i) => <Cell key={i} fill={SALE_COLORS[i % SALE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 반품 순위 */}
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw size={16} className="text-orange-400" />
            <h2 className="text-base font-semibold text-white">반품 순위</h2>
            <span className="text-xs text-surface-500 ml-auto">{periodLabel}</span>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : returnRank.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-surface-500 text-sm">반품 데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={returnRank} margin={{ top: 5, right: 10, left: 5, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-35} textAnchor="end" height={90} interval={0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={30} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="qty" name="반품수량" radius={[4, 4, 0, 0]}>
                  {returnRank.map((_, i) => <Cell key={i} fill={RETURN_COLORS[i % RETURN_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
