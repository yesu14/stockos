// 상품찾기 — 앱의 Supabase 클라이언트를 연결한 DB 접근 (본체는 whApiCore.js)
import { supabase } from '../../lib/supabase'
import { createWhApi, WhError, friendly } from './whApiCore'

export { WhError, friendly }
export default createWhApi(supabase)
