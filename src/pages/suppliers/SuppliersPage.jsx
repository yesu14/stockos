import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Save, X, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SuppliersPage({ embedded = false }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSuppliers() }, [])

  async function loadSuppliers() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  async function addSupplier() {
    if (!newName.trim()) return toast.error('납품처 이름을 입력하세요')
    setSaving(true)
    const { error } = await supabase.from('suppliers').insert({ name: newName.trim(), note: newNote.trim() || null })
    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) toast.error(`'${newName.trim()}' 납품처가 이미 존재합니다. 다른 이름을 사용해주세요.`)
      else toast.error('저장 실패: ' + error.message)
    }
    else { toast.success('납품처 추가됨'); setNewName(''); setNewNote(''); setShowAdd(false); loadSuppliers() }
    setSaving(false)
  }

  async function updateSupplier(id) {
    if (!editName.trim()) return toast.error('이름을 입력하세요')
    setSaving(true)
    const { error } = await supabase.from('suppliers').update({ name: editName.trim(), note: editNote.trim() || null, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) toast.error(`'${editName.trim()}' 납품처가 이미 존재합니다.`)
      else toast.error('수정 실패: ' + error.message)
    }
    else { toast.success('수정됨'); setEditingId(null); loadSuppliers() }
    setSaving(false)
  }

  async function deleteSupplier(id, name) {
    if (!confirm(`"${name}" 납품처를 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('삭제됨'); loadSuppliers() }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={22} className="text-primary-400" />
          {!embedded && <h1 className="text-2xl font-bold text-white">납품처 관리</h1>}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={15} /> 납품처 추가
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface-900 border border-primary-500/30 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-white text-sm">새 납품처 추가</h3>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="납품처 이름 *"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="메모 (선택사항)"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setNewName(''); setNewNote('') }} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm transition-colors">취소</button>
            <button onClick={addSupplier} disabled={saving} className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">추가</button>
          </div>
        </div>
      )}

      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-surface-800/50 border-b border-surface-800 text-xs font-semibold text-surface-400 uppercase tracking-wide flex gap-4">
          <span className="flex-1">납품처 이름</span>
          <span className="w-40">메모</span>
          <span className="w-20 text-right">작업</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-surface-500">
            <Building2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">납품처가 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {suppliers.map(s => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-800/20 transition-colors">
                {editingId === s.id ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-surface-800 border border-primary-500 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
                    <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="메모"
                      className="w-40 bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
                    <div className="flex gap-1 w-20 justify-end">
                      <button onClick={() => updateSupplier(s.id)} disabled={saving} className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"><Save size={13} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 bg-surface-700 hover:bg-surface-600 text-surface-400 rounded-lg transition-colors"><X size={13} /></button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-white">{s.name}</span>
                    <span className="w-40 text-xs text-surface-400 truncate">{s.note || '-'}</span>
                    <div className="flex gap-1 w-20 justify-end">
                      <button onClick={() => { setEditingId(s.id); setEditName(s.name); setEditNote(s.note || '') }} className="p-1.5 hover:bg-surface-700 text-surface-400 hover:text-white rounded-lg transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => deleteSupplier(s.id, s.name)} className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
