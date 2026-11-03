// ═══════════════════════════════════════════════════════════
//  상품찾기 — 공용 화면 부품 (귀엽고 모던한 스타일)
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Minus, Plus } from 'lucide-react'
import { stockStatus } from './whLogic'

// 컬러 배경 위 글자는 클래스(text-white)가 라이트 테마에서 바뀌므로 인라인 색을 쓴다
const ON_COLOR = { color: '#fff' }

// 화면 스크롤 잠금: 창이 여러 겹이어도, 닫는 순서와 상관없이 마지막 창이 닫힐 때만 풀린다
let lockCount = 0, savedOverflow = ''
function lockScroll() {
  if (lockCount++ === 0) { savedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  let released = false
  return () => { if (released) return; released = true; if (--lockCount === 0) document.body.style.overflow = savedOverflow }
}
// 열려 있는 창들 (Esc 는 맨 위 창만 닫는다)
const modalStack = []

export function Btn({ children, onClick, variant = 'soft', size = 'md', disabled, className = '', title, type = 'button', style, active }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold rounded-2xl transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base', icon: 'p-2.5' }
  const variants = {
    primary: 'bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/20',
    danger: 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20',
    soft: 'bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700',
    ghost: 'hover:bg-surface-800 text-surface-300',
  }
  const colored = variant === 'primary' || variant === 'danger' || active
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} aria-label={title}
      className={`${base} ${sizes[size]} ${active ? 'bg-primary-500 shadow-lg shadow-primary-500/20' : variants[variant]} ${className}`}
      style={colored ? { ...ON_COLOR, ...style } : style}>
      {children}
    </button>
  )
}

export function Modal({ onClose, title, subtitle, icon, children, footer, width = 'max-w-lg', level = 0, accent }) {
  const closeRef = useRef(onClose); closeRef.current = onClose          // 매번 다시 등록하지 않고 최신 onClose 만 부름
  useEffect(() => {
    const me = {}; modalStack.push(me)
    // 캡처 단계에서 먼저 받아서: (1) 평면도의 Esc(선택 해제)보다 먼저 처리하고 (2) 맨 위 창만 닫는다
    const k = e => { if (e.key === 'Escape' && modalStack[modalStack.length - 1] === me) { e.stopPropagation(); e.preventDefault(); closeRef.current?.() } }
    window.addEventListener('keydown', k, true)
    const unlock = lockScroll()
    return () => { window.removeEventListener('keydown', k, true); const i = modalStack.indexOf(me); if (i >= 0) modalStack.splice(i, 1); unlock() }
  }, [])
  return createPortal(
    <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4" style={{ zIndex: 95 + level }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width} max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-[28px] bg-surface-900 border border-surface-700 shadow-2xl animate-slide-up overflow-hidden`}>
        {accent && <div className="h-1.5 shrink-0" style={{ background: accent }} />}
        {(title || icon) && (
          <div className="flex items-center gap-3 px-5 pt-4 pb-3 shrink-0">
            {icon && <div className="text-2xl leading-none">{icon}</div>}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white truncate">{title}</h3>
              {subtitle && <p className="text-xs text-surface-400 mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-xl text-surface-400 hover:bg-surface-800" aria-label="닫기"><X size={18} /></button>
          </div>
        )}
        <div className="px-5 pb-4 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-surface-800 flex items-center justify-end gap-2 shrink-0 bg-surface-900">{footer}</div>}
      </div>
    </div>, document.body)
}

/** 확인창: const { ask, askDialog } = useAsk();  const ok = await ask({title, body, danger, confirmText}) */
export function useAsk() {
  const [req, setReq] = useState(null)
  const ask = useCallback(opts => new Promise(resolve => setReq({ ...opts, resolve })), [])
  const done = v => { req?.resolve(v); setReq(null) }
  const askDialog = req ? (
    <Modal level={3} width="max-w-sm" onClose={() => done(false)} icon={req.danger ? '⚠️' : '💬'} title={req.title}
      footer={<>
        <Btn variant="soft" onClick={() => done(false)}>{req.cancelText || '취소'}</Btn>
        <Btn variant={req.danger ? 'danger' : 'primary'} onClick={() => done(true)}>{req.confirmText || '확인'}</Btn>
      </>}>
      {req.body && <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-line">{req.body}</p>}
    </Modal>
  ) : null
  return { ask, askDialog }
}

/** 한 줄 입력창: const text = await prompt({title, label, placeholder, initial}) → 문자열 또는 null(취소) */
export function usePrompt() {
  const [req, setReq] = useState(null)
  const prompt = useCallback(opts => new Promise(resolve => setReq({ ...opts, resolve })), [])
  const done = v => { req?.resolve(v); setReq(null) }
  const promptDialog = req ? <PromptBody req={req} done={done} /> : null
  return { prompt, promptDialog }
}
function PromptBody({ req, done }) {
  const [v, setV] = useState(req.initial ?? '')
  return (
    <Modal level={3} width="max-w-sm" onClose={() => done(null)} icon={req.icon || '✏️'} title={req.title} subtitle={req.subtitle}
      footer={<><Btn variant="soft" onClick={() => done(null)}>취소</Btn><Btn variant="primary" onClick={() => done(v)}>{req.confirmText || '확인'}</Btn></>}>
      {req.label && <label className="block text-xs font-semibold text-surface-400 mb-1.5">{req.label}</label>}
      <input autoFocus value={v} onChange={e => setV(e.target.value)} placeholder={req.placeholder}
        onKeyDown={e => { if (e.key === 'Enter') done(v) }}
        className="w-full bg-surface-800 border border-surface-700 rounded-2xl px-4 py-3 text-base text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
      {req.hint && <p className="text-xs text-surface-500 mt-2">{req.hint}</p>}
    </Modal>
  )
}

/** 전체화면: CSS 로 화면을 덮는 방식(아이폰 포함 어디서나 동작) + 가능하면 브라우저 전체화면도 */
export function useFullscreen() {
  const ref = useRef(null)
  const [full, setFull] = useState(false)
  const exit = useCallback(() => {
    setFull(false)
    try { if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {}) } catch { /* 무시 */ }
  }, [])
  const enter = useCallback(() => {
    setFull(true)
    try { ref.current?.requestFullscreen?.()?.catch?.(() => {}) } catch { /* 무시 */ }
  }, [])
  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setFull(false) }
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  useEffect(() => {
    if (!full) return
    const k = e => { if (e.key === 'Escape' && modalStack.length === 0) exit() }      // 창이 열려 있으면 창이 먼저 닫힘
    window.addEventListener('keydown', k)
    const unlock = lockScroll()
    return () => { window.removeEventListener('keydown', k); unlock() }
  }, [full, exit])
  return { ref, full, toggle: () => (full ? exit() : enter()), exit }
}

/** 평면도 / 3D 전체화면을 페이지에서 한꺼번에 관리.
 *  브라우저 전체화면은 페이지 전체(html)에 한 번만 걸고, 평면도 ↔ 3D 는 그 안에서 화면 덮개(스타일)만 바꿈.
 *  그래서 3D 방식을 바꾸거나(기본 3D · Three.js · 예전 3D) 평면도 ↔ 3D 로 바꿔도 전체화면이 풀리거나 깜빡이지 않고, 전체화면이 겹겹이 쌓이지도 않음.
 *  페이지 전체가 전체화면 요소라서 팝업 창·알림 메시지(토스트)도 전체화면에서 그대로 보임.
 *  cur = null | 'plan' | 'v3d' (어느 화면이 전체화면인지). 브라우저 전체화면이 안 되는 곳에서는 덮개만으로 화면 전체를 덮음 */
export function useFullscreenViews() {
  const [cur, setCur] = useState(null)
  const exit = useCallback(() => {
    setCur(null)
    try { if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {}) } catch { /* 무시 */ }
  }, [])
  const enter = useCallback(which => {
    setCur(which)
    try { if (!document.fullscreenElement) { const p = document.documentElement.requestFullscreen?.(); p?.catch?.(() => {}) } } catch { /* 무시 */ }
  }, [])
  const curRef = useRef(null); curRef.current = cur
  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setCur(null) }                   // 브라우저가 전체화면을 끝냈을 때 (Esc 등)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  useEffect(() => {
    if (!cur) return
    const k = e => { if (e.key === 'Escape' && modalStack.length === 0) exit() }       // 창이 열려 있으면 창이 먼저 닫힘
    window.addEventListener('keydown', k)
    const unlock = lockScroll()
    return () => { window.removeEventListener('keydown', k); unlock() }
  }, [cur, exit])
  return { cur, enter, exit, toggle: which => (curRef.current === which ? exit() : enter(which)) }
}

export function Stepper({ value, onChange, min = 0, max = 99, label, size = 'md' }) {
  const set = v => onChange(Math.max(min, Math.min(max, Math.round(Number(v) || 0))))
  const b = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9'
  return (
    <div className="inline-flex items-center gap-1.5" aria-label={label}>
      <button type="button" onClick={() => set(value - 1)} disabled={value <= min} className={`${b} rounded-xl bg-surface-800 border border-surface-700 text-surface-200 flex items-center justify-center disabled:opacity-30 active:scale-90`}><Minus size={15} /></button>
      <input type="text" inputMode="numeric" value={value}
        onChange={e => { const d = e.target.value.replace(/[^0-9]/g, ''); onChange(d === '' ? '' : Number(d)) }}
        onBlur={e => set(e.target.value)} onFocus={e => e.target.select()}
        className={`${size === 'sm' ? 'w-12 h-8 text-sm' : 'w-14 h-9 text-base'} text-center font-bold rounded-xl bg-surface-800 border border-surface-700 text-white focus:outline-none focus:border-primary-500`} />
      <button type="button" onClick={() => set(value + 1)} disabled={value >= max} className={`${b} rounded-xl bg-surface-800 border border-surface-700 text-surface-200 flex items-center justify-center disabled:opacity-30 active:scale-90`}><Plus size={15} /></button>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-surface-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-surface-500 mt-1">{hint}</p>}
    </div>
  )
}
export const inputCls = 'w-full bg-surface-800 border border-surface-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500'

// ── 아이콘 (이모티콘 느낌의 벡터: 기기마다 모양이 달라지지 않게) ──
export function FixtureIcon({ kind, size = 22 }) {
  const s = { width: size, height: size }
  if (kind === 'window') return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#bfe6ff" stroke="#5aa9d6" strokeWidth="1.6" />
      <path d="M12 3v18M3 12h18" stroke="#5aa9d6" strokeWidth="1.6" />
      <path d="M6 7l3-1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>)
  if (kind === 'door') return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <rect x="5" y="2.5" width="14" height="19" rx="3" fill="#d9a273" stroke="#9b6b3e" strokeWidth="1.6" />
      <rect x="8" y="5.5" width="8" height="5" rx="1.5" fill="#e8bd94" />
      <circle cx="16" cy="13.5" r="1.4" fill="#f6e3a1" stroke="#9b6b3e" strokeWidth="0.8" />
    </svg>)
  if (kind === 'office') return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <rect x="3.5" y="9" width="17" height="12" rx="2.5" fill="#d8c6ff" stroke="#a98cf0" strokeWidth="1.6" />
      <path d="M2 10l10-7 10 7z" fill="#a98cf0" stroke="#8b6cdc" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="6.5" y="12" width="3.5" height="3.2" rx="0.8" fill="#fff" /><rect x="14" y="12" width="3.5" height="3.2" rx="0.8" fill="#fff" />
      <rect x="10.2" y="16.2" width="3.6" height="4.8" rx="1" fill="#8b6cdc" />
    </svg>)
  if (kind === 'select') return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden><path d="M5 3l14 7-6 2-2 6z" fill="currentColor" opacity="0.9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>)
  if (kind === 'warehouse') return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <path d="M3 10l9-6 9 6v10H3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="8" y="12" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>)
  if (kind === 'zone') return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden><rect x="3.5" y="5.5" width="17" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3.2 2.4" /><path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>)
  return null
}

/** 시스템 재고와 박스 합계 비교 배지: 일치 / 미배치 / 초과 */
export function StockBadge({ stock, placed, className = '' }) {
  const st = stockStatus(stock, placed)
  if (st.kind === 'unknown') return null
  const v = { ok: ['✓ 재고와 일치', '#059669', 'rgba(16,185,129,0.16)'], short: [`미배치 ${st.diff}개`, '#d97706', 'rgba(245,158,11,0.18)'], over: [`재고보다 ${-st.diff}개 많아요`, '#dc2626', 'rgba(239,68,68,0.16)'] }[st.kind]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${className}`} style={{ color: v[1], background: v[2] }}>{v[0]}</span>
}

export function EmptyNote({ emoji, title, children }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="text-4xl mb-2">{emoji}</div>
      <p className="text-sm font-semibold text-surface-200">{title}</p>
      {children && <p className="text-xs text-surface-500 mt-1 leading-relaxed">{children}</p>}
    </div>
  )
}
