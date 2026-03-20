import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Save, X, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReturnSourcesPage({ embedded = false }) {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('return_sources').select('*').order('name')
    setSources(data || [])
    setLoading(false)
  }

  async function add() {
    if (!newName.trim()) return toast.error('반품처 이름을 입력하세요')
    setSaving(true)
    const { error } = await supabase.from('return_sources').insert({ name: newName.trim(), note: newNote.trim() || null })
    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) toast.error(`'${newName.trim()}' 이미 존재합니다`)
      else toast.error('저장 실패: ' + error.message)
    } else { toast.success('반품처 추가됨'); setNewName(''); setNewNote(''); setShowAdd(false); load() }
    setSaving(false)
  }

  async function update(id) {
    if (!editName.trim()) return toast.error('이름을 입력하세요')
    setSaving(true)
    const { error } = await supabase.from('return_sources').update({ name: editName.trim(), note: editNote.trim() || null }).eq('id', id)
    if (error) toast.error('수정 실패: ' + error.message)
    else { toast.success('수정됨'); setEditingId(null); load() }
    setSaving(false)
  }

  async function remove(id, name) {
    if (!confirm(`'${name}' 반품처를 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('return_sources').delete().eq('id', id)
    if (error) toast.error('삭제 실패: ' + error.message)
    else { toast.success('삭제됨'); load() }
  }

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {!embedded && <h1 className="text-2xl font-bold text-white">반품처 관리</h1>}
        {embedded && <h3 className="text-base font-semibold text-white">반품처 목록</h3>}
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors">
          <Plus size={14} /> 반품처 추가
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface-800/60 border border-surface-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">새 반품처</p>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="반품처 이름 *"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="메모 (선택)"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm">취소</button>
            <button onClick={add} disabled={saving} className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium">
              {saving ? '저장 중...' : '추가'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : sources.length === 0 ? (
        <div className="text-center py-10 text-surface-500 text-sm">반품처가 없습니다</div>
      ) : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          {sources.map((src, idx) => (
            <div key={src.id} className={"px-4 py-3 flex items-center gap-3 " + (idx < sources.length - 1 ? 'border-b border-surface-800' : '')}>
              <RotateCcw size={15} className="text-rose-400 shrink-0" />
              {editingId === src.id ? (
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="flex-1 min-w-32 bg-surface-800 border border-primary-500 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
                  <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="메모"
                    className="flex-1 min-w-32 bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
                  <button onClick={() => update(src.id)} disabled={saving} className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium">
                    <Save size={12} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-surface-700 text-surface-300 rounded-lg text-xs">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{src.name}</p>
                    {src.note && <p className="text-xs text-surface-500 mt-0.5">{src.note}</p>}
                  </div>
                  <button onClick={() => { setEditingId(src.id); setEditName(src.name); setEditNote(src.note || '') }}
                    className="p-1.5 hover:bg-surface-700 text-surface-400 hover:text-white rounded-lg transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(src.id, src.name)}
                    className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (embedded) return content
  return <div className="space-y-5 max-w-2xl">{content}</div>
}
