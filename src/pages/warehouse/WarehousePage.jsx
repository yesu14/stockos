// ═══════════════════════════════════════════════════════════
//  상품찾기 — 창고를 그리고, 박스에 상품을 담고, 한 번에 찾는 화면
//  왼쪽: 평면도 편집기 / 오른쪽: 3D 모형 + 검색
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Search, X, RefreshCw, MapPin, ExternalLink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import SkuThumb from '../../components/ui/SkuThumb'
import api from './whApi'
import { makeActions } from './whActions'
import { buildModel, emptyRaw, rawReducer, searchAll, locationText, LIMITS, stackRepairs, round2 } from './whLogic'
import { Btn, Modal, Field, inputCls, useAsk, usePrompt, EmptyNote, StockBadge } from './ui'
import FloorPlan from './FloorPlan'
import Scene3D from './Scene3D'
import Scene3DGL from './Scene3DGL'
import ZoneDialog from './ZoneDialog'
import ZoneDetail from './ZoneDetail'
import BoxPanel from './BoxPanel'
import ProductPicker from './ProductPicker'
import StockCheck from './StockCheck'
import MoveBoxDialog from './MoveBoxDialog'

const card = 'bg-surface-900 border border-surface-800 rounded-[32px]'

// 새 3D(WebGL2)를 쓸 수 있는 기기인지 (안 되면 예전 3D 로)
const glSupported = (() => { try { const c = document.createElement('canvas'), g = c.getContext('webgl2'); const ok = !!g; g?.getExtension('WEBGL_lose_context')?.loseContext(); return ok } catch { return false } })()
const WH_VERSION = 'v46'
// 3D 방식: 주소에 ?3d=gl / three / classic 이 있으면 그걸 우선, 아니면 마지막에 고른 방식(기억해 둔 것)
const load3d = () => {
  try { const q = new URLSearchParams(window.location.search).get('3d'); if (q === 'gl' || q === 'three' || q === 'classic') return q } catch { /* 무시 */ }
  try { const v = localStorage.getItem('wh3d'); return v === 'classic' || v === 'three' ? v : 'gl' } catch { return 'gl' }
}

function WarehouseDialog({ wh, onSubmit, onClose }) {
  const [name, setName] = useState(wh.name), [w, setW] = useState(String(wh.width)), [h, setH] = useState(String(wh.height)), [busy, setBusy] = useState(false)
  const nw = Number(w), nh = Number(h)
  const ok = w !== '' && h !== '' && nw >= LIMITS.whMin[0] && nw <= LIMITS.whMax[0] && nh >= LIMITS.whMin[1] && nh <= LIMITS.whMax[1]
  return (
    <Modal onClose={onClose} icon="🏭" title="창고 설정" subtitle="가로·세로를 자유롭게 정해요 (단위: m)"
      footer={<><Btn variant="soft" onClick={onClose}>취소</Btn><Btn variant="primary" disabled={busy || !ok} onClick={async () => { setBusy(true); try { await onSubmit({ name: name.trim() || '내 창고', width: round2(nw), height: round2(nh) }) } finally { setBusy(false) } }}>저장</Btn></>}>
      <div className="space-y-4">
        <Field label="창고 이름"><input value={name} onChange={e => setName(e.target.value)} maxLength={30} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="가로 (m)" hint={`${LIMITS.whMin[0]} ~ ${LIMITS.whMax[0]}`}><input type="number" inputMode="decimal" step="0.5" min={LIMITS.whMin[0]} max={LIMITS.whMax[0]} value={w} onChange={e => setW(e.target.value)} className={inputCls} /></Field>
          <Field label="세로 (m)" hint={`${LIMITS.whMin[1]} ~ ${LIMITS.whMax[1]}`}><input type="number" inputMode="decimal" step="0.5" min={LIMITS.whMin[1]} max={LIMITS.whMax[1]} value={h} onChange={e => setH(e.target.value)} className={inputCls} /></Field>
        </div>
        {!ok && <p className="text-[11px] text-red-400">가로 {LIMITS.whMin[0]}~{LIMITS.whMax[0]}m, 세로 {LIMITS.whMin[1]}~{LIMITS.whMax[1]}m 사이로 넣어주세요.</p>}
        <p className="text-[11px] text-surface-500 leading-relaxed">평면도에서 <b>창고 크기</b> 버튼을 누르면 테두리의 노란 점(모서리 4개·가장자리 4개)을 끌어서 바로 바꿀 수 있어요. 왼쪽/위쪽을 끌면 구역은 제자리에 그대로 있어요. 구역이 있는 곳까지는 줄일 수 없어요.</p>
      </div>
    </Modal>
  )
}

function BoxLine({ b, onLocate, onOpen, extra }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-surface-800/60 border border-surface-700">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 px-1 overflow-hidden" style={{ background: b.zoneColor, color: '#2b3445' }}><span className="truncate">{b.box_number}</span></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-white truncate">{extra || `박스 ${b.box_number}`}</p>
        <p className="text-[11px] text-surface-400 truncate">{locationText(b)}</p>
      </div>
      <button type="button" onClick={() => onLocate(b.id)} title="평면도/3D에서 위치 보기" className="w-9 h-9 rounded-xl bg-primary-500/15 text-primary-400 hover:bg-primary-500/25 flex items-center justify-center shrink-0 active:scale-90"><MapPin size={16} /></button>
      <button type="button" onClick={() => onOpen(b.id)} title="박스 열기" className="w-9 h-9 rounded-xl bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 flex items-center justify-center shrink-0 active:scale-90"><ExternalLink size={15} /></button>
    </div>
  )
}

function SearchPanel({ model, query, setQuery, results, onLocate, onOpen }) {
  const has = results.query.length > 0
  const nBox = results.boxHits.length, nProd = results.productHits.length
  const stats = { zones: model.zones.length, boxes: model.boxes.length, kinds: new Set(model.boxes.flatMap(b => b.items.map(i => `${i.product_id}|${i.opt1}|${i.opt2}`))).size }
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-1"><span className="text-lg">🔎</span><h2 className="font-bold text-white text-sm">찾기</h2></div>
      <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur() }}>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="상품 이름 또는 박스 번호" className={`${inputCls} pl-10 pr-9`} enterKeyHint="search" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="지우기" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-surface-500 hover:text-white"><X size={15} /></button>}
        </div>
        <Btn type="submit" variant="primary">검색</Btn>
      </form>

      <div className="mt-3 max-h-[46vh] xl:max-h-[320px] overflow-y-auto -mx-1 px-1 space-y-3">
        {!has && (
          <div className="text-center py-5">
            <div className="text-3xl mb-1.5">🧭</div>
            <p className="text-sm font-bold text-surface-200">무엇을 찾을까요?</p>
            <p className="text-xs text-surface-500 mt-1 leading-relaxed">상품 이름(옵션도 가능)이나 박스 번호를 입력하면<br />어느 박스에 몇 개 있는지, 창고 어디에 있는지 알려드려요.</p>
            <div className="flex justify-center gap-2 mt-3 text-[11px]">
              {[['구역', stats.zones], ['박스', stats.boxes], ['담긴 상품', stats.kinds]].map(([l, n]) => <span key={l} className="px-2.5 py-1 rounded-xl bg-surface-800 border border-surface-700 text-surface-300">{l} <b className="text-white">{n}</b></span>)}
            </div>
          </div>)}
        {has && nBox + nProd === 0 && <EmptyNote emoji="🙈" title="찾는 게 없어요">상품 이름을 짧게 줄여서 다시 찾아보세요.<br />(박스에 아직 담지 않은 상품은 나오지 않아요)</EmptyNote>}
        {has && nBox + nProd > 0 && <p className="text-[11px] text-surface-400 px-1">박스 <b className="text-white">{nBox}</b>개 · 상품 <b className="text-white">{nProd}</b>종을 찾았어요 — 평면도와 3D에 표시했어요</p>}

        {results.boxHits.slice(0, 30).map(({ box }) => (
          <div key={box.id}>
            <BoxLine b={box} onLocate={onLocate} onOpen={onOpen} />
            {box.items.length > 0 && <p className="text-[11px] text-surface-500 px-3 mt-1 truncate">{box.items.slice(0, 3).map(i => `${i.name}${i.label ? ` (${i.label})` : ''} ×${i.quantity}`).join(' · ')}{box.items.length > 3 ? ` 외 ${box.items.length - 3}종` : ''}</p>}
          </div>))}

        {results.productHits.slice(0, 20).map(g => (
          <div key={g.key} className="rounded-3xl border border-surface-700 bg-surface-800/30 p-2.5">
            <div className="flex items-center gap-2.5 mb-2">
              <SkuThumb url={g.image} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{g.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap"><span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-primary-500/15 text-primary-400">{g.label || '기본'}</span>{g.stock != null && <span className="text-[10px] text-surface-500">재고 {g.stock}</span>}<StockBadge stock={g.stock} placed={g.total} /></div>
              </div>
              <div className="text-right shrink-0"><p className="text-[10px] text-surface-500">박스 합계</p><p className="text-lg font-black text-white leading-none">{g.total}<span className="text-xs font-semibold text-surface-400">개</span></p></div>
            </div>
            <div className="space-y-1.5">{g.entries.map(e => <BoxLine key={e.itemId} b={e.box} onLocate={onLocate} onOpen={onOpen} extra={`박스 ${e.box.box_number} · ${e.qty}개`} />)}</div>
          </div>))}
      </div>
    </div>
  )
}

export default function WarehousePage() {
  const { profile } = useAuth()
  const canEdit = ['admin', 'manager'].includes(profile?.role)
  const [raw, setRaw] = useState(emptyRaw)
  const rawRef = useRef(raw)
  const dispatch = useCallback(op => { rawRef.current = rawReducer(rawRef.current, op); setRaw(rawRef.current) }, [])   // 바로 반영(연속 동작에도 안전)
  const [status, setStatus] = useState('loading'), [errMsg, setErrMsg] = useState('')
  const statusRef = useRef(status); statusRef.current = status
  const [live, setLive] = useState({ loaded: false, map: new Map(), products: new Set() })
  const { ask, askDialog } = useAsk(), { prompt, promptDialog } = usePrompt()
  const notify = useMemo(() => ({ success: m => toast.success(m), error: m => toast.error(m), info: m => toast(m) }), [])
  const actions = useMemo(() => makeActions({ api, getRaw: () => rawRef.current, dispatch, ask, notify }), [dispatch, ask, notify])
  const model = useMemo(() => buildModel(raw, live), [raw, live])

  const [query, setQuery] = useState('')
  const results = useMemo(() => searchAll(model, query), [model, query])
  const highlight = results.ids.size ? results.ids : null
  const [focus, setFocus] = useState(null)
  const [activeZone, setActiveZone] = useState(null)
  const [zoneForm, setZoneForm] = useState(null), [zoneDetail, setZoneDetail] = useState(null), [boxId, setBoxId] = useState(null), [pickerFor, setPickerFor] = useState(null), [whDialog, setWhDialog] = useState(false), [stockCheck, setStockCheck] = useState(false), [moveFor, setMoveFor] = useState(null), [view3d, setView3d] = useState(load3d), [fallbackNote, setFallbackNote] = useState('')
  const planRef = useRef(null)

  const switch3d = useCallback((kind, persist = true) => { setView3d(kind); if (persist) { setFallbackNote(''); try { localStorage.setItem('wh3d', kind) } catch { /* 저장 안 돼도 괜찮아요 */ } } }, [])
  const failed3d = useCallback(e => {                 // 새 3D / Three.js 가 시작되지 않을 때: 알림 + 이유를 화면에 계속 보여줌 (어떤 기기에서 왜 안 되는지 알 수 있게)
    const why = String((e && e.message) || '').replace(/\s+/g, ' ').slice(0, 140), tail = why ? ` (이유: ${why})` : ''
    if (view3d === 'three') { switch3d('gl', false); setFallbackNote(`Three.js 를 불러오지 못해서 기본 3D 로 바꿨어요. 인터넷 연결을 확인하고 "Three.js" 칸을 다시 눌러 보세요.${tail}`); toast('Three.js 를 불러오지 못해서 기본 3D 로 바꿨어요 (인터넷 연결을 확인해 주세요)', { icon: 'ℹ️' }) }
    else { switch3d('classic'); setFallbackNote(`새 3D 가 이 기기에서 시작되지 않아서 예전 3D 로 바꿨어요.${tail} "기본 3D" 칸을 누르면 다시 시도해요.`); toast('이 기기에서는 새 3D가 잘 안 돼서 예전 3D로 바꿨어요', { icon: 'ℹ️' }) }
  }, [view3d, switch3d])
  const load = useCallback(async quiet => {
    try {
      if (!quiet) setStatus('loading')
      const r = await api.loadAll(); rawRef.current = r; setRaw(r); setStatus('ready')
      if (stackRepairs(r).length) actions.repairStacks()                                           // 공중에 떠 있는 박스가 있으면 자동으로 붙임
    } catch (e) {
      if (e.code === 'NO_TABLE') setStatus('setup'); else if (!quiet) { setErrMsg(e.message || '불러오지 못했어요'); setStatus('error') }
    }
  }, [])
  useEffect(() => { load(false) }, [load])
  // 다른 기기에서 바꾼 내용: 이 탭으로 돌아오면 다시 불러오기
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'visible' && statusRef.current === 'ready') load(true) }
    document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h)
  }, [load])
  // 박스에 담긴 상품의 "지금" 이름/옵션/이미지/재고 (상품을 수정했을 수 있으니)
  const productKey = useMemo(() => [...new Set(raw.items.map(i => i.product_id).filter(Boolean))].sort().join(','), [raw.items])
  useEffect(() => {
    if (status !== 'ready') return
    const ids = productKey ? productKey.split(',') : []
    if (!ids.length) { setLive({ loaded: true, map: new Map(), products: new Set() }); return }
    let off = false
    const t = setTimeout(() => { api.fetchLive(ids).then(map => { if (!off) setLive({ loaded: true, map, products: new Set(ids) }) }).catch(() => {}) }, 150)
    return () => { off = true; clearTimeout(t) }
  }, [productKey, status])

  const locate = useCallback(id => {
    const b = model.boxesById.get(id); if (!b) return
    setZoneDetail(null); setBoxId(null); setPickerFor(null)
    setFocus({ boxId: id, zoneId: b.zone_id, nonce: Date.now() })
    planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [model])

  const planActions = useMemo(() => ({
    createWarehouse: actions.createWarehouse, updateWarehouse: actions.updateWarehouse, deleteWarehouse: actions.deleteWarehouse, editWarehouse: () => setWhDialog(true),
    moveZone: actions.moveZone, deleteZone: actions.deleteZone, requestCreateZone: rect => setZoneForm({ mode: 'create', rect }),
    openZone: (id, line) => setZoneDetail({ id, line: line ?? 0 }), editZone: id => setZoneForm({ mode: 'edit', id }),
    addFixture: actions.addFixture, moveFixture: actions.moveFixture, removeFixture: actions.removeFixture,
    openBox: id => setBoxId(id), moveBox: actions.moveBox, resizeWarehouse: actions.resizeWarehouse,
  }), [actions])

  const submitZone = async form => {
    const ok = zoneForm.mode === 'create' ? await actions.createZone(form) : await actions.updateZone(zoneForm.id, form)
    if (ok) setZoneForm(null)
  }
  const pickBoxes = async entries => { const ok = await actions.addItems(pickerFor, entries); if (ok) setPickerFor(null) }

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">🧭 상품찾기 <span className="text-[11px] font-bold text-surface-500 self-end mb-1" title="지금 열려 있는 화면의 버전">{WH_VERSION}</span></h1>
          <p className="text-xs text-surface-400 mt-0.5">창고를 그리고, 박스에 상품을 담고, 어디에 있는지 한 번에 찾아요</p>
        </div>
        <div className="flex-1" />
        {!canEdit && status === 'ready' && <span className="px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-surface-800 border border-surface-700 text-surface-300">👀 보기 전용</span>}
        {status === 'ready' && <Btn variant="soft" size="sm" onClick={() => setStockCheck(true)}>⚖️ 재고 대조</Btn>}
        <Btn variant="soft" size="sm" onClick={() => load(false)}><RefreshCw size={14} /> 새로고침</Btn>
      </div>

      {status === 'loading' && <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}
      {status === 'setup' && (
        <div className={`${card} p-8 text-center max-w-xl mx-auto`}>
          <div className="text-5xl mb-3">🛠️</div>
          <h2 className="text-lg font-bold text-white">처음 한 번만 준비가 필요해요</h2>
          <ol className="text-sm text-surface-300 mt-3 space-y-1.5 text-left inline-block leading-relaxed">
            <li>1. Supabase → <b>SQL Editor</b> 를 열어요</li>
            <li>2. <b>migration_warehouse.sql</b> 내용을 붙여넣고 <b>Run</b> 을 눌러요</li>
            <li>3. 이 화면에서 <b>새로고침</b> 을 눌러요</li>
          </ol>
        </div>)}
      {status === 'error' && <div className={`${card} p-8 text-center`}><EmptyNote emoji="😵" title="불러오지 못했어요">{errMsg}</EmptyNote><Btn variant="primary" className="mt-2" onClick={() => load(false)}>다시 시도</Btn></div>}

      {status === 'ready' && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_440px] gap-4 items-start">
          <section ref={planRef} className={`${card} p-3 sm:p-4 h-[78vh] min-h-[520px]`}>
            <FloorPlan model={model} canEdit={canEdit} highlight={highlight} focus={focus} onSelectZone={setActiveZone} onNotify={m => toast(m)} actions={planActions} />
          </section>
          <div className="space-y-4 min-w-0">
            <section className={`${card} p-3 sm:p-4`}>
              {fallbackNote && (
                <div role="status" data-testid="wh3d-note" className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
                  <span>⚠️</span><span className="flex-1 min-w-0 break-words">{fallbackNote}</span>
                  <button type="button" className="shrink-0 px-1 text-amber-300/80 hover:text-amber-200" aria-label="안내 닫기" onClick={() => setFallbackNote('')}>✕</button>
                </div>)}
              {view3d !== 'classic' && glSupported
                ? <Scene3DGL key={view3d} engine={view3d === 'three' ? 'three' : 'gl'} model={model} highlight={highlight} focus={focus} activeZoneId={activeZone}
                    onPickBox={setBoxId} onPickZone={id => setZoneDetail({ id, line: 0 })} onEngine={switch3d}
                    onFail={failed3d} />
                : <Scene3D model={model} highlight={highlight} focus={focus} activeZoneId={activeZone}
                    onPickBox={setBoxId} onPickZone={id => setZoneDetail({ id, line: 0 })} onEngine={glSupported ? switch3d : undefined} />}
            </section>
            <section className={card}>
              <SearchPanel model={model} query={query} setQuery={setQuery} results={results} onLocate={locate} onOpen={setBoxId} />
            </section>
          </div>
        </div>)}

      {zoneForm && <ZoneDialog mode={zoneForm.mode} zone={zoneForm.mode === 'edit' ? model.zonesById.get(zoneForm.id) : null} rect={zoneForm.rect} model={model} onSubmit={submitZone} onClose={() => setZoneForm(null)} />}
      {zoneDetail && <ZoneDetail zoneId={zoneDetail.id} initialLine={zoneDetail.line} model={model} canEdit={canEdit} highlight={highlight} actions={actions} prompt={prompt}
        onOpenBox={setBoxId} onEditZone={id => setZoneForm({ mode: 'edit', id })} onClose={() => setZoneDetail(null)} />}
      {boxId && <BoxPanel boxId={boxId} model={model} canEdit={canEdit} actions={actions} onAddProducts={setPickerFor} onLocate={locate} onMove={setMoveFor} onClose={() => setBoxId(null)} />}
      {moveFor && <MoveBoxDialog boxId={moveFor} model={model} onClose={() => setMoveFor(null)} onSubmit={async t => { if (await actions.moveBox(moveFor, t)) setMoveFor(null) }} />}
      {pickerFor && model.boxesById.get(pickerFor) && <ProductPicker boxLabel={`박스 ${model.boxesById.get(pickerFor).box_number}`} loadCatalog={api.loadCatalog} placed={model.placed} onConfirm={pickBoxes} onClose={() => setPickerFor(null)} />}
      {whDialog && model.warehouse && <WarehouseDialog wh={model.warehouse} onClose={() => setWhDialog(false)} onSubmit={async v => { if (await actions.updateWarehouse(v)) setWhDialog(false) }} />}
      {stockCheck && <StockCheck model={model} loadCatalog={api.loadCatalog} onFind={name => { setQuery(name); setStockCheck(false) }} onClose={() => setStockCheck(false)} />}
      {askDialog}{promptDialog}
    </div>
  )
}
