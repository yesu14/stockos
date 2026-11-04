// ═══════════════════════════════════════════════════════════
//  상품찾기 — 동작(액션): 규칙 검사 → 저장 → 화면 상태 반영
//  api / dispatch / ask(확인창) / notify(알림) 를 주입받아서 화면 없이도 테스트 가능
// ═══════════════════════════════════════════════════════════
import {
  LIMITS, buildModel, checkZoneRect, REASON_TEXT, round2, normNumber, findBoxByNumber,
  nextBoxNumber, stackAt, locationText, boxesAbove, boxesLostBy, itemKey, checkOfficeSpot, planBoxMove, stackRepairs, planPlace, planUndo,
  checkWarehouseRect, officeInside, snap,
} from './whLogic'

const soft = msg => Object.assign(new Error(msg), { soft: true })     // 입력 오류: 다시 불러올 필요 없음
const inRange = (v, [a, b]) => Number.isFinite(v) && v >= a && v <= b

export function makeActions({ api, getRaw, dispatch, ask, notify }) {
  const model = () => buildModel(getRaw())

  async function reload() { dispatch({ type: 'load', raw: await api.loadAll() }) }

  /** 모든 동작을 감싸서: 실패하면 알려주고, 서버와 어긋났을 수 있으니 다시 불러오기 */
  async function guard(fn) {
    try { return (await fn()) ?? true } catch (e) {
      notify.error(e?.message || '저장하지 못했어요')
      if (!e?.soft && e?.code !== 'DUP_NUMBER') { try { await reload() } catch { /* 네트워크 문제면 그대로 */ } }
      return undefined
    }
  }
  /** 박스에 담을 수량이 현재 재고를 넘지 않는지: 재고와 "이미 박스에 있는 수량"을 서버에서 새로 읽어서 확인 */
  async function checkStockRoom(want) {
    const avail = await api.fetchAvailability([...want.values()].map(w => w.key))
    const bad = []
    for (const [k, w] of want) {
      const a = avail.get(k) || { stock: null, placed: 0 }
      const label = `${w.name}${w.label ? ` (${w.label})` : ''}`
      if (a.stock == null) { bad.push(`「${label}」 상품 정보를 찾을 수 없어요`); continue }
      const room = a.stock - a.placed
      if (a.stock <= 0) { bad.push(`「${label}」 현재 재고가 ${a.stock}개라서 담을 수 없어요`); continue }
      if (w.qty > room) bad.push(room <= 0
        ? `「${label}」 재고 ${a.stock}개가 이미 모두(${a.placed}개) 박스에 있어요`
        : `「${label}」 재고 ${a.stock}개 중 ${a.placed}개가 이미 박스에 있어서 ${room}개까지만 담을 수 있어요 (입력 ${w.qty}개)`)
    }
    if (bad.length) throw Object.assign(new Error('재고보다 많이 담을 수 없어요 — ' + bad.slice(0, 3).join(' / ') + (bad.length > 3 ? ` …외 ${bad.length - 3}개` : '')), { code: 'STOCK_LIMIT' })
  }
  const needWh = () => { const w = getRaw().warehouse; if (!w) throw soft('먼저 창고를 그려주세요'); return w }

  // ── 창고 ──
  const createWarehouse = rect => guard(async () => {
    if (getRaw().warehouse) throw soft('창고는 하나만 만들 수 있어요')
    const width = round2(snap(rect.w)), height = round2(snap(rect.h))       // 0.5m 단위로 자유롭게
    if (width < LIMITS.whMin[0] || height < LIMITS.whMin[1]) throw soft(REASON_TEXT['wh-small'])
    if (width > LIMITS.whMax[0] || height > LIMITS.whMax[1]) throw soft(REASON_TEXT['wh-big'])
    dispatch({ type: 'wh/set', row: await api.createWarehouse({ name: '내 창고', width, height }) })
    notify.success('창고를 만들었어요 🏭')
  })
  const updateWarehouse = patch => guard(async () => {
    const wh = needWh(), m = model()
    const width = patch.width ?? wh.width, height = patch.height ?? wh.height
    if (!inRange(width, [LIMITS.whMin[0], LIMITS.whMax[0]]) || !inRange(height, [LIMITS.whMin[1], LIMITS.whMax[1]])) throw soft('창고 크기가 올바르지 않아요')
    for (const z of m.zones) if (z.x + z.w > width + 1e-6 || z.y + z.h > height + 1e-6) throw soft(`${z.name}이(가) 창고 밖으로 나가요. 먼저 구역을 옮기거나 줄여주세요`)
    const row = await api.updateWarehouse(wh.id, { ...patch, width, height })
    dispatch({ type: 'wh/set', row })
    for (const f of m.fixtures) if (f.kind === 'office') {                                       // 사무실이 밖으로 나가면 안쪽으로
      const p = officeInside(f, width, height)
      if (Math.abs(p.x - f.x) > 1e-6 || Math.abs(p.y - f.y) > 1e-6) dispatch({ type: 'fx/patch', row: await api.patchFixture(f.id, p) })
    }
  })
  /** 가장자리/모서리를 끌어서 창고 크기를 바꿈. 왼쪽/위를 옮겼다면 구역과 사무실도 같이 옮겨서 제자리에 있게 함 */
  const resizeWarehouse = rect => guard(async () => {
    const wh = needWh(), m = model(), chk = checkWarehouseRect(m, rect)
    if (!chk.ok) throw soft(chk.reason === 'zone-out' ? `${chk.zone}이(가) 창고 밖으로 나가요. 먼저 구역을 옮기거나 줄여주세요` : REASON_TEXT[chk.reason])
    dispatch({ type: 'wh/set', row: await api.updateWarehouse(wh.id, { width: chk.width, height: chk.height }) })
    if (Math.abs(chk.dx) > 1e-9 || Math.abs(chk.dy) > 1e-9) {
      for (const z of m.zones) dispatch({ type: 'zone/patch', row: await api.patchZone(z.id, { x: round2(z.x + chk.dx), y: round2(z.y + chk.dy) }) })
    }
    for (const f of m.fixtures) if (f.kind === 'office') {
      const p = officeInside(f, chk.width, chk.height, chk.dx, chk.dy)
      if (Math.abs(p.x - f.x) > 1e-6 || Math.abs(p.y - f.y) > 1e-6) dispatch({ type: 'fx/patch', row: await api.patchFixture(f.id, p) })
    }
    notify.success(`창고 크기를 바꿨어요 (가로 ${chk.width}m × 세로 ${chk.height}m)`)
  })
  const deleteWarehouse = () => guard(async () => {
    const wh = needWh(), m = model()
    const ok = await ask({
      title: '창고를 삭제할까요?', danger: true, confirmText: '모두 삭제',
      body: `구역 ${m.zones.length}개, 박스 ${m.boxes.length}개와 담긴 상품 정보가 모두 사라져요. 되돌릴 수 없어요.`,
    })
    if (!ok) return false
    await api.deleteWarehouse(wh.id); dispatch({ type: 'wh/clear' }); notify.success('창고를 삭제했어요')
  })

  // ── 시설물 ──
  const addFixture = f => guard(async () => {
    const wh = needWh()
    if (f.kind === 'office') { const c = checkOfficeSpot({ x: f.x, y: f.y }, model()); if (!c.ok) throw soft(REASON_TEXT[c.reason]) }
    const row = await api.addFixture({ warehouse_id: wh.id, kind: f.kind, wall: f.wall ?? null, pos: f.pos ?? null, x: f.x ?? null, y: f.y ?? null })
    dispatch({ type: 'fx/add', row })
  })
  const moveFixture = (id, patch) => guard(async () => {
    const fx = model().fixtures.find(x => x.id === id)
    if (fx?.kind === 'office' && ('x' in patch || 'y' in patch)) { const c = checkOfficeSpot({ x: patch.x ?? fx.x, y: patch.y ?? fx.y }, model(), id); if (!c.ok) throw soft(REASON_TEXT[c.reason]) }
    dispatch({ type: 'fx/patch', row: await api.patchFixture(id, patch) })
  })
  const removeFixture = id => guard(async () => { await api.removeFixture(id); dispatch({ type: 'fx/remove', id }) })

  // ── 구역 ──
  function validateZoneForm(f, m, exceptId) {
    const name = String(f.name || '').trim()
    if (!name) throw soft('구역 이름을 입력해주세요')
    if (!inRange(f.slotCount, LIMITS.slots)) throw soft(`가로 박스 수는 ${LIMITS.slots[0]}~${LIMITS.slots[1]} 사이여야 해요`)
    if (!inRange(f.lineCount, LIMITS.lines)) throw soft(`세로 박스 수(줄 수)는 ${LIMITS.lines[0]}~${LIMITS.lines[1]} 사이여야 해요`)
    if (!inRange(f.tiers, LIMITS.tiers)) throw soft(`박스 층수는 ${LIMITS.tiers[0]}~${LIMITS.tiers[1]} 사이여야 해요`)
    const dup = m.zones.find(z => z.id !== exceptId && String(z.color).toLowerCase() === String(f.color).toLowerCase())
    if (dup) throw soft(`${dup.name}에서 이미 쓰는 색이에요. 구역마다 색이 달라야 해요`)
    return name
  }
  const createZone = f => guard(async () => {
    const wh = needWh(), m = model()
    const name = validateZoneForm(f, m)
    const rect = { x: round2(f.rect.x), y: round2(f.rect.y), w: round2(f.rect.w), h: round2(f.rect.h) }
    const chk = checkZoneRect(rect, m); if (!chk.ok) throw soft(REASON_TEXT[chk.reason])
    const { zone, lines } = await api.createZone({ warehouse_id: wh.id, name, color: f.color, ...rect, tiers: f.tiers }, f.lineCount, f.slotCount)
    dispatch({ type: 'zone/add', zone, lines })
    notify.success(`${name}을(를) 만들었어요`)
    return zone
  })
  const moveZone = (id, rect) => guard(async () => {
    const m = model(), r = { x: round2(rect.x), y: round2(rect.y), w: round2(rect.w), h: round2(rect.h) }
    const chk = checkZoneRect(r, m, id); if (!chk.ok) throw soft(REASON_TEXT[chk.reason])
    dispatch({ type: 'zone/patch', row: await api.patchZone(id, r) })
  })
  /** 구역 설정 바꾸기. 줄이면서 박스가 사라지는 경우에는 먼저 물어봄 */
  const updateZone = (id, f) => guard(async () => {
    const m = model(), zone = m.zonesById.get(id); if (!zone) throw soft('구역을 찾을 수 없어요')
    const name = validateZoneForm(f, m, id)
    const lost = boxesLostBy(zone, { tiers: f.tiers < zone.tiers ? f.tiers : null, lineCount: f.lineCount < zone.lines.length ? f.lineCount : null, slotCount: f.applySlots ? f.slotCount : null })
    if (lost.length) {
      const ok = await ask({ title: '줄이면 박스가 사라져요', danger: true, confirmText: '삭제하고 줄이기', body: `설정을 줄이면 범위를 벗어나는 박스 ${lost.length}개와 담긴 상품 정보가 함께 삭제돼요. 계속할까요?` })
      if (!ok) return false
    }
    dispatch({ type: 'zone/patch', row: await api.patchZone(id, { name, color: f.color, tiers: f.tiers }) })
    if (f.tiers < zone.tiers) { await api.trimTiers(id, f.tiers); dispatch({ type: 'zone/trimTiers', zoneId: id, tiers: f.tiers }) }
    const cur = zone.lines
    if (f.lineCount < cur.length) for (const ln of cur.slice(f.lineCount)) { await api.removeLine(ln.id); dispatch({ type: 'line/remove', id: ln.id }) }
    if (f.lineCount > cur.length) {
      let pos = Math.max(-1, ...cur.map(l => l.position))
      for (let i = cur.length; i < f.lineCount; i++) dispatch({ type: 'line/add', row: await api.addLine({ zone_id: id, position: ++pos, slot_count: f.slotCount }) })
    }
    if (f.applySlots) for (const ln of cur.slice(0, Math.min(cur.length, f.lineCount))) if (ln.slot_count !== f.slotCount) {
      if (f.slotCount < ln.slot_count) { await api.trimLine(ln.id, f.slotCount); dispatch({ type: 'line/trim', lineId: ln.id, slots: f.slotCount }) }
      dispatch({ type: 'line/patch', row: await api.patchLine(ln.id, { slot_count: f.slotCount }) })
    }
  })
  const deleteZone = id => guard(async () => {
    const zone = model().zonesById.get(id); if (!zone) return false
    const ok = await ask({
      title: `${zone.name}을(를) 삭제할까요?`, danger: true, confirmText: zone.boxCount ? '박스까지 모두 삭제' : '삭제',
      body: zone.boxCount ? `이 구역에 박스가 ${zone.boxCount}개 있어요. 안에 있는 박스도 다 삭제하실래요? 담긴 상품 정보도 함께 사라져요.` : '이 구역을 삭제해요.',
    })
    if (!ok) return false
    await api.removeZone(id); dispatch({ type: 'zone/remove', id }); notify.success('구역을 삭제했어요')
  })

  // ── 줄 ──
  const addLine = zoneId => guard(async () => {
    const zone = model().zonesById.get(zoneId); if (!zone) throw soft('구역을 찾을 수 없어요')
    if (zone.lines.length >= LIMITS.lines[1]) throw soft(`줄은 최대 ${LIMITS.lines[1]}개까지예요`)
    const pos = Math.max(-1, ...zone.lines.map(l => l.position)) + 1
    const slots = zone.lines.length ? zone.lines[zone.lines.length - 1].slot_count : 5
    dispatch({ type: 'line/add', row: await api.addLine({ zone_id: zoneId, position: pos, slot_count: slots }) })
  })
  const setLineSlots = (lineId, n) => guard(async () => {
    const line = model().linesById.get(lineId); if (!line) throw soft('줄을 찾을 수 없어요')
    if (!inRange(n, LIMITS.slots)) throw soft(`한 줄에는 ${LIMITS.slots[0]}~${LIMITS.slots[1]}개까지 놓을 수 있어요`)
    if (n < line.slot_count) {
      let lost = 0; for (const [slot, st] of line.stacks) if (slot > n) lost += st.length
      if (lost) {
        const ok = await ask({ title: '칸을 줄이면 박스가 사라져요', danger: true, confirmText: '삭제하고 줄이기', body: `${n + 1}번째 칸부터의 박스 ${lost}개와 담긴 상품 정보가 함께 삭제돼요. 계속할까요?` })
        if (!ok) return false
      }
      await api.trimLine(lineId, n); dispatch({ type: 'line/trim', lineId, slots: n })
    }
    dispatch({ type: 'line/patch', row: await api.patchLine(lineId, { slot_count: n }) })
  })
  const deleteLine = lineId => guard(async () => {
    const m = model(), line = m.linesById.get(lineId); if (!line) return false
    const zone = [...m.zones].find(z => z.id === line.zone_id)
    if (zone.lines.length <= 1) throw soft('줄은 최소 1개는 있어야 해요')
    const n = [...line.stacks.values()].reduce((s, st) => s + st.length, 0)
    const ok = await ask({
      title: `${line.no}번째 줄을 삭제할까요?`, danger: true, confirmText: n ? '박스까지 삭제' : '삭제',
      body: n ? `이 줄에 박스가 ${n}개 있어요. 함께 삭제돼요.` : '이 줄을 삭제해요.',
    })
    if (!ok) return false
    await api.removeLine(lineId); dispatch({ type: 'line/remove', id: lineId })
  })

  // ── 박스 ──
  const addBox = (zoneId, lineId, slot, numberInput) => guard(async () => {
    const m = model(), zone = m.zonesById.get(zoneId), line = m.linesById.get(lineId)
    if (!zone || !line) throw soft('자리를 찾을 수 없어요')
    if (slot < 1 || slot > line.slot_count) throw soft('그 칸은 없어요')
    const stack = stackAt(line, slot), tier = stack.length + 1          // 아래층이 있어야만 위층에 놓을 수 있음
    if (tier > zone.tiers) throw soft(`${zone.name}은(는) 최대 ${zone.tiers}층까지예요`)
    const number = normNumber(numberInput) || nextBoxNumber(m.boxes)
    if (number.length > 24) throw soft('박스 번호는 24자까지예요')
    const dup = findBoxByNumber(m.boxes, number)
    if (dup) throw soft(`${number}번은 이미 ${locationText(dup)} 박스에서 쓰고 있어요. 박스 번호는 창고 전체에서 하나뿐이에요`)
    const row = await api.addBox({ zone_id: zoneId, line_id: lineId, slot_no: slot, tier, box_number: number })
    dispatch({ type: 'box/add', row })
    return row
  })
  const renameBox = (id, numberInput) => guard(async () => {
    const m = model(), box = m.boxesById.get(id); if (!box) throw soft('박스를 찾을 수 없어요')
    const number = normNumber(numberInput)
    if (!number) throw soft('박스 번호를 입력해주세요')
    if (number.length > 24) throw soft('박스 번호는 24자까지예요')
    const dup = findBoxByNumber(m.boxes, number, id)
    if (dup) throw soft(`${number}번은 이미 ${locationText(dup)} 박스에서 쓰고 있어요`)
    dispatch({ type: 'box/patch', row: await api.patchBox(id, { box_number: number }) })
  })
  const deleteBox = id => guard(async () => {
    const m = model(), box = m.boxesById.get(id); if (!box) return false
    const above = boxesAbove(m, box)
    const ok = await ask({
      title: `박스 ${box.box_number}을(를) 삭제할까요?`, danger: true, confirmText: above.length ? '위 박스까지 삭제' : '삭제',
      body: (above.length ? `위에 쌓인 박스 ${above.length}개(${above.map(b => b.box_number).join(', ')})도 함께 삭제돼요 (공중에 뜰 수 없으니까요). ` : '') + (box.itemCount || above.some(b => b.itemCount) ? '담긴 상품 정보도 함께 사라져요.' : ''),
    })
    if (!ok) return false
    await api.removeStack(box.line_id, box.slot_no, box.tier)
    dispatch({ type: 'box/removeStack', lineId: box.line_id, slotNo: box.slot_no, fromTier: box.tier })
    notify.success('박스를 삭제했어요')
  })

  /** 박스를 다른 칸/줄/구역으로 옮김 (옮긴 자리 맨 위, 원래 자리 위 박스는 한 층씩 내려앉음). 담긴 상품과 번호는 그대로 */
  const moveBox = (boxId, target) => guard(async () => {
    const plan = planBoxMove(model(), boxId, target)
    if (!plan.ok) throw soft(plan.text)
    for (const st of plan.steps) dispatch({ type: 'box/patch', row: await api.patchBox(st.id, st.patch) })     // 겹치지 않는 순서로 하나씩
    notify.success(`박스를 옮겼어요 → ${plan.target.zoneName} ${plan.target.lineNo}번째 줄 ${plan.target.slot}번째 칸 ${plan.toTier}층`)
    return plan
  })
  /** 박스를 정확한 자리에 놓기 (끼워 넣기 'insert' / 서로 바꾸기 'swap'). 성공하면 계획(plan)을 돌려줌 — plan.undo 로 되돌릴 수 있음 */
  const runPlan = async plan => {
    try { for (const st of plan.steps) dispatch({ type: 'box/patch', row: await api.patchBox(st.id, st.patch) }) }          // 겹치지 않는 순서로 하나씩
    catch (e) {                                                                                                          // 중간에 끊기면 서버 상태를 다시 읽고, 층 빈틈/임시 층을 붙여서 정리
      try { await reload(); for (const f of stackRepairs(getRaw())) dispatch({ type: 'box/patch', row: await api.patchBox(f.id, { tier: f.tier }) }) } catch { /* 네트워크 문제면 그대로 */ }
      throw e
    }
  }
  const placeBox = (boxId, target, mode = 'insert') => guard(async () => {
    const plan = planPlace(model(), boxId, target, mode)
    if (!plan.ok) throw soft(plan.text)
    await runPlan(plan); notify.success(plan.done); return plan
  })
  const swapBoxes = (aId, bId) => guard(async () => {
    const b = model().boxesById.get(bId); if (!b) throw soft('박스를 찾을 수 없어요')
    const plan = planPlace(model(), aId, { zoneId: b.zone_id, lineId: b.line_id, slot: b.slot_no, tier: b.tier }, 'swap')
    if (!plan.ok) throw soft(plan.text)
    await runPlan(plan); notify.success(plan.done); return plan
  })
  /** 방금 한 위치 변경 되돌리기 */
  const undoPlace = undo => guard(async () => {
    const plan = planUndo(model(), undo)
    if (!plan.ok) throw soft(plan.text)
    await runPlan(plan); notify.success('되돌렸어요'); return { ...plan, undo: null }
  })
  /** 중간에 끊겨서 층에 빈틈이 생겼다면 자동으로 붙여줌 (공중에 뜬 박스 방지) */
  const repairStacks = () => guard(async () => {
    const fixes = stackRepairs(getRaw())
    for (const f of fixes) dispatch({ type: 'box/patch', row: await api.patchBox(f.id, { tier: f.tier }) })
    return fixes.length
  })

  // ── 박스 안 상품 ──
  /** entries: [{ sku:{id,product_id,opt1,opt2,label,image_url}, productName, qty }] — 이미 있는 옵션이면 수량을 더함 */
  const addItems = (boxId, entries) => guard(async () => {
    const m = model(), box = m.boxesById.get(boxId); if (!box) throw soft('박스를 찾을 수 없어요')
    const fresh = []
    const have = new Map(box.items.map(i => [itemKey(i), i]))
    const want = new Map()                                                  // 같은 옵션이 여러 번 들어와도 합쳐서 검사
    for (const e of entries) {
      const qty = Math.floor(Number(e.qty))
      if (!(qty >= 1)) throw soft('수량은 1개 이상이어야 해요')
      const key = { product_id: e.sku.product_id, opt1: e.sku.opt1, opt2: e.sku.opt2 }, kk = itemKey(key)
      const w = want.get(kk) || { key, qty: 0, name: e.productName, label: e.sku.label }
      w.qty += qty; want.set(kk, w)
    }
    await checkStockRoom(want)                                              // 재고보다 많으면 여기서 거절 (아무것도 저장하지 않음)
    for (const e of entries) {
      const qty = Math.floor(Number(e.qty))
      const k = itemKey({ product_id: e.sku.product_id, opt1: e.sku.opt1, opt2: e.sku.opt2 })
      const ex = have.get(k)
      if (ex) { dispatch({ type: 'item/patch', row: await api.patchItem(ex.id, { quantity: ex.quantity + qty }) }); have.set(k, { ...ex, quantity: ex.quantity + qty }) }
      else fresh.push(api.itemRow(boxId, { ...e, qty }))
    }
    if (fresh.length) dispatch({ type: 'items/add', rows: await api.addItemRows(fresh) })
    notify.success(`${entries.length}개 옵션을 박스에 담았어요`)
  })
  const setQty = (itemId, qty) => guard(async () => {
    const q = Math.floor(Number(qty)); if (!(q >= 1)) throw soft('수량은 1개 이상이어야 해요 (빼려면 삭제를 눌러주세요)')
    const item = model().boxes.flatMap(b => b.items).find(i => i.id === itemId)
    if (item && q > item.quantity) {                                        // 늘릴 때만: 늘리는 만큼이 남은 재고 안에 들어야 함
      const key = { product_id: item.product_id, opt1: item.opt1, opt2: item.opt2 }
      await checkStockRoom(new Map([[itemKey(key), { key, qty: q - item.quantity, name: item.name, label: item.label }]]))
    }
    dispatch({ type: 'item/patch', row: await api.patchItem(itemId, { quantity: q }) })
  })
  const removeItem = itemId => guard(async () => { await api.removeItem(itemId); dispatch({ type: 'item/remove', id: itemId }) })

  return {
    reload, createWarehouse, updateWarehouse, resizeWarehouse, deleteWarehouse, addFixture, moveFixture, removeFixture,
    createZone, moveZone, updateZone, deleteZone, addLine, setLineSlots, deleteLine,
    addBox, renameBox, deleteBox, moveBox, placeBox, swapBoxes, undoPlace, repairStacks, addItems, setQty, removeItem,
  }
}
