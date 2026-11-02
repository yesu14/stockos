// ═══════════════════════════════════════════════════════════
//  상품찾기 — Supabase 데이터 접근 (클라이언트를 주입받는 형태)
//  앱에서는 whApi.js 가 앱의 클라이언트를 넣어서 쓰고,
//  검증 도구(scripts/verify-supabase.mjs)는 시험용 클라이언트를 넣어서 같은 코드를 그대로 시험한다.
// ═══════════════════════════════════════════════════════════
import { itemKey, normNumber } from './whLogic'

const PAGE = 1000          // Supabase 는 한 번에 최대 1000행만 돌려줌 → 나눠서 읽기

export class WhError extends Error {
  constructor(code, message, raw) { super(message); this.name = 'WhError'; this.code = code; this.raw = raw }
}

/** DB 오류 → 사용자가 이해할 수 있는 오류 */
export function friendly(error) {
  const msg = String(error?.message || '')
  const code = error?.code
  if (code === 'PGRST205' || code === '42P01' || /could not find the table|relation .* does not exist/i.test(msg)) return new WhError('NO_TABLE', '상품찾기용 DB 테이블이 아직 없어요')
  if (code === '23505') {
    if (/wh_boxes_number_uniq/.test(msg)) return new WhError('DUP_NUMBER', '이미 사용 중인 박스 번호예요')
    if (/wh_boxes_pos_uniq/.test(msg)) return new WhError('DUP_POS', '그 자리에는 이미 박스가 있어요 (다른 기기에서 먼저 추가했을 수 있어요)')
    if (/wh_warehouse_single/.test(msg)) return new WhError('DUP_WAREHOUSE', '창고는 하나만 만들 수 있어요')
    if (/wh_zones_color_uniq/.test(msg)) return new WhError('DUP_COLOR', '다른 구역이 이미 쓰는 색이에요. 구역마다 색이 달라야 해요')
    return new WhError('DUP', '이미 같은 값이 있어요')
  }
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return new WhError('DENIED', '수정 권한이 없어요 (관리자/매니저만 수정할 수 있어요)')
  if (code === 'PGRST116') return new WhError('GONE', '대상을 찾지 못했어요 (이미 삭제됐거나 수정 권한이 없어요)')
  return new WhError('DB', msg || '저장하지 못했어요', error)
}


export function createWhApi(supabase) {
  async function run(promise) {
    const { data, error } = await promise
    if (error) throw friendly(error)
    return data
  }
  async function fetchAll(table) {
    const out = []
    for (let from = 0; ; from += PAGE) {
      const rows = await run(supabase.from(table).select('*').order('id').range(from, from + PAGE - 1))
      out.push(...(rows || []))
      if (!rows || rows.length < PAGE) break
    }
    return out
  }
  /** ids 를 조금씩 나눠 .in() 으로 읽기 (주소가 너무 길어지거나 1000행을 넘지 않도록) */
  async function fetchIn(table, col, ids, chunk = 15) {
    const out = []
    for (let i = 0; i < ids.length; i += chunk) {
      const part = ids.slice(i, i + chunk)
      for (let from = 0; ; from += PAGE) {
        const rows = await run(supabase.from(table).select('*').in(col, part).order('id').range(from, from + PAGE - 1))
        out.push(...(rows || []))
        if (!rows || rows.length < PAGE) break
      }
    }
    return out
  }
  /** 삭제: 권한이 없으면 오류 없이 0행이 지워지므로 직접 확인 */
  async function removeOne(table, id) {
    const rows = await run(supabase.from(table).delete().eq('id', id).select('id'))
    if (!rows?.length) throw new WhError('GONE', '삭제하지 못했어요 (이미 삭제됐거나 수정 권한이 없어요)')
  }

  // ── 전체 불러오기 ───────────────────────────────────────────
  async function loadAll() {
    const whRows = await run(supabase.from('wh_warehouse').select('*').limit(1))
    const warehouse = whRows?.[0] || null
    if (!warehouse) return { warehouse: null, fixtures: [], zones: [], lines: [], boxes: [], items: [] }
    const [fixtures, zones, lines, boxes, items] = await Promise.all([
      fetchAll('wh_fixtures'), fetchAll('wh_zones'), fetchAll('wh_lines'), fetchAll('wh_boxes'), fetchAll('wh_box_items'),
    ])
    return { warehouse, fixtures, zones, lines, boxes, items }
  }

  // ── 창고 / 시설물 ───────────────────────────────────────────
  const createWarehouse = v => run(supabase.from('wh_warehouse').insert(v).select().single())
  const updateWarehouse = (id, patch) => run(supabase.from('wh_warehouse').update(patch).eq('id', id).select().single())
  const deleteWarehouse = id => removeOne('wh_warehouse', id)
  const addFixture = v => run(supabase.from('wh_fixtures').insert(v).select().single())
  const patchFixture = (id, patch) => run(supabase.from('wh_fixtures').update(patch).eq('id', id).select().single())
  const removeFixture = id => removeOne('wh_fixtures', id)

  // ── 구역 / 줄 ───────────────────────────────────────────────
  async function createZone(v, lineCount, slotCount) {
    const zone = await run(supabase.from('wh_zones').insert(v).select().single())
    const rows = Array.from({ length: lineCount }, (_, i) => ({ zone_id: zone.id, position: i, slot_count: slotCount }))
    try {
      const lines = await run(supabase.from('wh_lines').insert(rows).select())
      return { zone, lines }
    } catch (e) {                                   // 줄 저장에 실패하면 반쪽짜리 구역이 남지 않게 되돌림
      await supabase.from('wh_zones').delete().eq('id', zone.id)
      throw e
    }
  }
  const patchZone = (id, patch) => run(supabase.from('wh_zones').update(patch).eq('id', id).select().single())
  const removeZone = id => removeOne('wh_zones', id)
  const trimTiers = (zoneId, tiers) => run(supabase.from('wh_boxes').delete().eq('zone_id', zoneId).gt('tier', tiers))
  const addLine = v => run(supabase.from('wh_lines').insert(v).select().single())
  const patchLine = (id, patch) => run(supabase.from('wh_lines').update(patch).eq('id', id).select().single())
  const trimLine = (lineId, slots) => run(supabase.from('wh_boxes').delete().eq('line_id', lineId).gt('slot_no', slots))
  const removeLine = id => removeOne('wh_lines', id)

  // ── 박스 / 박스 안 상품 ──────────────────────────────────────
  const addBox = v => run(supabase.from('wh_boxes').insert(v).select().single())
  const patchBox = (id, patch) => run(supabase.from('wh_boxes').update(patch).eq('id', id).select().single())
  /** 이 박스와 그 위에 쌓인 박스를 한 번에 삭제 (공중에 뜬 박스가 생기지 않도록) */
  const removeStack = (lineId, slotNo, fromTier) =>
    run(supabase.from('wh_boxes').delete().eq('line_id', lineId).eq('slot_no', slotNo).gte('tier', fromTier).select('id'))
  const addItemRows = rows => run(supabase.from('wh_box_items').insert(rows).select())
  const patchItem = (id, patch) => run(supabase.from('wh_box_items').update(patch).eq('id', id).select().single())
  const removeItem = id => removeOne('wh_box_items', id)

  // ═══════════════════════════════════════════════════════════
  //  현재 시스템(상품/카테고리/옵션) 읽기
  // ═══════════════════════════════════════════════════════════
  const optLabel = (a, b) => [a, b].filter(Boolean).join(' / ')

  /** 상품 담기 화면용: 카테고리 + 상품 + 옵션(SKU) */
  async function loadCatalog() {
    const [cats, prods, skus, opts] = await Promise.all([
      fetchAll('categories'), fetchAll('products'), fetchAll('product_skus'), fetchAll('product_options'),
    ])
    const optById = new Map(opts.map(o => [o.id, o]))
    const skusByProduct = new Map()
    for (const s of skus) {
      if (s.is_active === false) continue
      if (!skusByProduct.has(s.product_id)) skusByProduct.set(s.product_id, [])
      skusByProduct.get(s.product_id).push(s)
    }
    const products = prods.filter(p => p.is_active !== false).map(p => {
      const list = (skusByProduct.get(p.id) || []).map(s => {
        const o1 = optById.get(s.option1_id), o2 = optById.get(s.option2_id)
        return {
          id: s.id, product_id: p.id, stock: s.stock ?? 0, image_url: s.image_url || null,
          opt1: o1?.option_value || '', opt2: o2?.option_value || '',
          label: optLabel(o1?.option_value, o2?.option_value) || '기본',
          sort: [o1?.sort_order ?? 0, o2?.sort_order ?? 0],
        }
      }).sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1])
      return { id: p.id, name: p.name, category_id: p.category_id, image_url: p.image_url || null, skus: list }
    }).filter(p => p.skus.length)
    const categories = cats.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name), 'ko'))
    return { categories, products }
  }

  /**
   * 박스에 담긴 상품들의 "지금" 정보. 상품을 수정하면 옵션(SKU)이 다시 만들어져 id 가 바뀌므로
   * id 가 아니라 (상품, 옵션값) 으로 찾는다. 못 찾으면 삭제된 상품으로 본다.
   * 반환: Map(itemKey → {name,label,image_url,stock,sku_id})
   */
  async function fetchLive(productIds) {
    const ids = [...new Set((productIds || []).filter(Boolean))]
    const map = new Map()
    if (!ids.length) return map
    const [prods, skus, opts] = await Promise.all([
      fetchIn('products', 'id', ids), fetchIn('product_skus', 'product_id', ids), fetchIn('product_options', 'product_id', ids),
    ])
    const prodById = new Map(prods.filter(p => p.is_active !== false).map(p => [p.id, p]))
    const optById = new Map(opts.map(o => [o.id, o]))
    for (const s of skus) {
      const p = prodById.get(s.product_id)
      if (!p || s.is_active === false) continue
      const o1 = optById.get(s.option1_id)?.option_value || '', o2 = optById.get(s.option2_id)?.option_value || ''
      map.set(itemKey({ product_id: s.product_id, opt1: o1, opt2: o2 }), {
        name: p.name, label: optLabel(o1, o2) || '기본', image_url: s.image_url || null, stock: s.stock ?? 0, sku_id: s.id,
      })
    }
    return map
  }

  /** 선택한 옵션 → 박스 안 상품 행 (이름/옵션/이미지를 함께 저장해 두면 나중에 상품이 바뀌어도 표시 가능) */
  function itemRow(boxId, entry) {
    return {
      box_id: boxId, product_sku_id: entry.sku.id, product_id: entry.sku.product_id,
      product_name: entry.productName, option_label: entry.sku.label,
      opt1: normNumber(entry.sku.opt1), opt2: normNumber(entry.sku.opt2),
      image_url: entry.sku.image_url || null, quantity: entry.qty,
    }
  }

  /** 지금 재고(시스템)와, 이미 박스에 담긴 수량을 새로 읽어서 알려줌.  keys: [{product_id, opt1, opt2}] → Map(itemKey → {stock, placed, name, label}) */
  async function fetchAvailability(keys) {
    const ids = [...new Set((keys || []).map(k => k.product_id).filter(Boolean))]
    const out = new Map()
    const [live, rows] = ids.length ? await Promise.all([fetchLive(ids), fetchIn('wh_box_items', 'product_id', ids)]) : [new Map(), []]
    const placed = new Map()
    for (const r of rows) { const k = itemKey(r); placed.set(k, (placed.get(k) || 0) + (r.quantity || 0)) }
    for (const k of keys || []) {
      const key = itemKey(k), lv = live.get(key)
      out.set(key, { stock: lv ? lv.stock : null, placed: placed.get(key) || 0, name: lv?.name, label: lv?.label })
    }
    return out
  }

  return {
    loadAll, createWarehouse, updateWarehouse, deleteWarehouse, addFixture, patchFixture, removeFixture,
    createZone, patchZone, removeZone, trimTiers, addLine, patchLine, trimLine, removeLine,
    addBox, patchBox, removeStack, addItemRows, patchItem, removeItem, loadCatalog, fetchLive, itemRow, fetchAvailability
  }
}
