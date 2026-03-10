import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Package, TrendingUp, AlertTriangle, ArrowDown } from 'lucide-react'

const COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe']

export default function Dashboard() {
  const { t } = useTranslation()
  const [topProducts, setTopProducts] = useState([])
  const [stats, setStats] = useState({ totalProducts: 0, lowStock: 0, totalInbound: 0, totalValue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true)
      const { count: totalInbound } = await supabase.from('inbound_orders').select('*', { count: 'exact', head: true })
      const { data: skus } = await supabase.from('product_skus').select('id, stock, sale_price')
      const totalValue = skus?.reduce((sum, s) => sum + (s.stock * (s.sale_price||0)), 0) || 0
      // Use stock_alerts thresholds (not hardcoded 10)
      const { data: alerts } = await supabase.from('stock_alerts').select('product_sku_id, threshold').eq('is_active', true)
      const alertMap = Object.fromEntries((alerts||[]).map(a => [a.product_sku_id, a.threshold]))
      const stockMap = Object.fromEntries((skus||[]).map(s => [s.id, s.stock]))
      const lowStock = (alerts||[]).filter(a => (stockMap[a.product_sku_id] ?? 0) <= a.threshold).length
      setStats({ totalProducts: totalProducts || 0, lowStock, totalInbound: totalInbound || 0, totalValue })

      const { data: top } = await supabase.from('products').select('id, name, image_url, product_skus(stock)').eq('is_active', true).limit(20)
      if (top) {
        const withTotal = top.map(p => ({ ...p, totalStock: p.product_skus?.reduce((s, sku) => s + (sku.stock || 0), 0) || 0 }))
        withTotal.sort((a, b) => b.totalStock - a.totalStock)
        setTopProducts(withTotal.slice(0, 5))
      }
    } finally {
      setLoading(false)
    }
  }

  const chartData = topProducts.map(p => ({
    name: p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name,
    stock: p.totalStock,
    fullName: p.name
  }))

  const StatCard = ({ icon: Icon, label, value, color, sub }) => (
    <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-400">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
          {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-xl ${color ? 'bg-red-500/10' : 'bg-primary-500/10'}`}>
          <Icon size={20} className={color || 'text-primary-400'} />
        </div>
      </div>
    </div>
  )

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.[0]) {
      return (
        <div className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm">
          <p className="text-white font-medium">{payload[0].payload.fullName}</p>
          <p className="text-primary-400">재고: {payload[0].value}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('menu.dashboard')}</h1>
        <p className="text-surface-400 text-sm mt-1">재고 현황 개요</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="활성 상품" value={stats.totalProducts} sub="등록된 상품 수" />
        <StatCard icon={AlertTriangle} label="재고 부족" value={stats.lowStock} color="text-red-400" sub="알림 설정 기준" />
        <StatCard icon={ArrowDown} label="입고 건수" value={stats.totalInbound} sub="총 입고" />
        <StatCard icon={TrendingUp} label="총 재고가치" value={`₩${stats.totalValue.toLocaleString()}`} sub="판매가 기준" />
      </div>

      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-6">{t('common.topProducts')}</h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : topProducts.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-surface-500">데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="stock" radius={[6, 6, 0, 0]}>
                {chartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {stats.lowStock > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="text-red-300 font-medium">재고 부족 경고</p>
            <p className="text-red-400/70 text-sm">{stats.lowStock}개 SKU의 재고가 알림 설정 기준 이하입니다.</p>
          </div>
        </div>
      )}
    </div>
  )
}
