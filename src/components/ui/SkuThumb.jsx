import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Package, X } from 'lucide-react'

/**
 * 옵션(SKU) 이미지 썸네일
 * - url 이 없거나 이미지가 깨지면 빈 칸(아이콘)으로 표시해서 줄 높이/정렬을 유지
 * - 클릭하면 크게 보기 (행 클릭 이벤트로 번지지 않도록 stopPropagation)
 */
export default function SkuThumb({ url, size = 36, className = '', zoom = true }) {
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  const box = { width: size, height: size, minWidth: size }

  if (!url || broken) {
    return (
      <div style={box}
        className={`shrink-0 rounded-lg border border-surface-700 bg-surface-800/60 flex items-center justify-center text-surface-600 ${className}`}>
        <Package size={Math.max(12, Math.round(size * 0.45))} />
      </div>
    )
  }

  return (
    <>
      <img src={url} alt="" style={box} loading="lazy"
        onError={() => setBroken(true)}
        onClick={zoom ? e => { e.stopPropagation(); setOpen(true) } : undefined}
        className={`shrink-0 rounded-lg border border-surface-700 object-cover ${zoom ? 'cursor-zoom-in' : ''} ${className}`} />
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
          onClick={e => { e.stopPropagation(); setOpen(false) }}>
          <img src={url} alt="" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
          <button type="button" onClick={e => { e.stopPropagation(); setOpen(false) }}
            style={{ color: '#fff' }}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors">
            <X size={20} />
          </button>
        </div>,
        document.body
      )}
    </>
  )
}
