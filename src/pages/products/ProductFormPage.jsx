import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, Trash2, Zap, ImagePlus, X, Save, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-surface-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, className = '' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 transition-all ${className}`} />
  )
}

export default function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const fileInputRef = useRef(null)

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState([])
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  const [form, setForm] = useState({
    category_id: '',
    name: '', code: '', sort_order: 0,
    sale_price: '', cost_price: '',
    storage_location_text: '',
    margin: '',
    factory: '', note: '', image_url: '',
    option_count: 1,
  })

  const [opt1Name, setOpt1Name] = useState('')
  const [opt1Values, setOpt1Values] = useState('')
  const [opt2Name, setOpt2Name] = useState('')
  const [opt2Values, setOpt2Values] = useState('')
  const [skuRows, setSkuRows] = useState([])
  const [bulkStock, setBulkStock] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [optionsApplied, setOptionsApplied] = useState(false)

  useEffect(() => { loadRefData(); if (isEdit) loadProduct() }, [id])

  async function loadRefData() {
    const { data: cats } = await supabase.from('categories').select('*').order('sort_order')
    setCategories(cats || [])
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    setSavingCat(true)
    try {
      const maxOrder = Math.max(0, ...categories.map(c => c.sort_order || 0))
      const { data, error } = await supabase.from('categories').insert({ name: newCatName.trim(), sort_order: maxOrder + 1 }).select().single()
      if (error) throw error
      const newCats = [...categories, data]
      setCategories(newCats)
      setForm(p => ({ ...p, category_id: data.id }))
      setNewCatName(''); setShowAddCat(false)
      toast.success('카테고리 추가됨')
    } catch (err) { toast.error(err.message) }
    finally { setSavingCat(false) }
  }

  async function loadProduct() {
    const { data: p } = await supabase.from('products').select('*').eq('id', id).single()
    if (!p) return
    setForm({
      category_id: p.category_id || '',
      name: p.name || '', code: p.code || '', sort_order: p.sort_order || 0,
      sale_price: p.sale_price || '', cost_price: p.cost_price || '',
      storage_location_text: p.storage_location_text || '',
      factory: p.factory || '', note: p.note || '', image_url: p.image_url || '', margin: p.margin || '',
      option_count: p.option_count || 1,
    })
    const { data: opts } = await supabase.from('product_options').select('*').eq('product_id', id).order('option_number').order('sort_order')
    const { data: skus } = await supabase.from('product_skus').select('*, o1:option1_id(*), o2:option2_id(*)').eq('product_id', id)
    if (opts?.length > 0) {
      const opt1 = opts.filter(o => o.option_number === 1)
      const opt2 = opts.filter(o => o.option_number === 2)
      if (opt1.length) { setOpt1Name(opt1[0].option_name); setOpt1Values(opt1.map(o => o.option_value).join(',')) }
      if (opt2.length) { setOpt2Name(opt2[0].option_name); setOpt2Values(opt2.map(o => o.option_value).join(',')) }
      if (skus) { setSkuRows(skus.map(s => ({ _id: s.id, opt1Val: s.o1?.option_value || '', opt2Val: s.o2?.option_value || '', stock: s.stock }))); setOptionsApplied(true) }
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('이미지 파일만 가능합니다')
    if (file.size > 5 * 1024 * 1024) return toast.error('5MB 이하만 가능합니다')
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `products/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)
      setForm(p => ({ ...p, image_url: publicUrl }))
      toast.success('업로드 완료')
    } catch (err) { toast.error('업로드 실패: ' + err.message) }
    finally { setUploading(false) }
  }

  function applyOptions() {
    if (!opt1Name || !opt1Values.trim()) return toast.error('옵션1 이름과 값을 입력하세요')
    if (form.option_count === 2 && (!opt2Name || !opt2Values.trim())) return toast.error('옵션2 이름과 값을 입력하세요')
    const v1 = opt1Values.split(',').map(s => s.trim()).filter(Boolean)
    const v2 = form.option_count === 2 ? opt2Values.split(',').map(s => s.trim()).filter(Boolean) : []
    let rows = form.option_count === 1 ? v1.map(v => ({ opt1Val: v, opt2Val: '', stock: 0 })) : v1.flatMap(v1val => v2.map(v2val => ({ opt1Val: v1val, opt2Val: v2val, stock: 0 })))
    setSkuRows(rows); setOptionsApplied(true)
    toast.success(`${rows.length}개 옵션 조합 생성됨`)
  }

  function applyBulkStock() {
    const v = parseInt(bulkStock)
    if (isNaN(v) || v < 0) return toast.error('0 이상의 정수를 입력하세요')
    setSkuRows(p => p.map(r => ({ ...r, stock: v }))); setShowBulk(false); setBulkStock('')
    toast.success(`모든 재고를 ${v}으로 설정`)
  }

  async function handleSave() {
    if (!form.name) return toast.error('상품명을 입력하세요')
    if (!form.category_id) return toast.error('카테고리를 선택하세요')
    if (!optionsApplied) return toast.error('옵션 적용 버튼을 눌러주세요')
    if (skuRows.length === 0) return toast.error('옵션이 최소 1개 필요합니다')
    setSaving(true)
    try {
      let productId = id
      const productData = {
        category_id: form.category_id,
        name: form.name, code: form.code || null, sort_order: Number(form.sort_order) || 0,
        sale_price: Number(form.sale_price) || 0,
        margin: Number(form.margin) || 0, cost_price: Number(form.cost_price) || 0,
        storage_location_text: form.storage_location_text || null,
        factory: form.factory || null, note: form.note || null,
        image_url: form.image_url || null, option_count: form.option_count,
        updated_at: new Date().toISOString()
      }
      if (isEdit) {
        await supabase.from('products').update(productData).eq('id', id)
        await supabase.from('product_options').delete().eq('product_id', id)
        await supabase.from('product_skus').delete().eq('product_id', id)
      } else {
        const { data } = await supabase.from('products').insert(productData).select().single()
        productId = data.id
      }
      const v1list = opt1Values.split(',').map(s => s.trim()).filter(Boolean)
      const v2list = form.option_count === 2 ? opt2Values.split(',').map(s => s.trim()).filter(Boolean) : []
      const { data: insertedOpt1 } = await supabase.from('product_options').insert(v1list.map((val, i) => ({ product_id: productId, option_number: 1, option_name: opt1Name, option_value: val, sort_order: i }))).select()
      let insertedOpt2 = []
      if (form.option_count === 2 && v2list.length > 0) {
        const { data } = await supabase.from('product_options').insert(v2list.map((val, i) => ({ product_id: productId, option_number: 2, option_name: opt2Name, option_value: val, sort_order: i }))).select()
        insertedOpt2 = data || []
      }
      await supabase.from('product_skus').insert(skuRows.map(row => ({
        product_id: productId,
        option1_id: insertedOpt1?.find(o => o.option_value === row.opt1Val)?.id || null,
        option2_id: insertedOpt2?.find(o => o.option_value === row.opt2Val)?.id || null,
        stock: Number(row.stock) || 0
      })).filter(s => s.option1_id))
      toast.success(isEdit ? '수정 완료' : '상품 추가 완료')
      navigate('/products')
    } catch (err) { toast.error(err.message || '오류 발생') }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/products')} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"><ChevronLeft size={22} /></button>
        <h1 className="text-xl font-bold text-white">{isEdit ? '상품 편집' : '상품 추가'}</h1>
      </div>

      {/* 1. 카테고리 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-primary-500/20 text-primary-400 rounded-lg flex items-center justify-center text-xs font-bold">1</span>
          카테고리 선택
        </h2>
        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-surface-400 mb-1.5">카테고리 <span className="text-red-400">*</span></label>
              <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500">
                <option value="">선택...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setShowAddCat(!showAddCat)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-white rounded-xl text-sm font-medium transition-colors whitespace-nowrap">
              <Plus size={14} /> 카테고리 추가
            </button>
          </div>
          {showAddCat && (
            <div className="flex gap-2 p-3 bg-surface-800/50 rounded-xl border border-primary-500/20">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="새 카테고리명" autoFocus
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
              <button onClick={addCategory} disabled={savingCat || !newCatName.trim()}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
                {savingCat ? '...' : '추가'}
              </button>
              <button onClick={() => { setShowAddCat(false); setNewCatName('') }} className="p-2 text-surface-400 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. 대표 이미지 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><span className="w-6 h-6 bg-primary-500/20 text-primary-400 rounded-lg flex items-center justify-center text-xs font-bold">2</span>대표 이미지 <span className="text-xs text-surface-500 font-normal">(선택사항)</span></h2>
        <div className="flex items-start gap-4">
          <div onClick={() => !uploading && fileInputRef.current?.click()}
            className="w-32 h-32 rounded-xl border-2 border-dashed border-surface-700 hover:border-primary-500 flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden shrink-0">
            {form.image_url ? <img src={form.image_url} alt="" className="w-full h-full object-cover" /> : <><ImagePlus size={24} className="text-surface-500 mb-1" /><span className="text-xs text-surface-500">{uploading ? '업로드 중...' : '클릭하여 추가'}</span></>}
          </div>
          <div className="flex-1 space-y-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-white rounded-xl text-sm transition-colors disabled:opacity-50">
              <ImagePlus size={15} /> {uploading ? '업로드 중...' : '이미지 선택'}
            </button>
            {form.image_url && <button onClick={() => setForm(p => ({ ...p, image_url: '' }))} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm transition-colors"><X size={14} /> 이미지 제거</button>}
            <p className="text-xs text-surface-500">JPG, PNG, WEBP · 최대 5MB</p>
            <input value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="또는 이미지 URL 직접 입력"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          </div>
        </div>
      </div>

      {/* 3. 기본 정보 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><span className="w-6 h-6 bg-primary-500/20 text-primary-400 rounded-lg flex items-center justify-center text-xs font-bold">3</span>기본 정보</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="상품명" required><Input value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="상품명 입력" /></Field>
          <Field label="상품코드"><Input value={form.code} onChange={v => setForm(p => ({ ...p, code: v }))} placeholder="예: SKU-001" /></Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
          <Field label="순서"><Input type="number" value={String(form.sort_order)} onChange={v => setForm(p => ({ ...p, sort_order: v }))} placeholder="0" /></Field>
          <Field label="원가"><Input type="number" value={String(form.cost_price)} onChange={v => setForm(p => ({ ...p, cost_price: v }))} placeholder="0" /></Field>
          <Field label="판매가"><Input type="number" value={String(form.sale_price)} onChange={v => setForm(p => ({ ...p, sale_price: v }))} placeholder="0" /></Field>
          <Field label="마진"><Input type="number" value={String(form.margin)} onChange={v => setForm(p => ({ ...p, margin: v }))} placeholder="0" /></Field>
          <Field label="저장위치"><Input value={form.storage_location_text} onChange={v => setForm(p => ({ ...p, storage_location_text: v }))} placeholder="예: A-1구역" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="공장 (선택사항)"><Input value={form.factory} onChange={v => setForm(p => ({ ...p, factory: v }))} placeholder="공장명 입력" /></Field>
          <Field label="비고"><Input value={form.note} onChange={v => setForm(p => ({ ...p, note: v }))} placeholder="메모" /></Field>
        </div>
      </div>

      {/* 4. 옵션 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><span className="w-6 h-6 bg-primary-500/20 text-primary-400 rounded-lg flex items-center justify-center text-xs font-bold">4</span>옵션 설정</h2>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm text-surface-400">옵션 수:</span>
          {[1, 2].map(n => (
            <button key={n} onClick={() => { setForm(p => ({ ...p, option_count: n })); setOptionsApplied(false); setSkuRows([]) }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${form.option_count === n ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>{n}개</button>
          ))}
        </div>
        <div className="space-y-3 mb-4">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">옵션 1</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="옵션명" required><Input value={opt1Name} onChange={setOpt1Name} placeholder="예: 모델명" /></Field>
            <Field label="옵션값 (쉼표로 구분)" required><Input value={opt1Values} onChange={setOpt1Values} placeholder="예: iphone11,iphone12" /></Field>
          </div>
          {opt1Values && <div className="flex flex-wrap gap-1.5">{opt1Values.split(',').filter(s=>s.trim()).map((v,i)=><span key={i} className="px-2.5 py-1 bg-primary-500/15 text-primary-300 rounded-lg text-xs">{v.trim()}</span>)}</div>}
        </div>
        {form.option_count === 2 && (
          <div className="space-y-3 mb-4 pt-4 border-t border-surface-800">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">옵션 2</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="옵션명" required><Input value={opt2Name} onChange={setOpt2Name} placeholder="예: 색상" /></Field>
              <Field label="옵션값 (쉼표로 구분)" required><Input value={opt2Values} onChange={setOpt2Values} placeholder="예: 레드,블랙,화이트" /></Field>
            </div>
            {opt2Values && <div className="flex flex-wrap gap-1.5">{opt2Values.split(',').filter(s=>s.trim()).map((v,i)=><span key={i} className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 rounded-lg text-xs">{v.trim()}</span>)}</div>}
          </div>
        )}
        <button onClick={applyOptions} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"><Zap size={15} /> 옵션 적용</button>
      </div>

      {/* 5. 재고 설정 */}
      {optionsApplied && skuRows.length > 0 && (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><span className="w-6 h-6 bg-primary-500/20 text-primary-400 rounded-lg flex items-center justify-center text-xs font-bold">5</span>재고 설정 <span className="text-sm font-normal text-surface-400">({skuRows.length}개)</span></h2>
            <button onClick={() => setShowBulk(!showBulk)} className="flex items-center gap-2 px-3 py-2 bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-white rounded-xl text-xs font-medium transition-colors"><Zap size={13} /> 재고 일괄설정</button>
          </div>
          {showBulk && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-surface-800 rounded-xl border border-primary-500/30 animate-slide-up">
              <span className="text-sm text-surface-300">일괄 재고:</span>
              <input type="number" min="0" value={bulkStock} onChange={e => setBulkStock(e.target.value.replace(/[^0-9]/g,''))} placeholder="정수 입력"
                className="w-28 bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 text-center" />
              <button onClick={applyBulkStock} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">저장</button>
              <button onClick={() => setShowBulk(false)} className="px-3 py-2 bg-surface-700 text-surface-400 rounded-lg text-sm">취소</button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-surface-800">
            <table className="w-full">
              <thead><tr className="bg-surface-800/50 border-b border-surface-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">{opt1Name}</th>
                {form.option_count === 2 && <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase">{opt2Name}</th>}
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase">재고</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-surface-400 uppercase">삭제</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-800">
                {skuRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-surface-200">{row.opt1Val}</td>
                    {form.option_count === 2 && <td className="px-4 py-3 text-sm text-surface-200">{row.opt2Val}</td>}
                    <td className="px-4 py-3"><input type="number" min="0" value={row.stock} onChange={e => { const v=parseInt(e.target.value.replace(/[^0-9]/g,''))||0; setSkuRows(p=>p.map((r,i)=>i===idx?{...r,stock:v}:r)) }} className="w-24 mx-auto block bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-primary-500" /></td>
                    <td className="px-4 py-3 text-center"><button onClick={() => setSkuRows(p=>p.filter((_,i)=>i!==idx))} className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 저장 버튼 - 맨 아래 */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold text-base transition-colors">
          <Save size={18} /> {saving ? '저장 중...' : isEdit ? '수정 저장' : '상품 저장'}
        </button>
      </div>
    </div>
  )
}
