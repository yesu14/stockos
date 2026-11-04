// 평면도 / 전체보기 바꾸기 (왼쪽 카드 맨 위)
export default function ViewTabs({ value, onChange }) {
  return (
    <div role="tablist" aria-label="평면도 또는 전체보기" className="inline-flex rounded-xl border border-surface-700 bg-surface-900/95 overflow-hidden shadow">
      {[['plan', '🗺️', '평면도'], ['all', '📚', '전체보기']].map(([k, ic, label]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} title={k === 'plan' ? '창고를 위에서 본 그림' : '모든 구역·줄·층의 박스를 한눈에'} onClick={() => value !== k && onChange?.(k)}
          className={`h-8 px-3 text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${value === k ? 'bg-primary-500' : 'text-surface-300 hover:bg-surface-800'}`} style={value === k ? { color: '#fff' } : undefined}>
          <span>{ic}</span>{label}
        </button>))}
    </div>
  )
}
