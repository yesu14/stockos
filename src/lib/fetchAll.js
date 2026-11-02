// ═══════════════════════════════════════════════════════════
//  Supabase 는 한 번에 최대 1000행만 돌려줍니다. 목록이 1000행을 넘으면 나머지가 "조용히" 잘려서
//  상품/옵션 목록, 판매·입고 통계가 틀려집니다. 이 함수는 끝까지 나눠서 읽고, supabase 와 같은
//  모양({ data, error })으로 돌려주므로 기존 코드의 `await supabase.from(...)...` 자리에 그대로 쓸 수 있습니다.
//
//    const { data } = await selectAll(() => supabase.from('products').select('id, name').eq('is_active', true))
//
//  - 첫 페이지가 가득 차면 다음 페이지들을 동시에 가져와서 큰 목록도 빠르게 읽습니다.
//  - 페이지가 겹치거나 빠지지 않도록 id 로 한 번 더 정렬합니다 (tieBreak: null 이면 끔).
// ═══════════════════════════════════════════════════════════
const PAGE = 1000, PARALLEL = 3

export async function selectAll(build, { pageSize = PAGE, tieBreak = 'id', maxPages = 500 } = {}) {
  const page = n => {
    let q = build()
    if (tieBreak) q = q.order(tieBreak, { ascending: true })
    return q.range(n * pageSize, n * pageSize + pageSize - 1)
  }
  const first = await page(0)
  if (first.error) return { data: null, error: first.error }
  const out = [...(first.data || [])]
  if (out.length < pageSize) return { data: out, error: null }          // 대부분의 목록은 여기서 끝 (요청 1번)
  for (let start = 1; start < maxPages; start += PARALLEL) {
    const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => page(start + i)))
    let full = true
    for (const r of batch) {
      if (r.error) return { data: null, error: r.error }
      out.push(...(r.data || []))
      full = full && (r.data || []).length === pageSize
      if ((r.data || []).length < pageSize) break
    }
    if (!full) break
  }
  return { data: out, error: null }
}

/**
 * id 목록이 길면(수백 개) 요청 주소가 너무 길어져 조용히 실패합니다. 목록을 나눠서 동시에 요청하고 합쳐서 돌려줍니다.
 *   const { data } = await selectIn(skuIds, ids => supabase.from('product_skus').select('id, stock').in('id', ids))
 */
export async function selectIn(ids, build, { size = 80 } = {}) {
  const uniq = [...new Set((ids || []).filter(v => v != null))]
  if (!uniq.length) return { data: [], error: null }
  const chunks = []
  for (let i = 0; i < uniq.length; i += size) chunks.push(uniq.slice(i, i + size))
  const parts = await Promise.all(chunks.map(c => selectAll(() => build(c))))
  const bad = parts.find(p => p.error)
  return bad ? { data: null, error: bad.error } : { data: parts.flatMap(p => p.data || []), error: null }
}
