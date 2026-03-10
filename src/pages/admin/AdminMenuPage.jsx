import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, GripVertical, Save, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_OPTIONS = ['viewer', 'manager', 'admin']
const ICON_OPTIONS = ['LayoutDashboard', 'Package', 'PackageCheck', 'Boxes', 'Shield', 'Users', 'MapPin', 'Settings']

export default function AdminMenuPage() {
  const { t } = useTranslation()
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => { loadMenus() }, [])

  async function loadMenus() {
    const { data } = await supabase.from('menus').select('*').order('sort_order')
    const roots = (data || []).filter(m => !m.parent_id)
    const children = (data || []).filter(m => m.parent_id)
    setMenus(roots.map(r => ({ ...r, children: children.filter(c => c.parent_id === r.id) })))
    setLoading(false)
  }

  function startEdit(menu) {
    setEditingId(menu.id)
    setEditForm({ ...menu })
  }

  async function saveMenu() {
    const { error } = await supabase
      .from('menus')
      .update({
        name_ko: editForm.name_ko, name_zh: editForm.name_zh, name_en: editForm.name_en,
        url: editForm.url, icon: editForm.icon,
        permission_role: editForm.permission_role,
        is_active: editForm.is_active,
        sort_order: editForm.sort_order,
      })
      .eq('id', editingId)

    if (error) toast.error(error.message)
    else { toast.success(t('common.success')); setEditingId(null); loadMenus() }
  }

  async function deleteMenu(id) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('menus').delete().eq('id', id)
    toast.success(t('common.success'))
    loadMenus()
  }

  async function addMenu(parentId = null) {
    const { error } = await supabase.from('menus').insert({
      name_ko: '새 메뉴', name_zh: '新菜单', name_en: 'New Menu',
      url: '/', icon: 'Package',
      parent_id: parentId,
      sort_order: 99,
      permission_role: 'viewer',
      is_active: true
    })
    if (!error) { toast.success('메뉴 추가됨'); loadMenus() }
  }

  async function moveOrder(id, direction) {
    const all = menus.flatMap(m => [m, ...(m.children || [])])
    const idx = all.findIndex(m => m.id === id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= all.length) return

    const a = all[idx], b = all[swapIdx]
    await Promise.all([
      supabase.from('menus').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('menus').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    loadMenus()
  }

  const MenuRow = ({ menu, isChild = false }) => {
    const isEditing = editingId === menu.id
    return (
      <div className={`${isChild ? 'ml-8 border-l border-surface-700 pl-4' : ''}`}>
        <div className={`flex items-start gap-3 p-3 rounded-xl mb-1 ${isEditing ? 'bg-surface-800 border border-primary-500/50' : 'hover:bg-surface-800'} transition-colors`}>
          <GripVertical size={16} className="text-surface-600 mt-1 shrink-0" />
          
          {isEditing ? (
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={editForm.name_ko || ''} onChange={e => setEditForm(p => ({ ...p, name_ko: e.target.value }))} placeholder="한국어" className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500" />
              <input value={editForm.name_zh || ''} onChange={e => setEditForm(p => ({ ...p, name_zh: e.target.value }))} placeholder="中文" className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500" />
              <input value={editForm.name_en || ''} onChange={e => setEditForm(p => ({ ...p, name_en: e.target.value }))} placeholder="English" className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500" />
              <input value={editForm.url || ''} onChange={e => setEditForm(p => ({ ...p, url: e.target.value }))} placeholder="URL (예: /products)" className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500" />
              <select value={editForm.icon || ''} onChange={e => setEditForm(p => ({ ...p, icon: e.target.value }))} className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
                {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select value={editForm.permission_role || 'viewer'} onChange={e => setEditForm(p => ({ ...p, permission_role: e.target.value }))} className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label className="flex items-center gap-2 col-span-2">
                <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-primary-500" />
                <span className="text-sm text-surface-300">활성</span>
              </label>
              <div className="flex gap-2 col-span-2">
                <button onClick={saveMenu} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  <Save size={14} />{t('common.save')}
                </button>
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-lg text-sm transition-colors">{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-white">{menu.name_ko}</p>
                <p className="text-xs text-surface-400">{menu.url} • {menu.permission_role} • {menu.is_active ? '활성' : '비활성'}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => startEdit(menu)} className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-lg text-xs transition-colors">{t('common.edit')}</button>
                <button onClick={() => deleteMenu(menu.id)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors">{t('common.delete')}</button>
              </div>
            </div>
          )}
        </div>

        {menu.children?.map(child => (
          <MenuRow key={child.id} menu={child} isChild />
        ))}

        {!isChild && (
          <button
            onClick={() => addMenu(menu.id)}
            className="ml-8 flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 mb-2 transition-colors"
          >
            <Plus size={12} /> 하위 메뉴 추가
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('admin.menuEditor')}</h1>
        <button
          onClick={() => addMenu()}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus size={16} /> 메뉴 추가
        </button>
      </div>

      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          menus.map(menu => <MenuRow key={menu.id} menu={menu} />)
        )}
      </div>
    </div>
  )
}
