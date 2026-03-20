import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Plus, Trash2, Edit2, Save, X, GripVertical,
  LayoutDashboard, Package, Boxes, ArrowDownCircle, ArrowUpCircle,
  RotateCcw, ShoppingCart, Shield, BarChart2, Settings,
  Star, FileText, Bell, Users, Tag, Layers
} from 'lucide-react'
import toast from 'react-hot-toast'

// 아이콘 맵
const ICON_MAP = {
  LayoutDashboard, Package, Boxes, ArrowDownCircle, ArrowUpCircle,
  RotateCcw, ShoppingCart, Shield, BarChart2, Settings,
  Star, FileText, Bell, Users, Tag, Layers
}

const ICON_OPTIONS = Object.keys(ICON_MAP)

function getIcon(name) {
  return ICON_MAP[name] || Package
}

export default function AdminMenusPage() {
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ label: '', url: '', icon_name: 'Package', required_role: 'manager' })
  const [saving, setSaving] = useState(false)

  // Drag state
  const dragIndex = useRef(null)
  const dragOverIndex = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('menus').select('*').order('sort_order')
    setMenus(data || [])
    setLoading(false)
  }

  async function saveEdit(menu) {
    if (!editLabel.trim()) return toast.error('메뉴 이름을 입력하세요')
    setSaving(true)
    const { error } = await supabase.from('menus').update({ label: editLabel.trim(), icon_name: editIcon, updated_at: new Date().toISOString() }).eq('id', menu.id)
    if (error) toast.error(error.message)
    else { toast.success('수정됨'); setEditingId(null); load() }
    setSaving(false)
  }

  async function deleteMenu(id) {
    if (!confirm('이 메뉴를 삭제하시겠습니까?')) return
    const { error } = await supabase.from('menus').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('삭제됨'); load() }
  }

  async function addMenu() {
    if (!addForm.label.trim()) return toast.error('메뉴 이름을 입력하세요')
    if (!addForm.url.trim()) return toast.error('URL을 입력하세요')
    setSaving(true)
    const maxOrder = Math.max(0, ...menus.map(m => m.sort_order))
    const menuKey = addForm.url.replace(/\//g, '_').replace(/^_/, '').replace(/[^a-z0-9_]/gi, '') || `custom_${Date.now()}`
    const { error } = await supabase.from('menus').insert({
      menu_key: menuKey, label: addForm.label.trim(), url: addForm.url.trim(),
      icon_name: addForm.icon_name, required_role: addForm.required_role,
      sort_order: maxOrder + 1, is_deletable: true, is_active: true
    })
    if (error) toast.error(error.message)
    else { toast.success('메뉴 추가됨'); setShowAdd(false); setAddForm({ label: '', url: '', icon_name: 'Package', required_role: 'manager' }); load() }
    setSaving(false)
  }

  // Drag-and-drop handlers
  function onDragStart(idx) { dragIndex.current = idx }
  function onDragOver(e, idx) { e.preventDefault(); dragOverIndex.current = idx }

  async function onDrop() {
    const from = dragIndex.current
    const to = dragOverIndex.current
    if (from === null || to === null || from === to) { dragIndex.current = null; dragOverIndex.current = null; return }

    const reordered = [...menus]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)

    // Update sort_order
    const updated = reordered.map((m, i) => ({ ...m, sort_order: i + 1 }))
    setMenus(updated)
    dragIndex.current = null; dragOverIndex.current = null

    // Save to DB
    try {
      for (const m of updated) {
        await supabase.from('menus').update({ sort_order: m.sort_order }).eq('id', m.id)
      }
      toast.success('순서 저장됨')
    } catch (err) { toast.error(err.message); load() }
  }

  const ROLE_LABELS = { viewer: '일반사용자+', manager: '매니저+', admin: '관리자만' }
  const ROLE_OPTIONS = ['viewer', 'manager', 'admin']

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">메뉴 관리</h1>
          <p className="text-surface-400 text-sm mt-0.5">사이드바 메뉴를 편집하고 순서를 조정하세요</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors">
          <Plus size={15} /> 메뉴 추가
        </button>
      </div>

      {/* 메뉴 추가 폼 */}
      {showAdd && (
        <div className="bg-surface-900 border border-primary-500/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-primary-400">새 메뉴 추가</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">메뉴 이름 <span className="text-red-400">*</span></label>
              <input value={addForm.label} onChange={e => setAddForm(p => ({ ...p, label: e.target.value }))} placeholder="예: 통계보고"
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">URL <span className="text-red-400">*</span></label>
              <input value={addForm.url} onChange={e => setAddForm(p => ({ ...p, url: e.target.value }))} placeholder="예: /reports"
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">아이콘</label>
              <select value={addForm.icon_name} onChange={e => setAddForm(p => ({ ...p, icon_name: e.target.value }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
                {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">권한</label>
              <select value={addForm.required_role} onChange={e => setAddForm(p => ({ ...p, required_role: e.target.value }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-surface-700 text-surface-300 rounded-xl text-sm">취소</button>
            <button onClick={addMenu} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium">
              <Save size={13} /> 추가
            </button>
          </div>
        </div>
      )}

      {/* 드래그 안내 */}
      <p className="text-xs text-surface-500 flex items-center gap-1.5">
        <GripVertical size={12} /> 드래그하여 메뉴 순서를 변경하세요
      </p>

      {/* 메뉴 목록 */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {menus.map((menu, idx) => {
            const Icon = getIcon(menu.icon_name)
            const isEditing = editingId === menu.id
            return (
              <div
                key={menu.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={onDrop}
                className="bg-surface-900 border border-surface-800 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-surface-700 transition-colors select-none"
              >
                {/* 드래그 핸들 */}
                <GripVertical size={16} className="text-surface-600 cursor-grab active:cursor-grabbing shrink-0" />

                {/* 아이콘 */}
                <div className="w-8 h-8 bg-surface-800 rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-primary-400" />
                </div>

                {/* 이름/편집 */}
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                      autoFocus onKeyDown={e => { if (e.key === 'Enter') saveEdit(menu); if (e.key === 'Escape') setEditingId(null) }}
                      className="flex-1 min-w-32 bg-surface-800 border border-primary-500 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
                    <select value={editIcon} onChange={e => setEditIcon(e.target.value)}
                      className="bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500">
                      {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{menu.label}</p>
                    <p className="text-xs text-surface-500">{menu.url} · {ROLE_LABELS[menu.required_role]}</p>
                  </div>
                )}

                {/* 기본 메뉴 배지 */}
                {!menu.is_deletable && (
                  <span className="text-[10px] px-2 py-0.5 bg-surface-700 text-surface-400 rounded-full shrink-0">기본</span>
                )}

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(menu)} disabled={saving}
                        className="p-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors">
                        <Save size={13} />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-lg transition-colors">
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(menu.id); setEditLabel(menu.label); setEditIcon(menu.icon_name) }}
                        className="p-1.5 hover:bg-surface-700 text-surface-400 hover:text-white rounded-lg transition-colors">
                        <Edit2 size={13} />
                      </button>
                      {menu.is_deletable ? (
                        <button onClick={() => deleteMenu(menu.id)}
                          className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <div className="w-7" /> /* spacer */
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs text-surface-600 bg-surface-900 border border-surface-800 rounded-xl px-4 py-3">
        💡 <span className="text-surface-500">기본 메뉴(대시보드, 상품관리 등)는 삭제할 수 없지만 이름과 아이콘은 수정할 수 있습니다.</span>
      </div>
    </div>
  )
}
