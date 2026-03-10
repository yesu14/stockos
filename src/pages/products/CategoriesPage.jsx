import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, X, Save, AlertTriangle, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', code: '' })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [saving, setSaving] = useState(false)
  const dragRef = useRef(null)

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    setLoading(true)
    const { data } = await supabase.from('categories').select('id, name, code, sort_order').order('sort_order').order('name')
    // 각 카테고리 상품 수 조회
    const { data: prods } = await supabase.from('products').select('id, category_id').eq('is_active', true)
    const countMap = {}
    ;(prods || []).forEach(p => { if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1 })
    setCategories((data || []).map(c => ({ ...c, productCount: countMap[c.id] || 0 })))
    setLoading(false)
  }

  async function saveCategory() {
    if (!form.name.trim()) return toast.error('카테고리명을 입력하세요')
    setSaving(true)
    try {
      if (editId) {
        await supabase.from('categories').update({ name: form.name.trim(), code: form.code.trim() || null }).eq('id', editId)
        toast.success('수정됨')
      } else {
        const maxOrder = Math.max(0, ...categories.map(c => c.sort_order || 0))
        await supabase.from('categories').insert({ name: form.name.trim(), code: form.code.trim() || null, sort_order: maxOrder + 1 })
        toast.success('추가됨')
      }
      setForm({ name: '', code: '' }); setEditId(null); setShowAdd(false)
      loadCategories()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function deleteCategory(cat) {
    setSaving(true)
    try {
      // 상품의 category_id를 null로
      await supabase.from('products').update({ category_id: null }).eq('category_id', cat.id)
      await supabase.from('categories').delete().eq('id', cat.id)
      toast.success('삭제됨'); setConfirmDelete(null); loadCategories()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  function startEdit(cat) {
    setEditId(cat.id); setForm({ name: cat.name, code: cat.code || '' }); setShowAdd(true)
  }
  function cancelForm() { setEditId(null); setForm({ name: '', code: '' }); setShowAdd(false) }

  // 드래그 정렬
  function handleDragStart(e, idx) { dragRef.current = idx; e.dataTransfer.effectAllowed = 'move' }
  function handleDragOver(e, idx) {
    e.preventDefault()
    if (dragRef.current === null || dragRef.current === idx) return
    const next = [...categories]
    const [moved] = next.splice(dragRef.current, 1)
    next.splice(idx, 0, moved)
    dragRef.current = idx
    setCategories(next)
  }
  async function handleDragEnd() {
    dragRef.current = null
    for (let i = 0; i < categories.length; i++) {
      await supabase.from('categories').update({ sort_order: i + 1 }).eq('id', categories[i].id)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">카테고리 관리</h1>
          <p className="text-surface-400 text-sm mt-0.5">{categories.length}개 카테고리</p>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors">
            <Plus size={15} /> 카테고리 추가
          </button>
        )}
      </div>

      {/* 추가/수정 폼 */}
      {showAdd && (
        <div className="bg-surface-900 border border-primary-500/30 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-white">{editId ? '카테고리 수정' : '새 카테고리'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">카테고리명 *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 핸드폰 케이스" autoFocus
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">코드 (선택)</label>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="예: PHONE"
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={cancelForm} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium transition-colors">취소</button>
            <button onClick={saveCategory} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Save size={14} />{saving ? '저장 중...' : (editId ? '수정 저장' : '추가')}
            </button>
          </div>
        </div>
      )}

      {/* 카테고리 목록 */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-500">
              <p className="text-sm">카테고리가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-800">
              {categories.map((cat, idx) => (
                <div key={cat.id} draggable onDragStart={e => handleDragStart(e, idx)} onDragOver={e => handleDragOver(e, idx)} onDragEnd={handleDragEnd}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-800/30 transition-colors group">
                  <GripVertical size={14} className="text-surface-600 group-hover:text-surface-400 cursor-grab shrink-0" />
                  {cat.code && <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded font-mono shrink-0">{cat.code}</span>}
                  <span className="font-medium text-white flex-1">{cat.name}</span>
                  <span className="text-xs text-surface-500 shrink-0">{cat.productCount}개 상품</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(cat)} className="p-1.5 hover:bg-surface-700 text-surface-400 hover:text-white rounded-lg transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => setConfirmDelete(cat)} className="p-1.5 hover:bg-red-500/10 text-surface-400 hover:text-red-400 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <p className="text-white font-medium">카테고리 삭제</p>
            </div>
            <p className="text-surface-300 text-sm mb-2">
              <span className="text-white font-semibold">"{confirmDelete.name}"</span> 카테고리를 삭제합니다.
            </p>
            <p className="text-surface-400 text-xs mb-6">
              이 카테고리에 속한 {confirmDelete.productCount}개 상품의 카테고리가 해제됩니다.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium transition-colors">취소</button>
              <button onClick={() => deleteCategory(confirmDelete)} disabled={saving} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
