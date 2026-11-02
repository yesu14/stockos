// ═══════════════════════════════════════════════════════════
//  재고를 "안전하게" 바꾸는 도구 (클라이언트를 주입받는 형태 — 앱은 stock.js 가 앱 클라이언트를 넣어서 사용)
//
//  기존 방식:  재고를 읽고 → 계산하고 → 그 값으로 덮어쓰기      →  그 사이 다른 사람이 판매/입고하면 그 변경이 사라짐
//  이 방식:    "내가 읽은 값 그대로일 때만" 바꾸고, 아니면 다시 읽어서 재시도  →  동시에 작업해도 서로의 변경이 보존됨
// ═══════════════════════════════════════════════════════════

/**
 * 주문을 고칠 때, 이미 재고에 반영된 효과와 고친 내용의 "차이"만 구한다 (순수 함수).
 * before: 고치기 전 주문 항목, after: 고친 뒤 항목.  각 항목 { skuId, qty, effect }
 *   effect:  +1 재고가 늘어남(입고, 일반 반품) / -1 재고가 줄어듦(납품, 판매, 기존상품폐기) / 0 재고 변동 없음(반품상품폐기)
 * 결과: [{ skuId, delta }]  — 같은 상품이 여러 줄이면 합쳐서, 변동이 0 이면 뺀다.
 */
export function netStockChanges(before = [], after = []) {
  const m = new Map()
  const add = (rows, sign) => {
    for (const r of rows || []) {
      const d = sign * (Number(r.effect) || 0) * (Number(r.qty) || 0)
      if (d) m.set(r.skuId, (m.get(r.skuId) || 0) + d)
    }
  }
  add(before, -1)      // 이미 반영된 효과를 되돌리고
  add(after, +1)       // 고친 내용의 효과를 반영
  return [...m].filter(([, d]) => d !== 0).map(([skuId, delta]) => ({ skuId, delta }))
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const stockErr = (code, message, extra) => Object.assign(new Error(message), { code }, extra)

export function createStock(client, { retries = 8, backoff = 25 } = {}) {
  /**
   * 재고를 delta 만큼 바꾼다. 반환 { before, after }.
   *  - 기본: 재고가 모자라 0 아래로 내려가면 거절(STOCK_LOW)
   *  - allowNegative: 마이너스 허용 (기존에 허용하던 흐름용)   - floorZero: 0 아래는 0 으로 (기존 입고 수정 동작)
   */
  async function adjustStock(skuId, delta, { allowNegative = false, floorZero = false } = {}) {
    for (let i = 0; i < retries; i++) {
      const { data: row, error } = await client.from('product_skus').select('stock').eq('id', skuId).single()
      if (error) throw error
      const nullStock = row?.stock == null, before = row?.stock || 0
      let after = before + delta
      if (floorZero) after = Math.max(0, after)
      else if (!allowNegative && after < 0) throw stockErr('STOCK_LOW', `재고가 부족해요 (현재 ${before}개, ${-delta}개 필요)`, { skuId, before })
      const q = client.from('product_skus').update({ stock: after, updated_at: new Date().toISOString() }).eq('id', skuId)
      const { data: upd, error: err2 } = await (nullStock ? q.is('stock', null) : q.eq('stock', before)).select('stock')   // 읽은 값 그대로일 때만
      if (err2) throw err2
      if (upd && upd.length) return { before, after }
      await sleep(backoff * (i + 1))                                                            // 그 사이 다른 사람이 바꿈 → 잠깐 쉬고 다시 읽기
    }
    throw stockErr('STOCK_BUSY', '다른 사용자가 같은 상품의 재고를 동시에 바꾸고 있어요. 잠시 후 다시 시도해주세요', { skuId })
  }

  /** 여러 개를 차례로 바꾸되, 하나라도 실패하면 이미 바꾼 것을 모두 되돌린다. 반환: 입력과 같은 순서의 [{ skuId, delta, before, after }] */
  async function applyStockChanges(changes, opts = {}) {
    const done = []
    try {
      for (const c of changes) { const r = await adjustStock(c.skuId, c.delta, { ...opts, ...(c.opts || {}) }); done.push({ ...c, ...r }) }
      return done
    } catch (e) {
      for (const d of done.reverse()) { try { await adjustStock(d.skuId, -(d.after - d.before), { allowNegative: true }) } catch { e.rollbackFailed = true } }
      throw e
    }
  }

  /** 재고 실사처럼 "이 값으로 맞춰라"는 절대값 입력: 화면에서 본 값(seen) 그대로일 때만 바꾸고, 그 사이 바뀌었으면 알려준다 */
  async function setStockExact(skuId, newStock, seen) {
    const q = client.from('product_skus').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', skuId)
    const { data: upd, error } = await (seen == null ? q.is('stock', null) : q.eq('stock', seen)).select('stock')
    if (error) throw error
    if (upd && upd.length) return { before: seen ?? 0, after: newStock }
    const { data: now } = await client.from('product_skus').select('stock').eq('id', skuId).single()
    throw stockErr('STOCK_CHANGED', `그 사이 다른 곳에서 재고가 바뀌었어요 (화면 ${seen ?? 0}개 → 지금 ${now?.stock ?? 0}개). 새로고침한 뒤 다시 입력해주세요`, { skuId, current: now?.stock ?? 0 })
  }

  return { adjustStock, applyStockChanges, setStockExact }
}
