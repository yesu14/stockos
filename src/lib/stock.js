// 재고를 안전하게 바꾸는 도구 (앱의 Supabase 클라이언트를 연결한 것 — 본체는 stockCore.js)
import { supabase } from './supabase'
import { createStock, netStockChanges } from './stockCore'

export { netStockChanges }
export const { adjustStock, applyStockChanges, setStockExact } = createStock(supabase)

/** 저장 중 오류가 났을 때 사용자에게 보여줄 말 (재고 관련 오류는 이미 알아보기 쉬운 문장) */
export const stockMessage = e => e?.message || '재고를 저장하지 못했어요'
