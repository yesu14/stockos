import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Calendar, ChevronLeft, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend
} from 'recharts'

const BAR_COLORS = ['#0ea5e9','#38bdf8','#7dd3fc','#93c5fd','#a5b4fc','#6ee7b7','#fcd34d','#fb923c','#f87171','#c4b5fd']

// ── 날짜 범위 계산 ────────────────────────────────────────
function getRange(mode, customFrom, customTo, monthVal) {
  const today = new Date()
  const fmt = d => d.toISOString().slice(0, 10)
  if (mode === 'today') return { from: fmt(today), to: fmt(today) }
  if (mode === '7')     return { from: fmt(new Date(today - 6   * 86400000)), to: fmt(today) }
  if (mode === '30')    return { from: fmt(new Date(today - 29  * 86400000)), to: fmt(today) }
  if (mode === '180')   return { from: fmt(new Date(today - 179 * 86400000)), to: fmt(today) }
  if (mode === 'month' && monthVal) {
    const y = today.getFullYear()
    const m = String(monthVal).padStart(2, '0')
    const lastDay = new Date(y, monthVal, 0).getDate()
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` }
  }
  if (mode === 'custom') return { from: customFrom, to: customTo }
  return null
}

// ── 체크박스 (indeterminate 지원) ─────────────────────────
function Chk({ state, onChange }) {
  const ref = el => { if (el) el.indeterminate = state === 'partial' }
  return (
    <input type="checkbox" ref={ref}
      checked={state === true || state === 'partial'}
      onChange={onChange}
      className="w-4 h-4 accent-primary-500 cursor-pointer shrink-0"
    />
  )
}

// ── X축 커스텀 틱 ─────────────────────────────────────────
function CustomXAxisTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="end" fill="#94a3b8" fontSize={11} transform="rotate(-45)">
        {payload.value}
      </text>
    </g>
  )
}

function CustomBarTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const item = payload[0].payload
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs shadow-lg" style={{ maxWidth: 220 }}>
      <p className="text-white font-semibold">{item.pname}</p>
      {item.optPart && <p className="text-primary-300 mt-0.5">{item.optPart}</p>}
      <p className="font-bold text-primary-400 mt-1 text-sm">{payload[0].value}개</p>
    </div>
  )
}

function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-surface-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.stroke }} className="font-bold">{p.name}: {p.value}개</p>
      ))}
    </div>
  )
}

// ── 상품 트리 체크박스 컴포넌트 ───────────────────────────
// skuTree: { catId: { catName, products: { prodId: { prodName, skus: [{ skuId, o1, o2 }] } } } }
// checkedSkus: Set<skuId>
function ProductTreeSelector({ skuTree, checkedSkus, onToggle }) {
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})

  // 전체 skuId 목록
  const allSkuIds = useMemo(() => {
    const ids = []
    Object.values(skuTree).forEach(cat =>
      Object.values(cat.products).forEach(prod =>
        prod.skus.forEach(s => ids.push(s.skuId))
      )
    )
    return ids
  }, [skuTree])

  const allChecked = allSkuIds.length > 0 && allSkuIds.every(id => checkedSkus.has(id))
  const someChecked = allSkuIds.some(id => checkedSkus.has(id))

  function toggleAll() {
    if (allChecked) onToggle(allSkuIds, false)
    else onToggle(allSkuIds, true)
  }

  function catSkuIds(cat) {
    return Object.values(cat.products).flatMap(p => p.skus.map(s => s.skuId))
  }
  function catState(cat) {
    const ids = catSkuIds(cat)
    const n = ids.filter(id => checkedSkus.has(id)).length
    return n === 0 ? false : n === ids.length ? true : 'partial'
  }
  function prodState(prod) {
    const ids = prod.skus.map(s => s.skuId)
    const n = ids.filter(id => checkedSkus.has(id)).length
    return n === 0 ? false : n === ids.length ? true : 'partial'
  }

  return (
    <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
      {/* 전체 선택 헤더 */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-800/60 border-b border-surface-800">
        <Chk
          state={allChecked ? true : someChecked ? 'partial' : false}
          onChange={toggleAll}
        />
        <span className="text-xs font-semibold text-surface-300">전체 선택</span>
        <span className="text-xs text-surface-500 ml-auto">{checkedSkus.size}/{allSkuIds.length} 선택됨</span>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {Object.entries(skuTree).map(([catId, cat]) => {
          const catOpen = expCats[catId] ?? true
          const cState = catState(cat)
          const catIds = catSkuIds(cat)
          return (
            <div key={catId} className="border-b border-surface-800/40 last:border-0">
              {/* 카테고리 행 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                <Chk state={cState} onChange={() => onToggle(catIds, cState !== true)} />
                <div className="flex-1 flex items-center gap-2 cursor-pointer"
                  onClick={() => setExpCats(p => ({ ...p, [catId]: !catOpen }))}>
                  {catOpen ? <ChevronDown size={13} className="text-surface-500" /> : <ChevronRight size={13} className="text-surface-500" />}
                  <span className="text-sm font-semibold text-white">{cat.catName}</span>
                  <span className="text-xs text-surface-500">({catIds.length}개 옵션)</span>
                </div>
              </div>

              {catOpen && Object.entries(cat.products).map(([prodId, prod]) => {
                const prodOpen = expProds[prodId] ?? true
                const pState = prodState(prod)
                const prodIds = prod.skus.map(s => s.skuId)
                return (
                  <div key={prodId} className="border-t border-surface-800/30">
                    {/* 상품 행 */}
                    <div className="flex items-center gap-2 pl-7 pr-3 py-1.5 hover:bg-surface-800/10">
                      <Chk state={pState} onChange={() => onToggle(prodIds, pState !== true)} />
                      <div className="flex-1 flex items-center gap-2 cursor-pointer"
                        onClick={() => setExpProds(p => ({ ...p, [prodId]: !prodOpen }))}>
                        {prodOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
                        <span className="text-sm font-medium text-surface-200">{prod.prodName}</span>
                        <span className="text-xs text-surface-600">({prod.skus.length})</span>
                      </div>
                    </div>

                    {/* 옵션 행 */}
                    {prodOpen && prod.skus.map(sku => {
                      const optLabel = [sku.o1, sku.o2].filter(Boolean).join(' / ') || 'Default'
                      const checked = checkedSkus.has(sku.skuId)
                      return (
                        <div key={sku.skuId}
                          className="flex items-center gap-2 pl-14 pr-3 py-1.5 border-t border-surface-800/20 hover:bg-surface-800/5 cursor-pointer"
                          onClick={() => onToggle([sku.skuId], !checked)}>
                          <Chk state={checked} onChange={() => {}} />
                          <span className="text-xs text-surface-400 flex-1">{optLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function SalesReportPage() {
  const navigate = useNavigate()

  const [mode, setMode] = useState('today')
  const [monthVal, setMonthVal] = useState(new Date().getMonth() + 1)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [checkedSkus, setCheckedSkus] = useState(new Set())

  // 데이터
  const [rawSales, setRawSales] = useState([])
  const [loading, setLoading] = useState(false)


  useEffect(() => {
    if (mode !== 'custom') load()
  }, [mode, monthVal])

  async function load() {
    const r = getRange(mode, customFrom, customTo, monthVal)
    if (!r?.from || !r?.to) return
    setLoading(true)
    const { data } = await supabase.from('sales')
      .select(`id, sale_date, quantity, sale_price, margin, product_sku_id,
        product_skus(
          products(id, name, category_id, categories(name)),
          o1:option1_id(option_value),
          o2:option2_id(option_value)
        )`)
      .gte('sale_date', r.from)
      .lte('sale_date', r.to)
      .order('sale_date')
    setRawSales(data || [])
    // 처음 로드 시 전체 선택
    const allIds = new Set((data || []).map(s => s.product_sku_id))
    setCheckedSkus(allIds)
    setLoading(false)
  }

  // ── 트리 구조 빌드 ────────────────────────────────────
  const skuTree = useMemo(() => {
    const tree = {}
    rawSales.forEach(s => {
      const sku = s.product_skus
      const prod = sku?.products
      if (!prod) return
      const catId = prod.category_id || '__none__'
      const catName = prod.categories?.name || '미분류'
      const prodId = prod.id
      const prodName = prod.name
      const skuId = s.product_sku_id
      const o1 = sku.o1?.option_value
      const o2 = sku.o2?.option_value

      if (!tree[catId]) tree[catId] = { catName, products: {} }
      if (!tree[catId].products[prodId]) tree[catId].products[prodId] = { prodName, skus: [] }
      // 중복 skuId 추가 방지
      if (!tree[catId].products[prodId].skus.some(sk => sk.skuId === skuId)) {
        tree[catId].products[prodId].skus.push({ skuId, o1, o2 })
      }
    })
    return tree
  }, [rawSales])

  function handleToggle(ids, add) {
    setCheckedSkus(prev => {
      const next = new Set(prev)
      ids.forEach(id => add ? next.add(id) : next.delete(id))
      return next
    })
  }

  // ── 필터된 판매 데이터 (checkedSkus 기준) ────────────
  const filteredSales = useMemo(() => {
    if (checkedSkus.size === 0) return rawSales
    return rawSales.filter(s => checkedSkus.has(s.product_sku_id))
  }, [rawSales, checkedSkus])

  // ── 판매량 TOP 20 (BAR CHART) ─────────────────────────
  const rankData = useMemo(() => {
    const map = {}
    filteredSales.forEach(s => {
      const pname = s.product_skus?.products?.name || '상품'
      const o1 = s.product_skus?.o1?.option_value
      const o2 = s.product_skus?.o2?.option_value
      const fullLabel = [pname, o1, o2].filter(Boolean).join(' / ')
      const optPart = [o1, o2].filter(Boolean).join('/')
      const xLabel = optPart
        ? (optPart.length > 10 ? optPart.slice(0, 10) + '…' : optPart)
        : (pname.length > 10 ? pname.slice(0, 10) + '…' : pname)
      if (!map[fullLabel]) map[fullLabel] = { qty: 0, xLabel, fullLabel, pname, optPart }
      map[fullLabel].qty += (s.quantity || 0)
    })
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 20)
  }, [filteredSales])

  // ── 일별 판매 추이 (LINE CHART) ──────────────────────
  const lineData = useMemo(() => {
    const dayMap = {}
    filteredSales.forEach(s => {
      const d = s.sale_date
      const pname = s.product_skus?.products?.name || '상품'
      const o1 = s.product_skus?.o1?.option_value
      const o2 = s.product_skus?.o2?.option_value
      const optPart = [o1, o2].filter(Boolean).join('/')
      const seriesKey = optPart ? `${pname}/${optPart}` : pname
      if (!dayMap[d]) dayMap[d] = { date: d, label: d.slice(5) }
      dayMap[d][seriesKey] = (dayMap[d][seriesKey] || 0) + (s.quantity || 0)
    })
    return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredSales])

  const lineSeriesKeys = useMemo(() => {
    const keys = new Set()
    filteredSales.forEach(s => {
      const pname = s.product_skus?.products?.name || '상품'
      const o1 = s.product_skus?.o1?.option_value
      const o2 = s.product_skus?.o2?.option_value
      const optPart = [o1, o2].filter(Boolean).join('/')
      keys.add(optPart ? `${pname}/${optPart}` : pname)
    })
    return [...keys].slice(0, 10) // 최대 10개 시리즈
  }, [filteredSales])

  const LINE_COLORS = ['#0ea5e9','#22c55e','#f97316','#a855f7','#ec4899','#eab308','#14b8a6','#f43f5e','#64748b','#8b5cf6']

  // ── 일별 요약 ─────────────────────────────────────────
  const dailySummary = useMemo(() => {
    const map = {}
    filteredSales.forEach(s => {
      const d = s.sale_date
      if (!map[d]) map[d] = { date: d, revenue: 0, profit: 0, qty: 0 }
      map[d].revenue += (s.sale_price || 0) * (s.quantity || 0)
      map[d].profit  += (s.margin || 0) * (s.quantity || 0)
      map[d].qty     += s.quantity || 0
    })
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredSales])

  const totalRevenue = filteredSales.reduce((s, r) => s + (r.sale_price||0)*(r.quantity||0), 0)
  const totalQty     = filteredSales.reduce((s, r) => s + (r.quantity||0), 0)

  const MODES = [
    { key: 'today', label: '오늘' },
    { key: '7',     label: '최근 7일' },
    { key: '30',    label: '최근 30일' },
    { key: '180',   label: '최근 180일' },
    { key: 'month', label: '월별' },
    { key: 'custom',label: '기간 선택' },
  ]
  const modeLabel = MODES.find(m => m.key === mode)?.label || ''

  return (
    <div className="max-w-6xl space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sales')} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white">매출 조회</h1>
      </div>

      {/* 기간 탭 */}
      <div className="flex flex-wrap gap-2">
        {MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' +
              (mode === m.key ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
            {m.label}
          </button>
        ))}
      </div>

      {/* 월별 선택 */}
      {mode === 'month' && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <button key={m} onClick={() => { setMonthVal(m); setTimeout(load, 0) }}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' +
                (monthVal === m ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
              {m}월
            </button>
          ))}
        </div>
      )}

      {/* 기간 직접 선택 */}
      {mode === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
          <span className="text-surface-500">~</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
          <button onClick={load} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">조회</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rawSales.length === 0 ? (
        <div className="text-center py-20 text-surface-500">
          <Calendar size={40} className="mx-auto mb-2 opacity-30" />
          <p>선택한 기간에 판매 기록이 없습니다</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">

          {/* ── 왼쪽: 상품 트리 필터 ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">상품별 필터</p>
            <ProductTreeSelector
              skuTree={skuTree}
              checkedSkus={checkedSkus}
              onToggle={handleToggle}
            />
            <p className="text-[11px] text-surface-600 text-center">체크된 상품만 차트에 반영됩니다</p>
          </div>

          {/* ── 오른쪽: 차트 + 요약 ── */}
          <div className="space-y-5">
            {/* 요약 카드 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
                <p className="text-xs text-surface-500 mb-1">총 매출</p>
                <p className="text-lg font-bold text-white">₩{totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-surface-600 mt-0.5">{modeLabel}{mode==='month'?` ${monthVal}월`:''}</p>
              </div>
              <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
                <p className="text-xs text-surface-500 mb-1">판매 수량</p>
                <p className="text-lg font-bold text-primary-400">{totalQty.toLocaleString()}개</p>
              </div>
              <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
                <p className="text-xs text-surface-500 mb-1">판매 일수</p>
                <p className="text-lg font-bold text-emerald-400">{dailySummary.length}일</p>
              </div>
            </div>

            {/* 차트: 항상 BAR CHART (선택 SKU 기반) */}
            <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">
                판매량 TOP 20 — {modeLabel}{mode==='month'?` ${monthVal}월`:''}
              </h2>
              {rankData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-surface-500 text-sm">데이터 없음</div>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={rankData} margin={{ top: 5, right: 10, left: 5, bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="xLabel" tick={<CustomXAxisTick />} height={105} interval={0} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={35} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="qty" name="판매수량" radius={[4, 4, 0, 0]}>
                      {rankData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 상품/옵션별 판매 통계 리스트 */}
            <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-surface-800/40 border-b border-surface-800">
                <h2 className="text-sm font-semibold text-white">상품/옵션별 판매 통계</h2>
                <span className="text-xs text-surface-500">{rankData.length}개 항목</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-800/20 text-xs text-surface-400 border-b border-surface-800">
                    <th className="px-4 py-2.5 text-left w-6">#</th>
                    <th className="px-4 py-2.5 text-left">상품명</th>
                    <th className="px-4 py-2.5 text-left">옵션</th>
                    <th className="px-4 py-2.5 text-center w-20">판매수량</th>
                    <th className="px-4 py-2.5 text-right w-28">총 매출</th>
                    <th className="px-4 py-2.5 text-right w-28">총 이익</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/40">
                  {rankData.map((item, idx) => {
                    // 해당 SKU의 매출/이익 합계
                    const skuSales = filteredSales.filter(s => {
                      const pname = s.product_skus?.products?.name || '상품'
                      const o1 = s.product_skus?.o1?.option_value
                      const o2 = s.product_skus?.o2?.option_value
                      return [pname, o1, o2].filter(Boolean).join(' / ') === item.fullLabel
                    })
                    const rev = skuSales.reduce((s, r) => s + (r.sale_price||0)*(r.quantity||0), 0)
                    const profit = skuSales.reduce((s, r) => s + (r.margin||0)*(r.quantity||0), 0)
                    return (
                      <tr key={item.fullLabel} className="hover:bg-surface-800/20 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-surface-600 text-center">{idx+1}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-white">{item.pname}</td>
                        <td className="px-4 py-2.5 text-xs text-surface-400">{item.optPart || '-'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-primary-500/15 text-primary-400 rounded-lg text-xs font-bold font-mono">{item.qty}개</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-surface-200 font-mono text-xs">₩{rev.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-400 font-mono text-xs">₩{profit.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-800/30 border-t border-surface-700">
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-surface-300">합계</td>
                    <td className="px-4 py-2.5 text-center text-primary-400 font-bold font-mono text-sm">{totalQty}개</td>
                    <td className="px-4 py-2.5 text-right text-surface-200 font-mono text-xs font-semibold">₩{totalRevenue.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-400 font-mono text-xs font-semibold">
                      ₩{filteredSales.reduce((s,r)=>s+(r.margin||0)*(r.quantity||0),0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
