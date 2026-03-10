import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Package, AlertTriangle, Search, X, Save, CheckSquare, Square, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

function ConfirmModal({ title, message, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><AlertTriangle size={20} className="text-red-400" /></div>
          <p className="text-white font-medium">{title || '삭제 확인'}</p>
        </div>
        <p className="text-surface-300 text-sm mb-6 whitespace-pre-line leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium transition-colors">취소</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors">삭제</button>
        </div>
      </div>
    </div>
  )
}

function CategoryManagerModal({ categories: initCats, onClose, onChanged }) {
  const [cats, setCats] = useState(initCats)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadCats() {
    const { data } = await supabase.from('categories').select('id, name, sort_order').order('sort_order').order('name')
    setCats(data || []); onChanged()
  }

  async function addCat() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const maxOrder = Math.max(0, ...cats.map(c => c.sort_order || 0))
      const { error } = await supabase.from('categories').insert({ name: newName.trim(), sort_order: maxOrder + 1 })
      if (error) throw error
      setNewName(''); setAdding(false); await loadCats(); toast.success('카테고리 추가됨')
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function saveCat(id) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await supabase.from('categories').update({ name: editName.trim() }).eq('id', id)
      setEditId(null); await loadCats(); toast.success('수정됨')
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function deleteCat(cat) {
    if (!confirm(`'${cat.name}' 카테고리를 삭제하시겠습니까?`)) return
    try {
      await supabase.from('categories').delete().eq('id', cat.id)
      await loadCats(); toast.success('삭제됨')
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-md flex flex-col shadow-2xl" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800 shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2"><Tag size={16} className="text-primary-400" /> 카테고리 관리</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cats.map(cat => (
            <div key={cat.id} className="flex items-center gap-2 px-3 py-2.5 bg-surface-800/40 rounded-xl">
              {editId === cat.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveCat(cat.id)}
                    className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500" />
                  <button onClick={() => saveCat(cat.id)} disabled={saving} className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">저장</button>
                  <button onClick={() => setEditId(null)} className="p-1.5 text-surface-400 hover:text-white"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-white">{cat.name}</span>
                  <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }} className="p-1.5 text-surface-400 hover:text-primary-400"><Pencil size={13} /></button>
                  <button onClick={() => deleteCat(cat)} className="p-1.5 text-surface-500 hover:text-red-400"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
          {cats.length === 0 && <p className="text-center py-6 text-surface-500 text-sm">카테고리 없음</p>}
        </div>
        <div className="p-4 border-t border-surface-800 shrink-0">
          {adding ? (
            <div className="flex gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') addCat(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
                placeholder="새 카테고리명"
                className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
              <button onClick={addCat} disabled={saving || !newName.trim()} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">추가</button>
              <button onClick={() => { setAdding(false); setNewName('') }} className="p-2 text-surface-400 hover:text-white"><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-500/15 hover:bg-primary-500/25 text-primary-400 rounded-xl text-sm font-medium">
              <Plus size={15} /> 카테고리 추가
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [expandedProds, setExpandedProds] = useState({})
  const [selected, setSelected] = useState({})
  const [catModal, setCatModal] = useState(null)
  const [editCatModal, setEditCatModal] = useState(null)
  const [deleteCatConfirm, setDeleteCatConfirm] = useState(null)
  const [deleteProdConfirm, setDeleteProdConfirm] = useState(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('id, name, sort_order').order('sort_order').order('name'),
      supabase.from('products').select('id, name, code, sort_order, is_active, image_url, storage_location_text, factory, sale_price, cost_price, margin, category_id, product_skus(id, stock, o1:option1_id(option_name, option_value, sort_order), o2:option2_id(option_name, option_value, sort_order))').eq('is_active', true).order('sort_order').order('name')
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    const exp = {}
    ;(cats || []).forEach(c => { exp[c.id] = true })
    exp['__none__'] = true
    setExpanded(exp)
    setLoading(false)
  }

  async function handleDeleteCategory(cat) {
    const catProds = products.filter(p => p.category_id === cat.id)
    setDeleteCatConfirm({ cat, hasProducts: catProds.length > 0, count: catProds.length })
  }

  async function confirmDeleteCategory() {
    const { cat } = deleteCatConfirm
    setDeleteCatConfirm(null)
    try {
      const catProds = products.filter(p => p.category_id === cat.id)
      for (const prod of catProds) {
        await supabase.from('product_skus').delete().eq('product_id', prod.id)
        await supabase.from('products').delete().eq('id', prod.id)
      }
      await supabase.from('categories').delete().eq('id', cat.id)
      toast.success('카테고리 삭제 완료'); loadData()
    } catch (err) { toast.error(err.message) }
  }

  async function confirmDeleteProduct() {
    const prod = deleteProdConfirm; setDeleteProdConfirm(null)
    try {
      await supabase.from('product_skus').delete().eq('product_id', prod.id)
      await supabase.from('products').delete().eq('id', prod.id)
      toast.success('상품 삭제됨'); loadData()
    } catch (err) { toast.error(err.message) }
  }

  async function confirmBulkDelete() {
    setBulkDeleteConfirm(false)
    const ids = Object.keys(selected).filter(id => selected[id])
    try {
      for (const id of ids) {
        await supabase.from('product_skus').delete().eq('product_id', id)
        await supabase.from('products').delete().eq('id', id)
      }
      toast.success(`${ids.length}개 상품 삭제됨`); setSelected({}); loadData()
    } catch (err) { toast.error(err.message) }
  }

  const tree = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filteredProds = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products
    const map = {}
    categories.forEach(c => { map[c.id] = { ...c, products: [] } })
    filteredProds.forEach(p => {
      if (p.category_id && map[p.category_id]) map[p.category_id].products.push(p)
      else { if (!map['__none__']) map['__none__'] = { id: '__none__', name: '미분류', sort_order: 9999, products: [] }; map['__none__'].products.push(p) }
    })
    return Object.values(map).filter(c => c.products.length > 0 || !q)
  }, [categories, products, search])

  const selectedCount = Object.values(selected).filter(Boolean).length
  const totalProds = products.length

  function sortedSkus(prod) {
    return [...(prod.product_skus || [])].sort((a, b) => {
      const o1a = a.o1?.sort_order ?? 999, o1b = b.o1?.sort_order ?? 999
      if (o1a !== o1b) return o1a - o1b
      return (a.o2?.sort_order ?? 999) - (b.o2?.sort_order ?? 999)
    })
  }
  function skuTotalStock(prod) { return (prod.product_skus || []).reduce((s, sk) => s + (sk.stock || 0), 0) }
  function skuLabel(sku) { return [sku.o1?.option_value, sku.o2?.option_value].filter(Boolean).join(' / ') || 'Default' }

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">상품 관리</h1>
          <p className="text-surface-400 text-sm mt-0.5">{totalProds}개 상품</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCatModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-300 hover:text-white rounded-xl text-sm font-medium transition-colors">
            <Tag size={14} /> 카테고리 관리
          </button>
          <button onClick={() => navigate('/products/new')} className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus size={15} /> 상품 추가
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="상품명 검색..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"><X size={13} /></button>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (selectedCount === totalProds && totalProds > 0) setSelected({}); else { const n = {}; products.forEach(p => { n[p.id] = true }); setSelected(n) } }}
            className={'flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ' + (selectedCount === totalProds && totalProds > 0 ? 'bg-primary-500/20 text-primary-400' : 'bg-surface-800 text-surface-400 hover:text-white')}>
            {selectedCount === totalProds && totalProds > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
            {selectedCount > 0 ? `${selectedCount}개 선택` : '전체선택'}
          </button>
          {selectedCount > 0 && (
            <button onClick={() => setBulkDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-xl text-sm font-medium transition-colors">
              <Trash2 size={14} /> 선택삭제 ({selectedCount})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          {tree.map(cat => {
            const isOpen = expanded[cat.id] ?? true
            return (
              <div key={cat.id} className="border-b border-surface-800 last:border-0">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-800/20 hover:bg-surface-800/40 transition-colors">
                  <Tag size={13} className="text-primary-400/70 shrink-0" />
                  <button className="flex items-center gap-2 flex-1 text-left" onClick={() => setExpanded(p => ({ ...p, [cat.id]: !isOpen }))}>
                    {isOpen ? <ChevronDown size={14} className="text-surface-400" /> : <ChevronRight size={14} className="text-surface-400" />}
                    <span className="font-semibold text-white text-sm">{cat.name}</span>
                    <span className="text-xs text-surface-500">({cat.products.length}개)</span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => navigate('/products/new', { state: { categoryId: cat.id } })} className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-500/15 hover:bg-primary-500/25 text-primary-400 rounded-lg text-xs font-medium transition-colors">
                      <Plus size={11} /> 상품추가
                    </button>
                    {cat.id !== '__none__' && (
                      <>
                        <button onClick={() => setEditCatModal(cat)} className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                          <Pencil size={11} /> 편집
                        </button>
                        <button onClick={() => handleDeleteCategory(cat)} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 rounded-lg text-xs font-medium transition-colors">
                          <Trash2 size={11} /> 삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isOpen && cat.products.map(prod => {
                  const skus = sortedSkus(prod)
                  const total = skuTotalStock(prod)
                  const prodOpen = expandedProds[prod.id] ?? false
                  const isSelected = !!selected[prod.id]
                  return (
                    <div key={prod.id} className={'border-t border-surface-800/40 ' + (isSelected ? 'bg-primary-500/5' : '')}>
                      <div className="flex items-center gap-2 pl-8 pr-4 py-2.5 hover:bg-surface-800/10 transition-colors">
                        <input type="checkbox" checked={isSelected} onChange={() => setSelected(p => ({ ...p, [prod.id]: !p[prod.id] }))} className="w-3.5 h-3.5 accent-primary-500 cursor-pointer shrink-0" />
                        <button onClick={() => setExpandedProds(p => ({ ...p, [prod.id]: !prodOpen }))} className="text-surface-500 hover:text-surface-300 transition-colors shrink-0">
                          {prodOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {prod.image_url ? <img src={prod.image_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" /> : <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center shrink-0"><Package size={12} className="text-surface-600" /></div>}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{prod.name}</p>
                            {prod.code && <p className="text-[10px] text-surface-500">{prod.code}</p>}
                          </div>
                        </div>
                        {/* 재고 옆에 옵션 요약 표시 */}
                        <div className="flex items-center gap-4 shrink-0">
                          <span className={'text-sm font-mono font-bold ' + (total < 10 ? 'text-red-400' : 'text-emerald-400')}>{total}</span>
                          <span className="text-xs text-surface-500 hidden sm:block">{prod.sale_price ? `₩${Number(prod.sale_price).toLocaleString()}` : ''}</span>
                          <span className="text-xs text-surface-600 hidden md:block truncate max-w-20">{prod.storage_location_text || ''}</span>
                          <span className="text-xs text-surface-600 hidden lg:block truncate max-w-16">{prod.factory || ''}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => navigate(`/products/${prod.id}/edit`)} className="flex items-center gap-1 px-2 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                            <Pencil size={11} /> 편집
                          </button>
                          <button onClick={() => setDeleteProdConfirm(prod)} className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {/* 옵션 목록 - 재고 바로 옆에 표시 */}
                      {prodOpen && (
                        <div className="pl-20 pr-4 pb-2 space-y-0.5">
                          {skus.map(sku => (
                            <div key={sku.id} className="flex items-center gap-2 px-3 py-1.5 bg-surface-800/20 rounded-lg text-xs">
                              <span className={'font-mono font-semibold w-10 text-right shrink-0 ' + (sku.stock < 10 ? 'text-red-400' : 'text-emerald-400')}>{sku.stock}</span>
                              <span className="text-surface-500">|</span>
                              <span className="text-surface-300">{skuLabel(sku)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
          {tree.length === 0 && <div className="flex flex-col items-center justify-center py-16 text-surface-500"><Package size={40} className="mb-2 opacity-20" /><p className="text-sm">{search ? '검색 결과 없음' : '상품 없음'}</p></div>}
        </div>
      )}

      {catModal !== null && <CategoryManagerModal categories={categories} onClose={() => setCatModal(null)} onChanged={loadData} />}
      {editCatModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-semibold text-white">카테고리 편집</h3><button onClick={() => setEditCatModal(null)} className="text-surface-400 hover:text-white"><X size={16} /></button></div>
            <input defaultValue={editCatModal.name} id="edit-cat-name" autoFocus className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500" />
            <div className="flex gap-2">
              <button onClick={() => setEditCatModal(null)} className="flex-1 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm">취소</button>
              <button onClick={async () => { const v = document.getElementById('edit-cat-name').value.trim(); if (!v) return; const { error } = await supabase.from('categories').update({ name: v }).eq('id', editCatModal.id); if (error) toast.error(error.message); else { toast.success('수정됨'); setEditCatModal(null); loadData() } }} className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-xl text-sm font-semibold">
                <Save size={14} /> 저장
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteCatConfirm && <ConfirmModal title="카테고리 삭제" message={deleteCatConfirm.hasProducts ? `'${deleteCatConfirm.cat.name}' 카테고리에 ${deleteCatConfirm.count}개 상품이 있습니다.\n상품을 모두 삭제한 후 카테고리가 삭제됩니다.\n계속하시겠습니까?` : `'${deleteCatConfirm.cat.name}' 카테고리를 삭제하시겠습니까?`} onConfirm={confirmDeleteCategory} onClose={() => setDeleteCatConfirm(null)} />}
      {deleteProdConfirm && <ConfirmModal message={`'${deleteProdConfirm.name}' 상품과 모든 옵션을 삭제하시겠습니까?`} onConfirm={confirmDeleteProduct} onClose={() => setDeleteProdConfirm(null)} />}
      {bulkDeleteConfirm && <ConfirmModal message={`선택한 ${selectedCount}개 상품을 삭제하시겠습니까?`} onConfirm={confirmBulkDelete} onClose={() => setBulkDeleteConfirm(false)} />}
    </div>
  )
}
