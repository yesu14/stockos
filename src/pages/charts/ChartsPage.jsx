import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'
import {
  TrendingUp, RotateCcw, ArrowDownCircle, ArrowUpCircle,
  ChevronDown, ChevronRight, Calendar, Search, CheckSquare
} from 'lucide-react'

// ════════════════════════════════════════════════════════
// 공통 컴포넌트
// ════════════════════════════════════════════════════════
function Chk({ state, onChange, accent = 'accent-primary-500' }) {
  const ref = el => { if (el) el.indeterminate = state === 'partial' }
  return (
    <input type="checkbox" ref={ref}
      checked={state === true || state === 'partial'}
      onChange={onChange}
      className={`w-4 h-4 ${accent} cursor-pointer shrink-0`} />
  )
}

function XTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="end" fill="#94a3b8" fontSize={10} transform="rotate(-40)">
        {payload.value}
      </text>
    </g>
  )
}

function BarTip({ active, payload, accent = '#0ea5e9' }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs shadow-lg">
      {d.prodName && <p className="text-white font-semibold">{d.prodName}</p>}
      {d.optPart && <p style={{ color: accent }}>{d.optPart}</p>}
      {!d.prodName && <p className="text-white font-semibold">{d.xLabel}</p>}
      <p className="font-bold mt-1" style={{ color: accent }}>{payload[0].value}개</p>
    </div>
  )
}

// 트리 체크박스 공통
function TreeFilter({ tree, checkedSkus, onToggle, accent = 'accent-primary-500', accentBg = 'bg-primary-500' }) {
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})

  function catSkuIds(cat) { return Object.values(cat.prods).flatMap(p => p.skus.map(s => s.skuId)) }
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

  const allSkuIds = Object.values(tree).flatMap(cat => catSkuIds(cat))
  const allChecked = allSkuIds.length > 0 && allSkuIds.every(id => checkedSkus.has(id))
  const anyChecked = allSkuIds.some(id => checkedSkus.has(id))

  return (
    <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-800/60 border-b border-surface-800">
        <Chk state={allChecked ? true : anyChecked ? 'partial' : false}
          onChange={() => onToggle(allSkuIds, !allChecked)} accent={accent} />
        <span className="text-xs font-semibold text-surface-300 flex-1">전체 선택</span>
        <span className="text-xs text-surface-500">{checkedSkus.size}/{allSkuIds.length}</span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {Object.keys(tree).length === 0
          ? <p className="text-center py-6 text-surface-500 text-xs">데이터 없음</p>
          : Object.entries(tree).map(([catId, cat]) => {
            const catOpen = expCats[catId] ?? true
            const cIds = catSkuIds(cat)
            return (
              <div key={catId} className="border-b border-surface-800/40 last:border-0">
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                  <Chk state={catState(cat)} onChange={() => onToggle(cIds, catState(cat) !== true)} accent={accent} />
                  <div className="flex-1 flex items-center gap-1.5 cursor-pointer"
                    onClick={() => setExpCats(p => ({ ...p, [catId]: !catOpen }))}>
                    {catOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
                    <span className="text-xs font-semibold text-white">{cat.catName}</span>
                  </div>
                </div>
                {catOpen && Object.entries(cat.prods).map(([prodId, prod]) => {
                  const prodOpen = expProds[prodId] ?? false
                  const pIds = prod.skus.map(s => s.skuId)
                  return (
                    <div key={prodId} className="border-t border-surface-800/30">
                      <div className="flex items-center gap-2 pl-6 pr-3 py-1.5 hover:bg-surface-800/10">
                        <Chk state={prodState(prod)} onChange={() => onToggle(pIds, prodState(prod) !== true)} accent={accent} />
                        <div className="flex-1 flex items-center gap-1.5 cursor-pointer"
                          onClick={() => setExpProds(p => ({ ...p, [prodId]: !prodOpen }))}>
                          {prodOpen ? <ChevronDown size={11} className="text-surface-500" /> : <ChevronRight size={11} className="text-surface-500" />}
                          <span className="text-xs text-surface-200">{prod.prodName}</span>
                        </div>
                      </div>
                      {prodOpen && prod.skus.map(sku => (
                        <div key={sku.skuId}
                          className="flex items-center gap-2 pl-12 pr-3 py-1.5 border-t border-surface-800/20 cursor-pointer hover:bg-surface-800/5"
                          onClick={() => onToggle([sku.skuId], !checkedSkus.has(sku.skuId))}>
                          <Chk state={checkedSkus.has(sku.skuId)} onChange={() => {}} accent={accent} />
                          <span className="text-xs text-surface-400">{sku.label}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// 뷰 탭 + 서브 필터 공통
function ViewTabs({ viewBy, setViewBy, dbYears, yearFilter, setYearFilter, monthFilter, setMonthFilter, rangeFrom, setRangeFrom, rangeTo, setRangeTo, accent = 'bg-primary-500', extra }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-surface-800 rounded-xl p-1">
          {[['month','월별'],['range','기간별'],['year','년도별']].map(([v,l]) => (
            <button key={v} onClick={() => setViewBy(v)}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' +
                (viewBy === v ? `${accent} text-white` : 'text-surface-400 hover:text-white')}>
              {l}
            </button>
          ))}
        </div>
        {extra}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {viewBy === 'month' && (<>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">전체 연도</option>
            {dbYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <div className="flex flex-wrap gap-1">
            {Array.from({length:12},(_,i)=>i+1).map(m => {
              const mm = String(m).padStart(2,'0')
              return (
                <button key={m} onClick={() => setMonthFilter(monthFilter === mm ? '' : mm)}
                  className={'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ' +
                    (monthFilter === mm ? `${accent} text-white` : 'bg-surface-800 text-surface-400 hover:text-white')}>
                  {m}월
                </button>
              )
            })}
          </div>
        </>)}
        {viewBy === 'range' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none" />
            <span className="text-surface-500 text-xs">~</span>
            <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none" />
          </div>
        )}
        {viewBy === 'year' && (
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">전체 연도</option>
            {dbYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// 판매 차트 (SalesReportPage 로직 통합)
// ════════════════════════════════════════════════════════
function SalesChart() {
  const [mode, setMode]               = useState('today')
  const [monthVal, setMonthVal]       = useState(new Date().getMonth() + 1)
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [rawSales, setRawSales]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [checkedSkus, setCheckedSkus] = useState(new Set())
  const [skuTree, setSkuTree]         = useState({})
  const [salesYearFilter, setSalesYearFilter] = useState('')
  const [dbSalesYears, setDbSalesYears]       = useState([])

  function getRange() {
    const today = new Date()
    const fmt = d => d.toISOString().slice(0,10)
    if (mode === 'today') return { from: fmt(today), to: fmt(today) }
    if (mode === '7')     return { from: fmt(new Date(today - 6*86400000)), to: fmt(today) }
    if (mode === '30')    return { from: fmt(new Date(today - 29*86400000)), to: fmt(today) }
    if (mode === '180')   return { from: fmt(new Date(today - 179*86400000)), to: fmt(today) }
    if (mode === 'month') {
      const y = salesYearFilter ? parseInt(salesYearFilter) : today.getFullYear()
      if (!monthVal) return { from: `${y}-01-01`, to: `${y}-12-31` }
      const m = String(monthVal).padStart(2,'0')
      return { from: `${y}-${m}-01`, to: `${y}-${m}-${new Date(y, monthVal, 0).getDate()}` }
    }
    if (mode === 'custom') return { from: customFrom, to: customTo }
    return null
  }

  useEffect(() => { if (mode !== 'custom') load() }, [mode, monthVal])

  async function load() {
    const r = getRange()
    if (!r?.from || !r?.to) return
    setLoading(true)
    const { data } = await supabase.from('sales')
      .select('id, sale_date, quantity, sale_price, margin, product_sku_id, product_skus(products(id, name, category_id, categories(name)), o1:option1_id(option_value), o2:option2_id(option_value))')
      .gte('sale_date', r.from).lte('sale_date', r.to).order('sale_date')
    setRawSales(data || [])
    // 트리 빌드
    const tree = {}
    const seenSkus = new Set()
    ;(data || []).forEach(s => {
      const prod = s.product_skus?.products
      if (!prod) return
      const catId = prod.category_id || '__none__'
      const catName = prod.categories?.name || '미분류'
      if (!tree[catId]) tree[catId] = { catName, prods: {} }
      if (!tree[catId].prods[prod.id]) tree[catId].prods[prod.id] = { prodName: prod.name, skus: [] }
      const skuId = s.product_sku_id
      if (!seenSkus.has(skuId)) {
        seenSkus.add(skuId)
        const opt = [s.product_skus?.o1?.option_value, s.product_skus?.o2?.option_value].filter(Boolean).join('/')
        tree[catId].prods[prod.id].skus.push({ skuId, label: opt || 'Default' })
      }
    })
    setSkuTree(tree)
    setCheckedSkus(new Set((data||[]).map(s => s.product_sku_id)))
    // 연도 목록 추출
    const sYears = [...new Set((data||[]).map(s => s.sale_date?.slice(0,4)).filter(Boolean))].sort().reverse()
    setDbSalesYears(sYears)
    setLoading(false)
  }

  function toggleSkus(ids, add) {
    setCheckedSkus(prev => { const next = new Set(prev); ids.forEach(id => add ? next.add(id) : next.delete(id)); return next })
  }

  const filtered = useMemo(() =>
    rawSales.filter(s => {
      if (!checkedSkus.has(s.product_sku_id)) return false
      if (salesYearFilter && s.sale_date?.slice(0,4) !== salesYearFilter) return false
      return true
    }), [rawSales, checkedSkus, salesYearFilter])

  const rankData = useMemo(() => {
    const map = {}
    filtered.forEach(s => {
      const pname = s.product_skus?.products?.name || '상품'
      const o1 = s.product_skus?.o1?.option_value, o2 = s.product_skus?.o2?.option_value
      const fullLabel = [pname, o1, o2].filter(Boolean).join(' / ')
      const optPart = [o1, o2].filter(Boolean).join('/')
      const xLabel = optPart ? (optPart.length>12?optPart.slice(0,12)+'…':optPart) : (pname.length>12?pname.slice(0,12)+'…':pname)
      if (!map[fullLabel]) map[fullLabel] = { qty: 0, xLabel, fullLabel, prodName: pname, optPart }
      map[fullLabel].qty += s.quantity || 0
    })
    return Object.values(map).sort((a,b) => b.qty-a.qty).slice(0,20)
  }, [filtered])

  const listData = useMemo(() => {
    const map = {}
    filtered.forEach(s => {
      const pname = s.product_skus?.products?.name || '상품'
      const o1 = s.product_skus?.o1?.option_value, o2 = s.product_skus?.o2?.option_value
      const optPart = [o1, o2].filter(Boolean).join('/')
      const key = s.product_sku_id
      if (!map[key]) map[key] = { prodName: pname, optPart, qty: 0, revenue: 0, profit: 0 }
      map[key].qty += s.quantity || 0
      map[key].revenue += (s.sale_price||0) * (s.quantity||0)
      map[key].profit  += (s.margin||0) * (s.quantity||0)
    })
    return Object.values(map).sort((a,b) => b.qty-a.qty)
  }, [filtered])

  const totalQty = filtered.reduce((s,r)=>s+(r.quantity||0),0)
  const totalRev = filtered.reduce((s,r)=>s+(r.sale_price||0)*(r.quantity||0),0)
  const BAR_COLORS = ['#0ea5e9','#38bdf8','#7dd3fc','#93c5fd','#a5b4fc','#6ee7b7','#fcd34d','#fb923c','#f87171','#c4b5fd']
  const MODES = [['today','오늘'],['7','최근 7일'],['30','최근 30일'],['180','최근 180일'],['month','월별'],['custom','기간 선택']]

  return (
    <div className="space-y-4">
      {/* 기간 탭 */}
      <div className="flex flex-wrap gap-2">
        {MODES.map(([k,l]) => (
          <button key={k} onClick={() => setMode(k)}
            className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' + (mode===k?'bg-primary-500 text-white':'bg-surface-800 text-surface-400 hover:text-white')}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'month' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={salesYearFilter} onChange={e => setSalesYearFilter(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              <option value="">전체 연도</option>
              {dbSalesYears.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => { setMonthVal(0); setTimeout(load,0) }}
              className={'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ' + (monthVal===0?'bg-primary-500 text-white':'bg-surface-800 text-surface-400 hover:text-white')}>
              전체
            </button>
            {Array.from({length:12},(_,i)=>i+1).map(m => (
              <button key={m} onClick={() => { setMonthVal(m); setTimeout(load,0) }}
                className={'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ' + (monthVal===m?'bg-primary-500 text-white':'bg-surface-800 text-surface-400 hover:text-white')}>
                {m}월
              </button>
            ))}
          </div>
        </div>
      )}
      {mode === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"/>
          <span className="text-surface-500">~</span>
          <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"/>
          <button onClick={load} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium">조회</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"/></div>
      ) : rawSales.length === 0 ? (
        <div className="text-center py-16 text-surface-500"><Calendar size={36} className="mx-auto mb-2 opacity-30"/><p>판매 기록이 없습니다</p></div>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">상품별 필터</p>
            <TreeFilter tree={skuTree} checkedSkus={checkedSkus} onToggle={toggleSkus} accent="accent-primary-500" accentBg="bg-primary-500" />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3"><p className="text-xs text-surface-500 mb-1">총 판매 수량</p><p className="text-xl font-bold text-primary-400">{totalQty.toLocaleString()}개</p></div>
              <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3"><p className="text-xs text-surface-500 mb-1">총 매출</p><p className="text-xl font-bold text-white">₩{totalRev.toLocaleString()}</p></div>
            </div>
            <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">판매량 TOP 20 (상품/옵션별)</h3>
              {rankData.length === 0 ? <div className="h-48 flex items-center justify-center text-surface-500 text-sm">데이터 없음</div> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={rankData} margin={{top:5,right:10,left:5,bottom:90}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                    <XAxis dataKey="xLabel" tick={<XTick/>} height={95} interval={0}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:11}} width={35}/>
                    <Tooltip content={<BarTip accent="#0ea5e9"/>} cursor={{fill:'rgba(255,255,255,0.04)'}}/>
                    <Bar dataKey="qty" name="판매수량" radius={[4,4,0,0]}>
                      {rankData.map((_,i)=><Cell key={i} fill={BAR_COLORS[i%BAR_COLORS.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {listData.length > 0 && (
              <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-surface-800/40 border-b border-surface-800">
                  <h3 className="text-sm font-semibold text-white">상품/옵션별 판매 통계</h3>
                  <span className="text-xs text-surface-500">{listData.length}개 항목</span>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-surface-800/20 text-xs text-surface-400 border-b border-surface-800">
                    <th className="px-3 py-2.5 text-left w-6">#</th>
                    <th className="px-3 py-2.5 text-left">상품명</th>
                    <th className="px-3 py-2.5 text-left">옵션</th>
                    <th className="px-3 py-2.5 text-center w-20">수량</th>
                    <th className="px-3 py-2.5 text-right w-28">매출</th>
                    <th className="px-3 py-2.5 text-right w-28">이익</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-800/40">
                    {listData.map((row,idx) => (
                      <tr key={idx} className="hover:bg-surface-800/20">
                        <td className="px-3 py-2 text-xs text-surface-600 text-center">{idx+1}</td>
                        <td className="px-3 py-2 text-sm font-medium text-white">{row.prodName}</td>
                        <td className="px-3 py-2 text-xs text-surface-400">{row.optPart||'-'}</td>
                        <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 bg-primary-500/15 text-primary-400 rounded-lg text-xs font-bold">{row.qty}개</span></td>
                        <td className="px-3 py-2 text-right text-surface-200 font-mono text-xs">₩{row.revenue.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-mono text-xs">₩{row.profit.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-surface-800/30 border-t border-surface-700">
                    <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-surface-300">합계</td>
                    <td className="px-3 py-2 text-center text-primary-400 font-bold font-mono">{totalQty}개</td>
                    <td className="px-3 py-2 text-right text-surface-200 font-mono text-xs font-semibold">₩{totalRev.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-mono text-xs font-semibold">₩{filtered.reduce((s,r)=>s+(r.margin||0)*(r.quantity||0),0).toLocaleString()}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ── 입고 차트 ─────────────────────────────────────────────
function InboundChart() {
  // ── 데이터 상태 ──
  const [rawItems, setRawItems] = useState([])  // 평탄화된 입고 아이템
  const [loading, setLoading] = useState(true)

  // ── 뷰 필터 ──
  const [viewBy, setViewBy] = useState('month')  // month | range | year
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))
  const [monthFilter, setMonthFilter] = useState('')  // '' or '01'~'12'
  const [dbYears, setDbYears] = useState([])  // DB에서 불러온 연도 목록

  // ── 트리 상태 ──
  const [skuTree, setSkuTree] = useState({})  // catId → { catName, prods: { prodId → { prodName, skus: [{skuId,o1,o2,label}] } } }
  const [checkedSkus, setCheckedSkus] = useState(new Set())
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    // 전체 입고 아이템 (날짜 포함)
    const { data } = await supabase.from('inbound_items')
      .select('id, quantity, inbound_order_id, product_sku_id, inbound_orders!inner(inbound_date, order_type), product_skus(product_id, products(id, name, category_id, categories(name)), o1:option1_id(option_value), o2:option2_id(option_value))')
      .eq('inbound_orders.order_type', 'inbound')
      .order('inbound_orders(inbound_date)')
    const items = (data || []).map(it => ({
      id: it.id,
      qty: it.quantity || 0,
      date: it.inbound_orders?.inbound_date || '',
      skuId: it.product_sku_id,
      prodId: it.product_skus?.products?.id,
      prodName: it.product_skus?.products?.name || '상품',
      catId: it.product_skus?.products?.category_id || '__none__',
      catName: it.product_skus?.products?.categories?.name || '미분류',
      o1: it.product_skus?.o1?.option_value,
      o2: it.product_skus?.o2?.option_value,
    }))
    setRawItems(items)

    // DB 연도 추출
    const years = [...new Set(items.map(it => it.date.slice(0,4)).filter(Boolean))].sort().reverse()
    setDbYears(years)

    // 트리 빌드
    const tree = {}
    items.forEach(it => {
      if (!tree[it.catId]) tree[it.catId] = { catName: it.catName, prods: {} }
      if (!tree[it.catId].prods[it.prodId]) tree[it.catId].prods[it.prodId] = { prodName: it.prodName, skus: [] }
      const skus = tree[it.catId].prods[it.prodId].skus
      if (!skus.some(s => s.skuId === it.skuId)) {
        const optPart = [it.o1, it.o2].filter(Boolean).join('/')
        skus.push({ skuId: it.skuId, o1: it.o1, o2: it.o2, label: optPart || 'Default' })
      }
    })
    setSkuTree(tree)

    // 전체 선택
    const allIds = new Set(items.map(it => it.skuId))
    setCheckedSkus(allIds)
    setLoading(false)
  }

  // ── 체크박스 토글 ──
  function toggleSkus(ids, add) {
    setCheckedSkus(prev => {
      const next = new Set(prev)
      ids.forEach(id => add ? next.add(id) : next.delete(id))
      return next
    })
  }
  function catSkuIds(cat) {
    return Object.values(cat.prods).flatMap(p => p.skus.map(s => s.skuId))
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
  const allSkuIds = Object.values(skuTree).flatMap(cat => catSkuIds(cat))
  const allChecked = allSkuIds.length > 0 && allSkuIds.every(id => checkedSkus.has(id))
  const anyChecked = allSkuIds.some(id => checkedSkus.has(id))

  // ── 날짜 필터 적용 ──
  const dateFiltered = useMemo(() => {
    return rawItems.filter(it => {
      if (!checkedSkus.has(it.skuId)) return false
      if (!it.date) return false
      if (viewBy === 'month') {
        if (yearFilter && it.date.slice(0,4) !== yearFilter) return false
        if (monthFilter && it.date.slice(5,7) !== monthFilter) return false
      }
      if (viewBy === 'range') {
        if (rangeFrom && it.date < rangeFrom) return false
        if (rangeTo   && it.date > rangeTo)   return false
      }
      return true
    })
  }, [rawItems, checkedSkus, viewBy, yearFilter, monthFilter, rangeFrom, rangeTo])

  // ── 차트 데이터 ──
  const BAR_COLORS = ['#0ea5e9','#38bdf8','#7dd3fc','#93c5fd','#a5b4fc','#6ee7b7','#fcd34d','#fb923c','#f87171','#c4b5fd']

  const barData = useMemo(() => {
    // 항상 상품/옵션별 수량 TOP 10
    const map = {}
    dateFiltered.forEach(it => {
      const optPart = [it.o1, it.o2].filter(Boolean).join('/')
      const fullLabel = [it.prodName, optPart].filter(Boolean).join(' / ')
      const xLabel = optPart
        ? (optPart.length > 10 ? optPart.slice(0,10)+'…' : optPart)
        : (it.prodName.length > 10 ? it.prodName.slice(0,10)+'…' : it.prodName)
      if (!map[fullLabel]) map[fullLabel] = { qty: 0, xLabel, fullLabel, prodName: it.prodName, optPart }
      map[fullLabel].qty += it.qty
    })
    return Object.values(map).sort((a,b) => b.qty - a.qty).slice(0, 10)
  }, [dateFiltered])

  // ── 리스트 (차트 하단 통계) ──
  const listData = useMemo(() => {
    const map = {}
    dateFiltered.forEach(it => {
      const optPart = [it.o1, it.o2].filter(Boolean).join('/')
      const key = `${it.skuId}`
      if (!map[key]) map[key] = { prodName: it.prodName, catName: it.catName, optPart, qty: 0 }
      map[key].qty += it.qty
    })
    return Object.values(map).sort((a,b) => b.qty-a.qty)
  }, [dateFiltered])

  const totalQty = dateFiltered.reduce((s,it) => s+it.qty, 0)

  function CustomXAxisTick({ x, y, payload }) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={10} textAnchor="end" fill="#94a3b8" fontSize={10} transform="rotate(-40)">
          {payload.value}
        </text>
      </g>
    )
  }

  function BarTooltip({ active, payload }) {
    if (!active || !payload?.[0]) return null
    const d = payload[0].payload
    return (
      <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs shadow-lg" style={{maxWidth:200}}>
        <p className="text-white font-semibold">{d.prodName}</p>
        {d.optPart && <p className="text-primary-300 mt-0.5">{d.optPart}</p>}
        <p className="text-primary-400 font-bold mt-1">{payload[0].value}개</p>
      </div>
    )
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">

      {/* ── 왼쪽: 상품 트리 필터 ── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">상품별 필터</p>
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          {/* 전체 선택 */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-800/60 border-b border-surface-800">
            <Chk state={allChecked ? true : anyChecked ? 'partial' : false}
              onChange={() => toggleSkus(allSkuIds, !allChecked)} accent="accent-primary-500" />
            <span className="text-xs font-semibold text-surface-300 flex-1">전체 선택</span>
            <span className="text-xs text-surface-500">{checkedSkus.size}/{allSkuIds.length}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {Object.entries(skuTree).map(([catId, cat]) => {
              const catOpen = expCats[catId] ?? true
              const cIds = catSkuIds(cat)
              return (
                <div key={catId} className="border-b border-surface-800/40 last:border-0">
                  <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                    <Chk state={catState(cat)} onChange={() => toggleSkus(cIds, catState(cat) !== true)} />
                    <div className="flex-1 flex items-center gap-1.5 cursor-pointer" onClick={() => setExpCats(p=>({...p,[catId]:!catOpen}))}>
                      {catOpen ? <ChevronDown size={12} className="text-surface-500"/> : <ChevronRight size={12} className="text-surface-500"/>}
                      <span className="text-xs font-semibold text-white">{cat.catName}</span>
                    </div>
                  </div>
                  {catOpen && Object.entries(cat.prods).map(([prodId, prod]) => {
                    const prodOpen = expProds[prodId] ?? false
                    const pIds = prod.skus.map(s=>s.skuId)
                    return (
                      <div key={prodId} className="border-t border-surface-800/30">
                        <div className="flex items-center gap-2 pl-6 pr-3 py-1.5 hover:bg-surface-800/10">
                          <Chk state={prodState(prod)} onChange={() => toggleSkus(pIds, prodState(prod) !== true)} />
                          <div className="flex-1 flex items-center gap-1.5 cursor-pointer" onClick={() => setExpProds(p=>({...p,[prodId]:!prodOpen}))}>
                            {prodOpen ? <ChevronDown size={11} className="text-surface-500"/> : <ChevronRight size={11} className="text-surface-500"/>}
                            <span className="text-xs text-surface-200">{prod.prodName}</span>
                          </div>
                        </div>
                        {prodOpen && prod.skus.map(sku => (
                          <div key={sku.skuId} className="flex items-center gap-2 pl-12 pr-3 py-1.5 border-t border-surface-800/20 cursor-pointer hover:bg-surface-800/5"
                            onClick={() => toggleSkus([sku.skuId], !checkedSkus.has(sku.skuId))}>
                            <Chk state={checkedSkus.has(sku.skuId)} onChange={() => {}} />
                            <span className="text-xs text-surface-400">{sku.label}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 오른쪽: 필터 + 차트 + 리스트 ── */}
      <div className="space-y-4">

        {/* 뷰 타입 탭 */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 bg-surface-800 rounded-xl p-1">
            {[['month','월별'],['range','기간별']].map(([v,l]) => (
              <button key={v} onClick={() => setViewBy(v)}
                className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' + (viewBy===v?'bg-primary-500 text-white':'text-surface-400 hover:text-white')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 서브 필터 */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* 월별: 연도 + 월 버튼 */}
          {viewBy === 'month' && (<>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              <option value="">전체 연도</option>
              {dbYears.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <div className="flex flex-wrap gap-1">
              {Array.from({length:12},(_,i)=>i+1).map(m => {
                const mm = String(m).padStart(2,'0')
                return (
                  <button key={m} onClick={() => setMonthFilter(monthFilter===mm ? '' : mm)}
                    className={'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ' + (monthFilter===mm?'bg-primary-500 text-white':'bg-surface-800 text-surface-400 hover:text-white')}>
                    {m}월
                  </button>
                )
              })}
            </div>
          </>)}
          {/* 기간별: 날짜 직접 입력 */}
          {viewBy === 'range' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"/>
              <span className="text-surface-500 text-xs">~</span>
              <input type="date" value={rangeTo} onChange={e=>setRangeTo(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"/>
            </div>
          )}

        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3">
            <p className="text-xs text-surface-500 mb-1">선택 SKU</p>
            <p className="text-lg font-bold text-primary-400">{checkedSkus.size}개</p>
          </div>
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3">
            <p className="text-xs text-surface-500 mb-1">총 입고 수량</p>
            <p className="text-lg font-bold text-emerald-400">{totalQty.toLocaleString()}개</p>
          </div>
        </div>

        {/* BAR CHART */}
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            입고 수량 TOP 10 — 상품/옵션별
          </h3>
          {barData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-surface-500 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 5, bottom: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="xLabel" tick={<CustomXAxisTick />} height={95} interval={0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="qty" name="입고수량" radius={[4,4,0,0]}>
                  {barData.map((_,i) => <Cell key={i} fill={BAR_COLORS[i%BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 통계 리스트 */}
        {listData.length > 0 && (
          <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-800/40 border-b border-surface-800">
              <h3 className="text-sm font-semibold text-white">상품/옵션별 입고 통계</h3>
              <span className="text-xs text-surface-500">{listData.length}개 항목</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-800/20 text-xs text-surface-400 border-b border-surface-800">
                  <th className="px-4 py-2.5 text-left w-6">#</th>
                  <th className="px-4 py-2.5 text-left">카테고리</th>
                  <th className="px-4 py-2.5 text-left">상품명</th>
                  <th className="px-4 py-2.5 text-left">옵션</th>
                  <th className="px-4 py-2.5 text-center w-24">입고수량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/40">
                {listData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-800/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-surface-600 text-center">{idx+1}</td>
                    <td className="px-4 py-2.5 text-xs text-surface-500">{row.catName}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-white">{row.prodName}</td>
                    <td className="px-4 py-2.5 text-xs text-surface-400">{row.optPart || '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 bg-primary-500/15 text-primary-400 rounded-lg text-xs font-bold font-mono">{row.qty}개</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-800/30 border-t border-surface-700">
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-surface-300">합계</td>
                  <td className="px-4 py-2.5 text-center text-primary-400 font-bold font-mono text-sm">{totalQty}개</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}



function OutboundChart() {
  const [suppliers, setSuppliers] = useState([])
  const supplierMap = Object.fromEntries(suppliers.map(s=>[s.id,s.name]))

  // ── 데이터 상태 ──
  const [rawItems, setRawItems] = useState([])
  const [loading, setLoading] = useState(true)

  // ── 뷰 필터 ──
  const [viewBy, setViewBy] = useState('month')  // month | range | year
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))
  const [monthFilter, setMonthFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [dbYears, setDbYears] = useState([])

  // ── 트리 상태 ──
  const [skuTree, setSkuTree] = useState({})
  const [checkedSkus, setCheckedSkus] = useState(new Set())
  const [expCats, setExpCats] = useState({})
  const [expProds, setExpProds] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: suppData } = await supabase.from('suppliers').select('id, name').order('name')
    setSuppliers(suppData || [])
    const { data } = await supabase.from('inbound_items')
      .select('id, quantity, inbound_order_id, product_sku_id, inbound_orders!inner(inbound_date, order_type, supplier_id, tax_paid), product_skus(product_id, products(id, name, category_id, categories(name)), o1:option1_id(option_value), o2:option2_id(option_value))')
      .eq('inbound_orders.order_type', 'outbound')
      .order('inbound_orders(inbound_date)')
    const items = (data || []).map(it => ({
      id: it.id,
      qty: it.quantity || 0,
      date: it.inbound_orders?.inbound_date || '',
      supplierId: it.inbound_orders?.supplier_id,
      taxPaid: it.inbound_orders?.tax_paid || 0,
      orderId: it.inbound_order_id,
      skuId: it.product_sku_id,
      prodId: it.product_skus?.products?.id,
      prodName: it.product_skus?.products?.name || '상품',
      catId: it.product_skus?.products?.category_id || '__none__',
      catName: it.product_skus?.products?.categories?.name || '미분류',
      o1: it.product_skus?.o1?.option_value,
      o2: it.product_skus?.o2?.option_value,
    }))
    setRawItems(items)

    const years = [...new Set(items.map(it=>it.date.slice(0,4)).filter(Boolean))].sort().reverse()
    setDbYears(years)

    const tree = {}
    items.forEach(it => {
      if (!tree[it.catId]) tree[it.catId] = { catName: it.catName, prods: {} }
      if (!tree[it.catId].prods[it.prodId]) tree[it.catId].prods[it.prodId] = { prodName: it.prodName, skus: [] }
      const skus = tree[it.catId].prods[it.prodId].skus
      if (!skus.some(s=>s.skuId===it.skuId)) {
        const optPart = [it.o1,it.o2].filter(Boolean).join('/')
        skus.push({ skuId: it.skuId, o1: it.o1, o2: it.o2, label: optPart||'Default' })
      }
    })
    setSkuTree(tree)
    setCheckedSkus(new Set(items.map(it=>it.skuId)))
    setLoading(false)
  }

  function toggleSkus(ids, add) {
    setCheckedSkus(prev => {
      const next = new Set(prev)
      ids.forEach(id => add ? next.add(id) : next.delete(id))
      return next
    })
  }
  function catSkuIds(cat) { return Object.values(cat.prods).flatMap(p=>p.skus.map(s=>s.skuId)) }
  function catState(cat) { const ids=catSkuIds(cat); const n=ids.filter(id=>checkedSkus.has(id)).length; return n===0?false:n===ids.length?true:'partial' }
  function prodState(prod) { const ids=prod.skus.map(s=>s.skuId); const n=ids.filter(id=>checkedSkus.has(id)).length; return n===0?false:n===ids.length?true:'partial' }
  const allSkuIds = Object.values(skuTree).flatMap(cat=>catSkuIds(cat))
  const allChecked = allSkuIds.length>0 && allSkuIds.every(id=>checkedSkus.has(id))
  const anyChecked = allSkuIds.some(id=>checkedSkus.has(id))

  const dateFiltered = useMemo(() => {
    return rawItems.filter(it => {
      if (!checkedSkus.has(it.skuId)) return false
      if (!it.date) return false
      if (supplierFilter && it.supplierId !== supplierFilter) return false
      if (viewBy==='month') {
        if (yearFilter && it.date.slice(0,4)!==yearFilter) return false
        if (monthFilter && it.date.slice(5,7)!==monthFilter) return false
      }
      if (viewBy==='range') {
        if (rangeFrom && it.date < rangeFrom) return false
        if (rangeTo   && it.date > rangeTo)   return false
      }
      return true
    })
  }, [rawItems, checkedSkus, viewBy, yearFilter, monthFilter, rangeFrom, rangeTo, supplierFilter])

  const BAR_COLORS = ['#f97316','#fb923c','#fdba74','#fcd34d','#a3e635','#34d399','#38bdf8','#a5b4fc','#f87171','#c084fc']

  const barData = useMemo(() => {
    // 항상 상품/옵션별 수량 TOP 10
    const map = {}
    dateFiltered.forEach(it => {
      const optPart = [it.o1, it.o2].filter(Boolean).join('/')
      const fullLabel = [it.prodName, optPart].filter(Boolean).join(' / ')
      const xLabel = optPart
        ? (optPart.length > 10 ? optPart.slice(0,10)+'…' : optPart)
        : (it.prodName.length > 10 ? it.prodName.slice(0,10)+'…' : it.prodName)
      if (!map[fullLabel]) map[fullLabel] = { qty: 0, xLabel, fullLabel, prodName: it.prodName, optPart }
      map[fullLabel].qty += it.qty
    })
    return Object.values(map).sort((a,b) => b.qty - a.qty).slice(0, 10)
  }, [dateFiltered])

  const listData = useMemo(() => {
    const map = {}
    dateFiltered.forEach(it => {
      const optPart=[it.o1,it.o2].filter(Boolean).join('/')
      const key=`${it.skuId}`
      if (!map[key]) map[key]={prodName:it.prodName,catName:it.catName,optPart,qty:0}
      map[key].qty += it.qty
    })
    return Object.values(map).sort((a,b)=>b.qty-a.qty)
  }, [dateFiltered])

  const totalQty = dateFiltered.reduce((s,it)=>s+it.qty,0)

  function CustomXAxisTick({x,y,payload}) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={10} textAnchor="end" fill="#94a3b8" fontSize={10} transform="rotate(-40)">
          {payload.value}
        </text>
      </g>
    )
  }
  function BarTooltip({active,payload}) {
    if(!active||!payload?.[0]) return null
    const d=payload[0].payload
    return (
      <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs shadow-lg" style={{maxWidth:200}}>
        <p className="text-white font-semibold">{d.prodName}</p>
        {d.optPart&&<p className="text-orange-300 mt-0.5">{d.optPart}</p>}
        <p className="text-orange-400 font-bold mt-1">{payload[0].value}개</p>
      </div>
    )
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">

      {/* 왼쪽 트리 */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">상품별 필터</p>
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-800/60 border-b border-surface-800">
            <Chk state={allChecked?true:anyChecked?'partial':false}
              onChange={() => toggleSkus(allSkuIds,!allChecked)} />
            <span className="text-xs font-semibold text-surface-300 flex-1">전체 선택</span>
            <span className="text-xs text-surface-500">{checkedSkus.size}/{allSkuIds.length}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {Object.entries(skuTree).map(([catId,cat]) => {
              const catOpen=expCats[catId]??true
              const cIds=catSkuIds(cat)
              return (
                <div key={catId} className="border-b border-surface-800/40 last:border-0">
                  <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                    <Chk state={catState(cat)} onChange={() => toggleSkus(cIds,catState(cat)!==true)} />
                    <div className="flex-1 flex items-center gap-1.5 cursor-pointer" onClick={() => setExpCats(p=>({...p,[catId]:!catOpen}))}>
                      {catOpen?<ChevronDown size={12} className="text-surface-500"/>:<ChevronRight size={12} className="text-surface-500"/>}
                      <span className="text-xs font-semibold text-white">{cat.catName}</span>
                    </div>
                  </div>
                  {catOpen && Object.entries(cat.prods).map(([prodId,prod]) => {
                    const prodOpen=expProds[prodId]??false
                    const pIds=prod.skus.map(s=>s.skuId)
                    return (
                      <div key={prodId} className="border-t border-surface-800/30">
                        <div className="flex items-center gap-2 pl-6 pr-3 py-1.5 hover:bg-surface-800/10">
                          <Chk state={prodState(prod)} onChange={() => toggleSkus(pIds,prodState(prod)!==true)} />
                          <div className="flex-1 flex items-center gap-1.5 cursor-pointer" onClick={() => setExpProds(p=>({...p,[prodId]:!prodOpen}))}>
                            {prodOpen?<ChevronDown size={11} className="text-surface-500"/>:<ChevronRight size={11} className="text-surface-500"/>}
                            <span className="text-xs text-surface-200">{prod.prodName}</span>
                          </div>
                        </div>
                        {prodOpen && prod.skus.map(sku => (
                          <div key={sku.skuId} className="flex items-center gap-2 pl-12 pr-3 py-1.5 border-t border-surface-800/20 cursor-pointer hover:bg-surface-800/5"
                            onClick={() => toggleSkus([sku.skuId],!checkedSkus.has(sku.skuId))}>
                            <Chk state={checkedSkus.has(sku.skuId)} onChange={() => {}} />
                            <span className="text-xs text-surface-400">{sku.label}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 오른쪽 */}
      <div className="space-y-4">
        {/* 뷰 타입 */}
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-surface-800 rounded-xl p-1">
            {[['month','월별'],['range','기간별']].map(([v,l]) => (
              <button key={v} onClick={() => setViewBy(v)}
                className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors '+(viewBy===v?'bg-orange-500 text-white':'text-surface-400 hover:text-white')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 서브 필터 */}
        <div className="flex flex-wrap gap-2 items-center">
          <select value={supplierFilter} onChange={e=>setSupplierFilter(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
            <option value="">전체 납품처</option>
            {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {viewBy==='month' && (
            <>
              <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                <option value="">전체 연도</option>
                {dbYears.map(y=><option key={y} value={y}>{y}년</option>)}
              </select>
              <div className="flex flex-wrap gap-1">
                {Array.from({length:12},(_,i)=>i+1).map(m=>{
                  const mm=String(m).padStart(2,'0')
                  return (
                    <button key={m} onClick={() => setMonthFilter(monthFilter===mm?'':mm)}
                      className={'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors '+(monthFilter===mm?'bg-orange-500 text-white':'bg-surface-800 text-surface-400 hover:text-white')}>
                      {m}월
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {viewBy==='range' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"/>
              <span className="text-surface-500 text-xs">~</span>
              <input type="date" value={rangeTo} onChange={e=>setRangeTo(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"/>
            </div>
          )}

        </div>

        {/* 요약 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3">
            <p className="text-xs text-surface-500 mb-1">선택 SKU</p>
            <p className="text-lg font-bold text-orange-400">{checkedSkus.size}개</p>
          </div>
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3">
            <p className="text-xs text-surface-500 mb-1">총 납품 수량</p>
            <p className="text-lg font-bold text-emerald-400">{totalQty.toLocaleString()}개</p>
          </div>
        </div>

        {/* BAR CHART */}
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            납품 수량 TOP 10 — 상품/옵션별
          </h3>
          {barData.length===0 ? (
            <div className="h-56 flex items-center justify-center text-surface-500 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} margin={{top:5,right:10,left:5,bottom:90}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="xLabel" tick={<CustomXAxisTick/>} height={95} interval={0}/>
                <YAxis tick={{fill:'#94a3b8',fontSize:11}} width={40}/>
                <Tooltip content={<BarTooltip/>} cursor={{fill:'rgba(255,255,255,0.04)'}}/>
                <Bar dataKey="qty" name="납품수량" radius={[4,4,0,0]}>
                  {barData.map((_,i)=><Cell key={i} fill={BAR_COLORS[i%BAR_COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 통계 리스트 */}
        {listData.length>0 && (
          <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-800/40 border-b border-surface-800">
              <h3 className="text-sm font-semibold text-white">상품/옵션별 납품 통계</h3>
              <span className="text-xs text-surface-500">{listData.length}개 항목</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-800/20 text-xs text-surface-400 border-b border-surface-800">
                  <th className="px-4 py-2.5 text-left w-6">#</th>
                  <th className="px-4 py-2.5 text-left">카테고리</th>
                  <th className="px-4 py-2.5 text-left">상품명</th>
                  <th className="px-4 py-2.5 text-left">옵션</th>
                  <th className="px-4 py-2.5 text-center w-24">납품수량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/40">
                {listData.map((row,idx) => (
                  <tr key={idx} className="hover:bg-surface-800/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-surface-600 text-center">{idx+1}</td>
                    <td className="px-4 py-2.5 text-xs text-surface-500">{row.catName}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-white">{row.prodName}</td>
                    <td className="px-4 py-2.5 text-xs text-surface-400">{row.optPart||'-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 bg-orange-500/15 text-orange-400 rounded-lg text-xs font-bold font-mono">{row.qty}개</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-800/30 border-t border-surface-700">
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-surface-300">합계</td>
                  <td className="px-4 py-2.5 text-center text-orange-400 font-bold font-mono text-sm">{totalQty}개</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}



function ReturnStats() {
  const [rawItems, setRawItems]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [viewBy, setViewBy]           = useState('month')
  const [rangeFrom, setRangeFrom]     = useState('')
  const [rangeTo, setRangeTo]         = useState('')
  const [yearFilter, setYearFilter]   = useState(String(new Date().getFullYear()))
  const [monthFilter, setMonthFilter] = useState('')
  const [dbYears, setDbYears]         = useState([])
  const [returnSources, setReturnSources] = useState([])
  const [sourceFilter, setSourceFilter]   = useState('')
  const [skuTree, setSkuTree]         = useState({})
  const [checkedSkus, setCheckedSkus] = useState(new Set())
  const [expCats, setExpCats]         = useState({})
  const [expProds, setExpProds]       = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      // 반품처 목록
      const { data: srcs } = await supabase
        .from('return_sources').select('id, name').order('name')
      setReturnSources(srcs || [])

      // return_orders 먼저 (FK 조인 정렬 문제 우회)
      const { data: orders } = await supabase
        .from('return_orders')
        .select('id, return_date, return_source_id')
        .order('return_date')
      const orderMap = Object.fromEntries((orders || []).map(o => [o.id, o]))

      // return_items
      const { data, error } = await supabase
        .from('return_items')
        .select(`id, quantity, return_order_id,
          product_skus(
            product_id,
            products(id, name, category_id, categories(name)),
            o1:option1_id(option_value),
            o2:option2_id(option_value)
          )`)
      if (error) throw error

      const items = (data || []).map(it => {
        const ord = orderMap[it.return_order_id] || {}
        const sku = it.product_skus || {}
        const prod = sku.products || {}
        const o1v = sku.o1?.option_value
        const o2v = sku.o2?.option_value
        return {
          id: it.id,
          qty: it.quantity || 0,
          date: ord.return_date || '',
          sourceId: ord.return_source_id || null,
          skuId: prod.id
            ? `${prod.id}_${o1v||''}_${o2v||''}`
            : String(it.id),
          prodId: prod.id || null,
          prodName: prod.name || '상품',
          catId: prod.category_id || '__none__',
          catName: prod.categories?.name || '미분류',
          o1: o1v,
          o2: o2v,
        }
      }).filter(it => it.date)

      setRawItems(items)

      const years = [...new Set(items.map(it => it.date.slice(0,4)).filter(Boolean))].sort().reverse()
      setDbYears(years)

      // 트리 빌드
      const tree = {}
      const seenSkus = new Set()
      items.forEach(it => {
        if (!it.prodId) return
        if (!tree[it.catId]) tree[it.catId] = { catName: it.catName, prods: {} }
        if (!tree[it.catId].prods[it.prodId])
          tree[it.catId].prods[it.prodId] = { prodName: it.prodName, skus: [] }
        if (!seenSkus.has(it.skuId)) {
          seenSkus.add(it.skuId)
          const opt = [it.o1, it.o2].filter(Boolean).join('/')
          tree[it.catId].prods[it.prodId].skus.push({ skuId: it.skuId, label: opt || 'Default' })
        }
      })
      setSkuTree(tree)
      setCheckedSkus(new Set(items.map(it => it.skuId)))
    } catch (err) {
      console.error('ReturnStats loadAll error:', err)
    } finally {
      setLoading(false)
    }
  }

  // 체크박스
  function toggleSkus(ids, add) {
    setCheckedSkus(prev => {
      const next = new Set(prev)
      ids.forEach(id => add ? next.add(id) : next.delete(id))
      return next
    })
  }
  function catSkuIds(cat) {
    return Object.values(cat.prods).flatMap(p => p.skus.map(s => s.skuId))
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
  const allSkuIds = Object.values(skuTree).flatMap(cat => catSkuIds(cat))
  const allChecked = allSkuIds.length > 0 && allSkuIds.every(id => checkedSkus.has(id))
  const anyChecked = allSkuIds.some(id => checkedSkus.has(id))

  // 날짜 필터
  const dateFiltered = useMemo(() => rawItems.filter(it => {
    if (!checkedSkus.has(it.skuId)) return false
    if (sourceFilter && it.sourceId !== sourceFilter) return false
    if (viewBy === 'month') {
      if (yearFilter  && it.date.slice(0,4) !== yearFilter) return false
      if (monthFilter && it.date.slice(5,7) !== monthFilter) return false
    }
    if (viewBy === 'range') {
      if (rangeFrom && it.date < rangeFrom) return false
      if (rangeTo   && it.date > rangeTo)   return false
    }
    return true
  }), [rawItems, checkedSkus, viewBy, yearFilter, monthFilter, rangeFrom, rangeTo, sourceFilter])

  const BAR_COLORS = ['#f43f5e','#fb7185','#fda4af','#f97316','#fb923c','#fcd34d','#a3e635','#34d399','#38bdf8','#a78bfa']

  // 차트 데이터
  const barData = useMemo(() => {
    // 항상 상품/옵션별 수량 TOP 10
    const map = {}
    dateFiltered.forEach(it => {
      const optPart = [it.o1, it.o2].filter(Boolean).join('/')
      const fullLabel = [it.prodName, optPart].filter(Boolean).join(' / ')
      const xLabel = optPart
        ? (optPart.length > 10 ? optPart.slice(0,10)+'…' : optPart)
        : (it.prodName.length > 10 ? it.prodName.slice(0,10)+'…' : it.prodName)
      if (!map[fullLabel]) map[fullLabel] = { qty: 0, xLabel, fullLabel, prodName: it.prodName, optPart }
      map[fullLabel].qty += it.qty
    })
    return Object.values(map).sort((a,b) => b.qty - a.qty).slice(0, 10)
  }, [dateFiltered])

  // 통계 리스트 (상품/옵션별 합계)
  const listData = useMemo(() => {
    const map = {}
    dateFiltered.forEach(it => {
      if (!map[it.skuId]) map[it.skuId] = {
        prodName: it.prodName, catName: it.catName,
        optPart: [it.o1, it.o2].filter(Boolean).join('/'), qty: 0
      }
      map[it.skuId].qty += it.qty
    })
    return Object.values(map).sort((a,b) => b.qty - a.qty)
  }, [dateFiltered])

  const totalQty = dateFiltered.reduce((s, it) => s + it.qty, 0)

  function CustomXAxisTick({ x, y, payload }) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={10} textAnchor="end" fill="#94a3b8" fontSize={10} transform="rotate(-40)">
          {payload.value}
        </text>
      </g>
    )
  }

  function BarTooltip({ active, payload }) {
    if (!active || !payload?.[0]) return null
    const d = payload[0].payload
    return (
      <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs shadow-lg" style={{maxWidth:200}}>
        <p className="text-white font-semibold">{d.prodName}</p>
        {d.optPart && <p className="text-rose-300 mt-0.5">{d.optPart}</p>}
        <p className="text-rose-400 font-bold mt-1">{payload[0].value}개</p>
      </div>
    )
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">

      {/* 왼쪽: 상품 트리 */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">상품별 필터</p>
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-800/60 border-b border-surface-800">
            <Chk
              state={allChecked ? true : anyChecked ? 'partial' : false}
              onChange={() => toggleSkus(allSkuIds, !allChecked)}
              accent="accent-rose-500"
            />
            <span className="text-xs font-semibold text-surface-300 flex-1">전체 선택</span>
            <span className="text-xs text-surface-500">{checkedSkus.size}/{allSkuIds.length}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {Object.keys(skuTree).length === 0 ? (
              <p className="text-center py-6 text-surface-500 text-xs">반품 데이터 없음</p>
            ) : Object.entries(skuTree).map(([catId, cat]) => {
              const catOpen = expCats[catId] ?? true
              const cIds = catSkuIds(cat)
              return (
                <div key={catId} className="border-b border-surface-800/40 last:border-0">
                  <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                    <Chk state={catState(cat)} onChange={() => toggleSkus(cIds, catState(cat) !== true)} />
                    <div className="flex-1 flex items-center gap-1.5 cursor-pointer"
                      onClick={() => setExpCats(p => ({ ...p, [catId]: !catOpen }))}>
                      {catOpen ? <ChevronDown size={12} className="text-surface-500" /> : <ChevronRight size={12} className="text-surface-500" />}
                      <span className="text-xs font-semibold text-white">{cat.catName}</span>
                    </div>
                  </div>
                  {catOpen && Object.entries(cat.prods).map(([prodId, prod]) => {
                    const prodOpen = expProds[prodId] ?? false
                    const pIds = prod.skus.map(s => s.skuId)
                    return (
                      <div key={prodId} className="border-t border-surface-800/30">
                        <div className="flex items-center gap-2 pl-6 pr-3 py-1.5 hover:bg-surface-800/10">
                          <Chk state={prodState(prod)} onChange={() => toggleSkus(pIds, prodState(prod) !== true)} />
                          <div className="flex-1 flex items-center gap-1.5 cursor-pointer"
                            onClick={() => setExpProds(p => ({ ...p, [prodId]: !prodOpen }))}>
                            {prodOpen ? <ChevronDown size={11} className="text-surface-500" /> : <ChevronRight size={11} className="text-surface-500" />}
                            <span className="text-xs text-surface-200">{prod.prodName}</span>
                          </div>
                        </div>
                        {prodOpen && prod.skus.map(sku => (
                          <div key={sku.skuId}
                            className="flex items-center gap-2 pl-12 pr-3 py-1.5 border-t border-surface-800/20 cursor-pointer hover:bg-surface-800/5"
                            onClick={() => toggleSkus([sku.skuId], !checkedSkus.has(sku.skuId))}>
                            <Chk state={checkedSkus.has(sku.skuId)} onChange={() => {}} />
                            <span className="text-xs text-surface-400">{sku.label}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 오른쪽 */}
      <div className="space-y-4">
        {/* 뷰 탭 */}
        <div className="flex gap-1 bg-surface-800 rounded-xl p-1 w-fit">
          {[['month','월별'],['range','기간별']].map(([v,l]) => (
            <button key={v} onClick={() => setViewBy(v)}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' +
                (viewBy === v ? 'bg-rose-500 text-white' : 'text-surface-400 hover:text-white')}>
              {l}
            </button>
          ))}
        </div>

        {/* 서브 필터 */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* 반품처 (항상) */}
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500">
            <option value="">전체 반품처</option>
            {returnSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {/* 월별 */}
          {viewBy === 'month' && (<>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500">
              <option value="">전체 연도</option>
              {dbYears.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                const mm = String(m).padStart(2,'0')
                return (
                  <button key={m} onClick={() => setMonthFilter(monthFilter === mm ? '' : mm)}
                    className={'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ' +
                      (monthFilter === mm ? 'bg-rose-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
                    {m}월
                  </button>
                )
              })}
            </div>
          </>)}
          {/* 기간별 */}
          {viewBy === 'range' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500" />
              <span className="text-surface-500 text-xs">~</span>
              <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500" />
            </div>
          )}

        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3">
            <p className="text-xs text-surface-500 mb-1">선택 SKU</p>
            <p className="text-lg font-bold text-rose-400">{checkedSkus.size}개</p>
          </div>
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3">
            <p className="text-xs text-surface-500 mb-1">총 반품 수량</p>
            <p className="text-lg font-bold text-orange-400">{totalQty.toLocaleString()}개</p>
          </div>
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-3">
            <p className="text-xs text-surface-500 mb-1">반품 항목</p>
            <p className="text-lg font-bold text-yellow-400">{listData.length}종</p>
          </div>
        </div>

        {/* BAR CHART */}
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            반품 수량 TOP 10 — 상품/옵션별
          </h3>
          {barData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-surface-500 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 5, bottom: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="xLabel" tick={<CustomXAxisTick />} height={95} interval={0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="qty" name="반품수량" radius={[4, 4, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 통계 리스트 */}
        {listData.length > 0 && (
          <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-800/40 border-b border-surface-800">
              <h3 className="text-sm font-semibold text-white">상품/옵션별 반품 통계</h3>
              <span className="text-xs text-surface-500">{listData.length}개 항목</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-800/20 text-xs text-surface-400 border-b border-surface-800">
                  <th className="px-4 py-2.5 text-left w-6">#</th>
                  <th className="px-4 py-2.5 text-left">카테고리</th>
                  <th className="px-4 py-2.5 text-left">상품명</th>
                  <th className="px-4 py-2.5 text-left">옵션</th>
                  <th className="px-4 py-2.5 text-center w-24">반품수량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/40">
                {listData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-800/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-surface-600 text-center">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-xs text-surface-500">{row.catName}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-white">{row.prodName}</td>
                    <td className="px-4 py-2.5 text-xs text-surface-400">{row.optPart || '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 bg-rose-500/15 text-rose-400 rounded-lg text-xs font-bold font-mono">
                        {row.qty}개
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-800/30 border-t border-surface-700">
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-surface-300">합계</td>
                  <td className="px-4 py-2.5 text-center text-rose-400 font-bold font-mono text-sm">{totalQty}개</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


// ════════════════════════════════════════════════════════
// 메인 ChartsPage
// ════════════════════════════════════════════════════════
const CHART_TABS = [
  { key: 'sales',    label: '판매 차트',   icon: TrendingUp },
  { key: 'return',   label: '반품 차트',   icon: RotateCcw },
  { key: 'inbound',  label: '입고 차트',   icon: ArrowDownCircle },
  { key: 'outbound', label: '납품 차트',   icon: ArrowUpCircle },
]

export default function ChartsPage() {
  const [tab, setTab] = useState('sales')
  const current = CHART_TABS.find(t => t.key === tab)

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">차트</h1>
        <span className="text-xs bg-primary-500/20 text-primary-400 px-2.5 py-1 rounded-lg font-medium">통계 분석</span>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 bg-surface-900 border border-surface-800 rounded-2xl p-2">
        {CHART_TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex-1 justify-center ' +
                (tab === t.key ? 'bg-primary-500 text-white shadow' : 'text-surface-400 hover:text-white hover:bg-surface-800')}>
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 컨텐츠 */}
      <div>
        {tab === 'sales'    && <SalesChart />}
        {tab === 'return'   && <ReturnStats />}
        {tab === 'inbound'  && <InboundChart />}
        {tab === 'outbound' && <OutboundChart />}
      </div>
    </div>
  )
}
