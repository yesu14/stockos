import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Save, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LocationsPage() {
  const { t } = useTranslation()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [addForm, setAddForm] = useState({ name: '', description: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => { loadLocations() }, [])

  async function loadLocations() {
    const { data } = await supabase.from('storage_locations').select('*').order('name')
    setLocations(data || [])
    setLoading(false)
  }

  async function addLocation() {
    if (!addForm.name) return toast.error('이름을 입력하세요')
    const { error } = await supabase.from('storage_locations').insert(addForm)
    if (error) toast.error(error.message)
    else { toast.success(t('common.success')); setAddForm({ name: '', description: '' }); setAdding(false); loadLocations() }
  }

  async function saveLocation() {
    const { error } = await supabase.from('storage_locations').update(editForm).eq('id', editingId)
    if (error) toast.error(error.message)
    else { toast.success(t('common.success')); setEditingId(null); loadLocations() }
  }

  async function deleteLocation(id) {
    if (!confirm('삭제하시겠습니까?')) return
    const { error } = await supabase.from('storage_locations').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(t('common.success')); loadLocations() }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('menu.locations')}</h1>
        <button onClick={() => setAdding(!adding)}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
          <Plus size={16} /> 위치 추가
        </button>
      </div>

      {adding && (
        <div className="bg-surface-900 border border-primary-500/50 rounded-2xl p-5 animate-slide-up">
          <h2 className="font-semibold text-white mb-4">새 저장위치</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="위치명 *"
              className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
            <input value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} placeholder="설명 (예: 왼쪽 2번째 줄)"
              className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={addLocation} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Save size={14} /> 저장
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-lg text-sm transition-colors">취소</button>
          </div>
        </div>
      )}

      <div className="bg-surface-900 border border-surface-800 rounded-2xl divide-y divide-surface-800">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-12 text-surface-500">데이터가 없습니다</div>
        ) : (
          locations.map(loc => (
            <div key={loc.id} className="p-4">
              {editingId === loc.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="위치명"
                      className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
                    <input value={editForm.description || ''} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="설명"
                      className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveLocation} className="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"><Save size={14} /> 저장</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-surface-700 text-surface-300 rounded-lg text-sm">취소</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{loc.name}</p>
                    {loc.description && <p className="text-xs text-surface-500 mt-0.5">{loc.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingId(loc.id); setEditForm(loc) }} className="p-2 hover:bg-surface-700 text-surface-400 hover:text-white rounded-lg transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => deleteLocation(loc.id)} className="p-2 hover:bg-red-500/10 text-surface-400 hover:text-red-400 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
