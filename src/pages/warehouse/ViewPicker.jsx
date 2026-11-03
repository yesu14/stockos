// 3D 보기 방식 고르기: 기본 3D / Three.js / 예전 3D — 어느 3D 화면에서나 같은 자리에 항상 보여서 바로 바꿀 수 있게
const OPTS = [
  ['gl', '기본 3D', '직접 만든 WebGL 3D (가장 많이 시험한 방식)'],
  ['three', 'Three.js', 'Three.js 라이브러리로 그리는 3D (처음 쓸 때 인터넷에서 불러와요)'],
  ['classic', '예전 3D', '예전 방식의 3D (WebGL 이 안 되는 기기에서도 돼요)'],
]
export default function ViewPicker({ value, onChange }) {
  return (
    <div role="group" aria-label="3D 보기 방식" className="inline-flex rounded-xl border border-surface-700 bg-surface-900/95 overflow-hidden shadow-lg">
      {OPTS.map(([k, label, tip]) => (
        <button key={k} type="button" title={tip} aria-pressed={value === k} onClick={() => value !== k && onChange?.(k)}
          className={`h-8 px-2.5 text-[11px] font-bold transition-colors ${value === k ? 'bg-primary-500' : 'text-surface-300 hover:bg-surface-800'}`} style={value === k ? { color: '#fff' } : undefined}>{label}</button>
      ))}
    </div>
  )
}
